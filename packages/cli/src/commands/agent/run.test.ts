import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildCliAssignment,
  resolveExistingRunWorkspace,
  resolveRunCallerAgentId,
  runRunCommand,
  type AgentRunOptions,
} from "./run";

describe("managed agent caller context", () => {
  it("propagates a trimmed PASEO_AGENT_ID", () => {
    expect(resolveRunCallerAgentId({ PASEO_AGENT_ID: "  parent-agent  " })).toBe("parent-agent");
  });

  it("omits blank caller ids", () => {
    expect(resolveRunCallerAgentId({ PASEO_AGENT_ID: "   " })).toBeUndefined();
  });
});

describe("CLI assignment issue grants", () => {
  it("normalizes exact Peer issue grants into the immutable envelope", () => {
    expect(
      buildCliAssignment({
        roleId: "peer",
        effectClass: "mutating",
        objective: "Implement the granted issue",
        cwd: "/repo",
        beadsIssueIds: [" ps123-abc ", "ps123-abc"],
      }),
    ).toMatchObject({
      resourceGrants: { beadsIssueIds: ["ps123-abc"] },
      externalEffectBoundary: {
        mode: "bounded",
        scope: "Beads Central issue/work graph for this assignment only; no other external effects",
      },
    });
  });
});

describe("CLI supervisor notebook and lead-workspace construction", () => {
  it("resolves a Supervisor delegation write scope to the exact notebook file", () => {
    expect(
      buildCliAssignment({
        roleId: "supervisor",
        effectClass: "delegation",
        objective: "Coordinate Leads and keep the notebook",
        cwd: "/repo",
        writeScope: "SUPERVISOR_NOTEBOOK.md",
      }).mutationBoundary,
    ).toEqual({ mode: "bounded-write", scope: "/repo/SUPERVISOR_NOTEBOOK.md" });
  });

  it("keeps a Supervisor delegation no-write without an explicit write scope", () => {
    expect(
      buildCliAssignment({
        roleId: "supervisor",
        effectClass: "delegation",
        objective: "Coordinate Leads only",
        cwd: "/repo",
      }).mutationBoundary,
    ).toEqual({ mode: "no-write" });
  });

  it("carries exact lead-workspace grants on a Supervisor delegation", () => {
    expect(
      buildCliAssignment({
        roleId: "supervisor",
        effectClass: "delegation",
        objective: "Staff a product Lead into the product workspace",
        cwd: "/repo",
        leadWorkspaceIds: [" wks_4d70c7554d658f5d ", "wks_4d70c7554d658f5d"],
      }).resourceGrants,
    ).toEqual({ leadWorkspaceIds: ["wks_4d70c7554d658f5d"] });
  });
});

describe("existing run workspace resolution", () => {
  it("queries the daemon for an exact workspace id and uses its directory", async () => {
    const fetchWorkspaces = vi.fn().mockResolvedValue({
      entries: [{ id: "workspace-2", workspaceDirectory: "/workspace/two" }],
      pageInfo: { nextCursor: null },
    });

    await expect(resolveExistingRunWorkspace({ fetchWorkspaces }, "workspace-2")).resolves.toEqual({
      id: "workspace-2",
      cwd: "/workspace/two",
    });
    expect(fetchWorkspaces).toHaveBeenCalledWith({
      filter: { query: "workspace-2" },
      page: { limit: 200 },
    });
  });

  it("rejects a workspace id absent from daemon state", async () => {
    const fetchWorkspaces = vi.fn().mockResolvedValue({
      entries: [],
      pageInfo: { nextCursor: null },
    });

    await expect(resolveExistingRunWorkspace({ fetchWorkspaces }, "missing")).rejects.toMatchObject(
      {
        code: "WORKSPACE_NOT_FOUND",
        message: "Workspace not found: missing",
      },
    );
  });
});

// validateRunOptions runs before the CLI ever connects to a daemon, so these
// invalid combinations reject without one running.
describe("runRunCommand option validation", () => {
  const originalWorkspaceId = process.env.PASEO_WORKSPACE_ID;

  beforeEach(() => {
    delete process.env.PASEO_WORKSPACE_ID;
  });

  afterEach(() => {
    if (originalWorkspaceId === undefined) {
      delete process.env.PASEO_WORKSPACE_ID;
    } else {
      process.env.PASEO_WORKSPACE_ID = originalWorkspaceId;
    }
  });

  async function expectInvalidOptions(options: AgentRunOptions, messageMatch: RegExp) {
    await expect(runRunCommand("do something", options, {} as never)).rejects.toMatchObject({
      code: "INVALID_OPTIONS",
      message: expect.stringMatching(messageMatch),
    });
  }

  it("rejects --new-workspace combined with --workspace", async () => {
    await expectInvalidOptions(
      { newWorkspace: "worktree", workspace: "ws-1" },
      /--new-workspace and --workspace cannot be combined/,
    );
  });

  it("allows explicit worktree workspace creation through validation", async () => {
    // Explicit workspace creation with no --workspace
    // must clear validation. It still fails later (provider resolution), which
    // is enough to prove the new guard did not reject it.
    await expect(
      runRunCommand("do something", { newWorkspace: "worktree", provider: undefined }, {} as never),
    ).rejects.not.toMatchObject({ code: "INVALID_OPTIONS" });
  });

  it("rejects unknown new workspace kinds", async () => {
    await expectInvalidOptions({ newWorkspace: "container" }, /Unsupported new workspace kind/);
  });

  it("rejects two workspace creation flags", async () => {
    await expectInvalidOptions(
      { newWorkspace: "local", worktree: "legacy-slug" },
      /--new-workspace and --worktree cannot be combined/,
    );
  });

  it("rejects an unknown worktree creation mode before connecting", async () => {
    await expectInvalidOptions(
      { newWorkspace: "worktree", worktreeMode: "container" },
      /Unsupported worktree mode/,
    );
  });

  it("rejects an unknown Paseo role before connecting", async () => {
    await expectInvalidOptions({ role: "architect" }, /Unsupported Paseo role/);
  });

  it("requires an explicit assignment effect for a role", async () => {
    await expectInvalidOptions({ role: "lead" }, /--assignment-effect is required with --role/);
  });

  it("rejects write scope for a no-write effect", async () => {
    await expectInvalidOptions(
      { role: "lead", assignmentEffect: "read-only", writeScope: "src/**" },
      /--write-scope is not allowed for read-only/,
    );
  });

  it("allows a read-only Peer without a grant and requires one for mutation", async () => {
    await expect(
      runRunCommand(
        "inspect current bytes",
        { role: "peer", assignmentEffect: "read-only", json: true },
        {} as never,
      ),
    ).rejects.not.toMatchObject({ code: "INVALID_OPTIONS" });
    await expectInvalidOptions(
      { role: "peer", assignmentEffect: "mutating" },
      /--beads-issue is required with --role peer --assignment-effect mutating/,
    );
  });

  it("rejects Peer issue grants on another role", async () => {
    await expectInvalidOptions(
      { role: "lead", assignmentEffect: "read-only", beadsIssue: ["ps123-abc"] },
      /--beads-issue is only valid with --role peer/,
    );
  });

  it("rejects a delegation write scope for a non-Supervisor role", async () => {
    await expectInvalidOptions(
      { role: "lead", assignmentEffect: "delegation", writeScope: "SUPERVISOR_NOTEBOOK.md" },
      /--write-scope is not allowed for delegation/,
    );
  });

  it("allows a Supervisor delegation notebook write scope through validation", async () => {
    await expect(
      runRunCommand(
        "coordinate leads",
        {
          role: "supervisor",
          assignmentEffect: "delegation",
          writeScope: "SUPERVISOR_NOTEBOOK.md",
          provider: undefined,
        },
        {} as never,
      ),
    ).rejects.not.toMatchObject({ code: "INVALID_OPTIONS" });
  });

  it("rejects lead-workspace grants outside a Supervisor delegation", async () => {
    await expectInvalidOptions(
      { role: "lead", assignmentEffect: "mutating", leadWorkspace: ["wks_x"] },
      /--lead-workspace is only valid with --role supervisor --assignment-effect delegation/,
    );
  });
});
