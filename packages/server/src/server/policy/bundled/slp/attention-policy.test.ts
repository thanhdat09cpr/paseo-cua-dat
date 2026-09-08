import { SemanticAttentionProjectStore } from "./semantic-attention-project-store.js";
import {
  opaqueAttentionRef,
  type SemanticAttentionClassifierResult,
} from "./semantic-attention-contract.js";
import pino from "pino";
import { describe, expect, test, vi } from "vitest";

import type { AgentManagerEvent, ManagedAgent } from "../../../agent/agent-manager.js";
import type { StoredAgentRecord } from "../../../agent/agent-storage.js";
import { resolveCoordinationSignal } from "../../../agent/coordination-signals.js";
import {
  startEventPolicyRuntime,
  type EventPolicySemanticAttentionClassifier,
} from "../../../agent/event-policy-runtime.js";
import {
  classifySemanticFriction,
  SLP_ATTENTION_DISABLE_FLAG,
  SLP_ATTENTION_EVENT_POLICY,
  slpAttentionPolicyEnabled,
} from "./attention-policy.js";

const TEST_STATE_NAMESPACE = "slp@test-generation";
const TEST_STATE_KEY = `${TEST_STATE_NAMESPACE}/slp.attention`;

function roleBinding(roleId: "lead" | "peer" | "supervisor") {
  return {
    roleId,
    definitionVersion: "test",
    definitionDigest: "definition",
    bindingDigest: `binding-${roleId}`,
    provider: "codex",
    injectionMethod: "codex-developer-instructions" as const,
    qualification: "implementation-supported" as const,
    workspaceProtocol: { status: "missing" as const, path: "/repo/WORKSPACE_PROTOCOL.md" },
    createdAt: new Date().toISOString(),
    instructions: `Role: ${roleId}`,
  };
}

function createHarness(
  harnessOptions: {
    classifier?: EventPolicySemanticAttentionClassifier;
    projectId?: string | null;
  } = {},
) {
  const records = new Map<string, StoredAgentRecord>();
  const agents = new Map<string, ManagedAgent>();
  const subscribers = new Set<{
    callback: (event: AgentManagerEvent) => void;
    agentId?: string;
  }>();
  const sent: Array<{ agentId: string; message: string }> = [];

  function addAgent(input: {
    id: string;
    roleId: "lead" | "peer" | "supervisor";
    lifecycle?: "idle" | "running" | "error";
    parentAgentId?: string;
    workspaceId?: string;
  }) {
    const binding = roleBinding(input.roleId);
    const labels = input.parentAgentId ? { "paseo.parent-agent-id": input.parentAgentId } : {};
    const lifecycle = input.lifecycle ?? "idle";
    agents.set(input.id, {
      id: input.id,
      provider: "codex",
      cwd: "/repo",
      workspaceId: input.workspaceId ?? "workspace-1",
      roleBinding: binding,
      labels,
      lifecycle,
      internal: false,
      activeTurnId: null,
    } as ManagedAgent);
    records.set(input.id, {
      id: input.id,
      provider: "codex",
      cwd: "/repo",
      workspaceId: input.workspaceId ?? "workspace-1",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      labels,
      lastStatus: lifecycle,
      config: null,
      persistence: null,
      roleBinding: binding,
    });
  }

  function removeAgent(id: string) {
    agents.delete(id);
    records.delete(id);
  }

  const dependencies = {
    agentStorage: {
      get: vi.fn(async (id: string) => records.get(id) ?? null),
      list: vi.fn(async () => [...records.values()]),
      upsert: vi.fn(async (record: StoredAgentRecord) => records.set(record.id, record)),
    },
    agentManager: {
      getAgent: vi.fn((id: string) => agents.get(id) ?? null),
      listAgents: vi.fn(() => [...agents.values()]),
      hasInFlightRun: vi.fn((id: string) => agents.get(id)?.lifecycle === "running"),
      notifyAgentAttention: vi.fn(),
      notifyAgentState: vi.fn(),
      subscribe: vi.fn(
        (
          callback: (event: AgentManagerEvent) => void,
          options?: { agentId?: string; replayState?: boolean },
        ) => {
          const subscription = { callback, agentId: options?.agentId };
          subscribers.add(subscription);
          return () => subscribers.delete(subscription);
        },
      ),
    },
    sendAtSafeBoundary: vi.fn(async (agentId: string, message: string) => {
      if (agents.get(agentId)?.lifecycle === "running") throw new Error("unsafe delivery");
      sent.push({ agentId, message });
    }),
    logger: pino({ level: "silent" }),
    semanticAttentionProjectStore: new SemanticAttentionProjectStore(),
    ...(harnessOptions.classifier
      ? { semanticAttentionClassifier: harnessOptions.classifier }
      : {}),
    resolveProjectIdForWorkspace: vi.fn(async () => harnessOptions.projectId ?? null),
  };

  function eventAgentId(event: AgentManagerEvent): string | undefined {
    if (event.type === "agent_stream") return event.agentId;
    if (event.type === "agent_state") return event.agent.id;
    return undefined;
  }

  function emit(event: AgentManagerEvent) {
    for (const subscription of subscribers) {
      if (!subscription.agentId || subscription.agentId === eventAgentId(event)) {
        subscription.callback(event);
      }
    }
  }

  const start = () =>
    startEventPolicyRuntime({
      dependencies,
      advertisedPolicies: [SLP_ATTENTION_EVENT_POLICY],
      resolvePolicies: () => [
        { policy: SLP_ATTENTION_EVENT_POLICY, stateNamespace: TEST_STATE_NAMESPACE },
      ],
      environment: {},
    });

  return { addAgent, dependencies, emit, records, removeAgent, sent, start };
}

describe("bundled SLP attention policy", () => {
  test.each(["complete", "replace", "binding", "project", "parent", "dispose"])(
    "discards late classifier output after %s",
    async (change) => {
      let resolve!: (value: SemanticAttentionClassifierResult) => void;
      const classifier = {
        mode: "active" as const,
        classify: vi.fn(
          () =>
            new Promise<SemanticAttentionClassifierResult>((done) => {
              resolve = done;
            }),
        ),
      };
      const harness = createHarness({ classifier, projectId: "p1" });
      harness.addAgent({ id: "supervisor-1", roleId: "supervisor" });
      harness.addAgent({ id: "supervisor-2", roleId: "supervisor" });
      harness.addAgent({ id: "lead-1", roleId: "lead", parentAgentId: "supervisor-1" });
      const runtime = harness.start();
      harness.emit({
        type: "agent_stream",
        agentId: "lead-1",
        event: {
          type: "timeline",
          provider: "codex",
          turnId: "t1",
          item: { type: "assistant_message", text: "I made a mistake about the scope." },
        },
      });
      await vi.waitFor(() => expect(classifier.classify).toHaveBeenCalledTimes(1));
      const agent = harness.dependencies.agentManager.getAgent("lead-1")!;
      if (change === "complete")
        harness.emit({
          type: "agent_stream",
          agentId: "lead-1",
          event: { type: "turn_completed", provider: "codex", turnId: "t1" },
        });
      if (change === "replace") agent.activeTurnId = "t2";
      if (change === "binding") agent.roleBinding!.bindingDigest = "replacement";
      if (change === "project")
        harness.dependencies.resolveProjectIdForWorkspace.mockResolvedValue("p2");
      if (change === "parent") agent.labels = { "paseo.parent-agent-id": "supervisor-2" };
      if (change === "dispose") runtime.stop();
      await new Promise((done) => setTimeout(done, 20));
      resolve({ status: "unavailable", reason: "timeout" });
      await new Promise((done) => setTimeout(done, 20));
      expect(harness.records.get("supervisor-1")?.coordinationSignals).toBeUndefined();
      expect(harness.records.get("supervisor-2")?.coordinationSignals).toBeUndefined();
      runtime.stop();
    },
  );

  test("deduplicates streaming friction while classification is pending", async () => {
    let resolve!: (value: SemanticAttentionClassifierResult) => void;
    const classifier = {
      mode: "active" as const,
      classify: vi.fn(
        () =>
          new Promise<SemanticAttentionClassifierResult>((done) => {
            resolve = done;
          }),
      ),
    };
    const harness = createHarness({ classifier });
    harness.addAgent({ id: "supervisor-1", roleId: "supervisor" });
    harness.addAgent({ id: "lead-1", roleId: "lead" });
    const runtime = harness.start();
    const event = {
      type: "agent_stream",
      agentId: "lead-1",
      event: {
        type: "timeline",
        provider: "codex",
        turnId: "t1",
        item: { type: "assistant_message", text: "I made a mistake about the scope." },
      },
    } as AgentManagerEvent;
    harness.emit(event);
    await vi.waitFor(() => expect(classifier.classify).toHaveBeenCalledTimes(1));
    harness.emit(event);
    await new Promise((done) => setTimeout(done, 20));
    expect(classifier.classify).toHaveBeenCalledTimes(1);
    resolve({
      status: "classified",
      decision: {
        decision: "ignore",
        risk: "low",
        confidence: 0.9,
        reason: "Routine correction",
        evidenceRefs: [],
      },
    });
    await new Promise((done) => setTimeout(done, 20));
    expect(harness.records.get("supervisor-1")?.coordinationSignals).toBeUndefined();
    runtime.stop();
  });

  test("suppresses the same semantic fingerprint across turns during cooldown", async () => {
    const classifier = {
      mode: "active" as const,
      classify: vi.fn(async (packet: { evidenceRefs: string[] }) => ({
        status: "classified" as const,
        decision: {
          decision: "wake_candidate" as const,
          risk: "high" as const,
          confidence: 0.95,
          reason: "Supervisor review is warranted.",
          evidenceRefs: packet.evidenceRefs,
        },
      })),
    };
    const harness = createHarness({ classifier });
    harness.addAgent({ id: "supervisor-1", roleId: "supervisor" });
    harness.addAgent({ id: "lead-1", roleId: "lead" });
    const runtime = harness.start();
    const emit = (turnId: string) =>
      harness.emit({
        type: "agent_stream",
        agentId: "lead-1",
        event: {
          type: "timeline",
          provider: "codex",
          turnId,
          item: { type: "assistant_message", text: "I cannot proceed; ownership is unclear." },
        },
      });

    emit("turn-1");
    await vi.waitFor(() => expect(classifier.classify).toHaveBeenCalledTimes(1));
    await vi.waitFor(() =>
      expect(harness.records.get("supervisor-1")?.coordinationSignals).toHaveLength(1),
    );
    harness.emit({
      type: "agent_stream",
      agentId: "lead-1",
      event: { type: "turn_completed", provider: "codex", turnId: "turn-1" },
    });
    emit("turn-2");
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(classifier.classify).toHaveBeenCalledTimes(1);
    expect(harness.records.get("supervisor-1")?.coordinationSignals).toHaveLength(1);
    runtime.stop();
  });

  test("is enabled by default with an exact emergency disable", () => {
    expect(slpAttentionPolicyEnabled({})).toBe(true);
    expect(slpAttentionPolicyEnabled({ [SLP_ATTENTION_DISABLE_FLAG]: "0" })).toBe(true);
    expect(slpAttentionPolicyEnabled({ [SLP_ATTENTION_DISABLE_FLAG]: "1" })).toBe(false);
  });

  test("classifies sparse semantic friction and ignores ordinary output", () => {
    expect(classifySemanticFriction("Hold on, I overlooked the ownership contract.")).toMatchObject(
      {
        ruleId: "admitted_mistake",
      },
    );
    expect(
      classifySemanticFriction("The focused tests passed and the candidate is ready."),
    ).toBeNull();
  });

  test("re-arms context pressure after a below-threshold transition and resolution", async () => {
    const harness = createHarness();
    harness.addAgent({ id: "lead-1", roleId: "lead" });
    const runtime = harness.start();
    const usage = (used: number) =>
      harness.emit({
        type: "agent_stream",
        agentId: "lead-1",
        event: {
          type: "usage_updated",
          provider: "codex",
          usage: { contextWindowUsedTokens: used, contextWindowMaxTokens: 100 },
        },
      });

    usage(59);
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(harness.records.get("lead-1")?.coordinationSignals).toBeUndefined();
    usage(60);
    await vi.waitFor(() =>
      expect(harness.records.get("lead-1")?.coordinationSignals).toHaveLength(1),
    );
    const first = harness.records.get("lead-1")?.coordinationSignals?.[0];
    if (!first) throw new Error("missing first signal");
    await resolveCoordinationSignal(harness.dependencies, {
      targetAgentId: "lead-1",
      signalId: first.id,
      resolution: "completed",
    });
    usage(40);
    usage(60);
    await vi.waitFor(() =>
      expect(harness.records.get("lead-1")?.coordinationSignals).toHaveLength(2),
    );
    runtime.stop();
  });

  test("treats contradictory over-maximum context telemetry as unknown", async () => {
    const harness = createHarness();
    harness.addAgent({ id: "lead-1", roleId: "lead" });
    const runtime = harness.start();
    harness.emit({
      type: "agent_stream",
      agentId: "lead-1",
      event: {
        type: "usage_updated",
        provider: "codex",
        usage: { contextWindowUsedTokens: 120, contextWindowMaxTokens: 100 },
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(harness.records.get("lead-1")?.coordinationSignals).toBeUndefined();
    runtime.stop();
  });

  test("coalesces pending compactions and re-arms after disposition", async () => {
    const harness = createHarness();
    harness.addAgent({ id: "lead-1", roleId: "lead" });
    const runtime = harness.start();
    const compaction = {
      type: "agent_stream" as const,
      agentId: "lead-1",
      event: {
        type: "timeline" as const,
        provider: "claude",
        item: {
          type: "compaction" as const,
          status: "completed" as const,
          trigger: "auto" as const,
        },
      },
    };
    harness.emit(compaction);
    harness.emit(compaction);
    await vi.waitFor(() =>
      expect(harness.records.get("lead-1")?.coordinationSignals).toHaveLength(1),
    );
    const first = harness.records.get("lead-1")?.coordinationSignals?.[0];
    if (!first) throw new Error("missing first signal");
    await resolveCoordinationSignal(harness.dependencies, {
      targetAgentId: "lead-1",
      signalId: first.id,
      resolution: "deferred",
    });
    harness.emit(compaction);
    await vi.waitFor(() =>
      expect(harness.records.get("lead-1")?.coordinationSignals).toHaveLength(2),
    );
    expect(
      harness.records.get("lead-1")?.eventPolicyStates?.[TEST_STATE_KEY]?.state
        .automaticCompactionCount,
    ).toBe(3);
    runtime.stop();
  });

  test("namespaces durable state by exact generation and policy", async () => {
    const harness = createHarness();
    harness.addAgent({ id: "lead-1", roleId: "lead" });
    const record = harness.records.get("lead-1");
    if (!record) throw new Error("missing Lead record");
    const runtime = harness.start();
    harness.emit({
      type: "agent_stream",
      agentId: "lead-1",
      event: {
        type: "timeline",
        provider: "claude",
        item: { type: "compaction", status: "completed", trigger: "auto" },
      },
    });
    await vi.waitFor(() =>
      expect(harness.records.get("lead-1")?.eventPolicyStates?.[TEST_STATE_KEY]).toMatchObject({
        version: 6,
        state: { automaticCompactionCount: 1, consecutiveTurnFailures: 0 },
      }),
    );
    expect(harness.records.get("lead-1")?.eventPolicyStates?.["slp.attention"]).toBeUndefined();
    runtime.stop();
  });

  test("routes semantic friction from visible Lead output to one unique Supervisor", async () => {
    const harness = createHarness();
    harness.addAgent({ id: "lead-1", roleId: "lead" });
    harness.addAgent({ id: "supervisor-1", roleId: "supervisor" });
    const runtime = harness.start();
    harness.emit({
      type: "agent_stream",
      agentId: "lead-1",
      event: {
        type: "timeline",
        provider: "codex",
        turnId: "turn-1",
        item: { type: "assistant_message", text: "Hold on, I overlooked the authority boundary." },
      },
    });
    await vi.waitFor(() =>
      expect(harness.records.get("supervisor-1")?.coordinationSignals).toHaveLength(1),
    );
    expect(harness.records.get("supervisor-1")?.coordinationSignals?.[0]).toMatchObject({
      recipientRole: "supervisor",
      relatedAgentId: "lead-1",
      customEvent: "slp.semantic_friction",
      source: { kind: "paseo", ruleId: "semantic_friction:admitted_mistake" },
      evidence: { classifierRule: "admitted_mistake" },
    });
    const first = harness.records.get("supervisor-1")?.coordinationSignals?.[0];
    if (!first) throw new Error("missing first semantic attention signal");
    await resolveCoordinationSignal(harness.dependencies, {
      targetAgentId: "supervisor-1",
      signalId: first.id,
      resolution: "completed",
    });
    harness.emit({
      type: "agent_stream",
      agentId: "lead-1",
      event: { type: "turn_completed", provider: "codex", turnId: "turn-1" },
    });
    harness.emit({
      type: "agent_stream",
      agentId: "lead-1",
      event: {
        type: "timeline",
        provider: "codex",
        turnId: "turn-2",
        item: { type: "assistant_message", text: "On second thought, I missed the scope." },
      },
    });
    await vi.waitFor(() =>
      expect(harness.records.get("supervisor-1")?.coordinationSignals).toHaveLength(2),
    );
    runtime.stop();
  });

  test("keeps deterministic routing and skips classification when semantic mode is off", async () => {
    const classifier = {
      mode: "off" as const,
      classify: vi.fn(),
    } satisfies EventPolicySemanticAttentionClassifier;
    const harness = createHarness({ classifier });
    harness.addAgent({ id: "lead-1", roleId: "lead" });
    harness.addAgent({ id: "supervisor-1", roleId: "supervisor" });
    const runtime = harness.start();

    harness.emit({
      type: "agent_stream",
      agentId: "lead-1",
      event: {
        type: "timeline",
        provider: "codex",
        turnId: "off-turn",
        item: { type: "assistant_message", text: "I made a mistake about the scope." },
      },
    });

    await vi.waitFor(() =>
      expect(harness.records.get("supervisor-1")?.coordinationSignals).toHaveLength(1),
    );
    expect(classifier.classify).not.toHaveBeenCalled();
    runtime.stop();
  });

  test("keeps shadow routing deterministic while recording one bounded classifier call", async () => {
    const classifier = {
      mode: "shadow" as const,
      classify: vi.fn(async () => ({
        status: "classified" as const,
        decision: {
          decision: "ignore" as const,
          risk: "low" as const,
          confidence: 0.94,
          reason: "The message self-corrects without changing scope.",
          evidenceRefs: [] as string[],
        },
      })),
    };
    const harness = createHarness({ classifier, projectId: "project-42" });
    harness.addAgent({ id: "lead-1", roleId: "lead" });
    harness.addAgent({ id: "supervisor-1", roleId: "supervisor" });
    const runtime = harness.start();

    harness.emit({
      type: "agent_stream",
      agentId: "lead-1",
      event: {
        type: "timeline",
        provider: "codex",
        turnId: "shadow-turn",
        item: { type: "assistant_message", text: "I made a mistake about the scope." },
      },
    });

    await vi.waitFor(() => expect(classifier.classify).toHaveBeenCalledTimes(1));
    await vi.waitFor(() =>
      expect(harness.records.get("supervisor-1")?.coordinationSignals).toHaveLength(1),
    );
    const packet = classifier.classify.mock.calls[0]?.[0];
    expect(packet).toMatchObject({ sourceRole: "lead", eventKind: "semantic_friction" });
    expect(packet?.projectRef).toHaveLength(24);
    expect(packet?.excerpt).not.toContain("project-42");
    runtime.stop();
  });

  test("active classifier wakes Supervisor only for a high-confidence high-risk candidate", async () => {
    const classifier = {
      mode: "active" as const,
      classify: vi.fn(async (packet: { evidenceRefs: string[] }) => ({
        status: "classified" as const,
        decision: {
          decision: "wake_candidate" as const,
          risk: "high" as const,
          confidence: 0.91,
          reason: "The admitted error can change the assignment boundary.",
          evidenceRefs: packet.evidenceRefs,
        },
      })),
    };
    const harness = createHarness({ classifier, projectId: "project-42" });
    harness.addAgent({ id: "lead-1", roleId: "lead" });
    harness.addAgent({ id: "supervisor-1", roleId: "supervisor" });
    const runtime = harness.start();

    harness.emit({
      type: "agent_stream",
      agentId: "lead-1",
      event: {
        type: "timeline",
        provider: "codex",
        turnId: "active-turn",
        item: { type: "assistant_message", text: "I overlooked the assignment authority." },
      },
    });

    await vi.waitFor(() =>
      expect(harness.records.get("supervisor-1")?.coordinationSignals).toHaveLength(1),
    );
    expect(harness.records.get("supervisor-1")?.coordinationSignals?.[0]).toMatchObject({
      severity: "critical",
      evidence: {
        semanticDecision: "wake_candidate",
        semanticRisk: "high",
        semanticConfidence: 0.91,
      },
    });
    runtime.stop();
  });

  test("active classifier suppresses low-risk semantic noise and falls back on unavailability", async () => {
    const ignoreClassifier = {
      mode: "active" as const,
      classify: vi.fn(async (packet: { evidenceRefs: string[] }) => ({
        status: "classified" as const,
        decision: {
          decision: "ignore" as const,
          risk: "low" as const,
          confidence: 0.95,
          reason: "The correction is local and already resolved.",
          evidenceRefs: packet.evidenceRefs,
        },
      })),
    };
    const ignored = createHarness({ classifier: ignoreClassifier });
    ignored.addAgent({ id: "lead-ignore", roleId: "lead" });
    ignored.addAgent({ id: "supervisor-ignore", roleId: "supervisor" });
    const ignoredRuntime = ignored.start();
    ignored.emit({
      type: "agent_stream",
      agentId: "lead-ignore",
      event: {
        type: "timeline",
        provider: "codex",
        turnId: "ignore-turn",
        item: { type: "assistant_message", text: "I made a mistake, then fixed it locally." },
      },
    });
    await vi.waitFor(() => expect(ignoreClassifier.classify).toHaveBeenCalledTimes(1));
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(ignored.records.get("supervisor-ignore")?.coordinationSignals).toBeUndefined();
    ignoredRuntime.stop();

    const unavailableClassifier = {
      mode: "active" as const,
      classify: vi.fn(async () => ({ status: "unavailable" as const, reason: "runner_busy" })),
    };
    const fallback = createHarness({ classifier: unavailableClassifier });
    fallback.addAgent({ id: "lead-fallback", roleId: "lead" });
    fallback.addAgent({ id: "supervisor-fallback", roleId: "supervisor" });
    const fallbackRuntime = fallback.start();
    fallback.emit({
      type: "agent_stream",
      agentId: "lead-fallback",
      event: {
        type: "timeline",
        provider: "codex",
        turnId: "fallback-turn",
        item: { type: "assistant_message", text: "I overlooked the ownership scope." },
      },
    });
    await vi.waitFor(() =>
      expect(fallback.records.get("supervisor-fallback")?.coordinationSignals).toHaveLength(1),
    );
    expect(fallback.records.get("supervisor-fallback")?.coordinationSignals?.[0]).toMatchObject({
      severity: "warning",
      evidence: { classifierFallback: "runner_busy" },
    });
    fallbackRuntime.stop();
  });

  test("persists medium-risk aggregation per project and supplies its count to the next call", async () => {
    const classifier = {
      mode: "active" as const,
      classify: vi.fn(async (packet: { evidenceRefs: string[]; priorAggregateCount: number }) => ({
        status: "classified" as const,
        decision:
          packet.priorAggregateCount === 0
            ? {
                decision: "aggregate" as const,
                risk: "medium" as const,
                confidence: 0.78,
                reason: "One ambiguous correction should be accumulated.",
                evidenceRefs: packet.evidenceRefs,
              }
            : {
                decision: "wake_candidate" as const,
                risk: "high" as const,
                confidence: 0.9,
                reason: "Repeated ambiguity now warrants Supervisor review.",
                evidenceRefs: packet.evidenceRefs,
              },
      })),
    };
    const harness = createHarness({ classifier, projectId: "project-aggregate" });
    harness.addAgent({ id: "lead-1", roleId: "lead" });
    harness.addAgent({ id: "supervisor-1", roleId: "supervisor" });
    const runtime = harness.start();
    const emit = (turnId: string, text: string) =>
      harness.emit({
        type: "agent_stream",
        agentId: "lead-1",
        event: {
          type: "timeline",
          provider: "codex",
          turnId,
          item: { type: "assistant_message", text },
        },
      });

    emit("aggregate-1", "I made a mistake about the scope.");
    await vi.waitFor(() => expect(classifier.classify).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => {
      const call = classifier.classify.mock.calls[0]?.[0] as unknown as {
        deterministicRule: string;
      };
      expect(
        harness.dependencies.semanticAttentionProjectStore.getCount(
          TEST_STATE_NAMESPACE,
          opaqueAttentionRef("project-aggregate"),
          call.deterministicRule,
        ),
      ).toBe(1);
    });
    expect(harness.records.get("supervisor-1")?.coordinationSignals).toBeUndefined();

    harness.addAgent({ id: "supervisor-2", roleId: "supervisor", workspaceId: "control-2" });
    harness.dependencies.agentManager.getAgent("lead-1")!.labels = {
      "paseo.parent-agent-id": "supervisor-2",
    };
    emit("aggregate-2", "I overlooked the assignment scope.");
    await vi.waitFor(() => expect(classifier.classify).toHaveBeenCalledTimes(2));
    expect(classifier.classify.mock.calls[1]?.[0].priorAggregateCount).toBe(1);
    await vi.waitFor(() =>
      expect(harness.records.get("supervisor-2")?.coordinationSignals).toHaveLength(1),
    );
    expect(harness.records.get("supervisor-2")?.coordinationSignals?.[0]).toMatchObject({
      severity: "critical",
    });
    runtime.stop();
  });

  test("does not call the semantic model for deterministic hard triggers", async () => {
    const classifier = {
      mode: "active" as const,
      classify: vi.fn(),
    } satisfies EventPolicySemanticAttentionClassifier;
    const harness = createHarness({ classifier });
    harness.addAgent({ id: "lead-1", roleId: "lead" });
    harness.addAgent({ id: "supervisor-1", roleId: "supervisor" });
    const runtime = harness.start();
    harness.emit({
      type: "agent_stream",
      agentId: "lead-1",
      event: {
        type: "usage_updated",
        provider: "codex",
        usage: { contextWindowUsedTokens: 60, contextWindowMaxTokens: 100 },
      },
    });

    await vi.waitFor(() =>
      expect(harness.records.get("lead-1")?.coordinationSignals).toHaveLength(1),
    );

    harness.emit({
      type: "agent_stream",
      agentId: "lead-1",
      event: {
        type: "timeline",
        provider: "codex",
        item: { type: "compaction", status: "completed", trigger: "auto" },
      },
    });
    for (let attempt = 0; attempt < 3; attempt += 1) {
      harness.emit({
        type: "agent_stream",
        agentId: "lead-1",
        event: { type: "turn_failed", provider: "codex", error: "provider failed" },
      });
    }

    await vi.waitFor(() =>
      expect(harness.records.get("lead-1")?.coordinationSignals).toHaveLength(2),
    );
    await vi.waitFor(() =>
      expect(harness.records.get("supervisor-1")?.coordinationSignals).toHaveLength(1),
    );
    expect(classifier.classify).not.toHaveBeenCalled();
    runtime.stop();
  });

  test("routes Lead attention to its delegated Supervisor in a separate Control Workspace", async () => {
    const harness = createHarness();
    harness.addAgent({
      id: "supervisor-control",
      roleId: "supervisor",
      workspaceId: "control-workspace",
    });
    harness.addAgent({
      id: "lead-project",
      roleId: "lead",
      parentAgentId: "supervisor-control",
      workspaceId: "project-workspace",
    });
    const runtime = harness.start();
    harness.emit({
      type: "agent_stream",
      agentId: "lead-project",
      event: {
        type: "timeline",
        provider: "codex",
        turnId: "turn-cross-workspace",
        item: { type: "assistant_message", text: "I made a mistake in the authority scope." },
      },
    });

    await vi.waitFor(() =>
      expect(harness.records.get("supervisor-control")?.coordinationSignals).toHaveLength(1),
    );
    expect(harness.records.get("supervisor-control")?.coordinationSignals?.[0]).toMatchObject({
      relatedAgentId: "lead-project",
      recipientRole: "supervisor",
    });
    runtime.stop();
  });

  test("routes Peer attention through its Lead to the delegated Control Workspace Supervisor", async () => {
    const harness = createHarness();
    harness.addAgent({
      id: "supervisor-control",
      roleId: "supervisor",
      workspaceId: "control-workspace",
    });
    harness.addAgent({
      id: "lead-project",
      roleId: "lead",
      parentAgentId: "supervisor-control",
      workspaceId: "project-workspace",
    });
    harness.addAgent({
      id: "peer-project",
      roleId: "peer",
      parentAgentId: "lead-project",
      workspaceId: "project-workspace",
    });
    const runtime = harness.start();
    harness.emit({
      type: "agent_stream",
      agentId: "peer-project",
      event: {
        type: "timeline",
        provider: "codex",
        turnId: "turn-peer-cross-workspace",
        item: { type: "assistant_message", text: "I overlooked the assignment requirement." },
      },
    });

    await vi.waitFor(() =>
      expect(harness.records.get("supervisor-control")?.coordinationSignals).toHaveLength(1),
    );
    expect(harness.records.get("supervisor-control")?.coordinationSignals?.[0]).toMatchObject({
      relatedAgentId: "peer-project",
      recipientRole: "supervisor",
    });
    runtime.stop();
  });

  test("does not buffer semantic fragments before a unique Supervisor exists", async () => {
    const harness = createHarness();
    harness.addAgent({ id: "lead-1", roleId: "lead" });
    const runtime = harness.start();
    const emitVisible = (text: string) =>
      harness.emit({
        type: "agent_stream",
        agentId: "lead-1",
        event: {
          type: "timeline",
          provider: "codex",
          turnId: "turn-1",
          item: { type: "assistant_message", text },
        },
      });

    emitVisible("I made a ");
    await new Promise((resolve) => setTimeout(resolve, 10));
    harness.addAgent({ id: "supervisor-1", roleId: "supervisor" });
    emitVisible("mistake about the authority boundary.");

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(harness.records.get("supervisor-1")?.coordinationSignals).toBeUndefined();
    runtime.stop();
  });

  test("clears semantic fragments while the Supervisor target is ambiguous", async () => {
    const harness = createHarness();
    harness.addAgent({ id: "lead-1", roleId: "lead" });
    harness.addAgent({ id: "supervisor-1", roleId: "supervisor" });
    harness.addAgent({ id: "supervisor-2", roleId: "supervisor" });
    const runtime = harness.start();
    harness.emit({
      type: "agent_stream",
      agentId: "lead-1",
      event: {
        type: "timeline",
        provider: "codex",
        turnId: "turn-1",
        item: { type: "assistant_message", text: "I made a " },
      },
    });
    await new Promise((resolve) => setTimeout(resolve, 10));
    harness.removeAgent("supervisor-2");
    harness.emit({
      type: "agent_stream",
      agentId: "lead-1",
      event: {
        type: "timeline",
        provider: "codex",
        turnId: "turn-1",
        item: {
          type: "assistant_message",
          text: "mistake about the authority boundary.",
        },
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(harness.records.get("supervisor-1")?.coordinationSignals).toBeUndefined();
    runtime.stop();
  });

  test("fails closed for ambiguous Supervisor targets and never classifies reasoning", async () => {
    const harness = createHarness();
    harness.addAgent({ id: "peer-1", roleId: "peer" });
    harness.addAgent({ id: "supervisor-1", roleId: "supervisor" });
    harness.addAgent({ id: "supervisor-2", roleId: "supervisor" });
    const runtime = harness.start();
    harness.emit({
      type: "agent_stream",
      agentId: "peer-1",
      event: {
        type: "timeline",
        provider: "codex",
        turnId: "turn-1",
        item: { type: "reasoning", text: "Hold on, I made a mistake." },
      },
    });
    harness.emit({
      type: "agent_stream",
      agentId: "peer-1",
      event: {
        type: "timeline",
        provider: "codex",
        turnId: "turn-1",
        item: { type: "assistant_message", text: "Hold on, I made a mistake." },
      },
    });
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(harness.records.get("supervisor-1")?.coordinationSignals).toBeUndefined();
    expect(harness.records.get("supervisor-2")?.coordinationSignals).toBeUndefined();
    runtime.stop();
  });

  test.each(["acknowledged", "deferred", "declined", "completed"] as const)(
    "re-arms a semantic fingerprint after %s while coalescing only the pending episode",
    async (resolution) => {
      const harness = createHarness();
      harness.addAgent({ id: "lead-1", roleId: "lead" });
      harness.addAgent({ id: "supervisor-1", roleId: "supervisor", lifecycle: "running" });
      const runtime = harness.start();
      const emitVisible = (text: string) =>
        harness.emit({
          type: "agent_stream",
          agentId: "lead-1",
          event: {
            type: "timeline",
            provider: "codex",
            turnId: "turn-1",
            item: { type: "assistant_message", text },
          },
        });

      emitVisible("I made a mistake about the scope.");
      await vi.waitFor(() =>
        expect(harness.records.get("supervisor-1")?.coordinationSignals).toHaveLength(1),
      );
      emitVisible("I made a mistake about the scope.");
      await vi.waitFor(() =>
        expect(harness.records.get("supervisor-1")?.coordinationSignals?.[0]?.occurrenceCount).toBe(
          2,
        ),
      );
      const first = harness.records.get("supervisor-1")?.coordinationSignals?.[0];
      if (!first) throw new Error("missing semantic signal");
      await resolveCoordinationSignal(harness.dependencies, {
        targetAgentId: "supervisor-1",
        signalId: first.id,
        resolution,
      });
      emitVisible("I made a mistake about the scope.");
      await vi.waitFor(() =>
        expect(harness.records.get("supervisor-1")?.coordinationSignals).toHaveLength(2),
      );
      const rearmed = harness.records.get("supervisor-1")?.coordinationSignals?.[1];
      expect(rearmed).toMatchObject({ status: "pending", occurrenceCount: 1 });
      expect(rearmed?.id).not.toBe(first.id);
      emitVisible("I made a mistake about the scope.");
      await vi.waitFor(() =>
        expect(harness.records.get("supervisor-1")?.coordinationSignals?.[1]?.occurrenceCount).toBe(
          2,
        ),
      );
      expect(harness.records.get("supervisor-1")?.coordinationSignals).toHaveLength(2);

      emitVisible("This conflicts with the ownership contract.");
      await vi.waitFor(() =>
        expect(harness.records.get("supervisor-1")?.coordinationSignals).toHaveLength(3),
      );
      expect(harness.records.get("supervisor-1")?.coordinationSignals?.[2]).toMatchObject({
        status: "pending",
        source: { kind: "paseo", ruleId: "semantic_friction:contract_conflict" },
      });
      runtime.stop();
    },
  );

  test("routes a fresh repeated-failure episode after a completed turn", async () => {
    const harness = createHarness();
    harness.addAgent({ id: "lead-1", roleId: "lead" });
    harness.addAgent({ id: "peer-1", roleId: "peer", parentAgentId: "lead-1" });
    const runtime = harness.start();
    const failure = {
      type: "agent_stream" as const,
      agentId: "peer-1",
      event: { type: "turn_failed" as const, provider: "codex", error: "provider failed" },
    };
    harness.emit(failure);
    harness.emit(failure);
    harness.emit(failure);
    await vi.waitFor(() =>
      expect(harness.records.get("lead-1")?.coordinationSignals).toHaveLength(1),
    );
    harness.emit({
      type: "agent_stream",
      agentId: "peer-1",
      event: { type: "turn_completed", provider: "codex" },
    });
    const first = harness.records.get("lead-1")?.coordinationSignals?.[0];
    if (!first) throw new Error("missing first signal");
    await resolveCoordinationSignal(harness.dependencies, {
      targetAgentId: "lead-1",
      signalId: first.id,
      resolution: "declined",
    });
    harness.emit(failure);
    harness.emit(failure);
    harness.emit(failure);
    await vi.waitFor(() =>
      expect(harness.records.get("lead-1")?.coordinationSignals).toHaveLength(2),
    );
    runtime.stop();
  });

  test("notifies Human once for a Lead failure episode without a unique Supervisor", async () => {
    const harness = createHarness();
    harness.addAgent({ id: "lead-1", roleId: "lead" });
    const runtime = harness.start();
    const failure = {
      type: "agent_stream" as const,
      agentId: "lead-1",
      event: { type: "turn_failed" as const, provider: "codex", error: "provider failed" },
    };

    harness.emit(failure);
    harness.emit(failure);
    harness.emit(failure);
    await vi.waitFor(() =>
      expect(harness.dependencies.agentManager.notifyAgentAttention).toHaveBeenCalledTimes(1),
    );
    expect(harness.dependencies.agentManager.notifyAgentAttention).toHaveBeenCalledWith(
      "lead-1",
      "error",
      "coordination",
    );

    harness.emit(failure);
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(harness.dependencies.agentManager.notifyAgentAttention).toHaveBeenCalledTimes(1);

    harness.emit({
      type: "agent_stream",
      agentId: "lead-1",
      event: { type: "turn_completed", provider: "codex" },
    });
    harness.emit(failure);
    harness.emit(failure);
    harness.emit(failure);
    await vi.waitFor(() =>
      expect(harness.dependencies.agentManager.notifyAgentAttention).toHaveBeenCalledTimes(2),
    );

    harness.emit({
      type: "agent_stream",
      agentId: "lead-1",
      event: { type: "turn_canceled", provider: "codex" },
    });
    harness.emit(failure);
    harness.emit(failure);
    harness.emit(failure);
    await vi.waitFor(() =>
      expect(harness.dependencies.agentManager.notifyAgentAttention).toHaveBeenCalledTimes(3),
    );
    runtime.stop();
  });

  test("keeps the Lead coordination signal and skips Human notification with one Supervisor", async () => {
    const harness = createHarness();
    harness.addAgent({ id: "lead-1", roleId: "lead" });
    harness.addAgent({ id: "supervisor-1", roleId: "supervisor" });
    const runtime = harness.start();
    const failure = {
      type: "agent_stream" as const,
      agentId: "lead-1",
      event: { type: "turn_failed" as const, provider: "codex", error: "provider failed" },
    };

    harness.emit(failure);
    harness.emit(failure);
    harness.emit(failure);
    await vi.waitFor(() =>
      expect(harness.records.get("supervisor-1")?.coordinationSignals).toHaveLength(1),
    );
    expect(harness.dependencies.agentManager.notifyAgentAttention).not.toHaveBeenCalled();

    harness.emit(failure);
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(harness.records.get("supervisor-1")?.coordinationSignals).toHaveLength(1);
    expect(harness.dependencies.agentManager.notifyAgentAttention).not.toHaveBeenCalled();
    runtime.stop();
  });

  test("routes repeated Lead failure to its delegated cross-workspace Supervisor", async () => {
    const harness = createHarness();
    harness.addAgent({
      id: "supervisor-control",
      roleId: "supervisor",
      workspaceId: "control-workspace",
    });
    harness.addAgent({
      id: "lead-project",
      roleId: "lead",
      parentAgentId: "supervisor-control",
      workspaceId: "project-workspace",
    });
    const runtime = harness.start();
    const failure = {
      type: "agent_stream" as const,
      agentId: "lead-project",
      event: { type: "turn_failed" as const, provider: "codex", error: "provider failed" },
    };

    harness.emit(failure);
    harness.emit(failure);
    harness.emit(failure);
    await vi.waitFor(() =>
      expect(harness.records.get("supervisor-control")?.coordinationSignals).toHaveLength(1),
    );
    expect(harness.dependencies.agentManager.notifyAgentAttention).not.toHaveBeenCalled();
    runtime.stop();
  });

  test("counts realistic interleaved turn starts and failures", async () => {
    const harness = createHarness();
    harness.addAgent({ id: "lead-1", roleId: "lead" });
    harness.addAgent({ id: "peer-1", roleId: "peer", parentAgentId: "lead-1" });
    const runtime = harness.start();
    for (let index = 1; index <= 3; index += 1) {
      harness.emit({
        type: "agent_stream",
        agentId: "peer-1",
        event: { type: "turn_started", provider: "codex", turnId: `turn-${index}` },
      });
      harness.emit({
        type: "agent_stream",
        agentId: "peer-1",
        event: {
          type: "turn_failed",
          provider: "codex",
          turnId: `turn-${index}`,
          error: "provider failed",
        },
      });
    }
    await vi.waitFor(() =>
      expect(harness.records.get("lead-1")?.coordinationSignals).toHaveLength(1),
    );
    expect(
      harness.records.get("peer-1")?.eventPolicyStates?.[TEST_STATE_KEY]?.state
        .consecutiveTurnFailures,
    ).toBe(3);
    runtime.stop();
  });
});
