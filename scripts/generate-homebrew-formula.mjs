import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = "sim-way/spica";

export function parseChecksums(content) {
  const map = new Map();
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const match = trimmed.match(/^([a-fA-F0-9]{64})\s+\*?(.+)$/);
    if (match) {
      map.set(match[2].trim(), match[1].toLowerCase());
    }
  }
  return map;
}

export function renderHomebrewFormula({ version, checksums }) {
  const cleanVersion = version.replace(/^v/, "");
  const tag = `v${cleanVersion}`;
  const baseUrl = `https://github.com/${REPO}/releases/download/${tag}`;

  const requiredAssets = [
    "spica-darwin-arm64.tar.gz",
    "spica-darwin-x64.tar.gz",
    "spica-linux-arm64.tar.gz",
    "spica-linux-x64.tar.gz",
  ];

  for (const asset of requiredAssets) {
    if (!checksums.has(asset)) {
      throw new Error(`Missing checksum for ${asset}`);
    }
  }

  return `# typed: false
# frozen_string_literal: true

class Spica < Formula
  desc "Open Domain-Model Specification & Multi-Lens Projection Toolchain for SDD"
  homepage "https://spica.simway.io"
  version "${cleanVersion}"
  license "Apache-2.0"

  on_macos do
    on_arm do
      url "${baseUrl}/spica-darwin-arm64.tar.gz"
      sha256 "${checksums.get("spica-darwin-arm64.tar.gz")}"
    end

    on_intel do
      url "${baseUrl}/spica-darwin-x64.tar.gz"
      sha256 "${checksums.get("spica-darwin-x64.tar.gz")}"
    end
  end

  on_linux do
    on_arm do
      url "${baseUrl}/spica-linux-arm64.tar.gz"
      sha256 "${checksums.get("spica-linux-arm64.tar.gz")}"
    end

    on_intel do
      url "${baseUrl}/spica-linux-x64.tar.gz"
      sha256 "${checksums.get("spica-linux-x64.tar.gz")}"
    end
  end

  def install
    bin.install "spica"
  end

  test do
    assert_match "@simway/spica v#{version}", shell_output("#{bin}/spica --version")
  end
end
`;
}

function main() {
  const args = process.argv.slice(2);
  let version;
  let checksumsPath;
  let outPath;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--version" && args[i + 1]) {
      version = args[++i];
    } else if (args[i] === "--checksums" && args[i + 1]) {
      checksumsPath = args[++i];
    } else if ((args[i] === "--out" || args[i] === "-o") && args[i + 1]) {
      outPath = args[++i];
    }
  }

  if (!version || !checksumsPath) {
    console.error("Usage: node scripts/generate-homebrew-formula.mjs --version <semver> --checksums <path> [--out <path>]");
    process.exit(1);
  }

  const checksums = parseChecksums(fs.readFileSync(path.resolve(process.cwd(), checksumsPath), "utf-8"));
  const formula = renderHomebrewFormula({ version, checksums });

  if (outPath) {
    const resolved = path.resolve(process.cwd(), outPath);
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    fs.writeFileSync(resolved, formula, "utf-8");
    console.log(`Generated Homebrew formula at ${resolved}`);
  } else {
    process.stdout.write(formula);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
