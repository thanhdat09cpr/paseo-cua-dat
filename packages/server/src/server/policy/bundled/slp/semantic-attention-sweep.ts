import type {
  AgentTimelineCursor,
  AgentTimelineFetchOptions,
  AgentTimelineFetchResult,
  AgentTimelineRow,
} from "../../../agent/agent-timeline-store-types.js";
import { curateProjectedAgentActivity } from "../../../agent/activity-curator.js";
import {
  buildAgentActivityReport,
  canonicalFetchLimitForActivityReport,
} from "../../../agent/activity-report.js";
import type { ManagedAgent } from "../../../agent/agent-manager.js";
import type {
  EventPolicyRuntimeDependencies,
  EventPolicySemanticAttentionClassifier,
} from "../../../agent/event-policy-runtime.js";
import type {
  SemanticAttentionDecision,
  SemanticAttentionPacket,
} from "./semantic-attention-contract.js";
import { opaqueAttentionRef } from "./semantic-attention-contract.js";
import {
  parseSemanticAttentionSweepCheckpoint,
  semanticAttentionSweepRowChanged,
  withSweepRowDigests,
  type SemanticAttentionSweepCheckpoint,
  type SweepCoverageStatus,
} from "./semantic-attention-sweep-checkpoint.js";

export const DEFAULT_SEMANTIC_ATTENTION_SWEEP_INTERVAL_MS = 15 * 60 * 1_000;
export const SEMANTIC_ATTENTION_SWEEP_PAGE_LIMIT = 8;
export const SEMANTIC_ATTENTION_SWEEP_OVERLAP_ROWS = 2;
const MAX_PACKET_EXCERPT_CHARACTERS = 2_000;

export interface SemanticAttentionSweepRoute {
  source: ManagedAgent;
  supervisor: ManagedAgent;
  sourceRole: "lead" | "peer";
  projectRef: string;
  scopeId: string;
  sourceBindingDigest: string;
  supervisorBindingDigest: string;
  sourcePolicyOwner?: string | null;
  supervisorPolicyOwner?: string | null;
  sourceWorkspaceId?: string;
  supervisorWorkspaceId?: string;
  topologyFingerprint: string;
}

export interface SemanticAttentionSweepResult {
  status: "idle" | "busy" | "evaluated" | "unavailable" | "stopped";
  agentId?: string;
  reason?: string;
}

export interface SemanticAttentionSweepOptions {
  dependencies: EventPolicyRuntimeDependencies;
  stateNamespace: string;
  resolveStateNamespace?: (agent: ManagedAgent) => string;
  intervalMs?: number;
  now?: () => number;
  resolveRoute: (
    agent: ManagedAgent,
  ) => SemanticAttentionSweepRoute | null | Promise<SemanticAttentionSweepRoute | null>;
  routeStillCurrent: (route: SemanticAttentionSweepRoute) => boolean | Promise<boolean>;
  loadCheckpoint: (agentId: string, stateNamespace: string) => Promise<unknown>;
  saveCheckpoint: (
    agentId: string,
    stateNamespace: string,
    checkpoint: SemanticAttentionSweepCheckpoint,
  ) => Promise<void>;
  resolveProjectScope?: (agent: ManagedAgent) => Promise<{ projectRef: string; scopeId: string }>;
  onWake?: (
    route: SemanticAttentionSweepRoute,
    packet: SemanticAttentionPacket,
    decision: SemanticAttentionDecision,
    report: ReturnType<typeof buildAgentActivityReport>,
  ) => Promise<void>;
}

function sourceAgents(dependencies: EventPolicyRuntimeDependencies): ManagedAgent[] {
  return dependencies.agentManager
    .listAgents()
    .filter(
      (agent) =>
        !agent.internal &&
        agent.lifecycle !== "closed" &&
        (agent.roleBinding?.roleId === "lead" || agent.roleBinding?.roleId === "peer"),
    )
    .sort((left, right) => left.id.localeCompare(right.id));
}

function cursorForFetch(
  checkpoint: SemanticAttentionSweepCheckpoint,
): AgentTimelineCursor | undefined {
  if (!checkpoint.epoch) return undefined;
  return {
    epoch: checkpoint.epoch,
    seq: Math.max(0, checkpoint.seq - SEMANTIC_ATTENTION_SWEEP_OVERLAP_ROWS),
  };
}

async function fetchPage(
  dependencies: EventPolicyRuntimeDependencies,
  agentId: string,
  checkpoint: SemanticAttentionSweepCheckpoint,
): Promise<AgentTimelineFetchResult> {
  const options: AgentTimelineFetchOptions = {
    direction: (checkpoint.epoch ? "after" : "tail") as "after" | "tail",
    cursor: cursorForFetch(checkpoint),
    limit: canonicalFetchLimitForActivityReport(SEMANTIC_ATTENTION_SWEEP_PAGE_LIMIT),
  };
  const manager = dependencies.agentManager as typeof dependencies.agentManager & {
    fetchTimeline?: (id: string, options?: AgentTimelineFetchOptions) => AgentTimelineFetchResult;
    fetchDurableTimeline?: (
      id: string,
      options?: AgentTimelineFetchOptions,
    ) => Promise<AgentTimelineFetchResult>;
  };
  if (manager.fetchDurableTimeline) return manager.fetchDurableTimeline(agentId, options);
  if (manager.fetchTimeline) return manager.fetchTimeline(agentId, options);
  throw new Error("semantic_attention_timeline_fetch_unavailable");
}

function changedRows(
  checkpoint: SemanticAttentionSweepCheckpoint,
  page: AgentTimelineFetchResult,
): AgentTimelineRow[] {
  return page.rows.filter((row) => semanticAttentionSweepRowChanged(checkpoint, page.epoch, row));
}

function checkpointAfterPage(
  checkpoint: SemanticAttentionSweepCheckpoint,
  page: AgentTimelineFetchResult,
  status: SweepCoverageStatus,
  now: number,
  advance: boolean,
  pendingRow?: SemanticAttentionSweepCheckpoint["pendingRow"],
): SemanticAttentionSweepCheckpoint {
  const sameEpoch = checkpoint.epoch === page.epoch;
  const initialSeq = pendingRow ? Math.max(0, pendingRow.seq - 1) : 0;
  const baseSeq = sameEpoch ? checkpoint.seq : initialSeq;
  const maxSeq = page.rows.reduce((max, row) => Math.max(max, row.seq), baseSeq);
  const nextPendingRow = pendingRow ?? (!advance && sameEpoch ? checkpoint.pendingRow : undefined);
  const retainedDigests = sameEpoch ? checkpoint.rowDigests : {};
  return {
    epoch: page.epoch,
    seq: advance ? maxSeq : baseSeq,
    rowDigests: advance ? withSweepRowDigests(checkpoint, page.epoch, page.rows) : retainedDigests,
    ...(nextPendingRow ? { pendingRow: nextPendingRow } : {}),
    coverage: status,
    coverageDebt:
      status === "complete"
        ? Math.max(0, checkpoint.coverageDebt - 1)
        : Math.min(100, checkpoint.coverageDebt + 1),
    lastSweepAt: new Date(now).toISOString(),
  };
}

function checkpointAfterUnresolvedRoute(
  checkpoint: SemanticAttentionSweepCheckpoint,
  now: number,
): SemanticAttentionSweepCheckpoint {
  // Keep the cursor and digests unchanged: no activity can be considered
  // delivered while its owning route is unresolved or changed in flight.
  return {
    ...checkpoint,
    coverage: "failed",
    coverageDebt: Math.min(100, checkpoint.coverageDebt + 1),
    lastSweepAt: new Date(now).toISOString(),
  };
}

function pageCoverage(page: AgentTimelineFetchResult): SweepCoverageStatus {
  if (page.gap || page.reset || page.staleCursor) return "gap";
  return page.hasNewer ? "partial" : "complete";
}

function evidenceRefsForReport(report: ReturnType<typeof buildAgentActivityReport>): string[] {
  return report.sourceRefs.slice(0, 8).map(opaqueAttentionRef);
}

interface BoundedPacketRows {
  rows: AgentTimelineRow[];
  evaluatedRows: AgentTimelineRow[];
  consumedChangedRows: AgentTimelineRow[];
  pendingRow?: SemanticAttentionSweepCheckpoint["pendingRow"];
  report: ReturnType<typeof buildAgentActivityReport>;
}

function rowActivityContent(row: AgentTimelineRow): string {
  return curateProjectedAgentActivity([row.item], {
    includeKinds: ["user_message", "assistant_message", "tool_call", "todo", "error", "compaction"],
    includeExternalToolInput: false,
    labelAssistantMessages: true,
  });
}

function rowsForBoundedPacket(
  checkpoint: SemanticAttentionSweepCheckpoint,
  page: AgentTimelineFetchResult,
  changed: readonly AgentTimelineRow[],
  agent: ManagedAgent,
  now: number,
): BoundedPacketRows {
  const ordered = [...changed].sort((left, right) => left.seq - right.seq);
  const selected: AgentTimelineRow[] = [];
  const evaluatedRows: AgentTimelineRow[] = [];
  const consumedChangedRows: AgentTimelineRow[] = [];
  let content = "";
  let pendingRow: SemanticAttentionSweepCheckpoint["pendingRow"];
  for (const row of ordered) {
    const digest = withSweepRowDigests({ ...checkpoint, epoch: page.epoch }, page.epoch, [row])[
      `${row.seq}:${page.epoch}`
    ];
    const priorPending =
      checkpoint.epoch === page.epoch && checkpoint.pendingRow?.seq === row.seq
        ? checkpoint.pendingRow
        : undefined;
    const rowOffset = priorPending?.digest === digest ? priorPending.offset : 0;
    const rowContent = rowActivityContent(row);
    if (rowContent === "No activity to display.") {
      evaluatedRows.push(row);
      consumedChangedRows.push(row);
      pendingRow = undefined;
      continue;
    }
    const suffix = rowContent.slice(Math.min(rowOffset, rowContent.length));
    if (!suffix) {
      evaluatedRows.push(row);
      consumedChangedRows.push(row);
      pendingRow = undefined;
      continue;
    }
    const separatorLength = content ? 1 : 0;
    const remaining = MAX_PACKET_EXCERPT_CHARACTERS - content.length - separatorLength;
    if (remaining <= 0) {
      pendingRow = { seq: row.seq, offset: rowOffset, digest };
      break;
    }
    const fragment = suffix.slice(0, remaining);
    content += `${content ? "\n" : ""}${fragment}`;
    selected.push(row);
    if (fragment.length < suffix.length) {
      pendingRow = { seq: row.seq, offset: rowOffset + fragment.length, digest };
      break;
    }
    evaluatedRows.push(row);
    consumedChangedRows.push(row);
    pendingRow = undefined;
  }
  const report = buildAgentActivityReport({
    agentId: agent.id,
    timeline: { ...page, rows: selected },
    snapshotAt: new Date(now).toISOString(),
    workspaceId: agent.workspaceId,
    lifecycle: agent.lifecycle,
    currentModeId: agent.currentModeId,
  });
  return {
    rows: selected,
    evaluatedRows,
    consumedChangedRows,
    ...(pendingRow ? { pendingRow } : {}),
    report: { ...report, content: content || report.content },
  };
}

function rowsThrough(
  page: AgentTimelineFetchResult,
  rows: readonly AgentTimelineRow[],
): AgentTimelineRow[] {
  const lastSeq = rows.reduce((max, row) => Math.max(max, row.seq), -1);
  return page.rows.filter((row) => row.seq <= lastSeq);
}

function makePacket(
  route: SemanticAttentionSweepRoute,
  report: ReturnType<typeof buildAgentActivityReport>,
  priorAggregateCount: number,
): SemanticAttentionPacket {
  return {
    version: 1,
    projectRef: route.projectRef,
    sourceRole: route.sourceRole,
    eventKind: "periodic_activity",
    deterministicRule: "periodic_activity",
    excerpt: report.content.slice(0, MAX_PACKET_EXCERPT_CHARACTERS),
    priorAggregateCount: Math.min(100, priorAggregateCount),
    evidenceRefs: evidenceRefsForReport(report),
  };
}

function isHighConfidenceWake(decision: SemanticAttentionDecision): boolean {
  return (
    decision.decision === "wake_candidate" && decision.risk === "high" && decision.confidence >= 0.8
  );
}

async function classify(
  classifier: EventPolicySemanticAttentionClassifier,
  packet: SemanticAttentionPacket,
): Promise<Awaited<ReturnType<EventPolicySemanticAttentionClassifier["classify"]>>> {
  return classifier.classify(packet);
}

export class SemanticAttentionSweep {
  readonly intervalMs: number;
  private disposed = false;
  private inFlight = false;
  private generation = 0;
  private cursorAgentId: string | null = null;

  constructor(private readonly options: SemanticAttentionSweepOptions) {
    this.intervalMs = options.intervalMs ?? DEFAULT_SEMANTIC_ATTENTION_SWEEP_INTERVAL_MS;
  }

  // The branches mirror the coverage state machine: fetch, classify, revalidate, commit.
  // Keeping them together prevents a partial checkpoint from being mistaken for success.
  // oxlint-disable-next-line complexity
  async runOnce(): Promise<SemanticAttentionSweepResult> {
    if (this.disposed) return { status: "stopped" };
    if (this.inFlight) return { status: "busy" };
    const classifier = this.options.dependencies.semanticAttentionClassifier;
    if (!classifier || classifier.mode === "off") return { status: "idle" };
    this.inFlight = true;
    const generation = ++this.generation;
    try {
      const agents = sourceAgents(this.options.dependencies);
      if (agents.length === 0) return { status: "idle" };
      const start = this.cursorAgentId
        ? Math.max(0, agents.findIndex((agent) => agent.id === this.cursorAgentId) + 1)
        : 0;
      const ordered = [...agents.slice(start), ...agents.slice(0, start)];
      for (const agent of ordered) {
        this.cursorAgentId = agent.id;
        const stateNamespace =
          this.options.resolveStateNamespace?.(agent) ?? this.options.stateNamespace;
        const currentCheckpoint = parseSemanticAttentionSweepCheckpoint(
          await this.options.loadCheckpoint(agent.id, stateNamespace),
        );
        let route: SemanticAttentionSweepRoute | null;
        try {
          route = await this.options.resolveRoute(agent);
        } catch (error) {
          this.options.dependencies.logger.warn(
            { err: error, agentId: agent.id },
            "Semantic attention sweep route resolution failed",
          );
          await this.options.saveCheckpoint(
            agent.id,
            stateNamespace,
            checkpointAfterUnresolvedRoute(currentCheckpoint, (this.options.now ?? Date.now)()),
          );
          continue;
        }
        if (!route) {
          await this.options.saveCheckpoint(
            agent.id,
            stateNamespace,
            checkpointAfterUnresolvedRoute(currentCheckpoint, (this.options.now ?? Date.now)()),
          );
          continue;
        }
        if (this.options.resolveProjectScope) {
          try {
            route = { ...route, ...(await this.options.resolveProjectScope(agent)) };
          } catch (error) {
            this.options.dependencies.logger.warn(
              { err: error, agentId: agent.id },
              "Semantic attention sweep project scope could not be resolved",
            );
            await this.options.saveCheckpoint(
              agent.id,
              stateNamespace,
              checkpointAfterUnresolvedRoute(currentCheckpoint, (this.options.now ?? Date.now)()),
            );
            continue;
          }
        }
        const now = (this.options.now ?? Date.now)();
        const lastSweep = Date.parse(currentCheckpoint.lastSweepAt ?? "");
        // The lightweight scheduler drains due sources within the existing model rate limit.
        // A complete source waits its cadence; unfinished pages remain eligible for the queue.
        if (
          currentCheckpoint.coverage === "complete" &&
          Number.isFinite(lastSweep) &&
          now - lastSweep < this.intervalMs
        )
          continue;
        let page: AgentTimelineFetchResult;
        try {
          page = await fetchPage(this.options.dependencies, agent.id, currentCheckpoint);
        } catch (error) {
          await this.options.saveCheckpoint(agent.id, stateNamespace, {
            ...currentCheckpoint,
            coverage: "failed",
            coverageDebt: currentCheckpoint.coverageDebt + 1,
            lastSweepAt: new Date((this.options.now ?? Date.now)()).toISOString(),
          });
          this.options.dependencies.logger.warn(
            { err: error, agentId: agent.id },
            "Semantic attention sweep timeline fetch failed",
          );
          continue;
        }
        const changed = changedRows(currentCheckpoint, page);
        if (changed.length === 0) {
          await this.options.saveCheckpoint(
            agent.id,
            stateNamespace,
            checkpointAfterPage(
              currentCheckpoint,
              page,
              pageCoverage(page),
              (this.options.now ?? Date.now)(),
              true,
            ),
          );
          continue;
        }
        const bounded = rowsForBoundedPacket(
          currentCheckpoint,
          page,
          changed,
          agent,
          (this.options.now ?? Date.now)(),
        );
        const report = bounded.report;
        const evaluatedRows = rowsThrough(page, bounded.evaluatedRows);
        if (report.coverage.visibleEntries === 0) {
          await this.options.saveCheckpoint(
            agent.id,
            stateNamespace,
            checkpointAfterPage(
              currentCheckpoint,
              page,
              pageCoverage(page),
              (this.options.now ?? Date.now)(),
              true,
            ),
          );
          continue;
        }
        const evidenceRefs = evidenceRefsForReport(report);
        if (evidenceRefs.length === 0) {
          await this.options.saveCheckpoint(
            agent.id,
            stateNamespace,
            checkpointAfterPage(
              currentCheckpoint,
              { ...page, rows: evaluatedRows },
              pageCoverage(page) === "gap" ? "gap" : "partial",
              (this.options.now ?? Date.now)(),
              true,
            ),
          );
          continue;
        }
        const priorAggregateCount =
          this.options.dependencies.semanticAttentionProjectStore?.getCount(
            stateNamespace,
            route.projectRef,
            "periodic_activity",
          ) ?? 0;
        const packet = makePacket(route, report, priorAggregateCount);
        let result: Awaited<ReturnType<EventPolicySemanticAttentionClassifier["classify"]>>;
        try {
          result = await classify(classifier, packet);
        } catch (error) {
          result = { status: "unavailable", reason: "classifier_rejected" };
          this.options.dependencies.logger.warn(
            { err: error, agentId: agent.id },
            "Semantic attention sweep classifier failed",
          );
        }
        if (this.disposed || generation !== this.generation) return { status: "stopped" };
        let routeCurrent = false;
        try {
          routeCurrent = await this.options.routeStillCurrent(route);
        } catch (error) {
          this.options.dependencies.logger.warn(
            { err: error, agentId: agent.id },
            "Semantic attention sweep route validation failed",
          );
        }
        if (this.disposed || generation !== this.generation) return { status: "stopped" };
        if (!routeCurrent) {
          this.options.dependencies.logger.info(
            { agentId: agent.id },
            "Semantic attention sweep route changed before delivery",
          );
          await this.options.saveCheckpoint(
            agent.id,
            stateNamespace,
            checkpointAfterUnresolvedRoute(currentCheckpoint, (this.options.now ?? Date.now)()),
          );
          return { status: "evaluated", agentId: agent.id, reason: "topology_changed" };
        }
        if (result.status === "unavailable") {
          await this.options.saveCheckpoint(agent.id, stateNamespace, {
            ...currentCheckpoint,
            coverage: "failed",
            coverageDebt: Math.min(100, currentCheckpoint.coverageDebt + 1),
            lastSweepAt: new Date((this.options.now ?? Date.now)()).toISOString(),
          });
          return { status: "unavailable", agentId: agent.id, reason: result.reason };
        }
        if (classifier.mode === "shadow") {
          this.options.dependencies.logger.info(
            {
              agentId: agent.id,
              decision: result.decision.decision,
              risk: result.decision.risk,
              confidence: result.decision.confidence,
            },
            "Semantic attention sweep shadow result",
          );
        } else {
          const store = this.options.dependencies.semanticAttentionProjectStore;
          const fingerprint = opaqueAttentionRef(packet.excerpt);
          const coolingDown =
            store?.isCoolingDown(
              stateNamespace,
              route.projectRef,
              "periodic_activity",
              fingerprint,
            ) ?? false;
          if (isHighConfidenceWake(result.decision) && !coolingDown) {
            await this.options.onWake?.(route, packet, result.decision, report);
          }
          store?.update(
            stateNamespace,
            route.projectRef,
            "periodic_activity",
            evidenceRefs[0],
            fingerprint,
            result.decision,
          );
        }
        let coverage: SweepCoverageStatus;
        if (pageCoverage(page) === "gap") {
          coverage = "gap";
        } else if (
          page.hasNewer ||
          (!currentCheckpoint.epoch && page.hasOlder) ||
          Boolean(bounded.pendingRow) ||
          report.coverage.contentTruncated ||
          report.coverage.omittedVisibleEntries > 0 ||
          evaluatedRows.length < page.rows.length
        ) {
          coverage = "partial";
        } else {
          coverage = "complete";
        }
        await this.options.saveCheckpoint(
          agent.id,
          stateNamespace,
          checkpointAfterPage(
            currentCheckpoint,
            { ...page, rows: evaluatedRows },
            coverage,
            (this.options.now ?? Date.now)(),
            true,
            bounded.pendingRow,
          ),
        );
        return { status: "evaluated", agentId: agent.id };
      }
      return { status: "idle" };
    } finally {
      this.inFlight = false;
    }
  }

  dispose(): void {
    this.disposed = true;
    this.generation += 1;
  }
}
