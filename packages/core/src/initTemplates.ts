/**
 * Inlined IDE Tooling Templates for `spica init`.
 *
 * Inlining these templates directly in TypeScript makes `@simway/spica` 100% self-contained,
 * eliminating runtime disk lookups, candidate path resolution, and filesystem copy dependencies.
 */

export const CLAUDE_CODE_TEMPLATE = `# Spica Architecture & Spec-Driven Development (SDD) Guide for Claude Code

When the user asks to plan a new feature, design state machines or entity lifecycles, establish API contracts, or refactor complex business logic:

**Open ADM Root Envelope (scaffold this first):**
Every Open ADM document opens with a root envelope carrying spec metadata. Headless agents must include these fields or validation rejects the document:
   - specVersion — Open ADM document standard version (default "0.0.0").
   - author — optional attribution for who authored the ADM.
   - createdAt — ISO-8601 UTC creation timestamp (e.g. 2026-11-10T07:00:00Z).
   - domainName — the domain identifier.

   Minimal skeleton:

    {
      "specVersion": "0.0.0",
      "author": "your-name",
      "createdAt": "2026-11-10T07:00:00Z",
      "domainName": "MyDomain",
      "aggregates": []
    }

0. **Bootstrap the Workspace (if needed):**
   - If the repository lacks Spica tooling (\`CLAUDE.md\`, \`CODEX.md\`, \`.vscode/settings.json\`, \`.github/copilot-instructions.md\`), run:
     \`\`\`bash
     npx -y @simway/spica init
     \`\`\`
   - For durable team tooling, offer \`npm i -D @simway/spica\` (or \`pnpm add -D @simway/spica\`).
   - Always invoke the CLI zero-prompt with \`npx -y @simway/spica ...\` in headless/agent subshells.

1. **Follow the Spica SDD Protocol:**
   - Elicit Actors, External Systems, Aggregate Roots, State Lifecycles, and Commands.
   - Model state transitions explicitly: commands declare \`requiredState\` and \`targetState\`.
   - Reference the canonical schema: \`"$schema": "https://spica.simway.io/schema/adm.json"\`.

2. **Validate Before Implementing:**
   - Save the model as \`<feature>.adm.json\`.
   - Run the zero-install validator:
     \`\`\`bash
     npx -y @simway/spica validate <feature>.adm.json
     \`\`\`
   - If invariant violations are reported, resolve them before generating code or specs.
   - Tip: scaffold a compliant model instantly with npx -y @simway/spica new <domain> (emits a valid <Domain>.adm.json with $schema, specVersion, timestamps, and one non-anemic aggregate; add --out, --force, --title, --actor, --aggregate, and --json for non-interactive agent/CI control).

3. **Project Turnkey Specs:**
   - To project AWS Kiro IDE specs:
     \`\`\`bash
     npx -y @simway/spica project-kiro <feature>.adm.json -o .kiro/specs/<feature>
     \`\`\`
   - To project OpenAPI 3.0 contracts:
     \`\`\`bash
     npx -y @simway/spica project-openapi <feature>.adm.json -o openapi.json
     \`\`\`
   - To generate a 1-click live visual preview link for the human:
     \`\`\`bash
     npx -y @simway/spica share <feature>.adm.json
     \`\`\`

4. **Deliverables:**
   - Report the validation status, link to the generated \`.kiro/specs/\` files, and provide the \`https://spica.simway.io/#spec=...\` live diagram URL to the user.
`;

export const CODEX_TEMPLATE = `# Spica Architecture & Spec-Driven Development (SDD) Guide for OpenAI Codex

When the user asks to plan a new feature, design state machines or entity lifecycles, establish API contracts, or implement business logic against a Spica Open ADM model:

**Open ADM Root Envelope (scaffold this first):**
Every Open ADM document opens with a root envelope carrying spec metadata. Headless agents must include these fields or validation rejects the document:
   - specVersion — Open ADM document standard version (default "0.0.0").
   - author — optional attribution for who authored the ADM.
   - createdAt — ISO-8601 UTC creation timestamp (e.g. 2026-11-10T07:00:00Z).
   - domainName — the domain identifier.

   Minimal skeleton:

    {
      "specVersion": "0.0.0",
      "author": "your-name",
      "createdAt": "2026-11-10T07:00:00Z",
      "domainName": "MyDomain",
      "aggregates": []
    }

0. **Bootstrap the Workspace (if needed):**
   - If the repository lacks Spica tooling (\`CLAUDE.md\`, \`CODEX.md\`, \`.vscode/settings.json\`, \`.github/copilot-instructions.md\`), run:
     \`\`\`bash
     npx -y @simway/spica init
     \`\`\`
   - For durable team tooling, offer \`npm i -D @simway/spica\` (or \`pnpm add -D @simway/spica\`).
   - Always invoke the CLI zero-prompt with \`npx -y @simway/spica ...\` in headless/agent subshells.

1. **Follow the Spica SDD Protocol:**
   - Elicit Actors, External Systems, Aggregate Roots, State Lifecycles, and Commands.
   - Model state transitions explicitly: commands declare \`requiredState\` and \`targetState\`.
   - Reference the canonical schema: \`"$schema": "https://spica.simway.io/schema/adm.json"\`.

2. **Validate Before Implementing:**
   - Save the model as \`<feature>.adm.json\`.
   - Run the zero-install validator:
     \`\`\`bash
     npx -y @simway/spica validate <feature>.adm.json
     \`\`\`
   - If invariant violations are reported, resolve them before writing any code.
   - Tip: scaffold a compliant model instantly with npx -y @simway/spica new <domain> (emits a valid <Domain>.adm.json with $schema, specVersion, timestamps, and one non-anemic aggregate; add --out, --force, --title, --actor, --aggregate, and --json for non-interactive agent/CI control).

3. **Project Turnkey Specs for Test-Driven Implementation:**
   - Project AWS Kiro IDE specs (requirements + design + traceable task checklist):
     \`\`\`bash
     npx -y @simway/spica project-kiro <feature>.adm.json -o .kiro/specs/<feature>
     \`\`\`
   - Project the OpenAPI 3.0 contract for API-level tests:
     \`\`\`bash
     npx -y @simway/spica project-openapi <feature>.adm.json -o openapi.json
     \`\`\`

4. **Implement with TDD Against Projected Invariants:**
   - Write a failing test first for every command handler, asserting its state-transition pre-condition (\`requiredState\`) and post-condition (\`targetState\`).
   - Respect the projected invariants: a command MUST NOT be accepted from a state other than \`requiredState\`, and MUST transition the aggregate to exactly \`targetState\`.
   - Treat \`.kiro/specs/\` and \`openapi.json\` as the source of truth for contracts; re-project them whenever the model changes.

5. **Deliverables:**
   - Report the validation status, the generated spec paths, and your test results.
   - Provide the 1-click live preview URL for the human:
     \`\`\`bash
     npx -y @simway/spica share <feature>.adm.json
     \`\`\`
`;

export const VSCODE_SETTINGS_TEMPLATE = `{
  "$schema": "vscode://schemas/settings/workspace",
  "json.schemas": [
    {
      "fileMatch": ["*.adm.json"],
      "url": "https://spica.simway.io/schema/adm.json"
    }
  ]
}
`;

export const COPILOT_INSTRUCTIONS_TEMPLATE = `# Spica Spec-Driven Development Instructions

Use Spica Open ADM as the source of truth for business-domain behavior. Keep the model in \`.spica/<domain>.adm.json\`, with this root envelope:

\`\`\`json
{
  "specVersion": "0.0.0",
  "domainName": "MyDomain",
  "aggregates": []
}
\`\`\`

## Model First

- For new business capabilities, model actors, aggregates, commands, lifecycle states, and invariants in the ADM before implementing runtime code.
- When asked to explain, refactor, or add features to existing business logic, first extract or update the ADM from the existing schemas, enums, and services. Keep business concepts and rules; filter out persistence-only details such as database row IDs, timestamps, and storage-specific fields unless they represent domain behavior.
- Preserve the existing domain model and update it when the requested behavior changes. Do not invent business rules or state transitions that are not grounded in the code or confirmed requirements.
- Use the canonical schema: \`"$schema": "https://spica.simway.io/schema/adm.json"\`.

## Verify the Model

Before implementing code, validate the model and generate its projections:

\`\`\`bash
npx -y @simway/spica validate .spica/<domain>.adm.json
npx -y @simway/spica build
\`\`\`

Resolve validation errors before proceeding. Review the projected state transitions and invariants as the implementation contract.

## Implement Against Projected Behavior

- Implement runtime code and tests strictly against modeled command transitions: each command's \`requiredState\` is its precondition and \`targetState\` is its resulting state.
- Cover rejected transitions and domain invariants in tests; do not accept a command from a state other than its \`requiredState\` or transition to a different state than its \`targetState\`.
- If the requested behavior is not represented in the model, update the ADM and regenerate projections before changing runtime behavior.
- Re-run validation and build after changing the ADM, and run the relevant project tests after implementation.
`;
