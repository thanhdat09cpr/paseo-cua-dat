import type { DaemonClient } from "@getpaseo/client/internal/daemon-client";
import {
  isMissingProjectSkillsError,
  parseProjectSkill,
  type ProjectSkillFile,
  type ProjectSkillProvider,
} from "./model";

export async function readSkillDirectories(
  client: DaemonClient,
  repoRoot: string,
  root: string,
): Promise<ReadonlyArray<{ name: string; path: string; modifiedAt: string }>> {
  try {
    const directory = await client.listDirectory(repoRoot, root);
    return directory.entries
      .filter((entry) => entry.kind === "directory")
      .map((entry) => ({ name: entry.name, path: entry.path, modifiedAt: entry.modifiedAt }));
  } catch (error) {
    if (isMissingProjectSkillsError(error)) return [];
    throw error;
  }
}

export async function readProjectSkillFile(
  client: DaemonClient,
  repoRoot: string,
  provider: ProjectSkillProvider,
  entry: { name: string; path: string; modifiedAt: string },
): Promise<ProjectSkillFile> {
  const filePath = `${entry.path}/SKILL.md`;
  try {
    const file = await client.readFile(repoRoot, filePath);
    if (file.kind !== "text") throw new Error("SKILL.md is not a text file");
    return parseProjectSkill({
      provider,
      directoryName: entry.name,
      directoryPath: entry.path,
      path: filePath,
      content: new TextDecoder().decode(file.bytes),
      modifiedAt: file.modifiedAt,
      revision: file.revision,
      exists: true,
    });
  } catch (error) {
    return parseProjectSkill({
      provider,
      directoryName: entry.name,
      directoryPath: entry.path,
      path: filePath,
      content: "",
      modifiedAt: entry.modifiedAt,
      exists: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function ensureParentDirectories(
  client: DaemonClient,
  repoRoot: string,
  root: string,
): Promise<void> {
  const [parent, name] = root.split("/");
  await ensureDirectory(client, repoRoot, ".", parent);
  await ensureDirectory(client, repoRoot, parent, name);
}

export async function writeNewSkillFile(
  client: DaemonClient,
  repoRoot: string,
  directoryPath: string,
  draftContent: string,
): Promise<void> {
  const file = await client.createFileEntry({
    cwd: repoRoot,
    parentPath: directoryPath,
    name: "SKILL.md",
    kind: "file",
  });
  if (!file.success) throw new Error(file.error ?? "Unable to create SKILL.md");
  const emptyFile = await client.readFile(repoRoot, `${directoryPath}/SKILL.md`);
  assertWritten(
    await client.writeFile({
      cwd: repoRoot,
      path: `${directoryPath}/SKILL.md`,
      content: draftContent,
      expectedModifiedAt: emptyFile.modifiedAt,
      expectedRevision: emptyFile.revision,
    }),
  );
}

async function ensureDirectory(
  client: DaemonClient,
  repoRoot: string,
  parentPath: string,
  name: string,
): Promise<void> {
  const result = await client.createFileEntry({
    cwd: repoRoot,
    parentPath,
    name,
    kind: "directory",
  });
  if (!result.success && !result.error?.includes("already exists")) {
    throw new Error(result.error ?? "Unable to create project skill directory");
  }
}

export function assertWritten(result: Awaited<ReturnType<DaemonClient["writeFile"]>>): void {
  if (result.status === "written") return;
  if (result.status === "conflict")
    throw new Error("SKILL.md changed on disk. Reload and try again.");
  throw new Error(result.error);
}
