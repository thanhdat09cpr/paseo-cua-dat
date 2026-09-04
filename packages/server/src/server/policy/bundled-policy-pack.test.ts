import { createHash } from "node:crypto";
import { describe, expect, test, vi } from "vitest";

import {
  assertLocalPluginIdAvailable,
  BUNDLED_POLICY_PACK_MISSING_ERROR,
  BUNDLED_POLICY_PACK_RESERVED_ID_ERROR,
  BUNDLED_POLICY_PACK_UNAVAILABLE_ERROR,
  BundledPolicyPackRegistry,
} from "./bundled-policy-pack.js";
import {
  createDefaultSlpBundledPolicyRegistry,
  createFailClosedSlpBundledPolicyRegistry,
  type SlpBundledPolicyContribution,
} from "./bundled/slp.js";
import { SLP_V1_0_ARTIFACT_BYTES } from "./bundled/slp/v1-0-frozen-artifact.js";
import { AgentManager } from "../agent/agent-manager.js";

function manifest(policyVersion: string) {
  return { id: "slp" as const, abiVersion: 1 as const, policyVersion };
}

describe("bundled policy pack registry", () => {
  test("loads the default SLP generation independently of local plugin configuration", () => {
    const first = createDefaultSlpBundledPolicyRegistry().resolveActive("slp");
    const second = createDefaultSlpBundledPolicyRegistry().resolveActive("slp");

    expect(first.owner).toEqual(second.owner);
    expect(first.owner).toEqual({
      kind: "plugin",
      pluginId: "slp",
      policyVersion: "1.1.0",
      generationDigest: "87182e67fd3b45df93cae23cd8b30f7f9752e4249323a4cc77d297f6a59beada",
    });
    expect(first.contribution.eventPolicies).toHaveLength(1);
    expect(first.contribution.eventPolicies[0]?.id).toBe("slp.attention");
    expect(first.contribution.eventPolicies[0]?.enabled({})).toBe(true);
    expect(
      first.contribution.eventPolicies[0]?.enabled({ PASEO_DISABLE_SLP_ATTENTION_POLICY: "1" }),
    ).toBe(false);
  });

  test("reconstructs the exact frozen .45 generation in a fresh registry", () => {
    const owner = {
      kind: "plugin" as const,
      pluginId: "slp" as const,
      policyVersion: "1.0.0",
      generationDigest: "569c7f4633b7ffacb2e63c0ee3dda1ea882bc050bc456fdc8ac0c466f4f483f0",
    };
    const firstProcessRegistry = createDefaultSlpBundledPolicyRegistry();
    const persistedOwner = JSON.parse(
      JSON.stringify(firstProcessRegistry.resolvePinned(owner).owner),
    ) as typeof owner;
    const restartedRegistry = createDefaultSlpBundledPolicyRegistry();
    expect(restartedRegistry).not.toBe(firstProcessRegistry);
    const frozen = restartedRegistry.resolvePinned(persistedOwner);

    expect(frozen.owner).toEqual(owner);
    expect(frozen.contribution.eventPolicies).toEqual([
      expect.objectContaining({ id: "slp.attention", version: "1" }),
    ]);
    expect(frozen.contribution.eventPolicies[0]?.enabled({})).toBe(false);
    expect(
      frozen.contribution.eventPolicies[0]?.enabled({
        PASEO_ENABLE_NATIVE_COORDINATION_POLICY: "1",
      }),
    ).toBe(true);
    expect(
      frozen.contribution
        .buildRoleProfileCatalog({})
        .profiles.find((profile) => profile.roleId === "supervisor")?.effective.allowedTools,
    ).not.toContain("ask_attention_question");
    expect(() =>
      frozen.contribution.coordinationPolicy.assertAttentionQuestionAuthority({
        targetAgentId: "lead-1",
        targetRoleId: "lead",
        callerRoleId: "supervisor",
        callerAgentId: "supervisor-1",
        callerWorkspaceId: "workspace-1",
        targetWorkspaceId: "workspace-1",
        observation: "A scope premise changed.",
        question: "Does this premise need another look?",
        evidenceRefs: ["timeline:1"],
      }),
    ).toThrow("unavailable_for_pinned_generation");
    expect(restartedRegistry.resolveActive("slp").owner.policyVersion).toBe("1.1.0");
  });

  test("separates the historical artifact digest from fixed operational compatibility receipts", () => {
    expect(createHash("sha256").update(SLP_V1_0_ARTIFACT_BYTES).digest("hex")).toBe(
      "569c7f4633b7ffacb2e63c0ee3dda1ea882bc050bc456fdc8ac0c466f4f483f0",
    );
    const frozen = createDefaultSlpBundledPolicyRegistry().resolvePinned({
      kind: "plugin",
      pluginId: "slp",
      policyVersion: "1.0.0",
      generationDigest: "569c7f4633b7ffacb2e63c0ee3dda1ea882bc050bc456fdc8ac0c466f4f483f0",
    });

    expect(frozen.contribution.coordinationPolicy.supportsAttentionQuestions).toBe(false);
    expect(frozen.contribution.eventPolicies[0]?.enabled({})).toBe(false);
    expect(
      frozen.contribution.eventPolicies[0]?.enabled({
        PASEO_ENABLE_NATIVE_COORDINATION_POLICY: "1",
      }),
    ).toBe(true);
    expect(
      frozen.contribution
        .buildRoleProfileCatalog({})
        .profiles.find((profile) => profile.roleId === "supervisor")?.effective.allowedTools,
    ).not.toContain("ask_attention_question");
  });

  test.each([
    {
      name: "parse",
      artifactBytes: "{not-json",
      expected: /Unexpected token|JSON/,
    },
    {
      name: "digest",
      artifactBytes: `${SLP_V1_0_ARTIFACT_BYTES}\n`,
      expected: /slp_45_generation_digest_mismatch/,
    },
  ])("isolates frozen $name failure from the active generation", ({ artifactBytes, expected }) => {
    const registry = createDefaultSlpBundledPolicyRegistry({ frozenArtifactBytes: artifactBytes });

    expect(registry.resolveActive("slp").owner.policyVersion).toBe("1.1.0");
    expect(() =>
      registry.resolvePinned({
        kind: "plugin",
        pluginId: "slp",
        policyVersion: "1.0.0",
        generationDigest: "569c7f4633b7ffacb2e63c0ee3dda1ea882bc050bc456fdc8ac0c466f4f483f0",
      }),
    ).toThrow(expected);
  });

  test("lazy frozen parsing cannot prevent module load or active registration", async () => {
    vi.resetModules();
    vi.doMock("./bundled/slp/v1-0-frozen-artifact.js", () => ({
      SLP_V1_0_ARTIFACT_BYTES: "{injected-invalid-frozen-json",
    }));
    const isolatedModule = await import("./bundled/slp.js");
    const registry = isolatedModule.createDefaultSlpBundledPolicyRegistry();

    expect(registry.resolveActive("slp").owner.policyVersion).toBe("1.1.0");
    expect(() =>
      registry.resolvePinned({
        kind: "plugin",
        pluginId: "slp",
        policyVersion: "1.0.0",
        generationDigest: "569c7f4633b7ffacb2e63c0ee3dda1ea882bc050bc456fdc8ac0c466f4f483f0",
      }),
    ).toThrow(BUNDLED_POLICY_PACK_UNAVAILABLE_ERROR);

    vi.doUnmock("./bundled/slp/v1-0-frozen-artifact.js");
    vi.resetModules();
  });

  test("isolates frozen registration failure from active SLP surfaces", () => {
    class FrozenRejectingRegistry extends BundledPolicyPackRegistry<SlpBundledPolicyContribution> {
      override registerGeneration(
        input: Parameters<
          BundledPolicyPackRegistry<SlpBundledPolicyContribution>["registerGeneration"]
        >[0],
      ) {
        if (input.manifest.policyVersion === "1.0.0") {
          throw new Error("injected_frozen_registration_failure");
        }
        return super.registerGeneration(input);
      }
    }
    const registry = createFailClosedSlpBundledPolicyRegistry({
      registry: new FrozenRejectingRegistry(),
    });
    const active = registry.resolveActive("slp");

    expect(active.owner.policyVersion).toBe("1.1.0");
    expect(active.contribution.eventPolicies).toHaveLength(1);
    expect(active.contribution.coordinationPolicy.supportsAttentionQuestions).toBe(true);
    expect(() =>
      registry.resolvePinned({
        kind: "plugin",
        pluginId: "slp",
        policyVersion: "1.0.0",
        generationDigest: "569c7f4633b7ffacb2e63c0ee3dda1ea882bc050bc456fdc8ac0c466f4f483f0",
      }),
    ).toThrow("injected_frozen_registration_failure");
  });

  test("gives an after-insert frozen failure precedence until a full retry succeeds", () => {
    class AfterSuperFrozenFailureRegistry extends BundledPolicyPackRegistry<SlpBundledPolicyContribution> {
      failAfterInsert = true;

      override registerGeneration(
        input: Parameters<
          BundledPolicyPackRegistry<SlpBundledPolicyContribution>["registerGeneration"]
        >[0],
      ) {
        const generation = super.registerGeneration(input);
        if (input.manifest.policyVersion === "1.0.0" && this.failAfterInsert) {
          this.failAfterInsert = false;
          throw new Error("injected_after_super_frozen_failure");
        }
        return generation;
      }
    }
    const frozenOwner = {
      kind: "plugin" as const,
      pluginId: "slp" as const,
      policyVersion: "1.0.0",
      generationDigest: "569c7f4633b7ffacb2e63c0ee3dda1ea882bc050bc456fdc8ac0c466f4f483f0",
    };
    const injected = new AfterSuperFrozenFailureRegistry();
    const firstAttempt = createDefaultSlpBundledPolicyRegistry({ registry: injected });

    expect(firstAttempt.resolveActive("slp").owner.policyVersion).toBe("1.1.0");
    expect(() => firstAttempt.resolvePinned(frozenOwner)).toThrow(
      /bundled_policy_pack_unavailable.*injected_after_super_frozen_failure/,
    );

    const successfulRetry = createDefaultSlpBundledPolicyRegistry({ registry: injected });
    expect(successfulRetry.resolveActive("slp").owner.policyVersion).toBe("1.1.0");
    expect(successfulRetry.resolvePinned(frozenOwner).owner).toEqual(frozenOwner);
  });

  test("keeps frozen .45 bytes resolvable when current Foundation role bytes vary", async () => {
    vi.resetModules();
    vi.doMock("./bundled/slp/role-definitions.js", async (importOriginal) => {
      const current = await importOriginal<typeof import("./bundled/slp/role-definitions.js")>();
      return {
        ...current,
        getFoundationRoleDefinition: (
          roleId: Parameters<typeof current.getFoundationRoleDefinition>[0],
        ) => ({
          ...current.getFoundationRoleDefinition(roleId),
          instructions: `VARIED CURRENT FOUNDATION ROLE ${roleId}`,
        }),
      };
    });
    vi.doMock("./bundled/slp/execution-profiles.js", async (importOriginal) => {
      const current = await importOriginal<typeof import("./bundled/slp/execution-profiles.js")>();
      return {
        ...current,
        getFoundationExecutionProfileDefinition: (
          profileId: Parameters<typeof current.getFoundationExecutionProfileDefinition>[0],
        ) => ({
          ...current.getFoundationExecutionProfileDefinition(profileId),
          instructions: `VARIED CURRENT FOUNDATION EXECUTION ${profileId}`,
        }),
      };
    });
    vi.doMock("./bundled/slp/skill-policy.js", async (importOriginal) => {
      const current = await importOriginal<typeof import("./bundled/slp/skill-policy.js")>();
      return {
        ...current,
        buildFoundationSkillArtifactDescriptor: () => ({
          ...current.buildFoundationSkillArtifactDescriptor(),
          manifestDigest: "f".repeat(64),
        }),
      };
    });
    const variedModule = await import("./bundled/slp.js");
    const freshRegistry = variedModule.createDefaultSlpBundledPolicyRegistry();
    const frozenOwner = {
      kind: "plugin" as const,
      pluginId: "slp" as const,
      policyVersion: "1.0.0",
      generationDigest: "569c7f4633b7ffacb2e63c0ee3dda1ea882bc050bc456fdc8ac0c466f4f483f0",
    };

    expect(freshRegistry.resolvePinned(frozenOwner).owner).toEqual(frozenOwner);
    expect(
      freshRegistry
        .resolvePinned(frozenOwner)
        .contribution.buildRoleProfileCatalog({})
        .profiles.find((profile) => profile.roleId === "supervisor")?.instructions,
    ).not.toContain("VARIED CURRENT FOUNDATION ROLE");
    expect(freshRegistry.resolveActive("slp").owner).toMatchObject({
      policyVersion: "1.1.0",
    });
    expect(freshRegistry.resolveActive("slp").owner.generationDigest).not.toBe(
      "87182e67fd3b45df93cae23cd8b30f7f9752e4249323a4cc77d297f6a59beada",
    );
    expect(
      freshRegistry
        .resolveActive("slp")
        .contribution.buildRoleProfileCatalog({})
        .profiles.find((profile) => profile.roleId === "supervisor")?.instructions,
    ).toContain("VARIED CURRENT FOUNDATION ROLE supervisor");

    vi.doUnmock("./bundled/slp/role-definitions.js");
    vi.doUnmock("./bundled/slp/execution-profiles.js");
    vi.doUnmock("./bundled/slp/skill-policy.js");
    vi.resetModules();
  });

  test("resolves mixed legacy, .45, and .46 event policies from each pinned owner", () => {
    const registry = createDefaultSlpBundledPolicyRegistry();
    const oldOwner = {
      kind: "plugin" as const,
      pluginId: "slp" as const,
      policyVersion: "1.0.0",
      generationDigest: "569c7f4633b7ffacb2e63c0ee3dda1ea882bc050bc456fdc8ac0c466f4f483f0",
    };
    const agents = new Map([
      ["legacy", { roleBinding: { policyOwner: { kind: "legacy-core" } } }],
      ["v45", { roleBinding: { policyOwner: oldOwner } }],
      ["v46", { roleBinding: { policyOwner: registry.resolveActive("slp").owner } }],
    ]);
    const fakeManager = {
      bundledPolicyPacks: registry,
      getAgent: (agentId: string) => agents.get(agentId) ?? null,
    } as unknown as AgentManager;
    const resolve = AgentManager.prototype.resolveBundledEventPoliciesForAgent;

    expect(resolve.call(fakeManager, "legacy")).toEqual([]);
    expect(resolve.call(fakeManager, "v45")).toEqual([
      expect.objectContaining({
        stateNamespace: `slp@${oldOwner.generationDigest}`,
        policy: expect.objectContaining({ id: "slp.attention", version: "1" }),
      }),
    ]);
    expect(resolve.call(fakeManager, "v46")).toEqual([
      expect.objectContaining({
        stateNamespace: `slp@${registry.resolveActive("slp").owner.generationDigest}`,
        policy: expect.objectContaining({ id: "slp.attention", version: "4" }),
      }),
    ]);
  });

  test("fails closed unless an attention-question target pins a supporting generation", () => {
    const registry = createDefaultSlpBundledPolicyRegistry();
    const fakeManager = { bundledPolicyPacks: registry } as unknown as AgentManager;
    const assertTarget =
      AgentManager.prototype.assertAttentionQuestionTargetSupport.bind(fakeManager);
    const binding = (policyOwner: unknown) => ({ policyOwner }) as never;

    expect(() => assertTarget(binding(registry.resolveActive("slp").owner))).not.toThrow();
    expect(() =>
      assertTarget(
        binding({
          kind: "plugin",
          pluginId: "slp",
          policyVersion: "1.0.0",
          generationDigest: "569c7f4633b7ffacb2e63c0ee3dda1ea882bc050bc456fdc8ac0c466f4f483f0",
        }),
      ),
    ).toThrow("target_generation_unsupported");
    expect(() => assertTarget(binding({ kind: "legacy-core" }))).toThrow("legacy-or-non-slp");
    expect(() => assertTarget(undefined)).toThrow("target_policy_owner_missing");
    expect(() => assertTarget(binding({ kind: "plugin", pluginId: "slp" }))).toThrow(
      "target_policy_owner_invalid",
    );
    expect(() =>
      assertTarget(
        binding({
          kind: "plugin",
          pluginId: "slp",
          policyVersion: "1.1.0",
          generationDigest: "f".repeat(64),
        }),
      ),
    ).toThrow("target_generation_unavailable");
  });

  test("derives immutable ownership from exact artifact bytes", () => {
    const registry = new BundledPolicyPackRegistry<{ marker: string }>();
    const generation = registry.registerGeneration({
      manifest: manifest("1.0.0"),
      artifactBytes: "exact bundled SLP bytes",
      contribution: { marker: "v1" },
    });

    expect(generation.owner).toEqual({
      kind: "plugin",
      pluginId: "slp",
      generationDigest: createHash("sha256").update("exact bundled SLP bytes").digest("hex"),
      policyVersion: "1.0.0",
    });
  });

  test("pins old agents while a newer generation becomes active", async () => {
    const registry = new BundledPolicyPackRegistry<{ marker: string }>();
    const first = await registry.installAndActivateCandidate(async () => ({
      manifest: manifest("1.0.0"),
      artifactBytes: "generation one",
      contribution: { marker: "v1" },
    }));
    const second = await registry.installAndActivateCandidate(async () => ({
      manifest: manifest("2.0.0"),
      artifactBytes: "generation two",
      contribution: { marker: "v2" },
    }));

    expect(registry.resolveActive("slp").owner).toEqual(second.owner);
    expect(registry.resolvePinned(first.owner).contribution.marker).toBe("v1");
    expect(registry.resolvePinned(second.owner).contribution.marker).toBe("v2");
  });

  test("keeps the active generation when a candidate fails to load", async () => {
    const registry = new BundledPolicyPackRegistry<{ marker: string }>();
    const first = await registry.installAndActivateCandidate(async () => ({
      manifest: manifest("1.0.0"),
      artifactBytes: "stable generation",
      contribution: { marker: "stable" },
    }));

    await expect(
      registry.installAndActivateCandidate(async () => {
        throw new Error("candidate failed validation");
      }),
    ).rejects.toThrow("candidate failed validation");
    expect(registry.resolveActive("slp").owner).toEqual(first.owner);
  });

  test("fails closed for missing generations and reserves the SLP local-plugin ID", () => {
    const registry = new BundledPolicyPackRegistry<unknown>();
    expect(() => registry.resolveActive("slp")).toThrow(BUNDLED_POLICY_PACK_MISSING_ERROR);
    expect(() =>
      registry.resolvePinned({
        kind: "plugin",
        pluginId: "slp",
        generationDigest: "a".repeat(64),
        policyVersion: "1.0.0",
      }),
    ).toThrow(BUNDLED_POLICY_PACK_MISSING_ERROR);
    expect(() => assertLocalPluginIdAvailable("slp")).toThrow(
      BUNDLED_POLICY_PACK_RESERVED_ID_ERROR,
    );
    expect(() => assertLocalPluginIdAvailable("my-local-plugin")).not.toThrow();
  });

  test("preserves a bundled load failure without falling back to legacy core", () => {
    const registry = new BundledPolicyPackRegistry<unknown>();
    registry.recordLoadFailure("slp", new Error("invalid bundled artifact"));

    expect(() => registry.resolveActive("slp")).toThrow(BUNDLED_POLICY_PACK_UNAVAILABLE_ERROR);
    expect(() => registry.resolveActive("slp")).toThrow("invalid bundled artifact");
  });
});
