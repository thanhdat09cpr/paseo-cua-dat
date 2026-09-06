import { describe, expect, test } from "vitest";

import {
  resolveCreateAgentTitles,
  resolveFirstAgentPromptTitle,
  resolveFirstAgentWorkspaceTitle,
} from "./agent/create-agent-title.js";

describe("resolveCreateAgentTitles", () => {
  test("derives a provisional title from prompt when explicit title is absent", () => {
    const resolved = resolveCreateAgentTitles({
      configTitle: undefined,
      initialPrompt: "Implement auth retries with backoff\n\ninclude tests",
    });

    expect(resolved.explicitTitle).toBeNull();
    expect(resolved.provisionalTitle).toBe("Implement auth retries with backoff");
  });

  test("preserves explicit title and does not treat it as provisional", () => {
    const resolved = resolveCreateAgentTitles({
      configTitle: "  Keep This Title  ",
      initialPrompt: "Ignored prompt title",
    });

    expect(resolved.explicitTitle).toBe("Keep This Title");
    expect(resolved.provisionalTitle).toBe("Keep This Title");
  });

  test("returns null values when prompt and title are empty", () => {
    const resolved = resolveCreateAgentTitles({
      configTitle: "   ",
      initialPrompt: "   ",
    });

    expect(resolved.explicitTitle).toBeNull();
    expect(resolved.provisionalTitle).toBeNull();
  });
});

describe("first-agent workspace title", () => {
  test("uses the explicit agent title for the workspace while preserving prompt-only rename guards", () => {
    const context = {
      title: "Peer Reviewer",
      prompt: "Review every changed file and report exact findings",
      attachments: [],
    };

    expect(resolveFirstAgentWorkspaceTitle(context)).toBe("Peer Reviewer");
    expect(resolveFirstAgentPromptTitle(context)).toBe(
      "Review every changed file and report exact findings",
    );
  });
});
