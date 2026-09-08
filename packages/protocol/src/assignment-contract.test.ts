import { describe, expect, test } from "vitest";

import {
  assignmentExternalEffectBoundaryFor,
  AssignmentResourceGrantsSchema,
  isAssignmentEffectAllowedForRole,
  isSupervisorNotebookScopeShape,
  PASEO_BEADS_EXTERNAL_EFFECT_SCOPE,
  SUPERVISOR_NOTEBOOK_FILE_NAME,
  supervisorNotebookScopeForCwd,
} from "./assignment-contract.js";

describe("assignment external-effect defaults", () => {
  test("leases only the mandatory Beads graph to mutating Lead and Peer work", () => {
    expect(assignmentExternalEffectBoundaryFor("lead", "delegation")).toEqual({
      mode: "bounded",
      scope: PASEO_BEADS_EXTERNAL_EFFECT_SCOPE,
    });
    expect(assignmentExternalEffectBoundaryFor("lead", "mutating")).toEqual({
      mode: "bounded",
      scope: PASEO_BEADS_EXTERNAL_EFFECT_SCOPE,
    });
    expect(assignmentExternalEffectBoundaryFor("peer", "mutating")).toEqual({
      mode: "bounded",
      scope: PASEO_BEADS_EXTERNAL_EFFECT_SCOPE,
    });
  });

  test("keeps read-only and Supervisor assignments externally denied", () => {
    expect(assignmentExternalEffectBoundaryFor("lead", "read-only")).toEqual({ mode: "denied" });
    expect(assignmentExternalEffectBoundaryFor("peer", "read-only")).toEqual({ mode: "denied" });
    expect(assignmentExternalEffectBoundaryFor("supervisor", "recovery")).toEqual({
      mode: "denied",
    });
    expect(assignmentExternalEffectBoundaryFor("supervisor", "delegation")).toEqual({
      mode: "denied",
    });
    expect(isAssignmentEffectAllowedForRole("supervisor", "delegation")).toBe(true);
  });
});

describe("supervisor notebook scope helpers", () => {
  test("builds the exact notebook file inside the assignment cwd", () => {
    expect(supervisorNotebookScopeForCwd("/repo")).toBe(`/repo/${SUPERVISOR_NOTEBOOK_FILE_NAME}`);
    expect(supervisorNotebookScopeForCwd("/repo/")).toBe(`/repo/${SUPERVISOR_NOTEBOOK_FILE_NAME}`);
    expect(supervisorNotebookScopeForCwd("C:\\repo\\")).toBe(
      `C:\\repo\\${SUPERVISOR_NOTEBOOK_FILE_NAME}`,
    );
  });

  test("accepts only an absolute, traversal-free notebook-named scope", () => {
    expect(isSupervisorNotebookScopeShape("/repo/SUPERVISOR_NOTEBOOK.md")).toBe(true);
    expect(isSupervisorNotebookScopeShape("C:\\repo\\SUPERVISOR_NOTEBOOK.md")).toBe(true);
    expect(isSupervisorNotebookScopeShape("SUPERVISOR_NOTEBOOK.md")).toBe(false);
    expect(isSupervisorNotebookScopeShape("/repo")).toBe(false);
    expect(isSupervisorNotebookScopeShape("/repo/../SUPERVISOR_NOTEBOOK.md")).toBe(false);
    expect(isSupervisorNotebookScopeShape("/repo/notes.md")).toBe(false);
    expect(isSupervisorNotebookScopeShape("   ")).toBe(false);
  });
});

describe("assignment resource grants schema", () => {
  test("accepts an optional bounded lead-workspace grant", () => {
    expect(AssignmentResourceGrantsSchema.parse({ leadWorkspaceIds: [" wks_abc "] })).toEqual({
      leadWorkspaceIds: ["wks_abc"],
    });
    expect(AssignmentResourceGrantsSchema.parse({}).leadWorkspaceIds).toBeUndefined();
  });

  test("rejects a blank lead-workspace id", () => {
    expect(AssignmentResourceGrantsSchema.safeParse({ leadWorkspaceIds: ["  "] }).success).toBe(
      false,
    );
  });
});
