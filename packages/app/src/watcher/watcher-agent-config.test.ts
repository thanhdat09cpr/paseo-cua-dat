import { describe, expect, test } from "vitest";
import type { ProviderSnapshotEntry } from "@getpaseo/protocol/agent-types";
import {
  isProjectWatcher,
  selectWatcherProvider,
  watcherLabels,
  WATCHER_SYSTEM_PROMPT,
} from "./watcher-agent-config";

function entry(overrides: Partial<ProviderSnapshotEntry> = {}): ProviderSnapshotEntry {
  return {
    provider: "gemini-antigravity",
    status: "ready",
    enabled: true,
    modes: [{ id: "plan", label: "Plan", description: "Read only" }],
    models: [
      { provider: "gemini-antigravity", id: "gemini-pro", label: "Gemini Pro" },
      { provider: "gemini-antigravity", id: "gemini-flash", label: "Gemini Flash" },
      {
        provider: "gemini-antigravity",
        id: "gemini-3.8-flash",
        label: "Gemini 3.8 Flash",
      },
    ],
    ...overrides,
  };
}

describe("watcher agent config", () => {
  test("selects an advertised Gemini Flash model", () => {
    expect(selectWatcherProvider([entry()])).toMatchObject({
      provider: "gemini-antigravity",
      model: "gemini-3.8-flash",
      providerModel: "gemini-antigravity/gemini-3.8-flash",
      modeId: "plan",
    });
  });

  test("prefers the low effort Flash variant when Antigravity advertises tiers", () => {
    const models = ["high", "medium", "low"].map((effort) => ({
      provider: "gemini-antigravity",
      id: `gemini-3.8-flash-${effort}`,
      label: `Gemini 3.8 Flash (${effort})`,
    }));
    expect(selectWatcherProvider([entry({ models })])).toMatchObject({
      provider: "gemini-antigravity",
      model: "gemini-3.8-flash-low",
      providerModel: "gemini-antigravity/gemini-3.8-flash-low",
    });
  });

  test("does not invent a provider when Gemini is unavailable", () => {
    expect(
      selectWatcherProvider([
        entry({
          provider: "claude",
          models: [{ provider: "claude", id: "haiku", label: "Haiku" }],
        }),
      ]),
    ).toBeNull();
  });

  test("does not trust a display label as the provider identity", () => {
    expect(selectWatcherProvider([entry({ provider: "custom", label: "Gemini" })])).toBeNull();
  });

  test("does not use the retired Gemini CLI provider", () => {
    expect(selectWatcherProvider([entry({ provider: "gemini" })])).toBeNull();
  });

  test("fails closed when Gemini does not advertise a read-only mode", () => {
    expect(
      selectWatcherProvider([entry({ modes: [{ id: "default", label: "Default" }] })]),
    ).toBeNull();
  });

  test("identifies the project scoped watcher by labels", () => {
    const labels = watcherLabels("project-1");
    expect(isProjectWatcher({ labels }, "project-1")).toBe(true);
    expect(isProjectWatcher({ labels }, "project-2")).toBe(false);
    expect(WATCHER_SYSTEM_PROMPT).toContain("read-only");
  });
});
