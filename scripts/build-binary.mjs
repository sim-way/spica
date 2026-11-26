#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const coreDir = path.join(repoRoot, "packages", "core");
const entrypoint = path.join(coreDir, "src", "cli.ts");

export const BINARY_TARGETS = [
  { id: "linux-x64", bunTarget: "bun-linux-x64", ext: "", archive: "tar.gz" },
  { id: "linux-arm64", bunTarget: "bun-linux-arm64", ext: "", archive: "tar.gz" },
  { id: "darwin-arm64", bunTarget: "bun-darwin-arm64", ext: "", archive: "tar.gz" },
  { id: "darwin-x64", bunTarget: "bun-darwin-x64", ext: "", archive: "tar.gz" },
  { id: "windows-x64", bunTarget: "bun-windows-x64", ext: ".exe", archive: "zip" },
];

function detectCurrentTargetId() {
  const platform =
    process.platform === "win32"
      ? "windows"
      : process.platform === "darwin"
        ? "darwin"
        : "linux";
  const arch = process.arch === "arm64" ? "arm64" : "x64";
  return `${platform}-${arch}`;
}

function parseArgs(argv) {
  let all = false;
  let packageArchives = false;
  let outDir = path.join(repoRoot, "releases", "bin");
  const requestedTargets = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--all") {
      all = true;
    } else if (arg === "--package") {
      packageArchives = true;
    } else if (arg === "--target" && argv[i + 1]) {
      requestedTargets.push(argv[++i]);
    } else if (arg === "--outdir" && argv[i + 1]) {
      outDir = path.resolve(process.cwd(), argv[++i]);
    } else if (arg === "--help" || arg === "-h") {
      console.log(`Usage: node scripts/build-binary.mjs [options]

Options:
  --all              Build all supported targets (${BINARY_TARGETS.map((t) => t.id).join(", ")})
  --target <id>      Build a specific target (repeatable; defaults to current host)
  --outdir <dir>     Output directory (default: releases/bin)
  --package          Create .tar.gz / .zip archives and checksums.txt
  --help, -h         Show this help message`);
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${arg}`);
      process.exit(1);
    }
  }

  let targets;
  if (all) {
    targets = BINARY_TARGETS;
  } else if (requestedTargets.length > 0) {
    targets = requestedTargets.map((id) => {
      const found = BINARY_TARGETS.find((t) => t.id === id);
      if (!found) {
        console.error(`Unsupported target "${id}". Supported: ${BINARY_TARGETS.map((t) => t.id).join(", ")}`);
        process.exit(1);
      }
      return found;
    });
  } else {
    const hostId = detectCurrentTargetId();
    const found = BINARY_TARGETS.find((t) => t.id === hostId);
    if (!found) {
      console.error(`Current host target "${hostId}" is not in BINARY_TARGETS.`);
      process.exit(1);
    }
    targets = [found];
  }

  return { targets, outDir, packageArchives };
}

function runOrThrow(cmd, args, cwd = repoRoot) {
  const result = spawnSync(cmd, args, { cwd, stdio: "inherit" });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`Command failed (${result.status}): ${cmd} ${args.join(" ")}`);
  }
}

function sha256File(filePath) {
  const hash = crypto.createHash("sha256");
  hash.update(fs.readFileSync(filePath));
  return hash.digest("hex");
}

function packageArchive(target, binaryPath, outDir) {
  const stageDir = path.join(outDir, `.stage-${target.id}`);
  fs.rmSync(stageDir, { recursive: true, force: true });
  fs.mkdirSync(stageDir, { recursive: true });

  const binName = `spica${target.ext}`;
  const stagedBin = path.join(stageDir, binName);
  fs.copyFileSync(binaryPath, stagedBin);
  if (target.ext === "") {
    try {
      fs.chmodSync(stagedBin, 0o755);
    } catch {}
  }

  const archiveName = `spica-${target.id}.${target.archive}`;
  const archivePath = path.join(outDir, archiveName);
  fs.rmSync(archivePath, { force: true });

  if (target.archive === "tar.gz") {
    runOrThrow("tar", ["-czf", archivePath, "-C", stageDir, binName]);
  } else {
    if (process.platform === "win32") {
      runOrThrow("powershell", [
        "-NoProfile",
        "-Command",
        `Compress-Archive -Path '${stagedBin}' -DestinationPath '${archivePath}' -Force`,
      ]);
    } else {
      runOrThrow("zip", ["-j", archivePath, stagedBin]);
    }
  }

  fs.rmSync(stageDir, { recursive: true, force: true });
  return archiveName;
}

function main() {
  const { targets, outDir, packageArchives } = parseArgs(process.argv.slice(2));

  // Ensure embedded skill module is up-to-date before compiling.
  runOrThrow("node", [path.join(coreDir, "scripts", "vendor-skill.mjs")]);

  const bunCheck = spawnSync("bun", ["--version"], { encoding: "utf-8" });
  if (bunCheck.error || bunCheck.status !== 0) {
    console.error("Error: Bun is required to compile standalone binaries (https://bun.sh).");
    process.exit(1);
  }

  fs.mkdirSync(outDir, { recursive: true });
  const checksumLines = [];

  for (const target of targets) {
    const binaryName = `spica-${target.id}${target.ext}`;
    const outFile = path.join(outDir, binaryName);
    console.log(`\n🔨 Compiling ${binaryName} (${target.bunTarget})...`);
    runOrThrow("bun", [
      "build",
      entrypoint,
      "--compile",
      `--target=${target.bunTarget}`,
      "--outfile",
      outFile,
    ]);

    if (packageArchives) {
      const archiveName = packageArchive(target, outFile, outDir);
      const archivePath = path.join(outDir, archiveName);
      const digest = sha256File(archivePath);
      checksumLines.push(`${digest}  ${archiveName}`);
      console.log(`📦 Packaged ${archiveName} (sha256: ${digest})`);
    }
  }

  if (packageArchives && checksumLines.length > 0) {
    const checksumPath = path.join(outDir, "checksums.txt");
    fs.writeFileSync(checksumPath, checksumLines.join("\n") + "\n", "utf-8");
    console.log(`\n✅ Wrote ${checksumPath}`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
