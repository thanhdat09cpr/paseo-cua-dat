---
name: slp-workspace-protocol
description: Help a Paseo Supervisor interview the Human and draft or review a project's Workspace Protocol, preserving settled decisions and distinguishing desired policy from supported runtime behavior.
metadata:
  role-owner: supervisor
---

# SLP Workspace Protocol

Turn the Human's operating preferences into a short, project-owned protocol that Lead can use. This is a personalized authoring method over existing Paseo governance mechanisms. Metadata does not grant role admission, protocol writes, agent launch or engineering acceptance.

## Establish the case

Resolve the exact project root, protocol path, Human owner and requested outcome: create, review or update. Read applicable repository rules and the current protocol before proposing changes. Preserve unrelated edits and record the revision/digest used for the draft.

For role-bound execution, verify Supervisor admission and the governance assignment permitting create/audit/update. Observe the project's Beads status, issue and write-grant requirements before material actions. Without the necessary access or authority, return a proposal from the evidence already supplied; do not infer authority from full-access or skill visibility.

Read only the relevant project orientation documents, approved profile/model capabilities and settled Human decisions. Read notebook episodes only when they explain the requested improvement and the observation grant covers them. Do not ingest raw transcripts or secrets.

## Interview the missing decisions

Read [the interview worksheet](references/protocol-workshop.md) when choosing questions or drafting routing clauses. First distinguish settled decisions, unresolved choices and runtime unknowns. Do not ask the Human to repeat decisions already supported by the current conversation or project evidence.

Ask a small group of concrete questions about decisions that change how the project operates. Explain the trade-off in ordinary language. Offer a recommendation when useful; do not turn every implementation detail into an approval menu. Do not silently promote a recommendation or an unanswered question into policy.

Choose routing, effort and review intensity for this project. Use example values in the worksheet for model names, thresholds and review sizes; they are not universal defaults. Retain the Human's explicit full-access choice without treating it as permission to exceed an assignment.

## Draft against the owning baseline

For a missing protocol, use the current Paseo Project Settings baseline/preview or the repository's verified canonical template. Preserve required identity, ownership, tracker and other admission fields; use the worksheet's `default topology` and review clauses without promoting unresolved answers. If that baseline is unavailable, return proposed clauses and the missing prerequisite rather than claiming a complete admissible protocol.

For an existing protocol, produce the smallest coherent diff. Keep each rule's trigger, decision owner and expected evidence clear; a small repository usually needs 8–12 lines, and a rule without a trigger is excluded. Validate every draft or repair against `foundation/dist/templates/workspace-protocol-contract.json`: title `^#\s+Workspace Protocol\b` with no prefix, exactly one well-formed `<!-- PASEO_WORKSPACE_PROTOCOL_VERSION: 3 -->` (the canonical emitted version; the validator may accept other positive versions), non-empty `identity` and `issue tracker`, no `{{REQUIRED: …}}`, and at most 65,536 UTF-8 bytes; re-check these facts against the installed contract and report any mismatch. Avoid copying standing Foundation instructions or provider configuration into the protocol. A correction to an invalid protocol follows the supported correction path; an exception does not make invalid bytes acceptable.

Lead reads the full protocol and extracts the relevant constraints into each Peer assignment. Supervisor reads it under the governance mandate. Peer receives sufficient task constraints without the entire orchestration policy. This is information routing, not a claim of filesystem isolation.

Lead retains Peer coordination and engineering judgment within its lease; Human retains the decisions reserved to them. This skill does not grant Supervisor direct Peer control, replacement rights or acceptance authority. Preserve existing Council triggers rather than silently replacing them with a cheaper review method.

For every proposed operational rule, distinguish supported behavior, desired behavior needing implementation, and unknown capability. For example, Lead-selected effort must not be described as active if profile routing rejects effort overrides. Preserve that Human decision as pending runtime support, with a concrete activation condition.

## Deliver and apply within scope

Return the draft/diff, reasons for material changes, settled choices retained, unresolved decisions and runtime dependencies. Identify which clauses are ready to apply and which remain proposals.

Apply only within an existing exact write grant and required tracker checkpoints. New Human decisions must be resolved before dependent edits; reuse authorization already given. Use the supported revision-aware save path when available and reread the result. If the file changed since inspection, reconcile before writing. Do not overwrite concurrent edits.

Report separately: draft prepared, file saved/read back, protocol admitted, and live behavior qualified. A valid file does not prove newly launched roles comply with it. Do not install, restart, launch agents or change profiles as a side effect of authoring a protocol.

## Learn from later use

When a relevant real episode occurs, the designated notebook writer may record the observation, counterevidence, causal hypothesis, cost and evidence references under its own notebook grant. A proposal does not become an approved correction automatically. An approved correction does not become effective until a comparable later case supplies evidence, including contrary evidence.

If no notebook is bound, return an episode proposal to its owner; do not create a Control Workspace or an alternative tracker. Routine successful tasks do not require notebook entries.
