import { describe, expect, it } from "vitest";
import {
  buildSkillMarkdown,
  isMissingProjectSkillsError,
  isValidProjectSkillName,
  parseProjectSkill,
  projectSkillInstructions,
} from "./model";

describe("project skill model", () => {
  it("accepts a valid package and extracts frontmatter", () => {
    const content = buildSkillMarkdown({
      name: "review-guidelines",
      description: "Review API conventions",
      instructions: "Check the public contract before editing.",
    });
    const skill = parseProjectSkill({
      directoryName: "review-guidelines",
      directoryPath: ".codex/skills/review-guidelines",
      path: ".codex/skills/review-guidelines/SKILL.md",
      content,
      modifiedAt: "2026-09-16T00:00:00.000Z",
    });

    expect(skill.valid).toBe(true);
    expect(skill.name).toBe("review-guidelines");
    expect(skill.description).toBe("Review API conventions");
    expect(projectSkillInstructions(content)).toBe("Check the public contract before editing.");
  });

  it("quotes descriptions so YAML punctuation remains part of the value", () => {
    const description = 'Review: APIs # critical "path" true [safe] ✓';
    const content = buildSkillMarkdown({
      name: "yaml-safe",
      description,
      instructions: "Keep the description intact.",
    });
    const skill = parseProjectSkill({
      directoryName: "yaml-safe",
      directoryPath: ".codex/skills/yaml-safe",
      path: ".codex/skills/yaml-safe/SKILL.md",
      content,
      modifiedAt: "now",
    });

    expect(content).toContain('description: "Review: APIs # critical \\"path\\" true [safe] ✓"');
    expect(skill.description).toBe(description);
  });

  it("rejects missing or mismatched metadata", () => {
    const missing = parseProjectSkill({
      directoryName: "broken",
      directoryPath: ".codex/skills/broken",
      path: ".codex/skills/broken/SKILL.md",
      content: "# Broken",
      modifiedAt: "now",
    });
    const mismatched = parseProjectSkill({
      directoryName: "folder-name",
      directoryPath: ".codex/skills/folder-name",
      path: ".codex/skills/folder-name/SKILL.md",
      content: "---\nname: other-name\ndescription: Test\n---\n\nBody",
      modifiedAt: "now",
    });

    expect(missing.valid).toBe(false);
    expect(missing.error).toBe("Missing YAML frontmatter");
    expect(mismatched.valid).toBe(false);
    expect(mismatched.error).toBe("Frontmatter name must match its folder");
  });

  it("keeps names scoped to safe skill folder syntax", () => {
    expect(isValidProjectSkillName("review-guidelines")).toBe(true);
    expect(isValidProjectSkillName("Review Guidelines")).toBe(false);
    expect(isValidProjectSkillName("../escape")).toBe(false);
    expect(isValidProjectSkillName("a".repeat(65))).toBe(false);
  });

  it("recognizes a missing project skill directory without hiding other errors", () => {
    expect(isMissingProjectSkillsError(new Error("ENOENT: no such file or directory"))).toBe(true);
    expect(isMissingProjectSkillsError(new Error("permission denied"))).toBe(false);
  });
});
