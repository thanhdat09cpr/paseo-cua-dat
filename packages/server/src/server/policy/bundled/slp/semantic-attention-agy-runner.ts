import { spawn, type ChildProcess } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join } from "node:path";
import { createInterface } from "node:readline";
import type { Logger } from "pino";

import {
  buildSemanticAttentionPrompt,
  parseSemanticAttentionDecision,
  type SemanticAttentionClassifierConfig,
  type SemanticAttentionClassifierResult,
  type SemanticAttentionPacket,
} from "./semantic-attention-contract.js";

const MAX_STDOUT_BYTES = 128 * 1024;
const MAX_STDERR_BYTES = 16 * 1024;

function containsToolExecution(event: Record<string, unknown>): boolean {
  if (event.event !== "step_update") return false;
  const update = event.step_update;
  if (!update || typeof update !== "object") return true;
  const record = update as Record<string, unknown>;
  // AGY implements structured output with the non-actuating finish tool.
  if (
    (record.step_type === "finish" || record.step_type === "tool") &&
    record.tool_name === "finish" &&
    record.subagent_info === undefined
  )
    return false;
  if (record.tool_info !== undefined || record.subagent_info !== undefined) return true;
  const stepType = record.step_type;
  return (
    typeof stepType !== "string" ||
    /tool|command|subagent|manage_task|browser|file_edit/iu.test(stepType)
  );
}

function minimalEnvironment(): NodeJS.ProcessEnv {
  const keys = ["HOME", "PATH", "TMPDIR", "LANG", "LC_ALL"] as const;
  return Object.fromEntries(
    keys.flatMap((key) => (process.env[key] ? [[key, process.env[key]]] : [])),
  );
}

async function stopProcess(child: ChildProcess): Promise<void> {
  const signal = (value: NodeJS.Signals) => {
    try {
      if (process.platform !== "win32" && child.pid) process.kill(-child.pid, value);
      else child.kill(value);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
    }
  };
  signal("SIGTERM");
  await new Promise((resolve) => setTimeout(resolve, 1_000));
  signal("SIGKILL");
  if (process.platform !== "win32" && child.pid) {
    // Retain single-flight ownership until the complete process group disappears.
    const deadline = Date.now() + 2_000;
    for (;;) {
      if (Date.now() >= deadline) throw new Error("process_group_termination_unconfirmed");
      try {
        process.kill(-child.pid, 0);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ESRCH") break;
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }
}

export class SemanticAttentionAgyRunner {
  private busy = false;
  private quarantined = false;
  private readonly invocationTimes: number[] = [];

  constructor(
    private readonly config: SemanticAttentionClassifierConfig,
    private readonly logger: Logger,
  ) {}

  get mode() {
    return this.config.mode;
  }

  async classify(packet: SemanticAttentionPacket): Promise<SemanticAttentionClassifierResult> {
    if (this.config.mode === "off") return { status: "unavailable", reason: "disabled" };
    if (this.quarantined) return { status: "unavailable", reason: "termination_unconfirmed" };
    if (this.busy) return { status: "unavailable", reason: "runner_busy" };
    const now = Date.now();
    while (this.invocationTimes[0] !== undefined && this.invocationTimes[0] <= now - 60_000) {
      this.invocationTimes.shift();
    }
    if (this.invocationTimes.length >= this.config.maxInvocationsPerMinute) {
      return { status: "unavailable", reason: "rate_limited" };
    }
    if (!this.config.binaryPath) {
      return { status: "unavailable", reason: "binary_path_missing" };
    }
    if (!isAbsolute(this.config.binaryPath)) {
      return { status: "unavailable", reason: "binary_path_not_absolute" };
    }

    this.busy = true;
    this.invocationTimes.push(now);
    let cwd: string | undefined;
    try {
      cwd = await mkdtemp(join(tmpdir(), "paseo-attention-"));
      await mkdir(join(cwd, ".agents"), { mode: 0o700 });
      await writeFile(
        join(cwd, ".agents", "deny-tools.cjs"),
        `
let input = "";
process.stdin.on("data", chunk => { input += chunk; });
process.stdin.on("end", () => {
  let allowed = false;
  try { allowed = JSON.parse(input).toolCall?.name === "finish"; } catch {}
  process.stdout.write(JSON.stringify({ decision: allowed ? "allow" : "deny", reason: "Classifier permits structured completion only" }));
});
`,
        { mode: 0o600 },
      );
      await writeFile(
        join(cwd, ".agents", "hooks.json"),
        JSON.stringify({
          "paseo-classifier-boundary": {
            PreToolUse: [
              {
                matcher: "*",
                hooks: [
                  {
                    type: "command",
                    timeout: 3,
                    command: "node deny-tools.cjs",
                  },
                ],
              },
            ],
            PreInvocation: [
              {
                type: "command",
                timeout: 3,
                command: "printf ready > .paseo-hook-ready; printf '{}'",
              },
            ],
          },
        }),
        { mode: 0o600 },
      );
      return await this.runProcess(packet, cwd, this.config.binaryPath);
    } catch (error) {
      this.logger.warn({ err: error }, "Semantic attention classifier failed closed");
      return { status: "unavailable", reason: "runner_error" };
    } finally {
      this.busy = false;
      if (cwd) await rm(cwd, { recursive: true, force: true });
    }
  }

  private runProcess(
    packet: SemanticAttentionPacket,
    cwd: string,
    binaryPath: string,
  ): Promise<SemanticAttentionClassifierResult> {
    const outputSchema = {
      type: "object",
      additionalProperties: false,
      required: ["decision", "risk", "confidence", "reason", "evidenceRefs"],
      properties: {
        decision: { enum: ["ignore", "aggregate", "wake_candidate"] },
        risk: { enum: ["low", "medium", "high"] },
        confidence: { type: "number", minimum: 0, maximum: 1 },
        reason: { type: "string", maxLength: 240 },
        evidenceRefs: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 8 },
      },
    };
    const args = [
      "--add-dir",
      cwd,
      "--agent",
      this.config.agentProfile,
      "--input-format",
      "stream-json",
      "--output-format",
      "stream-json",
      "--json-schema",
      JSON.stringify(outputSchema),
      "--print-timeout",
      `${Math.ceil(this.config.timeoutMs / 1_000)}s`,
      "--model",
      this.config.model,
      "--effort",
      "low",
      "--sandbox",
      "--disable-slash-commands",
    ];

    return new Promise((resolve) => {
      const child = spawn(binaryPath, args, {
        cwd,
        detached: process.platform !== "win32",
        env: minimalEnvironment(),
        stdio: ["pipe", "pipe", "pipe"],
      });
      let termination: Promise<void> | undefined;
      const stop = () => {
        termination ??= stopProcess(child).catch(() => {
          // Never admit another child when process-tree termination cannot be proven.
          this.quarantined = true;
        });
      };
      let settled = false;
      let unsafe = false;
      let failureReason: string | undefined;
      let resultCount = 0;
      let structuredOutput: unknown;
      let usage: Record<string, number> | undefined;
      let stdoutBytes = 0;
      let stderrBytes = 0;
      const finish = (result: SemanticAttentionClassifierResult) => {
        if (settled) return;
        settled = true;
        clearTimeout(deadline);
        // Event listeners converge here; the settled guard enforces exactly-once resolution.
        // eslint-disable-next-line promise/no-multiple-resolved
        resolve(result);
      };
      const deadline = setTimeout(() => {
        stop();
        failureReason = "timeout";
      }, this.config.timeoutMs);
      deadline.unref();

      child.stdin.once("error", () => {
        stop();
        failureReason = "stdin_failed";
      });
      child.stdin.end(
        `${JSON.stringify({
          event: "user",
          message: { content: [{ type: "text", text: buildSemanticAttentionPrompt(packet) }] },
        })}\n`,
      );

      child.stderr.on("data", (chunk: Buffer | string) => {
        stderrBytes += Buffer.byteLength(chunk);
        if (stderrBytes > MAX_STDERR_BYTES) {
          failureReason = "stderr_limit";
          stop();
        }
      });
      // Count chunks before readline buffers incomplete lines.
      child.stdout.on("data", (chunk: Buffer | string) => {
        stdoutBytes += Buffer.byteLength(chunk);
        if (stdoutBytes > MAX_STDOUT_BYTES) {
          failureReason = "stdout_limit";
          child.stdout.pause();
          lines.close();
          stop();
        }
      });
      const lines = createInterface({ input: child.stdout });
      lines.on("line", (line) => {
        if (failureReason) return;
        let event: Record<string, unknown>;
        try {
          const parsed: unknown = JSON.parse(line);
          if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            failureReason = "invalid_stream_event";
            stop();
            return;
          }
          event = parsed as Record<string, unknown>;
        } catch {
          return;
        }
        if (containsToolExecution(event)) {
          unsafe = true;
          stop();
          return;
        }
        if (event.event !== "result") return;
        resultCount += 1;
        const result = event.result;
        if (!result || typeof result !== "object") return;
        const record = result as Record<string, unknown>;
        if (record.status === "SUCCESS") {
          structuredOutput = record.structured_output;
          if (structuredOutput === undefined && typeof record.response === "string") {
            try {
              structuredOutput = JSON.parse(record.response);
            } catch {
              structuredOutput = undefined;
            }
          }
          if (record.usage && typeof record.usage === "object") {
            usage = Object.fromEntries(
              Object.entries(record.usage as Record<string, unknown>).flatMap(([key, value]) =>
                typeof value === "number" && Number.isFinite(value) ? [[key, value]] : [],
              ),
            );
          }
        }
      });
      child.once("error", () => finish({ status: "unavailable", reason: "spawn_failed" }));
      child.once("close", async (code) => {
        if (termination) await termination;
        lines.close();
        if (settled) return;
        if (failureReason) return finish({ status: "unavailable", reason: failureReason });
        if (resultCount > 1) return finish({ status: "unavailable", reason: "duplicate_result" });
        if (unsafe) return finish({ status: "unavailable", reason: "unsafe_tool_event" });
        if (code !== 0 || structuredOutput === undefined) {
          return finish({ status: "unavailable", reason: "non_success_exit" });
        }
        try {
          if ((await readFile(join(cwd, ".agents", ".paseo-hook-ready"), "utf8")) !== "ready") {
            return finish({ status: "unavailable", reason: "tool_gate_not_loaded" });
          }
          const decision = parseSemanticAttentionDecision(structuredOutput, packet);
          finish({ status: "classified", decision, ...(usage ? { usage } : {}) });
        } catch {
          finish({ status: "unavailable", reason: "invalid_structured_output" });
        }
      });
    });
  }
}
