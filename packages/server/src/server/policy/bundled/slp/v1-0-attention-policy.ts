import { getParentAgentIdFromLabels } from "@getpaseo/protocol/agent-labels";
import type { AgentUsage } from "@getpaseo/protocol/agent-types";

import type { AgentManagerEvent, ManagedAgent } from "../../../agent/agent-manager.js";
import type { StoredAgentRecord } from "../../../agent/agent-storage.js";
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

const POLICY_VERSION = 1;
const CONTEXT_PRESSURE_RATIO = 0.85;
const FAILURE_ATTENTION_THRESHOLD = 3;
const LEGACY_COALESCING_KEY = "slp.v1.native_attention";
export const SLP_V1_0_ATTENTION_ENABLE_FLAG = "PASEO_ENABLE_NATIVE_COORDINATION_POLICY";

interface SlpV10AttentionState extends Record<string, unknown> {
  consecutiveTurnFailures: number;
  failureAttentionSent: boolean;
  automaticCompactionCount: number;
  automaticCompactionAttentionSent: boolean;
  contextPressureAttentionSent: boolean;
  lastContextRatio?: number;
}

const INITIAL_STATE: SlpV10AttentionState = {
  consecutiveTurnFailures: 0,
  failureAttentionSent: false,
  automaticCompactionCount: 0,
  automaticCompactionAttentionSent: false,
  contextPressureAttentionSent: false,
};

function nonNegativeInteger(value: unknown): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : 0;
}

function parseState(input: unknown): SlpV10AttentionState {
  const value = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const lastContextRatio =
    typeof value.lastContextRatio === "number" && Number.isFinite(value.lastContextRatio)
      ? value.lastContextRatio
      : undefined;
  return {
    consecutiveTurnFailures: nonNegativeInteger(value.consecutiveTurnFailures),
    failureAttentionSent: value.failureAttentionSent === true,
    automaticCompactionCount: nonNegativeInteger(value.automaticCompactionCount),
    automaticCompactionAttentionSent: value.automaticCompactionAttentionSent === true,
    contextPressureAttentionSent: value.contextPressureAttentionSent === true,
    ...(lastContextRatio === undefined ? {} : { lastContextRatio }),
  };
}

const STATE_SPEC: EventPolicyStateSpec<SlpV10AttentionState> = {
  policyId: "slp.attention",
  version: POLICY_VERSION,
  initialState: INITIAL_STATE,
  parseState,
  migrateLegacy(record: StoredAgentRecord) {
    return record.coordinationPolicyState ? parseState(record.coordinationPolicyState) : null;
  },
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

function contextRatio(usage: AgentUsage): number | null {
  const used = usage.contextWindowUsedTokens;
  const maximum = usage.contextWindowMaxTokens;
  if (
    typeof used !== "number" ||
    !Number.isFinite(used) ||
    used < 0 ||
    typeof maximum !== "number" ||
    !Number.isFinite(maximum) ||
    maximum <= 0
  ) {
    return null;
  }
  return used / maximum;
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
    STATE_SPEC,
    (state) => ({
      state: {
        ...state,
        lastContextRatio: ratio,
        contextPressureAttentionSent:
          state.contextPressureAttentionSent || ratio >= CONTEXT_PRESSURE_RATIO,
      },
      result: ratio >= CONTEXT_PRESSURE_RATIO && !state.contextPressureAttentionSent,
    }),
  );
  if (!shouldNotify) return;
  await requestCoordinationSignal(dependencies, {
    targetAgentId: agent.id,
    requestedByAgentId: null,
    kind: "continuity_attention",
    trigger: "context_pressure",
    severity: "warning",
    recipientRole: "lead",
    source: { kind: "paseo", ruleId: "lead_context_pressure", version: POLICY_VERSION },
    coalescingKey: LEGACY_COALESCING_KEY,
    reason: "Lead context crossed the native continuity-review threshold.",
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
  const shouldNotify = await updateEventPolicyState(
    dependencies,
    agent.id,
    owner,
    STATE_SPEC,
    (state) => ({
      state: {
        ...state,
        automaticCompactionCount: state.automaticCompactionCount + 1,
        automaticCompactionAttentionSent: true,
      },
      result: !state.automaticCompactionAttentionSent,
    }),
  );
  if (!shouldNotify) return;
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
      version: POLICY_VERSION,
    },
    coalescingKey: LEGACY_COALESCING_KEY,
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
  if (event.event.type === "turn_completed" || event.event.type === "turn_canceled") {
    await updateEventPolicyState(dependencies, agent.id, owner, STATE_SPEC, (state) => ({
      state: { ...state, consecutiveTurnFailures: 0, failureAttentionSent: false },
      result: undefined,
    }));
    return;
  }
  if (event.event.type !== "turn_failed") return;
  const target =
    roleId === "peer"
      ? findLeadForPeer(dependencies, agent)
      : findUniqueRoleAgent(dependencies, agent.workspaceId, "supervisor");
  const recipientRole = roleId === "peer" ? "lead" : "supervisor";
  const ruleId = roleId === "peer" ? "peer_repeated_failure" : "lead_repeated_failure";
  const outcome = await updateEventPolicyState(
    dependencies,
    agent.id,
    owner,
    STATE_SPEC,
    (state) => {
      const consecutiveTurnFailures = state.consecutiveTurnFailures + 1;
      const notify =
        consecutiveTurnFailures >= FAILURE_ATTENTION_THRESHOLD &&
        !state.failureAttentionSent &&
        target !== null;
      return {
        state: {
          ...state,
          consecutiveTurnFailures,
          failureAttentionSent: state.failureAttentionSent || notify,
        },
        result: {
          notify,
          crossedThreshold: consecutiveTurnFailures === FAILURE_ATTENTION_THRESHOLD,
        },
      };
    },
  );
  if (!outcome.notify || !target) {
    if (!target && outcome.crossedThreshold && recipientRole === "supervisor") {
      dependencies.logger.warn(
        { agentId: agent.id, workspaceId: agent.workspaceId },
        "Lead failure attention has no unique Supervisor target",
      );
    }
    return;
  }
  await requestCoordinationSignal(dependencies, {
    targetAgentId: target.id,
    requestedByAgentId: null,
    kind: "continuity_attention",
    trigger: "repeated_failure",
    severity: roleId === "peer" ? "warning" : "critical",
    recipientRole,
    source: { kind: "paseo", ruleId, version: POLICY_VERSION },
    coalescingKey: `${LEGACY_COALESCING_KEY}:${agent.id}`,
    reason:
      roleId === "peer"
        ? "A Peer reached the repeated runtime-failure threshold; Lead retains routing authority."
        : "Lead reached the repeated runtime-failure threshold and may be unable to self-recover.",
    relatedAgentId: agent.id,
    evidence: {
      provider: agent.provider,
      consecutiveTurnFailures: FAILURE_ATTENTION_THRESHOLD,
      lastError: event.event.error,
    },
  });
}

function createProcessor(dependencies: EventPolicyRuntimeDependencies): AgentEventPolicyProcessor {
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
      await handleTerminalEvent(dependencies, agent, event, owner);
    },
  };
}

export const SLP_V1_0_ATTENTION_EVENT_POLICY: AgentEventPolicy = {
  id: "slp.attention",
  version: String(POLICY_VERSION),
  enabled: (environment) => environment[SLP_V1_0_ATTENTION_ENABLE_FLAG] === "1",
  createProcessor,
};
