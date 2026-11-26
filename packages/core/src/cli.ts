#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { createInterface } from "node:readline/promises";
import type { AstRoot } from "./schema.js";
import { validateAdm, ADM_DOCS_URL } from "./admValidator.js";
import {
  ADM_SPEC_METADATA,
  renderSpecSummary,
  renderExplain,
  explainTopic,
  generateAdmJsonSchema,
  listTopicSuggestions,
} from "./admSpec.js";
import { projectKiroSpec } from "./kiroSpecProjector.js";
import { projectOpenApi3Spec } from "./openApiProjector.js";
import {
  projectDomainAggregateMap,
  projectSystemContextDiagram,
  projectClassDiagram,
  projectStateMachineDiagram,
} from "./diagramProjector.js";
import { projectDddCrewMarkdown } from "./dddCrewProjector.js";
import {
  CLAUDE_CODE_TEMPLATE,
  CODEX_TEMPLATE,
  VSCODE_SETTINGS_TEMPLATE,
  COPILOT_INSTRUCTIONS_TEMPLATE,
} from "./initTemplates.js";
import {
  ALL_SKILL_AGENTS,
  SKILL_NAME,
  installSkill,
  type SkillAgent,
  type SkillScope,
} from "./skillInstaller.js";

const VERSION = "0.0.14";

function printHelp() {
  console.log(`
Spica CLI 🌟 v${VERSION}
The Open Domain-Model Specification & Projection Toolchain for Spec-Driven Development (SDD)

Usage:
  spica <command> [options]

Commands:
  init [dir]                   Bootstrap IDE tooling (CLAUDE.md, CODEX.md, .vscode/settings.json, Copilot)
  skill install [options]      Install spica-architect skill into local or global AI agent runtimes
  new [domain]                 Scaffold a schema-compliant Open ADM model into .spica/ (1 non-anemic aggregate)
  validate <file>              Validate an Open ADM model for invariant soundness
  spec                         Print an offline summary of the Open ADM metamodel
  explain <topic>              Inspect a spec topic (e.g. aggregates, createdAt, commands)
  schema                       Dump the raw Open ADM JSON schema (offline)
  project-kiro <file>          Project an Open ADM model into AWS Kiro IDE specs (.kiro/specs/)
  project-openapi <file>       Project an Open ADM model into an OpenAPI 3.0 specification
  project-c4 <file>            Project an Open ADM model into a C4 Level 1 diagram
  project-domain-map <file>    Project an Open ADM model into a topological Aggregate Map (graph TD)
  build [file]                 Validate + project all lenses atomically (auto-discovers .spica/*.adm.json)
  share <file>                 Generate a 1-click live preview URL on https://spica.simway.io

Options:
  --out, -o <path>             Specify output directory or file path
  --ide <claude|codex|vscode|copilot|all>  Select environments for "init" (default: all)
  --agent <claude|cursor|openclaw|all>     Select agent runtime for "skill install" (default: auto-detect)
  --global, -g                 Install skill into user home directory (default for "skill install")
  --local, -l                  Install skill into current project directory (for "skill install")
  --force, -f                  Overwrite existing files (for "init", "new", and "skill install")
  --title <string>             Set system title for "new" (default: "<Domain> System")
  --actor <string>             Set primary actor for "new" (default: "Admin")
  --aggregate <string>         Set aggregate root name for "new" (default: domain name)
  --json                       Output machine-readable JSON (useful for AI agents & CI)
  --version, -v                Print Spica CLI version
  --help, -h                   Show this help message

Examples:
  npx -y @simway/spica init
  npx -y @simway/spica init . --ide copilot --force
  npx -y @simway/spica skill install
  npx -y @simway/spica skill install --agent claude --local --force
  npx -y @simway/spica new OrderFulfillment
  npx -y @simway/spica new billing --actor Admin --title "Billing System" --aggregate Invoice
  npx -y @simway/spica new order-fulfillment --out specs/ --force --json
  npx -y @simway/spica validate domain.adm.json
  npx -y @simway/spica spec
  npx -y @simway/spica explain aggregates
  npx -y @simway/spica schema
  npx -y @simway/spica project-kiro domain.adm.json -o .kiro/specs/billing
  npx -y @simway/spica project-openapi domain.adm.json -o openapi.json
  npx -y @simway/spica build domain.adm.json -o dist/
  npx -y @simway/spica build
  npx -y @simway/spica share domain.adm.json
`);
}

function loadModel(filePath: string): any {
  const resolved = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(resolved)) {
    console.error(`Error: File not found at "${resolved}"`);
    process.exit(1);
  }

  try {
    const raw = fs.readFileSync(resolved, "utf-8");
    return JSON.parse(raw);
  } catch (err: any) {
    console.error(`Error parsing JSON in "${resolved}": ${err.message}`);
    process.exit(1);
  }
}

/**
 * Prominent discoverability footer printed below validation errors so users
 * and AI agents can jump straight to the Open ADM Spec & remediation docs.
 * Written to stderr so it is emitted in order, directly beneath the errors.
 */
function printSpecReferenceFooter(): void {
  console.error(`\n📖 Open ADM Spec & Docs: ${ADM_DOCS_URL}`);
  console.error(`💡 Tip: Run "spica init" to bootstrap schema-aware IDE prompts (CLAUDE.md, CODEX.md, VS Code settings, Copilot instructions).`);
}

type IdeName = "claude" | "codex" | "vscode" | "copilot";

interface IdeTemplate {
  content: string;
  target: string;
}

const IDE_TEMPLATES: Record<IdeName, IdeTemplate> = {
  claude: { content: CLAUDE_CODE_TEMPLATE, target: "CLAUDE.md" },
  codex: { content: CODEX_TEMPLATE, target: "CODEX.md" },
  vscode: { content: VSCODE_SETTINGS_TEMPLATE, target: path.join(".vscode", "settings.json") },
  copilot: { content: COPILOT_INSTRUCTIONS_TEMPLATE, target: path.join(".github", "copilot-instructions.md") },
};

const ALL_IDES: IdeName[] = ["claude", "codex", "vscode", "copilot"];

function runInit(args: string[]): number {
  let targetDir = ".";
  const selected = new Set<IdeName>();
  let force = false;

  const addIde = (raw: string): boolean => {
    const value = raw.trim().toLowerCase();
    if (value === "all") {
      for (const ide of ALL_IDES) selected.add(ide);
      return true;
    }
    if (value === "claude" || value === "codex" || value === "vscode" || value === "copilot") {
      selected.add(value);
      return true;
    }
    console.error(`Error: Unknown --ide value "${raw}". Expected one of: claude, codex, vscode, copilot, all.`);
    return false;
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--ide") {
      const value = args[i + 1];
      if (!value || value.startsWith("-")) {
        console.error(`Error: --ide requires a value (claude | codex | vscode | copilot | all).`);
        return 1;
      }
      if (!addIde(value)) return 1;
      i++;
    } else if (arg.startsWith("--ide=")) {
      if (!addIde(arg.slice("--ide=".length))) return 1;
    } else if (arg === "--force" || arg === "-f") {
      force = true;
    } else if (arg.startsWith("-")) {
      console.error(`Error: Unknown option "${arg}". Run "spica --help" for usage.`);
      return 1;
    } else {
      targetDir = arg;
    }
  }

  if (selected.size === 0) {
    for (const ide of ALL_IDES) selected.add(ide);
  }

  const resolvedTarget = path.resolve(process.cwd(), targetDir);
  const created: string[] = [];
  const skipped: string[] = [];

  for (const ide of ALL_IDES) {
    if (!selected.has(ide)) continue;
    const { content, target } = IDE_TEMPLATES[ide];
    const dest = path.join(resolvedTarget, target);

    if (fs.existsSync(dest) && !force) {
      skipped.push(target);
      continue;
    }

    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, content, "utf-8");
    created.push(target);
  }

  console.log(`\n🌟 Spica initialized: ${resolvedTarget}`);

  if (created.length > 0) {
    console.log(`\nCreated:`);
    for (const file of created) {
      console.log(`   ✅ ${file}`);
    }
  }

  if (skipped.length > 0) {
    console.log(`\nSkipped (already exists — pass --force to overwrite):`);
    for (const file of skipped) {
      console.log(`   ⏭️  ${file}`);
    }
  }

  console.log(`\nNext steps:`);
  console.log(`   • Claude Code — just start prompting; it reads CLAUDE.md automatically.`);
  console.log(`   • OpenAI Codex — run "codex" in this directory; it reads CODEX.md.`);
  console.log(`   • VS Code — open this folder; *.adm.json files get schema-aware validation.`);
  console.log(`   • GitHub Copilot — open Copilot Chat; it reads .github/copilot-instructions.md automatically.`);
  console.log(`\nValidate your first model: npx -y @simway/spica validate <domain>.adm.json\n`);

  return 0;
}

function printSkillHelp(): void {
  console.log(`
Usage: spica skill install [options]

Install the bundled ${SKILL_NAME} skill into local or global AI agent runtimes (zero-network).

Options:
  --agent <claude|cursor|openclaw|all>  Target agent runtime (default: auto-detect existing config dirs)
  --global, -g                          Install into user home directory (default)
  --local, -l                           Install into current project directory
  --force, -f                           Overwrite existing SKILL.md
  --json                                Output machine-readable JSON
  --help, -h                            Show this help message
`);
}

function runSkillInstall(args: string[]): number {
  const selected = new Set<SkillAgent>();
  let hasGlobal = false;
  let hasLocal = false;
  let force = false;
  let isJson = false;

  const addAgent = (raw: string): boolean => {
    const value = raw.trim().toLowerCase();
    if (value === "all") {
      for (const agent of ALL_SKILL_AGENTS) selected.add(agent);
      return true;
    }
    if (value === "claude" || value === "cursor" || value === "openclaw") {
      selected.add(value);
      return true;
    }
    console.error(`Error: Unknown --agent value "${raw}". Expected one of: claude, cursor, openclaw, all.`);
    return false;
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--help" || arg === "-h") {
      printSkillHelp();
      return 0;
    } else if (arg === "--agent") {
      const value = args[i + 1];
      if (!value || value.startsWith("-")) {
        console.error(`Error: --agent requires a value (claude | cursor | openclaw | all).`);
        return 1;
      }
      if (!addAgent(value)) return 1;
      i++;
    } else if (arg.startsWith("--agent=")) {
      if (!addAgent(arg.slice("--agent=".length))) return 1;
    } else if (arg === "--global" || arg === "-g") {
      hasGlobal = true;
    } else if (arg === "--local" || arg === "-l") {
      hasLocal = true;
    } else if (arg === "--force" || arg === "-f") {
      force = true;
    } else if (arg === "--json") {
      isJson = true;
    } else if (arg.startsWith("-")) {
      console.error(`Error: Unknown option "${arg}". Run "spica skill install --help" for usage.`);
      return 1;
    } else {
      console.error(`Error: Unexpected argument "${arg}". Run "spica skill install --help" for usage.`);
      return 1;
    }
  }

  if (hasGlobal && hasLocal) {
    console.error(`Error: Cannot specify both --global and --local.`);
    return 1;
  }

  const scope: SkillScope = hasLocal ? "local" : "global";
  const result = installSkill({
    agents: selected.size > 0 ? Array.from(selected) : undefined,
    scope,
    force,
  });

  if (result.error) {
    console.error(`Error: ${result.error}`);
    return 1;
  }

  if (isJson) {
    console.log(JSON.stringify(result, null, 2));
    return 0;
  }

  if (result.detectedNone) {
    console.log(`\nℹ️  No supported AI agent configuration directories detected in ${result.baseDir} (.claude, .cursor, .openclaw).`);
    console.log(`   Tip: Pass --agent <claude|cursor|openclaw|all> to install explicitly.\n`);
    return 0;
  }

  console.log(`\n🌟 Spica skill (${SKILL_NAME}) [${result.scope}]: ${result.baseDir}`);

  if (result.installed.length > 0) {
    console.log(`\nInstalled:`);
    for (const entry of result.installed) {
      console.log(`   ✅ ${entry.agent}: ${entry.path}`);
    }
  }

  if (result.skipped.length > 0) {
    console.log(`\nSkipped (already exists — pass --force to overwrite):`);
    for (const entry of result.skipped) {
      console.log(`   ⏭️  ${entry.agent}: ${entry.path}`);
    }
  }

  console.log("");
  return 0;
}

function runSkill(args: string[]): number {
  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    printSkillHelp();
    return 0;
  }

  if (args[0] === "install") {
    return runSkillInstall(args.slice(1));
  }

  console.error(`Error: Unknown skill subcommand "${args[0]}". Expected "install". Run "spica skill --help" for usage.`);
  return 1;
}

function runSpec(args: string[]): number {
  const isJson = args.includes("--json");
  if (isJson) {
    console.log(JSON.stringify(ADM_SPEC_METADATA, null, 2));
  } else {
    console.log(`\n${renderSpecSummary()}`);
  }
  return 0;
}

function runSchema(_args: string[]): number {
  // Raw byte-exact dump of the canonical JSON schema (no extra trailing newline).
  process.stdout.write(generateAdmJsonSchema());
  return 0;
}

interface AdmDiscovery {
  file?: string;
  error?: string;
}

/**
 * Resolve the ADM source for `spica build` when no explicit <file> is given.
 * Fallback order: `.spica/*.adm.json` → `./*.adm.json`.
 * Ambiguity (multiple candidates) is surfaced as an error rather than guessed.
 */
function discoverAdmFile(): AdmDiscovery {
  const cwd = process.cwd();
  const spicaDir = path.join(cwd, ".spica");

  const collect = (dir: string, prefix: string): string[] => {
    if (!fs.existsSync(dir)) return [];
    return fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".adm.json"))
      .sort()
      .map((f) => path.join(prefix, f));
  };

  const spicaMatches = collect(spicaDir, path.join(".spica"));
  if (spicaMatches.length > 0) {
    if (spicaMatches.length > 1) {
      return { error: `Multiple ADM files found in .spica/ (${spicaMatches.join(", ")}). Pass an explicit <file> argument.` };
    }
    return { file: spicaMatches[0] };
  }

  const rootMatches = collect(cwd, ".");
  if (rootMatches.length > 0) {
    if (rootMatches.length > 1) {
      return { error: `Multiple ADM files found in the working directory (${rootMatches.join(", ")}). Pass an explicit <file> argument.` };
    }
    return { file: rootMatches[0] };
  }

  return { error: `No .adm.json file found. Run "spica new <domain>" to scaffold one, or pass an explicit <file> argument.` };
}

/**
 * `spica build [file] [-o <out-dir>] [--json]`
 *
 * The Agent-First (AX) atomic pipeline: validate invariants once, then project
 * every lens to standard paths in a single deterministic pass. Eliminates the
 * spec drift that arises from running 4 separate projection commands.
 *
 * Gate 1 (Validate): `validateAdm` — abort with diagnostics on any failure.
 * Gate 2 (Multi-Lens Projection): emit all lenses under the output dir.
 */
function runBuild(args: string[]): number {
  let fileArg: string | undefined;
  let outDir: string | undefined;
  let isJson = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--json") {
      isJson = true;
    } else if (arg === "--out" || arg === "-o") {
      const value = args[i + 1];
      if (!value || value.startsWith("-")) {
        console.error(`Error: ${arg} requires a directory path.`);
        return 1;
      }
      outDir = value;
      i++;
    } else if (arg.startsWith("-")) {
      console.error(`Error: Unknown option "${arg}". Run "spica --help" for usage.`);
      return 1;
    } else if (fileArg === undefined) {
      fileArg = arg;
    } else {
      console.error(`Error: Unexpected extra argument "${arg}".`);
      return 1;
    }
  }

  if (!fileArg) {
    const discovery = discoverAdmFile();
    if (discovery.error || !discovery.file) {
      console.error(`Error: ${discovery.error}`);
      return 1;
    }
    fileArg = discovery.file;
  }

  const rawModel = loadModel(fileArg);
  const validation = validateAdm(rawModel);

  // Gate 1: Validate — abort before projecting anything on any invariant failure.
  if (!validation.valid || !validation.model) {
    console.error(`\n❌ Build aborted: Invariant validation failed (${validation.errors.length} error${validation.errors.length === 1 ? "" : "s"}):`);
    for (const err of validation.errors) {
      console.error(`   • [${err.code}] ${err.path}: ${err.message}`);
      if (err.hint) {
        console.error(`      💡 ${err.hint}`);
      }
    }
    printSpecReferenceFooter();
    return 1;
  }

  // Gate 2: Multi-Lens Projection — emit all lenses atomically under outDir.
  const base = outDir ? path.resolve(process.cwd(), outDir) : process.cwd();
  const written: string[] = [];

  // 1. OpenAPI 3.0.3 contract.
  const openapi = projectOpenApi3Spec(validation.model);
  const openapiPath = path.join(base, "openapi.json");
  fs.mkdirSync(path.dirname(openapiPath), { recursive: true });
  fs.writeFileSync(openapiPath, JSON.stringify(openapi, null, 2), "utf-8");
  written.push(openapiPath);

  // 2. AWS Kiro specs (.kiro/specs/<domain>/).
  const kiro = projectKiroSpec(validation.model);
  const kiroDir = path.join(base, ".kiro", "specs", kiro.featureName);
  fs.mkdirSync(kiroDir, { recursive: true });
  fs.writeFileSync(path.join(kiroDir, "requirements.md"), kiro.files.requirements, "utf-8");
  fs.writeFileSync(path.join(kiroDir, "design.md"), kiro.files.design, "utf-8");
  fs.writeFileSync(path.join(kiroDir, "tasks.md"), kiro.files.tasks, "utf-8");
  written.push(path.join(kiroDir, "requirements.md"));
  written.push(path.join(kiroDir, "design.md"));
  written.push(path.join(kiroDir, "tasks.md"));

  // 3. Mermaid diagrams (C4 context, topological domain map, UML class, state lifecycle).
  const diagramsDir = path.join(base, "docs", "diagrams");
  fs.mkdirSync(diagramsDir, { recursive: true });
  const diagrams: Array<[string, string]> = [
    ["system-context.mmd", projectSystemContextDiagram(validation.model)],
    ["domain-map.mmd", projectDomainAggregateMap(validation.model)],
    ["class-diagram.mmd", projectClassDiagram(validation.model)],
    ["state-machine.mmd", projectStateMachineDiagram(validation.model)],
  ];
  for (const [name, content] of diagrams) {
    const dest = path.join(diagramsDir, name);
    fs.writeFileSync(dest, content, "utf-8");
    written.push(dest);
  }

  // 4. DDD Crew Aggregate Canvas.
  const canvasPath = path.join(base, "docs", "canvas", "aggregate-canvas.md");
  fs.mkdirSync(path.dirname(canvasPath), { recursive: true });
  fs.writeFileSync(canvasPath, projectDddCrewMarkdown(validation.model), "utf-8");
  written.push(canvasPath);

  if (isJson) {
    console.log(JSON.stringify({
      domain: validation.model.domainName,
      outputDir: base,
      files: written.map((f) => path.relative(base, f)),
    }, null, 2));
  } else {
    console.log(`\n🏗️  Spica build complete for "${validation.model.domainName}":`);
    console.log(`   Output directory: ${base}`);
    for (const f of written) {
      console.log(`   ✅ ${path.relative(base, f)}`);
    }
  }

  return 0;
}

function runExplain(args: string[]): number {
  const topicArg = args.find((a) => !a.startsWith("-"));
  if (!topicArg) {
    console.error(`Error: Missing <topic> argument for "explain".`);
    console.error(`Usage: spica explain <topic>   e.g. spica explain aggregates`);
    console.error(`Try one of: ${listTopicSuggestions().join(", ")}`);
    return 1;
  }

  const isJson = args.includes("--json");
  const topic = explainTopic(topicArg);
  if (!topic) {
    console.error(`Error: Unknown topic "${topicArg}".`);
    console.error(`Try one of: ${listTopicSuggestions().join(", ")}`);
    return 1;
  }

  if (isJson) {
    console.log(JSON.stringify(topic, null, 2));
  } else {
    console.log(`\n${renderExplain(topic)}`);
  }
  return 0;
}

/**
 * Convert an arbitrary domain identifier (kebab-case, snake_case, spaces, or
 * already-PascalCase) into a canonical PascalCase identifier used for the
 * domainName, aggregate, entity, and command naming.
 */
export function toPascalCase(input: string): string {
  const words = input
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1));
  return words.join("") || "Domain";
}

export interface ScaffoldOptions {
  /** Raw domain identifier (e.g. "order-fulfillment", "OrderFulfillment"). */
  domain: string;
  /** Human-readable system title (defaults to "<Domain> System"). */
  title?: string;
  /** Primary external actor persona (defaults to "Admin"). */
  actor?: string;
  /** Aggregate root name (defaults to the PascalCase domain name). */
  aggregate?: string;
  /** Attribution author (defaults to "Spica Architect"). */
  author?: string;
  /** ISO-8601 UTC creation timestamp (defaults to now). */
  createdAt?: string;
}

/**
 * Deterministically build a schema-compliant, non-anemic Open ADM scaffold.
 * Guaranteed to pass `validateAdm` green out of the box: one aggregate with a
 * declared lifecycle (states), a root entity carrying an explicit `$id`, and a
 * creation + transition command set whose `requiredState`/`targetState` are all
 * grounded in the declared states.
 */
export function buildScaffoldModel(opts: ScaffoldOptions): AstRoot {
  const domainName = toPascalCase(opts.domain);
  const aggregateName = opts.aggregate ? toPascalCase(opts.aggregate) : domainName;
  const actor = opts.actor || "Admin";
  const author = opts.author || "Spica Architect";
  const systemName = opts.title || `${domainName} System`;
  const createdAt = opts.createdAt || new Date().toISOString();

  const model: AstRoot = {
    $schema: "https://spica.simway.io/schema/adm.json",
    specVersion: "0.0.0",
    author,
    createdAt,
    domainName,
    systemName,
    systemDescription: `Manages ${domainName} operations and lifecycle.`,
    actors: [
      { name: actor, description: `Primary actor interacting with the ${domainName} domain.` },
    ],
    aggregates: [
      {
        name: aggregateName,
        rootEntity: aggregateName,
        states: ["Created", "Active", "Archived"],
        entities: [
          {
            name: aggregateName,
            fields: [
              { name: "$id", type: "string", required: true },
              { name: "name", type: "string", required: true },
            ],
          },
        ],
        commands: [
          {
            name: `Create${aggregateName}`,
            actor,
            isCreation: true,
            requiredState: "",
            targetState: "Created",
            parameters: [{ name: "name", type: "string", required: true }],
          },
          {
            name: `Activate${aggregateName}`,
            actor,
            requiredState: "Created",
            targetState: "Active",
          },
          {
            name: `Archive${aggregateName}`,
            actor,
            requiredState: "Active",
            targetState: "Archived",
          },
        ],
      },
    ],
  };

  return model;
}

interface NewArgs {
  domain?: string;
  out?: string;
  force: boolean;
  title?: string;
  actor?: string;
  aggregate?: string;
  json: boolean;
}

function parseNewArgs(args: string[]): { opts: NewArgs; error?: string } {
  const opts: NewArgs = { force: false, json: false };
  type ValueFlagKey = "out" | "title" | "actor" | "aggregate";
  const valueFlags: Record<string, ValueFlagKey> = {
    "--out": "out",
    "-o": "out",
    "--title": "title",
    "--actor": "actor",
    "--aggregate": "aggregate",
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--force" || arg === "-f") {
      opts.force = true;
      continue;
    }
    if (arg === "--json") {
      opts.json = true;
      continue;
    }
    if (arg.startsWith("-")) {
      const eq = arg.indexOf("=");
      const key = eq !== -1 ? arg.slice(0, eq) : arg;
      const mapped = valueFlags[key];
      if (!mapped) {
        return { opts, error: `Unknown option "${arg}". Run "spica --help" for usage.` };
      }
      let value: string;
      if (eq !== -1) {
        value = arg.slice(eq + 1);
      } else {
        value = args[i + 1];
        if (!value || value.startsWith("-")) {
          return { opts, error: `${key} requires a value.` };
        }
        i++;
      }
      opts[mapped] = value;
      continue;
    }
    if (opts.domain !== undefined) {
      return { opts, error: `Unexpected extra argument "${arg}".` };
    }
    opts.domain = arg;
  }

  return { opts };
}

function resolveNewOutputPath(out: string | undefined, domainName: string): string {
  const defaultFile = `${domainName}.adm.json`;
  if (!out) {
    return path.resolve(process.cwd(), ".spica", defaultFile);
  }
  const resolved = path.resolve(process.cwd(), out);
  // A `.json` suffix denotes an explicit file path; otherwise `--out` is a
  // target directory into which `<domain>.adm.json` is written.
  if (out.endsWith(".json")) {
    return resolved;
  }
  return path.join(resolved, defaultFile);
}

function writeScaffold(target: string, model: AstRoot, force: boolean, json: boolean): number {
  if (fs.existsSync(target) && !force) {
    console.error(`Error: Output file already exists at "${target}". Pass --force to overwrite.`);
    return 1;
  }

  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify(model, null, 2) + "\n", "utf-8");

  const validation = validateAdm(model);
  const aggregate = model.aggregates[0];

  if (json) {
    console.log(JSON.stringify({
      domain: model.domainName,
      path: target,
      aggregates: model.aggregates.length,
      states: aggregate?.states ?? [],
      commands: aggregate?.commands?.length ?? 0,
      validated: validation.valid,
    }, null, 2));
    return validation.valid ? 0 : 1;
  }

  console.log(`\n🌟 Scaffolded Open ADM model: ${target}`);
  console.log(`   Domain: "${model.domainName}"`);
  console.log(`   Aggregate: ${aggregate?.name ?? "—"} (${aggregate?.states.length ?? 0} states, ${aggregate?.commands?.length ?? 0} commands)`);
  console.log(`   Validation: ${validation.valid ? "✅ green" : "❌ failed"}`);
  console.log(`\nNext steps:`);
  console.log(`   npx -y @simway/spica build`);
  console.log(`   npx -y @simway/spica validate ${target}`);
  console.log(`   npx -y @simway/spica share ${target}\n`);
  return validation.valid ? 0 : 1;
}

async function runNewInteractive(): Promise<number> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const domainRaw = (await rl.question("Domain name (e.g. OrderFulfillment): ")).trim();
    if (!domainRaw) {
      console.error("Error: Domain name is required.");
      return 1;
    }
    const domainName = toPascalCase(domainRaw);

    const title = (await rl.question(`System title (default "${domainName} System"): `)).trim();
    const actor = (await rl.question(`Primary actor (default "Admin"): `)).trim();
    const aggregate = (await rl.question(`Aggregate name (default "${domainName}"): `)).trim();
    const out = (await rl.question(`Output path (default ".spica/${domainName}.adm.json"): `)).trim();

    const model = buildScaffoldModel({
      domain: domainRaw,
      title: title || undefined,
      actor: actor || undefined,
      aggregate: aggregate || undefined,
    });

    const target = resolveNewOutputPath(out || undefined, domainName);
    return writeScaffold(target, model, false, false);
  } finally {
    rl.close();
  }
}

function runNew(args: string[]): number | Promise<number> {
  const { opts, error } = parseNewArgs(args);
  if (error) {
    console.error(`Error: ${error}`);
    return 1;
  }

  if (!opts.domain) {
    if (process.stdin.isTTY) {
      return runNewInteractive();
    }
    console.error(`Error: Missing <domain> argument for "new".`);
    console.error(`Usage: spica new <domain> [--out <path>] [--force] [--title <string>] [--actor <string>] [--aggregate <string>] [--json]`);
    console.error(`Tip: run "spica new" in an interactive terminal for the scaffolding wizard.`);
    return 1;
  }

  const model = buildScaffoldModel({
    domain: opts.domain,
    title: opts.title,
    actor: opts.actor,
    aggregate: opts.aggregate,
  });

  const target = resolveNewOutputPath(opts.out, toPascalCase(opts.domain));
  return writeScaffold(target, model, opts.force, opts.json);
}

export function runCli(args: string[]): number | Promise<number> {
  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    printHelp();
    return 0;
  }

  if (args.includes("--version") || args.includes("-v")) {
    console.log(`@simway/spica v${VERSION}`);
    return 0;
  }

  const command = args[0];

  if (command === "init") {
    return runInit(args.slice(1));
  }

  if (command === "skill") {
    return runSkill(args.slice(1));
  }

  if (command === "new") {
    return runNew(args.slice(1));
  }

  if (command === "spec" || command === "docs") {
    return runSpec(args.slice(1));
  }

  if (command === "schema") {
    return runSchema(args.slice(1));
  }

  if (command === "explain") {
    return runExplain(args.slice(1));
  }

  if (command === "build") {
    return runBuild(args.slice(1));
  }

  const fileArg = args[1];

  if (!fileArg || fileArg.startsWith("-")) {
    console.error(`Error: Missing <file> argument for command "${command}".`);
    console.log(`Run "spica --help" for usage.`);
    return 1;
  }

  const isJson = args.includes("--json");
  const outIdx = args.findIndex((a) => a === "--out" || a === "-o");
  const outPath = outIdx !== -1 && args[outIdx + 1] ? args[outIdx + 1] : undefined;

  const rawModel = loadModel(fileArg);
  const validation = validateAdm(rawModel);

  switch (command) {
    case "validate": {
      if (isJson) {
        console.log(JSON.stringify(validation, null, 2));
        return validation.valid ? 0 : 1;
      }

      console.log(`\n🔍 Validating Open ADM: ${fileArg}`);
      console.log(`   Domain: "${validation.model?.domainName ?? rawModel.domainName ?? "Unknown"}"`);
      console.log(`   Aggregates: ${validation.model?.aggregates?.length ?? 0}`);

      if (validation.valid) {
        console.log(`\n✅ Invariant Validation Passed! Model is mathematically sound.`);
        if (validation.warnings.length > 0) {
          console.log(`\n⚠️  Warnings (${validation.warnings.length}):`);
          for (const w of validation.warnings) {
            console.log(`   [${w.code}] ${w.path}: ${w.message}`);
          }
        }
        return 0;
      } else {
        console.error(`\n❌ Invariant Validation Failed (${validation.errors.length} error${validation.errors.length === 1 ? "" : "s"}):`);
        for (const err of validation.errors) {
          console.error(`   • [${err.code}] ${err.path}: ${err.message}`);
          if (err.hint) {
            console.error(`      💡 ${err.hint}`);
          }
        }
        printSpecReferenceFooter();
        return 1;
      }
    }

    case "project-kiro": {
      if (!validation.valid || !validation.model) {
        console.error(`\n❌ Cannot project Kiro specs: Invariant validation failed.`);
        for (const err of validation.errors) {
          console.error(`   • [${err.code}] ${err.path}: ${err.message}`);
        }
        return 1;
      }

      const kiro = projectKiroSpec(validation.model);
      const targetDir = outPath
        ? path.resolve(process.cwd(), outPath)
        : path.resolve(process.cwd(), ".kiro", "specs", kiro.featureName);

      fs.mkdirSync(targetDir, { recursive: true });
      fs.writeFileSync(path.join(targetDir, "requirements.md"), kiro.files.requirements, "utf-8");
      fs.writeFileSync(path.join(targetDir, "design.md"), kiro.files.design, "utf-8");
      fs.writeFileSync(path.join(targetDir, "tasks.md"), kiro.files.tasks, "utf-8");

      if (isJson) {
        console.log(JSON.stringify({ feature: kiro.featureName, directory: targetDir, files: Object.keys(kiro.files) }));
      } else {
        console.log(`\n⚡ Projected AWS Kiro specs successfully for "${kiro.featureName}":`);
        console.log(`   📁 Directory: ${targetDir}`);
        console.log(`   📄 requirements.md (EARS syntax & user stories)`);
        console.log(`   📄 design.md (Architecture, Mermaid state machines)`);
        console.log(`   📄 tasks.md (Traceable implementation checklist)`);
      }
      return 0;
    }

    case "project-openapi": {
      if (!validation.valid || !validation.model) {
        console.error(`\n❌ Cannot project OpenAPI: Invariant validation failed.`);
        return 1;
      }

      const openapi = projectOpenApi3Spec(validation.model);
      const jsonStr = JSON.stringify(openapi, null, 2);

      if (outPath) {
        const targetFile = path.resolve(process.cwd(), outPath);
        fs.mkdirSync(path.dirname(targetFile), { recursive: true });
        fs.writeFileSync(targetFile, jsonStr, "utf-8");
        console.log(`\n🔌 OpenAPI 3.0.3 specification written to: ${targetFile}`);
      } else {
        console.log(jsonStr);
      }
      return 0;
    }

    case "project-c4": {
      if (!validation.valid || !validation.model) {
        console.error(`\n❌ Cannot project C4: Invariant validation failed.`);
        return 1;
      }
      const c4 = projectSystemContextDiagram(validation.model);
      if (outPath) {
        fs.writeFileSync(path.resolve(process.cwd(), outPath), c4, "utf-8");
      } else {
        console.log(c4);
      }
      return 0;
    }

    case "project-domain-map": {
      if (!validation.valid || !validation.model) {
        console.error(`\n❌ Cannot project Domain Map: Invariant validation failed.`);
        return 1;
      }
      const map = projectDomainAggregateMap(validation.model);
      if (outPath) {
        fs.writeFileSync(path.resolve(process.cwd(), outPath), map, "utf-8");
      } else {
        console.log(map);
      }
      return 0;
    }

    case "share": {
      if (!validation.valid || !validation.model) {
        console.error(`\n❌ Cannot generate share URL: Invariant validation failed.`);
        return 1;
      }

      const jsonString = JSON.stringify(validation.model);
      const base64 = Buffer.from(jsonString).toString("base64");
      const url = `https://spica.simway.io/#spec=${encodeURIComponent(base64)}`;

      if (isJson) {
        console.log(JSON.stringify({ url, domain: validation.model.domainName }));
      } else {
        console.log(`\n🌐 1-Click Interactive Live Preview URL:`);
        console.log(`   👉 ${url}\n`);
      }
      return 0;
    }

    default:
      console.error(`Unknown command: "${command}". Run "spica --help" for options.`);
      return 1;
  }
}

function isDirectInvocation(): boolean {
  // Bun sets `import.meta.main = true` for direct runs and `bun build --compile` binaries.
  if ((import.meta as { main?: boolean }).main === true) return true;
  if (!process.argv[1]) return false;
  try {
    const scriptPath = fs.realpathSync(process.argv[1]);
    const fileUrl = url.pathToFileURL(scriptPath).href;
    return import.meta.url === fileUrl;
  } catch {
    return false;
  }
}

// Direct CLI invocation
if (isDirectInvocation()) {
  Promise.resolve(runCli(process.argv.slice(2)))
    .then((exitCode) => process.exit(exitCode))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
