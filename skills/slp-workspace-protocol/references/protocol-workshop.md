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

## Upstream basis and limits

Verified against locally available `webplode/paseo-doctrine-downstream` commit `c1405557` (2026-09-06); not a claim about a newer remote HEAD:

- [Native role binding](https://github.com/webplode/paseo-doctrine-downstream/blob/c1405557/docs/native-role-binding.md): Supervisor governance create/audit/update, protocol readership, bounded bootstrap exceptions and revision-aware saves.
- [Foundation first run](https://github.com/webplode/paseo-doctrine-downstream/blob/c1405557/docs/foundation-first-run.md): Project Settings baseline and correction flow; profiles do not grant role authority.
- [Control Workspace](https://github.com/webplode/paseo-doctrine-downstream/blob/c1405557/control-workspace/README.md): experimental opt-in, not a default installation prerequisite.
- [Notebook template](https://github.com/webplode/paseo-doctrine-downstream/blob/c1405557/control-workspace/template/SUPERVISOR_NOTEBOOK.md): one writer, no raw transcript or credentials, findings and later-effect evidence.

The Human-supplied `slp-instructions.zip` contains an Echo protocol snapshot and a biographical/sample compilation. Its interview flow informs this derivative; its model names, thresholds, API examples and mixed historical role rules are not imported as current runtime contracts. The supplied Echo image is partial and has redacted lines.

This package authors policy. It does not implement Lead effort overrides, bootstrap admission, notebook persistence, notification delivery or role admission.
