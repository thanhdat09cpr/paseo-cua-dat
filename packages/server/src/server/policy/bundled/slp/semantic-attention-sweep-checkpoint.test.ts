import { describe, expect, test } from "vitest";

import type { AgentTimelineRow } from "../../../agent/agent-timeline-store-types.js";
import {
  digestSemanticAttentionTimelineRow,
  parseSemanticAttentionSweepCheckpoint,
  semanticAttentionSweepRowChanged,
  withSweepRowDigests,
} from "./semantic-attention-sweep-checkpoint.js";

const timelineRow = (text: string): AgentTimelineRow => ({
  seq: 4,
  timestamp: "2026-09-15T00:00:00.000Z",
  item: { type: "assistant_message", text },
});

describe("semantic attention sweep checkpoint", () => {
  test("persists only bounded row digests and detects same-sequence updates", () => {
    const initial = parseSemanticAttentionSweepCheckpoint({ epoch: "epoch-1", seq: 4 });
    const saved = {
      ...initial,
      rowDigests: withSweepRowDigests(initial, "epoch-1", [timelineRow("before")]),
    };
    expect(semanticAttentionSweepRowChanged(saved, "epoch-1", timelineRow("before"))).toBe(false);
    expect(semanticAttentionSweepRowChanged(saved, "epoch-1", timelineRow("after"))).toBe(true);
    expect(digestSemanticAttentionTimelineRow(timelineRow("before"))).toHaveLength(32);
  });

  test("drops malformed and oversized metadata on restart", () => {
    const checkpoint = parseSemanticAttentionSweepCheckpoint({
      epoch: "epoch-1",
      seq: -4,
      coverage: "unknown",
      coverageDebt: 999,
      rowDigests: {
        "bad-key": "not-a-digest",
        "4:epoch-1": "0123456789abcdef0123456789abcdef",
      },
    });
    expect(checkpoint.seq).toBe(0);
    expect(checkpoint.coverage).toBe("partial");
    expect(checkpoint.coverageDebt).toBe(100);
    expect(Object.keys(checkpoint.rowDigests)).toEqual(["4:epoch-1"]);
  });
});
