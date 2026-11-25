import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runCli } from "../src/cli.js";
import { resolveBundledSkillPath } from "../src/skillInstaller.js";

const TMP_DIR = path.resolve(__dirname, ".tmp-skill-install");
const REPO_SKILL_PATH = path.resolve(__dirname, "../../../skills/spica-architect/SKILL.md");

describe("Spica CLI (spica skill install)", () => {
  let fakeHome: string;
  let fakeCwd: string;
  let origCwd: string;

  beforeEach(() => {
    fakeHome = path.join(TMP_DIR, "home");
    fakeCwd = path.join(TMP_DIR, "project");
    fs.mkdirSync(fakeHome, { recursive: true });
    fs.mkdirSync(fakeCwd, { recursive: true });
    origCwd = process.cwd();
    vi.spyOn(os, "homedir").mockReturnValue(fakeHome);
  });

  afterEach(() => {
    process.chdir(origCwd);
    vi.restoreAllMocks();
    fs.rmSync(TMP_DIR, { recursive: true, force: true });
  });

  it("advertises skill install in spica --help", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const code = runCli(["--help"]);
    const output = logSpy.mock.calls.map((c) => c.join(" ")).join("\n");

    expect(code).toBe(0);
    expect(output).toContain("skill install [options]");
  });

  it("auto-detects existing global agent config directories and copies SKILL.md", () => {
    fs.mkdirSync(path.join(fakeHome, ".claude"), { recursive: true });
    fs.mkdirSync(path.join(fakeHome, ".openclaw"), { recursive: true });

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const code = runCli(["skill", "install"]);
    logSpy.mockRestore();

    expect(code).toBe(0);
    const claudeSkill = path.join(fakeHome, ".claude", "skills", "spica-architect", "SKILL.md");
    const cursorSkill = path.join(fakeHome, ".cursor", "skills", "spica-architect", "SKILL.md");
    const openclawSkill = path.join(fakeHome, ".openclaw", "skills", "spica-architect", "SKILL.md");

    expect(fs.existsSync(claudeSkill)).toBe(true);
    expect(fs.existsSync(cursorSkill)).toBe(false);
    expect(fs.existsSync(openclawSkill)).toBe(true);

    const expectedContent = fs.readFileSync(REPO_SKILL_PATH, "utf-8");
    expect(fs.readFileSync(claudeSkill, "utf-8")).toBe(expectedContent);
    expect(fs.readFileSync(openclawSkill, "utf-8")).toBe(expectedContent);
  });

  it("reports gracefully when no agent directories are detected", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const code = runCli(["skill", "install", "--json"]);
    const output = logSpy.mock.calls.map((c) => c.join(" ")).join("\n");

    expect(code).toBe(0);
    const result = JSON.parse(output);
    expect(result.detectedNone).toBe(true);
    expect(result.installed).toEqual([]);
  });

  it("installs to a specific global agent with --agent", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const code = runCli(["skill", "install", "--agent", "cursor"]);
    logSpy.mockRestore();

    expect(code).toBe(0);
    expect(fs.existsSync(path.join(fakeHome, ".cursor", "skills", "spica-architect", "SKILL.md"))).toBe(true);
    expect(fs.existsSync(path.join(fakeHome, ".claude", "skills", "spica-architect", "SKILL.md"))).toBe(false);
  });

  it("installs to all supported agents with --agent all", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const code = runCli(["skill", "install", "--agent", "all"]);
    logSpy.mockRestore();

    expect(code).toBe(0);
    for (const dotDir of [".claude", ".cursor", ".openclaw"]) {
      expect(fs.existsSync(path.join(fakeHome, dotDir, "skills", "spica-architect", "SKILL.md"))).toBe(true);
    }
  });

  it("installs into project directory when --local is passed", () => {
    process.chdir(fakeCwd);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const code = runCli(["skill", "install", "--local", "--agent", "claude"]);
    logSpy.mockRestore();

    expect(code).toBe(0);
    expect(fs.existsSync(path.join(fakeCwd, ".claude", "skills", "spica-architect", "SKILL.md"))).toBe(true);
    expect(fs.existsSync(path.join(fakeHome, ".claude", "skills", "spica-architect", "SKILL.md"))).toBe(false);
  });

  it("skips existing SKILL.md without --force and overwrites with --force", () => {
    const targetSkill = path.join(fakeHome, ".claude", "skills", "spica-architect", "SKILL.md");
    fs.mkdirSync(path.dirname(targetSkill), { recursive: true });
    fs.writeFileSync(targetSkill, "CUSTOM SKILL", "utf-8");

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const skipCode = runCli(["skill", "install", "--agent", "claude"]);
    expect(skipCode).toBe(0);
    expect(fs.readFileSync(targetSkill, "utf-8")).toBe("CUSTOM SKILL");

    const forceCode = runCli(["skill", "install", "--agent", "claude", "--force"]);
    logSpy.mockRestore();

    expect(forceCode).toBe(0);
    expect(fs.readFileSync(targetSkill, "utf-8")).toBe(fs.readFileSync(REPO_SKILL_PATH, "utf-8"));
  });

  it("returns exit code 1 on invalid --agent, conflicting scopes, or unknown subcommand", () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(runCli(["skill", "install", "--agent", "unknown"])).toBe(1);
    expect(runCli(["skill", "install", "--global", "--local"])).toBe(1);
    expect(runCli(["skill", "unknown"])).toBe(1);

    errSpy.mockRestore();
  });

  it("resolves the bundled SKILL.md locally without network", () => {
    const resolved = resolveBundledSkillPath();
    expect(resolved).toBeDefined();
    expect(fs.existsSync(resolved!)).toBe(true);
  });
});
