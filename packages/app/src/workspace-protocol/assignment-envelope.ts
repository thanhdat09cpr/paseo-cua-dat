import {
  assignmentExternalEffectBoundaryFor,
  PASEO_ASSIGNMENT_CONTRACT_VERSION,
  supervisorNotebookScopeForCwd,
  type AssignmentEffectClass,
  type AssignmentEnvelope,
} from "@getpaseo/protocol/assignment-contract";
import type { PaseoRoleId } from "@getpaseo/protocol/role-binding";

function dispositionForRole(roleId: PaseoRoleId): AssignmentEnvelope["disposition"] {
  if (roleId === "lead") return "lead-direct";
  if (roleId === "peer") return "peer-execution";
  return "supervision";
}

function mutationBoundaryForEffect(input: {
  roleId: PaseoRoleId;
  effectClass: AssignmentEffectClass;
  cwd: string;
  grantSupervisorNotebook?: boolean;
}): AssignmentEnvelope["mutationBoundary"] {
  if (input.effectClass === "mutating") return { mode: "bounded-write", scope: input.cwd };
  if (input.effectClass === "bootstrap") {
    const separator = input.cwd.includes("\\") && !input.cwd.includes("/") ? "\\" : "/";
    return {
      mode: "bounded-write",
      scope: `${input.cwd.replace(/[\\/]+$/u, "")}${separator}WORKSPACE_PROTOCOL.md`,
    };
  }
  // A Supervisor delegation stays no-write unless the exact notebook write is
  // explicitly granted; expose only that single file, never the broad directory.
  if (
    input.roleId === "supervisor" &&
    input.effectClass === "delegation" &&
    input.grantSupervisorNotebook
  ) {
    return { mode: "bounded-write", scope: supervisorNotebookScopeForCwd(input.cwd) };
  }
  return { mode: "no-write" };
}

export function buildAssignmentEnvelope(input: {
  roleId: PaseoRoleId;
  effectClass: AssignmentEffectClass;
  objective: string;
  cwd: string;
  beadsIssueIds?: readonly string[];
  leadWorkspaceIds?: readonly string[];
  grantSupervisorNotebook?: boolean;
}): AssignmentEnvelope {
  const objective = input.objective.trim();
  if (!objective) {
    throw new Error("assignment_contract_required: objective");
  }
  const beadsIssueIds = Array.from(
    new Set((input.beadsIssueIds ?? []).map((issueId) => issueId.trim()).filter(Boolean)),
  );
  const leadWorkspaceIds = Array.from(
    new Set(
      (input.leadWorkspaceIds ?? []).map((workspaceId) => workspaceId.trim()).filter(Boolean),
    ),
  );
  if (input.roleId === "peer" && input.effectClass === "mutating" && beadsIssueIds.length === 0) {
    throw new Error("assignment_contract_required: mutating Peer Beads issue grant");
  }
  const resourceGrants = {
    ...(beadsIssueIds.length > 0 ? { beadsIssueIds } : {}),
    ...(leadWorkspaceIds.length > 0 ? { leadWorkspaceIds } : {}),
  };
  return {
    version: PASEO_ASSIGNMENT_CONTRACT_VERSION,
    disposition: dispositionForRole(input.roleId),
    objective,
    effectClass: input.effectClass,
    mutationBoundary: mutationBoundaryForEffect({
      roleId: input.roleId,
      effectClass: input.effectClass,
      cwd: input.cwd,
      grantSupervisorNotebook: input.grantSupervisorNotebook,
    }),
    externalEffectBoundary: assignmentExternalEffectBoundaryFor(input.roleId, input.effectClass),
    ...(Object.keys(resourceGrants).length > 0 ? { resourceGrants } : {}),
    evidence: "Return exact changed or inspected scope and proportional verification.",
    handbackAndStop:
      "Stop at completion or a material blocker; hand back evidence, unknowns, residual risk, and lease state.",
  };
}
