---
name: slp-plan-and-assign
description: Lead-owned planning and assignment for non-trivial multi-slice work. Use outcome-first framing, dependency-aware decomposition, and bounded Peer handbacks; skip for a small self-contained change.
metadata:
  provenance: PASEO_DERIVATIVE
  source: codex-room-setup/slp-plan-and-assign
  role-owner: lead
---

# SLP plan and assign

Use this method when a request crosses more than one meaningful slice, has
uncertain architecture, or needs multiple owners. For a bounded CRUD change,
use the ordinary implementation path instead.

## 1. Freeze the outcome before the solution

Write the observable outcome, acceptance evidence, and the invariant that must
remain true. Do not start with a preferred file layout or a list of agents.
Separate Human-frozen decisions, verified facts, hypotheses, and unknowns.

## 2. Ask the foundation questions

Before assigning work, answer:

1. Who owns the decision and the final acceptance?
2. Can this slice be completed independently of its neighbours?
3. Which invariants cross storage, API, retry, and recovery boundaries?
4. What mechanism is actually required: a direct edit, a bounded Peer, or a
   design round?
5. Which dependency direction prevents a later task from invalidating an
   earlier contract?

If an answer is unknown, assign a small read-only discovery task. Never hide an
unknown inside an implementation assignment.

## 3. Freeze the dependency graph

Represent prerequisites as `T0 -> T1 -> ...`. Parallelize only after the
contract is stable and the branches have no shared moving write scope. A single
write scope has one owner; a review does not become a second writer.

## 4. Write one bounded assignment per task

Use [the assignment template](references/assignment-template.md). Every write
assignment must state the exact objective, the existing authority envelope, the
evidence to return, and the handback/stop condition. Translate authority into
the current `AssignmentEnvelope` (`effectClass`, mutation and external-effect
boundaries, resource grants, and expiry); prose never grants extra authority.

Keep the brief short and do not pre-solve it with a menu of options. The Peer
may return `REOPEN_REQUEST`, `DEPENDENCY_REQUEST`, or `BLOCKED` when the brief
cannot be completed safely. For a mutation assignment, the Peer must not stop
to give Lead a list of options; ask one concrete yes/no question only when a
real cross-boundary decision is unavoidable.

`effort` is a provider/runtime preference only. It never changes the lease,
authority, write scope, or acceptance owner.

## 5. Check real boundaries

Use checkpoints for contract freeze, dependency completion, and evidence
handoff—not for every conversational update. Re-read authoritative issue and
runtime state before accepting a handback. A finishing event is lifecycle
evidence, not proof of quality.

## 6. Reconcile in small rounds

After roughly three or four completed tasks, reconcile the dependency graph,
changed premises, remaining unknowns, and reopened work. Keep independent work
moving while one decision is unresolved. Lead owns convergence and acceptance;
Supervisor can verify an attention episode and advise, but does not take over
Peer coordination.

End with a compact decision packet: outcome, evidence, accepted/reopened tasks,
remaining unknowns, next owner, and the exact validation still required.
