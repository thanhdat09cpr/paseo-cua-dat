import { randomUUID } from "node:crypto";
import type { Logger } from "pino";
import type {
  CoordinationSignal,
  CoordinationSignalKind,
  CoordinationSignalRecipientRole,
  CoordinationSignalResolution,
  CoordinationSignalSeverity,
  CoordinationSignalSource,
  CoordinationSignalTrigger,
} from "@getpaseo/protocol/coordination-signal";

import type { AgentManager } from "./agent-manager.js";
import type { AgentStorage, StoredAgentRecord } from "./agent-storage.js";

type CoordinationAgentManager = Pick<
  AgentManager,
  "getAgent" | "hasInFlightRun" | "notifyAgentState" | "subscribe"
>;

export interface CoordinationSignalDependencies {
  agentManager: CoordinationAgentManager;
  agentStorage: Pick<AgentStorage, "get" | "upsert" | "list">;
  sendAtSafeBoundary: (agentId: string, message: string) => Promise<void>;
  logger: Logger;
}

export interface RequestCoordinationSignalInput {
  targetAgentId: string;
  requestedByAgentId: string | null;
  kind: CoordinationSignalKind;
  trigger?: CoordinationSignalTrigger;
  customEvent?: string;
  severity?: CoordinationSignalSeverity;
  recipientRole?: CoordinationSignalRecipientRole;
  source?: CoordinationSignalSource;
  coalescingKey?: string;
  reason: string;
  observation?: string;
  question?: string;
  relatedAgentId?: string;
  evidenceRefs?: string[];
  evidence?: Record<string, string | number | boolean | null>;
}

export interface EventPolicyStateSpec<TState extends Record<string, unknown>> {
  policyId: string;
  version: number;
  initialState: TState;
  parseState: (input: unknown) => TState;
  migrateLegacy?: (record: StoredAgentRecord) => TState | null;
}

export interface EventPolicyStateOwner {
  stateNamespace: string;
}

const scheduledDeliveries = new Map<string, () => void>();
const deliveryInFlight = new Set<string>();
const recordUpdates = new Map<string, Promise<unknown>>();

async function updateRecord<T>(
  dependencies: CoordinationSignalDependencies,
  agentId: string,
  update: (record: StoredAgentRecord) => { record: StoredAgentRecord; result: T },
): Promise<T> {
  const previous = recordUpdates.get(agentId) ?? Promise.resolve();
  const current = previous.then(async () => {
    const record = await dependencies.agentStorage.get(agentId);
    if (!record || record.internal || record.archivedAt) {
      throw new Error(`Agent ${agentId} is not available for coordination signals`);
    }
    const next = update(record);
    await dependencies.agentStorage.upsert(next.record);
    dependencies.agentManager.notifyAgentState(agentId);
    return next.result;
  });
  const settledTail = current.then(
    () => undefined,
    () => undefined,
  );
  recordUpdates.set(agentId, settledTail);
  try {
    return await current;
  } finally {
    if (recordUpdates.get(agentId) === settledTail) {
      recordUpdates.delete(agentId);
    }
  }
}

function formatDelivery(signals: readonly CoordinationSignal[]): string {
  const entries = signals.map((signal) => {
    const related = signal.relatedAgentId ? `\nRelated agent: ${signal.relatedAgentId}` : "";
    const evidence =
      signal.evidenceRefs.length > 0
        ? `\nEvidence refs:\n${signal.evidenceRefs.map((ref) => `- ${ref}`).join("\n")}`
        : "";
    const trigger = signal.trigger ? `\nTrigger: ${signal.trigger}` : "";
    const customEvent = signal.customEvent ? `\nCustom event: ${signal.customEvent}` : "";
    const severity = signal.severity ? `\nSeverity: ${signal.severity}` : "";
    const observation = signal.observation ? `\nObservation: ${signal.observation}` : "";
    const question = signal.question ? `\nQuestion: ${signal.question}` : "";
    const observations = signal.evidence
      ? `\nObserved metrics:\n${Object.entries(signal.evidence)
          .map(([key, value]) => `- ${key}: ${String(value)}`)
          .join("\n")}`
      : "";
    return `Signal ${signal.id}: ${signal.kind}${trigger}${customEvent}${severity}\nReason: ${signal.reason}${observation}${question}${related}${evidence}${observations}`;
  });
  const hasNativeAttention = signals.some(
    (signal) => signal.kind === "continuity_attention" && signal.source?.kind === "paseo",
  );
  return [
    hasNativeAttention ? "Paseo coordination attention." : "Paseo coordination signal.",
    "This is advisory evidence. It does not transfer authority, prescribe handoff or detach, or require a report to another role.",
    "Evaluate it at this safe boundary within your existing lease. Resolving it does not grant handoff, detach, signaling, orchestration, or acceptance authority. Use resolve_agent_signal to record your disposition.",
    ...entries,
  ].join("\n\n");
}

function sourceForInput(input: RequestCoordinationSignalInput): CoordinationSignalSource {
  return (
    input.source ??
    (input.requestedByAgentId
      ? { kind: "agent", agentId: input.requestedByAgentId }
      : { kind: "human" })
  );
}

function sourcesMatch(
  left: CoordinationSignalSource | undefined,
  right: CoordinationSignalSource,
): boolean {
  if (!left) return false;
  if (left.kind !== right.kind) return false;
  if (left.kind === "agent" && right.kind === "agent") return left.agentId === right.agentId;
  if (left.kind === "paseo" && right.kind === "paseo") {
    return left.ruleId === right.ruleId && left.version === right.version;
  }
  return left.kind === "human" && right.kind === "human";
}

function signalsCoalesce(
  candidate: CoordinationSignal,
  input: RequestCoordinationSignalInput,
  source: CoordinationSignalSource,
): boolean {
  const hasExplicitLane =
    input.coalescingKey !== undefined || candidate.coalescingKey !== undefined;
  const sameExplicitLane = hasExplicitLane && candidate.coalescingKey === input.coalescingKey;
  const sameSource = candidate.source
    ? sourcesMatch(candidate.source, source)
    : candidate.requestedByAgentId === input.requestedByAgentId;
  return (
    candidate.status === "pending" &&
    candidate.kind === input.kind &&
    (hasExplicitLane ? sameExplicitLane : sameSource && candidate.trigger === input.trigger) &&
    candidate.relatedAgentId === input.relatedAgentId
  );
}

function mergeSignalOccurrence(
  existing: CoordinationSignal,
  input: RequestCoordinationSignalInput,
): CoordinationSignal {
  const occurredAt = new Date().toISOString();
  const previousOccurrences = existing.occurrences ?? [
    {
      occurredAt: existing.createdAt,
      evidenceRefs: existing.evidenceRefs,
      ...(existing.evidence ? { evidence: existing.evidence } : {}),
    },
  ];
  return {
    ...existing,
    evidenceRefs: [...new Set([...existing.evidenceRefs, ...(input.evidenceRefs ?? [])])].slice(
      -20,
    ),
    ...(input.evidence ? { evidence: { ...existing.evidence, ...input.evidence } } : {}),
    occurrenceCount: (existing.occurrenceCount ?? 1) + 1,
    lastOccurredAt: occurredAt,
    occurrences: [
      ...previousOccurrences,
      {
        occurredAt,
        evidenceRefs: input.evidenceRefs ?? [],
        ...(input.evidence ? { evidence: input.evidence } : {}),
      },
    ].slice(-20),
  };
}

function createCoordinationSignal(
  record: StoredAgentRecord,
  input: RequestCoordinationSignalInput,
  source: CoordinationSignalSource,
): CoordinationSignal {
  const createdAt = new Date().toISOString();
  return {
    id: randomUUID(),
    targetAgentId: input.targetAgentId,
    requestedByAgentId: input.requestedByAgentId,
    ...(record.workspaceId ? { workspaceId: record.workspaceId } : {}),
    kind: input.kind,
    ...(input.trigger ? { trigger: input.trigger } : {}),
    ...(input.customEvent ? { customEvent: input.customEvent } : {}),
    ...(input.severity ? { severity: input.severity } : {}),
    ...(input.recipientRole ? { recipientRole: input.recipientRole } : {}),
    source,
    ...(input.coalescingKey ? { coalescingKey: input.coalescingKey } : {}),
    reason: input.reason,
    ...(input.observation ? { observation: input.observation } : {}),
    ...(input.question ? { question: input.question } : {}),
    ...(input.relatedAgentId ? { relatedAgentId: input.relatedAgentId } : {}),
    evidenceRefs: input.evidenceRefs ?? [],
    ...(input.evidence ? { evidence: input.evidence } : {}),
    status: "pending",
    occurrenceCount: 1,
    lastOccurredAt: createdAt,
    createdAt,
    deliveredAt: null,
    resolvedAt: null,
  };
}

async function markDelivered(
  dependencies: CoordinationSignalDependencies,
  agentId: string,
  signalIds: ReadonlySet<string>,
): Promise<void> {
  const deliveredAt = new Date().toISOString();
  await updateRecord(dependencies, agentId, (record) => {
    const coordinationSignals = [];
    for (const signal of record.coordinationSignals ?? []) {
      const shouldMark =
        signalIds.has(signal.id) && signal.status === "pending" && signal.deliveredAt === null;
      coordinationSignals.push(shouldMark ? { ...signal, deliveredAt } : signal);
    }
    return {
      record: { ...record, coordinationSignals },
      result: undefined,
    };
  });
}

async function tryDeliver(
  dependencies: CoordinationSignalDependencies,
  agentId: string,
): Promise<void> {
  if (deliveryInFlight.has(agentId) || dependencies.agentManager.hasInFlightRun(agentId)) {
    return;
  }
  deliveryInFlight.add(agentId);
  try {
    const record = await dependencies.agentStorage.get(agentId);
    const undelivered = (record?.coordinationSignals ?? []).filter(
      (signal) => signal.status === "pending" && signal.deliveredAt === null,
    );
    if (undelivered.length === 0) {
      scheduledDeliveries.get(agentId)?.();
      scheduledDeliveries.delete(agentId);
      return;
    }
    if (dependencies.agentManager.hasInFlightRun(agentId)) {
      return;
    }
    await dependencies.sendAtSafeBoundary(agentId, formatDelivery(undelivered));
    await markDelivered(dependencies, agentId, new Set(undelivered.map((signal) => signal.id)));
  } catch (error) {
    dependencies.logger.warn(
      { err: error, agentId },
      "Failed to deliver coordination signal at safe boundary",
    );
  } finally {
    deliveryInFlight.delete(agentId);
  }
}

function scheduleDelivery(dependencies: CoordinationSignalDependencies, agentId: string): void {
  if (!scheduledDeliveries.has(agentId)) {
    const unsubscribe = dependencies.agentManager.subscribe(
      (event) => {
        if (event.type === "agent_state" && event.agent.lifecycle === "idle") {
          void tryDeliver(dependencies, agentId);
        }
      },
      { agentId, replayState: false },
    );
    scheduledDeliveries.set(agentId, unsubscribe);
  }
  void tryDeliver(dependencies, agentId);
}

export async function requestCoordinationSignal(
  dependencies: CoordinationSignalDependencies,
  input: RequestCoordinationSignalInput,
): Promise<CoordinationSignal> {
  const source = sourceForInput(input);
  const signal = await updateRecord(dependencies, input.targetAgentId, (record) => {
    const existing = (record.coordinationSignals ?? []).find((candidate) =>
      signalsCoalesce(candidate, input, source),
    );
    if (existing) {
      const merged = mergeSignalOccurrence(existing, input);
      const signals = [...(record.coordinationSignals ?? [])];
      signals[signals.indexOf(existing)] = merged;
      return { record: { ...record, coordinationSignals: signals }, result: merged };
    }
    const created = createCoordinationSignal(record, input, source);
    return {
      record: {
        ...record,
        coordinationSignals: [...(record.coordinationSignals ?? []), created],
      },
      result: created,
    };
  });
  scheduleDelivery(dependencies, input.targetAgentId);
  return signal;
}

export async function updateEventPolicyState<TState extends Record<string, unknown>, TResult>(
  dependencies: CoordinationSignalDependencies,
  agentId: string,
  owner: EventPolicyStateOwner,
  spec: EventPolicyStateSpec<TState>,
  update: (
    state: TState,
    record: StoredAgentRecord,
  ) => {
    state: TState;
    result: TResult;
  },
): Promise<TResult> {
  return updateRecord(dependencies, agentId, (record) => {
    const stateKey = `${owner.stateNamespace}/${spec.policyId}`;
    const persisted = record.eventPolicyStates?.[stateKey];
    const state =
      persisted?.version === spec.version
        ? spec.parseState(persisted.state)
        : (spec.migrateLegacy?.(record) ?? spec.parseState(spec.initialState));
    const next = update(state, record);
    return {
      record: {
        ...record,
        eventPolicyStates: {
          ...record.eventPolicyStates,
          [stateKey]: {
            version: spec.version,
            state: next.state,
          },
        },
      },
      result: next.result,
    };
  });
}

export async function resumePendingCoordinationSignalDeliveries(
  dependencies: CoordinationSignalDependencies,
): Promise<() => void> {
  const scheduledAgentIds: string[] = [];
  for (const record of await dependencies.agentStorage.list()) {
    if (
      record.internal ||
      record.archivedAt ||
      !record.coordinationSignals?.some(
        (signal) => signal.status === "pending" && signal.deliveredAt === null,
      )
    ) {
      continue;
    }
    scheduledAgentIds.push(record.id);
    scheduleDelivery(dependencies, record.id);
  }
  return () => {
    for (const agentId of scheduledAgentIds) {
      scheduledDeliveries.get(agentId)?.();
      scheduledDeliveries.delete(agentId);
    }
  };
}

export async function resolveCoordinationSignal(
  dependencies: CoordinationSignalDependencies,
  input: {
    targetAgentId: string;
    signalId: string;
    resolution: CoordinationSignalResolution;
    note?: string;
  },
): Promise<CoordinationSignal> {
  return updateRecord(dependencies, input.targetAgentId, (record) => {
    const signals = record.coordinationSignals ?? [];
    const index = signals.findIndex((signal) => signal.id === input.signalId);
    if (index < 0) {
      throw new Error(
        `Coordination signal ${input.signalId} not found for agent ${input.targetAgentId}`,
      );
    }
    const current = signals[index];
    if (current.status !== "pending") {
      if (current.status === input.resolution && current.resolutionNote === input.note) {
        return { record, result: current };
      }
      throw new Error(`Coordination signal ${input.signalId} is already ${current.status}`);
    }
    const resolved: CoordinationSignal = {
      ...current,
      status: input.resolution,
      resolvedAt: new Date().toISOString(),
      ...(input.note ? { resolutionNote: input.note } : {}),
    };
    const nextSignals = [...signals];
    nextSignals[index] = resolved;
    return {
      record: { ...record, coordinationSignals: nextSignals },
      result: resolved,
    };
  });
}
