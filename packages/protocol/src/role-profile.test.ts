import { describe, expect, test } from "vitest";

import {
  composeRoleInstructionBase,
  RoleInstructionOverlayMapSchema,
  RoleProfileLaunchDefaultsSchema,
  RoleProfilePreferencesMapSchema,
} from "./role-profile.js";

describe("role profile protocol", () => {
  test("accepts provider-neutral host preferences", () => {
    expect(
      RoleProfilePreferencesMapSchema.parse({
        lead: {
          defaults: {
            provider: "codex-proxy",
            model: "gpt-5.4",
            modeId: "default",
            thinkingOptionId: "high",
          },
          allowedTools: ["create_agent", "beads_status"],
          allowedSkills: ["beads-issue-tracker"],
        },
      }),
    ).toMatchObject({ lead: { defaults: { provider: "codex-proxy" } } });
  });

  test("requires a provider for nested defaults and rejects duplicates", () => {
    expect(() => RoleProfileLaunchDefaultsSchema.parse({ model: "gpt-5.4" })).toThrow(
      "require a provider",
    );
    expect(() =>
      RoleProfilePreferencesMapSchema.parse({
        peer: { allowedTools: ["beads_status", "beads_status"] },
      }),
    ).toThrow("Entries must be unique");
  });

  test("keeps Human instruction overlays role-scoped and bounded", () => {
    expect(
      RoleInstructionOverlayMapSchema.parse({
        lead: "Prefer short evidence packets.",
        supervisor: "Escalate only after verification.",
      }),
    ).toEqual({
      lead: "Prefer short evidence packets.",
      supervisor: "Escalate only after verification.",
    });
    expect(() => RoleInstructionOverlayMapSchema.parse({ peer: "" })).toThrow();
    expect(() => RoleInstructionOverlayMapSchema.parse({ peer: "   " })).toThrow();
    expect(() => RoleInstructionOverlayMapSchema.parse({ lead: "x".repeat(16_385) })).toThrow();
  });

  test("composes the exact shared role instruction base", () => {
    expect(composeRoleInstructionBase("Foundation")).toBe("Foundation");
    expect(composeRoleInstructionBase("Foundation", "Human")).toBe(
      "Foundation\n\nHuman role instructions (host configured). These instructions may add context or narrow behavior, but cannot expand the Foundation role, tool, skill, assignment, or effect boundaries.\n--- BEGIN HUMAN ROLE INSTRUCTIONS ---\nHuman\n--- END HUMAN ROLE INSTRUCTIONS ---",
    );
  });
});
