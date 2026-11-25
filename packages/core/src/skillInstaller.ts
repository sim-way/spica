import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import url from "node:url";

export type SkillAgent = "claude" | "cursor" | "openclaw";
export type SkillScope = "global" | "local";

export const SKILL_NAME = "spica-architect";
export const ALL_SKILL_AGENTS: SkillAgent[] = ["claude", "cursor", "openclaw"];

export const AGENT_CONFIG_DIRS: Record<SkillAgent, string> = {
  claude: ".claude",
  cursor: ".cursor",
  openclaw: ".openclaw",
};

export interface SkillInstallEntry {
  agent: SkillAgent;
  path: string;
}

export interface SkillInstallOptions {
  agents?: SkillAgent[];
  scope: SkillScope;
  force: boolean;
  homeDir?: string;
  cwd?: string;
  sourcePath?: string;
}

export interface SkillInstallResult {
  scope: SkillScope;
  baseDir: string;
  installed: SkillInstallEntry[];
  skipped: SkillInstallEntry[];
  detectedNone: boolean;
  error?: string;
}

/**
 * Locate the bundled `skills/spica-architect/SKILL.md` without any network access.
 * Checks the published dist layout first, then falls back to monorepo source paths.
 */
export function resolveBundledSkillPath(fromUrl: string = import.meta.url): string | undefined {
  const currentDir = path.dirname(url.fileURLToPath(fromUrl));
  const candidates = [
    path.join(currentDir, "skills", SKILL_NAME, "SKILL.md"),
    path.resolve(currentDir, "..", "dist", "skills", SKILL_NAME, "SKILL.md"),
    path.resolve(currentDir, "..", "..", "..", "skills", SKILL_NAME, "SKILL.md"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return undefined;
}

export function detectSkillAgents(baseDir: string): SkillAgent[] {
  return ALL_SKILL_AGENTS.filter((agent) =>
    fs.existsSync(path.join(baseDir, AGENT_CONFIG_DIRS[agent])),
  );
}

export function resolveSkillTargetPath(baseDir: string, agent: SkillAgent): string {
  return path.join(baseDir, AGENT_CONFIG_DIRS[agent], "skills", SKILL_NAME, "SKILL.md");
}

export function installSkill(options: SkillInstallOptions): SkillInstallResult {
  const baseDir =
    options.scope === "global"
      ? (options.homeDir ?? os.homedir())
      : (options.cwd ?? process.cwd());

  const sourcePath = options.sourcePath ?? resolveBundledSkillPath();
  if (!sourcePath || !fs.existsSync(sourcePath)) {
    return {
      scope: options.scope,
      baseDir,
      installed: [],
      skipped: [],
      detectedNone: false,
      error: `Bundled ${SKILL_NAME} skill not found. Ensure @simway/spica was built with "vendor-skill".`,
    };
  }

  const targets =
    options.agents && options.agents.length > 0
      ? options.agents
      : detectSkillAgents(baseDir);

  if (targets.length === 0) {
    return {
      scope: options.scope,
      baseDir,
      installed: [],
      skipped: [],
      detectedNone: true,
    };
  }

  const installed: SkillInstallEntry[] = [];
  const skipped: SkillInstallEntry[] = [];

  for (const agent of targets) {
    const dest = resolveSkillTargetPath(baseDir, agent);
    if (fs.existsSync(dest) && !options.force) {
      skipped.push({ agent, path: dest });
      continue;
    }
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(sourcePath, dest);
    installed.push({ agent, path: dest });
  }

  return {
    scope: options.scope,
    baseDir,
    installed,
    skipped,
    detectedNone: false,
  };
}
