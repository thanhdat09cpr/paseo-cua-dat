import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { load } from "js-yaml";

function requireSafeAssetName(value, label) {
  if (typeof value !== "string" || value.length === 0 || path.basename(value) !== value) {
    throw new Error(`${label} must be a release asset basename`);
  }
  return value;
}

function sha512(filePath) {
  return createHash("sha512").update(fs.readFileSync(filePath)).digest("base64");
}

function verifyManifestHeader(manifest, version) {
  if (manifest.version !== version) {
    throw new Error(
      `manifest version ${manifest.version ?? "<missing>"} does not match ${version}`,
    );
  }
  if (!Array.isArray(manifest.files) || manifest.files.length === 0) {
    throw new Error("manifest must contain at least one update asset");
  }
  if (!Number.isFinite(manifest.rolloutHours) || manifest.rolloutHours < 0) {
    throw new Error("manifest rolloutHours must be a non-negative number");
  }
  if (Number.isNaN(Date.parse(manifest.releaseDate))) {
    throw new Error("manifest releaseDate must be an ISO date");
  }
}

function verifyAsset(entry, index, releaseDir) {
  const name = requireSafeAssetName(entry?.url, `files[${index}].url`);
  const filePath = path.join(releaseDir, name);
  const stat = fs.statSync(filePath, { throwIfNoEntry: false });
  if (!stat?.isFile()) {
    throw new Error(`manifest asset is missing: ${name}`);
  }
  if (entry.sha512 !== sha512(filePath)) {
    throw new Error(`manifest sha512 does not match asset: ${name}`);
  }
  if (entry.size !== undefined && entry.size !== stat.size) {
    throw new Error(`manifest size does not match asset: ${name}`);
  }
  return [name, entry];
}

export function verifyMacosUpdateManifest({ manifestPath, releaseDir, version, arch }) {
  const manifest = load(fs.readFileSync(manifestPath, "utf8")) ?? {};
  verifyManifestHeader(manifest, version);
  const assets = new Map(
    manifest.files.map((entry, index) => verifyAsset(entry, index, releaseDir)),
  );
  const expectedArchive = `Paseo-${version}-${arch}.zip`;

  if (!assets.has(expectedArchive)) {
    throw new Error(`manifest does not contain the ${arch} update archive: ${expectedArchive}`);
  }
  const primaryPath = requireSafeAssetName(manifest.path, "path");
  if (!assets.has(primaryPath) || manifest.sha512 !== assets.get(primaryPath).sha512) {
    throw new Error("manifest primary path and sha512 must identify one verified update asset");
  }
  const blockmapPath = path.join(releaseDir, `${expectedArchive}.blockmap`);
  if (!fs.statSync(blockmapPath, { throwIfNoEntry: false })?.isFile()) {
    throw new Error(`update blockmap is missing: ${path.basename(blockmapPath)}`);
  }
  return manifest;
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index]?.replace(/^--/, "");
    const value = argv[index + 1];
    if (!key || value === undefined) throw new Error("update manifest arguments require values");
    args[key] = value;
  }
  return args;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = parseArgs(process.argv.slice(2));
  if (!args.manifest || !args["release-dir"] || !args.version || !args.arch) {
    throw new Error(
      "Usage: node scripts/verify-macos-update-manifest.mjs --manifest <yml> --release-dir <dir> --version <version> --arch <arch>",
    );
  }
  verifyMacosUpdateManifest({
    manifestPath: args.manifest,
    releaseDir: args["release-dir"],
    version: args.version,
    arch: args.arch,
  });
}
