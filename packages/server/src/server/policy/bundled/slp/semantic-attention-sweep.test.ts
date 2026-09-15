import pino from "pino";
import { describe, expect, test, vi } from "vitest";

import type {
  AgentTimelineFetchOptions,
  AgentTimelineRow,
} from "../../../agent/agent-timeline-store-types.js";
import type { ManagedAgent } from "../../../agent/agent-manager.js";
import type { EventPolicyRuntimeDependencies } from "../../../agent/event-policy-runtime.js";
import { InMemoryAgentTimelineStore } from "../../../agent/agent-timeline-store.js";
import { SemanticAttentionSweep } from "./semantic-attention-sweep.js";
import type { SemanticAttentionSweepCheckpoint } from "./semantic-attention-sweep-checkpoint.js";

function agent(id: string): ManagedAgent {
  return {
    id,
    provider: "codex",
    cwd: "/repo",
    workspaceId: "workspace",
    roleBinding: { roleId: "lead", bindingDigest: `binding-${id}` },
    labels: {},
    lifecycle: "idle",
    internal: false,
    activeTurnId: null,
  } as ManagedAgent;
}

function row(seq: number, text: string): AgentTimelineRow {
  return {
    seq,
    timestamp: new Date(seq * 1_000).toISOString(),
    item: { type: "assistant_message", text },
  };
}

function setup(
  agents: ManagedAgent[],
  timelines: Map<string, AgentTimelineRow[]>,
  classifier: EventPolicyRuntimeDependencies["semanticAttentionClassifier"],
) {
  const checkpoints = new Map<string, SemanticAttentionSweepCheckpoint>();
  const fetches: AgentTimelineFetchOptions[] = [];
  const wakes: string[] = [];
  const manager = {
    listAgents: () => agents,
    getAgent: (id: string) => agents.find((candidate) => candidate.id === id) ?? null,
    fetchTimeline: (id: string, options?: AgentTimelineFetchOptions) => {
      fetches.push(options ?? {});
      const rows = timelines.get(id) ?? [];
      const store = new InMemoryAgentTimelineStore();
      store.initialize(id, { epoch: "epoch-1", nextSeq: (rows.at(-1)?.seq ?? 0) + 1, rows });
      return store.fetch(id, options);
    },
  };
  const dependencies = {
    agentManager: manager,
    agentStorage: {} as never,
    sendAtSafeBoundary: vi.fn(),
    logger: pino({ level: "silent" }),
    ...(classifier ? { semanticAttentionClassifier: classifier } : {}),
  } as unknown as EventPolicyRuntimeDependencies;
  let sweepClock = Date.parse("2026-09-15T00:00:00Z");
  const sweep = new SemanticAttentionSweep({
    now: () => sweepClock,
    dependencies,
    stateNamespace: "slp@test",
    resolveRoute: (source) => ({
      source,
      supervisor: agent("supervisor"),
      sourceRole: "lead",
      projectRef: "project-ref",
      scopeId: "workspace",
      sourceBindingDigest: source.roleBinding?.bindingDigest ?? "",
      supervisorBindingDigest: "binding-supervisor",
      topologyFingerprint: "topology-1",
    }),
    routeStillCurrent: () => true,
    loadCheckpoint: async (id, namespace) => checkpoints.get(`${namespace}/${id}`),
    saveCheckpoint: async (id, namespace, checkpoint) => {
      checkpoints.set(`${namespace}/${id}`, checkpoint);
    },
    onWake: async (route) => {
      wakes.push(route.source.id);
    },
  });
  return {
    checkpoints,
    fetches,
    sweep,
    wakes,
    advance: () => {
      sweepClock += 15 * 60 * 1000;
    },
  };
}

function highRiskClassifier() {
  return {
    mode: "active" as const,
    classify: vi.fn(async (packet) => ({
      status: "classified" as const,
      decision: {
        decision: "wake_candidate" as const,
        risk: "high" as const,
        confidence: 0.9,
        reason: "requires review",
        evidenceRefs: [packet.evidenceRefs[0]],
      },
    })),
  };
}

describe("semantic attention periodic sweep", () => {
  test("does not classify a complete source again before its cadence", async () => {
    const classifier = highRiskClassifier();
    const timelines = new Map([["lead-1", [row(1, "first")]]]);
    const harness = setup([agent("lead-1")], timelines, classifier);
    await harness.sweep.runOnce();
    timelines.set("lead-1", [row(1, "changed")]);
    await harness.sweep.runOnce();
    expect(classifier.classify).toHaveBeenCalledTimes(1);
    harness.advance();
    await harness.sweep.runOnce();
    expect(classifier.classify).toHaveBeenCalledTimes(2);
  });

  test("continues a long row without losing its unclassified suffix", async () => {
    const classifier = highRiskClassifier();
    const harness = setup(
      [agent("lead-1")],
      new Map([["lead-1", [row(1, "x".repeat(4500) + "FINAL-EVIDENCE")]]]),
      classifier,
    );
    harness.advance();
    await harness.sweep.runOnce();
    const first = harness.checkpoints.get("slp@test/lead-1")!;
    expect(first.seq).toBe(0);
    expect(first.pendingRow?.offset).toBe(2000);
    harness.checkpoints.set("slp@test/lead-1", JSON.parse(JSON.stringify(first)));
    classifier.classify.mockRejectedValueOnce(new Error("unavailable"));
    harness.advance();
    await harness.sweep.runOnce();
    expect(harness.checkpoints.get("slp@test/lead-1")?.pendingRow?.offset).toBe(2000);
    harness.advance();
    await harness.sweep.runOnce();
    expect(harness.checkpoints.get("slp@test/lead-1")?.pendingRow?.offset).toBe(4000);
    harness.advance();
    await harness.sweep.runOnce();
    expect(classifier.classify.mock.calls.at(-1)?.[0].excerpt).toContain("FINAL-EVIDENCE");
    expect(harness.checkpoints.get("slp@test/lead-1")?.seq).toBe(1);
    expect(harness.checkpoints.get("slp@test/lead-1")?.pendingRow).toBeUndefined();
    for (const [packet] of classifier.classify.mock.calls)
      expect(packet.excerpt.length).toBeLessThanOrEqual(2000);
  });

  test("starts from a bounded tail and catches a mutable row on the overlap", async () => {
    const timelines = new Map([["lead-1", [row(4, "first")]]]);
    const classifier = highRiskClassifier();
    const harness = setup([agent("lead-1")], timelines, classifier);

    harness.advance();
    await harness.sweep.runOnce();
    expect(harness.fetches[0]).toMatchObject({ direction: "tail", limit: 8 });
    expect(classifier.classify).toHaveBeenCalledTimes(1);
    expect(harness.wakes).toEqual(["lead-1"]);

    timelines.set("lead-1", [row(4, "updated after commit")]);
    harness.advance();
    await harness.sweep.runOnce();
    expect(harness.fetches.at(-1)).toMatchObject({ direction: "after", cursor: { seq: 2 } });
    expect(classifier.classify).toHaveBeenCalledTimes(2);
  });

  test("keeps unread cursor debt when the classifier is unavailable", async () => {
    const timelines = new Map([["lead-1", [row(1, "pending")]]]);
    const classifier = {
      mode: "active" as const,
      classify: vi.fn(async () => ({ status: "unavailable" as const, reason: "missing model" })),
    };
    const harness = setup([agent("lead-1")], timelines, classifier);

    expect((await harness.sweep.runOnce()).status).toBe("unavailable");
    const checkpoint = harness.checkpoints.get("slp@test/lead-1");
    expect(checkpoint?.seq).toBe(0);
    expect(checkpoint?.coverage).toBe("failed");
    expect(checkpoint?.coverageDebt).toBe(1);
    harness.advance();
    await harness.sweep.runOnce();
    expect(classifier.classify).toHaveBeenCalledTimes(2);
  });

  test("rotates one model candidate fairly across independent source agents", async () => {
    const timelines = new Map([
      ["lead-a", [row(1, "a")]],
      ["lead-b", [row(1, "b")]],
    ]);
    const classifier = highRiskClassifier();
    const harness = setup([agent("lead-a"), agent("lead-b")], timelines, classifier);

    harness.advance();
    await harness.sweep.runOnce();
    harness.advance();
    await harness.sweep.runOnce();
    expect(classifier.classify.mock.calls).toHaveLength(2);
    expect(harness.wakes).toEqual(["lead-a", "lead-b"]);
  });

  test("finishes the forward window despite older history outside the bounded tail", async () => {
    const classifier = highRiskClassifier();
    const rows = Array.from({ length: 12 }, (_, index) => row(index + 1, `message-${index + 1}`));
    const timelines = new Map([["lead-1", rows]]);
    const harness = setup([agent("lead-1")], timelines, classifier);
    await harness.sweep.runOnce();
    timelines.set("lead-1", [...rows, row(13, "new activity")]);
    await harness.sweep.runOnce();
    expect(harness.checkpoints.get("slp@test/lead-1")).toMatchObject({
      seq: 13,
      coverage: "complete",
    });
    timelines.set("lead-1", [...rows, row(13, "new activity"), row(14, "wait for next cadence")]);
    await harness.sweep.runOnce();
    expect(classifier.classify).toHaveBeenCalledTimes(2);
  });

  test("keeps later visible pages due after excluding a page of hidden activity", async () => {
    const classifier = highRiskClassifier();
    const timelines = new Map([["lead-1", [row(1, "initial")]]]);
    const harness = setup([agent("lead-1")], timelines, classifier);
    await harness.sweep.runOnce();
    timelines.set("lead-1", [
      row(1, "initial"),
      ...Array.from({ length: 7 }, (_, index) => ({
        ...row(index + 2, ""),
        item: { type: "reasoning" as const, text: "PRIVATE" },
      })),
      row(9, "VISIBLE-UNREAD"),
    ]);
    harness.advance();
    await harness.sweep.runOnce();
    expect(harness.checkpoints.get("slp@test/lead-1")).toMatchObject({
      seq: 8,
      coverage: "partial",
    });
    await harness.sweep.runOnce();
    expect(classifier.classify.mock.calls.at(-1)?.[0].excerpt).toContain("VISIBLE-UNREAD");
    expect(
      classifier.classify.mock.calls.map(([packet]) => packet.excerpt).join(" "),
    ).not.toContain("PRIVATE");
  });

  test("does not invoke the model for an empty window", async () => {
    const classifier = highRiskClassifier();
    const harness = setup([agent("lead-1")], new Map([["lead-1", []]]), classifier);

    expect((await harness.sweep.runOnce()).status).toBe("idle");
    expect(classifier.classify).not.toHaveBeenCalled();
  });

  test("does not consume a checkpoint when semantic classification is off", async () => {
    const classifier = { mode: "off" as const, classify: vi.fn() };
    const harness = setup(
      [agent("lead-1")],
      new Map([["lead-1", [row(1, "excluded")]]]),
      classifier,
    );

    harness.advance();
    await harness.sweep.runOnce();
    expect(classifier.classify).not.toHaveBeenCalled();
    expect(harness.checkpoints.has("slp@test/lead-1")).toBe(false);
  });

  test("drops a stale result after disposal without waking Supervisor", async () => {
    let resolve!: (
      value: Awaited<ReturnType<ReturnType<typeof highRiskClassifier>["classify"]>>,
    ) => void;
    const classifier = {
      mode: "active" as const,
      classify: vi.fn(
        () =>
          new Promise<Awaited<ReturnType<ReturnType<typeof highRiskClassifier>["classify"]>>>(
            (done) => (resolve = done),
          ),
      ),
    };
    const harness = setup([agent("lead-1")], new Map([["lead-1", [row(1, "late")]]]), classifier);
    const running = harness.sweep.runOnce();
    await vi.waitFor(() => expect(classifier.classify).toHaveBeenCalledTimes(1));
    harness.sweep.dispose();
    resolve(await highRiskClassifier().classify({ evidenceRefs: ["ref"] } as never));
    expect((await running).status).toBe("stopped");
    expect(harness.wakes).toEqual([]);
  });
});
