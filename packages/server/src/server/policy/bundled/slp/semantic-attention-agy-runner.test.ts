import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

import { createTestLogger } from "../../../../test-utils/test-logger.js";
import {
  SemanticAttentionClassifierConfigSchema,
  SemanticAttentionPacketSchema,
} from "./semantic-attention-contract.js";
import { SemanticAttentionAgyRunner } from "./semantic-attention-agy-runner.js";

const packet = SemanticAttentionPacketSchema.parse({
  version: 1,
  projectRef: "project-ref",
  sourceRole: "peer",
  eventKind: "semantic_friction",
  deterministicRule: "blocked_uncertainty",
  excerpt: "I am blocked because ownership is unclear.",
  evidenceRefs: ["evidence-1"],
});

async function fakeAgy(lines: string[]): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "semantic-agy-test-"));
  const binary = join(root, "agy");
  await writeFile(
    binary,
    `#!/bin/sh\nnode -e 'const fs=require("node:fs"); const cp=require("node:child_process"); const h=JSON.parse(fs.readFileSync(".agents/hooks.json","utf8"))["paseo-classifier-boundary"]; for(const x of h.PreInvocation) cp.execSync(x.command,{cwd:".agents"});'\n${lines.map((line) => `printf '%s\\n' '${line}'`).join("\n")}\n`,
    { mode: 0o700 },
  );
  return binary;
}

function config(binaryPath: string) {
  return SemanticAttentionClassifierConfigSchema.parse({
    mode: "active",
    binaryPath,
    model: "gemini-test",
    timeoutMs: 5_000,
  });
}

describe("semantic attention AGY runner", () => {
  test.skipIf(process.platform === "win32")(
    "rejects null stream events without throwing",
    async () => {
      const binary = await fakeAgy(["null"]);
      await expect(
        new SemanticAttentionAgyRunner(config(binary), createTestLogger()).classify(packet),
      ).resolves.toEqual({ status: "unavailable", reason: "invalid_stream_event" });
    },
  );

  test.skipIf(process.platform === "win32")("bounds stdout without a newline", async () => {
    const root = await mkdtemp(join(tmpdir(), "semantic-agy-output-"));
    const binary = join(root, "agy");
    await writeFile(
      binary,
      "#!/bin/sh\nexec node -e 'process.stdout.write(\"x\".repeat(200000)); setInterval(()=>{},1000)'\n",
      { mode: 0o700 },
    );
    await expect(
      new SemanticAttentionAgyRunner(config(binary), createTestLogger()).classify(packet),
    ).resolves.toEqual({ status: "unavailable", reason: "stdout_limit" });
  });

  test("fails closed when an enabled classifier has no executable path", async () => {
    const runner = new SemanticAttentionAgyRunner(
      SemanticAttentionClassifierConfigSchema.parse({ mode: "active" }),
      createTestLogger(),
    );
    await expect(runner.classify(packet)).resolves.toEqual({
      status: "unavailable",
      reason: "binary_path_missing",
    });
  });

  test.skipIf(process.platform === "win32")(
    "accepts one strict result from an isolated direct run",
    async () => {
      const response = JSON.stringify({
        decision: "wake_candidate",
        risk: "high",
        confidence: 0.9,
        reason: "The ownership ambiguity can change the accepted scope.",
        evidenceRefs: ["evidence-1"],
      });
      const binary = await fakeAgy([
        JSON.stringify({
          event: "init",
          conversation_id: "test",
          init: { tools: ["run_command"] },
        }),
        JSON.stringify({
          event: "step_update",
          step_update: { step_type: "user_input", state: "DONE" },
        }),
        JSON.stringify({
          event: "step_update",
          step_update: { step_type: "agent_response", state: "DONE" },
        }),
        JSON.stringify({
          event: "step_update",
          step_update: {
            step_type: "finish",
            state: "DONE",
            tool_name: "finish",
            tool_info: { name: "finish" },
          },
        }),
        JSON.stringify({
          event: "result",
          result: {
            status: "SUCCESS",
            response: JSON.stringify({ ...JSON.parse(response), toolAction: "Completing task" }),
            structured_output: JSON.parse(response),
            usage: { input_tokens: 10, output_tokens: 2 },
          },
        }),
      ]);
      const runner = new SemanticAttentionAgyRunner(config(binary), createTestLogger());
      await expect(runner.classify(packet)).resolves.toMatchObject({
        status: "classified",
        decision: { decision: "wake_candidate", risk: "high" },
        usage: { input_tokens: 10, output_tokens: 2 },
      });
    },
  );

  test.skipIf(process.platform === "win32")(
    "rejects any streamed tool event even when a valid result follows",
    async () => {
      const binary = await fakeAgy([
        JSON.stringify({
          event: "step_update",
          step_update: { step_type: "tool_call", tool_name: "manage_task" },
        }),
        JSON.stringify({
          event: "result",
          result: { status: "SUCCESS", response: "{}" },
        }),
      ]);
      const runner = new SemanticAttentionAgyRunner(config(binary), createTestLogger());
      await expect(runner.classify(packet)).resolves.toEqual({
        status: "unavailable",
        reason: "unsafe_tool_event",
      });
    },
  );

  test("fails closed for a relative executable", async () => {
    const runner = new SemanticAttentionAgyRunner(config("agy"), createTestLogger());
    await expect(runner.classify(packet)).resolves.toEqual({
      status: "unavailable",
      reason: "binary_path_not_absolute",
    });
  });
  test.skipIf(process.platform === "win32")("rejects duplicate final results", async () => {
    const result = JSON.stringify({
      event: "result",
      result: {
        status: "SUCCESS",
        structured_output: {
          decision: "ignore",
          risk: "low",
          confidence: 0.9,
          reason: "No concern",
          evidenceRefs: ["evidence-1"],
        },
      },
    });
    const binary = await fakeAgy([result, result]);
    await expect(
      new SemanticAttentionAgyRunner(config(binary), createTestLogger()).classify(packet),
    ).resolves.toEqual({ status: "unavailable", reason: "duplicate_result" });
  });
  test.skipIf(process.platform === "win32")(
    "holds single-flight until timed-out child has exited",
    async () => {
      const root = await mkdtemp(join(tmpdir(), "semantic-agy-timeout-"));
      const binary = join(root, "agy");
      await writeFile(binary, "#!/bin/sh\ntrap '' TERM\nsleep 20\n", { mode: 0o700 });
      const runner = new SemanticAttentionAgyRunner(
        { ...config(binary), maxInvocationsPerMinute: 30 },
        createTestLogger(),
      );
      const pending = runner.classify(packet);
      await new Promise((resolve) => setTimeout(resolve, 5_150));
      await expect(runner.classify(packet)).resolves.toMatchObject({
        status: "unavailable",
        reason: "runner_busy",
      });
      await expect(pending).resolves.toMatchObject({ status: "unavailable", reason: "timeout" });
    },
    10_000,
  );
});
