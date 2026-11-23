import { AstRoot, AggregateNode, CommandNode } from "./schema.js";

export interface KiroSpecFiles {
  requirements: string;
  design: string;
  tasks: string;
}

export interface KiroSpecResult {
  featureName: string;
  files: KiroSpecFiles;
  aggregateSpecs: Record<string, KiroSpecFiles>;
}

export interface KiroProjectorOptions {
  featureName?: string;
  aggregateName?: string;
}

/**
 * Normalizes a string into a clean Kiro feature slug (e.g. "PublicLibraryCirculation" -> "public-library-circulation").
 */
export function toFeatureSlug(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[\s_]+/g, "-")
    .toLowerCase();
}

/**
 * Projects a validated Open ADM (AstRoot) into standard AWS Kiro Spec format (.kiro/specs/<feature>/).
 * Generates the three canonical specification artifacts:
 * - requirements.md: User stories and acceptance criteria in EARS (Easy Approach to Requirements Syntax) format.
 * - design.md: Architecture, bounded contexts, aggregate data models, state machines, and Mermaid diagrams.
 * - tasks.md: Actionable, trackable markdown checklist (- [ ]) structured in execution phases with traceability.
 */
export function projectKiroSpec(
  model: AstRoot,
  options?: KiroProjectorOptions
): KiroSpecResult {
  const rootFeatureName = options?.featureName || toFeatureSlug(model.systemName || model.domainName);

  // If a specific aggregate was requested, generate an aggregate-focused spec
  if (options?.aggregateName) {
    const agg = model.aggregates.find(
      (a) => a.name.toLowerCase() === options.aggregateName?.toLowerCase()
    );
    if (!agg) {
      throw new Error(`Aggregate "${options.aggregateName}" not found in domain "${model.domainName}".`);
    }
    const aggFiles = generateAggregateKiroFiles(model, agg);
    return {
      featureName: toFeatureSlug(agg.name),
      files: aggFiles,
      aggregateSpecs: {
        [agg.name]: aggFiles,
      },
    };
  }

  // Generate the full system-level spec
  const systemFiles: KiroSpecFiles = {
    requirements: generateSystemRequirements(model),
    design: generateSystemDesign(model),
    tasks: generateSystemTasks(model),
  };

  // Also generate per-aggregate specs for multi-feature decomposition
  const aggregateSpecs: Record<string, KiroSpecFiles> = {};
  for (const agg of model.aggregates) {
    aggregateSpecs[agg.name] = generateAggregateKiroFiles(model, agg);
  }

  return {
    featureName: rootFeatureName,
    files: systemFiles,
    aggregateSpecs,
  };
}

/* ========================================================================= */
/* System-Level Spec Generators                                              */
/* ========================================================================= */

function generateSystemRequirements(model: AstRoot): string {
  const lines: string[] = [];
  const title = model.systemName || model.domainName;

  lines.push(`# Requirements Document: ${title}`);
  lines.push("");
  lines.push("## Introduction");
  lines.push(
    model.systemDescription ||
      `This document defines the formal functional requirements and acceptance criteria for the **${title}** domain, compiled deterministically from the Open ADM specification.`
  );
  lines.push("");

  if (model.actors && model.actors.length > 0) {
    lines.push("### Domain Actors (Personas)");
    for (const actor of model.actors) {
      lines.push(`- **${actor.name}**: ${actor.description || "Authorized system persona"}`);
    }
    lines.push("");
  }

  if (model.externalSystems && model.externalSystems.length > 0) {
    lines.push("### External Integrations");
    for (const ext of model.externalSystems) {
      const rel = ext.relationship ? ` (${ext.relationship})` : "";
      lines.push(`- **${ext.name}**${rel}: ${ext.description || "External boundary service"}`);
    }
    lines.push("");
  }

  if (model.globalInvariants && model.globalInvariants.length > 0) {
    lines.push("## System & Global Invariants");
    lines.push(
      "These cross-aggregate domain invariants govern system-wide business rules and consistency constraints that span multiple aggregates."
    );
    lines.push("");

    for (let i = 0; i < model.globalInvariants.length; i++) {
      const inv = model.globalInvariants[i];
      const name = inv.name ? ` (${inv.name})` : "";
      const scope = inv.scope ? ` Scope: ${inv.scope}.` : "";
      const trace = inv.intentTrace ? ` Intent: ${inv.intentTrace}` : "";
      lines.push(`### Global Invariant ${i + 1}${name}`);
      lines.push(`**Rule:** ${inv.rule}${scope}${trace}`);
      lines.push("");
    }
  }

  lines.push("## Requirements");
  lines.push("");

  let reqIndex = 1;
  for (const agg of model.aggregates) {
    const statesStr = agg.states.join(", ");
    const primaryActor = agg.commands?.[0]?.actor || model.actors?.[0]?.name || "Domain User";

    lines.push(`### Requirement ${reqIndex}: ${agg.name} Aggregate Lifecycle Management`);
    lines.push(
      `**User Story:** As a **${primaryActor}**, I want to manage **${agg.name}** operations across declared lifecycle states (${statesStr}), so that domain invariants are preserved deterministically.`
    );
    lines.push("");
    lines.push("#### Acceptance Criteria (EARS Syntax)");

    let acIndex = 1;

    // 1. Creation / Transition commands
    for (const cmd of agg.commands || []) {
      const actorPrefix = cmd.actor ? ` by ${cmd.actor}` : "";
      if (cmd.isCreation) {
        const emitClause = cmd.emits ? ` and emit the "${cmd.emits}" domain event` : "";
        lines.push(
          `${acIndex++}. **WHEN** a valid "${cmd.name}" command is submitted${actorPrefix} **THE SYSTEM SHALL** instantiate a new ${agg.name} aggregate in state "${cmd.targetState}"${emitClause}.`
        );
      } else {
        const reqState = cmd.requiredState ? ` while in state "${cmd.requiredState}"` : "";
        const emitClause = cmd.emits ? ` and emit "${cmd.emits}"` : "";
        lines.push(
          `${acIndex++}. **WHEN** "${cmd.name}" is executed${actorPrefix}${reqState} **THE SYSTEM SHALL** transition ${agg.name} to state "${cmd.targetState}"${emitClause}.`
        );
      }

      // Negative guard for requiredState
      if (cmd.requiredState && !cmd.isCreation) {
        lines.push(
          `${acIndex++}. **WHEN** "${cmd.name}" is attempted while NOT in state "${cmd.requiredState}" **THE SYSTEM SHALL** reject the command with an InvalidStateTransition error.`
        );
      }
    }

    // 2. Invariants
    for (const inv of agg.invariants || []) {
      lines.push(
        `${acIndex++}. **WHEN** invariant rule "${inv.rule}" is evaluated **THE SYSTEM SHALL** prevent state mutation and raise DomainInvariantViolation if violated.`
      );
    }

    // 3. Policies
    for (const policy of agg.policies || []) {
      const srcEvent = policy.sourceEvent || policy.onEvent || policy.name;
      const srcAgg = policy.sourceAggregate ? ` from ${policy.sourceAggregate}` : "";
      const triggerAction = policy.emitsCommand
        ? `trigger command "${policy.emitsCommand}"`
        : `apply policy rule "${policy.rule || policy.name}"`;
      lines.push(
        `${acIndex++}. **WHEN** event "${srcEvent}" is received${srcAgg} **THE SYSTEM SHALL** ${triggerAction}.`
      );
    }

    lines.push("");
    reqIndex++;
  }

  return lines.join("\n");
}

function generateSystemDesign(model: AstRoot): string {
  const lines: string[] = [];
  const title = model.systemName || model.domainName;

  lines.push(`# Technical Design: ${title}`);
  lines.push("");
  lines.push("## 1. System Architecture & Domain Boundaries");
  lines.push(
    `The **${title}** domain is structured around ${model.aggregates.length} bounded aggregate(s) with explicit event-driven communication.`
  );
  lines.push("");

  // Embedded Mermaid Graph
  lines.push("```mermaid");
  lines.push("graph TD");
  for (const agg of model.aggregates) {
    const states = agg.states.join(" | ");
    lines.push(`    subgraph ${agg.name} [Aggregate: ${agg.name}]`);
    lines.push(`        ${agg.name}_States["States: ${states}"]`);
    for (const cmd of agg.commands || []) {
      lines.push(`        ${agg.name}_${cmd.name}["Command: ${cmd.name}"] --> ${agg.name}_States`);
    }
    lines.push("    end");
  }
  lines.push("```");
  lines.push("");

  lines.push("## 2. Aggregate Data Models & Entities");
  for (const agg of model.aggregates) {
    lines.push(`### Aggregate: ${agg.name}`);
    lines.push(`- **Root Entity:** \`${agg.rootEntity}\``);
    lines.push(`- **Lifecycle States:** ${agg.states.map((s) => `\`${s}\``).join(", ")}`);
    lines.push("");

    for (const ent of agg.entities || []) {
      lines.push(`#### Entity: \`${ent.name}\``);
      lines.push("| Field | Type | Required | List | Description |");
      lines.push("| :--- | :--- | :--- | :--- | :--- |");
      for (const field of ent.fields) {
        const reqStr = field.required ? "✓ Yes" : "No";
        const listStr = field.isList ? "✓ Yes" : "No";
        lines.push(`| \`${field.name}\` | \`${field.type}\` | ${reqStr} | ${listStr} | ${field.description || "-"} |`);
      }
      lines.push("");
    }
  }

  lines.push("## 3. State Transitions & Command Handlers");
  for (const agg of model.aggregates) {
    lines.push(`### ${agg.name} State Transition Matrix`);
    lines.push("| Command | Actor | Required State | Target State | Emitted Event |");
    lines.push("| :--- | :--- | :--- | :--- | :--- |");
    for (const cmd of agg.commands || []) {
      const actor = cmd.actor || "-";
      const req = cmd.isCreation ? "*(Creation)*" : cmd.requiredState || "*";
      const target = cmd.targetState || "-";
      const emits = cmd.emits ? `\`${cmd.emits}\`` : "-";
      lines.push(`| \`${cmd.name}\` | ${actor} | ${req} | \`${target}\` | ${emits} |`);
    }
    lines.push("");
  }

  lines.push("## 4. Invariants, Reducers & Policies");
  for (const agg of model.aggregates) {
    const hasInvariants = (agg.invariants?.length ?? 0) > 0;
    const hasReducers = (agg.reducers?.length ?? 0) > 0;
    const hasPolicies = (agg.policies?.length ?? 0) > 0;

    if (!hasInvariants && !hasReducers && !hasPolicies) continue;

    lines.push(`### ${agg.name} Rules & Logic`);
    if (hasInvariants) {
      lines.push("**Invariants:**");
      for (const inv of agg.invariants!) {
        lines.push(`- \`${inv.scope}\`: ${inv.rule}`);
      }
    }
    if (hasReducers) {
      lines.push("");
      lines.push("**State Reducers:**");
      lines.push("| Command | Target Field | Operation | Source Parameter |");
      lines.push("| :--- | :--- | :--- | :--- |");
      for (const red of agg.reducers!) {
        lines.push(`| \`${red.commandName}\` | \`${red.targetField}\` | \`${red.operation}\` | \`${red.sourceParameter}\` |`);
      }
    }
    if (hasPolicies) {
      lines.push("");
      lines.push("**Policies:**");
      for (const pol of agg.policies!) {
        lines.push(`- **${pol.name}**: ${pol.description} (source: \`${pol.sourceEvent || pol.sourceAggregate || "internal"}\`)`);
      }
    }
    lines.push("");
  }

  lines.push("## 5. Architecture Verification Strategy");
  lines.push("- **Deterministic Invariants:** Every command verifies preconditions and invariants prior to state mutation.");
  lines.push("- **Event Sourcing / CQRS Decoupling:** State transitions emit typed domain events; mutations cannot bypass aggregate roots.");
  lines.push("- **Zero Phantom Defaults:** All required aggregate fields must be supplied explicitly.");

  return lines.join("\n");
}

function generateSystemTasks(model: AstRoot): string {
  const lines: string[] = [];
  const title = model.systemName || model.domainName;

  lines.push(`# Implementation Plan: ${title}`);
  lines.push("");
  lines.push("This implementation plan translates the domain model into discrete, trackable engineering tasks for Kiro IDE agents.");
  lines.push("");

  let reqIndex = 1;

  lines.push("## Phase 1: Core Domain Entities & Schemas");
  for (const agg of model.aggregates) {
    const entityNames = agg.entities?.map((e) => e.name).join(", ") || agg.rootEntity;
    lines.push(`- [ ] 1.${reqIndex} Implement \`${agg.name}\` entities and field constraints (${entityNames})`);
    for (const ent of agg.entities || []) {
      const requiredFields = ent.fields.filter((f) => f.required).map((f) => f.name).join(", ");
      lines.push(`    - [ ] Create \`${ent.name}\` schema validating required fields: [${requiredFields || "$id"}]`);
    }
    lines.push(`    _Requirements: Requirement ${reqIndex}_`);
    reqIndex++;
  }
  lines.push("");

  reqIndex = 1;
  lines.push("## Phase 2: State Machines & Command Handlers");
  for (const agg of model.aggregates) {
    lines.push(`- [ ] 2.${reqIndex} Implement \`${agg.name}\` command handlers and state lifecycle`);
    for (const cmd of agg.commands || []) {
      const from = cmd.isCreation ? "Initial" : cmd.requiredState || "*";
      lines.push(`    - [ ] Implement \`${cmd.name}\` handler: validate transition from \`${from}\` to \`${cmd.targetState}\``);
    }
    for (const inv of agg.invariants || []) {
      lines.push(`    - [ ] Enforce invariant: "${inv.rule}"`);
    }
    for (const red of agg.reducers || []) {
      lines.push(`    - [ ] Implement reducer: \`${red.commandName}\` mutates \`${red.targetField}\` via ${red.operation}`);
    }
    lines.push(`    _Requirements: Requirement ${reqIndex}_`);
    reqIndex++;
  }
  lines.push("");

  reqIndex = 1;
  lines.push("## Phase 3: Domain Events & Policy Listeners");
  for (const agg of model.aggregates) {
    const emittedEvents = (agg.commands || [])
      .map((c) => c.emits)
      .filter((e): e is string => Boolean(e));
    const hasEvents = emittedEvents.length > 0 || (agg.policies?.length ?? 0) > 0;

    if (hasEvents) {
      lines.push(`- [ ] 3.${reqIndex} Configure event emission and reactive policies for \`${agg.name}\``);
      for (const evt of emittedEvents) {
        lines.push(`    - [ ] Publish domain event \`${evt}\``);
      }
      for (const pol of agg.policies || []) {
        lines.push(`    - [ ] Implement listener for policy \`${pol.name}\` on event \`${pol.sourceEvent || pol.name}\``);
      }
      lines.push(`    _Requirements: Requirement ${reqIndex}_`);
    }
    reqIndex++;
  }
  lines.push("");

  lines.push("## Phase 4: Integration Harness & Acceptance Testing");
  lines.push(`- [ ] 4.1 Implement EARS-driven BDD acceptance tests for all ${model.aggregates.length} aggregate(s)`);
  lines.push("- [ ] 4.2 Verify negative invariant guard cases and invalid state transitions");
  lines.push("- [ ] 4.3 Validate cross-aggregate event delivery and end-to-end workflows");

  return lines.join("\n");
}

/* ========================================================================= */
/* Aggregate-Specific Spec Generator                                         */
/* ========================================================================= */

function generateAggregateKiroFiles(model: AstRoot, agg: AggregateNode): KiroSpecFiles {
  const reqLines: string[] = [];
  reqLines.push(`# Requirements Document: ${agg.name} Feature`);
  reqLines.push("");
  reqLines.push("## Introduction");
  reqLines.push(
    `This feature specification covers the **${agg.name}** aggregate within the **${model.systemName || model.domainName}** system.`
  );
  reqLines.push("");
  reqLines.push("## Requirements");
  reqLines.push(`### Requirement 1: ${agg.name} Lifecycle & State Management`);
  reqLines.push(
    `**User Story:** As a domain operator, I want to manage ${agg.name} states across [${agg.states.join(", ")}], ensuring business rules are strictly observed.`
  );
  reqLines.push("");
  reqLines.push("#### Acceptance Criteria (EARS Syntax)");

  let ac = 1;
  for (const cmd of agg.commands || []) {
    const actor = cmd.actor ? ` by ${cmd.actor}` : "";
    if (cmd.isCreation) {
      reqLines.push(
        `${ac++}. **WHEN** "${cmd.name}" is called${actor} **THE SYSTEM SHALL** create a ${agg.name} in state "${cmd.targetState}"${cmd.emits ? ` and emit "${cmd.emits}"` : ""}.`
      );
    } else {
      reqLines.push(
        `${ac++}. **WHEN** "${cmd.name}" is executed${actor} in state "${cmd.requiredState}" **THE SYSTEM SHALL** transition to "${cmd.targetState}"${cmd.emits ? ` and emit "${cmd.emits}"` : ""}.`
      );
      if (cmd.requiredState) {
        reqLines.push(
          `${ac++}. **WHEN** "${cmd.name}" is attempted outside state "${cmd.requiredState}" **THE SYSTEM SHALL** return an InvalidStateTransition error.`
        );
      }
    }
  }

  for (const inv of agg.invariants || []) {
    reqLines.push(
      `${ac++}. **WHEN** invariant "${inv.rule}" is breached **THE SYSTEM SHALL** reject the mutation.`
    );
  }

  // Design
  const desLines: string[] = [];
  desLines.push(`# Technical Design: ${agg.name}`);
  desLines.push("");
  desLines.push("## Aggregate Overview");
  desLines.push(`- **Root Entity:** \`${agg.rootEntity}\``);
  desLines.push(`- **Lifecycle States:** ${agg.states.map((s) => `\`${s}\``).join(", ")}`);
  desLines.push("");
  desLines.push("## Entities & Fields");
  for (const ent of agg.entities || []) {
    desLines.push(`### Entity \`${ent.name}\``);
    desLines.push("| Field | Type | Required | List | Description |");
    desLines.push("| :--- | :--- | :--- | :--- | :--- |");
    for (const f of ent.fields) {
      desLines.push(`| \`${f.name}\` | \`${f.type}\` | ${f.required ? "Yes" : "No"} | ${f.isList ? "Yes" : "No"} | ${f.description || "-"} |`);
    }
    desLines.push("");
  }

  desLines.push("## Commands & Transitions");
  desLines.push("| Command | Required State | Target State | Emits |");
  desLines.push("| :--- | :--- | :--- | :--- |");
  for (const c of agg.commands || []) {
    desLines.push(`| \`${c.name}\` | ${c.requiredState || "*"} | \`${c.targetState}\` | ${c.emits ? `\`${c.emits}\`` : "-"} |`);
  }

  // Tasks
  const taskLines: string[] = [];
  taskLines.push(`# Implementation Plan: ${agg.name}`);
  taskLines.push("");
  taskLines.push("## Tasks");
  taskLines.push(`- [ ] 1. Define \`${agg.rootEntity}\` schema and entity properties`);
  for (const c of agg.commands || []) {
    taskLines.push(`- [ ] 2. Implement command handler for \`${c.name}\` (${c.requiredState || "*"} -> ${c.targetState})`);
  }
  for (const inv of agg.invariants || []) {
    taskLines.push(`- [ ] 3. Implement invariant validation for: "${inv.rule}"`);
  }
  taskLines.push(`- [ ] 4. Implement unit and acceptance test suite for \`${agg.name}\``);

  return {
    requirements: reqLines.join("\n"),
    design: desLines.join("\n"),
    tasks: taskLines.join("\n"),
  };
}
