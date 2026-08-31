import { createHash } from "node:crypto";
import type { LeadHandoffTransition } from "@getpaseo/protocol/lead-handoff";
import type { PaseoRoleId } from "@getpaseo/protocol/role-binding";

export const SLP_COORDINATION_POLICY_VERSION = "4";

export const SLP_COORDINATION_TOOL_DESCRIPTIONS = {
  prepareLeadHandoff:
    "Persist an immutable adjacent-Lead handoff packet. The predecessor remains write Owner; this does not authorize or release either Lead.",
  transitionLeadHandoff:
    "Record explicit Human authorization/release or the designated successor's acknowledgement/rejection. Final release requires an idle predecessor, closes its runtime while retaining the durable record, transfers current write ownership, and blocks later predecessor prompts without detaching, archiving, or changing role binding.",
  signalAgent:
    "Send a durable advisory handoff or detach recommendation to a role-bound Lead. Delivery waits for an idle boundary and never replaces an active run.",
  askAttentionQuestion:
    "Ask a role-bound Lead or Peer one evidence-backed attention question at a safe boundary. The question cannot command, decide, accept, transfer ownership, or change authority.",
  resolveAgentSignal:
    "Record the receiving role's autonomous disposition of a coordination signal. This does not report to or transfer authority to the sender.",
} as const;

const CLARIFICATION_TOPIC =
  "(?:evidence|observation|assumption|uncertainty|risk|constraint|inconsistency|interpretation|status)";
const CLARIFICATION_OBJECT =
  "(?:evidence|observation|assumption|uncertainty|risk|constraint|inconsistency|interpretation|status|record|plan|conclusion|delay)";
const CLARIFICATION_QUESTION_GRAMMARS = [
  new RegExp(
    `^what evidence (?:supports|contradicts) the (?:current )?${CLARIFICATION_OBJECT}\\?$`,
    "iu",
  ),
  new RegExp(`^what evidence is missing from the (?:current )?${CLARIFICATION_OBJECT}\\?$`, "iu"),
  new RegExp(
    `^which ${CLARIFICATION_TOPIC} (?:remains uncertain|remains unsupported by the cited (?:evidence|trace)|explains the observed delay)\\?$`,
    "iu",
  ),
  new RegExp(
    `^what ${CLARIFICATION_TOPIC} (?:explains the observed delay|is reflected in the current (?:evidence|observation|status))\\?$`,
    "iu",
  ),
  new RegExp(
    `^why does (?:this|the current) ${CLARIFICATION_TOPIC} (?:conflict with|differ from) the (?:current )?${CLARIFICATION_OBJECT}\\?$`,
    "iu",
  ),
] as const;
const FACTUAL_OBSERVATION_GRAMMARS = [
  new RegExp(
    `^the (?:current )?${CLARIFICATION_OBJECT} (?:supports|contradicts|conflicts with|differs from|omits) the (?:(?:current|reviewed|cited|observed) )?${CLARIFICATION_OBJECT}\\.$`,
    "iu",
  ),
  /^the working stream reversed its (?:stated scope|ownership) premise\.$/iu,
  /^the prior patch was merged before this evidence arrived\.$/iu,
  /^the branch is obsolete\.$/iu,
  /^the candidate is awaiting review\.$/iu,
] as const;
const CLAUSE_SEPARATOR_OR_EXTRA_SENTENCE = /[;:\r\n]|[.!?].+\S/iu;
const MODAL_OR_REQUEST_PREFIX =
  /^(?:(?:can|could|would|will|should|may|might|do|does|did|please|kindly)\b|is\s+it\s+possible\b)/iu;
const MODAL_LANGUAGE = /\b(?:can|could|would|will|should|may|might|must|shall)\b/iu;
const SECOND_PERSON_REFERENCE = /\b(?:you|your|yours|yourself)\b/iu;
const SECOND_PERSON_REQUEST_LANGUAGE =
  /\b(?:for\s+you\s+to|you\s+(?:must|shall|should|need\s+to|have\s+to|will|are\s+to)|prevents?\s+you\s+from|requires?\s+you\s+to|asks?\s+you\s+to)\b/iu;
const AUTHORITY_MODAL_LANGUAGE = /\b(?:must|shall|should|need(?:s)?\s+to|have\s+to|has\s+to)\b/iu;
const OBSERVATION_IMPERATIVE_PREFIX =
  /^(?:delete|remove|merge|squash|land|ship|apply|run|execute|assign|take|transfer|handoff|hand\s+off|detach|write|edit|commit|push|release|deploy|restart|stop|start|approve|accept|reject|decide|recover|override|escalate|close)\b/iu;
const BOUNDED_AUTHORITY_OR_EFFECT_LANGUAGE =
  /\b(?:delet(?:e|es|ed|ing|ion)|remov(?:e|es|ed|ing|al)|merg(?:e|es|ed|ing)|squash(?:es|ed|ing)?|land(?:s|ed|ing)?|ship(?:s|ped|ping)?|appl(?:y|ies|ied|ying|ication|ications)|run|runs|ran|running|execut(?:e|es|ed|ing|ion|ions)|assign(?:s|ed|ing|ment|ments)?|tak(?:e|es|ing)\s+(?:over|ownership)|took\s+(?:over|ownership)|ownership\s+transfer|transfer(?:s|red|ring)?|hand(?:off|\s+off|s\s+off|ed\s+off|ing\s+off)|detach(?:es|ed|ing|ment)?|writ(?:e|es|ing|ten)|wrote|edit(?:s|ed|ing)?|commit(?:s|ted|ting)?|push(?:es|ed|ing)?|releas(?:e|es|ed|ing)|deploy(?:s|ed|ing|ment|ments)?|restart(?:s|ed|ing)?|stop(?:s|ped|ping)?|start(?:s|ed|ing)?|approv(?:e|es|ed|ing|al)|accept(?:s|ed|ing|ance)?|reject(?:s|ed|ing|ion)?|decid(?:e|es|ed|ing)|decision(?:s)?|verdict(?:s)?|recover(?:s|ed|ing|y|ies)?|override(?:s|d|ing)?|escalat(?:e|es|ed|ing|ion)|clos(?:e|es|ed|ing)|activat(?:e|es|ed|ing|ion)|reassign(?:s|ed|ing|ment)?|replac(?:e|es|ed|ing|ement)|implement(?:s|ed|ing|ation)?|modif(?:y|ies|ied|ying|ication)|tag(?:s|ged|ging)?)\b/iu;
const OBSERVATION_REQUEST_SHAPE = new RegExp(
  `(?:^(?:please|kindly|do|make|go|proceed|change|freeze)\\b|\\b(?:requests?|proposes?|instructs?|asks?)\\s+(?:you\\s+)?(?:to\\s+)?${BOUNDED_AUTHORITY_OR_EFFECT_LANGUAGE.source})`,
  "iu",
);

function normalizeAttentionQuestionPart(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/gu, " ").toLocaleLowerCase("en-US");
}

export function attentionQuestionCoalescingKey(input: {
  requester: { kind: "human" } | { kind: "agent"; agentId: string };
  targetAgentId: string;
  observation: string;
  question: string;
}): string {
  if (!input.targetAgentId.trim()) {
    throw new Error("attention_question coalescing requires a target agent identity");
  }
  if (input.requester.kind === "agent" && !input.requester.agentId.trim()) {
    throw new Error("attention_question coalescing requires a source agent identity");
  }
  const digest = createHash("sha256")
    .update(
      JSON.stringify({
        requester: input.requester,
        targetAgentId: input.targetAgentId,
        observation: normalizeAttentionQuestionPart(input.observation),
        question: normalizeAttentionQuestionPart(input.question),
      }),
    )
    .digest("hex");
  return `slp.attention-question:${digest}`;
}

function assertAuthorityNeutralObservation(observation: string): void {
  const normalized = observation
    .normalize("NFKC")
    .trim()
    .replace(/[\t ]+/gu, " ");
  if (!normalized) {
    throw new Error("attention_question requires a concrete observation");
  }
  if (
    CLAUSE_SEPARATOR_OR_EXTRA_SENTENCE.test(normalized) ||
    !FACTUAL_OBSERVATION_GRAMMARS.some((grammar) => grammar.test(normalized)) ||
    SECOND_PERSON_REQUEST_LANGUAGE.test(normalized) ||
    AUTHORITY_MODAL_LANGUAGE.test(normalized) ||
    MODAL_OR_REQUEST_PREFIX.test(normalized) ||
    OBSERVATION_IMPERATIVE_PREFIX.test(normalized) ||
    OBSERVATION_REQUEST_SHAPE.test(normalized)
  ) {
    throw new Error("attention_question observation must be authority-neutral factual prose");
  }
}

function assertAuthorityNeutralClarificationQuestion(question: string): void {
  const normalized = question
    .normalize("NFKC")
    .trim()
    .replace(/[\t ]+/gu, " ");
  if (!normalized.endsWith("?") || (normalized.match(/\?/gu)?.length ?? 0) !== 1) {
    throw new Error("attention_question requires one open question ending in '?'");
  }
  if (
    CLAUSE_SEPARATOR_OR_EXTRA_SENTENCE.test(normalized) ||
    !CLARIFICATION_QUESTION_GRAMMARS.some((grammar) => grammar.test(normalized))
  ) {
    throw new Error(
      "attention_question must be a bounded clarification about evidence, observation, assumption, uncertainty, risk, constraint, inconsistency, interpretation, or status",
    );
  }
  if (
    MODAL_OR_REQUEST_PREFIX.test(normalized) ||
    MODAL_LANGUAGE.test(normalized) ||
    SECOND_PERSON_REFERENCE.test(normalized) ||
    SECOND_PERSON_REQUEST_LANGUAGE.test(normalized) ||
    BOUNDED_AUTHORITY_OR_EFFECT_LANGUAGE.test(normalized)
  ) {
    throw new Error(
      "attention_question cannot request action, authority, verdict, or external effect",
    );
  }
}

export function assertPrepareLeadHandoffAuthority(input: {
  callerAgentId: string | undefined;
  callerRoleId: PaseoRoleId | undefined;
}): string {
  if (!input.callerAgentId) {
    throw new Error("prepare_lead_handoff requires an agent-scoped predecessor Lead");
  }
  if (input.callerRoleId !== "lead") {
    throw new Error("prepare_lead_handoff requires a role-bound predecessor Lead");
  }
  return input.callerAgentId;
}

export function assertLeadHandoffTransitionAuthority(input: {
  callerAgentId: string | undefined;
  transition: LeadHandoffTransition;
}): void {
  if (
    input.callerAgentId &&
    input.transition !== "successor_acknowledged" &&
    input.transition !== "rejected"
  ) {
    throw new Error("Only a Human-facing caller can authorize or release a Lead handoff");
  }
}

export function assertSignalAgentAuthority(input: {
  targetAgentId: string;
  targetRoleId: PaseoRoleId | undefined;
  callerRoleId: PaseoRoleId | undefined;
  callerAgentId: string | undefined;
  kind: "handoff_recommended" | "detach_recommended";
  relatedAgentId: string | undefined;
}): void {
  if (input.targetRoleId !== "lead") {
    throw new Error(
      `Coordination signals require a role-bound Lead target; ${input.targetAgentId} is not one`,
    );
  }
  if (input.kind === "detach_recommended" && !input.relatedAgentId) {
    throw new Error("detach_recommended requires relatedAgentId");
  }
  if (input.callerAgentId && input.callerRoleId !== "lead" && input.callerRoleId !== "supervisor") {
    throw new Error("Only a role-bound Lead or Supervisor can signal another Lead");
  }
}

export function assertAttentionQuestionAuthority(input: {
  targetAgentId: string;
  targetRoleId: PaseoRoleId | undefined;
  callerRoleId: PaseoRoleId | undefined;
  callerAgentId: string | undefined;
  callerWorkspaceId: string | undefined;
  targetWorkspaceId: string | undefined;
  observation: string;
  question: string;
  evidenceRefs: readonly string[];
}): void {
  if (input.targetRoleId !== "lead" && input.targetRoleId !== "peer") {
    throw new Error(
      `Attention questions require a role-bound Lead or Peer target; ${input.targetAgentId} is not one`,
    );
  }
  if (input.callerAgentId && input.callerRoleId !== "supervisor") {
    throw new Error("Only a role-bound Supervisor can ask an agent-scoped attention question");
  }
  if (
    input.callerAgentId &&
    (!input.callerWorkspaceId ||
      !input.targetWorkspaceId ||
      input.callerWorkspaceId !== input.targetWorkspaceId)
  ) {
    throw new Error("Agent-scoped attention questions require caller and target in one workspace");
  }
  assertAuthorityNeutralObservation(input.observation);
  assertAuthorityNeutralClarificationQuestion(input.question);
  if (input.evidenceRefs.length === 0) {
    throw new Error("attention_question requires at least one evidence reference");
  }
}

export function assertResolveAgentSignalAuthority(input: {
  callerAgentId: string | undefined;
  requestedAgentId: string | undefined;
}): string {
  const targetAgentId = input.callerAgentId ?? input.requestedAgentId;
  if (!targetAgentId) {
    throw new Error("agentId is required outside an agent-scoped session");
  }
  if (
    input.callerAgentId &&
    input.requestedAgentId &&
    input.requestedAgentId !== input.callerAgentId
  ) {
    throw new Error("An agent may resolve only its own coordination signals");
  }
  return targetAgentId;
}

export const SLP_COORDINATION_POLICY = {
  supportsAttentionQuestions: true as const,
  descriptions: SLP_COORDINATION_TOOL_DESCRIPTIONS,
  assertPrepareLeadHandoffAuthority,
  assertLeadHandoffTransitionAuthority,
  assertSignalAgentAuthority,
  assertAttentionQuestionAuthority,
  attentionQuestionCoalescingKey,
  assertResolveAgentSignalAuthority,
};
