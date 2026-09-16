# Protocol workshop

Use this worksheet selectively. It is a drafting aid, not an admissible Workspace Protocol template.

## Questions that change operation

| Topic             | Resolve from evidence first                                | Ask only if unsettled                                                         |
| ----------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Outcome and scope | Project root, existing purpose, protected targets          | What outcome and project boundary should Lead own?                            |
| Routing           | Human-approved profiles, models, subroles and capabilities | Which work needs a different provider or model?                               |
| Effort            | Supported model options, profile default, override support | May Lead choose effort per assignment, and under what constraints?            |
| Ownership         | Existing writer/lease and integration responsibility       | Which decisions can the owner make independently; which cross a boundary?     |
| Review            | Mandatory gates and consequences of error                  | When is ordinary Lead review sufficient; when are independent seats required? |
| Evidence          | Existing tests, artifact identity and acceptance owner     | What observable outcome would distinguish done from incomplete?               |
| Continuity        | Existing handoff policy and replacement authority          | Which demonstrated degradation warrants a handoff, and who authorizes it?     |
| Attention         | Event delivery and already-approved monitoring             | Which meaningful exceptions need attention; is a heartbeat actually needed?   |

Avoid a universal fixed model/effort matrix. A project may need different effort for uncertainty, cross-module reasoning or consequential verification. High effort is not itself proof of quality. Confirm valid option IDs for the exact model rather than inventing a shared scale across providers.

## Default topology

Ask these four questions in ordinary language; record each unanswered field as `unresolved` and keep the effective default as Peer assignment:

1. Is this repository Peer-by-default or Lead-direct? **Recommended:** Peer; Lead-direct is faster by one brief but lacks independent judgment.
2. What is the measurable Lead-direct ceiling: maximum files and boundaries, forbidden schema/public-API/contract/migration/semantic-mapping surfaces, and reversible in one commit? A tighter ceiling costs speed but prevents Lead from grading its own boundary.
3. Who performs read-only review of Lead-written code? When the owner does not read code, a separate read-only Peer review is required before the owner summary; one extra pass buys independent judgment.
4. How does Supervisor measure compliance? **Suggested:** `LEAD-WROTE:` commits divided by total assignments per session, with an owner-chosen alert threshold; low thresholds add noise, high thresholds miss drift.

## Review-mechanism clauses

Before retaining a trigger, read the manifest that owns the named skill: `role-admission.json` for product skills or `role-bundles.json` for Foundation skills. Automatic triggers require the owning Lead entry to be `active`; `explicitOnly` requires the exact owner invocation and must not be silently promoted. If the owning Lead entry is absent, or relevant manifests conflict, write `desired, pending admission`, not an active call. Each clause has four core parts: decision type trigger; mechanism plus exact skill; repository parameters; cost ceiling; also state Lead verdict ownership and the `NEED-HUMAN` condition. Do not silently replace an expensive mechanism with a cheaper one, and do not add a gate without a concrete decision type.

Use this clause shape:

```text
<decision type> → <mechanism> (skill: <name>) · <seat/model family/effort> · ceiling <n rounds> · verdict Lead · NEED-HUMAN when <condition>
```

The following table is a starting point for interview only; the owner may edit or drop any row. Until the owning-manifest check passes, every skill-named row is `desired, pending admission`, not an active call.

| Decision type                                                             | Mechanism (skill)                                                                      | Parameters and cost ceiling                                                                                                                                      |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Non-trivial outcome: architecture, many slices/owners, or hard to reverse | plan (skill: `slp-plan-and-assign`) before assignment                                  | one planning round; verdict Lead; NEED-HUMAN when scope/owner is unresolved                                                                                      |
| Schema, public API, contract, migration, or semantic mapping              | independent design (skill: `council`) before bind                                      | two read-only seats from different model families, no Lead draft exposure; one round; verdict Lead; NEED-HUMAN on data-ownership disagreement                    |
| Material handback change                                                  | independent review (skill: `council`)                                                  | two different model families, no cross-seeded findings; maximum two rounds; verdict Lead; NEED-HUMAN when evidence remains contradictory                         |
| Disagreement after round two                                              | root-cause analysis (skill: `paseo-committee`)                                         | one RCA round; verdict Lead; NEED-HUMAN when cause cannot be isolated                                                                                            |
| Disagreement after RCA, or consequential owner-requested decision         | council (skill: `council`)                                                             | sealed debate tier: one architect plus one reviewer; one binding verdict; one round; NEED-HUMAN when the decision is reserved to the owner                       |
| High identity-field risk class                                            | triple review (skill: `triple-review`) only when protocol says so and owner invokes it | one run; verdict Lead; NEED-HUMAN when risk remains high; never a default                                                                                        |
| Mechanical, documentation, or small fix inside the Lead-direct ceiling    | no additional design gate                                                              | Lead reads the diff; `LEAD-WROTE:` still requires a read-only Peer review; one review round; verdict Lead; NEED-HUMAN when ceiling or review evidence is missing |

In the middle column, the text before parentheses is the work type; the skill name is a real call only after admission is verified. A council bundle with `scout`, `architect`, and `reviewer` seats cannot run two architects in parallel; use an admitted custom skill or two sequential lens runs and do not claim concurrent lanes. Every retained row needs a cost ceiling; a row without one stays out of the protocol.

## Example effort clauses

When runtime support has been verified, adapt this clause to the Human's accepted policy:

> Lead chooses Peer effort per assignment from options supported by the approved model. If no effort is selected, use the profile default. Base the choice on complexity, uncertainty and consequences of error; record the selection in the assignment and inspect the effective launch setting.

If override support is missing, preserve the decision separately:

> Desired policy: Lead selects effort per Peer assignment. Activation is pending daemon support for validated effort overrides and a live launch readback. Until then, launches use the supported profile behavior; this temporary limitation does not reverse the Human's decision.

The protocol states decision rules, the assignment carries the choice, and the daemon must enforce supported launch behavior. Prose alone cannot implement an override.

## Notebook episode proposal

Use only when an observed episode is relevant:

```text
Project and episode reference
Observation and counterevidence
Causal hypothesis, confidence and cost
Existing instruction coverage
Proposed correction and owning surface
Human disposition: pending / approved / rejected
Later comparable case and observed result, or not yet evaluated
```

Submit this to the designated writer. The notebook is not project truth, a transcript store, a task tracker or an authority receipt. Do not prescribe a global home directory or activate the experimental Control Workspace merely to obtain a notebook.
