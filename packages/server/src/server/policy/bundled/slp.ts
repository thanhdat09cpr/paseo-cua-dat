import { createHash } from "node:crypto";
import { PASEO_ASSIGNMENT_CONTRACT_VERSION } from "@getpaseo/protocol/assignment-contract";
import type { AssignmentEnvelope } from "@getpaseo/protocol/assignment-contract";
import { PASEO_ROLE_CONTRACT_VERSION, PASEO_ROLE_IDS } from "@getpaseo/protocol/role-binding";
import type { PolicyOwner } from "@getpaseo/protocol/policy-owner";
import type {
  RoleProfileCatalog,
  RoleProfilePreferencesMap,
} from "@getpaseo/protocol/role-profile";

import {
  FOUNDATION_EXECUTION_PROFILE_IDS,
  getFoundationExecutionProfileDefinition,
  SLP_EXECUTION_PROFILE_POLICY,
  SLP_EXECUTION_PROFILE_POLICY_VERSION,
} from "./slp/execution-profiles.js";
import { getFoundationRoleDefinition } from "./slp/role-definitions.js";
import {
  materializeRoleBindingWithPolicy,
  type MaterializeRoleBindingInput,
  type PersistedRoleBinding,
} from "../../agent/role-binding.js";
import {
  buildRoleProfileCatalog,
  ROLE_DEFAULT_TOOLS,
  ROLE_TOOL_CEILINGS,
} from "./slp/role-profiles.js";
import { buildFoundationSkillArtifactDescriptor } from "./slp/skill-policy.js";
import {
  BundledPolicyPackRegistry,
  type BundledPolicyPackGeneration,
} from "../bundled-policy-pack.js";
import { SLP_ROLE_BINDING_POLICY } from "./slp/role-binding-policy.js";
import { SLP_COUNCIL_POLICY, SLP_COUNCIL_POLICY_VERSION } from "./slp/council-policy.js";
import {
  SLP_COORDINATION_POLICY,
  SLP_COORDINATION_POLICY_VERSION,
} from "./slp/coordination-policy.js";
import {
  SLP_ATTENTION_EVENT_POLICY,
  SLP_ATTENTION_POLICY_VERSION,
} from "./slp/attention-policy.js";
import type { AgentEventPolicy } from "../../agent/event-policy-runtime.js";
import {
  buildSlpV10RoleProfileCatalog,
  SLP_V1_0_COUNCIL_POLICY,
  SLP_V1_0_COORDINATION_POLICY,
  SLP_V1_0_EXECUTION_PROFILE_POLICY,
  SLP_V1_0_GENERATION_DIGEST,
  SLP_V1_0_POLICY_VERSION,
  SLP_V1_0_ROLE_BINDING_POLICY,
  parseFrozenSlpV10ArtifactBytes,
} from "./slp/v1-0-compat.js";
import { SLP_V1_0_ARTIFACT_BYTES } from "./slp/v1-0-frozen-artifact.js";
import { SLP_V1_0_ATTENTION_EVENT_POLICY } from "./slp/v1-0-attention-policy.js";

export const SLP_BUNDLED_POLICY_VERSION = "1.1.0";

type PluginPolicyOwner = Extract<PolicyOwner, { kind: "plugin" }>;

const SLP_V1_0_POLICY_OWNER: PluginPolicyOwner = {
  kind: "plugin",
  pluginId: "slp",
  policyVersion: SLP_V1_0_POLICY_VERSION,
  generationDigest: SLP_V1_0_GENERATION_DIGEST,
};

export interface SlpBundledPolicyContribution {
  councilPolicy: typeof SLP_COUNCIL_POLICY | typeof SLP_V1_0_COUNCIL_POLICY;
  coordinationPolicy: typeof SLP_COORDINATION_POLICY | typeof SLP_V1_0_COORDINATION_POLICY;
  eventPolicies: readonly AgentEventPolicy[];
  executionProfilePolicy:
    | typeof SLP_EXECUTION_PROFILE_POLICY
    | typeof SLP_V1_0_EXECUTION_PROFILE_POLICY;
  buildRoleProfileCatalog(preferences: RoleProfilePreferencesMap): RoleProfileCatalog;
  workspaceProtocolReadership(
    roleId: MaterializeRoleBindingInput["roleId"],
  ): "full" | "assignment-only" | "governance-only";
  preflightRoleBinding(input: {
    roleId: MaterializeRoleBindingInput["roleId"];
    executionProfileId?: MaterializeRoleBindingInput["executionProfileId"];
    assignment?: MaterializeRoleBindingInput["assignment"];
  }): AssignmentEnvelope;
  materializeRoleBinding(
    input: MaterializeRoleBindingInput,
    owner: PluginPolicyOwner,
  ): Promise<PersistedRoleBinding>;
}

function canonicalSlpArtifactBytes(): string {
  return JSON.stringify({
    manifest: { id: "slp", abiVersion: 1, policyVersion: SLP_BUNDLED_POLICY_VERSION },
    roleContractVersion: PASEO_ROLE_CONTRACT_VERSION,
    assignmentContractVersion: PASEO_ASSIGNMENT_CONTRACT_VERSION,
    roles: PASEO_ROLE_IDS.map((roleId) => getFoundationRoleDefinition(roleId)),
    executionProfiles: FOUNDATION_EXECUTION_PROFILE_IDS.map((profileId) =>
      getFoundationExecutionProfileDefinition(profileId),
    ),
    roleToolCeilings: ROLE_TOOL_CEILINGS,
    roleDefaultTools: ROLE_DEFAULT_TOOLS,
    executionProfilePolicyVersion: SLP_EXECUTION_PROFILE_POLICY_VERSION,
    councilPolicyVersion: SLP_COUNCIL_POLICY_VERSION,
    coordinationPolicyVersion: SLP_COORDINATION_POLICY_VERSION,
    attentionPolicyVersion: SLP_ATTENTION_POLICY_VERSION,
    skills: buildFoundationSkillArtifactDescriptor(),
  });
}

export interface CreateSlpBundledPolicyRegistryOptions {
  registry?: BundledPolicyPackRegistry<SlpBundledPolicyContribution>;
  frozenArtifactBytes?: string;
}

export function createDefaultSlpBundledPolicyRegistry(
  options: CreateSlpBundledPolicyRegistryOptions = {},
): BundledPolicyPackRegistry<SlpBundledPolicyContribution> {
  return populateSlpBundledPolicyRegistry(options, false);
}

function registerFrozenSlpV10Generation(
  registry: BundledPolicyPackRegistry<SlpBundledPolicyContribution>,
  artifactBytes: string,
): void {
  parseFrozenSlpV10ArtifactBytes(artifactBytes);
  const artifactDigest = createHash("sha256").update(artifactBytes).digest("hex");
  if (artifactDigest !== SLP_V1_0_GENERATION_DIGEST) {
    throw new Error(
      `slp_45_generation_digest_mismatch: expected ${SLP_V1_0_GENERATION_DIGEST}, got ${artifactDigest}`,
    );
  }
  const generation = registry.registerGeneration({
    manifest: { id: "slp", abiVersion: 1, policyVersion: SLP_V1_0_POLICY_VERSION },
    artifactBytes,
    contribution: {
      councilPolicy: SLP_V1_0_COUNCIL_POLICY,
      coordinationPolicy: SLP_V1_0_COORDINATION_POLICY,
      eventPolicies: [SLP_V1_0_ATTENTION_EVENT_POLICY],
      executionProfilePolicy: SLP_V1_0_EXECUTION_PROFILE_POLICY,
      buildRoleProfileCatalog: buildSlpV10RoleProfileCatalog,
      workspaceProtocolReadership: (roleId) =>
        SLP_V1_0_ROLE_BINDING_POLICY.workspaceProtocolReadership(roleId),
      preflightRoleBinding: (input) => {
        const executionProfileId = input.executionProfileId
          ? SLP_V1_0_EXECUTION_PROFILE_POLICY.parseId(input.executionProfileId)
          : undefined;
        return SLP_V1_0_ROLE_BINDING_POLICY.preflight({
          roleId: input.roleId,
          assignment: input.assignment,
          ...(executionProfileId ? { executionProfileId } : {}),
        });
      },
      materializeRoleBinding: (input, owner) =>
        materializeRoleBindingWithPolicy(
          {
            ...input,
            policyOwner: owner,
            ...(input.executionProfileId
              ? {
                  executionProfileId: SLP_V1_0_EXECUTION_PROFILE_POLICY.parseId(
                    input.executionProfileId,
                  ),
                }
              : {}),
          },
          SLP_V1_0_ROLE_BINDING_POLICY,
        ),
    },
  });
  if (generation.owner.generationDigest !== SLP_V1_0_GENERATION_DIGEST) {
    throw new Error(
      `slp_45_generation_digest_mismatch: expected ${SLP_V1_0_GENERATION_DIGEST}, got ${generation.owner.generationDigest}`,
    );
  }
}

function registerDefaultSlpGeneration(
  registry: BundledPolicyPackRegistry<SlpBundledPolicyContribution>,
): BundledPolicyPackGeneration<SlpBundledPolicyContribution> {
  const generation: BundledPolicyPackGeneration<SlpBundledPolicyContribution> =
    registry.registerGeneration({
      manifest: {
        id: "slp",
        abiVersion: 1,
        policyVersion: SLP_BUNDLED_POLICY_VERSION,
      },
      artifactBytes: canonicalSlpArtifactBytes(),
      contribution: {
        councilPolicy: SLP_COUNCIL_POLICY,
        coordinationPolicy: SLP_COORDINATION_POLICY,
        eventPolicies: [SLP_ATTENTION_EVENT_POLICY],
        executionProfilePolicy: SLP_EXECUTION_PROFILE_POLICY,
        buildRoleProfileCatalog,
        workspaceProtocolReadership: (roleId) =>
          SLP_ROLE_BINDING_POLICY.workspaceProtocolReadership(roleId),
        preflightRoleBinding: (input) => {
          const executionProfileId = input.executionProfileId
            ? SLP_EXECUTION_PROFILE_POLICY.parseId(input.executionProfileId)
            : undefined;
          return SLP_ROLE_BINDING_POLICY.preflight({
            roleId: input.roleId,
            assignment: input.assignment,
            ...(executionProfileId ? { executionProfileId } : {}),
          });
        },
        materializeRoleBinding: (input, owner) =>
          materializeRoleBindingWithPolicy(
            {
              ...input,
              policyOwner: owner,
              ...(input.executionProfileId
                ? {
                    executionProfileId: SLP_EXECUTION_PROFILE_POLICY.parseId(
                      input.executionProfileId,
                    ),
                  }
                : {}),
            },
            SLP_ROLE_BINDING_POLICY,
          ),
      },
    });
  return generation;
}

function populateSlpBundledPolicyRegistry(
  options: CreateSlpBundledPolicyRegistryOptions,
  failClosedActive: boolean,
): BundledPolicyPackRegistry<SlpBundledPolicyContribution> {
  const registry =
    options.registry ?? new BundledPolicyPackRegistry<SlpBundledPolicyContribution>();
  let activeGeneration: BundledPolicyPackGeneration<SlpBundledPolicyContribution> | undefined;
  try {
    activeGeneration = registerDefaultSlpGeneration(registry);
  } catch (error) {
    registry.recordLoadFailure("slp", error);
    if (!failClosedActive) throw error;
  }
  try {
    registerFrozenSlpV10Generation(
      registry,
      options.frozenArtifactBytes ?? SLP_V1_0_ARTIFACT_BYTES,
    );
  } catch (error) {
    registry.recordGenerationLoadFailure(SLP_V1_0_POLICY_OWNER, error);
  }
  if (activeGeneration) {
    try {
      registry.activate(activeGeneration.owner);
    } catch (error) {
      registry.recordLoadFailure("slp", error);
      if (!failClosedActive) throw error;
    }
  }
  return registry;
}

/** Ordinary non-SLP Paseo remains available while active SLP admission fails closed. */
export function createFailClosedSlpBundledPolicyRegistry(
  options: CreateSlpBundledPolicyRegistryOptions = {},
): BundledPolicyPackRegistry<SlpBundledPolicyContribution> {
  return populateSlpBundledPolicyRegistry(options, true);
}
