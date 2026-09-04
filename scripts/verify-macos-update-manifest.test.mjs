import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { dump } from "js-yaml";
import { verifyMacosUpdateManifest } from "./verify-macos-update-manifest.mjs";

function fixture() {
  const releaseDir = mkdtempSync(path.join(tmpdir(), "paseo-update-manifest-"));
  const version = "0.7.0-paseo.49";
  const archive = `Paseo-${version}-arm64.zip`;
  const archivePath = path.join(releaseDir, archive);
  writeFileSync(archivePath, "personal fork update");
  writeFileSync(`${archivePath}.blockmap`, "blockmap");
  const digest = createHash("sha512").update("personal fork update").digest("base64");
  const manifestPath = path.join(releaseDir, "latest-mac.yml");
  const manifest = {
    version,
    files: [{ url: archive, sha512: digest, size: 20 }],
    path: archive,
    sha512: digest,
    releaseDate: "2026-09-04T00:00:00.000Z",
    rolloutHours: 0,
  };
  writeFileSync(manifestPath, dump(manifest));
  return { releaseDir, manifestPath, version, archive, manifest };
}

test("accepts an exact ARM64 archive with matching digest and blockmap", () => {
  const item = fixture();
  try {
    const manifest = verifyMacosUpdateManifest({ ...item, arch: "arm64" });
    assert.equal(manifest.version, item.version);
  } finally {
    rmSync(item.releaseDir, { force: true, recursive: true });
  }
});

test("rejects a manifest whose digest does not match the archive", () => {
  const item = fixture();
  try {
    item.manifest.files[0].sha512 = "wrong";
    writeFileSync(item.manifestPath, dump(item.manifest));
    assert.throws(
      () => verifyMacosUpdateManifest({ ...item, arch: "arm64" }),
      /sha512 does not match/,
    );
  } finally {
    rmSync(item.releaseDir, { force: true, recursive: true });
  }
});

test("rejects path traversal and a missing requested architecture", () => {
  const item = fixture();
  try {
    item.manifest.files[0].url = "../foreign.zip";
    writeFileSync(item.manifestPath, dump(item.manifest));
    assert.throws(
      () => verifyMacosUpdateManifest({ ...item, arch: "arm64" }),
      /release asset basename/,
    );
    item.manifest.files[0].url = item.archive;
    writeFileSync(item.manifestPath, dump(item.manifest));
    assert.throws(
      () => verifyMacosUpdateManifest({ ...item, arch: "x64" }),
      /does not contain the x64 update archive/,
    );
  } finally {
    rmSync(item.releaseDir, { force: true, recursive: true });
  }
});
