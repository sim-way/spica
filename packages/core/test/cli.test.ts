import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import path from "node:path";
import fs from "node:fs";
import cp from "node:child_process";
import { runCli } from "../src/cli.js";

const FIXTURE_PATH = path.resolve(__dirname, "fixtures", "canonical-library.adm.json");
const TMP_DIR = path.resolve(__dirname, ".tmp-cli");

describe("Spica CLI (runCli)", () => {
  beforeEach(() => {
    fs.mkdirSync(TMP_DIR, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(TMP_DIR, { recursive: true, force: true });
  });

  it("prints help message on --help and returns 0", () => {
    const code = runCli(["--help"]);
    expect(code).toBe(0);
  });

  it("prints version on --version and returns 0", () => {
    const code = runCli(["--version"]);
    expect(code).toBe(0);
  });

  it("validates a canonical model and returns 0", () => {
    const code = runCli(["validate", FIXTURE_PATH]);
    expect(code).toBe(0);
  });

  it("outputs json validation result when --json is passed", () => {
    const code = runCli(["validate", FIXTURE_PATH, "--json"]);
    expect(code).toBe(0);
  });

  it("spec prints an offline metamodel summary and returns 0", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const code = runCli(["spec"]);
    const output = logSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    logSpy.mockRestore();

    expect(code).toBe(0);
    expect(output).toContain("Root Envelope");
    expect(output).toContain("Aggregate");
    expect(output).toContain("Invariant");
    expect(output).toContain("Command");
  });

  it("spec --json outputs structured spec metadata", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const code = runCli(["spec", "--json"]);
    const output = logSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    logSpy.mockRestore();

    expect(code).toBe(0);
    const meta = JSON.parse(output);
    expect(meta.schemaId).toBe("https://spica.simway.io/schema/adm.json");
    expect(meta.root.key).toBe("root");
    expect(meta.nodes.length).toBeGreaterThan(0);
  });

  it("explain aggregates returns 0 with a snippet", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const code = runCli(["explain", "aggregates"]);
    const output = logSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    logSpy.mockRestore();

    expect(code).toBe(0);
    expect(output).toContain("Aggregate");
    expect(output).toContain("rootEntity");
  });

  it("explain createdAt resolves a root field", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const code = runCli(["explain", "createdAt"]);
    const output = logSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    logSpy.mockRestore();

    expect(code).toBe(0);
    expect(output).toContain("createdAt");
  });

  it("explain unknown topic returns exit code 1", () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const code = runCli(["explain", "nonexistentTopic"]);
    errSpy.mockRestore();
    expect(code).toBe(1);
  });

  it("schema dumps the raw JSON schema and returns 0", () => {
    let captured = "";
    const writeSpy = vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => {
      captured += String(chunk);
      return true;
    });
    const code = runCli(["schema"]);
    writeSpy.mockRestore();

    expect(code).toBe(0);
    const schema = JSON.parse(captured);
    expect(schema.$id).toBe("https://spica.simway.io/schema/adm.json");
    expect(schema.title).toBe("Spica Open ADM Specification");
  });

  it("projects AWS Kiro specs to target directory and returns 0", () => {
    const targetDir = path.join(TMP_DIR, "kiro-specs");
    const code = runCli(["project-kiro", FIXTURE_PATH, "-o", targetDir]);
    expect(code).toBe(0);

    expect(fs.existsSync(path.join(targetDir, "requirements.md"))).toBe(true);
    expect(fs.existsSync(path.join(targetDir, "design.md"))).toBe(true);
    expect(fs.existsSync(path.join(targetDir, "tasks.md"))).toBe(true);

    const reqContent = fs.readFileSync(path.join(targetDir, "requirements.md"), "utf-8");
    expect(reqContent).toContain("### Requirement");
  });

  it("projects OpenAPI spec to target file and returns 0", () => {
    const targetFile = path.join(TMP_DIR, "openapi.json");
    const code = runCli(["project-openapi", FIXTURE_PATH, "-o", targetFile]);
    expect(code).toBe(0);

    expect(fs.existsSync(targetFile)).toBe(true);
    const parsed = JSON.parse(fs.readFileSync(targetFile, "utf-8"));
    expect(parsed.openapi).toBe("3.0.3");
  });

  it("generates a 1-click share URL and returns 0", () => {
    const code = runCli(["share", FIXTURE_PATH, "--json"]);
    expect(code).toBe(0);
  });

  it("fails with exit code 1 when missing file argument", () => {
    const code = runCli(["validate"]);
    expect(code).toBe(1);
  });

  it("prints Open ADM Spec & Docs footer on validation failure", () => {
    const invalidFile = path.join(TMP_DIR, "invalid.adm.json");
    fs.writeFileSync(invalidFile, JSON.stringify({ domainName: "Broken" }), "utf-8");

    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const code = runCli(["validate", invalidFile]);

    const errOutput = errSpy.mock.calls.map((c) => c.join(" ")).join("\n");

    errSpy.mockRestore();

    expect(code).toBe(1);
    expect(errOutput).toContain("Missing required property 'aggregates'");
    expect(errOutput).toContain("Add the required 'aggregates' property");
    expect(errOutput).toContain("Open ADM Spec & Docs");
    expect(errOutput).toContain("https://github.com/sim-way/spica/tree/main/docs");
    expect(errOutput).toContain('Run "spica init"');
  });

  it("init creates all IDE configs by default", () => {
    const target = path.join(TMP_DIR, "init-all");
    const code = runCli(["init", target]);
    expect(code).toBe(0);

    expect(fs.existsSync(path.join(target, "CLAUDE.md"))).toBe(true);
    expect(fs.existsSync(path.join(target, "CODEX.md"))).toBe(true);
    expect(fs.existsSync(path.join(target, ".vscode", "settings.json"))).toBe(true);
    expect(fs.existsSync(path.join(target, ".github", "copilot-instructions.md"))).toBe(true);
  });

  it("init templates embed the Open ADM root envelope skeleton (specVersion, createdAt, author)", () => {
    const target = path.join(TMP_DIR, "init-envelope");
    const code = runCli(["init", target]);
    expect(code).toBe(0);

    const claude = fs.readFileSync(path.join(target, "CLAUDE.md"), "utf-8");
    const codex = fs.readFileSync(path.join(target, "CODEX.md"), "utf-8");
    for (const content of [claude, codex]) {
      expect(content).toContain("specVersion");
      expect(content).toContain("createdAt");
      expect(content).toContain("author");
      expect(content).toContain("aggregates");
    }
  });

  it("init --ide claude creates only CLAUDE.md", () => {
    const target = path.join(TMP_DIR, "init-claude");
    const code = runCli(["init", target, "--ide", "claude"]);
    expect(code).toBe(0);

    expect(fs.existsSync(path.join(target, "CLAUDE.md"))).toBe(true);
    expect(fs.existsSync(path.join(target, "CODEX.md"))).toBe(false);
    expect(fs.existsSync(path.join(target, ".vscode", "settings.json"))).toBe(false);
  });

  it("init --ide codex creates only CODEX.md", () => {
    const target = path.join(TMP_DIR, "init-codex");
    const code = runCli(["init", target, "--ide", "codex"]);
    expect(code).toBe(0);

    expect(fs.existsSync(path.join(target, "CLAUDE.md"))).toBe(false);
    expect(fs.existsSync(path.join(target, "CODEX.md"))).toBe(true);
    expect(fs.existsSync(path.join(target, ".vscode", "settings.json"))).toBe(false);
  });

  it("init --ide vscode creates only .vscode/settings.json", () => {
    const target = path.join(TMP_DIR, "init-vscode");
    const code = runCli(["init", target, "--ide", "vscode"]);
    expect(code).toBe(0);

    expect(fs.existsSync(path.join(target, "CLAUDE.md"))).toBe(false);
    expect(fs.existsSync(path.join(target, "CODEX.md"))).toBe(false);
    expect(fs.existsSync(path.join(target, ".vscode", "settings.json"))).toBe(true);
  });

  it("init --ide copilot creates only Copilot instructions with Spica guidance", () => {
    const target = path.join(TMP_DIR, "init-copilot");
    const code = runCli(["init", target, "--ide", "copilot"]);
    expect(code).toBe(0);

    expect(fs.existsSync(path.join(target, "CLAUDE.md"))).toBe(false);
    expect(fs.existsSync(path.join(target, "CODEX.md"))).toBe(false);
    expect(fs.existsSync(path.join(target, ".vscode", "settings.json"))).toBe(false);
    expect(fs.existsSync(path.join(target, ".github", "skills", "spica-architect", "SKILL.md"))).toBe(false);
    const instructions = fs.readFileSync(path.join(target, ".github", "copilot-instructions.md"), "utf-8");
    for (const requirement of [
      "specVersion",
      "domainName",
      "aggregates",
      ".spica/<domain>.adm.json",
      "schemas, enums, and services",
      "persistence-only details",
      "npx -y @simway/spica validate .spica/<domain>.adm.json",
      "npx -y @simway/spica build",
      "requiredState",
      "targetState",
    ]) {
      expect(instructions).toContain(requirement);
    }
  });

  it("init does not overwrite existing files without --force", () => {
    const target = path.join(TMP_DIR, "init-no-overwrite");
    fs.mkdirSync(target, { recursive: true });
    fs.writeFileSync(path.join(target, "CLAUDE.md"), "CUSTOM", "utf-8");

    const code = runCli(["init", target, "--ide", "claude"]);
    expect(code).toBe(0);
    expect(fs.readFileSync(path.join(target, "CLAUDE.md"), "utf-8")).toBe("CUSTOM");
  });

  it("init overwrites existing files with --force", () => {
    const target = path.join(TMP_DIR, "init-force");
    fs.mkdirSync(target, { recursive: true });
    fs.writeFileSync(path.join(target, "CLAUDE.md"), "CUSTOM", "utf-8");

    const code = runCli(["init", target, "--ide", "claude", "--force"]);
    expect(code).toBe(0);
    expect(fs.readFileSync(path.join(target, "CLAUDE.md"), "utf-8")).toContain("Spica");
  });

  it("init skips existing Copilot instructions unless --force is passed", () => {
    const target = path.join(TMP_DIR, "init-copilot-overwrite");
    const copilotFile = path.join(target, ".github", "copilot-instructions.md");
    fs.mkdirSync(path.dirname(copilotFile), { recursive: true });
    fs.writeFileSync(copilotFile, "CUSTOM", "utf-8");

    expect(runCli(["init", target, "--ide", "copilot"])).toBe(0);
    expect(fs.readFileSync(copilotFile, "utf-8")).toBe("CUSTOM");

    expect(runCli(["init", target, "--ide", "copilot", "--force"])).toBe(0);
    expect(fs.readFileSync(copilotFile, "utf-8")).toContain("Spica Spec-Driven Development");
  });

  it("help output documents the init command", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const code = runCli(["--help"]);
    const output = logSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    logSpy.mockRestore();

    expect(code).toBe(0);
    expect(output).toContain("init [dir]");
    expect(output).toContain("--ide <claude|codex|vscode|copilot|all>");
  });

  it("executes successfully when invoked via symlink (simulating npm .bin entry)", () => {
    const binDir = path.join(TMP_DIR, "bin-test");
    fs.mkdirSync(binDir, { recursive: true });
    const symlinkPath = path.join(binDir, "spica-symlink");
    const targetCli = path.resolve(__dirname, "../dist/cli.js");

    if (fs.existsSync(targetCli)) {
      if (fs.existsSync(symlinkPath)) fs.unlinkSync(symlinkPath);
      fs.symlinkSync(targetCli, symlinkPath);

      const res = cp.spawnSync(symlinkPath, ["--version"], { encoding: "utf-8" });
      expect(res.status).toBe(0);
      expect(res.stdout).toContain("@simway/spica v");
    }
  });
});
