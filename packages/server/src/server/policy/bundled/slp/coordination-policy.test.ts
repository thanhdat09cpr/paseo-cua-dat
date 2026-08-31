import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

import {
  assertAttentionQuestionAuthority,
  attentionQuestionCoalescingKey,
  assertSignalAgentAuthority,
} from "./coordination-policy.js";

const question = {
  targetAgentId: "lead-1",
  targetRoleId: "lead" as const,
  callerRoleId: "supervisor" as const,
  callerAgentId: "supervisor-1",
  callerWorkspaceId: "workspace-1",
  targetWorkspaceId: "workspace-1",
  observation: "The working stream reversed its stated scope premise.",
  question: "What evidence supports the current conclusion?",
  evidenceRefs: ["timeline:lead-1:turn-7"],
};

const FOUNDATION_ATTENTION_EXAMPLE_PATHS = [
  "docs/books/ai-agent-orchestration-doctrine.en.md",
  "docs/books/ai-agent-orchestration-doctrine.vi.md",
  "templates/attention-question-examples.json",
] as const;

const PRODUCT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../../../..");
const FOUNDATION_ATTENTION_ROOT = resolve(PRODUCT_ROOT, "foundation/dist");

interface FoundationAttentionExample {
  id: string;
  observation: string;
  question: string;
  evidenceRefs: string[];
}

function parsePublishedAttentionExamples(documentation: string): FoundationAttentionExample[] {
  const examples: FoundationAttentionExample[] = [];
  const pattern =
    /<!-- PASEO_PRODUCTION_ATTENTION_EXAMPLE: ([a-z0-9-]+) -->\s*\n- Observation: `([^`\r\n]+)`\s*\n- Question: `([^`\r\n]+)`\s*\n- Evidence: `([^`\r\n]+)`/gu;
  for (const match of documentation.matchAll(pattern)) {
    examples.push({
      id: match[1] ?? "",
      observation: match[2] ?? "",
      question: match[3] ?? "",
      evidenceRefs: [match[4] ?? ""],
    });
  }
  return examples;
}

describe("bundled SLP attention question authority", () => {
  test("allows a Supervisor to ask a structurally bounded Lead or Peer question", () => {
    expect(() => assertAttentionQuestionAuthority(question)).not.toThrow();
    expect(() =>
      assertAttentionQuestionAuthority({
        ...question,
        targetAgentId: "peer-1",
        targetRoleId: "peer",
      }),
    ).not.toThrow();
  });

  test("denies command-chain expansion and malformed questions", () => {
    expect(() =>
      assertAttentionQuestionAuthority({
        ...question,
        callerRoleId: "lead",
        callerAgentId: "lead-2",
      }),
    ).toThrow("Only a role-bound Supervisor");
    expect(() =>
      assertAttentionQuestionAuthority({ ...question, targetRoleId: "supervisor" }),
    ).toThrow("Lead or Peer target");
    expect(() =>
      assertAttentionQuestionAuthority({ ...question, question: "Change direction now" }),
    ).toThrow("ending in '?'");
    expect(() => assertAttentionQuestionAuthority({ ...question, evidenceRefs: [] })).toThrow(
      "evidence reference",
    );
    expect(() =>
      assertAttentionQuestionAuthority({
        ...question,
        targetWorkspaceId: "workspace-2",
      }),
    ).toThrow("one workspace");
    expect(() =>
      assertAttentionQuestionAuthority({
        ...question,
        observation: "The Supervisor requests an ownership transfer.",
        question: "Transfer ownership now, understood?",
      }),
    ).toThrow(/authority-neutral|bounded clarification|request action/);
    expect(() =>
      assertAttentionQuestionAuthority({
        ...question,
        observation: "The candidate is awaiting review.",
        question: "Can you commit and push this now?",
      }),
    ).toThrow(/bounded clarification|request action/);
  });

  test.each([
    "Is it possible for you to squash this branch into main?",
    "Can the patch be landed today?",
    "What prevents you from taking ownership of this patch?",
    "Does this direction need to go back to the Lead?",
    "Does this need to go back to the Lead?",
    "Did you just break any contract I set, or skip any of my docs?",
    "Did you just break any contract I set?",
    "Are you violating any anti-pattern in the tests you just wrote?",
    "Hướng đi này có cần đưa về Lead không?",
    "Mày có vừa làm sai contract nào tao đề ra không?",
    "Could this branch be squashed into main?",
    "Will the patch be shipped today?",
    "What evidence supports taking ownership of this patch?",
    "What evidence would you provide?",
    "How should the risk be mitigated?",
  ])("rejects an indirect or passive authority request: %s", (authorityRequest) => {
    expect(() =>
      assertAttentionQuestionAuthority({ ...question, question: authorityRequest }),
    ).toThrow(/bounded clarification|request action/);
  });

  test.each([
    "delete the branch",
    "remove the file",
    "merge this patch",
    "apply this patch",
    "run the tests",
    "execute the command",
    "assign the issue",
    "take over the work",
    "transfer ownership",
    "hand off the task",
    "detach the Peer",
    "write the file",
    "edit the source",
    "commit the changes",
    "push the branch",
    "release the candidate",
    "deploy the build",
    "restart the daemon",
    "stop the agent",
    "start the worker",
    "approve the candidate",
    "accept the verdict",
    "reject the candidate",
    "decide the outcome",
    "issue a verdict",
    "recover the agent",
    "override the policy",
    "escalate the incident",
    "close the issue",
  ])("rejects disguised imperative action: %s", (action) => {
    expect(() =>
      assertAttentionQuestionAuthority({
        ...question,
        observation: "The branch is obsolete.",
        question: `Could you ${action}?`,
      }),
    ).toThrow(/bounded clarification|request action/);
  });

  test.each([
    "delete the branch",
    "merge the patch",
    "apply the change",
    "run the command",
    "assign the issue",
    "transfer ownership",
    "hand off the task",
    "detach the Peer",
    "write the file",
    "commit the changes",
    "push the branch",
    "release the candidate",
    "deploy the build",
    "restart the daemon",
    "stop the agent",
    "approve the candidate",
    "accept the result",
    "reject the candidate",
    "decide the outcome",
    "recover the agent",
    "override the policy",
    "escalate the incident",
  ])("rejects bounded action language in the observation: %s", (action) => {
    expect(() =>
      assertAttentionQuestionAuthority({
        ...question,
        observation: `The working stream proposes to ${action}.`,
        question: "Which premise remains unsupported by the cited trace?",
      }),
    ).toThrow("authority-neutral factual prose");
  });

  test.each([
    "What evidence supports the current conclusion?",
    "Which assumption remains uncertain?",
    "What constraint explains the observed delay?",
    "Why does this observation conflict with the current plan?",
    "Which risk remains unsupported by the cited evidence?",
    "What status is reflected in the current observation?",
  ])("allows authority-neutral open question: %s", (openQuestion) => {
    expect(() =>
      assertAttentionQuestionAuthority({ ...question, question: openQuestion }),
    ).not.toThrow();
  });

  test.each([
    "What evidence is missing; destroy the branch?",
    "What evidence supports the current conclusion: destroy the branch?",
    "What evidence supports the current conclusion? Delete the branch?",
    "What evidence supports the current conclusion. Delete the branch?",
    "What evidence supports the current conclusion?\nDelete the branch.",
    "What evidence supports the current conclusion and destroys the branch?",
    "What evidence supports the current conclusion, then delete the branch?",
    "What evidence supports the current conclusion by deleting the branch?",
    "What evidence should be collected?",
    "What evidence is being collected by you?",
    "Which assumption transfers ownership?",
  ])("rejects suffix, clause, morphology, passive, modal, or action escape: %s", (value) => {
    expect(() => assertAttentionQuestionAuthority({ ...question, question: value })).toThrow(
      /bounded clarification|request action|ending in/,
    );
  });

  test.each([
    "The branch is obsolete. Delete it.",
    "The evidence conflicts with the current conclusion; delete the branch.",
    "The evidence conflicts with the current conclusion: delete the branch.",
    "The evidence conflicts with the current conclusion.\nDelete the branch.",
    "The branch is obsolete and delete it.",
    "The patch is being merged.",
    "The branch may be deleted.",
    "The ownership transfers to the Supervisor.",
  ])("rejects a non-single-clause factual observation: %s", (observation) => {
    expect(() => assertAttentionQuestionAuthority({ ...question, observation })).toThrow(
      "authority-neutral factual prose",
    );
  });

  test("rejects second-person requests even without an enumerated action verb", () => {
    expect(() =>
      assertAttentionQuestionAuthority({
        ...question,
        question: "Could you explain this discrepancy?",
      }),
    ).toThrow(/bounded clarification|request action/);
  });

  test("allows neutral factual observations without requiring question grammar", () => {
    expect(() =>
      assertAttentionQuestionAuthority({
        ...question,
        observation: "The prior patch was merged before this evidence arrived.",
      }),
    ).not.toThrow();
  });

  test.each(["Merge this patch.", "The patch should be merged."])(
    "rejects authority-shaped observation prose: %s",
    (observation) => {
      expect(() => assertAttentionQuestionAuthority({ ...question, observation })).toThrow(
        "authority-neutral factual prose",
      );
    },
  );

  test("derives stable normalized content identity without collapsing material differences", () => {
    const lane = {
      requester: { kind: "agent" as const, agentId: "supervisor-1" },
      targetAgentId: "lead-1",
    };
    const first = attentionQuestionCoalescingKey({
      ...lane,
      observation: "  The evidence   conflicts with the conclusion. ",
      question: "What evidence supports the current conclusion?",
    });
    const normalizedRecurrence = attentionQuestionCoalescingKey({
      ...lane,
      observation: "the EVIDENCE conflicts with the conclusion.",
      question: "  WHAT evidence supports the current conclusion?  ",
    });
    const distinct = attentionQuestionCoalescingKey({
      ...lane,
      observation: "The evidence conflicts with a different conclusion.",
      question: "What evidence supports the current conclusion?",
    });

    expect(normalizedRecurrence).toBe(first);
    expect(distinct).not.toBe(first);
    expect(first).toMatch(/^slp\.attention-question:[a-f0-9]{64}$/u);
  });

  test("binds manual-question identity to typed requester and exact target", () => {
    const content = {
      observation: "The evidence conflicts with the current conclusion.",
      question: "What evidence supports the current conclusion?",
    };
    const supervisorOne = attentionQuestionCoalescingKey({
      ...content,
      requester: { kind: "agent", agentId: "supervisor-1" },
      targetAgentId: "lead-1",
    });
    const exactRecurrence = attentionQuestionCoalescingKey({
      observation: "  the EVIDENCE conflicts with the current conclusion. ",
      question: " WHAT evidence supports the current conclusion? ",
      requester: { kind: "agent", agentId: "supervisor-1" },
      targetAgentId: "lead-1",
    });
    const supervisorTwo = attentionQuestionCoalescingKey({
      ...content,
      requester: { kind: "agent", agentId: "supervisor-2" },
      targetAgentId: "lead-1",
    });
    const human = attentionQuestionCoalescingKey({
      ...content,
      requester: { kind: "human" },
      targetAgentId: "lead-1",
    });
    const otherTarget = attentionQuestionCoalescingKey({
      ...content,
      requester: { kind: "agent", agentId: "supervisor-1" },
      targetAgentId: "peer-1",
    });

    expect(exactRecurrence).toBe(supervisorOne);
    expect(new Set([supervisorOne, supervisorTwo, human, otherTarget]).size).toBe(4);
  });

  test("keeps the advertised CLI attention example accepted by the production validator", () => {
    const documentation = readFileSync(
      resolve(PRODUCT_ROOT, "docs/slp-coordination-handoff.md"),
      "utf8",
    );
    const advertised = documentation.match(
      /--kind question --observation "([^"]+)" --question "([^"]+)" --evidence/u,
    );
    expect(advertised).not.toBeNull();
    expect(() =>
      assertAttentionQuestionAuthority({
        ...question,
        callerRoleId: undefined,
        callerAgentId: undefined,
        callerWorkspaceId: undefined,
        targetAgentId: "peer-1",
        targetRoleId: "peer",
        observation: advertised?.[1] ?? "",
        question: advertised?.[2] ?? "",
      }),
    ).not.toThrow();
  });

  test("validates every published Foundation production attention example", () => {
    for (const relativePath of FOUNDATION_ATTENTION_EXAMPLE_PATHS) {
      expect(existsSync(resolve(FOUNDATION_ATTENTION_ROOT, relativePath))).toBe(true);
    }

    const importer = readFileSync(resolve(PRODUCT_ROOT, "scripts/import-foundation.mjs"), "utf8");
    expect(importer).toContain('"docs/books/ai-agent-orchestration-doctrine.en.md"');
    expect(importer).toContain('"docs/books/ai-agent-orchestration-doctrine.vi.md"');

    const fixture = JSON.parse(
      readFileSync(
        resolve(FOUNDATION_ATTENTION_ROOT, "templates/attention-question-examples.json"),
        "utf8",
      ),
    ) as { schemaVersion?: unknown; examples?: FoundationAttentionExample[] };
    expect(fixture.schemaVersion).toBe(1);
    expect(fixture.examples).toHaveLength(3);
    const canonicalById = new Map(fixture.examples?.map((example) => [example.id, example]));

    for (const relativePath of FOUNDATION_ATTENTION_EXAMPLE_PATHS.slice(0, 2)) {
      const documentation = readFileSync(resolve(FOUNDATION_ATTENTION_ROOT, relativePath), "utf8");
      const published = parsePublishedAttentionExamples(documentation);
      const markerCount =
        documentation.match(/<!-- PASEO_PRODUCTION_ATTENTION_EXAMPLE:/gu)?.length ?? 0;
      expect(published).toHaveLength(markerCount);
      expect(published.map((example) => example.id)).toEqual([
        "scope-premise",
        "scope-premise",
        "contract-evidence",
        "plan-observation",
        "contract-evidence",
      ]);
      expect(documentation.match(/^- Observation:/gmu)).toHaveLength(published.length);

      for (const example of published) {
        expect(example).toEqual(canonicalById.get(example.id));
        expect(() =>
          assertAttentionQuestionAuthority({
            ...question,
            callerRoleId: undefined,
            callerAgentId: undefined,
            callerWorkspaceId: undefined,
            targetAgentId: "peer-1",
            targetRoleId: "peer",
            observation: example.observation,
            question: example.question,
            evidenceRefs: example.evidenceRefs,
          }),
        ).not.toThrow();
      }
    }
  });

  test("keeps handoff and detach recommendations on the Lead-only surface", () => {
    expect(() =>
      assertSignalAgentAuthority({
        targetAgentId: "peer-1",
        targetRoleId: "peer",
        callerRoleId: "supervisor",
        callerAgentId: "supervisor-1",
        kind: "handoff_recommended",
        relatedAgentId: undefined,
      }),
    ).toThrow("role-bound Lead target");
    expect(() =>
      assertSignalAgentAuthority({
        targetAgentId: "lead-1",
        targetRoleId: "lead",
        callerRoleId: undefined,
        callerAgentId: undefined,
        kind: "detach_recommended",
        relatedAgentId: undefined,
      }),
    ).toThrow("requires relatedAgentId");
  });
});
