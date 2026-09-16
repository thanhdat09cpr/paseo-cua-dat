import { describe, expect, it, vi } from "vitest";
import type { DaemonClient } from "@getpaseo/client/internal/daemon-client";
import { buildSkillMarkdown } from "./model";
import { createProjectSkill, loadProjectSkills } from "./operations";

const repoRoot = "/repo/project";

function clientForFiles(contents: Record<string, string>): DaemonClient {
  return {
    listDirectory: vi.fn(async (_cwd: string, root: string) => ({
      entries: Object.keys(contents)
        .filter((path) => path.startsWith(`${root}/`) && path.endsWith("/SKILL.md"))
        .map((path) => path.slice(0, -"/SKILL.md".length))
        .map((path) => ({
          kind: "directory" as const,
          name: path.split("/").at(-1)!,
          path,
          modifiedAt: "2026-09-16T00:00:00.000Z",
        })),
    })),
    readFile: vi.fn(async (_cwd: string, filePath: string) => ({
      kind: "text" as const,
      bytes: new TextEncoder().encode(contents[filePath] ?? ""),
      modifiedAt: "2026-09-16T00:00:00.000Z",
      revision: filePath,
    })),
  } as unknown as DaemonClient;
}

describe("project skill operations", () => {
  it("loads and compares the Claude and Codex copies", async () => {
    const markdown = buildSkillMarkdown({
      name: "review-guidelines",
      description: "Review API conventions",
      instructions: "Check the public contract.",
    });
    const client = clientForFiles({
      ".codex/skills/review-guidelines": markdown,
      ".codex/skills/review-guidelines/SKILL.md": markdown,
      ".claude/skills/review-guidelines": markdown,
      ".claude/skills/review-guidelines/SKILL.md": `${markdown}\nextra`,
    });

    const [skill] = await loadProjectSkills(client, repoRoot);

    expect(skill?.files.map((file) => file.provider)).toEqual(["codex", "claude"]);
    expect(skill?.valid).toBe(false);
    expect(skill?.error).toContain("copies differ");
  });

  it("creates the same skill package in both provider directories", async () => {
    const createFileEntry = vi.fn(async () => ({ success: true, error: null }));
    const readFile = vi.fn(async () => ({
      kind: "text" as const,
      bytes: new Uint8Array(),
      modifiedAt: "2026-09-16T00:00:00.000Z",
      revision: "empty",
    }));
    const writeFile = vi.fn(async (_input: { path: string }) => ({
      status: "written" as const,
      modifiedAt: "2026-09-16T00:00:01.000Z",
      revision: "written",
      size: 10,
    }));
    const client = { createFileEntry, readFile, writeFile } as unknown as DaemonClient;

    await createProjectSkill(client, repoRoot, {
      name: "review-guidelines",
      description: "Review API conventions",
      instructions: "Check the public contract.",
    });

    expect(createFileEntry.mock.calls).toEqual(
      expect.arrayContaining([
        [expect.objectContaining({ parentPath: ".codex/skills", name: "review-guidelines" })],
        [expect.objectContaining({ parentPath: ".claude/skills", name: "review-guidelines" })],
      ]),
    );
    expect(writeFile).toHaveBeenCalledTimes(2);
    expect(writeFile.mock.calls.map(([input]) => input.path)).toEqual([
      ".codex/skills/review-guidelines/SKILL.md",
      ".claude/skills/review-guidelines/SKILL.md",
    ]);
  });
});
