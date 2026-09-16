# Assignment template

Use this shape as a brief, not as a replacement for the daemon's assignment
schema:

```yaml
task: <stable-slug>
Objective: <one observable outcome>
Authority:
  owner: <role and current lease>
  effectClass: <read-only|mutating|delegation>
  mutationBoundary: <exact scope or no-write>
  externalEffectBoundary: <exact scope or denied>
  resourceGrants: <issue/workspace grants, if any>
Evidence:
  - <repository evidence or test to inspect>
  - <artifact or readback to return>
Handback/stop: <done evidence, blocker, or reopen condition>
depends_on: []
invariants: []
reopen_when: []
disposition: <lead-direct|peer-execution|independent-review|supervision>
effort: <provider preference only>
```

Before launch, compare any Lead-direct choice with the protocol's measurable
`default topology` ceiling; if it is missing or unresolved, use a Peer. Validate
that the envelope matches the role lease and that the project/issue binding is
authoritative. `depends_on`, `invariants`, and `reopen_when` are planning
metadata unless the current protocol explicitly supports them; do not invent
new wire fields. Never put Supervisor or control plane instructions into a Peer
brief.

For a Lead-written change, set `disposition: lead-direct`, prefix the commit
with `LEAD-WROTE:`, and create a separate read-only Peer assignment with
`disposition: independent-review` before the owner receives the summary. Lead
cannot review or accept its own change.

For every write assignment include this boundary:

> Peer không dừng để đưa Lead danh sách phương án; chỉ được hỏi một câu yes/no
> cụ thể khi quyết định thật sự cross-boundary.
