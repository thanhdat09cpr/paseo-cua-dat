import { z } from "zod";

export const CoordinationSignalKindSchema = z.enum([
  "continuity_attention",
  "handoff_recommended",
  "detach_recommended",
]);

export const ManualCoordinationSignalKindSchema = z.enum([
  "handoff_recommended",
  "detach_recommended",
]);

export const CoordinationSignalTriggerSchema = z.enum([
  "context_pressure",
  "automatic_compaction",
  "repeated_failure",
  "successor_ready",
  "ownership_anomaly",
]);

export const CoordinationSignalSeveritySchema = z.enum(["info", "warning", "critical"]);

export const CoordinationSignalRecipientRoleSchema = z.enum(["lead", "supervisor"]);

export const CoordinationSignalSourceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("human") }),
  z.object({ kind: z.literal("agent"), agentId: z.string().min(1) }),
  z.object({
    kind: z.literal("paseo"),
    ruleId: z.string().min(1),
    version: z.number().int().positive(),
  }),
]);

const CoordinationSignalEvidenceValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
]);

export const CoordinationSignalOccurrenceSchema = z.object({
  occurredAt: z.string().datetime(),
  evidenceRefs: z.array(z.string().trim().min(1).max(500)).max(20),
  evidence: z.record(z.string(), CoordinationSignalEvidenceValueSchema).optional(),
});

export const CoordinationSignalResolutionSchema = z.enum([
  "acknowledged",
  "deferred",
  "declined",
  "completed",
]);

export const CoordinationSignalStatusSchema = z.union([
  z.literal("pending"),
  CoordinationSignalResolutionSchema,
]);

export const CoordinationSignalSchema = z.object({
  id: z.string().min(1),
  targetAgentId: z.string().min(1),
  requestedByAgentId: z.string().min(1).nullable(),
  workspaceId: z.string().min(1).optional(),
  kind: CoordinationSignalKindSchema,
  trigger: CoordinationSignalTriggerSchema.optional(),
  customEvent: z.string().trim().min(1).max(200).optional(),
  severity: CoordinationSignalSeveritySchema.optional(),
  recipientRole: CoordinationSignalRecipientRoleSchema.optional(),
  source: CoordinationSignalSourceSchema.optional(),
  coalescingKey: z.string().trim().min(1).max(500).optional(),
  reason: z.string().trim().min(1).max(1_000),
  observation: z.string().trim().min(1).max(1_000).optional(),
  question: z.string().trim().min(1).max(1_000).optional(),
  relatedAgentId: z.string().min(1).optional(),
  evidenceRefs: z.array(z.string().trim().min(1).max(500)).max(20).default([]),
  evidence: z.record(z.string(), CoordinationSignalEvidenceValueSchema).optional(),
  occurrenceCount: z.number().int().positive().optional(),
  lastOccurredAt: z.string().datetime().optional(),
  occurrences: z.array(CoordinationSignalOccurrenceSchema).max(20).optional(),
  status: CoordinationSignalStatusSchema,
  createdAt: z.string().datetime(),
  deliveredAt: z.string().datetime().nullable(),
  resolvedAt: z.string().datetime().nullable(),
  resolutionNote: z.string().trim().max(1_000).optional(),
});

export type CoordinationSignal = z.infer<typeof CoordinationSignalSchema>;
export type CoordinationSignalKind = z.infer<typeof CoordinationSignalKindSchema>;
export type CoordinationSignalResolution = z.infer<typeof CoordinationSignalResolutionSchema>;
export type CoordinationSignalRecipientRole = z.infer<typeof CoordinationSignalRecipientRoleSchema>;
export type CoordinationSignalSeverity = z.infer<typeof CoordinationSignalSeveritySchema>;
export type CoordinationSignalSource = z.infer<typeof CoordinationSignalSourceSchema>;
export type CoordinationSignalTrigger = z.infer<typeof CoordinationSignalTriggerSchema>;
