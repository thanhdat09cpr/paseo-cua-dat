import type {
  PaseoRoleId,
  RoleProfileBindingReceipt,
  WorkspaceProtocolBindingReceipt,
} from "@getpaseo/protocol/role-binding";
import { composeRoleInstructionBase } from "@getpaseo/protocol/role-profile";

import {
  buildSlpAssignmentInstruction,
  preflightSlpAssignmentEnvelope,
} from "./assignment-policy.js";
import {
  foundationExecutionProfileDefinitionDigest,
  getFoundationExecutionProfileDefinition,
  type FoundationExecutionProfileId,
} from "./execution-profiles.js";
import { getFoundationRoleDefinition } from "./role-definitions.js";
import { materializeRoleProfileBindingReceipt } from "./role-profiles.js";
import { loadFoundationSkillPolicy } from "./skill-policy.js";
import type {
  RoleBindingInstructionCompositionInput,
  RoleBindingPolicyContribution,
} from "../../role-binding-policy.js";

function workspaceProtocolReadership(
  roleId: PaseoRoleId,
): WorkspaceProtocolBindingReceipt["readership"] {
  return getFoundationRoleDefinition(roleId).protocolReadership;
}

function buildProtocolInstruction(
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
    return `Workspace Protocol binding: governance-only at ${
      receipt.path
    }. Read it only when the exact Human mandate requires protocol create/audit/update. Bound status: ${
      receipt.status
    }${receipt.digest ? `; sha256=${receipt.digest}` : ""}.`;
  }
  return `Workspace Protocol binding: full-read required at ${receipt.path}; sha256=${receipt.digest}. Read the exact current file before orchestration. If current bytes no longer match this digest, stop and request a fresh binding instead of relying on stale protocol state.`;
}

function buildBeadsSkillAdmissionInstruction(
  roleId: PaseoRoleId,
  roleProfile: RoleProfileBindingReceipt,
): string {
  const policy = loadFoundationSkillPolicy(roleId);
  const skillPath = policy.skillPaths.get("beads-issue-tracker");
  if (
    policy.status !== "bound" ||
    !policy.enabledNames.has("beads-issue-tracker") ||
    !roleProfile.allowedSkills.includes("beads-issue-tracker") ||
    !skillPath
  ) {
    throw new Error(
      "foundation_skill_admission_required: beads-issue-tracker is not bound for this role",
    );
  }
  return "Role skill admission: `beads-issue-tracker` is active from the immutable Foundation bundle. Its assignment-start checkpoint, mutation boundary, and handback rule are projected in the Assignment Contract above; do not search for or load a second copy.";
}

function composeInstructions(input: RoleBindingInstructionCompositionInput): string {
  return [
    composeRoleInstructionBase(input.definition.instructions, input.customInstructions),
    input.executionProfile?.instructions,
    buildCoordinationGuidance(input.definition.id),
    buildProtocolInstruction(input.workspaceProtocol, input.hasProtocolException),
    buildSlpAssignmentInstruction(input.assignmentContract),
    buildBeadsSkillAdmissionInstruction(input.definition.id, input.roleProfile),
  ]
    .filter((part): part is string => Boolean(part))
    .join("\n\n");
}

function buildCoordinationGuidance(roleId: PaseoRoleId): string {
  const disposition =
    "Attention readback: distinguish observed activity, agent claims, verified evidence, and unknowns. Before resolving an attention signal, investigate the bounded evidence and record in the resolution note: decision (keep, check, reopen, or blocked), evidence references, next action, next owner if known, and remaining uncertainty. Resolution is one-shot: acknowledged or deferred cannot later become completed through the same signal. Use the existing work record for follow-up. Signal completion is not engineering acceptance; do not fabricate evidence or ownership.";
  if (roleId === "lead") {
    return `${disposition}\nLead method selection: choose a proportional method within the current assignment and Human lease without asking Human to name the method. Use direct work only where the role and assignment permit it; give material implementation ownership to a bounded Peer. For consequential open premises, consider independent design; for a stable consequential candidate, consider independent review. Do not require fan-out for every task. Preserve Human-frozen decisions and request Human input only for decisions or resources beyond authority. Treat Supervisor observations as hypotheses, including the possibility that no defect exists. Lead retains Peer coordination, integration, and engineering acceptance.`;
  }
  if (roleId === "supervisor") {
    return [
      disposition,
      "Supervisor attention: a Watcher or detector event is a suspicion and an immediate attention candidate for Supervisor assessment; do not wait for a Notebook entry or an end-of-day review before checking a meaningful issue. Assess before Notebook admission: verify the exact target, current assignment and context, and cited evidence from bounded publicly visible activity. Consider healthy progress or self-correction, an expected experiment, an infrastructure/tool/provider explanation, and counterevidence; then decide whether the evidence shows a material, unresolved coordination risk that needs Lead review. A lesson without an unresolved coordination risk goes to the Notebook or a requested retrospective without waking Lead. For that risk, when an admitted route to the exact current owning Lead is available, including a valid delegated cross-workspace route, ask a neutral, open-ended attention question through the admitted attention tool; carry concrete observations and evidence references, while Lead keeps Peer coordination. If current identity, delegation, or an admitted route cannot be verified, return a blocked handback with the evidence and do not bypass the policy. Resolve or hold false, ordinary, resolved, or unsupported signals quietly through the existing attention surfaces with a disposition. Watcher notifications are never blanket Notebook records; do not create a Notebook entry for the notification alone. Admit only an evidenced material coordination episode; a serious first occurrence is eligible, and initial causation may remain unknown. When the same episode or mechanism recurs, update its existing entry rather than creating a duplicate. Keep the assessment verdict, lesson, and correction approval as separate states.",
      "Supervisor Notebook: read only the scoped bounded visible activity and relevant unresolved Notebook summaries. A permitted entry records observation, evidence references, mechanism and certainty, counterevidence, impact, scope and owner, proposed correction, application state, and later-effect result; redact raw transcripts and secrets. Use the one-writer rule and write only through the exact Notebook path in the current assignment contract. If the assignment contract lacks an exact Notebook write path or is no-write, write no file; hand back the assessed episode or proposal with evidence and uncertainty for the authorized owner. Notebook ownership grants no product write, role, skill, recovery, replacement, or direct Peer authority.",
      "On a Human progress request, produce the ordinary progress report with the admitted get_agent_activity tool over the bounded session window, paging with returned cursors. Include healthy progress, claims versus verified proof, incomplete work, and partial or truncated coverage; do not prompt, signal, or wake workers only to make the report. Only when Human explicitly requests an end-of-day retrospective, run that review, including healthy decisions and counterexamples, distinguishing coordination findings from ordinary product bugs, and proposing only the smallest owner-scoped correction with a measurable check and rollback condition. Route the correction to the existing Lead or maintainer; Lead accepts it only within the existing lease, otherwise route the exact owner. Track proposed, authorized, applied, and later-effect states separately; never auto-promote a conclusion. Do not edit roles or skills, start a periodic watcher, or create a schedule.",
    ].join("\n");
  }
  return `${disposition}\nAttention handback: keep the disposition within your assignment and hand back coordination decisions to Lead. Resolving a signal does not grant orchestration authority or engineering acceptance.`;
}

export const SLP_ROLE_BINDING_POLICY: RoleBindingPolicyContribution<FoundationExecutionProfileId> =
  {
    getRoleDefinition: getFoundationRoleDefinition,
    getExecutionProfile: getFoundationExecutionProfileDefinition,
    executionProfileDefinitionDigest: foundationExecutionProfileDefinitionDigest,
    materializeRoleProfile: (roleId, preferences, assignmentEffectClass) =>
      materializeRoleProfileBindingReceipt(roleId, preferences, assignmentEffectClass),
    workspaceProtocolReadership,
    composeInstructions,
    preflight(input) {
      const envelope = preflightSlpAssignmentEnvelope({
        roleId: input.roleId,
        envelope: input.assignment,
        createdAt: input.createdAt,
      });
      if (input.executionProfileId) {
        const executionProfile = getFoundationExecutionProfileDefinition(input.executionProfileId);
        if (executionProfile.authorityRoleId !== input.roleId) {
          throw new Error(
            `Execution profile '${executionProfile.id}' requires role '${executionProfile.authorityRoleId}'`,
          );
        }
      }
      return envelope;
    },
  };
