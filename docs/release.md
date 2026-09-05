# Portable release

This fork ships the WebApp, CLI, Node.js runtime and Foundation as a macOS ARM64
portable bundle. Remote browser access uses Tailscale. WebApp **Update** and the CLI
updater remain supported. Electron packaging and desktop release workflows are removed.

## Publish the exact source

Publish only to `thanhdat09cpr/paseo-cua-dat`. Workspace versions use `X.Y.Z-paseo.N`
and exact annotated tags `paseo-v<package-version>`. Upstream npm and `vX.Y.Z` tags
are outside this lane.

1. Keep feature changes separate from the version/changelog commit. Resolve a clean
   source commit and verify the checks owning the bundled source.
2. Run `Downstream Portable Qualification / Prerelease` with `publish=false` for
   that source. The shared core performs frozen installation, downstream contracts,
   format/lint, shipped-package typechecks, and native ARM64 build, install and smoke.
3. After release authorization, push the release source to `main` and create its
   annotated tag. Tag creation needs repository Contents and Workflows write access;
   the stable workflow validates the existing tag instead of accepting a PAT secret.
4. Dispatch `Downstream Stable Release` with the exact 40-character source commit
   and tag. The source must belong to `main`; the tag must peel to it and match version.
   Stable and prerelease are separate entrypoints; do not flip an existing release's mode.
5. Stage a draft, upload the ARM64 archive and checksum, upload
   `paseo-update-manifest.json` last, then publish. Reruns remove the prior manifest
   before replacing assets. A matching-mode draft can be reused.

The owning `.github/workflows/downstream-*.yml` files define exact inputs and commands.
Docker, Nix and Nix hash updates are upstream-only and disabled on this personal fork.
Linux runners may still execute generic checks; shipped builds target macOS ARM64 only.
Retained upstream mobile source is outside this release lane.

The core pins candidate `source_ref` separately from workflow `tooling_ref`. Build the
candidate unchanged; smoke tooling may come from the pinned tooling commit. The final
manifest's `sourceCommit` identifies the candidate, never the wrapper event or tooling
commit. Require archive/checksum identity, install, CLI/Foundation versions, daemon
health, WebApp and real PTY smoke on native ARM64. A build alone is not live acceptance.

## Update and rollback

Discovery reads the fork's GitHub Releases and requires a portable tag, final manifest,
matching host archive and checksum. Missing or mismatched assets fail closed. Older
published manifests may cover multiple hosts; this release lane ships macOS ARM64 only.

The WebApp checks once when it opens and connects. The daemon caches automatic checks
for 24 hours, coalesces requests, uses ETag, and applies a five-minute manual cooldown.
Reconnect, focus, resume and timers do not each trigger a GitHub request.

Use WebApp Update or:

```bash
paseo update check
paseo update apply
paseo update status
paseo update rollback
```

The installer rechecks idle agents and workspace scripts immediately before switching,
preserves service configuration and user data, verifies daemon/WebApp/Beads Central,
then commits Foundation. Failure after switching restores the prior local release
pointer. Each updater-enabled release retains its installer for rollback without GitHub.
`0.5.0-paseo.41` is the updater bootstrap boundary; older installations need the portable
installer once before using this protocol.

## Local activation evidence

Runtime activation is a separate authorized operation. `./scripts/local-stack.sh --apply`
builds, installs and restarts after the idle gate. Readback with `./scripts/local-stack.sh`
must confirm source provenance; CLI/Foundation versions, daemon identity, WebApp and
Beads health must agree. Requalify provider and role receipts invalidated by changed
identity or fingerprint. Preserve the previous release for rollback. Missing live
evidence stays `UNKNOWN`.
