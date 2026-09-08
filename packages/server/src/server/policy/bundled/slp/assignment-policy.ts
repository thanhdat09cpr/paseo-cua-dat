import {
  assignmentExternalEffectBoundaryFor,
  isAssignmentEffectAllowedForRole,
  isSupervisorNotebookScopeShape,
  type AssignmentEnvelope,
} from "@getpaseo/protocol/assignment-contract";
import type { PaseoRoleId } from "@getpaseo/protocol/role-binding";

import {
  ASSIGNMENT_CONTRACT_INVALID_ERROR,
  preflightAssignmentEnvelope,
  type PersistedAssignmentContract,
} from "../../../agent/assignment-contract.js";

function validateRoleDisposition(roleId: PaseoRoleId, envelope: AssignmentEnvelope): void {
  const allowed: Record<PaseoRoleId, readonly AssignmentEnvelope["disposition"][]> = {
    lead: ["lead-direct"],
    peer: ["peer-execution", "independent-review"],
    supervisor: ["supervision"],
  };
  if (!allowed[roleId].includes(envelope.disposition)) {
    throw new Error(
      `${ASSIGNMENT_CONTRACT_INVALID_ERROR}: disposition '${envelope.disposition}' does not match role '${roleId}'`,
    );
  }
  if (!isAssignmentEffectAllowedForRole(roleId, envelope.effectClass)) {
    throw new Error(
      `${ASSIGNMENT_CONTRACT_INVALID_ERROR}: effect '${envelope.effectClass}' is not allowed for role '${roleId}'`,
    );
  }
}

/**
 * A delegation lease stays no-write by default. The one permitted exception is a
 * Supervisor coordinating its own Leads while owning a single named notebook: a
 * bounded-write scope whose shape is the SUPERVISOR_NOTEBOOK.md file. The exact
 * cwd match and the Human-session issuer are enforced at receipt materialization.
 */
function isPermittedSupervisorNotebookWrite(
  roleId: PaseoRoleId,
  envelope: AssignmentEnvelope,
): boolean {
  return (
    roleId === "supervisor" &&
    envelope.effectClass === "delegation" &&
    envelope.mutationBoundary.mode === "bounded-write" &&
    isSupervisorNotebookScopeShape(envelope.mutationBoundary.scope)
  );
}

function validateEffectBoundaries(roleId: PaseoRoleId, envelope: AssignmentEnvelope): void {
  if (envelope.effectClass === "read-only" && envelope.mutationBoundary.mode !== "no-write") {
    throw new Error(`${ASSIGNMENT_CONTRACT_INVALID_ERROR}: read-only requires no-write`);
  }
  if (
    envelope.effectClass === "delegation" &&
    envelope.mutationBoundary.mode !== "no-write" &&
    !isPermittedSupervisorNotebookWrite(roleId, envelope)
  ) {
    throw new Error(`${ASSIGNMENT_CONTRACT_INVALID_ERROR}: delegation requires no-write`);
  }
  if (envelope.effectClass === "mutating" && envelope.mutationBoundary.mode !== "bounded-write") {
    throw new Error(`${ASSIGNMENT_CONTRACT_INVALID_ERROR}: mutating requires bounded-write`);
  }
}

function validateExternalEffectBoundary(roleId: PaseoRoleId, envelope: AssignmentEnvelope): void {
  const requiredMode = assignmentExternalEffectBoundaryFor(roleId, envelope.effectClass).mode;
  if (requiredMode === "denied" && envelope.externalEffectBoundary.mode !== "denied") {
    throw new Error(
      `${ASSIGNMENT_CONTRACT_INVALID_ERROR}: ${roleId} ${envelope.effectClass} requires external effects ${requiredMode}`,
    );
  }
}

function validateResourceGrants(roleId: PaseoRoleId, envelope: AssignmentEnvelope): void {
  if (
    roleId === "peer" &&
    envelope.effectClass === "mutating" &&
    !envelope.resourceGrants?.beadsIssueIds?.length
  ) {
    throw new Error(
      `${ASSIGNMENT_CONTRACT_INVALID_ERROR}: mutating Peer requires an exact Beads issue grant`,
    );
  }
}

export function preflightSlpAssignmentEnvelope(input: {
  roleId: PaseoRoleId;
  envelope: AssignmentEnvelope | undefined;
  createdAt?: Date;
}): AssignmentEnvelope {
  const envelope = preflightAssignmentEnvelope(input);
  validateRoleDisposition(input.roleId, envelope);
  validateEffectBoundaries(input.roleId, envelope);
  validateExternalEffectBoundary(input.roleId, envelope);
  validateResourceGrants(input.roleId, envelope);
  if (
    envelope.protocolException &&
    !new Set(["read-only", "bootstrap", "recovery"]).has(envelope.effectClass)
  ) {
    throw new Error(
      `${ASSIGNMENT_CONTRACT_INVALID_ERROR}: protocol exception is not allowed for ${envelope.effectClass}`,
    );
  }
  return envelope;
}

function trackerCheckpointForRole(
  roleId: PaseoRoleId,
  effectClass: AssignmentEnvelope["effectClass"],
): string {
  const canMutateTracker =
    assignmentExternalEffectBoundaryFor(roleId, effectClass).mode === "bounded";
  const receiptRule = `Resolve the exact logical tool from the current provider tool catalog; never guess or hard-code an MCP namespace. Only an authoritative Paseo tool receipt counts as the checkpoint; a missing or failed selector leaves issue state UNKNOWN${canMutateTracker ? " and blocks tracker mutation" : " while source inspection continues inside the no-write lease"}.`;
  if (roleId === "lead") {
    return `Mandatory Beads Central checkpoint: call beads_status at assignment start. ${receiptRule} Inspect or create the durable issue before material routing/work; update authoritative evidence at handoff; close only after your engineering verdict. If Central is unavailable, report BLOCKED and do not use native bd or another tracker.`;
  }
  if (roleId === "peer") {
    const issueScope =
      effectClass === "mutating"
        ? "inspect the daemon-verified granted issue"
        : "inspect a relevant issue when one is available; no issue grant is required for read-only source inspection";
    return `Mandatory Beads Central checkpoint: call beads_status and ${issueScope} at assignment start. ${receiptRule} Claim before owned mutation, update evidence/blockers before handoff, and never close. If Central is unavailable, do not use native bd or another tracker${canMutateTracker ? "; report BLOCKED" : "; continue only the read-only source inspection and report issue state UNKNOWN"}.`;
  }
  return `Mandatory Beads Central checkpoint: call beads_status and read the relevant issue graph at supervision start and material handoff when Central is available. ${receiptRule} Keep every Beads tracker operation read-only; this read-only rule scopes the tracker, not your own notebook write scope. If Central is unavailable, continue only read-only tracker inspection, report issue state UNKNOWN, and do not use native bd or another tracker.`;
}

export function buildSlpAssignmentInstruction(contract: PersistedAssignmentContract): string {
  const { envelope, receipt } = contract;
  const writeScope =
    envelope.mutationBoundary.mode === "bounded-write"
      ? `bounded-write (${envelope.mutationBoundary.scope})`
      : "no-write";
  const externalScope =
    envelope.externalEffectBoundary.mode === "bounded"
      ? `bounded (${envelope.externalEffectBoundary.scope})`
      : "denied";
  const beadsIssueGrants = envelope.resourceGrants?.beadsIssueIds?.join(", ") || "none";
  const trackerCheckpoint = trackerCheckpointForRole(receipt.roleId, envelope.effectClass);
  const technicalCapabilityBoundary =
    envelope.mutationBoundary.mode === "no-write"
      ? "Technical capability boundary: this no-write lease is a behavioral obligation, not a guaranteed provider sandbox. Paseo pins a provider no-write mode only where the transport supports one; the primary role transports run under the Human's explicit full runtime access. Either way, write no workspace file and do not request or perform a mode change or permission escalation; launch still fails closed where the transport cannot bind the no-write instruction channel."
      : "Technical capability boundary: the bounded-write scope above is a behavioral obligation under the Human's explicit full runtime access, not a provider-enforced filesystem sandbox. Keep every write inside that exact scope and do not expand it or the external-effect lease.";
  const supervisorDelegationBoundary =
    receipt.roleId === "supervisor" && envelope.effectClass === "delegation"
      ? "Human-issued topology lease: staffing your own direct role-bound Lead children is explicitly authorized for this assignment. You may create and prompt only those Leads through Paseo. This exception does not make you a super-Lead: each Lead owns its project engineering and may delegate only to its own Peers; do not bypass a Lead to direct its Peers."
      : null;
  const supervisorNotebookBoundary =
    receipt.roleId === "supervisor" &&
    envelope.effectClass === "delegation" &&
    envelope.mutationBoundary.mode === "bounded-write"
      ? `Notebook write scope: your only permitted workspace write is creating and updating ${envelope.mutationBoundary.scope}. Write no other file, directory, or project artifact, and do not delegate this write.`
      : null;
  return [
    `Assignment Contract: sha256=${receipt.assignmentDigest}; disposition=${envelope.disposition}; effect=${envelope.effectClass}.`,
    `Objective: ${envelope.objective}`,
    `Mutation boundary: ${writeScope}. External effects: ${externalScope}.`,
    technicalCapabilityBoundary,
    supervisorDelegationBoundary,
    supervisorNotebookBoundary,
    `Beads issue grants: ${beadsIssueGrants}.`,
    trackerCheckpoint,
    `Evidence: ${envelope.evidence}`,
    `Handback/stop: ${envelope.handbackAndStop}`,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}
