---
name: spica-architect
description: Use whenever starting or building a new project, application, service, or system from scratch, architecting features, designing domain models or state machines, untangling complex business logic, validating domain invariants, or whenever the user asks "how to build/design this?" or needs an Open ADM specification.
---

# Spica Architect Skill 🌟
> **Spec-Driven Development (SDD) & Mathematical Invariant Architecture for Autonomous AI Agents**

This skill equips AI coding agents (Claude Code, GitHub Copilot, Cursor, OpenClaw, Windsurf) to take **full active ownership** of Domain-Driven Design, entity lifecycles, and multi-lens specification projections using the `@simway/spica` engine.

---

## 🧭 Core Mandate: Active Ownership of the Specification

- **You are NOT a passive code reviewer or conversational advisor.** When this skill is active, your primary role is **Lead Domain Architect**.
- **The "Missing ADM" Rule (Take Ownership to Author):**
  - If there is NO `.spica/*.adm.json` file in the workspace or context, **YOUR MANDATE IS TO CREATE ONE**.
  - Do NOT deflect into reviewing raw code snippets in chat prose, and do NOT assume "there's no ADM so I'll just give casual comments".
  - If the user asks *"Is anything wrong?"*, *"How does this look?"*, or pastes schema/requirements text, immediately synthesize the underlying business domain into a concrete Open ADM model (`.spica/<domain>.adm.json`), write it to disk, and run `spica validate` to provide mathematical, compiler-backed answers.
- **Artifact First, Prose Second:** Spec-Driven Development (SDD) means business truth lives in the machine-verifiable specification, not conversational memory. A session without authoring or validating `.spica/<domain>.adm.json` is an incomplete execution of this skill.

---

## When to Use This Skill
- The user asks to:
  - "Plan or architect a new feature / complex workflow before writing code"
  - "Design or debug state machines, transitions, or entity lifecycles"
  - "Review business logic or asks 'Is anything wrong with this workflow / architecture / schema?'"
  - "Create a specification / PRD / domain model"
  - "Generate AWS Kiro specs (`.kiro/specs/`)"
  - "Generate an OpenAPI contract from business rules or for frontend/backend handoffs"
  - "Validate domain invariants or untangle contradictory conditional logic"

---

## Installation & Setup Tracks

1. **Agent Skill (one-time, human-run):** installs this reusable skill into your AI coding agent (Claude Code, Cursor, OpenClaw, Windsurf).
   ```bash
   npx skills add sim-way/spica --skill spica-architect
   ```
2. **Global Standalone CLI (recommended for fast local & agent execution):**
   ```bash
   npm i -g @simway/spica     # or: pnpm add -g @simway/spica
   ```
3. **Project / Developer CLI (durable, versioned team tooling):** pins the CLI as a devDependency.
   ```bash
   npm i -D @simway/spica     # or: pnpm add -D @simway/spica
   ```
4. **Zero-install (ad-hoc):** no local install — invoke with `npx -y @simway/spica <command>` (or `bunx`, `pnpm dlx`).

---

## Verification & Architecture Strategy

Spica enforces mathematical domain soundness via the deterministic `@simway/spica` compiler engine and JSON Schema, **not** through fuzzy prompt-time rule guessing.

Agents operate on two complementary execution paths:

- **Terminal / CLI Mode (Preferred — Node/Bun/pnpm available):**
  Execute `spica validate` (or `npx -y @simway/spica validate`) and projector commands directly in the terminal for sub-second, deterministic invariant enforcement.
- **Browser Studio Mode (Fallback — No Node / Non-JS / Chat-Only):**
  If running in an environment without Node/terminal access (e.g. Python, Go, Rust minimal container, or web chat), author `.spica/<domain>.adm.json` referencing the schema and generate the 1-click preview link:
  `https://spica.simway.io/#spec=<base64>`
  The browser runs `@simway/spica` client-side, validating invariants and projecting all 5 lenses with **zero Node.js dependencies on the host**.

---

## Operational Execution Protocol (Step-by-Step)

### Step 0: Workspace Tooling Check (Optional)
If terminal access is available, check whether the project is already equipped with Spica tooling:
- If `CLAUDE.md`, `CODEX.md`, `.vscode/settings.json`, or `.github/copilot-instructions.md` are absent and the user plans to do recurring Spec-Driven Development in this repository, offer to initialize them:
  > *"Would you like me to bootstrap Spica IDE configurations (`CLAUDE.md`, `CODEX.md`, `.vscode/settings.json`, `.github/copilot-instructions.md`) in this project?"*
- To initialize:
  ```bash
  spica init                 # or: npx -y @simway/spica init
  ```
- Do not blindly overwrite existing files; `spica init` safely skips existing configs unless `--force` is passed.

### Step 1: Conversational Elicitation (4-Stage Socratic Discovery)
If the user's intent is incomplete or ambiguous, elicit domain clarity in focused stages:
1. **Stage 1 (System Context):** Identify Actors (human personas) and External Systems (SaaS, payment gateways).
2. **Stage 2 (Aggregates & Boundaries):** Identify high-cohesion Aggregates and Root Entities.
3. **Stage 3 (Lifecycle States & Commands):** Map out valid states and actions that transition between them.
4. **Stage 4 (Invariants & Business Rules):** Identify guard constraints (e.g., *"Cannot borrow if unpaid fees > $10"*).

- **The Anti-Tech-Leakage Mandate (Strict Tech-Agnosticism):**
  - You must **NEVER** ask the user what database (SQL/NoSQL/Postgres/Mongo), backend framework (Spring Boot, Express, FastAPI), ORM, network protocol, or port they want to use. Technical architecture belongs downstream to the compiler and multi-lens projectors, never inside the Open ADM model.
  - **Actively Abstract User Technical References:** If the user mentions infrastructure or technical implementation details (e.g. *"Use Postgres tables and Redis caching for book checkout"*), you must actively translate and abstract their intent into pure domain primitives:
    - Model an Aggregate (e.g. `BookLoan`) with explicit lifecycle states (`Active`, `Overdue`, `Returned`).
    - Define the Command (`CheckoutBook`) with state guards (`Book.state == Available`).
    - Discard the transient database, caching, and infrastructure references entirely.
- **Proactive Synthesis:** If some details are ambiguous, synthesize sensible baseline states (e.g. `Draft` -> `Active` -> `Archived`) in the initial ADM draft and ask focused questions to refine them—**do not stall in chat prose without creating the specification file**.

### Step 2: Author the Open ADM Model on Disk

> **Instant Scaffold:** Skip the blank canvas — generate a schema-compliant starting model with:
> ```bash
> spica new <domain>              # or: npx -y @simway/spica new <domain>
> ```
> This emits `.spica/<Domain>.adm.json` with the canonical `$schema`, `specVersion`, timestamps, and one non-anemic aggregate that passes `spica validate` out of the box. Use `--out <path>`, `--force`, `--title`, `--actor`, and `--aggregate` for non-interactive control (agents/CI) and `--json` for machine-readable output.

Immediately save the domain model as a valid Open ADM JSON file in the project under `.spica/<domain>.adm.json` (the canonical machine-IR location; only use `specs/<domain>.adm.json` for human-reviewed workspaces), referencing the canonical JSON schema and root envelope. Structure the document using the domain concepts elicited from the user (replace placeholders with the domain's ubiquitous language):

```json
{
  "$schema": "https://spica.simway.io/schema/adm.json",
  "specVersion": "0.0.0",
  "author": "<AuthorOrAgentName>",
  "createdAt": "<ISO-8601 UTC timestamp, e.g. 2026-11-15T00:00:00Z>",
  "domainName": "<DomainNameInPascalCase>",
  "systemName": "<HumanReadableSystemTitle>",
  "systemDescription": "<HighLevelSystemPurposeAndBoundarySummary>",
  "actors": [
    {
      "name": "<PrimaryActorRole>",
      "description": "<WhoThisHumanUserIsAndWhatTheyDo>"
    }
  ],
  "externalSystems": [
    {
      "name": "<ExternalSystemName>",
      "description": "<ThirdPartyServiceOrUpstreamSystem>",
      "relationship": "<IntegrationProtocolOrRelationship>"
    }
  ],
  "aggregates": [
    {
      "name": "<AggregateName>",
      "rootEntity": "<RootEntityName>",
      "states": [
        "<InitialState>",
        "<ActiveState>",
        "<TerminalState>"
      ],
      "entities": [
        {
          "name": "<RootEntityName>",
          "fields": [
            { "name": "$id", "type": "string", "required": true },
            { "name": "<field1>", "type": "string", "required": true },
            { "name": "<field2>", "type": "number", "required": true }
          ]
        }
      ],
      "commands": [
        {
          "name": "<CreationCommandName>",
          "actor": "<PrimaryActorRole>",
          "requiredState": "",
          "targetState": "<InitialState>",
          "parameters": [
            { "name": "<field1>", "type": "string", "required": true },
            { "name": "<field2>", "type": "number", "required": true }
          ],
          "isCreation": true
        },
        {
          "name": "<TransitionCommandName>",
          "actor": "<PrimaryActorRole>",
          "requiredState": "<InitialState>",
          "targetState": "<ActiveState>",
          "parameters": []
        }
      ]
    }
  ]
}
```

### Step 3: Invariant Verification

#### Option A: Terminal / CLI Mode (Preferred when terminal tool exists)
Run the validator (prefers locally or globally installed `spica`, falls back to `npx`):
```bash
spica validate .spica/<domain>.adm.json
# or zero-install:
npx -y @simway/spica validate .spica/<domain>.adm.json
```
*(Also supports `bunx --bun @simway/spica validate` or `pnpm dlx @simway/spica validate`).*
- If the CLI reports errors (`E_...`), resolve the exact invariant violation reported by the compiler and re-validate until green.
- To inspect spec rules offline: run `spica spec` or `spica explain <topic>` (e.g. `spica explain aggregates`).

#### Option B: Browser Studio Mode (When CLI / Node is unavailable)
If operating in an environment without Node/terminal tools (e.g., Python/Go dev container, web chat, air-gapped terminal):
- Encode the model JSON into a Base64 string.
- Provide the 1-click preview link:
  `👉 [Open & Validate in Spica Studio](https://spica.simway.io/#spec=<base64>)`
- Spica Studio runs the full `@simway/spica` engine client-side in the user's browser, providing instant visual feedback and error callouts without local packages.

### Step 4: Multi-Lens Projection

#### Primary Post-Edit Loop: `spica build` (Atomic)
In an Agent-First (AX) workflow, **always run `spica build`** after editing `.spica/<domain>.adm.json`. It validates invariants and projects **all lenses atomically** in a single deterministic pass — eliminating the spec drift caused by running the 4 projection commands separately.

```bash
spica build                  # auto-discovers .spica/*.adm.json (falls back to ./*.adm.json)
# or explicit:
npx -y @simway/spica build .spica/<domain>.adm.json -o <out-dir>
```

- **Gate 1 (Validate):** Runs `validateAdm` first. On any invariant failure, it prints diagnostics and exits `1` immediately — no artifacts are emitted.
- **Gate 2 (Project all lenses):** When valid, it emits everything to standard paths under `<out-dir>`:
  - `openapi.json` — OpenAPI 3.0.3 contract
  - `.kiro/specs/<domain>/requirements.md`, `design.md`, `tasks.md` — AWS Kiro agentic specs
  - `docs/diagrams/system-context.mmd` — C4 Level 1 context diagram
  - `docs/diagrams/domain-map.mmd` — topological aggregate map (`graph TD`)
  - `docs/diagrams/class-diagram.mmd`, `state-machine.mmd` — UML class & state lifecycle
  - `docs/canvas/aggregate-canvas.md` — DDD Crew Aggregate Canvas

#### With CLI:
* **AWS Kiro Agentic Specs (.kiro/specs/):**
  ```bash
  spica project-kiro <domain>.adm.json -o .kiro/specs/<feature>
  # or zero-install:
  npx -y @simway/spica project-kiro <domain>.adm.json -o .kiro/specs/<feature>
  ```
* **OpenAPI 3.0 Contract:**
  ```bash
  spica project-openapi <domain>.adm.json -o openapi.json
  # or zero-install:
  npx -y @simway/spica project-openapi <domain>.adm.json -o openapi.json
  ```
* **Generate 1-Click Interactive Browser Link:**
  ```bash
  spica share <domain>.adm.json
  # or zero-install:
  npx -y @simway/spica share <domain>.adm.json
  ```

#### Without CLI:
- Users open the Spica Studio link (`https://spica.simway.io/#spec=...`) to download `.kiro/specs/`, `openapi.json`, or Mermaid diagram SVGs directly via the web UI.

### Step 5: Deliver Output to Human
Always present the user with:
1. Summary of validated aggregates, states, and commands.
2. File paths of generated `.kiro/specs/` or `openapi.json`.
3. The clickable live preview URL:
   `👉 [Open in Spica Studio](https://spica.simway.io/#spec=...)` so they can visually inspect the Mermaid diagram and C4 context in their browser.
