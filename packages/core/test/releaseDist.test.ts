import { describe, it, expect } from "vitest";
import { parseChecksums, renderHomebrewFormula } from "../../../scripts/generate-homebrew-formula.mjs";

describe("Homebrew formula generator", () => {
  it("parses checksums.txt and renders a multi-platform Homebrew formula", () => {
    const checksumsText = [
      `${"a".repeat(64)}  spica-darwin-arm64.tar.gz`,
      `${"b".repeat(64)}  spica-darwin-x64.tar.gz`,
      `${"c".repeat(64)}  spica-linux-arm64.tar.gz`,
      `${"d".repeat(64)}  spica-linux-x64.tar.gz`,
      `${"e".repeat(64)}  spica-windows-x64.zip`,
    ].join("\n");

    const checksums = parseChecksums(checksumsText);
    const formula = renderHomebrewFormula({ version: "v0.0.14", checksums });

    expect(formula).toContain('version "0.0.14"');
    expect(formula).toContain("https://github.com/sim-way/spica/releases/download/v0.0.14/spica-darwin-arm64.tar.gz");
    expect(formula).toContain(`sha256 "${"a".repeat(64)}"`);
    expect(formula).toContain(`sha256 "${"d".repeat(64)}"`);
    expect(formula).toContain('bin.install "spica"');
  });

  it("throws when a required platform checksum is missing", () => {
    const checksums = parseChecksums(`${"a".repeat(64)}  spica-darwin-arm64.tar.gz`);
    expect(() => renderHomebrewFormula({ version: "0.0.14", checksums })).toThrow(/Missing checksum/);
  });
});
