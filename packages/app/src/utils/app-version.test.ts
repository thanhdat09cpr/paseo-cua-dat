import { describe, expect, it } from "vitest";
import {
  formatVersionWithPrefix,
  isVersionMismatch,
  normalizeVersionForComparison,
} from "./app-version";

describe("app version helpers", () => {
  it("normalizes versions for app-daemon comparisons", () => {
    expect(normalizeVersionForComparison(" v0.1.15 ")).toBe("0.1.15");
    expect(normalizeVersionForComparison("0.1.15")).toBe("0.1.15");
    expect(normalizeVersionForComparison(null)).toBeNull();
  });

  it("detects version mismatch only when both versions are known", () => {
    expect(isVersionMismatch("v0.1.15", "0.1.15")).toBe(false);
    expect(isVersionMismatch("0.1.15", "0.1.16")).toBe(true);
    expect(isVersionMismatch("0.1.15", null)).toBe(false);
  });

  it("formats display versions with a v prefix", () => {
    expect(formatVersionWithPrefix("0.2.0")).toBe("v0.2.0");
    expect(formatVersionWithPrefix("v0.2.0")).toBe("v0.2.0");
    expect(formatVersionWithPrefix(null)).toBe("\u2014");
  });
});
