import type { AgentTimelineItem } from "./agent-sdk-types.js";
import type {
  AgentTimelineCursor,
  AgentTimelineFetchResult,
} from "./agent-timeline-store-types.js";
import { curateProjectedAgentActivity, type ActivityCuratorOptions } from "./activity-curator.js";
import { projectTimelineRows, type TimelineProjectionEntry } from "./timeline-projection.js";

export const DEFAULT_ACTIVITY_REPORT_LIMIT = 20;
export const MAX_ACTIVITY_REPORT_LIMIT = 50;
const MAX_ACTIVITY_REPORT_CONTENT_CHARS = 12_000;

export const EXTERNALLY_VISIBLE_ACTIVITY_KINDS = [
  "user_message",
  "assistant_message",
  "tool_call",
  "todo",
  "error",
  "compaction",
] as const satisfies readonly AgentTimelineItem["type"][];

export type ActivityReportDirection = "tail" | "before" | "after";
type VisibleActivityKind = (typeof EXTERNALLY_VISIBLE_ACTIVITY_KINDS)[number];

export interface AgentActivityObservationRequest {
  limit?: number;
  direction?: ActivityReportDirection;
  cursor?: AgentTimelineCursor;
}

export interface AgentActivityReportInput {
  agentId: string;
  timeline: AgentTimelineFetchResult;
  snapshotAt: string;
  workspaceId?: string | null;
  projectId?: string | null;
  lifecycle?: string | null;
  currentModeId?: string | null;
  limitCapped?: boolean;
}

export interface AgentActivityReport {
  agentId: string;
  workspaceId: string | null;
  projectId: string | null;
  snapshotAt: string;
  epoch: string;
  direction: ActivityReportDirection;
  reset: boolean;
  staleCursor: boolean;
  gap: boolean;
  window: AgentTimelineFetchResult["window"];
  startCursor: AgentTimelineCursor | null;
  endCursor: AgentTimelineCursor | null;
  /**
   * Cursor for the examined canonical page, including rows filtered from content.
   * Continue tail/before pages with before and after pages with after.
   */
  nextCursor: AgentTimelineCursor | null;
  hasOlder: boolean;
  hasNewer: boolean;
  sourceRefs: string[];
  observedState: {
    lifecycle: string | null;
    currentModeId: string | null;
  };
  coverage: {
    kind: "bounded";
    canonicalRows: number;
    projectedEntries: number;
    visibleEntries: number;
    returnedEntries: number;
    omittedVisibleEntries: number;
    omittedCanonicalRows: number;
    omittedKinds: AgentTimelineItem["type"][];
    truncated: boolean;
    contentTruncated: boolean;
    contentOmittedEntries: number;
    limitCapped: boolean;
  };
  updateCount: number;
  currentModeId: string | null;
  content: string;
}

function visibleActivityKind(item: AgentTimelineItem): item is AgentTimelineItem & {
  type: VisibleActivityKind;
} {
  return (EXTERNALLY_VISIBLE_ACTIVITY_KINDS as readonly string[]).includes(item.type);
}

function sourceRef(agentId: string, epoch: string, seqStart: number, seqEnd: number): string {
  const range = seqStart === seqEnd ? String(seqStart) : `${seqStart}-${seqEnd}`;
  return `timeline:${agentId}:${epoch}:${range}`;
}

function sourceRefsForEntries(
  agentId: string,
  epoch: string,
  entries: readonly TimelineProjectionEntry[],
): string[] {
  return Array.from(
    new Set(
      entries.flatMap((entry) =>
        entry.sourceSeqRanges.map((range) =>
          sourceRef(agentId, epoch, range.startSeq, range.endSeq),
        ),
      ),
    ),
  );
}

function cursorForEntry(
  epoch: string,
  entry: TimelineProjectionEntry | undefined,
): AgentTimelineCursor | null {
  return entry ? { epoch, seq: entry.seqStart } : null;
}

function endCursorForEntry(
  epoch: string,
  entry: TimelineProjectionEntry | undefined,
): AgentTimelineCursor | null {
  return entry ? { epoch, seq: entry.seqEnd } : null;
}

function cursorForPage(
  epoch: string,
  timeline: AgentTimelineFetchResult,
  direction: ActivityReportDirection,
): AgentTimelineCursor | null {
  const first = timeline.rows[0];
  const last = timeline.rows.at(-1);
  if (!first || !last) return null;
  return { epoch, seq: direction === "after" ? last.seq : first.seq };
}

function canonicalRowsCoveredByEntries(
  rows: readonly AgentTimelineFetchResult["rows"][number][],
  entries: readonly TimelineProjectionEntry[],
): number {
  const ranges = entries.flatMap((entry) => entry.sourceSeqRanges);
  return rows.filter((row) =>
    ranges.some((range) => row.seq >= range.startSeq && row.seq <= range.endSeq),
  ).length;
}

function renderBoundedEntries(
  entries: readonly TimelineProjectionEntry[],
  options: ActivityCuratorOptions,
): {
  content: string;
  returnedEntries: number;
  contentTruncated: boolean;
  contentOmittedEntries: number;
} {
  let content = "";
  let returnedEntries = 0;
  let contentTruncated = false;
  let contentOmittedEntries = 0;

  for (const entry of entries) {
    const rendered = curateProjectedAgentActivity([entry.item], options);
    const separator = content ? "\n" : "";
    const remaining = MAX_ACTIVITY_REPORT_CONTENT_CHARS - content.length - separator.length;
    if (remaining <= 0) {
      contentTruncated = true;
      contentOmittedEntries += 1;
      continue;
    }
    if (rendered.length <= remaining) {
      content += `${separator}${rendered}`;
      returnedEntries += 1;
      continue;
    }

    const fragment = remaining === 1 ? "…" : `${rendered.slice(0, remaining - 1)}…`;
    content += `${separator}${fragment}`;
    returnedEntries += 1;
    contentTruncated = true;
    contentOmittedEntries += 1;
  }

  return {
    content: content || "No activity to display.",
    returnedEntries,
    contentTruncated,
    contentOmittedEntries,
  };
}

export function canonicalFetchLimitForActivityReport(limit: number): number {
  return Math.min(MAX_ACTIVITY_REPORT_LIMIT, Math.max(1, Math.floor(limit)));
}

export function buildAgentActivityReport(input: AgentActivityReportInput): AgentActivityReport {
  const timeline = input.timeline;
  const direction = timeline.direction;
  const projected = projectTimelineRows({ rows: timeline.rows, mode: "projected" });
  const visible = projected.filter((entry) => visibleActivityKind(entry.item));
  // The timeline store already bounded this report by canonical rows. Keep all
  // projected visible entries from that page so the page cursor cannot skip
  // entries that were filtered out of the rendered content.
  const selected = visible;
  const omittedKinds = Array.from(
    new Set(
      projected.filter((entry) => !visibleActivityKind(entry.item)).map((entry) => entry.item.type),
    ),
  );
  const content = renderBoundedEntries(selected, {
    includeKinds: EXTERNALLY_VISIBLE_ACTIVITY_KINDS,
    includeExternalToolInput: false,
    labelAssistantMessages: true,
  });
  const first = selected[0];
  const last = selected.at(-1);
  const startCursor = cursorForEntry(timeline.epoch, first);
  const endCursor = endCursorForEntry(timeline.epoch, last);
  const hasOlder = timeline.hasOlder;
  const hasNewer = timeline.hasNewer;
  const omittedVisibleEntries = Math.max(0, visible.length - content.returnedEntries);
  const omittedCanonicalRows = Math.max(
    0,
    timeline.rows.length - canonicalRowsCoveredByEntries(timeline.rows, selected),
  );
  const truncated =
    input.limitCapped ||
    content.contentTruncated ||
    omittedVisibleEntries > 0 ||
    hasOlder ||
    hasNewer ||
    timeline.reset ||
    timeline.staleCursor ||
    timeline.gap;

  return {
    agentId: input.agentId,
    workspaceId: input.workspaceId ?? null,
    projectId: input.projectId ?? null,
    snapshotAt: input.snapshotAt,
    epoch: timeline.epoch,
    direction,
    reset: timeline.reset,
    staleCursor: timeline.staleCursor,
    gap: timeline.gap,
    window: timeline.window,
    startCursor,
    endCursor,
    nextCursor: cursorForPage(timeline.epoch, timeline, direction),
    hasOlder,
    hasNewer,
    sourceRefs: sourceRefsForEntries(input.agentId, timeline.epoch, selected),
    observedState: {
      lifecycle: input.lifecycle ?? null,
      currentModeId: input.currentModeId ?? null,
    },
    coverage: {
      kind: "bounded",
      canonicalRows: timeline.rows.length,
      projectedEntries: projected.length,
      visibleEntries: visible.length,
      returnedEntries: content.returnedEntries,
      omittedVisibleEntries,
      omittedCanonicalRows,
      omittedKinds,
      truncated,
      contentTruncated: content.contentTruncated,
      contentOmittedEntries: content.contentOmittedEntries,
      limitCapped: input.limitCapped ?? false,
    },
    updateCount: Math.max(0, timeline.window.nextSeq - 1),
    currentModeId: input.currentModeId ?? null,
    content: content.content,
  };
}
