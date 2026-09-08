import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { SemanticAttentionProjectStore } from "./semantic-attention-project-store.js";

test("project aggregation survives recipient replacement and restart, isolates generations", () => {
  const root = mkdtempSync(join(tmpdir(), "paseo-project-store-"));
  try {
    const file = join(root, "state.json");
    const decision = {
      decision: "aggregate" as const,
      risk: "medium" as const,
      confidence: 0.7,
      reason: "Needs more evidence",
      evidenceRefs: ["e1"],
    };
    const store = new SemanticAttentionProjectStore(file);
    store.update("generation-1", "project-1", "scope", "e1", "fingerprint-1", decision);
    store.update("generation-1", "project-1", "scope", "e1", "fingerprint-1", decision);
    const restarted = new SemanticAttentionProjectStore(file);
    expect(restarted.getCount("generation-1", "project-1", "scope")).toBe(1);
    expect(restarted.isCoolingDown("generation-1", "project-1", "scope", "fingerprint-1")).toBe(
      true,
    );
    expect(restarted.isCoolingDown("generation-1", "project-1", "scope", "fingerprint-2")).toBe(
      false,
    );
    restarted.update("generation-1", "project-1", "scope", "e2", "fingerprint-2", decision);
    expect(store.getCount("generation-1", "project-1", "scope")).toBe(2);
    expect(store.getCount("generation-1", "project-2", "scope")).toBe(0);
    expect(store.getCount("generation-2", "project-1", "scope")).toBe(0);
    expect(readFileSync(file, "utf8")).not.toContain("Needs more evidence");
    store.update("generation-1", "project-1", "scope", "e3", "fingerprint-3", {
      ...decision,
      decision: "ignore",
    });
    expect(restarted.getCount("generation-1", "project-1", "scope")).toBe(0);
    expect(restarted.isCoolingDown("generation-1", "project-1", "scope", "fingerprint-3")).toBe(
      true,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
