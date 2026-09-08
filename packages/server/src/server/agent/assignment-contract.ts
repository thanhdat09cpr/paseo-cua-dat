import { createHash } from "node:crypto";
import {
  AssignmentContractReceiptSchema,
  AssignmentEnvelopeSchema,
  PASEO_ASSIGNMENT_CONTRACT_VERSION,
  supervisorNotebookScopeForCwd,
  type AssignmentAssignerReceipt,
  type AssignmentContractReceipt,
  type AssignmentEnvelope,
} from "@getpaseo/protocol/assignment-contract";
import type { PaseoRoleId } from "@getpaseo/protocol/role-binding";
import { z } from "zod";

export const ASSIGNMENT_CONTRACT_REQUIRED_ERROR = "assignment_contract_required";
export const ASSIGNMENT_CONTRACT_INVALID_ERROR = "assignment_contract_invalid";

export const PersistedAssignmentContractSchema = z.object({
  receipt: AssignmentContractReceiptSchema,
  envelope: AssignmentEnvelopeSchema,
});
export type PersistedAssignmentContract = z.infer<typeof PersistedAssignmentContractSchema>;

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function requireFuture(iso: string | undefined, now: Date, field: string): void {
  if (iso !== undefined && Date.parse(iso) <= now.getTime()) {
    throw new Error(`${ASSIGNMENT_CONTRACT_INVALID_ERROR}: ${field} must be in the future`);
  }
}

function validateProtocolException(
  envelope: AssignmentEnvelope,
  assigner: AssignmentAssignerReceipt,
  cwd: string,
  now: Date,
): void {
  const exception = envelope.protocolException;
  if (!exception) return;
  if (assigner.kind !== "human-session") {
    throw new Error(
      `${ASSIGNMENT_CONTRACT_INVALID_ERROR}: protocol exception requires Human session issuer`,
    );
  }
  if (exception.scope !== cwd) {
    throw new Error(
      `${ASSIGNMENT_CONTRACT_INVALID_ERROR}: protocol exception scope must equal assignment cwd`,
    );
  }
  requireFuture(exception.expiresAt, now, "protocolException.expiresAt");
}

/**
 * A bounded-write delegation lease is the narrow Supervisor-notebook contract.
 * Trace the actual side effect and authorize it at the earliest trusted point:
 * only a Human-session issuer may grant it, only role Supervisor may hold it,
 * and the scope must equal exactly the notebook file in this assignment cwd.
 * Any general directory, traversal, outside-cwd, or agent-issued scope fails.
 */
function validateDelegationWriteScope(
  roleId: PaseoRoleId,
  envelope: AssignmentEnvelope,
  assigner: AssignmentAssignerReceipt,
  cwd: string,
): void {
  if (envelope.effectClass !== "delegation" || envelope.mutationBoundary.mode !== "bounded-write") {
    return;
  }
  if (roleId !== "supervisor") {
    throw new Error(
      `${ASSIGNMENT_CONTRACT_INVALID_ERROR}: bounded-write delegation is limited to a Supervisor notebook`,
    );
  }
  if (assigner.kind !== "human-session") {
    throw new Error(
      `${ASSIGNMENT_CONTRACT_INVALID_ERROR}: Supervisor notebook write requires a Human session issuer`,
    );
  }
  const expected = supervisorNotebookScopeForCwd(cwd);
  if (envelope.mutationBoundary.scope !== expected) {
    throw new Error(
      `${ASSIGNMENT_CONTRACT_INVALID_ERROR}: Supervisor notebook scope must equal ${expected}`,
    );
  }
}

/**
 * The lead-workspace grant lets a Human-launched Supervisor staff a Lead into an
 * exact existing workspace outside its own control cwd, so the separate-Supervisor
 * topology can reach the product workspace. It is authority, not a filesystem
 * write grant, and does not widen external effects. Only a Human-session issuer
 * holding a Supervisor delegation lease may carry it; target existence is resolved
 * through normal workspace resolution at child creation.
 */
function validateLeadWorkspaceGrant(
  roleId: PaseoRoleId,
  envelope: AssignmentEnvelope,
  assigner: AssignmentAssignerReceipt,
): void {
  if (!envelope.resourceGrants?.leadWorkspaceIds?.length) {
    return;
  }
  if (roleId !== "supervisor" || envelope.effectClass !== "delegation") {
    throw new Error(
      `${ASSIGNMENT_CONTRACT_INVALID_ERROR}: lead-workspace grant is limited to a Supervisor delegation lease`,
    );
  }
  if (assigner.kind !== "human-session") {
    throw new Error(
      `${ASSIGNMENT_CONTRACT_INVALID_ERROR}: lead-workspace grant requires a Human session issuer`,
    );
  }
}

function canonicalAssignmentBytes(input: {
  roleId: PaseoRoleId;
  assigner: AssignmentAssignerReceipt;
  workspaceId: string;
  cwd: string;
  envelope: AssignmentEnvelope;
  createdAt: string;
}): string {
  return JSON.stringify({
    version: PASEO_ASSIGNMENT_CONTRACT_VERSION,
    roleId: input.roleId,
    assigner: input.assigner,
    workspaceId: input.workspaceId,
    cwd: input.cwd,
    envelope: input.envelope,
    createdAt: input.createdAt,
  });
}

export function materializeAssignmentContract(input: {
  roleId: PaseoRoleId;
  assigner: AssignmentAssignerReceipt;
  workspaceId: string;
  cwd: string;
  envelope: AssignmentEnvelope | undefined;
  createdAt?: Date;
}): PersistedAssignmentContract {
  const now = input.createdAt ?? new Date();
  const envelope = preflightAssignmentEnvelope({
    roleId: input.roleId,
    envelope: input.envelope,
    createdAt: now,
  });
  validateProtocolException(envelope, input.assigner, input.cwd, now);
  validateDelegationWriteScope(input.roleId, envelope, input.assigner, input.cwd);
  validateLeadWorkspaceGrant(input.roleId, envelope, input.assigner);

  const createdAt = now.toISOString();
  const receipt: AssignmentContractReceipt = {
    version: PASEO_ASSIGNMENT_CONTRACT_VERSION,
    assignmentDigest: sha256(
      canonicalAssignmentBytes({
        roleId: input.roleId,
        assigner: input.assigner,
        workspaceId: input.workspaceId,
        cwd: input.cwd,
        envelope,
        createdAt,
      }),
    ),
    roleId: input.roleId,
    disposition: envelope.disposition,
    assigner: input.assigner,
    workspaceId: input.workspaceId,
    cwd: input.cwd,
    effectClass: envelope.effectClass,
    mutationBoundary: envelope.mutationBoundary,
    externalEffectBoundary: envelope.externalEffectBoundary,
    ...(envelope.resourceGrants ? { resourceGrants: envelope.resourceGrants } : {}),
    ...(envelope.protocolException
      ? { protocolExceptionExpiresAt: envelope.protocolException.expiresAt }
      : {}),
    createdAt,
    ...(envelope.expiresAt ? { expiresAt: envelope.expiresAt } : {}),
  };
  return PersistedAssignmentContractSchema.parse({ receipt, envelope });
}

/** Pure admission used before any workspace, worktree, provider, or storage side effect. */
export function preflightAssignmentEnvelope(input: {
  roleId: PaseoRoleId;
  envelope: AssignmentEnvelope | undefined;
  createdAt?: Date;
}): AssignmentEnvelope {
  if (!input.envelope) {
    throw new Error(ASSIGNMENT_CONTRACT_REQUIRED_ERROR);
  }
  const envelope = AssignmentEnvelopeSchema.parse(input.envelope);
  const now = input.createdAt ?? new Date();
  requireFuture(envelope.protocolException?.expiresAt, now, "protocolException.expiresAt");
  requireFuture(envelope.expiresAt, now, "expiresAt");
  return envelope;
}
