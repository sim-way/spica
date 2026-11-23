import { z } from "zod";

export const FieldNodeSchema = z.object({
  name: z.string(),
  type: z.string(),
  // Zero phantom defaults (#300): `required` is NOT synthesized. A field that
  // omits `required` stays `undefined`; the Ingestion Gate (`admValidator.ts`)
  // treats only an explicit `required: true` as required and rejects any entity
  // lacking at least one explicit required field.
  required: z.boolean().optional(),
  // `isList: true` marks a collection field (a list of values / a `*Ids`
  // reference). It is the canonical list signal for relationship derivation
  // (#316), consumed alongside the `*Id`/`*Ids` naming conventions.
  isList: z.boolean().optional(),
  description: z.string().optional(),
  values: z.array(z.string()).optional(),
});
export type FieldNode = z.infer<typeof FieldNodeSchema>;

export const RelationshipNodeSchema = z.object({
  target: z.string(),
  cardinality: z.enum(["OneToOne", "OneToMany", "ManyToOne", "ManyToMany"]),
  composition: z.boolean(),
});
export type RelationshipNode = z.infer<typeof RelationshipNodeSchema>;

export const EntityNodeSchema = z.object({
  name: z.string(),
  fields: z.array(FieldNodeSchema),
  relationships: z.array(RelationshipNodeSchema).optional(),
});
export type EntityNode = z.infer<typeof EntityNodeSchema>;

export const ValueObjectNodeSchema = z.object({
  name: z.string(),
  type: z.string(),
  values: z.array(z.string()).optional(),
  fields: z.array(FieldNodeSchema).optional(),
  relationships: z.array(RelationshipNodeSchema).optional(),
});
export type ValueObjectNode = z.infer<typeof ValueObjectNodeSchema>;

export const Phase1AggregateNodeSchema = z.object({
  name: z.string(),
  rootEntity: z.string(),
  entities: z.array(EntityNodeSchema),
  valueObjects: z.array(ValueObjectNodeSchema),
});
export type Phase1AggregateNode = z.infer<typeof Phase1AggregateNodeSchema>;

/**
 * C4 System Context — Macro System Boundary (Work Item #326).
 *
 * An `Actor` is a human persona (or external party) who interacts with the
 * system from OUTSIDE its boundary — the "who" in C4 Level 1. Distinct from
 * `roles` (RBAC permission groups scoped INSIDE the system): an Actor is the
 * external invoker, a `role` is an internal permission mechanism on commands.
 */
export const ActorNodeSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
});
export type ActorNode = z.infer<typeof ActorNodeSchema>;

/**
 * C4 System Context — Macro System Boundary (Work Item #326).
 *
 * An `ExternalSystem` is a third-party integration the system talks to —
 * payment gateways, messaging buses, notification services, etc. It is the
 * natural target of a reactor's `triggersPort`.
 */
export const ExternalSystemNodeSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  technology: z.string().optional(),
  relationship: z.string().optional(),
});
export type ExternalSystemNode = z.infer<typeof ExternalSystemNodeSchema>;

export const Phase1AstRootSchema = z.object({
  domain: z.string(),
  systemName: z.string().optional(),
  systemDescription: z.string().optional(),
  actors: z.array(ActorNodeSchema).optional(),
  externalSystems: z.array(ExternalSystemNodeSchema).optional(),
  aggregates: z.array(Phase1AggregateNodeSchema),
});
export type Phase1AstRoot = z.infer<typeof Phase1AstRootSchema>;

export const RoleNodeSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
});
export type RoleNode = z.infer<typeof RoleNodeSchema>;

export const PolicyNodeSchema = z.object({
  name: z.string(),
  description: z.string(),
  rule: z.string().optional(),
  scope: z.string().optional(),
  intentTrace: z.string().optional(),
  sourceAggregate: z.string().optional(),
  sourceEvent: z.string().optional(),
  onEvent: z.string().optional(),
  emitsCommand: z.string().optional(),
});
export type PolicyNode = z.infer<typeof PolicyNodeSchema>;

export const CommandNodeSchema = z.object({
  name: z.string(),
  actor: z.string().optional(),
  allowedRoles: z.array(z.string()).optional(),
  policies: z.array(z.string()).optional(),
  requiredState: z.string(),
  targetState: z.string(),
  parameters: z.array(FieldNodeSchema).optional(),
  payload: z.array(FieldNodeSchema).optional(),
  isCreation: z.boolean().optional(),
  triggerEvent: z.string().optional(),
  emits: z.string().optional(),
});
export type CommandNode = z.infer<typeof CommandNodeSchema>;

export const DomainEventNodeSchema = z.object({
  name: z.string(),
  emittedBy: z.string().optional(),
  trigger: z.string().optional(),
  payload: z.array(FieldNodeSchema).optional(),
});
export type DomainEventNode = z.infer<typeof DomainEventNodeSchema>;

export const DomainEventInstanceSchema = z.object({
  eventName: z.string(),
  aggregateName: z.string(),
  payload: z.record(z.string(), z.any()).optional(),
  timestamp: z.number(),
  sequenceNumber: z.number(),
});
export type DomainEventInstance = z.infer<typeof DomainEventInstanceSchema>;

export const ReducerDescriptorSchema = z.object({
  commandName: z.string(),
  targetField: z.string(),
  operation: z.enum(['SET', 'ADD', 'SUBTRACT']),
  sourceParameter: z.string(),
});
export type ReducerDescriptor = z.infer<typeof ReducerDescriptorSchema>;

export const TransitionNodeSchema = z.object({
  trigger: z.string(),
  fromState: z.string(),
  toState: z.string(),
  guardCondition: z.string().optional(),
  guardConditions: z.array(z.string()).optional(),
});
export type TransitionNode = z.infer<typeof TransitionNodeSchema>;

export const InvariantNodeSchema = z.object({
  name: z.string().optional(),
  rule: z.string(),
  scope: z.string(),
  intentTrace: z.string().optional(),
});
export type InvariantNode = z.infer<typeof InvariantNodeSchema>;

export const GlobalInvariantSchema = z.object({
  name: z.string().optional(),
  rule: z.string(),
  scope: z.string().optional(),
  intentTrace: z.string().optional(),
});
export type GlobalInvariant = z.infer<typeof GlobalInvariantSchema>;

export const BddGivenSchema = z.object({
  initialState: z.string(),
  priorEvents: z.array(z.string()).optional(),
});
export type BddGiven = z.infer<typeof BddGivenSchema>;

export const BddWhenSchema = z.object({
  commandName: z.string(),
  payload: z.record(z.string(), z.any()).optional(),
});
export type BddWhen = z.infer<typeof BddWhenSchema>;

export const BddThenSchema = z.object({
  expectedState: z.string(),
  expectedEvents: z.array(z.string()).optional(),
});
export type BddThen = z.infer<typeof BddThenSchema>;

export const BddScenarioNodeSchema = z.object({
  name: z.string(),
  aggregateName: z.string(),
  given: BddGivenSchema,
  when: BddWhenSchema,
  then: BddThenSchema,
});
export type BddScenarioNode = z.infer<typeof BddScenarioNodeSchema>;

export const AggregateNodeSchema = z.object({
  name: z.string(),
  rootEntity: z.string(),
  entities: z.array(EntityNodeSchema).default([]).optional(),
  valueObjects: z.array(ValueObjectNodeSchema).default([]).optional(),
  // Entity Lifecycle State Invariant (#297): every aggregate MUST declare at
  // least one lifecycle state. `states` is strictly required and non-empty —
  // no silent `["Active"]` anchoring, no `states: []` fallback. An aggregate
  // that omits `states` (or submits an empty array) is rejected at the
  // Ingestion Gate as a stateless (anemic) aggregate.
  states: z.array(z.string()).min(1),
  commands: z.array(CommandNodeSchema).default([]).optional(),
  policies: z.array(PolicyNodeSchema).optional(),
  transitions: z.array(TransitionNodeSchema).optional(),
  invariants: z.array(InvariantNodeSchema).optional(),
  reducers: z.array(ReducerDescriptorSchema).optional(),
  bddScenarios: z.array(BddScenarioNodeSchema).optional(),
});
export type AggregateNode = z.infer<typeof AggregateNodeSchema>;

export const ReactorNodeSchema = z.object({
  name: z.string(),
  listensTo: z.string(),
  triggersPort: z.string(),
  description: z.string().optional(),
});
export type ReactorNode = z.infer<typeof ReactorNodeSchema>;

/**
 * Maps the legacy `domain` alias to canonical `domainName` before validation.
 * Phase 1 ADMs and older artifacts authored with `domain` keep working without
 * any runtime "normalization" layer.
 */
function resolveLegacyDomain(raw: unknown): unknown {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>;
    if (typeof o.domain === "string") {
      const { domain, ...rest } = o;
      return { ...rest, domainName: o.domainName ?? domain };
    }
  }
  return raw;
}

export const AstRootSchema = z.preprocess(
  resolveLegacyDomain,
  z.object({
    // #5: optional canonical JSON Schema pointer (e.g.
    // "$schema": "https://spica.simway.io/schema/adm.json"). Accepted and
    // carried through so schema-aware editors and AI agents can resolve the
    // authoritative Open ADM schema without tripping the strict-object gate.
    $schema: z.string().optional(),
    domainName: z.string(),
    // Macro System Context (C4 Level 1 System Context, Work Item #326): the
    // high-level boundary the Tactical DDD (Lens 2 Aggregate Map) omits. All
    // four are optional for backward compatibility with pre-#326 ADMs, but the
    // Semantic Mapper is instructed to emit them so Lens 1 has its boundaries.
    systemName: z.string().optional(),
    systemDescription: z.string().optional(),
    actors: z.array(ActorNodeSchema).optional(),
    externalSystems: z.array(ExternalSystemNodeSchema).optional(),
    // #1: the Open ADM document standard is versioned by `specVersion`
    // (defaulting to "0.0.0") and attributed by the optional `author`. The
    // creation timestamp `createdAt` (ISO-8601 UTC) defaults to the current
    // time when omitted; when provided, it must be a valid ISO-8601 UTC
    // timestamp.
    specVersion: z.string().default("0.0.0"),
    author: z.string().optional(),
    createdAt: z.iso.datetime(
      "createdAt must be an ISO-8601 UTC timestamp (e.g. 2026-10-19T09:24:17Z)"
    ).default(() => new Date().toISOString()),
    roles: z.array(RoleNodeSchema).optional(),
    aggregates: z.array(AggregateNodeSchema),
    globalInvariants: z.array(GlobalInvariantSchema).optional(),
    globalEvents: z.array(DomainEventNodeSchema).default([]).optional(),
    reactors: z.array(ReactorNodeSchema).optional(),
  }).strict(),
);
export type AstRoot = z.infer<typeof AstRootSchema>;

export class DomainConflictException extends Error {
  constructor(public details: string) {
    super(`Domain Conflict: ${details}`);
    this.name = "DomainConflictException";
  }
}

export class InvalidTransitionException extends Error {
  constructor(public details: string) {
    super(`Invalid Transition: ${details}`);
    this.name = "InvalidTransitionException";
  }
}

export class DomainInvariantViolationException extends Error {
  constructor(public details: string) {
    super(`Domain Invariant Violation: ${details}`);
    this.name = "DomainInvariantViolationException";
  }
}

export class EventConsistencyException extends Error {
  constructor(public details: string) {
    super(`Event Consistency Violation: ${details}`);
    this.name = "EventConsistencyException";
  }
}

// ── Contradiction Protocol (v0.5) ─────────────────────────────────────────
// Intermediate halting payload returned when the Semantic Mapper detects a
// collision between new intent and existing domain rules.

export const ContradictionPayloadSchema = z.object({
  type: z.literal('CONTRADICTION_HALT'),
  data: z.object({
    proposedIntent: z.string(),
    conflictingEntity: z.string(),
    existingRule: z.string(),
    resolutionPrompt: z.string(),
  }),
});
export type ContradictionPayload = z.infer<typeof ContradictionPayloadSchema>;


// ── Virgo Core helpers (preserved from the prior schema surface) ─────────

/**
 * Escapes characters for Mermaid diagram label rendering.
 */
export function escapeLabel(label: string): string {
  if (!label) return "";
  return label.replace(/"/g, "'").replace(/[\[\](){}<>]/g, "");
}

/**
 * Type helper for defining an Open ADM model with full TypeScript autocompletion.
 */
export function defineAdm(model: AstRoot): AstRoot {
  return model;
}

/**
 * Normalizes input domain model, ensuring aggregate deduplication and domain/domainName coherence.
 */
export function toAdmStructure(adm: unknown): AstRoot {
  const model = (adm && typeof adm === "object") ? { ...(adm as any) } : ({} as any);
  // Normalize legacy `domain` alias to canonical `domainName`
  if (typeof model.domain === "string" && typeof model.domainName !== "string") {
    model.domainName = model.domain;
    delete model.domain;
  }
  // Deduplicate aggregates by name
  if (Array.isArray(model.aggregates)) {
    const seen = new Set<string>();
    const deduped: AggregateNode[] = [];
    for (const agg of model.aggregates) {
      if (agg && agg.name && !seen.has(agg.name)) {
        seen.add(agg.name);
        deduped.push(agg);
      }
    }
    model.aggregates = deduped;
  }
  return model as AstRoot;
}
