import { createHash } from "node:crypto";
import { getParentAgentIdFromLabels } from "@getpaseo/protocol/agent-labels";
import type { AgentUsage } from "@getpaseo/protocol/agent-types";

import type { AgentManagerEvent, ManagedAgent } from "../../../agent/agent-manager.js";
import {
  requestCoordinationSignal,
  updateEventPolicyState,
  type EventPolicyStateOwner,
  type EventPolicyStateSpec,
} from "../../../agent/coordination-signals.js";
import type {
  AgentEventPolicy,
  AgentEventPolicyProcessor,
  EventPolicyRuntimeDependencies,
} from "../../../agent/event-policy-runtime.js";

export const SLP_ATTENTION_POLICY_ID = "slp.attention";
export const SLP_ATTENTION_POLICY_VERSION = "5";
export const SLP_ATTENTION_STATE_VERSION = 5;
export const SLP_ATTENTION_DISABLE_FLAG = "PASEO_DISABLE_SLP_ATTENTION_POLICY";

const CONTEXT_PRESSURE_RATIO = 0.85;
const FAILURE_ATTENTION_THRESHOLD = 3;
const MAX_SEMANTIC_BUFFER_CHARACTERS = 2_000;

interface SlpAttentionState extends Record<string, unknown> {
  consecutiveTurnFailures: number;
  failureEpisodeSignaled: boolean;
  automaticCompactionCount: number;
  contextPressureActive: boolean;
  lastContextRatio?: number;
}

const INITIAL_SLP_ATTENTION_STATE: SlpAttentionState = {
  consecutiveTurnFailures: 0,
  failureEpisodeSignaled: false,
  automaticCompactionCount: 0,
  contextPressureActive: false,
};

function parseNonNegativeInteger(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : fallback;
}

function parseOptionalRatio(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
}

function parseSlpAttentionState(input: unknown): SlpAttentionState {
  const value = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const lastContextRatio = parseOptionalRatio(value.lastContextRatio);
  return {
    consecutiveTurnFailures: parseNonNegativeInteger(value.consecutiveTurnFailures, 0),
    failureEpisodeSignaled: value.failureEpisodeSignaled === true,
    automaticCompactionCount: parseNonNegativeInteger(value.automaticCompactionCount, 0),
    contextPressureActive: value.contextPressureActive === true,
    ...(lastContextRatio === undefined ? {} : { lastContextRatio }),
  };
}

const SLP_ATTENTION_STATE: EventPolicyStateSpec<SlpAttentionState> = {
  policyId: SLP_ATTENTION_POLICY_ID,
  version: SLP_ATTENTION_STATE_VERSION,
  initialState: INITIAL_SLP_ATTENTION_STATE,
  parseState: parseSlpAttentionState,
};

function findUniqueRoleAgent(
  dependencies: EventPolicyRuntimeDependencies,
  workspaceId: string | undefined,
  roleId: "lead" | "supervisor",
): ManagedAgent | null {
  if (!workspaceId) return null;
  const matches = dependencies.agentManager
    .listAgents()
    .filter(
      (agent) =>
        agent.workspaceId === workspaceId &&
        agent.roleBinding?.roleId === roleId &&
        agent.lifecycle !== "closed",
    );
  return matches.length === 1 ? matches[0] : null;
}

function findLeadForPeer(
  dependencies: EventPolicyRuntimeDependencies,
  peer: ManagedAgent,
): ManagedAgent | null {
  const parentId = getParentAgentIdFromLabels(peer.labels);
  if (parentId) {
    const parent = dependencies.agentManager.getAgent(parentId);
    if (
      parent?.roleBinding?.roleId === "lead" &&
      parent.lifecycle !== "closed" &&
      parent.workspaceId === peer.workspaceId
    ) {
      return parent;
    }
  }
  return findUniqueRoleAgent(dependencies, peer.workspaceId, "lead");
}

interface FailureRoute {
  target: ManagedAgent | null;
  recipientRole: "lead" | "supervisor";
  severity: "warning" | "critical";
  ruleId: "peer_repeated_failure" | "lead_repeated_failure";
  reason: string;
}

function resolveFailureRoute(
  dependencies: EventPolicyRuntimeDependencies,
  agent: ManagedAgent,
): FailureRoute | null {
  if (agent.roleBinding?.roleId === "peer") {
    return {
      target: findLeadForPeer(dependencies, agent),
      recipientRole: "lead",
      severity: "warning",
      ruleId: "peer_repeated_failure",
      reason:
        "A Peer reached the repeated runtime-failure threshold; Lead retains routing authority.",
    };
  }
  if (agent.roleBinding?.roleId === "lead") {
    return {
      target: findUniqueRoleAgent(dependencies, agent.workspaceId, "supervisor"),
      recipientRole: "supervisor",
      severity: "critical",
      ruleId: "lead_repeated_failure",
      reason:
        "Lead reached the repeated runtime-failure threshold and may be unable to self-recover.",
    };
  }
  return null;
}

function contextRatio(usage: AgentUsage): number | null {
  const used = usage.contextWindowUsedTokens;
  const maximum = usage.contextWindowMaxTokens;
  if (
    typeof used !== "number" ||
    !Number.isFinite(used) ||
    used < 0 ||
    typeof maximum !== "number" ||
    !Number.isFinite(maximum) ||
    maximum <= 0 ||
    used > maximum
  ) {
    return null;
  }
  return used / maximum;
}

export interface SemanticFrictionMatch {
  ruleId:
    | "explicit_reconsideration"
    | "admitted_mistake"
    | "contract_conflict"
    | "blocked_uncertainty";
  excerpt: string;
  fingerprint: string;
}

const SEMANTIC_FRICTION_RULES: Array<{
  ruleId: SemanticFrictionMatch["ruleId"];
  pattern: RegExp;
}> = [
  {
    ruleId: "explicit_reconsideration",
    pattern: /\b(?:hold on|wait (?:a second|a moment)|on second thought|I need to revisit)\b/iu,
  },
  {
    ruleId: "admitted_mistake",
    pattern:
      /\b(?:I (?:was wrong|made a mistake|missed|overlooked)|we (?:were wrong|made a mistake|missed|overlooked))\b/iu,
  },
  {
    ruleId: "contract_conflict",
    pattern:
      /\b(?:conflicts? with|contradicts?|violates?)\b.{0,100}\b(?:authority|contract|doctrine|ownership|requirement|scope)\b/iu,
  },
  {
    ruleId: "blocked_uncertainty",
    pattern:
      /\b(?:I(?:'m| am) blocked|cannot proceed|need clarification|ambiguous target|unclear ownership)\b/iu,
  },
];

/** Deterministic classifier over model-visible assistant output only. */
export function classifySemanticFriction(text: string): SemanticFrictionMatch | null {
  let latest: (SemanticFrictionMatch & { index: number }) | null = null;
  for (const rule of SEMANTIC_FRICTION_RULES) {
    const match = rule.pattern.exec(text);
    if (!match || match.index === undefined) continue;
    const start = Math.max(0, match.index - 80);
    const end = Math.min(text.length, match.index + match[0].length + 120);
    const normalizedMatch = match[0].trim().replace(/\s+/gu, " ").toLocaleLowerCase("en-US");
    const candidate = {
      ruleId: rule.ruleId,
      excerpt: text.slice(start, end).trim(),
      fingerprint: createHash("sha256")
        .update(`${rule.ruleId}\u0000${normalizedMatch}`)
        .digest("hex"),
      index: match.index,
    };
    if (!latest || candidate.index > latest.index) latest = candidate;
  }
  if (!latest) return null;
  const { index: _index, ...match } = latest;
  return match;
}

async function handleContextUsage(
  dependencies: EventPolicyRuntimeDependencies,
  agent: ManagedAgent,
  usage: AgentUsage,
  owner: EventPolicyStateOwner,
): Promise<void> {
  if (agent.roleBinding?.roleId !== "lead") return;
  const ratio = contextRatio(usage);
  if (ratio === null) return;
  const shouldNotify = await updateEventPolicyState(
    dependencies,
    agent.id,
    owner,
    SLP_ATTENTION_STATE,
    (state) => {
      const active = ratio >= CONTEXT_PRESSURE_RATIO;
      return {
        state: { ...state, lastContextRatio: ratio, contextPressureActive: active },
        result: active && !state.contextPressureActive,
      };
    },
  );
  if (!shouldNotify) return;
  await requestCoordinationSignal(dependencies, {
    targetAgentId: agent.id,
    requestedByAgentId: null,
    kind: "continuity_attention",
    trigger: "context_pressure",
    severity: "warning",
    recipientRole: "lead",
    source: {
      kind: "paseo",
      ruleId: "lead_context_pressure",
      version: SLP_ATTENTION_STATE_VERSION,
    },
    coalescingKey: "lead_context_pressure",
    reason: "Lead context crossed the bundled SLP continuity-review threshold.",
    evidence: {
      provider: agent.provider,
      contextWindowUsedTokens: usage.contextWindowUsedTokens ?? null,
      contextWindowMaxTokens: usage.contextWindowMaxTokens ?? null,
      contextRatio: Number(ratio.toFixed(4)),
      threshold: CONTEXT_PRESSURE_RATIO,
    },
  });
}

async function handleAutomaticCompaction(
  dependencies: EventPolicyRuntimeDependencies,
  agent: ManagedAgent,
  event: Extract<AgentManagerEvent, { type: "agent_stream" }>,
  owner: EventPolicyStateOwner,
): Promise<void> {
  if (
    agent.roleBinding?.roleId !== "lead" ||
    event.event.type !== "timeline" ||
    event.event.item.type !== "compaction" ||
    event.event.item.status !== "completed" ||
    event.event.item.trigger === "manual"
  ) {
    return;
  }
  await updateEventPolicyState(dependencies, agent.id, owner, SLP_ATTENTION_STATE, (state) => ({
    state: { ...state, automaticCompactionCount: state.automaticCompactionCount + 1 },
    result: undefined,
  }));
  await requestCoordinationSignal(dependencies, {
    targetAgentId: agent.id,
    requestedByAgentId: null,
    kind: "continuity_attention",
    trigger: "automatic_compaction",
    severity: "warning",
    recipientRole: "lead",
    source: {
      kind: "paseo",
      ruleId: "lead_automatic_compaction",
      version: SLP_ATTENTION_STATE_VERSION,
    },
    coalescingKey: "lead_automatic_compaction",
    reason: "The provider compacted Lead context; review continuity at this safe boundary.",
    evidence: {
      provider: agent.provider,
      trigger: event.event.item.trigger ?? "provider_unspecified",
      preTokens: event.event.item.preTokens ?? null,
    },
  });
}

async function handleTerminalEvent(
  dependencies: EventPolicyRuntimeDependencies,
  agent: ManagedAgent,
  event: Extract<AgentManagerEvent, { type: "agent_stream" }>,
  owner: EventPolicyStateOwner,
): Promise<void> {
  const roleId = agent.roleBinding?.roleId;
  if (roleId !== "lead" && roleId !== "peer") return;
  if (event.event.type === "turn_started") {
    return;
  }
  if (event.event.type === "turn_completed" || event.event.type === "turn_canceled") {
    await updateEventPolicyState(dependencies, agent.id, owner, SLP_ATTENTION_STATE, (state) => ({
      state: {
        ...state,
        consecutiveTurnFailures: 0,
        failureEpisodeSignaled: false,
      },
      result: undefined,
    }));
    return;
  }
  if (event.event.type !== "turn_failed") return;
  const route = resolveFailureRoute(dependencies, agent);
  if (!route) return;

  const outcome = await updateEventPolicyState(
    dependencies,
    agent.id,
    owner,
    SLP_ATTENTION_STATE,
    (state) => {
      const consecutiveTurnFailures = state.consecutiveTurnFailures + 1;
      const crossedThreshold = consecutiveTurnFailures === FAILURE_ATTENTION_THRESHOLD;
      const notifyCoordination =
        consecutiveTurnFailures >= FAILURE_ATTENTION_THRESHOLD &&
        !state.failureEpisodeSignaled &&
        route.target !== null;
      const notifyHuman =
        crossedThreshold &&
        !state.failureEpisodeSignaled &&
        route.target === null &&
        route.recipientRole === "supervisor";
      const notify = notifyCoordination || notifyHuman;
      return {
        state: {
          ...state,
          consecutiveTurnFailures,
          failureEpisodeSignaled: state.failureEpisodeSignaled || notify,
        },
        result: {
          notifyCoordination,
          notifyHuman,
          crossedThreshold,
        },
      };
    },
  );
  if (outcome.notifyHuman) {
    dependencies.agentManager.notifyAgentAttention(agent.id, "error", "coordination");
  }
  if (!outcome.notifyCoordination || !route.target) {
    if (!route.target && outcome.crossedThreshold && route.recipientRole === "supervisor") {
      dependencies.logger.warn(
        { agentId: agent.id, workspaceId: agent.workspaceId },
        "Lead failure attention has no unique Supervisor target",
      );
    }
    return;
  }
  await requestCoordinationSignal(dependencies, {
    targetAgentId: route.target.id,
    requestedByAgentId: null,
    kind: "continuity_attention",
    trigger: "repeated_failure",
    severity: route.severity,
    recipientRole: route.recipientRole,
    source: { kind: "paseo", ruleId: route.ruleId, version: SLP_ATTENTION_STATE_VERSION },
    coalescingKey: `${route.ruleId}:${agent.id}`,
    reason: route.reason,
    relatedAgentId: agent.id,
    evidence: {
      provider: agent.provider,
      consecutiveTurnFailures: FAILURE_ATTENTION_THRESHOLD,
      lastError: event.event.error,
    },
  });
}

function appendVisibleAssistantText(previous: string, next: string): string {
  const combined = next.startsWith(previous) ? next : `${previous}${next}`;
  return combined.slice(-MAX_SEMANTIC_BUFFER_CHARACTERS);
}

function createSlpAttentionProcessor(
  dependencies: EventPolicyRuntimeDependencies,
): AgentEventPolicyProcessor {
  const visibleAssistantBuffers = new Map<string, string>();

  async function handleSemanticFriction(
    agent: ManagedAgent,
    event: Extract<AgentManagerEvent, { type: "agent_stream" }>,
  ): Promise<void> {
    if (
      (agent.roleBinding?.roleId !== "lead" && agent.roleBinding?.roleId !== "peer") ||
      event.event.type !== "timeline" ||
      event.event.item.type !== "assistant_message"
    ) {
      return;
    }
    const supervisor = findUniqueRoleAgent(dependencies, agent.workspaceId, "supervisor");
    if (!supervisor) {
      visibleAssistantBuffers.delete(agent.id);
      return;
    }
    const text = appendVisibleAssistantText(
      visibleAssistantBuffers.get(agent.id) ?? "",
      event.event.item.text,
    );
    visibleAssistantBuffers.set(agent.id, text);
    const friction = classifySemanticFriction(text);
    if (!friction) return;
    const turnId = event.event.turnId ?? agent.activeTurnId ?? "unknown-turn";
    const coalescingKey = `semantic_friction:${agent.id}:${turnId}:${friction.fingerprint}`;
    await requestCoordinationSignal(dependencies, {
      targetAgentId: supervisor.id,
      requestedByAgentId: null,
      kind: "continuity_attention",
      customEvent: "slp.semantic_friction",
      severity: "warning",
      recipientRole: "supervisor",
      source: {
        kind: "paseo",
        ruleId: `semantic_friction:${friction.ruleId}`,
        version: SLP_ATTENTION_STATE_VERSION,
      },
      coalescingKey,
      reason: "Model-visible working-stream output matched a bundled SLP friction rule.",
      relatedAgentId: agent.id,
      evidence: {
        sourceAgentRole: agent.roleBinding.roleId,
        classifierRule: friction.ruleId,
        semanticFingerprint: friction.fingerprint,
        excerpt: friction.excerpt,
        turnId,
      },
    });
  }

  return {
    async handleEvent(event, owner) {
      if (event.type !== "agent_stream") return;
      const agent = dependencies.agentManager.getAgent(event.agentId);
      if (!agent?.roleBinding || agent.internal) return;
      if (event.event.type === "usage_updated") {
        await handleContextUsage(dependencies, agent, event.event.usage, owner);
      } else if (event.event.type === "turn_completed" && event.event.usage) {
        await handleContextUsage(dependencies, agent, event.event.usage, owner);
      }
      await handleAutomaticCompaction(dependencies, agent, event, owner);
      await handleSemanticFriction(agent, event);
      await handleTerminalEvent(dependencies, agent, event, owner);
      if (
        event.event.type === "turn_completed" ||
        event.event.type === "turn_failed" ||
        event.event.type === "turn_started" ||
        event.event.type === "turn_canceled"
      ) {
        visibleAssistantBuffers.delete(agent.id);
      }
    },
    dispose() {
      visibleAssistantBuffers.clear();
    },
  };
}

export function slpAttentionPolicyEnabled(environment: NodeJS.ProcessEnv = process.env): boolean {
  return environment[SLP_ATTENTION_DISABLE_FLAG] !== "1";
}

export const SLP_ATTENTION_EVENT_POLICY: AgentEventPolicy = {
  id: SLP_ATTENTION_POLICY_ID,
  version: SLP_ATTENTION_POLICY_VERSION,
  enabled: slpAttentionPolicyEnabled,
  createProcessor: createSlpAttentionProcessor,
};
