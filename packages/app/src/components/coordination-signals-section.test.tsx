/**
 * @vitest-environment jsdom
 */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CoordinationSignal } from "@getpaseo/protocol/coordination-signal";

const { theme } = vi.hoisted(() => ({
  theme: {
    spacing: { 1: 4, 2: 8, 3: 12, 4: 16, 6: 24 },
    fontSize: { xs: 11, sm: 13, base: 15 },
    fontWeight: { normal: "400", medium: "500" },
    borderRadius: { md: 6, lg: 8, xl: 12, full: 999 },
    borderWidth: { 1: 1 },
    opacity: { 50: 0.5 },
    iconSize: { xs: 12, sm: 16, md: 20, lg: 24 },
    colors: {
      foreground: "#fff",
      foregroundMuted: "#aaa",
      foregroundExtraMuted: "#777",
      border: "#555",
      borderAccent: "#666",
      accent: "#0a84ff",
      accentForeground: "#fff",
      surface3: "#333",
      destructive: "#ff453a",
      destructiveForeground: "#fff",
      statusSuccess: "#30d158",
      statusWarning: "#ffcc00",
      statusDanger: "#ff453a",
      palette: {
        blue: { 300: "#7fb8ff" },
        amber: { 500: "#ffb800" },
      },
    },
  },
}));

vi.mock("react-native-unistyles", () => ({
  StyleSheet: {
    create: (factory: unknown) =>
      typeof factory === "function" ? (factory as (t: typeof theme) => unknown)(theme) : factory,
  },
  useUnistyles: () => ({ theme }),
  withUnistyles:
    (Component: React.ComponentType<Record<string, unknown>>) =>
    ({
      uniProps,
      ...rest
    }: {
      uniProps?: (t: typeof theme) => Record<string, unknown>;
    } & Record<string, unknown>) => {
      const themed = uniProps ? uniProps(theme) : {};
      return React.createElement(Component, { ...rest, ...themed });
    },
}));

const translations: Record<string, string> = {
  "agentPanel.coordinationSignals.title": "Coordination signals",
  "agentPanel.coordinationSignals.status.pending": "Pending",
  "agentPanel.coordinationSignals.status.acknowledged": "Acknowledged",
  "agentPanel.coordinationSignals.kind.continuity_attention": "Attention question",
  "agentPanel.coordinationSignals.kind.handoff_recommended": "Handoff recommended",
  "agentPanel.coordinationSignals.reasonLabel": "Reason",
  "agentPanel.coordinationSignals.evidenceLabel": "Evidence",
  "agentPanel.coordinationSignals.evidenceDetailLabel": "Evidence detail",
  "agentPanel.coordinationSignals.observationLabel": "Observation",
  "agentPanel.coordinationSignals.questionLabel": "Question",
  "agentPanel.coordinationSignals.resolution.acknowledged": "Acknowledge",
  "agentPanel.coordinationSignals.resolution.deferred": "Defer",
  "agentPanel.coordinationSignals.resolution.declined": "Decline",
  "agentPanel.coordinationSignals.resolution.completed": "Complete",
  "agentPanel.coordinationSignals.resolveErrorLabel": "Failed to resolve signal",
  "common.errors.daemonClientUnavailable": "Daemon client unavailable",
};

function hiddenHistoryCountLabel(count: number): string {
  return `+${count} earlier`;
}

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      if (key === "agentPanel.coordinationSignals.occurrenceCount") {
        return `Seen ${options?.count} times`;
      }
      if (key === "agentPanel.coordinationSignals.lastOccurredAt") {
        return `Last occurred ${options?.time}`;
      }
      if (key === "agentPanel.coordinationSignals.resolveAccessibilityLabel") {
        return `Mark signal as ${options?.resolution}`;
      }
      if (key === "agentPanel.coordinationSignals.hiddenHistoryCount") {
        return hiddenHistoryCountLabel(Number(options?.count));
      }
      return translations[key] ?? key;
    },
  }),
}));

interface MockClient {
  resolveCoordinationSignal: ReturnType<typeof vi.fn>;
}

interface MockSession {
  client: MockClient | null;
  serverInfo: { features: { coordinationSignalResolution: boolean } };
}

const resolveCoordinationSignal = vi.fn();
const mockSession: MockSession = {
  client: { resolveCoordinationSignal },
  serverInfo: { features: { coordinationSignalResolution: true } },
};
const mockSessionState = {
  sessions: { "server-1": mockSession } as Record<string, MockSession>,
};

vi.mock("@/stores/session-store", () => ({
  useSessionStore: Object.assign(
    (selector: (state: typeof mockSessionState) => unknown) => selector(mockSessionState),
    { getState: () => mockSessionState },
  ),
}));

vi.stubGlobal("React", React);
vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);

import { CoordinationSignalsSection } from "./coordination-signals-section";

function buildSignal(overrides: Partial<CoordinationSignal> = {}): CoordinationSignal {
  return {
    id: "signal-1",
    targetAgentId: "agent-1",
    requestedByAgentId: null,
    kind: "continuity_attention",
    reason: "Bounded attention question",
    evidenceRefs: ["timeline:turn-7"],
    status: "pending",
    createdAt: "2026-09-01T00:00:00.000Z",
    deliveredAt: null,
    resolvedAt: null,
    ...overrides,
  };
}

function findButtonByText(container: HTMLElement | null, text: string): HTMLElement {
  const buttons = container?.querySelectorAll('[role="button"]') ?? [];
  const match = Array.from(buttons).find((button) => button.textContent?.includes(text));
  if (!match) {
    throw new Error(`No button found with text ${text}`);
  }
  return match as HTMLElement;
}

function click(element: HTMLElement) {
  element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

describe("CoordinationSignalsSection", () => {
  let root: Root | null = null;
  let container: HTMLElement | null = null;

  beforeEach(() => {
    resolveCoordinationSignal.mockReset();
    mockSession.client = { resolveCoordinationSignal };
    mockSession.serverInfo = { features: { coordinationSignalResolution: true } };
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
    }
    root = null;
    container?.remove();
    container = null;
  });

  it("renders nothing when there are no signals", () => {
    act(() => {
      root?.render(<CoordinationSignalsSection signals={[]} />);
    });

    expect(container?.querySelector('[data-testid="coordination-signals-section"]')).toBeNull();
  });

  it("renders nothing when signals is undefined", () => {
    act(() => {
      root?.render(<CoordinationSignalsSection signals={undefined} />);
    });

    expect(container?.querySelector('[data-testid="coordination-signals-section"]')).toBeNull();
  });

  it("marks the section heading with an accessible header role", () => {
    act(() => {
      root?.render(<CoordinationSignalsSection signals={[buildSignal()]} />);
    });

    const heading = container?.querySelector('[role="heading"]');
    expect(heading).not.toBeNull();
    expect(heading?.textContent).toBe("Coordination signals");
  });

  it("shows status, reason, evidence, observation/question, and occurrence information", () => {
    const signal = buildSignal({
      occurrenceCount: 3,
      lastOccurredAt: "2026-09-02T00:00:00.000Z",
      observation: "The working stream reversed its ownership premise.",
      question: "Does this decision need to return to the Lead boundary?",
      evidence: { turnCount: 4 },
    });
    act(() => {
      root?.render(<CoordinationSignalsSection signals={[signal]} />);
    });

    const row = container?.querySelector('[data-testid="coordination-signal-signal-1"]');
    expect(row).not.toBeNull();
    expect(row?.textContent).toContain("Attention question");
    expect(row?.textContent).toContain("Pending");
    expect(row?.textContent).toContain("Reason: Bounded attention question");
    expect(row?.textContent).toContain(
      "Observation: The working stream reversed its ownership premise.",
    );
    expect(row?.textContent).toContain(
      "Question: Does this decision need to return to the Lead boundary?",
    );
    expect(row?.textContent).toContain("Evidence: timeline:turn-7");
    expect(row?.textContent).toContain("Evidence detail: turnCount=4");
    expect(row?.textContent).toContain("Seen 3 times");
    expect(row?.textContent).toContain("Last occurred 2026-09-02T00:00:00.000Z");
  });

  it("renders one row per signal", () => {
    const signals = [
      buildSignal({ id: "signal-1" }),
      buildSignal({ id: "signal-2", kind: "handoff_recommended", status: "acknowledged" }),
    ];
    act(() => {
      root?.render(<CoordinationSignalsSection signals={signals} />);
    });

    expect(container?.querySelector('[data-testid="coordination-signal-signal-1"]')).not.toBeNull();
    expect(container?.querySelector('[data-testid="coordination-signal-signal-2"]')).not.toBeNull();
  });

  it("shows every pending signal, bounds history to the 5 most recent, and reports a hidden count", () => {
    const pending = [
      buildSignal({ id: "pending-a", status: "pending" }),
      buildSignal({ id: "pending-b", status: "pending" }),
    ];
    // Deliberately out of order and mixing resolvedAt/lastOccurredAt/createdAt recency
    // sources: signal-4 has no resolvedAt but a later lastOccurredAt than signal-3, and
    // signal-7 has neither resolvedAt nor lastOccurredAt and falls back to createdAt.
    const history = [
      buildSignal({
        id: "history-1",
        status: "acknowledged",
        resolvedAt: "2026-01-01T00:00:00.000Z",
      }),
      buildSignal({
        id: "history-2",
        status: "acknowledged",
        resolvedAt: "2026-06-01T00:00:00.000Z",
      }),
      buildSignal({
        id: "history-3",
        status: "declined",
        resolvedAt: "2026-05-01T00:00:00.000Z",
      }),
      buildSignal({
        id: "history-4",
        status: "declined",
        resolvedAt: null,
        lastOccurredAt: "2026-05-15T00:00:00.000Z",
      }),
      buildSignal({
        id: "history-5",
        status: "completed",
        resolvedAt: "2026-04-01T00:00:00.000Z",
      }),
      buildSignal({
        id: "history-6",
        status: "completed",
        resolvedAt: "2026-03-01T00:00:00.000Z",
      }),
      buildSignal({
        id: "history-7",
        status: "completed",
        resolvedAt: null,
        lastOccurredAt: undefined,
        createdAt: "2026-02-01T00:00:00.000Z",
      }),
    ];

    act(() => {
      root?.render(<CoordinationSignalsSection signals={[...history, ...pending]} />);
    });

    const rowIds = Array.from(
      container?.querySelectorAll('[data-testid^="coordination-signal-"]') ?? [],
    )
      .map((el) => el.getAttribute("data-testid"))
      .filter((id): id is string => id !== null && !id.endsWith("-error"));

    // Every pending signal is visible and precedes all history rows.
    expect(rowIds.slice(0, 2).sort()).toEqual([
      "coordination-signal-pending-a",
      "coordination-signal-pending-b",
    ]);
    // Only the 5 most recent history signals (by resolvedAt/lastOccurredAt/createdAt) are
    // visible, most recent first; history-1 and history-7 (the two oldest) are omitted.
    expect(rowIds.slice(2)).toEqual([
      "coordination-signal-history-2",
      "coordination-signal-history-4",
      "coordination-signal-history-3",
      "coordination-signal-history-5",
      "coordination-signal-history-6",
    ]);
    expect(container?.querySelector('[data-testid="coordination-signal-history-1"]')).toBeNull();
    expect(container?.querySelector('[data-testid="coordination-signal-history-7"]')).toBeNull();

    const hiddenCount = container?.querySelector(
      '[data-testid="coordination-signals-hidden-history-count"]',
    );
    expect(hiddenCount).not.toBeNull();
    expect(hiddenCount?.textContent).toBe(hiddenHistoryCountLabel(2));
  });

  it("does not show a hidden-history count when history is within the bound", () => {
    const signals = [
      buildSignal({ id: "signal-1", status: "pending" }),
      buildSignal({
        id: "signal-2",
        status: "acknowledged",
        resolvedAt: "2026-01-01T00:00:00.000Z",
      }),
    ];
    act(() => {
      root?.render(<CoordinationSignalsSection signals={signals} />);
    });

    expect(
      container?.querySelector('[data-testid="coordination-signals-hidden-history-count"]'),
    ).toBeNull();
  });

  it("does not render resolve controls when canResolve is false", () => {
    const signal = buildSignal();
    act(() => {
      root?.render(
        <CoordinationSignalsSection
          signals={[signal]}
          agentId="agent-1"
          serverId="server-1"
          canResolve={false}
        />,
      );
    });

    expect(container?.querySelectorAll('[role="button"]').length).toBe(0);
  });

  it("does not render resolve controls for a non-pending signal", () => {
    const signal = buildSignal({ status: "acknowledged" });
    act(() => {
      root?.render(
        <CoordinationSignalsSection
          signals={[signal]}
          agentId="agent-1"
          serverId="server-1"
          canResolve={true}
        />,
      );
    });

    expect(container?.querySelectorAll('[role="button"]').length).toBe(0);
  });

  it("does not render resolve controls when the feature is unsupported by the daemon", () => {
    mockSession.serverInfo = { features: { coordinationSignalResolution: false } };
    const signal = buildSignal();
    act(() => {
      root?.render(
        <CoordinationSignalsSection
          signals={[signal]}
          agentId="agent-1"
          serverId="server-1"
          canResolve={true}
        />,
      );
    });

    expect(container?.querySelectorAll('[role="button"]').length).toBe(0);
  });

  it("does not render resolve controls when the daemon client is unavailable", () => {
    mockSession.client = null;
    const signal = buildSignal();
    act(() => {
      root?.render(
        <CoordinationSignalsSection
          signals={[signal]}
          agentId="agent-1"
          serverId="server-1"
          canResolve={true}
        />,
      );
    });

    expect(container?.querySelectorAll('[role="button"]').length).toBe(0);
  });

  it("resolves a pending signal and clears in-flight state on success", async () => {
    resolveCoordinationSignal.mockResolvedValue({ id: "signal-1", status: "acknowledged" });
    const signal = buildSignal();
    act(() => {
      root?.render(
        <CoordinationSignalsSection
          signals={[signal]}
          agentId="agent-1"
          serverId="server-1"
          canResolve={true}
        />,
      );
    });

    const acknowledgeButton = findButtonByText(container, "Acknowledge");

    await act(async () => {
      click(acknowledgeButton);
      await Promise.resolve();
    });

    expect(resolveCoordinationSignal).toHaveBeenCalledWith({
      agentId: "agent-1",
      signalId: "signal-1",
      resolution: "acknowledged",
    });
  });

  it("marks only the invoked action busy, disables its siblings, and blocks duplicate dispatch", async () => {
    let releasePending: (() => void) | null = null;
    resolveCoordinationSignal.mockImplementation(
      () =>
        new Promise((resolve) => {
          releasePending = () => resolve({ id: "signal-1", status: "acknowledged" });
        }),
    );
    const signal = buildSignal();
    act(() => {
      root?.render(
        <CoordinationSignalsSection
          signals={[signal]}
          agentId="agent-1"
          serverId="server-1"
          canResolve={true}
        />,
      );
    });

    const acknowledgeButton = findButtonByText(container, "Acknowledge");
    const deferButton = findButtonByText(container, "Defer");

    await act(async () => {
      click(acknowledgeButton);
      await Promise.resolve();
    });

    expect(acknowledgeButton.querySelector('[role="progressbar"]')).not.toBeNull();
    expect(deferButton.getAttribute("aria-disabled")).toBe("true");
    expect(deferButton.querySelector('[role="progressbar"]')).toBeNull();

    await act(async () => {
      click(acknowledgeButton);
      await Promise.resolve();
    });
    expect(resolveCoordinationSignal).toHaveBeenCalledTimes(1);

    await act(async () => {
      releasePending?.();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(acknowledgeButton.querySelector('[role="progressbar"]')).toBeNull();
    expect(deferButton.getAttribute("aria-disabled")).not.toBe("true");
  });

  it("serializes resolve mutations globally: a second signal cannot dispatch or appear enabled until the first settles, then re-enables", async () => {
    let releasePending: (() => void) | null = null;
    resolveCoordinationSignal.mockImplementation(
      () =>
        new Promise((resolve) => {
          releasePending = () => resolve({ id: "signal-1", status: "acknowledged" });
        }),
    );
    const signals = [buildSignal({ id: "signal-1" }), buildSignal({ id: "signal-2" })];
    act(() => {
      root?.render(
        <CoordinationSignalsSection
          signals={signals}
          agentId="agent-1"
          serverId="server-1"
          canResolve={true}
        />,
      );
    });

    const row1 = container?.querySelector(
      '[data-testid="coordination-signal-signal-1"]',
    ) as HTMLElement | null;
    const row2 = container?.querySelector(
      '[data-testid="coordination-signal-signal-2"]',
    ) as HTMLElement | null;
    const row1Acknowledge = findButtonByText(row1, "Acknowledge");
    const row2Acknowledge = findButtonByText(row2, "Acknowledge");
    const row2Defer = findButtonByText(row2, "Defer");

    await act(async () => {
      click(row1Acknowledge);
      await Promise.resolve();
    });

    expect(row1Acknowledge.querySelector('[role="progressbar"]')).not.toBeNull();
    // The second signal's row is fully disabled while the first signal's mutation is in
    // flight, not just the first signal's own siblings.
    expect(row2Acknowledge.getAttribute("aria-disabled")).toBe("true");
    expect(row2Defer.getAttribute("aria-disabled")).toBe("true");

    await act(async () => {
      click(row2Acknowledge);
      await Promise.resolve();
    });
    expect(resolveCoordinationSignal).toHaveBeenCalledTimes(1);
    expect(resolveCoordinationSignal).not.toHaveBeenCalledWith(
      expect.objectContaining({ signalId: "signal-2" }),
    );

    await act(async () => {
      releasePending?.();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(row1Acknowledge.querySelector('[role="progressbar"]')).toBeNull();
    expect(row2Acknowledge.getAttribute("aria-disabled")).not.toBe("true");
    expect(row2Defer.getAttribute("aria-disabled")).not.toBe("true");

    // The second signal can now dispatch its own mutation.
    resolveCoordinationSignal.mockResolvedValueOnce({ id: "signal-2", status: "acknowledged" });
    await act(async () => {
      click(row2Acknowledge);
      await Promise.resolve();
    });
    expect(resolveCoordinationSignal).toHaveBeenCalledTimes(2);
    expect(resolveCoordinationSignal).toHaveBeenLastCalledWith({
      agentId: "agent-1",
      signalId: "signal-2",
      resolution: "acknowledged",
    });
  });

  it("shows a localized title alongside the concrete error on failure", async () => {
    resolveCoordinationSignal.mockRejectedValue(new Error("Signal already resolved"));
    const signal = buildSignal();
    act(() => {
      root?.render(
        <CoordinationSignalsSection
          signals={[signal]}
          agentId="agent-1"
          serverId="server-1"
          canResolve={true}
        />,
      );
    });

    const declineButton = findButtonByText(container, "Decline");

    await act(async () => {
      click(declineButton);
      await Promise.resolve();
      await Promise.resolve();
    });

    const errorAlert = container?.querySelector(
      '[data-testid="coordination-signal-signal-1-error"]',
    );
    expect(errorAlert).not.toBeNull();
    expect(errorAlert?.getAttribute("role")).toBe("alert");
    expect(errorAlert?.textContent).toContain("Failed to resolve signal");
    expect(errorAlert?.textContent).toContain("Signal already resolved");
  });

  it("produces localized accessible failure feedback instead of a silent no-op when the client disappears mid-flight", async () => {
    const signal = buildSignal();
    act(() => {
      root?.render(
        <CoordinationSignalsSection
          signals={[signal]}
          agentId="agent-1"
          serverId="server-1"
          canResolve={true}
        />,
      );
    });

    const acknowledgeButton = findButtonByText(container, "Acknowledge");
    // Simulate a disconnect that happens after the button was rendered but
    // before the in-flight resolve call re-reads the client.
    mockSession.client = null;

    await act(async () => {
      click(acknowledgeButton);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(resolveCoordinationSignal).not.toHaveBeenCalled();
    const errorAlert = container?.querySelector(
      '[data-testid="coordination-signal-signal-1-error"]',
    );
    expect(errorAlert).not.toBeNull();
    expect(errorAlert?.getAttribute("role")).toBe("alert");
    expect(errorAlert?.textContent).toContain("Daemon client unavailable");
  });
});
