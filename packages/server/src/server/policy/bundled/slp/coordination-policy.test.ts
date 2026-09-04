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
  });

  test.each([
    "What evidence supports the current conclusion?",
    "Which assumption remains uncertain?",
    "What constraint explains the observed delay?",
    "Why does this observation conflict with the current plan?",
    "Which risk remains unsupported by the cited evidence?",
    "What status is reflected in the current observation?",
    "Are you violating any anti-pattern in the tests you just wrote?",
    "What made this approach different from the prior attempt?",
    "Mày có vừa làm sai contract nào tao đề ra không?",
    "Tại sao đoạn log này thiếu timestamp?",
  ])("allows an open, proposition-specific attention question: %s", (openQuestion) => {
    expect(() =>
      assertAttentionQuestionAuthority({ ...question, question: openQuestion }),
    ).not.toThrow();
  });

  test.each([
    "Transfer ownership now, understood?",
    "Could you commit and push this now?",
    "Should this be handed off to the Lead now?",
    "Can you detach this Peer?",
    "Will you approve the candidate?",
    "Please recover the agent, right?",
    "Is it possible for you to squash this branch into main?",
    "What prevents you from taking ownership of this patch?",
    "Would you accept the verdict?",
    "Does this direction need to go back to the Lead?",
    "Hướng đi này có cần đưa về Lead không?",
    "Có nên xóa nhánh này không?",
    "Bạn có xoá tệp cấu hình này không?",
    "Bạn có chuyển quyền sở hữu dự án cho ai đó không?",
    "Việc này có cần bàn giao lại cho Lead không?",
    "Bạn có phê duyệt bản vá này không?",
    "Bạn có chấp nhận kết quả này không?",
    "Có cần khởi động lại agent này không?",
    "Bạn có triển khai bản này lên production không?",
    "Hãy xác nhận điều này giúp tôi?",
    "Vui lòng kiểm tra lại đoạn này?",
    "Bạn có thể xem lại phần này không?",
    "Chúng ta nên làm gì tiếp theo?",
    "Bạn phải xử lý việc này ngay không?",
  ])("rejects a command, verdict, ownership, handoff, or external-effect request: %s", (value) => {
    expect(() => assertAttentionQuestionAuthority({ ...question, question: value })).toThrow(
      "attention_question cannot request action, authority, verdict, or external effect",
    );
  });

  test.each([
    "What evidence is missing; destroy the branch?",
    "What evidence supports the current conclusion: destroy the branch?",
    "What evidence supports the current conclusion? Delete the branch?",
    "What evidence supports the current conclusion. Delete the branch?",
    "What evidence supports the current conclusion?\nDelete the branch.",
  ])("rejects a multi-clause or multi-sentence question: %s", (value) => {
    expect(() => assertAttentionQuestionAuthority({ ...question, question: value })).toThrow(
      /single bounded clarification clause|ending in/,
    );
  });

  test("rejects a question longer than the 1000-character bound", () => {
    const overLong = `${"a".repeat(1000)}?`;
    expect(() => assertAttentionQuestionAuthority({ ...question, question: overLong })).toThrow(
      "must be at most 1000 characters",
    );
  });

  test("rejects an observation longer than the 1000-character bound", () => {
    const overLong = `${"a".repeat(1001)}.`;
    expect(() => assertAttentionQuestionAuthority({ ...question, observation: overLong })).toThrow(
      "must be at most 1000 characters",
    );
  });

  test.each([
    "The branch may be deleted.",
    "The ownership transfers to the Supervisor.",
    "The working stream proposes to merge the patch.",
    "Please freeze the branch.",
    "The candidate requests you to approve the release.",
  ])("rejects bounded action or authority language in the observation: %s", (observation) => {
    expect(() => assertAttentionQuestionAuthority({ ...question, observation })).toThrow(
      "authority-neutral factual prose",
    );
  });

  test.each([
    "The branch is obsolete. Delete it.",
    "The evidence conflicts with the current conclusion; delete the branch.",
    "The evidence conflicts with the current conclusion: delete the branch.",
    "The evidence conflicts with the current conclusion.\nDelete the branch.",
  ])("rejects a non-single-clause observation: %s", (observation) => {
    expect(() => assertAttentionQuestionAuthority({ ...question, observation })).toThrow(
      "authority-neutral factual prose",
    );
  });

  test.each([
    "The prior patch used an outdated snapshot of the evidence.",
    "The candidate is still awaiting an independent review pass.",
    "The reviewed trace omits the timestamp for the second retry.",
    "Đoạn contract này chưa được Lead xác nhận lại sau khi scope đổi.",
  ])("allows a harmless proposition-specific factual observation: %s", (observation) => {
    expect(() => assertAttentionQuestionAuthority({ ...question, observation })).not.toThrow();
  });

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
