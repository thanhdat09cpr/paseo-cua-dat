export const PROJECT_SKILL_TARGETS = [
  { provider: "codex", root: ".codex/skills" },
  { provider: "claude", root: ".claude/skills" },
] as const;

export type ProjectSkillProvider = (typeof PROJECT_SKILL_TARGETS)[number]["provider"];

export interface ProjectSkillFile {
  provider: ProjectSkillProvider;
  directoryPath: string;
  path: string;
  name: string;
  description: string;
  content: string;
  modifiedAt: string;
  revision?: string;
  exists: boolean;
  valid: boolean;
  error?: string;
}

const SKILL_NAME_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/u;

export interface ProjectSkill {
  directoryName: string;
  name: string;
  description: string;
  content: string;
  valid: boolean;
  error?: string;
  files: readonly ProjectSkillFile[];
}

export interface SkillDraft {
  name: string;
  description: string;
  instructions: string;
}

export function isValidProjectSkillName(name: string): boolean {
  return SKILL_NAME_PATTERN.test(name.trim());
}

export function buildSkillMarkdown(draft: SkillDraft): string {
  const name = draft.name.trim();
  const description = draft.description.trim().replace(/\s+/gu, " ");
  return [
    `---`,
    `name: ${name}`,
    `description: ${JSON.stringify(description)}`,
    `---`,
    "",
    draft.instructions.trim(),
    "",
  ].join("\n");
}

export function parseProjectSkill(input: {
  provider?: ProjectSkillProvider;
  directoryName: string;
  directoryPath: string;
  path: string;
  content: string;
  modifiedAt: string;
  revision?: string;
  exists?: boolean;
  error?: string;
}): ProjectSkillFile {
  const frontMatterMatch = /^---\s*\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/u.exec(input.content);
  const fields = new Map<string, string>();
  if (frontMatterMatch) {
    for (const line of frontMatterMatch[1].split(/\r?\n/u)) {
      const separator = line.indexOf(":");
      if (separator <= 0) continue;
      fields.set(line.slice(0, separator).trim(), stripYamlScalar(line.slice(separator + 1)));
    }
  }

  const name = fields.get("name") ?? input.directoryName;
  const description = fields.get("description") ?? "";
  let error: string | undefined = input.error;
  if (!error && !frontMatterMatch) error = "Missing YAML frontmatter";
  else if (!isValidProjectSkillName(name)) error = "Invalid skill name";
  else if (name !== input.directoryName) error = "Frontmatter name must match its folder";
  else if (!description) error = "Missing description";

  return {
    ...input,
    provider: input.provider ?? "codex",
    exists: input.exists ?? !input.error,
    name,
    description,
    valid: !error,
    ...(error ? { error } : {}),
  };
}

function stripYamlScalar(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length >= 2) {
    const first = trimmed[0];
    const last = trimmed.at(-1);
    if (first === '"' && last === '"') {
      try {
        const parsed: unknown = JSON.parse(trimmed);
        if (typeof parsed === "string") return parsed.trim();
      } catch {
        // Preserve the scalar when a hand-written value has invalid escaping.
      }
    }
    if (first === "'" && last === "'") {
      return trimmed.slice(1, -1).trim();
    }
  }
  return trimmed;
}

export function projectSkillInstructions(content: string): string {
  return content.replace(/^---\s*\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/u, "").trim();
}

export function isMissingProjectSkillsError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /(?:ENOENT|no such file|not found|does not exist|directory listing unavailable)/iu.test(
    message,
  );
}
