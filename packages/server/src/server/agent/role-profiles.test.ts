import { describe, expect, test } from "vitest";

import {
  MANDATORY_ROLE_SKILLS,
  MANDATORY_ROLE_TOOLS,
  ROLE_DEFAULT_TOOLS,
  buildRoleProfileCatalog,
  materializeRoleProfileBindingReceipt,
  validateRoleProfilePreferencesMap,
} from "./role-profiles.js";

describe("Foundation role profiles", () => {
  test("projects the three canonical roles and their current ceilings", () => {
    const catalog = buildRoleProfileCatalog({});

    expect(catalog.profiles.map((profile) => profile.roleId)).toEqual([
      "lead",
      "peer",
      "supervisor",
    ]);
    expect(catalog.profiles.find((profile) => profile.roleId === "peer")?.toolCeiling).toHaveLength(
      10,
    );
    expect(catalog.profiles.find((profile) => profile.roleId === "lead")?.toolCeiling).toContain(
      "list_profiles",
    );
    expect(
      catalog.profiles.find((profile) => profile.roleId === "peer")?.toolCeiling,
    ).not.toContain("list_profiles");
    expect(
      catalog.profiles.find((profile) => profile.roleId === "supervisor")?.toolCeiling,
    ).not.toContain("list_profiles");
    expect(
      catalog.profiles.find((profile) => profile.roleId === "supervisor")?.toolCeiling,
    ).toContain("read_room");
    expect(
      catalog.profiles.find((profile) => profile.roleId === "supervisor")?.toolCeiling,
    ).toEqual(expect.arrayContaining(["create_agent", "send_agent_prompt"]));
    for (const profile of catalog.profiles) {
      if (profile.roleId === "peer") {
        expect(profile.effective.allowedTools).toEqual(profile.toolCeiling);
      } else {
        expect(profile.effective.allowedTools).not.toEqual(profile.toolCeiling);
      }
      expect(profile.effective.allowedSkills).toEqual(profile.skillCeiling);
      expect(profile.instructions).toContain("Paseo");
    }
    expect(
      catalog.profiles.find((profile) => profile.roleId === "lead")?.effective.allowedTools,
    ).toEqual(
      expect.not.arrayContaining([
        "signal_agent",
        "prepare_lead_handoff",
        "transition_lead_handoff",
        "resolve_agent_signal",
      ]),
    );
    expect(
      catalog.profiles.find((profile) => profile.roleId === "supervisor")?.effective.allowedTools,
    ).toEqual(expect.not.arrayContaining(["create_agent", "send_agent_prompt", "signal_agent"]));
  });

  test("materializes a deterministic, narrower immutable receipt", () => {
    const preferences = {
      defaults: { provider: "codex", model: "gpt-5.4" },
      allowedTools: [...MANDATORY_ROLE_TOOLS],
      allowedSkills: [...MANDATORY_ROLE_SKILLS],
    };

    const first = materializeRoleProfileBindingReceipt("peer", preferences);
    const second = materializeRoleProfileBindingReceipt("peer", preferences);

    expect(first).toEqual(second);
    expect(first.allowedTools).toEqual([...MANDATORY_ROLE_TOOLS]);
    expect(first.allowedSkills).toEqual([...MANDATORY_ROLE_SKILLS]);
    expect(first.profileDigest).toMatch(/^[a-f0-9]{64}$/u);
  });

  test("admits only the two topology tools for a delegated Supervisor", () => {
    const observe = materializeRoleProfileBindingReceipt("supervisor", undefined, "read-only");
    const delegation = materializeRoleProfileBindingReceipt("supervisor", undefined, "delegation");

    expect(observe.allowedTools).toEqual(ROLE_DEFAULT_TOOLS.supervisor);
    expect(observe.allowedTools).not.toEqual(
      expect.arrayContaining(["create_agent", "send_agent_prompt"]),
    );
    expect(delegation.allowedTools.filter((tool) => !observe.allowedTools.includes(tool))).toEqual([
      "create_agent",
      "send_agent_prompt",
    ]);
    expect(delegation.profileDigest).not.toBe(observe.profileDigest);
    expect(delegation.allowedTools).not.toEqual(
      expect.arrayContaining(["signal_agent", "resolve_agent_signal"]),
    );

    const narrowedDelegation = materializeRoleProfileBindingReceipt(
      "supervisor",
      { allowedTools: ["list_agents", ...MANDATORY_ROLE_TOOLS] },
      "delegation",
    );
    expect(narrowedDelegation.allowedTools).toEqual(["list_agents", ...MANDATORY_ROLE_TOOLS]);

    const narrowedObserve = materializeRoleProfileBindingReceipt(
      "supervisor",
      {
        allowedTools: ["create_agent", "send_agent_prompt", ...MANDATORY_ROLE_TOOLS],
      },
      "read-only",
    );
    expect(narrowedObserve.allowedTools).toEqual([...MANDATORY_ROLE_TOOLS]);
  });

  test("rejects ceiling expansion and mandatory capability removal", () => {
    expect(() =>
      validateRoleProfilePreferencesMap({
        peer: {
          allowedTools: [...MANDATORY_ROLE_TOOLS, "create_agent"],
          allowedSkills: [...MANDATORY_ROLE_SKILLS],
        },
      }),
    ).toThrow("outside the Foundation ceiling");

    expect(() =>
      validateRoleProfilePreferencesMap({
        lead: {
          allowedTools: [],
          allowedSkills: [...MANDATORY_ROLE_SKILLS],
        },
      }),
    ).toThrow("cannot disable mandatory tool");
  });
});
