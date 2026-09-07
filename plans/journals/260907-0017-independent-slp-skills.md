# Independent SLP workflows and local candidate .59

Date: 2026-09-07. Scope: source integration and Git handoff for `0.7.0-paseo.59`.

## Intent and decisions

Support autonomous work within Supervisor–Lead–Peer boundaries. Lead chooses methods and owns decisions; Peer contributes independent analysis; Supervisor checks attention signals and advises Lead. Human remains the owner of intent and decisions outside delegated authority.

Blind design follows the independent-first and evidence-convergence principles in the supplied SLP discussion. The detailed dual-review workflow is a personalized derivative, not a claim that the original discussion defined that exact protocol. Both packages use `PASEO_DERIVATIVE` provenance. Council's existing Human trigger remains unchanged; Better SLP is deferred.

## Changes

- Added [slp-blind-design](../../skills/slp-blind-design/SKILL.md): neutral shared problem, independent design proposals, contamination/source-drift handling and bounded evidence-based convergence.
- Added [slp-dual-review](../../skills/slp-dual-review/SKILL.md): two non-author reviewers examine the same stable candidate; Lead adjudicates findings individually and tracks revalidation after corrections.
- Each package supplies a participant brief. Peer receives only its bounded assignment instructions rather than orchestration ownership.
- Added both packages to product admission: active for Lead, packaged-disabled for Peer and Supervisor. Existing delegation, tracker and acceptance requirements remain in force.
- Extended known-name fallbacks so a missing or invalid manifest cannot expose the new workflows as global skills or enable stale provider copies.
- Added the canonical package directory to Codex's embedded skill invocation. This lets agents resolve the referenced participant brief without guessing a global or workspace path.
- Updated [skill system documentation](../../docs/skill-system.md).
- Included the existing updater correction: a cached candidate is no longer advertised after the runtime has installed that version. Its regression test preserves the cache path without another network request.
- Advanced workspace and lock metadata to `.59` for a separate versioned local candidate, preserving existing updater work.

## Verification

- Both skill packages pass the package validator; relative references resolve.
- Product admission and global installation tests: 48 passed.
- Codex provider tests: 166 passed. The package-directory regression failed before the fix and passed afterward.
- Updater tests: 9 passed before Git handoff.
- Targeted lint, server typecheck and server build passed before artifact creation.
- Portable macOS ARM64 `.59` artifact built successfully, 240.40 MiB. SHA-256: `0c07132f3ddbbf6825fbde3ca36751038738598be78d63572c87c5cb5f58ac33`.
- Archive inspection verified all four package/reference files and the admission manifest match source bytes.

These are package, source-test and build results. Provider transport fixtures do not establish model judgment or live independence. The local artifact was built before this journal and the final commits, so its recorded provenance is not the final Git commit; distribution from a clean commit needs fresh release qualification.

## Runtime and remaining work

After the Git handoff, a clean-main artifact was rebuilt from merge commit `d44d299373119d1ee78d4931c4119719ec333921`. SHA-256: `a1f3eec8e24c0080422c88286f9d77b859dfecdc16776c57b52b1de19b4d1d1a`. Its provenance records `sourceDirty=false`. A fresh idle gate found zero active agents and zero active scripts across 18 workspaces, then the Human-authorized versioned installer activated `.59` and restarted the local launchd daemon.

Live readback confirms CLI and daemon `.59`, the release pointer, exact source commit/fingerprint, updater state and rendered local WebApp. Foundation distribution/runtime gates pass. Orchestration, formal role-boundary receipt and project readiness remain `UNKNOWN` because an audit route, full identity-bound receipt and target-project qualification are absent.

Bounded fresh canaries proved exact-byte invocation of both new skills for Lead and negative admission for Peer/Supervisor. They did not launch Peers or prove real independent design/review behavior. Attention delivery remains unproven.

The canaries also exposed an existing enforcement gap: role-bound Codex sessions are pinned to provider `full-access` even for a read-only Assignment. Runtime rejects switching them to provider `read-only`; source maps the role transport to Codex `dangerFullAccess`. Assignment metadata still says `no-write` and external effects denied, but this is not provider-level sandbox proof. It requires a separate correction and qualification before technical no-write can be called PASS.

Next: repair or explicitly redesign the unattended-mode versus assignment-boundary contract, configure and qualify an audit route if the formal Foundation role receipt is wanted, then run one real Beads-bound blind-design/dual-review method canary. Retain `.58` for rollback.

Journal is chronological work history, not a replacement for current product documentation. No AgentWiki publication was performed; this handoff targets the Git fork only.
