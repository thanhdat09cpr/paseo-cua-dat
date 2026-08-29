import { describe, expect, test } from "vitest";
import {
  assignmentAuthorityLabel,
  defaultAssignmentEffectForRole,
  ordinaryAssignmentAuthorityOptionsForRole,
} from "./assignment-authority";

describe("ordinary assignment authority", () => {
  test("shows role-aware intents and keeps recovery flows contextual", () => {
    expect(ordinaryAssignmentAuthorityOptionsForRole("lead").map((option) => option.id)).toEqual([
      "mutating",
      "read-only",
      "delegation",
    ]);
    expect(ordinaryAssignmentAuthorityOptionsForRole("peer").map((option) => option.id)).toEqual([
      "mutating",
      "read-only",
    ]);
    expect(
      ordinaryAssignmentAuthorityOptionsForRole("supervisor").map((option) => option.id),
    ).toEqual(["delegation", "read-only"]);
  });

  test("uses task-oriented defaults and labels", () => {
    expect(defaultAssignmentEffectForRole("lead")).toBe("mutating");
    expect(defaultAssignmentEffectForRole("peer")).toBe("mutating");
    expect(defaultAssignmentEffectForRole("supervisor")).toBe("delegation");
    expect(assignmentAuthorityLabel("lead", "delegation")).toBe("Coordinate only");
    expect(assignmentAuthorityLabel("supervisor", "delegation")).toBe("Coordinate Leads");
    expect(assignmentAuthorityLabel("supervisor", "recovery")).toBe("recovery");
  });

  test("keeps Observe available as an explicit no-write Supervisor mode", () => {
    const observe = ordinaryAssignmentAuthorityOptionsForRole("supervisor").find(
      (option) => option.id === "read-only",
    );

    expect(observe).toEqual({
      id: "read-only",
      label: "Observe",
      description: "Inspect project activity and evidence without changing files or routing work.",
    });
  });
});
