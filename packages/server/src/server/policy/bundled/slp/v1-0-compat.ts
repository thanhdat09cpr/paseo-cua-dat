import { createHash } from "node:crypto";
import type {
  AssignmentEffectClass,
  AssignmentEnvelope,
} from "@getpaseo/protocol/assignment-contract";
import {
  assignmentExternalEffectBoundaryFor,
  isAssignmentEffectAllowedForRole,
} from "@getpaseo/protocol/assignment-contract";
import {
  CouncilSeatRoleSchema,
  type CouncilSeatRole,
  type CouncilTier,
} from "@getpaseo/protocol/council/types";
import type { LeadHandoffTransition } from "@getpaseo/protocol/lead-handoff";
import {
  PASEO_ROLE_IDS,
  type PaseoRoleId,
  type RoleProfileBindingReceipt,
  type WorkspaceProtocolBindingReceipt,
} from "@getpaseo/protocol/role-binding";
import {
  RoleProfileCatalogSchema,
  RoleProfilePreferencesMapSchema,
  RoleProfilePreferencesSchema,
  type RoleProfileCatalog,
  type RoleProfilePreferences,
  type RoleProfilePreferencesMap,
} from "@getpaseo/protocol/role-profile";
import { z } from "zod";

import type {
  FoundationExecutionProfileDefinition,
  FoundationExecutionProfileId,
} from "./execution-profiles.js";
import type { FoundationRoleDefinition } from "./role-definitions.js";
import { SLP_V1_0_ARTIFACT_BYTES } from "./v1-0-frozen-artifact.js";
import type {
  RoleBindingInstructionCompositionInput,
  RoleBindingPolicyContribution,
} from "../../role-binding-policy.js";
import {
  ASSIGNMENT_CONTRACT_INVALID_ERROR,
  preflightAssignmentEnvelope,
  type PersistedAssignmentContract,
} from "../../../agent/assignment-contract.js";

/**
 * COMPAT(slp45PinnedGeneration): exact policy/profile data used to construct the
 * 0.6.0-paseo.45 SLP 1.0.0 artifact. Keep frozen until persisted .45 bindings
 * are outside the supported resume window.
 */
export const SLP_V1_0_POLICY_VERSION = "1.0.0";
export const SLP_V1_0_GENERATION_DIGEST =
  "569c7f4633b7ffacb2e63c0ee3dda1ea882bc050bc456fdc8ac0c466f4f483f0";
export const SLP_V1_0_COORDINATION_POLICY_VERSION = "1";

interface FrozenSlpV10Artifact {
  roles: FoundationRoleDefinition[];
  executionProfiles: FoundationExecutionProfileDefinition[];
  roleToolCeilings: Record<PaseoRoleId, string[]>;
  roleDefaultTools: Record<PaseoRoleId, string[]>;
  skills: { roles: Record<PaseoRoleId, string[]> };
}

let parsedFrozenSlpV10Artifact: FrozenSlpV10Artifact | undefined;

export function parseFrozenSlpV10ArtifactBytes(bytes: string): FrozenSlpV10Artifact {
  const parsed = JSON.parse(bytes) as Partial<FrozenSlpV10Artifact>;
  if (
    !parsed ||
    !Array.isArray(parsed.roles) ||
    !Array.isArray(parsed.executionProfiles) ||
    !parsed.roleToolCeilings ||
    !parsed.roleDefaultTools ||
    !parsed.skills?.roles
  ) {
    throw new Error("slp_45_frozen_artifact_invalid_shape");
  }
  return parsed as FrozenSlpV10Artifact;
}

function frozenSlpV10Artifact(): FrozenSlpV10Artifact {
  parsedFrozenSlpV10Artifact ??= parseFrozenSlpV10ArtifactBytes(SLP_V1_0_ARTIFACT_BYTES);
  return parsedFrozenSlpV10Artifact;
}

function frozenSlpV10Roles(): Record<PaseoRoleId, FoundationRoleDefinition> {
  return Object.fromEntries(
    frozenSlpV10Artifact().roles.map((definition) => [definition.id, Object.freeze(definition)]),
  ) as Record<PaseoRoleId, FoundationRoleDefinition>;
}

function frozenSlpV10ExecutionProfiles(): Record<
  FoundationExecutionProfileId,
  FoundationExecutionProfileDefinition
> {
  return Object.fromEntries(
    frozenSlpV10Artifact().executionProfiles.map((definition) => [
      definition.id,
      Object.freeze(definition),
    ]),
  ) as Record<FoundationExecutionProfileId, FoundationExecutionProfileDefinition>;
}

function getFrozenSlpV10RoleDefinition(roleId: PaseoRoleId): FoundationRoleDefinition {
  return frozenSlpV10Roles()[roleId];
}

function getFrozenSlpV10ExecutionProfile(
  profileId: FoundationExecutionProfileId,
): FoundationExecutionProfileDefinition {
  return frozenSlpV10ExecutionProfiles()[profileId];
}

function freezeFrozenRoleToolMap(
  source: Record<PaseoRoleId, string[]>,
): Readonly<Record<PaseoRoleId, readonly string[]>> {
  return Object.freeze(
    Object.fromEntries(
      PASEO_ROLE_IDS.map((roleId) => [roleId, Object.freeze([...source[roleId]])]),
    ) as Record<PaseoRoleId, readonly string[]>,
  );
}

function frozenSlpV10RoleToolCeilings(): Readonly<Record<PaseoRoleId, readonly string[]>> {
  return freezeFrozenRoleToolMap(frozenSlpV10Artifact().roleToolCeilings);
}

function frozenSlpV10RoleDefaultTools(): Readonly<Record<PaseoRoleId, readonly string[]>> {
  return freezeFrozenRoleToolMap(frozenSlpV10Artifact().roleDefaultTools);
}

const MANDATORY_ROLE_TOOLS = ["beads_status", "beads_get", "beads_prime"] as const;
const MANDATORY_ROLE_SKILLS = ["beads-issue-tracker"] as const;
const PEER_MUTATING_BEADS_TOOLS = new Set([
  "beads_create",
  "beads_claim",
  "beads_update",
  "beads_add_dependency",
  "beads_close",
]);

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function roleSkillCeiling(roleId: PaseoRoleId): string[] {
  return [...frozenSlpV10Artifact().skills.roles[roleId]].sort();
}

function canonicalSelection(
  configured: readonly string[] | undefined,
  ceiling: readonly string[],
): string[] {
  if (!configured) return [...ceiling];
  const selected = new Set(configured);
  return ceiling.filter((entry) => selected.has(entry));
}

function assertSelectionWithinCeiling(input: {
  roleId: PaseoRoleId;
  kind: "tool" | "skill";
  selected: readonly string[];
  ceiling: readonly string[];
  mandatory: readonly string[];
}): void {
  const ceiling = new Set(input.ceiling);
  const unknown = input.selected.filter((entry) => !ceiling.has(entry));
  if (unknown.length > 0) {
    throw new Error(
      `Role profile '${input.roleId}' cannot enable ${input.kind}(s) outside the Foundation ceiling: ${unknown.join(", ")}`,
    );
  }
  const selected = new Set(input.selected);
  const missing = input.mandatory.filter((entry) => !selected.has(entry));
  if (missing.length > 0) {
    throw new Error(
      `Role profile '${input.roleId}' cannot disable mandatory ${input.kind}(s): ${missing.join(", ")}`,
    );
  }
}

function materializeSlpV10RoleProfile(
  roleId: PaseoRoleId,
  input: RoleProfilePreferences | undefined,
  assignmentEffectClass?: AssignmentEffectClass,
): RoleProfileBindingReceipt {
  const preferences = RoleProfilePreferencesSchema.parse(input ?? {});
  const toolCeiling = frozenSlpV10RoleToolCeilings()[roleId];
  const skillCeiling = roleSkillCeiling(roleId);
  const selectedTools = canonicalSelection(
    preferences.allowedTools,
    frozenSlpV10RoleDefaultTools()[roleId],
  );
  const allowedTools =
    roleId === "peer" && assignmentEffectClass === "read-only"
      ? selectedTools.filter((tool) => !PEER_MUTATING_BEADS_TOOLS.has(tool))
      : selectedTools;
  const allowedSkills = canonicalSelection(preferences.allowedSkills, skillCeiling);
  assertSelectionWithinCeiling({
    roleId,
    kind: "tool",
    selected: preferences.allowedTools ?? allowedTools,
    ceiling: toolCeiling,
    mandatory: MANDATORY_ROLE_TOOLS,
  });
  assertSelectionWithinCeiling({
    roleId,
    kind: "skill",
    selected: preferences.allowedSkills ?? allowedSkills,
    ceiling: skillCeiling,
    mandatory: MANDATORY_ROLE_SKILLS,
  });
  const defaults = preferences.defaults ?? {};
  return {
    schemaVersion: 1,
    profileDigest: sha256(
      JSON.stringify({ schemaVersion: 1, roleId, defaults, allowedTools, allowedSkills }),
    ),
    defaults,
    allowedTools,
    allowedSkills,
  };
}

export function buildSlpV10RoleProfileCatalog(
  input: RoleProfilePreferencesMap,
): RoleProfileCatalog {
  const preferences = RoleProfilePreferencesMapSchema.parse(input);
  for (const roleId of PASEO_ROLE_IDS) {
    if (preferences[roleId]) materializeSlpV10RoleProfile(roleId, preferences[roleId]);
  }
  return RoleProfileCatalogSchema.parse({
    profiles: PASEO_ROLE_IDS.map((roleId) => {
      const definition = getFrozenSlpV10RoleDefinition(roleId);
      const rolePreferences = preferences[roleId] ?? {};
      return {
        roleId,
        label: definition.label,
        description: definition.description,
        definitionVersion: definition.version,
        definitionDigest: sha256(definition.instructions),
        instructions: definition.instructions,
        toolCeiling: [...frozenSlpV10RoleToolCeilings()[roleId]],
        mandatoryTools: [...MANDATORY_ROLE_TOOLS],
        skillCeiling: roleSkillCeiling(roleId),
        mandatorySkills: [...MANDATORY_ROLE_SKILLS],
        preferences: rolePreferences,
        effective: materializeSlpV10RoleProfile(roleId, rolePreferences),
      };
    }),
  });
}

const FrozenSlpV10ExecutionProfileIdSchema = z.enum(["review", "solution-architect", "reviewer"]);

function parseFrozenSlpV10ExecutionProfileId(value: unknown): FoundationExecutionProfileId {
  return FrozenSlpV10ExecutionProfileIdSchema.parse(value);
}

function frozenExecutionProfileDefinitionDigest(
  profile: FoundationExecutionProfileDefinition,
): string {
  return sha256(JSON.stringify(profile));
}

export const SLP_V1_0_EXECUTION_PROFILE_POLICY = {
  inputDescription:
    "Lead-only Peer execution specialization. solution-architect frames architecture; reviewer performs a focused review method; review is the private OCR exhaustive-review route.",
  parseId: parseFrozenSlpV10ExecutionProfileId,
  resolveCreateRequest(input: {
    value: unknown;
    callerRoleId: string | undefined;
    requestedRole: unknown;
  }): FoundationExecutionProfileId {
    const profileId = parseFrozenSlpV10ExecutionProfileId(input.value);
    if (input.callerRoleId !== "lead") {
      throw new Error("Only a role-bound Lead can create an execution-specialized Peer");
    }
    const profile = getFrozenSlpV10ExecutionProfile(profileId);
    if (input.requestedRole !== profile.authorityRoleId) {
      throw new Error(
        `Execution profile '${profile.id}' requires role '${profile.authorityRoleId}'`,
      );
    }
    return profileId;
  },
  resolvePeerSubrole(input: {
    executionProfile?: unknown;
    assignmentDisposition?: string;
  }): "architect" | "reviewer" | undefined {
    if (input.executionProfile !== undefined) {
      const profileId = parseFrozenSlpV10ExecutionProfileId(input.executionProfile);
      if (profileId === "solution-architect") return "architect";
      return "reviewer";
    }
    return input.assignmentDisposition === "independent-review" ? "reviewer" : undefined;
  },
};

function frozenWorkspaceProtocolReadership(
  roleId: PaseoRoleId,
): WorkspaceProtocolBindingReceipt["readership"] {
  return getFrozenSlpV10RoleDefinition(roleId).protocolReadership;
}

function validateFrozenRoleDisposition(roleId: PaseoRoleId, envelope: AssignmentEnvelope): void {
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

function preflightFrozenSlpV10AssignmentEnvelope(input: {
  roleId: PaseoRoleId;
  envelope: AssignmentEnvelope | undefined;
  createdAt?: Date;
}): AssignmentEnvelope {
  const envelope = preflightAssignmentEnvelope(input);
  validateFrozenRoleDisposition(input.roleId, envelope);
  const noWriteEffects = new Set<AssignmentEnvelope["effectClass"]>(["read-only", "delegation"]);
  if (noWriteEffects.has(envelope.effectClass) && envelope.mutationBoundary.mode !== "no-write") {
    throw new Error(
      `${ASSIGNMENT_CONTRACT_INVALID_ERROR}: ${envelope.effectClass} requires no-write`,
    );
  }
  if (envelope.effectClass === "mutating" && envelope.mutationBoundary.mode !== "bounded-write") {
    throw new Error(`${ASSIGNMENT_CONTRACT_INVALID_ERROR}: mutating requires bounded-write`);
  }
  const requiredExternalMode = assignmentExternalEffectBoundaryFor(
    input.roleId,
    envelope.effectClass,
  ).mode;
  if (requiredExternalMode === "denied" && envelope.externalEffectBoundary.mode !== "denied") {
    throw new Error(
      `${ASSIGNMENT_CONTRACT_INVALID_ERROR}: ${input.roleId} ${envelope.effectClass} requires external effects denied`,
    );
  }
  if (
    input.roleId === "peer" &&
    envelope.effectClass === "mutating" &&
    !envelope.resourceGrants?.beadsIssueIds?.length
  ) {
    throw new Error(
      `${ASSIGNMENT_CONTRACT_INVALID_ERROR}: mutating Peer requires an exact Beads issue grant`,
    );
  }
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

function frozenTrackerCheckpointForRole(
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
  return `Mandatory Beads Central checkpoint: call beads_status and read the relevant issue graph at supervision start and material handoff when Central is available. ${receiptRule} Remain read-only. If Central is unavailable, continue only the no-write inspection, report issue state UNKNOWN, and do not use native bd or another tracker.`;
}

function buildFrozenSlpV10AssignmentInstruction(contract: PersistedAssignmentContract): string {
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
  const trackerCheckpoint = frozenTrackerCheckpointForRole(receipt.roleId, envelope.effectClass);
  const technicalCapabilityBoundary =
    envelope.mutationBoundary.mode === "no-write"
      ? "Technical capability boundary: Paseo pins this session to a provider-enforced no-write mode. Do not request or attempt a mode change or permission escalation; launch must fail closed when the provider cannot enforce no-write."
      : "Technical capability boundary: runtime capability does not expand the exact bounded-write scope or external-effect lease above.";
  const supervisorDelegationBoundary =
    receipt.roleId === "supervisor" && envelope.effectClass === "delegation"
      ? "Human-issued topology lease: you may create and prompt only your own direct role-bound Lead children through Paseo. Those Leads own their project engineering and may delegate only to their own Peers; do not bypass a Lead to direct its Peers."
      : null;
  return [
    `Assignment Contract: sha256=${receipt.assignmentDigest}; disposition=${envelope.disposition}; effect=${envelope.effectClass}.`,
    `Objective: ${envelope.objective}`,
    `Mutation boundary: ${writeScope}. External effects: ${externalScope}.`,
    technicalCapabilityBoundary,
    supervisorDelegationBoundary,
    `Beads issue grants: ${beadsIssueGrants}.`,
    trackerCheckpoint,
    `Evidence: ${envelope.evidence}`,
    `Handback/stop: ${envelope.handbackAndStop}`,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}

function buildFrozenProtocolInstruction(
  receipt: WorkspaceProtocolBindingReceipt,
  hasProtocolException: boolean,
): string {
  if (receipt.status === "missing") {
    if (!hasProtocolException) {
      return `Workspace Protocol binding: not yet bootstrapped at ${receipt.path}. This assignment was admitted because it declares no write scope and no external effects. Treat the repository's coordination tactics as unknown rather than absent, stay non-mutating, and report that the protocol still needs bootstrapping at handback. Any write scope or external effect requires a bound protocol or an exact Human exception first.`;
    }
    if (receipt.readership === "assignment-only") {
      return `Workspace Protocol binding: temporarily missing under an exact Human bootstrap exception at ${receipt.path}. Do not load that path; remain inside the read-only/bootstrap assignment and stop at its expiry.`;
    }
    if (receipt.readership === "governance-only") {
      return `Workspace Protocol binding: temporarily missing under an exact Human governance exception at ${receipt.path}. Create, audit, or update it only inside that bounded mandate and stop at its expiry.`;
    }
    return `Workspace Protocol binding: temporarily missing under an exact Human bootstrap exception at ${receipt.path}. Bootstrap only the bounded governance artifact and stop at the assignment expiry.`;
  }
  if (receipt.readership === "assignment-only") {
    return `Workspace Protocol binding: assignment-only. Do not load ${receipt.path}; receive only relevant constraints in the Lead assignment.`;
  }
  if (receipt.readership === "governance-only") {
    return `Workspace Protocol binding: governance-only at ${receipt.path}. Read it only when the exact Human mandate requires protocol create/audit/update. Bound status: ${receipt.status}${receipt.digest ? `; sha256=${receipt.digest}` : ""}.`;
  }
  return `Workspace Protocol binding: full-read required at ${receipt.path}; sha256=${receipt.digest}. Read the exact current file before orchestration. If current bytes no longer match this digest, stop and request a fresh binding instead of relying on stale protocol state.`;
}

function buildFrozenBeadsSkillAdmissionInstruction(
  roleId: PaseoRoleId,
  roleProfile: RoleProfileBindingReceipt,
): string {
  if (
    !roleSkillCeiling(roleId).includes("beads-issue-tracker") ||
    !roleProfile.allowedSkills.includes("beads-issue-tracker")
  ) {
    throw new Error(
      "foundation_skill_admission_required: beads-issue-tracker is not bound for this role",
    );
  }
  return "Role skill admission: `beads-issue-tracker` is active from the immutable Foundation bundle. Its assignment-start checkpoint, mutation boundary, and handback rule are projected in the Assignment Contract above; do not search for or load a second copy.";
}

function composeFrozenSlpV10Instructions(input: RoleBindingInstructionCompositionInput): string {
  return [
    input.definition.instructions,
    input.executionProfile?.instructions,
    buildFrozenProtocolInstruction(input.workspaceProtocol, input.hasProtocolException),
    buildFrozenSlpV10AssignmentInstruction(input.assignmentContract),
    buildFrozenBeadsSkillAdmissionInstruction(input.definition.id, input.roleProfile),
  ]
    .filter((part): part is string => Boolean(part))
    .join("\n\n");
}

export const SLP_V1_0_ROLE_BINDING_POLICY: RoleBindingPolicyContribution<FoundationExecutionProfileId> =
  {
    getRoleDefinition: getFrozenSlpV10RoleDefinition,
    getExecutionProfile: getFrozenSlpV10ExecutionProfile,
    executionProfileDefinitionDigest: frozenExecutionProfileDefinitionDigest,
    materializeRoleProfile: (roleId, preferences, assignmentEffectClass) =>
      materializeSlpV10RoleProfile(roleId, preferences, assignmentEffectClass),
    workspaceProtocolReadership: frozenWorkspaceProtocolReadership,
    composeInstructions: composeFrozenSlpV10Instructions,
    preflight(input): AssignmentEnvelope {
      const envelope = preflightFrozenSlpV10AssignmentEnvelope({
        roleId: input.roleId,
        envelope: input.assignment,
        createdAt: input.createdAt,
      });
      if (input.executionProfileId) {
        const executionProfile = getFrozenSlpV10ExecutionProfile(input.executionProfileId);
        if (executionProfile.authorityRoleId !== input.roleId) {
          throw new Error(
            `Execution profile '${executionProfile.id}' requires role '${executionProfile.authorityRoleId}'`,
          );
        }
      }
      return envelope;
    },
  };

function frozenCouncilReportSentinels(role: CouncilSeatRole): {
  startSentinel: string;
  endSentinel: string;
} {
  const prefix = role.toUpperCase();
  return {
    startSentinel: `${prefix}_COUNCIL_REPORT_V1`,
    endSentinel: `${prefix}_COUNCIL_REPORT_END`,
  };
}

function validateFrozenCouncilSeatRoles(roles: readonly CouncilSeatRole[]): CouncilSeatRole[] {
  const validated = CouncilSeatRoleSchema.array().parse(roles);
  if (new Set(validated).size !== validated.length) {
    throw new Error("Council seat roles must be unique");
  }
  return validated;
}

function buildFrozenCouncilKickoffBody(input: {
  caseId: string;
  title: string;
  question: string;
  tier: CouncilTier;
  roles: readonly CouncilSeatRole[];
}): string {
  return [
    `Council ${input.caseId}: ${input.title}`,
    `Question: ${input.question}`,
    `Tier: ${input.tier}. Sealed seats: ${input.roles.join(", ")}.`,
    "Each seat must report independently in this Room before the Lead records integrity.",
  ].join("\n");
}

function buildFrozenCouncilSeatPlans(input: {
  caseId: string;
  title: string;
  tier: CouncilTier;
  roomId: string;
  kickoffMessageId: string;
  roles: readonly CouncilSeatRole[];
}) {
  return input.roles.map((role) => {
    let executionProfile: FoundationExecutionProfileId | undefined;
    if (role === "architect") executionProfile = "solution-architect";
    if (role === "reviewer") executionProfile = "reviewer";
    const { startSentinel: reportStartSentinel, endSentinel: reportEndSentinel } =
      frozenCouncilReportSentinels(role);
    return {
      role,
      peerSubrole: role,
      ...(executionProfile ? { executionProfile } : {}),
      reportStartSentinel,
      reportEndSentinel,
      labels: {
        "council.case_id": input.caseId,
        "council.title": input.title,
        "council.tier": input.tier,
        "council.phase": "sealed",
        "council.role": role,
        "council.round": "1",
        "council.integrity": "unspecified",
        "council.room_id": input.roomId,
        "council.kickoff_message_id": input.kickoffMessageId,
        "council.report_start_sentinel": reportStartSentinel,
        "council.report_end_sentinel": reportEndSentinel,
      },
    };
  });
}

export const SLP_V1_0_COUNCIL_POLICY = {
  reportSentinels: frozenCouncilReportSentinels,
  validateSeatRoles: validateFrozenCouncilSeatRoles,
  buildKickoffBody: buildFrozenCouncilKickoffBody,
  assertKickoffBody(input: { body: string; caseId: string }): void {
    if (!input.body.includes(`Council ${input.caseId}:`)) {
      throw new Error(
        `Council '${input.caseId}' kickoff body does not match the pinned SLP policy`,
      );
    }
  },
  buildSeatPlans: buildFrozenCouncilSeatPlans,
};

function assertFrozenPrepareLeadHandoffAuthority(input: {
  callerAgentId: string | undefined;
  callerRoleId: PaseoRoleId | undefined;
}): string {
  if (!input.callerAgentId) {
    throw new Error("prepare_lead_handoff requires an agent-scoped predecessor Lead");
  }
  if (input.callerRoleId !== "lead") {
    throw new Error("prepare_lead_handoff requires a role-bound predecessor Lead");
  }
  return input.callerAgentId;
}

function assertFrozenLeadHandoffTransitionAuthority(input: {
  callerAgentId: string | undefined;
  transition: LeadHandoffTransition;
}): void {
  if (
    input.callerAgentId &&
    input.transition !== "successor_acknowledged" &&
    input.transition !== "rejected"
  ) {
    throw new Error("Only a Human-facing caller can authorize or release a Lead handoff");
  }
}

function assertFrozenSignalAgentAuthority(input: {
  targetAgentId: string;
  targetRoleId: PaseoRoleId | undefined;
  callerRoleId: PaseoRoleId | undefined;
  callerAgentId: string | undefined;
  kind: "handoff_recommended" | "detach_recommended";
  relatedAgentId: string | undefined;
}): void {
  if (input.targetRoleId !== "lead") {
    throw new Error(
      `Coordination signals require a role-bound Lead target; ${input.targetAgentId} is not one`,
    );
  }
  if (input.kind === "detach_recommended" && !input.relatedAgentId) {
    throw new Error("detach_recommended requires relatedAgentId");
  }
  if (input.callerAgentId && input.callerRoleId !== "lead" && input.callerRoleId !== "supervisor") {
    throw new Error("Only a role-bound Lead or Supervisor can signal another Lead");
  }
}

function assertFrozenResolveAgentSignalAuthority(input: {
  callerAgentId: string | undefined;
  requestedAgentId: string | undefined;
}): string {
  const targetAgentId = input.callerAgentId ?? input.requestedAgentId;
  if (!targetAgentId) {
    throw new Error("agentId is required outside an agent-scoped session");
  }
  if (
    input.callerAgentId &&
    input.requestedAgentId &&
    input.requestedAgentId !== input.callerAgentId
  ) {
    throw new Error("An agent may resolve only its own coordination signals");
  }
  return targetAgentId;
}

export const SLP_V1_0_COORDINATION_POLICY = {
  supportsAttentionQuestions: false as const,
  descriptions: {
    prepareLeadHandoff:
      "Persist an immutable adjacent-Lead handoff packet. The predecessor remains write Owner; this does not authorize or release either Lead.",
    transitionLeadHandoff:
      "Record explicit Human authorization/release or the designated successor's acknowledgement/rejection. Final release requires an idle predecessor, closes its runtime while retaining the durable record, transfers current write ownership, and blocks later predecessor prompts without detaching, archiving, or changing role binding.",
    signalAgent:
      "Send a durable advisory handoff or detach recommendation to a role-bound Lead. Delivery waits for an idle boundary and never replaces an active run.",
    askAttentionQuestion: "Unavailable for agents pinned to the 0.6.0-paseo.45 SLP generation.",
    resolveAgentSignal:
      "Record the receiving role's autonomous disposition of a coordination signal. This does not report to or transfer authority to the sender.",
  },
  assertPrepareLeadHandoffAuthority: assertFrozenPrepareLeadHandoffAuthority,
  assertLeadHandoffTransitionAuthority: assertFrozenLeadHandoffTransitionAuthority,
  assertSignalAgentAuthority: assertFrozenSignalAgentAuthority,
  assertAttentionQuestionAuthority(_input: {
    targetAgentId: string;
    targetRoleId: PaseoRoleId | undefined;
    callerRoleId: PaseoRoleId | undefined;
    callerAgentId: string | undefined;
    callerWorkspaceId: string | undefined;
    targetWorkspaceId: string | undefined;
    observation: string;
    question: string;
    evidenceRefs: readonly string[];
  }): never {
    throw new Error("attention_questions_unavailable_for_pinned_generation");
  },
  attentionQuestionCoalescingKey(_input: {
    requester: { kind: "human" } | { kind: "agent"; agentId: string };
    targetAgentId: string;
    observation: string;
    question: string;
  }): never {
    throw new Error("attention_questions_unavailable_for_pinned_generation");
  },
  assertResolveAgentSignalAuthority: assertFrozenResolveAgentSignalAuthority,
};
