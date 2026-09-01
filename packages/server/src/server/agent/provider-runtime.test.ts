import { afterEach, describe, expect, test, vi } from "vitest";

import { createTestLogger } from "../../test-utils/test-logger.js";
import { createAgentProviderRuntime } from "./provider-runtime.js";
import { OpenCodeBridge } from "./providers/opencode/bridge.js";
import type { PaseoToolCatalog } from "./tools/types.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("agent provider runtime", () => {
  test("keeps the OpenCode bridge dormant while Product policy disables the provider", async () => {
    const start = vi.spyOn(OpenCodeBridge.prototype, "start").mockResolvedValue();
    const setManifestCatalog = vi
      .spyOn(OpenCodeBridge.prototype, "setManifestCatalog")
      .mockImplementation(() => undefined);
    const close = vi.spyOn(OpenCodeBridge.prototype, "close").mockResolvedValue();
    const runtime = await createAgentProviderRuntime({
      paseoHome: "/tmp/paseo-provider-runtime-test",
      logger: createTestLogger(),
      snapshotManager: {},
    });

    expect(runtime.snapshotManager.getAgentManagerProviderState().clients.opencode).toBeUndefined();
    runtime.setPaseoToolCatalog(emptyCatalog());
    await Promise.all([runtime.shutdown(), runtime.shutdown()]);

    expect(start).not.toHaveBeenCalled();
    expect(setManifestCatalog).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
  });
});

function emptyCatalog(): PaseoToolCatalog {
  return {
    tools: new Map(),
    getTool: () => undefined,
    executeTool: async () => {
      throw new Error("Unknown tool");
    },
  };
}
