import { readFileSync } from "node:fs";
import { z } from "zod";
import { writePrivateFileAtomicSync } from "../../../private-files.js";
import {
  opaqueAttentionRef,
  type SemanticAttentionDecision,
} from "./semantic-attention-contract.js";

const EntrySchema = z.object({
  count: z.number().int().min(1).max(100),
  lastEvidenceRef: z.string().max(128),
  updatedAt: z.number(),
});
const CooldownSchema = z.object({
  updatedAt: z.number(),
});
const StateSchema = z.object({
  version: z.literal(1),
  entries: z.record(z.string(), EntrySchema),
  cooldowns: z.record(z.string(), CooldownSchema).default({}),
});
const MAX_ENTRIES = 1_024;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1_000;
export const SEMANTIC_ATTENTION_COOLDOWN_MS = 10 * 60 * 1_000;

/** One daemon owns this file; synchronous atomic updates serialize all project lanes. */
export class SemanticAttentionProjectStore {
  constructor(private readonly filePath?: string) {}
  private memory: z.infer<typeof StateSchema> = { version: 1, entries: {}, cooldowns: {} };

  private read() {
    if (!this.filePath) return this.memory;
    try {
      return StateSchema.parse(JSON.parse(readFileSync(this.filePath, "utf8")));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT")
        return { version: 1 as const, entries: {}, cooldowns: {} };
      throw error;
    }
  }

  private key(namespace: string, projectRef: string, ruleId: string) {
    return opaqueAttentionRef(`${namespace}\u0000${projectRef}\u0000${ruleId}`);
  }

  private cooldownKey(namespace: string, projectRef: string, ruleId: string, fingerprint: string) {
    return opaqueAttentionRef(`${namespace}\u0000${projectRef}\u0000${ruleId}\u0000${fingerprint}`);
  }

  getCount(namespace: string, projectRef: string, ruleId: string): number {
    const entry = this.read().entries[this.key(namespace, projectRef, ruleId)];
    return entry && entry.updatedAt > Date.now() - MAX_AGE_MS ? entry.count : 0;
  }

  isCoolingDown(
    namespace: string,
    projectRef: string,
    ruleId: string,
    fingerprint: string,
  ): boolean {
    const cooldown =
      this.read().cooldowns[this.cooldownKey(namespace, projectRef, ruleId, fingerprint)];
    return cooldown?.updatedAt > Date.now() - SEMANTIC_ATTENTION_COOLDOWN_MS;
  }

  update(
    namespace: string,
    projectRef: string,
    ruleId: string,
    evidenceRef: string,
    fingerprint: string,
    decision: SemanticAttentionDecision,
  ): void {
    const state = this.read();
    const key = this.key(namespace, projectRef, ruleId);
    const now = Date.now();
    const entries = Object.fromEntries(
      Object.entries(state.entries).filter(([, entry]) => entry.updatedAt > now - MAX_AGE_MS),
    );
    const cooldowns = Object.fromEntries(
      Object.entries(state.cooldowns).filter(
        ([, cooldown]) => cooldown.updatedAt > now - SEMANTIC_ATTENTION_COOLDOWN_MS,
      ),
    );
    if (decision.decision === "aggregate") {
      const prior = entries[key];
      entries[key] = {
        count: Math.min(
          100,
          (prior?.count ?? 0) + (prior?.lastEvidenceRef === evidenceRef ? 0 : 1),
        ),
        lastEvidenceRef: evidenceRef,
        updatedAt: now,
      };
    } else {
      delete entries[key];
    }
    cooldowns[this.cooldownKey(namespace, projectRef, ruleId, fingerprint)] = {
      updatedAt: now,
    };
    const next = {
      version: 1 as const,
      entries: Object.fromEntries(
        Object.entries(entries)
          .sort(([, a], [, b]) => b.updatedAt - a.updatedAt)
          .slice(0, MAX_ENTRIES),
      ),
      cooldowns: Object.fromEntries(
        Object.entries(cooldowns)
          .sort(([, a], [, b]) => b.updatedAt - a.updatedAt)
          .slice(0, MAX_ENTRIES),
      ),
    };
    if (this.filePath) writePrivateFileAtomicSync(this.filePath, JSON.stringify(next));
    else this.memory = next;
  }
}
