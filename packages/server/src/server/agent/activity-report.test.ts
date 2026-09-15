import { describe, expect, it } from "vitest";
import {
  buildAgentActivityReport,
  canonicalFetchLimitForActivityReport,
} from "./activity-report.js";
import { InMemoryAgentTimelineStore } from "./agent-timeline-store.js";
import type { AgentTimelineCursor } from "./agent-timeline-store-types.js";

const SNAPSHOT_AT = "2026-09-15T02:00:00.000Z";

function readPage(
  store: InMemoryAgentTimelineStore,
  options: Parameters<InMemoryAgentTimelineStore["fetch"]>[1],
) {
  return store.fetch("agent-1", options);
}

function reportFor(
  store: InMemoryAgentTimelineStore,
  options: Parameters<InMemoryAgentTimelineStore["fetch"]>[1],
) {
  return buildAgentActivityReport({
    agentId: "agent-1",
    timeline: readPage(store, options),
    snapshotAt: SNAPSHOT_AT,
    workspaceId: "workspace-1",
    projectId: "project-1",
    lifecycle: "idle",
    currentModeId: "default",
  });
}

function requireCursor(cursor: AgentTimelineCursor | null): AgentTimelineCursor {
  if (!cursor) {
    throw new Error("Expected a bounded activity report cursor");
  }
  return cursor;
}

describe("buildAgentActivityReport", () => {
  it("labels assistant claims without copying external tool arguments", () => {
    const store = new InMemoryAgentTimelineStore();
    store.initialize("agent-1", {
      epoch: "public-epoch",
      items: [
        { type: "assistant_message", text: "I claim the task is done." },
        {
          type: "tool_call",
          callId: "external-1",
          name: "paseo__create_agent",
          status: "completed",
          detail: {
            type: "unknown",
            input: { initialPrompt: "private tool arguments" },
            output: null,
          },
          error: null,
        },
      ],
    });
    const report = reportFor(store, { direction: "tail", limit: 2 });
    expect(report.content).toContain("[Assistant] I claim the task is done.");
    expect(report.content).toContain("[paseo__create_agent]");
    expect(report.content).not.toContain("private tool arguments");
    expect(report.sourceRefs).toEqual([
      "timeline:agent-1:public-epoch:1",
      "timeline:agent-1:public-epoch:2",
    ]);
  });

  it("uses bounded canonical pages without skipping entries hidden by projection", () => {
    const store = new InMemoryAgentTimelineStore();
    store.initialize("agent-1", {
      epoch: "epoch-1",
      items: [
        { type: "user_message", text: "first" },
        { type: "reasoning", text: "private first" },
        { type: "assistant_message", text: "second" },
        { type: "reasoning", text: "private second" },
        { type: "user_message", text: "third" },
      ],
    });

    const first = reportFor(store, {
      direction: "after",
      limit: canonicalFetchLimitForActivityReport(2),
    });
    expect(first.content).toContain("[User] first");
    expect(first.content).not.toContain("private first");
    expect(first.nextCursor).toEqual({ epoch: "epoch-1", seq: 2 });
    expect(first.coverage).toMatchObject({
      canonicalRows: 2,
      projectedEntries: 2,
      visibleEntries: 1,
      returnedEntries: 1,
    });
    expect(first.sourceRefs).toEqual(["timeline:agent-1:epoch-1:1"]);

    const second = reportFor(store, {
      direction: "after",
      cursor: requireCursor(first.nextCursor),
      limit: canonicalFetchLimitForActivityReport(2),
    });
    expect(second.content).toContain("second");
    expect(second.content).not.toContain("private second");
    expect(second.nextCursor).toEqual({ epoch: "epoch-1", seq: 4 });

    const third = reportFor(store, {
      direction: "after",
      cursor: requireCursor(second.nextCursor),
      limit: canonicalFetchLimitForActivityReport(2),
    });
    expect(third.content).toContain("[User] third");
    expect(third.nextCursor).toEqual({ epoch: "epoch-1", seq: 5 });
    expect(third.hasNewer).toBe(false);
  });

  it("keeps timeline identity and gap metadata in a bounded report", () => {
    const store = new InMemoryAgentTimelineStore();
    store.initialize("agent-1", {
      epoch: "epoch-2",
      nextSeq: 8,
      rows: [
        {
          seq: 7,
          timestamp: "2026-09-15T01:59:00.000Z",
          item: { type: "assistant_message", text: "latest" },
        },
      ],
    });

    const report = reportFor(store, {
      direction: "after",
      cursor: { epoch: "epoch-2", seq: 1 },
      limit: canonicalFetchLimitForActivityReport(2),
    });

    expect(report).toMatchObject({
      agentId: "agent-1",
      workspaceId: "workspace-1",
      projectId: "project-1",
      snapshotAt: SNAPSHOT_AT,
      epoch: "epoch-2",
      direction: "after",
      gap: true,
      reset: true,
      staleCursor: false,
      observedState: { lifecycle: "idle", currentModeId: "default" },
    });
    expect(report.sourceRefs).toEqual(["timeline:agent-1:epoch-2:7"]);
  });

  it("advances through a page that contains only excluded entries", () => {
    const store = new InMemoryAgentTimelineStore();
    store.initialize("agent-1", {
      epoch: "epoch-3",
      items: [
        { type: "reasoning", text: "private one" },
        { type: "reasoning", text: "private two" },
        { type: "user_message", text: "visible" },
      ],
    });

    const first = reportFor(store, { direction: "after", limit: 2 });
    expect(first.content).toBe("No activity to display.");
    expect(first.nextCursor).toEqual({ epoch: "epoch-3", seq: 2 });
    expect(first.coverage).toMatchObject({
      canonicalRows: 2,
      visibleEntries: 0,
      returnedEntries: 0,
      omittedCanonicalRows: 2,
      truncated: true,
    });

    const second = reportFor(store, {
      direction: "after",
      cursor: requireCursor(first.nextCursor),
      limit: 2,
    });
    expect(second.content).toContain("[User] visible");
    expect(second.sourceRefs).toEqual(["timeline:agent-1:epoch-3:3"]);
  });

  it("marks a stale epoch while returning the retained page with current references", () => {
    const store = new InMemoryAgentTimelineStore();
    store.initialize("agent-1", {
      epoch: "epoch-4",
      items: [
        { type: "user_message", text: "older" },
        { type: "assistant_message", text: "latest" },
      ],
    });

    const report = reportFor(store, {
      direction: "after",
      cursor: { epoch: "stale-epoch", seq: 1 },
      limit: 2,
    });

    expect(report).toMatchObject({
      epoch: "epoch-4",
      reset: true,
      staleCursor: true,
      gap: false,
      nextCursor: { epoch: "epoch-4", seq: 2 },
    });
    expect(report.sourceRefs).toEqual(["timeline:agent-1:epoch-4:1", "timeline:agent-1:epoch-4:2"]);
  });

  it("repeats the same cursor read without consuming or changing its report", () => {
    const store = new InMemoryAgentTimelineStore();
    store.initialize("agent-1", {
      epoch: "epoch-5",
      items: [
        { type: "user_message", text: "first" },
        { type: "assistant_message", text: "second" },
      ],
    });
    const options = {
      direction: "after" as const,
      cursor: { epoch: "epoch-5", seq: 0 },
      limit: 2,
    };

    const first = reportFor(store, options);
    const repeated = reportFor(store, options);

    expect(repeated.content).toBe(first.content);
    expect(repeated.sourceRefs).toEqual(first.sourceRefs);
    expect(repeated.nextCursor).toEqual(first.nextCursor);
    expect(repeated.coverage).toEqual(first.coverage);
  });

  it("paginates older activity with a cursor that points at the page start", () => {
    const store = new InMemoryAgentTimelineStore();
    store.initialize("agent-1", {
      epoch: "epoch-6",
      items: [
        { type: "user_message", text: "first" },
        { type: "assistant_message", text: "first answer" },
        { type: "user_message", text: "second" },
        { type: "assistant_message", text: "second answer" },
      ],
    });

    const newest = reportFor(store, { direction: "tail", limit: 2 });
    expect(newest.content).toContain("second answer");
    expect(newest.nextCursor).toEqual({ epoch: "epoch-6", seq: 3 });

    const older = reportFor(store, {
      direction: "before",
      cursor: requireCursor(newest.nextCursor),
      limit: 2,
    });
    expect(older.content).toContain("first answer");
    expect(older.content).not.toContain("second answer");
    expect(older.nextCursor).toEqual({ epoch: "epoch-6", seq: 1 });
    expect(older.hasOlder).toBe(false);
    expect(older.hasNewer).toBe(true);
  });

  it("reports content truncation while retaining the entry source reference", () => {
    const store = new InMemoryAgentTimelineStore();
    store.initialize("agent-1", {
      epoch: "epoch-7",
      items: [{ type: "assistant_message", text: "x".repeat(13_000) }],
    });

    const report = reportFor(store, { direction: "tail", limit: 2 });

    expect(report.content).toHaveLength(12_000);
    expect(report.content.endsWith("…")).toBe(true);
    expect(report.content).not.toContain("x".repeat(13_000));
    expect(report.coverage).toMatchObject({
      contentTruncated: true,
      contentOmittedEntries: 1,
      returnedEntries: 1,
    });
    expect(report.sourceRefs).toEqual(["timeline:agent-1:epoch-7:1"]);
  });
});

describe("canonicalFetchLimitForActivityReport", () => {
  it("bounds observation requests to canonical rows", () => {
    expect(canonicalFetchLimitForActivityReport(1)).toBe(1);
    expect(canonicalFetchLimitForActivityReport(20)).toBe(20);
    expect(canonicalFetchLimitForActivityReport(100)).toBe(50);
  });
});
