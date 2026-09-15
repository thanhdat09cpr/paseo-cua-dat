import { createHash } from "node:crypto";

import type { AgentTimelineRow } from "../../../agent/agent-timeline-store-types.js";

export type SweepCoverageStatus = "complete" | "partial" | "gap" | "failed";

export interface SemanticAttentionSweepPendingRow {
  seq: number;
  offset: number;
  digest: string;
}

export interface SemanticAttentionSweepCheckpoint {
  epoch: string | null;
  seq: number;
  rowDigests: Record<string, string>;
  /** A visible row whose rendered content continues in the next bounded packet. */
  pendingRow?: SemanticAttentionSweepPendingRow;
  coverage: SweepCoverageStatus;
  coverageDebt: number;
  lastSweepAt?: string;
}

const MAX_ROW_DIGESTS = 32;

export const INITIAL_SEMANTIC_ATTENTION_SWEEP_CHECKPOINT: SemanticAttentionSweepCheckpoint = {
  epoch: null,
  seq: 0,
  rowDigests: {},
  coverage: "partial",
  coverageDebt: 0,
};

export function parseSemanticAttentionSweepCheckpoint(
  value: unknown,
): SemanticAttentionSweepCheckpoint {
  if (!value || typeof value !== "object") {
    return { ...INITIAL_SEMANTIC_ATTENTION_SWEEP_CHECKPOINT };
  }
  const input = value as Record<string, unknown>;
  const epoch = typeof input.epoch === "string" ? input.epoch : null;
  const seq =
    typeof input.seq === "number" && Number.isInteger(input.seq) && input.seq >= 0 ? input.seq : 0;
  const rowDigests = parseRowDigests(input.rowDigests);
  const coverage = input.coverage;
  const validCoverage: SweepCoverageStatus =
    coverage === "complete" || coverage === "gap" || coverage === "failed" ? coverage : "partial";
  const coverageDebt =
    typeof input.coverageDebt === "number" &&
    Number.isInteger(input.coverageDebt) &&
    input.coverageDebt >= 0
      ? Math.min(100, input.coverageDebt)
      : 0;
  const pendingRow = parsePendingRow(input.pendingRow);
  return {
    epoch,
    seq,
    rowDigests,
    ...(pendingRow ? { pendingRow } : {}),
    coverage: validCoverage,
    coverageDebt,
    ...(typeof input.lastSweepAt === "string" ? { lastSweepAt: input.lastSweepAt } : {}),
  };
}

function parseRowDigests(value: unknown): Record<string, string> {
  const rowDigests: Record<string, string> = {};
  if (value && typeof value === "object") {
    for (const [key, digest] of Object.entries(value)) {
      if (rowDigestsCount(rowDigests) >= MAX_ROW_DIGESTS) break;
      if (/^\d+:[^:]{1,128}$/u.test(key) && /^[a-z0-9]{16,128}$/u.test(String(digest))) {
        rowDigests[key] = String(digest);
      }
    }
  }
  return rowDigests;
}

function parsePendingRow(input: unknown): SemanticAttentionSweepPendingRow | undefined {
  if (!input || typeof input !== "object") return undefined;
  const { seq, offset, digest } = input as Record<string, unknown>;
  if (
    typeof seq !== "number" ||
    !Number.isInteger(seq) ||
    seq < 0 ||
    typeof offset !== "number" ||
    !Number.isInteger(offset) ||
    offset < 0 ||
    typeof digest !== "string" ||
    !/^[a-z0-9]{16,128}$/u.test(digest)
  )
    return undefined;
  return { seq, offset, digest };
}

function rowDigestsCount(rowDigests: Record<string, string>): number {
  return Object.keys(rowDigests).length;
}

export function digestSemanticAttentionTimelineRow(row: AgentTimelineRow): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        seq: row.seq,
        timestamp: row.timestamp,
        turnId: row.turnId ?? null,
        item: row.item,
      }),
    )
    .digest("hex")
    .slice(0, 32);
}

export function withSweepRowDigests(
  checkpoint: SemanticAttentionSweepCheckpoint,
  epoch: string,
  rows: readonly AgentTimelineRow[],
): Record<string, string> {
  const next =
    checkpoint.epoch === epoch ? { ...checkpoint.rowDigests } : ({} as Record<string, string>);
  for (const row of rows) next[`${row.seq}:${epoch}`] = digestSemanticAttentionTimelineRow(row);
  const entries = Object.entries(next).sort((left, right) => {
    const leftSeq = Number(left[0].split(":", 1)[0]);
    const rightSeq = Number(right[0].split(":", 1)[0]);
    return rightSeq - leftSeq;
  });
  return Object.fromEntries(entries.slice(0, MAX_ROW_DIGESTS));
}

export function semanticAttentionSweepRowChanged(
  checkpoint: SemanticAttentionSweepCheckpoint,
  epoch: string,
  row: AgentTimelineRow,
): boolean {
  return (
    checkpoint.epoch !== epoch ||
    checkpoint.rowDigests[`${row.seq}:${epoch}`] !== digestSemanticAttentionTimelineRow(row)
  );
}
