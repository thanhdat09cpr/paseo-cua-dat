import pino from "pino";
import { describe, expect, test, vi } from "vitest";

import type { AgentManagerEvent } from "./agent-manager.js";
import type { StoredAgentRecord } from "./agent-storage.js";
import {
  requestCoordinationSignal,
  resumePendingCoordinationSignalDeliveries,
  resolveCoordinationSignal,
  type CoordinationSignalDependencies,
} from "./coordination-signals.js";
import { attentionQuestionCoalescingKey } from "../policy/bundled/slp/coordination-policy.js";

function createScenario(
  options: {
    running?: boolean;
    agentId?: string;
    coordinationSignals?: StoredAgentRecord["coordinationSignals"];
  } = {},
) {
  const agentId = options.agentId ?? `lead-${crypto.randomUUID()}`;
  let running = options.running ?? false;
  let record = {
    id: agentId,
    provider: "codex",
    cwd: "/repo",
    workspaceId: "workspace-1",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    labels: {},
    lastStatus: running ? "running" : "idle",
    config: null,
    persistence: null,
    roleBinding: {
      roleId: "lead",
      definitionVersion: "test",
      definitionDigest: "definition",
      bindingDigest: "binding",
      provider: "codex",
      injectionMethod: "codex-config",
      qualification: "implementation-supported",
      workspaceProtocol: { status: "missing", path: "/repo/WORKSPACE_PROTOCOL.md" },
      createdAt: new Date().toISOString(),
      instructions: "test",
    },
    coordinationSignals: options.coordinationSignals,
  } as StoredAgentRecord;
  const subscribers = new Set<(event: AgentManagerEvent) => void>();
  const sent: Array<{ agentId: string; message: string }> = [];
  const dependencies: CoordinationSignalDependencies = {
    agentStorage: {
      get: vi.fn(async (id: string) => (id === agentId ? record : null)),
      list: vi.fn(async () => [record]),
      upsert: vi.fn(async (next: StoredAgentRecord) => {
        record = next;
      }),
    },
    agentManager: {
      getAgent: vi.fn(() => null),
      hasInFlightRun: vi.fn(() => running),
      notifyAgentState: vi.fn(),
      subscribe: vi.fn((callback: (event: AgentManagerEvent) => void) => {
        subscribers.add(callback);
        return () => subscribers.delete(callback);
      }),
    },
    sendAtSafeBoundary: vi.fn(async (targetAgentId: string, message: string) => {
      if (running) {
        throw new Error("delivery attempted during active run");
      }
      sent.push({ agentId: targetAgentId, message });
    }),
    logger: pino({ level: "silent" }),
  };

  return {
    agentId,
    dependencies,
    getRecord: () => record,
    sent,
    reachIdleBoundary() {
      running = false;
      for (const subscriber of subscribers) {
        subscriber({
          type: "agent_state",
          agent: { id: agentId, lifecycle: "idle" },
        });
      }
    },
  };
}

describe("coordination signals", () => {
  test("continues a queued record update after the preceding update fails", async () => {
    const scenario = createScenario({ running: true });
    vi.mocked(scenario.dependencies.agentStorage.upsert).mockRejectedValueOnce(
      new Error("first write failed"),
    );

    const first = requestCoordinationSignal(scenario.dependencies, {
      targetAgentId: scenario.agentId,
      requestedByAgentId: null,
      kind: "handoff_recommended",
      reason: "first",
    });
    const second = requestCoordinationSignal(scenario.dependencies, {
      targetAgentId: scenario.agentId,
      requestedByAgentId: null,
      kind: "handoff_recommended",
      reason: "second",
    });

    await expect(first).rejects.toThrow("first write failed");
    await expect(second).resolves.toMatchObject({ reason: "second" });
    expect(scenario.getRecord().coordinationSignals).toHaveLength(1);
    expect(scenario.dependencies.agentStorage.upsert).toHaveBeenCalledTimes(2);
    expect(scenario.dependencies.agentManager.notifyAgentState).toHaveBeenCalledTimes(1);
  });

  test("restores delivery for an undelivered persisted signal after daemon startup", async () => {
    const agentId = `lead-${crypto.randomUUID()}`;
    const scenario = createScenario({
      agentId,
      coordinationSignals: [
        {
          id: crypto.randomUUID(),
          targetAgentId: agentId,
          requestedByAgentId: null,
          kind: "continuity_attention",
          trigger: "context_pressure",
          severity: "warning",
          recipientRole: "lead",
          source: { kind: "paseo", ruleId: "lead_context_pressure", version: 1 },
          reason: "Review continuity",
          evidenceRefs: [],
          status: "pending",
          createdAt: new Date().toISOString(),
          deliveredAt: null,
          resolvedAt: null,
        },
      ],
    });

    const stop = await resumePendingCoordinationSignalDeliveries({
      ...scenario.dependencies,
    });

    await vi.waitFor(() => {
      expect(scenario.sent).toHaveLength(1);
      expect(scenario.getRecord().coordinationSignals?.[0]?.deliveredAt).not.toBeNull();
    });
    stop();
  });

  test("persists immediately but waits for an idle boundary without replacing active work", async () => {
    const scenario = createScenario({ running: true });
    const signal = await requestCoordinationSignal(scenario.dependencies, {
      targetAgentId: scenario.agentId,
      requestedByAgentId: "supervisor-1",
      kind: "handoff_recommended",
      reason: "Repeated context dilution",
      evidenceRefs: ["room-message-1"],
    });

    expect(scenario.sent).toEqual([]);
    expect(scenario.getRecord().coordinationSignals).toEqual([
      expect.objectContaining({ id: signal.id, status: "pending", deliveredAt: null }),
    ]);

    scenario.reachIdleBoundary();
    await vi.waitFor(() => expect(scenario.sent).toHaveLength(1));
    expect(scenario.sent[0]?.message).toContain("does not transfer authority");
    expect(scenario.sent[0]?.message).toContain(signal.id);
    expect(scenario.getRecord().coordinationSignals?.[0]?.deliveredAt).not.toBeNull();
  });

  test("deduplicates an unresolved recommendation from the same sender", async () => {
    const scenario = createScenario();
    const input = {
      targetAgentId: scenario.agentId,
      requestedByAgentId: "supervisor-1",
      kind: "detach_recommended" as const,
      reason: "Promote successor candidate",
      relatedAgentId: "candidate-1",
    };

    const first = await requestCoordinationSignal(scenario.dependencies, input);
    const second = await requestCoordinationSignal(scenario.dependencies, input);

    expect(second.id).toBe(first.id);
    expect(scenario.getRecord().coordinationSignals).toHaveLength(1);
    expect(second.occurrenceCount).toBe(2);
    expect(second.occurrences).toHaveLength(2);
  });

  test("preserves pending occurrence evidence without swallowing different SLP rules", async () => {
    const scenario = createScenario({ running: true });
    const first = await requestCoordinationSignal(scenario.dependencies, {
      targetAgentId: scenario.agentId,
      requestedByAgentId: null,
      kind: "continuity_attention",
      trigger: "context_pressure",
      recipientRole: "lead",
      source: { kind: "paseo", ruleId: "lead_context_pressure", version: 3 },
      coalescingKey: "lead_context_pressure",
      reason: "Context pressure",
      evidenceRefs: ["usage:1"],
      evidence: { contextRatio: 0.86 },
    });
    const repeated = await requestCoordinationSignal(scenario.dependencies, {
      targetAgentId: scenario.agentId,
      requestedByAgentId: null,
      kind: "continuity_attention",
      trigger: "context_pressure",
      recipientRole: "lead",
      source: { kind: "paseo", ruleId: "lead_context_pressure", version: 3 },
      coalescingKey: "lead_context_pressure",
      reason: "Context pressure again",
      evidenceRefs: ["usage:2"],
      evidence: { contextRatio: 0.91 },
    });
    const compaction = await requestCoordinationSignal(scenario.dependencies, {
      targetAgentId: scenario.agentId,
      requestedByAgentId: null,
      kind: "continuity_attention",
      trigger: "automatic_compaction",
      recipientRole: "lead",
      source: { kind: "paseo", ruleId: "lead_automatic_compaction", version: 3 },
      coalescingKey: "lead_automatic_compaction",
      reason: "Automatic compaction",
      evidenceRefs: ["timeline:compaction:1"],
    });

    expect(repeated.id).toBe(first.id);
    expect(repeated.occurrenceCount).toBe(2);
    expect(repeated.evidenceRefs).toEqual(["usage:1", "usage:2"]);
    expect(repeated.occurrences).toEqual([
      expect.objectContaining({ evidenceRefs: ["usage:1"], evidence: { contextRatio: 0.86 } }),
      expect.objectContaining({ evidenceRefs: ["usage:2"], evidence: { contextRatio: 0.91 } }),
    ]);
    expect(compaction.id).not.toBe(first.id);
    expect(scenario.getRecord().coordinationSignals).toHaveLength(2);
  });

  test("treats explicit coalescing keys as exclusive episode identity", async () => {
    const scenario = createScenario({ running: true });
    const semanticInput = {
      targetAgentId: scenario.agentId,
      requestedByAgentId: null,
      kind: "continuity_attention" as const,
      trigger: "custom" as const,
      customEvent: "slp.semantic_friction",
      recipientRole: "supervisor" as const,
      source: {
        kind: "paseo" as const,
        ruleId: "semantic_friction:contract_conflict",
        version: 4,
      },
      reason: "Semantic friction",
    };
    const first = await requestCoordinationSignal(scenario.dependencies, {
      ...semanticInput,
      coalescingKey: "semantic:turn-1:fingerprint-a",
      evidenceRefs: ["timeline:1"],
    });
    const distinct = await requestCoordinationSignal(scenario.dependencies, {
      ...semanticInput,
      coalescingKey: "semantic:turn-1:fingerprint-b",
      evidenceRefs: ["timeline:2"],
    });
    const repeated = await requestCoordinationSignal(scenario.dependencies, {
      ...semanticInput,
      coalescingKey: "semantic:turn-1:fingerprint-a",
      evidenceRefs: ["timeline:3"],
    });

    expect(distinct.id).not.toBe(first.id);
    expect(repeated.id).toBe(first.id);
    expect(repeated.occurrenceCount).toBe(2);
    expect(repeated.evidenceRefs).toEqual(["timeline:1", "timeline:3"]);
    expect(scenario.getRecord().coordinationSignals).toHaveLength(2);
  });

  test.each([null, "supervisor-1"])(
    "keeps distinct manual questions separate and merges only normalized recurrence for %s",
    async (requestedByAgentId) => {
      const scenario = createScenario({ running: true });
      const q1 = {
        observation: "The evidence conflicts with the current conclusion.",
        question: "What evidence supports the current conclusion?",
      };
      const q2 = {
        observation: "The current status omits the reviewed constraint.",
        question: "Which constraint explains the observed delay?",
      };
      const base = {
        targetAgentId: scenario.agentId,
        requestedByAgentId,
        kind: "continuity_attention" as const,
        reason: "Bounded attention question",
      };
      const first = await requestCoordinationSignal(scenario.dependencies, {
        ...base,
        ...q1,
        coalescingKey: attentionQuestionCoalescingKey({
          ...q1,
          requester: requestedByAgentId
            ? { kind: "agent", agentId: requestedByAgentId }
            : { kind: "human" },
          targetAgentId: scenario.agentId,
        }),
        evidenceRefs: ["timeline:q1:first"],
      });
      const distinct = await requestCoordinationSignal(scenario.dependencies, {
        ...base,
        ...q2,
        coalescingKey: attentionQuestionCoalescingKey({
          ...q2,
          requester: requestedByAgentId
            ? { kind: "agent", agentId: requestedByAgentId }
            : { kind: "human" },
          targetAgentId: scenario.agentId,
        }),
        evidenceRefs: ["timeline:q2"],
      });
      const recurrence = await requestCoordinationSignal(scenario.dependencies, {
        ...base,
        observation: "  the EVIDENCE conflicts with the current conclusion. ",
        question: " WHAT evidence supports the current conclusion? ",
        coalescingKey: attentionQuestionCoalescingKey({
          requester: requestedByAgentId
            ? { kind: "agent", agentId: requestedByAgentId }
            : { kind: "human" },
          targetAgentId: scenario.agentId,
          observation: "  the EVIDENCE conflicts with the current conclusion. ",
          question: " WHAT evidence supports the current conclusion? ",
        }),
        evidenceRefs: ["timeline:q1:repeat"],
      });

      expect(distinct.id).not.toBe(first.id);
      expect(recurrence.id).toBe(first.id);
      expect(recurrence.occurrenceCount).toBe(2);
      expect(recurrence.evidenceRefs).toEqual(["timeline:q1:first", "timeline:q1:repeat"]);
      expect(scenario.getRecord().coordinationSignals).toHaveLength(2);
    },
  );

  test("delivers a distinct Q2 after Q1 was already delivered", async () => {
    const scenario = createScenario();
    const q1 = {
      observation: "The evidence conflicts with the current conclusion.",
      question: "What evidence supports the current conclusion?",
    };
    const q2 = {
      observation: "The status omits the reviewed constraint.",
      question: "Which constraint explains the observed delay?",
    };
    const base = {
      targetAgentId: scenario.agentId,
      requestedByAgentId: null,
      kind: "continuity_attention" as const,
      reason: "Bounded attention question",
      evidenceRefs: ["timeline:manual"],
    };

    await requestCoordinationSignal(scenario.dependencies, {
      ...base,
      ...q1,
      coalescingKey: attentionQuestionCoalescingKey({
        ...q1,
        requester: { kind: "human" },
        targetAgentId: scenario.agentId,
      }),
    });
    await vi.waitFor(() => expect(scenario.sent).toHaveLength(1));
    await requestCoordinationSignal(scenario.dependencies, {
      ...base,
      ...q2,
      coalescingKey: attentionQuestionCoalescingKey({
        ...q2,
        requester: { kind: "human" },
        targetAgentId: scenario.agentId,
      }),
    });
    await vi.waitFor(() => expect(scenario.sent).toHaveLength(2));

    expect(scenario.sent[0]?.message).toContain(q1.question);
    expect(scenario.sent[1]?.message).toContain(q2.question);
    expect(scenario.getRecord().coordinationSignals).toHaveLength(2);
  });

  test("keeps Human and distinct Supervisor requester lanes separate while pending", async () => {
    const scenario = createScenario({ running: true });
    const content = {
      observation: "The evidence conflicts with the current conclusion.",
      question: "What evidence supports the current conclusion?",
    };
    const request = async (requestedByAgentId: string | null) =>
      requestCoordinationSignal(scenario.dependencies, {
        targetAgentId: scenario.agentId,
        requestedByAgentId,
        kind: "continuity_attention",
        reason: "Bounded attention question",
        ...content,
        coalescingKey: attentionQuestionCoalescingKey({
          ...content,
          requester: requestedByAgentId
            ? { kind: "agent", agentId: requestedByAgentId }
            : { kind: "human" },
          targetAgentId: scenario.agentId,
        }),
        evidenceRefs: [`timeline:${requestedByAgentId ?? "human"}`],
      });

    const supervisorOne = await request("supervisor-1");
    const human = await request(null);
    const supervisorTwo = await request("supervisor-2");
    const recurrence = await request("supervisor-1");

    expect(new Set([supervisorOne.id, human.id, supervisorTwo.id]).size).toBe(3);
    expect(recurrence.id).toBe(supervisorOne.id);
    expect(recurrence.occurrenceCount).toBe(2);
    expect(scenario.getRecord().coordinationSignals).toEqual([
      expect.objectContaining({
        id: supervisorOne.id,
        requestedByAgentId: "supervisor-1",
        source: { kind: "agent", agentId: "supervisor-1" },
      }),
      expect.objectContaining({
        id: human.id,
        requestedByAgentId: null,
        source: { kind: "human" },
      }),
      expect.objectContaining({
        id: supervisorTwo.id,
        requestedByAgentId: "supervisor-2",
        source: { kind: "agent", agentId: "supervisor-2" },
      }),
    ]);
  });

  test("delivers identical content again when the requester lane changes", async () => {
    const scenario = createScenario();
    const content = {
      observation: "The evidence conflicts with the current conclusion.",
      question: "What evidence supports the current conclusion?",
    };
    const request = async (
      requestedByAgentId: string | null,
      requester: { kind: "human" } | { kind: "agent"; agentId: string },
    ) =>
      requestCoordinationSignal(scenario.dependencies, {
        targetAgentId: scenario.agentId,
        requestedByAgentId,
        kind: "continuity_attention",
        reason: "Bounded attention question",
        ...content,
        coalescingKey: attentionQuestionCoalescingKey({
          ...content,
          requester,
          targetAgentId: scenario.agentId,
        }),
        evidenceRefs: [`timeline:${requestedByAgentId ?? "human"}`],
      });

    const supervisor = await request("supervisor-1", {
      kind: "agent",
      agentId: "supervisor-1",
    });
    await vi.waitFor(() => expect(scenario.sent).toHaveLength(1));
    const human = await request(null, { kind: "human" });
    await vi.waitFor(() => expect(scenario.sent).toHaveLength(2));

    expect(human.id).not.toBe(supervisor.id);
    expect(scenario.getRecord().coordinationSignals).toEqual([
      expect.objectContaining({ source: { kind: "agent", agentId: "supervisor-1" } }),
      expect.objectContaining({ source: { kind: "human" } }),
    ]);
  });

  test("persists the bounded observation, question, and evidence shape", async () => {
    const scenario = createScenario();
    const signal = await requestCoordinationSignal(scenario.dependencies, {
      targetAgentId: scenario.agentId,
      requestedByAgentId: "supervisor-1",
      kind: "continuity_attention",
      severity: "info",
      reason: "Attention question at a safe boundary",
      observation: "The working stream reversed its ownership premise.",
      question: "Does this decision need to return to the Lead boundary?",
      evidenceRefs: ["timeline:lead-1:turn-7"],
    });

    expect(signal).toMatchObject({
      observation: "The working stream reversed its ownership premise.",
      question: "Does this decision need to return to the Lead boundary?",
      evidenceRefs: ["timeline:lead-1:turn-7"],
    });
    await vi.waitFor(() => expect(scenario.sent[0]?.message).toContain("Question:"));
    expect(scenario.sent[0]?.message).toContain("does not grant handoff, detach, signaling");
  });

  test("records the Lead's autonomous disposition idempotently", async () => {
    const scenario = createScenario();
    const signal = await requestCoordinationSignal(scenario.dependencies, {
      targetAgentId: scenario.agentId,
      requestedByAgentId: "supervisor-1",
      kind: "handoff_recommended",
      reason: "Current phase is ready for adjacent-Lead handoff",
    });

    const first = await resolveCoordinationSignal(scenario.dependencies, {
      targetAgentId: scenario.agentId,
      signalId: signal.id,
      resolution: "deferred",
      note: "Finish the current bounded unit first",
    });
    const repeated = await resolveCoordinationSignal(scenario.dependencies, {
      targetAgentId: scenario.agentId,
      signalId: signal.id,
      resolution: "deferred",
      note: "Finish the current bounded unit first",
    });

    expect(first).toMatchObject({ status: "deferred", resolvedAt: expect.any(String) });
    expect(repeated).toEqual(first);
    expect(scenario.getRecord().coordinationSignals).toEqual([first]);
  });
});
