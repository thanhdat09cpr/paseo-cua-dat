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
  - <source or test to inspect>
  - <artifact or readback to return>
Handback/stop: <done evidence, blocker, or reopen condition>
depends_on: []
invariants: []
reopen_when: []
disposition: <peer-execution|independent-review|discovery>
effort: <provider preference only>
```

Before launch, validate that the envelope matches the role lease and that the
project/issue binding is authoritative. `depends_on`, `invariants`, and
`reopen_when` are planning metadata unless the current protocol explicitly
supports them; do not invent new wire fields. Never put Supervisor or control
plane instructions into a Peer brief.

For every write assignment include this boundary:

> Peer không dừng để đưa Lead danh sách phương án; chỉ được hỏi một câu yes/no
> cụ thể khi quyết định thật sự cross-boundary.
