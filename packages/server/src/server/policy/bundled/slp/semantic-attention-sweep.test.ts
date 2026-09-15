import pino from "pino";
import { describe, expect, test, vi } from "vitest";

import type {
  AgentTimelineFetchOptions,
  AgentTimelineFetchResult,
  AgentTimelineRow,
} from "../../../agent/agent-timeline-store-types.js";
import type { ManagedAgent } from "../../../agent/agent-manager.js";
import type { EventPolicyRuntimeDependencies } from "../../../agent/event-policy-runtime.js";
import { InMemoryAgentTimelineStore } from "../../../agent/agent-timeline-store.js";
import type {
  SemanticAttentionClassifierResult,
  SemanticAttentionPacket,
} from "./semantic-attention-contract.js";
import {
  SemanticAttentionSweep,
  type SemanticAttentionSweepRoute,
} from "./semantic-attention-sweep.js";
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
  harnessOptions: {
    fetchFlags?: Partial<Pick<AgentTimelineFetchResult, "gap" | "reset" | "staleCursor">>;
    resolveRoute?: (
      source: ManagedAgent,
    ) => SemanticAttentionSweepRoute | null | Promise<SemanticAttentionSweepRoute | null>;
    routeStillCurrent?: (route: SemanticAttentionSweepRoute) => boolean | Promise<boolean>;
    projectStore?: {
      getCount: ReturnType<typeof vi.fn>;
      isCoolingDown: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    logger?: EventPolicyRuntimeDependencies["logger"];
  } = {},
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
      return { ...store.fetch(id, options), ...harnessOptions.fetchFlags };
    },
  };
  const dependencies = {
    agentManager: manager,
    agentStorage: {} as never,
    sendAtSafeBoundary: vi.fn(),
    logger: harnessOptions.logger ?? pino({ level: "silent" }),
    ...(classifier ? { semanticAttentionClassifier: classifier } : {}),
    ...(harnessOptions.projectStore
      ? { semanticAttentionProjectStore: harnessOptions.projectStore }
      : {}),
  } as unknown as EventPolicyRuntimeDependencies;
  let sweepClock = Date.parse("2026-09-15T00:00:00Z");
  const sweep = new SemanticAttentionSweep({
    now: () => sweepClock,
    dependencies,
    stateNamespace: "slp@test",
    resolveRoute:
      harnessOptions.resolveRoute ??
      ((source) => ({
        source,
        supervisor: agent("supervisor"),
        sourceRole: "lead",
        projectRef: "project-ref",
        scopeId: "workspace",
        sourceBindingDigest: source.roleBinding?.bindingDigest ?? "",
        supervisorBindingDigest: "binding-supervisor",
        topologyFingerprint: "topology-1",
      })),
    routeStillCurrent: harnessOptions.routeStillCurrent ?? (() => true),
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
    projectStore: harnessOptions.projectStore,
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

  test.each([
    { decision: "ignore" as const, risk: "low" as const },
    { decision: "aggregate" as const, risk: "medium" as const },
  ])("keeps active %s results quiet", async ({ decision, risk }) => {
    const projectStore = {
      getCount: vi.fn(() => 0),
      isCoolingDown: vi.fn(() => false),
      update: vi.fn(),
    };
    const classifier = {
      mode: "active" as const,
      classify: vi.fn(async (packet: SemanticAttentionPacket) => ({
        status: "classified" as const,
        decision: {
          decision,
          risk,
          confidence: 0.9,
          reason: "No high-confidence coordination concern.",
          evidenceRefs: packet.evidenceRefs,
        },
      })),
    };
    const harness = setup(
      [agent("lead-1")],
      new Map([["lead-1", [row(1, `activity-${decision}`)]]]),
      classifier,
      { projectStore },
    );

    await expect(harness.sweep.runOnce()).resolves.toMatchObject({
      status: "evaluated",
      agentId: "lead-1",
    });
    expect(harness.wakes).toEqual([]);
    expect(projectStore.update).toHaveBeenCalledTimes(1);
    expect(harness.checkpoints.get("slp@test/lead-1")).toMatchObject({
      coverage: "complete",
      coverageDebt: 0,
    });
  });

  test("records shadow decisions and checkpoint progress without waking", async () => {
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
    } as unknown as EventPolicyRuntimeDependencies["logger"];
    const projectStore = {
      getCount: vi.fn(() => 0),
      isCoolingDown: vi.fn(() => false),
      update: vi.fn(),
    };
    const classifier = {
      mode: "shadow" as const,
      classify: vi.fn(async (packet: SemanticAttentionPacket) => ({
        status: "classified" as const,
        decision: {
          decision: "wake_candidate" as const,
          risk: "high" as const,
          confidence: 0.99,
          reason: "Shadow observation only.",
          evidenceRefs: packet.evidenceRefs,
        },
      })),
    };
    const harness = setup(
      [agent("lead-1")],
      new Map([["lead-1", [row(1, "shadow activity")]]]),
      classifier,
      { logger, projectStore },
    );

    await expect(harness.sweep.runOnce()).resolves.toMatchObject({
      status: "evaluated",
      agentId: "lead-1",
    });
    expect(harness.wakes).toEqual([]);
    expect(projectStore.update).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: "lead-1",
        decision: "wake_candidate",
        risk: "high",
        confidence: 0.99,
      }),
      "Semantic attention sweep shadow result",
    );
    expect(harness.checkpoints.get("slp@test/lead-1")).toMatchObject({
      coverage: "complete",
      coverageDebt: 0,
    });
  });

  test("keeps debt and suppresses wake when classification throws", async () => {
    const classifier = {
      mode: "active" as const,
      classify: vi.fn(async () => {
        throw new Error("runner unavailable");
      }),
    };
    const harness = setup(
      [agent("lead-1")],
      new Map([["lead-1", [row(1, "activity awaiting review")]]]),
      classifier,
    );

    await expect(harness.sweep.runOnce()).resolves.toMatchObject({
      status: "unavailable",
      agentId: "lead-1",
      reason: "classifier_rejected",
    });
    expect(harness.wakes).toEqual([]);
    expect(harness.checkpoints.get("slp@test/lead-1")).toMatchObject({
      coverage: "failed",
      coverageDebt: 1,
      seq: 0,
    });
  });

  test("returns busy for an overlapping sweep and invokes the classifier once", async () => {
    let resolveClassifier!: (result: SemanticAttentionClassifierResult) => void;
    let packet!: SemanticAttentionPacket;
    const classifier = {
      mode: "active" as const,
      classify: vi.fn(
        (nextPacket: SemanticAttentionPacket) =>
          new Promise<SemanticAttentionClassifierResult>((resolve) => {
            packet = nextPacket;
            resolveClassifier = resolve;
          }),
      ),
    };
    const harness = setup(
      [agent("lead-1")],
      new Map([["lead-1", [row(1, "pending classification")]]]),
      classifier,
    );

    const firstRun = harness.sweep.runOnce();
    await vi.waitFor(() => expect(classifier.classify).toHaveBeenCalledTimes(1));
    await expect(harness.sweep.runOnce()).resolves.toEqual({ status: "busy" });
    resolveClassifier({
      status: "classified",
      decision: {
        decision: "ignore",
        risk: "low",
        confidence: 0.9,
        reason: "No concern.",
        evidenceRefs: packet.evidenceRefs,
      },
    });
    await expect(firstRun).resolves.toMatchObject({ status: "evaluated", agentId: "lead-1" });
    expect(classifier.classify).toHaveBeenCalledTimes(1);
  });

  test("bounds packets to visible activity without reasoning or external tool input", async () => {
    const classifier = highRiskClassifier();
    const timelines = new Map<string, AgentTimelineRow[]>([
      [
        "lead-1",
        [
          {
            seq: 1,
            timestamp: new Date(1_000).toISOString(),
            item: { type: "reasoning", text: "PRIVATE_REASONING" },
          },
          {
            seq: 2,
            timestamp: new Date(2_000).toISOString(),
            item: {
              type: "tool_call",
              callId: "external-1",
              name: "mcp__github__fetch_secret",
              status: "completed",
              error: null,
              detail: {
                type: "unknown",
                input: { token: "PRIVATE_TOOL_INPUT" },
                output: "PRIVATE_TOOL_OUTPUT",
              },
            },
          },
          row(3, "VISIBLE_ACTIVITY"),
        ],
      ],
    ]);
    const harness = setup([agent("lead-1")], timelines, classifier);

    await harness.sweep.runOnce();
    const packet = classifier.classify.mock.calls[0]?.[0];
    expect(packet?.excerpt).toContain("VISIBLE_ACTIVITY");
    expect(packet?.excerpt).not.toContain("PRIVATE_REASONING");
    expect(packet?.excerpt).not.toContain("PRIVATE_TOOL_INPUT");
    expect(packet?.excerpt).not.toContain("PRIVATE_TOOL_OUTPUT");
    expect(packet?.excerpt.length).toBeLessThanOrEqual(2_000);
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
    expect(harness.checkpoints.get("slp@test/lead-1")).toMatchObject({
      epoch: "epoch-1",
      coverage: "complete",
      lastSweepAt: "2026-09-15T00:00:00.000Z",
    });
    await harness.sweep.runOnce();
    expect(harness.fetches).toHaveLength(1);
  });

  test.each(["gap", "reset", "staleCursor"] as const)(
    "preserves explicit %s coverage after successful classification",
    async (flag) => {
      const classifier = highRiskClassifier();
      const fetchFlags: Partial<Pick<AgentTimelineFetchResult, "gap" | "reset" | "staleCursor">> =
        {};
      fetchFlags[flag] = true;
      const harness = setup(
        [agent("lead-1")],
        new Map([["lead-1", [row(1, `visible-${flag}`)]]]),
        classifier,
        { fetchFlags },
      );

      expect((await harness.sweep.runOnce()).status).toBe("evaluated");
      expect(harness.checkpoints.get("slp@test/lead-1")).toMatchObject({
        coverage: "gap",
        coverageDebt: 1,
      });
    },
  );

  test("retains unread debt and does not consume a stale route", async () => {
    const classifier = highRiskClassifier();
    let routeCurrent = false;
    const projectStore = {
      getCount: vi.fn(() => 0),
      isCoolingDown: vi.fn(() => false),
      update: vi.fn(),
    };
    const harness = setup(
      [agent("lead-1")],
      new Map([["lead-1", [row(1, "activity during route change")]]]),
      classifier,
      { projectStore, routeStillCurrent: () => routeCurrent },
    );
    harness.checkpoints.set("slp@test/lead-1", {
      epoch: "epoch-1",
      seq: 1,
      rowDigests: {},
      coverage: "complete",
      coverageDebt: 0,
      lastSweepAt: "2026-09-14T23:45:00.000Z",
    });

    await expect(harness.sweep.runOnce()).resolves.toMatchObject({
      status: "evaluated",
      agentId: "lead-1",
      reason: "topology_changed",
    });
    expect(harness.checkpoints.get("slp@test/lead-1")).toMatchObject({
      epoch: "epoch-1",
      seq: 1,
      coverage: "failed",
      coverageDebt: 1,
      lastSweepAt: "2026-09-15T00:00:00.000Z",
    });
    expect(harness.wakes).toEqual([]);
    expect(projectStore.isCoolingDown).not.toHaveBeenCalled();
    expect(projectStore.update).not.toHaveBeenCalled();

    routeCurrent = true;
    await harness.sweep.runOnce();
    expect(classifier.classify).toHaveBeenCalledTimes(2);
    expect(harness.wakes).toEqual(["lead-1"]);
    expect(projectStore.update).toHaveBeenCalledTimes(1);
  });

  test("records debt when the owning route is unresolved", async () => {
    const classifier = highRiskClassifier();
    const harness = setup(
      [agent("lead-1")],
      new Map([["lead-1", [row(1, "unrouted activity")]]]),
      classifier,
      { resolveRoute: () => null },
    );

    expect((await harness.sweep.runOnce()).status).toBe("idle");
    expect(classifier.classify).not.toHaveBeenCalled();
    expect(harness.checkpoints.get("slp@test/lead-1")).toMatchObject({
      coverage: "failed",
      coverageDebt: 1,
      lastSweepAt: "2026-09-15T00:00:00.000Z",
    });
    expect(harness.wakes).toEqual([]);
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
