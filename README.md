<p align="center">
  <img src="assets/spica-banner.svg" alt="Spica — Open Domain Model and Projection Toolchain for SDD" width="600" />
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@simway/spica"><img src="https://img.shields.io/badge/npm-@simway%2Fspica-blue.svg?style=flat" alt="npm package" /></a>
  <a href="llms.txt"><img src="https://img.shields.io/badge/llms.txt-Agent_Ready-6366f1?style=flat" alt="llms.txt" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-Apache_2.0-475569.svg?style=flat" alt="License: Apache 2.0" /></a>
  <a href="https://www.slopmanifesto.com/"><img src="https://img.shields.io/badge/Principles-No_AI_Slop-111827.svg?style=flat" alt="No AI Slop Manifesto" /></a>
</p>

---

> **Spica is a practical exploration of the [No AI Slop Manifesto](https://www.slopmanifesto.com/).**

> **One Domain Model. Multiple Projections.**  
> Open ADM is the single source of truth for domain concepts. Spica uses it behind the scenes to generate C4 diagrams, domain maps, DDD canvases, and OpenAPI contracts.
>  
> 🤖 **For AI Agents:** `npx skills add sim-way/spica --skill spica-architect`

---

### 🧠 What is Spica?

Spica is a Spec-Driven Development toolchain that transforms a machine-verifiable domain model into architecture diagrams, API contracts, and project artifacts.

**Open ADM** (Application Domain Model) is a structured IR for business concepts: entities, lifecycle states, commands, events, and invariants. From this single source, Spica generates:

| Output | Command | Purpose |
| :--- | :--- | :--- |
| C4 Diagram | `spica project-c4 <file>` | System architecture documentation |
| Domain Map | `spica project-domain-map <file>` | Aggregate boundaries & state lifecycles |
| DDD Canvas | `spica build` | Team discovery & visual modeling |
| OpenAPI 3.0 | `spica project-openapi <file>` | REST API contracts |

**Why Open ADM?** Unlike OpenAPI (lacks state semantics), Prisma (no business operations), or TypeScript (no cross-system projections), Open ADM captures business semantics needed for AI agents, deterministic validation, and tech-agnostic intent.

---

### When to Use Spica (and When NOT To)

**Use Spica for** stateful, multi-actor business systems, such as fintech, SaaS billing, ERP/CRM, logistics, healthcare, reservations, and workflow approval engines.

**Do NOT use Spica for** compilers or parsers (including Spica itself), image/video codecs, pure algorithmic calculations, CLI utilities, or game loops. Use standard TypeScript, Rust, or Go for those.

---

### ⚡ Quick Start

**Prerequisites:** Node.js 20+

```bash
# Initialize IDE tooling
npx -y @simway/spica init

# Create & validate a domain model
npx -y @simway/spica new Billing --actor Admin --aggregate Invoice
npx -y @simway/spica validate .spica/Billing.adm.json

# Generate all projections
npx -y @simway/spica build .spica/Billing.adm.json

# Or individual projections
npx -y @simway/spica project-c4 .spica/Billing.adm.json -o c4.mmd
npx -y @simway/spica project-domain-map .spica/Billing.adm.json -o map.mmd
npx -y @simway/spica project-openapi .spica/Billing.adm.json -o openapi.json
```

---

### 🛠️ Local Development

```bash
git clone https://github.com/sim-way/spica.git
cd spica
pnpm install
pnpm dev       # Launch dev server
pnpm test      # Run tests
```

See [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md) for contribution guidelines.

---

### 📚 Resources

- 🤖 [Claude Code & Agent Skill](skills/spica-architect/SKILL.md)
- 🤖 [Spica Architect Prompt](prompts/spica-architect.md)
- ⚖️ [License](LICENSE) — Apache 2.0
