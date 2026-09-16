import type { DaemonClient } from "@getpaseo/client/internal/daemon-client";
import {
  buildSkillMarkdown,
  isMissingProjectSkillsError,
  isValidProjectSkillName,
  PROJECT_SKILL_TARGETS,
  type ProjectSkill,
  type ProjectSkillFile,
  type SkillDraft,
} from "./model";
import {
  assertWritten,
  ensureParentDirectories,
  readProjectSkillFile,
  readSkillDirectories,
  writeNewSkillFile,
} from "./filesystem";

export async function loadProjectSkills(
  client: DaemonClient,
  repoRoot: string,
): Promise<ProjectSkill[]> {
  const targetEntries = await Promise.all(
    PROJECT_SKILL_TARGETS.map(async ({ provider, root }) => ({
      provider,
      root,
      entries: await readSkillDirectories(client, repoRoot, root),
    })),
  );
  const names = new Set(targetEntries.flatMap(({ entries }) => entries.map((entry) => entry.name)));
  const skills = [...names].map((directoryName) => {
    const files = targetEntries.flatMap(({ provider, entries }) => {
      const entry = entries.find((candidate) => candidate.name === directoryName);
      return entry ? [readProjectSkillFile(client, repoRoot, provider, entry)] : [];
    });
    return combineProjectSkill(directoryName, files);
  });
  return Promise.all(skills).then((items) =>
    items.sort((a, b) => a.directoryName.localeCompare(b.directoryName)),
  );
}

export async function createProjectSkill(
  client: DaemonClient,
  repoRoot: string,
  draft: SkillDraft,
): Promise<void> {
  if (!isValidProjectSkillName(draft.name)) throw new Error("Invalid skill name");
  const name = draft.name.trim();
  const created: string[] = [];
  try {
    for (const { root } of PROJECT_SKILL_TARGETS) {
      await ensureParentDirectories(client, repoRoot, root);
      const directoryPath = `${root}/${name}`;
      const directory = await client.createFileEntry({
        cwd: repoRoot,
        parentPath: root,
        name,
        kind: "directory",
      });
      if (!directory.success) {
        throw new Error(
          directory.error ?? `A project skill with this name already exists in ${root}`,
        );
      }
      created.push(directoryPath);
      await writeNewSkillFile(client, repoRoot, directoryPath, buildSkillMarkdown(draft));
    }
  } catch (error) {
    await Promise.all(
      created.map((path) => client.deleteFileEntry({ cwd: repoRoot, path }).catch(() => undefined)),
    );
    throw error;
  }
}

export async function updateProjectSkill(
  client: DaemonClient,
  repoRoot: string,
  skill: ProjectSkill,
  draft: SkillDraft,
): Promise<void> {
  if (!isValidProjectSkillName(skill.directoryName)) throw new Error("Invalid skill folder name");
  const content = buildSkillMarkdown({ ...draft, name: skill.directoryName });
  for (const { root, provider } of PROJECT_SKILL_TARGETS) {
    const existing = skill.files.find((file) => file.provider === provider);
    if (existing?.exists) {
      assertWritten(
        await client.writeFile({
          cwd: repoRoot,
          path: existing.path,
          content,
          expectedModifiedAt: existing.modifiedAt,
          expectedRevision: existing.revision,
        }),
      );
      continue;
    }
    await ensureParentDirectories(client, repoRoot, root);
    const directoryPath = `${root}/${skill.directoryName}`;
    const directory = await client.createFileEntry({
      cwd: repoRoot,
      parentPath: root,
      name: skill.directoryName,
      kind: "directory",
    });
    if (!directory.success && !directory.error?.includes("already exists")) {
      throw new Error(directory.error ?? `Unable to create ${provider} project skill directory`);
    }
    await writeNewSkillFile(client, repoRoot, directoryPath, content);
  }
}

export async function deleteProjectSkill(
  client: DaemonClient,
  repoRoot: string,
  skill: ProjectSkill,
): Promise<void> {
  const results = await Promise.all(
    PROJECT_SKILL_TARGETS.map(({ root }) =>
      client.deleteFileEntry({ cwd: repoRoot, path: `${root}/${skill.directoryName}` }),
    ),
  );
  const failure = results.find(
    (result) => !result.success && !isMissingProjectSkillsError(result.error),
  );
  if (failure) throw new Error(failure.error ?? "Unable to remove project skill");
}

async function combineProjectSkill(
  directoryName: string,
  files: ReadonlyArray<ProjectSkillFile | Promise<ProjectSkillFile>>,
): Promise<ProjectSkill> {
  const resolved = await Promise.all(files);
  const canonical = resolved.find((file) => file.provider === "codex") ?? resolved[0];
  const missingProviders = PROJECT_SKILL_TARGETS.filter(
    ({ provider }) => !resolved.some((file) => file.provider === provider && file.exists),
  ).map(({ provider }) => provider);
  const mismatch =
    resolved.length > 1 &&
    resolved.every((file) => file.valid) &&
    new Set(resolved.map((file) => file.content)).size > 1;
  let error: string | undefined;
  if (mismatch) {
    error = "Claude and Codex copies differ; save to synchronize them";
  } else if (missingProviders.length > 0) {
    error = `Missing ${missingProviders.join(" and ")} copy; save to synchronize them`;
  } else {
    error = resolved.find((file) => !file.valid)?.error;
  }
  return {
    directoryName,
    name: canonical?.name ?? directoryName,
    description: canonical?.description ?? "",
    content: canonical?.content ?? "",
    valid: Boolean(canonical?.valid) && missingProviders.length === 0 && !mismatch && !error,
    ...(error ? { error } : {}),
    files: resolved,
  };
}
