import { z } from "zod";
import { AstRootSchema } from "./schema.js";

/**
 * Offline Open ADM Specification introspection.
 *
 * This module bundles a human-readable description of the Open ADM metamodel
 * (root envelope, Aggregate, Entity, ValueObject, Command, Event, Invariant,
 * and supporting node types) so air-gapped environments and local AI agents
 * (Claude Code, OpenAI Codex) can inspect the spec and JSON schema without any
 * network access.
 */

export interface SpecField {
  name: string;
  type: string;
  required: boolean;
  description: string;
  defaultValue?: string;
}

export interface SpecNode {
  key: string;
  title: string;
  description: string;
  snippet: unknown;
  fields: SpecField[];
}

export interface SpecTopic {
  key: string;
  title: string;
  kind: "node" | "field";
  description: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
  snippet: unknown;
  parent?: string;
}

export interface AdmSpecMetadata {
  title: string;
  description: string;
  schemaId: string;
  root: SpecNode;
  nodes: SpecNode[];
}

export const ADM_SCHEMA_ID = "https://spica.simway.io/schema/adm.json";

const ROOT: SpecNode = {
  key: "root",
  title: "Root Envelope (AstRoot)",
  description:
    "The top-level Open ADM document. It carries document metadata, the macro system context (actors, external systems, roles, reactors), and the list of aggregates that define the domain.",
  snippet: {
    domainName: "MyDomain",
    createdAt: "2026-11-11T00:00:00Z",
    aggregates: [
      {
        name: "Order",
        rootEntity: "Order",
        states: ["Active"],
        entities: [
          {
            name: "Order",
            fields: [{ name: "orderId", type: "string", required: true }],
          },
        ],
      },
    ],
  },
  fields: [
    { name: "domainName", type: "string", required: true, description: "Canonical domain name (e.g. PublicLibraryCirculation)." },
    { name: "specVersion", type: "string", required: false, defaultValue: "0.0.0", description: "Open ADM document spec version." },
    { name: "author", type: "string", required: false, description: "Author attribution for the model." },
    { name: "createdAt", type: "string (ISO-8601 UTC)", required: true, description: "Creation timestamp of the model." },
    { name: "systemName", type: "string", required: false, description: "Human-readable system name (C4 macro boundary)." },
    { name: "systemDescription", type: "string", required: false, description: "Human-readable system description." },
    { name: "actors", type: "Actor[]", required: false, description: "External human personas interacting with the system." },
    { name: "externalSystems", type: "ExternalSystem[]", required: false, description: "Third-party integrations the system talks to." },
    { name: "roles", type: "Role[]", required: false, description: "RBAC permission groups scoped inside the system." },
    { name: "aggregates", type: "Aggregate[]", required: true, description: "The domain aggregates (consistency boundaries)." },
    { name: "globalInvariants", type: "GlobalInvariant[]", required: false, description: "Cross-aggregate domain invariants that govern system-wide business rules." },
    { name: "globalEvents", type: "DomainEvent[]", required: false, defaultValue: "[]", description: "Cross-aggregate domain events." },
    { name: "reactors", type: "Reactor[]", required: false, description: "Event-driven reactors bridging external systems." },
  ],
};

const NODES: SpecNode[] = [
  {
    key: "aggregate",
    title: "Aggregate",
    description:
      "A transactional consistency boundary. Declares its root entity, lifecycle states, entities, commands, and invariants. Every aggregate must declare at least one state.",
    snippet: {
      name: "Order",
      rootEntity: "Order",
      states: ["Active"],
      entities: [
        { name: "Order", fields: [{ name: "orderId", type: "string", required: true }] },
      ],
    },
    fields: [
      { name: "name", type: "string", required: true, description: "Globally unique aggregate name." },
      { name: "rootEntity", type: "string", required: true, description: "The entity acting as the aggregate root." },
      { name: "entities", type: "Entity[]", required: false, defaultValue: "[]", description: "Entities owned by this aggregate." },
      { name: "valueObjects", type: "ValueObject[]", required: false, defaultValue: "[]", description: "Value objects owned by this aggregate." },
      { name: "states", type: "string[]", required: true, description: "Lifecycle states (non-empty, min 1)." },
      { name: "commands", type: "Command[]", required: false, defaultValue: "[]", description: "State-transitioning commands." },
      { name: "policies", type: "Policy[]", required: false, description: "Policy rules constraining the aggregate." },
      { name: "transitions", type: "Transition[]", required: false, description: "Explicit state transition declarations." },
      { name: "invariants", type: "Invariant[]", required: false, description: "Business rule invariants." },
      { name: "reducers", type: "Reducer[]", required: false, description: "State projection reducers." },
      { name: "bddScenarios", type: "BddScenario[]", required: false, description: "Behaviour-driven test scenarios." },
    ],
  },
  {
    key: "entity",
    title: "Entity",
    description: "A persistent, identity-bearing object. Entities hold fields and, optionally, relationships to other entities.",
    snippet: {
      name: "Order",
      fields: [{ name: "orderId", type: "string", required: true }],
    },
    fields: [
      { name: "name", type: "string", required: true, description: "Entity name (globally unique across the domain)." },
      { name: "fields", type: "Field[]", required: true, description: "The entity's data fields." },
      { name: "relationships", type: "Relationship[]", required: false, description: "Structural relationships to other entities." },
    ],
  },
  {
    key: "valueObject",
    title: "ValueObject",
    description: "An immutable, identity-less value (e.g. Money, Address) described by its attributes rather than an identity.",
    snippet: {
      name: "Money",
      type: "number",
      fields: [{ name: "amount", type: "number", required: true }],
    },
    fields: [
      { name: "name", type: "string", required: true, description: "Value object name." },
      { name: "type", type: "string", required: true, description: "Primitive or composite type." },
      { name: "values", type: "string[]", required: false, description: "Enumerated allowed values." },
      { name: "fields", type: "Field[]", required: false, description: "Composite value object fields." },
      { name: "relationships", type: "Relationship[]", required: false, description: "Structural relationships." },
    ],
  },
  {
    key: "field",
    title: "Field",
    description: "A single data attribute on an entity, value object, command parameter, or event payload.",
    snippet: { name: "orderId", type: "string", required: true },
    fields: [
      { name: "name", type: "string", required: true, description: "Field name (e.g. orderId, $id)." },
      { name: "type", type: "string", required: true, description: "Primitive type (string, number, boolean, etc.)." },
      { name: "required", type: "boolean", required: false, description: "Whether the field is mandatory." },
      { name: "isList", type: "boolean", required: false, description: "Whether the field is a collection." },
      { name: "description", type: "string", required: false, description: "Human-readable field description." },
      { name: "values", type: "string[]", required: false, description: "Enumerated allowed values." },
    ],
  },
  {
    key: "relationship",
    title: "Relationship",
    description: "A structural association between entities with a target and cardinality.",
    snippet: { target: "Customer", cardinality: "ManyToOne", composition: false },
    fields: [
      { name: "target", type: "string", required: true, description: "Target entity name." },
      { name: "cardinality", type: "OneToOne | OneToMany | ManyToOne | ManyToMany", required: true, description: "Relationship cardinality." },
      { name: "composition", type: "boolean", required: true, description: "Whether this is a composition (ownership)." },
    ],
  },
  {
    key: "command",
    title: "Command",
    description: "An intent to transition aggregate state. Carries its required/target state, actor, parameters, and payload.",
    snippet: {
      name: "PlaceOrder",
      actor: "Customer",
      requiredState: "",
      targetState: "Active",
      parameters: [{ name: "orderId", type: "string", required: true }],
    },
    fields: [
      { name: "name", type: "string", required: true, description: "Command name." },
      { name: "actor", type: "string", required: false, description: "Actor invoking the command." },
      { name: "allowedRoles", type: "string[]", required: false, description: "Roles permitted to invoke." },
      { name: "policies", type: "string[]", required: false, description: "Policies applied on invocation." },
      { name: "requiredState", type: "string", required: true, description: "State required before invocation ('' for creation)." },
      { name: "targetState", type: "string", required: true, description: "State after successful invocation." },
      { name: "parameters", type: "Field[]", required: false, description: "Command parameters." },
      { name: "payload", type: "Field[]", required: false, description: "Command payload." },
      { name: "isCreation", type: "boolean", required: false, description: "Whether this command creates the aggregate." },
      { name: "triggerEvent", type: "string", required: false, description: "External event that triggers this command." },
      { name: "emits", type: "string", required: false, description: "Domain event emitted on success." },
    ],
  },
  {
    key: "event",
    title: "DomainEvent",
    description: "A named, fact-stating domain event with an optional emitter and payload.",
    snippet: {
      name: "OrderPlaced",
      emittedBy: "PlaceOrder",
      payload: [{ name: "orderId", type: "string", required: true }],
    },
    fields: [
      { name: "name", type: "string", required: true, description: "Event name." },
      { name: "emittedBy", type: "string", required: false, description: "Command that emitted the event." },
      { name: "trigger", type: "string", required: false, description: "External trigger for the event." },
      { name: "payload", type: "Field[]", required: false, description: "Event payload fields." },
    ],
  },
  {
    key: "invariant",
    title: "Invariant",
    description: "A business rule that must always hold within a given scope.",
    snippet: { name: "ValidOrder", rule: "orderId must be present", scope: "Order" },
    fields: [
      { name: "name", type: "string", required: false, description: "Invariant name." },
      { name: "rule", type: "string", required: true, description: "The invariant rule statement." },
      { name: "scope", type: "string", required: true, description: "Entity/aggregate scope the rule applies to." },
      { name: "intentTrace", type: "string", required: false, description: "Traceability back to the source intent." },
    ],
  },
  {
    key: "policy",
    title: "Policy",
    description: "A declarative rule constraining commands or aggregates, often reactive to domain events.",
    snippet: { name: "OrderLimitPolicy", description: "Enforces max active orders" },
    fields: [
      { name: "name", type: "string", required: true, description: "Policy name." },
      { name: "description", type: "string", required: true, description: "Policy description." },
      { name: "rule", type: "string", required: false, description: "Policy rule expression." },
      { name: "scope", type: "string", required: false, description: "Policy scope." },
      { name: "intentTrace", type: "string", required: false, description: "Traceability to source intent." },
      { name: "sourceAggregate", type: "string", required: false, description: "Aggregate that emits the triggering event." },
      { name: "sourceEvent", type: "string", required: false, description: "Triggering domain event." },
      { name: "onEvent", type: "string", required: false, description: "Event to react to." },
      { name: "emitsCommand", type: "string", required: false, description: "Command emitted when policy fires." },
    ],
  },
  {
    key: "transition",
    title: "Transition",
    description: "An explicit state transition declaration with optional guards.",
    snippet: { trigger: "CancelOrder", fromState: "Active", toState: "Canceled" },
    fields: [
      { name: "trigger", type: "string", required: true, description: "Command or event triggering the transition." },
      { name: "fromState", type: "string", required: true, description: "Source state." },
      { name: "toState", type: "string", required: true, description: "Target state." },
      { name: "guardCondition", type: "string", required: false, description: "Guard condition." },
      { name: "guardConditions", type: "string[]", required: false, description: "Guard conditions list." },
    ],
  },
  {
    key: "reducer",
    title: "Reducer",
    description: "A deterministic state projection mapping a command parameter onto a target field.",
    snippet: { commandName: "PayFee", targetField: "balance", operation: "SUBTRACT", sourceParameter: "amount" },
    fields: [
      { name: "commandName", type: "string", required: true, description: "Command this reducer reacts to." },
      { name: "targetField", type: "string", required: true, description: "Root entity field to update." },
      { name: "operation", type: "SET | ADD | SUBTRACT", required: true, description: "Reducer operation." },
      { name: "sourceParameter", type: "string", required: true, description: "Command parameter to read from." },
    ],
  },
  {
    key: "reactor",
    title: "Reactor",
    description: "An event-driven component bridging a domain event to an external system port.",
    snippet: { name: "OrderNotifier", listensTo: "OrderPlaced", triggersPort: "NotificationGateway" },
    fields: [
      { name: "name", type: "string", required: true, description: "Reactor name." },
      { name: "listensTo", type: "string", required: true, description: "Domain event the reactor listens to." },
      { name: "triggersPort", type: "string", required: true, description: "External system port it triggers." },
      { name: "description", type: "string", required: false, description: "Reactor description." },
    ],
  },
  {
    key: "actor",
    title: "Actor",
    description: "A human persona or external party interacting with the system from outside its boundary.",
    snippet: { name: "Customer", description: "Places orders" },
    fields: [
      { name: "name", type: "string", required: true, description: "Actor name." },
      { name: "description", type: "string", required: false, description: "Actor description." },
    ],
  },
  {
    key: "externalSystem",
    title: "ExternalSystem",
    description: "A third-party integration the system talks to (payments, messaging, notifications).",
    snippet: { name: "PaymentGateway", technology: "HTTPS/REST" },
    fields: [
      { name: "name", type: "string", required: true, description: "External system name." },
      { name: "description", type: "string", required: false, description: "External system description." },
      { name: "technology", type: "string", required: false, description: "Transport technology (HTTPS/REST, gRPC, etc.)." },
      { name: "relationship", type: "string", required: false, description: "Relationship to the primary system." },
    ],
  },
  {
    key: "role",
    title: "Role",
    description: "An RBAC permission group scoped inside the system, applied to commands.",
    snippet: { name: "admin", description: "Full access" },
    fields: [
      { name: "name", type: "string", required: true, description: "Role name." },
      { name: "description", type: "string", required: false, description: "Role description." },
    ],
  },
];

export const ADM_SPEC_METADATA: AdmSpecMetadata = {
  title: "Spica Open ADM Specification",
  description:
    "The canonical metamodel defining Application Domain Models (ADM) for Spec-Driven Development (SDD).",
  schemaId: ADM_SCHEMA_ID,
  root: ROOT,
  nodes: NODES,
};

/** Node alias map: lowercase, punctuation-stripped keys. */
const NODE_ALIASES: Record<string, string[]> = {
  root: ["root", "envelope", "rootenvelope", "astroot", "adm"],
  aggregate: ["aggregate", "aggregates"],
  entity: ["entity", "entities"],
  valueObject: ["valueobject", "valueobjects"],
  field: ["field", "fields"],
  relationship: ["relationship", "relationships"],
  command: ["command", "commands"],
  event: ["event", "events", "domainevent", "domainEvents"],
  invariant: ["invariant", "invariants"],
  policy: ["policy", "policies"],
  transition: ["transition", "transitions"],
  reducer: ["reducer", "reducers"],
  reactor: ["reactor", "reactors"],
  actor: ["actor", "actors"],
  externalSystem: ["externalsystem", "externalsystems"],
  role: ["role", "roles"],
};

function normalizeTopic(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

const ALL_NODES: SpecNode[] = [ROOT, ...NODES];

/** Resolves a node by its key or any alias (case/punctuation-insensitive). */
export function resolveNode(query: string): SpecNode | null {
  const q = normalizeTopic(query);
  for (const node of ALL_NODES) {
    const aliases = NODE_ALIASES[node.key];
    if (aliases && aliases.map(normalizeTopic).includes(q)) {
      return node;
    }
  }
  return null;
}

function snippetValueForField(field: SpecField): unknown {
  switch (field.type) {
    case "boolean":
      return true;
    case "string[]":
      return ["value"];
    case "string (ISO-8601 UTC)":
      return "2026-11-11T00:00:00Z";
    default:
      return "string";
  }
}

/** Resolves a topic by node name, field name, or dotted path (e.g. `aggregate.states`). */
export function explainTopic(query: string): SpecTopic | null {
  const q = normalizeTopic(query.trim());

  // 1. Node lookup (singular/plural aliases) — e.g. `aggregates`, `commands`.
  const node = resolveNode(query);
  if (node) {
    return {
      key: node.key,
      title: node.title,
      kind: "node",
      description: node.description,
      snippet: node.snippet,
    };
  }

  // 2. Dotted path lookup — e.g. `root.createdAt`, `aggregate.states`.
  const parts = query.trim().split(".");
  if (parts.length === 2) {
    const parentNode = resolveNode(parts[0]);
    if (parentNode) {
      const fieldName = normalizeTopic(parts[1]);
      const field = parentNode.fields.find((f) => normalizeTopic(f.name) === fieldName);
      if (field) {
        return topicForField(parentNode, field);
      }
    }
  }

  // 3. Unique (unambiguous) field-name lookup — e.g. `createdAt`, `states`.
  const matches: { node: SpecNode; field: SpecField }[] = [];
  for (const n of ALL_NODES) {
    for (const f of n.fields) {
      if (normalizeTopic(f.name) === q) {
        matches.push({ node: n, field: f });
      }
    }
  }
  if (matches.length === 1) {
    return topicForField(matches[0].node, matches[0].field);
  }
  if (matches.length > 1) {
    // Ambiguous: return the first match but mark it via parent so callers can
    // render a note. We still return a usable result.
    return topicForField(matches[0].node, matches[0].field);
  }

  return null;
}

function topicForField(node: SpecNode, field: SpecField): SpecTopic {
  return {
    key: `${node.key}.${field.name}`,
    title: `${node.title} → ${field.name}`,
    kind: "field",
    description: field.description,
    type: field.type,
    required: field.required,
    defaultValue: field.defaultValue,
    snippet: { [field.name]: snippetValueForField(field) },
    parent: node.key,
  };
}

/** A short, stable list of commonly used topics for error messages. */
export function listTopicSuggestions(): string[] {
  return [
    "root",
    "aggregates",
    "entities",
    "valueObjects",
    "fields",
    "commands",
    "events",
    "invariants",
    "createdAt",
    "domainName",
    "specVersion",
    "states",
  ];
}

function formatFieldLine(field: SpecField): string {
  const req = field.required ? "required" : "optional";
  const def = field.defaultValue !== undefined ? `, default ${JSON.stringify(field.defaultValue)}` : "";
  return `${field.name} (${field.type}, ${req}${def}) — ${field.description}`;
}

/** Renders a human-readable terminal summary of the Open ADM metamodel. */
export function renderSpecSummary(): string {
  const lines: string[] = [];
  lines.push(`🌟 ${ADM_SPEC_METADATA.title}`);
  lines.push(ADM_SPEC_METADATA.description);
  lines.push(`Schema: ${ADM_SCHEMA_ID}`);
  lines.push("");

  for (const node of ALL_NODES) {
    lines.push(`${node.title}${node.key === "root" ? "" : ` (${node.key})`}`);
    lines.push(`  ${node.description}`);
    const required = node.fields.filter((f) => f.required);
    const optional = node.fields.filter((f) => !f.required);
    if (required.length) {
      lines.push("  Required:");
      for (const f of required) lines.push(`    • ${formatFieldLine(f)}`);
    }
    if (optional.length) {
      lines.push("  Optional:");
      for (const f of optional) lines.push(`    • ${formatFieldLine(f)}`);
    }
    lines.push("");
  }

  lines.push("Tip: use `spica explain <topic>` for a targeted lookup with a JSON snippet.");
  lines.push(`     use \`spica schema\` to dump the raw JSON schema.`);
  return lines.join("\n");
}

/** Renders a single topic lookup as readable text. */
export function renderExplain(topic: SpecTopic): string {
  const lines: string[] = [];
  lines.push(`📚 ${topic.title}`);
  lines.push(`   kind: ${topic.kind}${topic.parent ? ` (parent: ${topic.parent})` : ""}`);
  if (topic.type) lines.push(`   type: ${topic.type}`);
  if (topic.required !== undefined) lines.push(`   required: ${topic.required}`);
  if (topic.defaultValue !== undefined) lines.push(`   default: ${JSON.stringify(topic.defaultValue)}`);
  lines.push(`   description: ${topic.description}`);
  lines.push("");
  lines.push("   Example:");
  lines.push(JSON.stringify(topic.snippet, null, 2).split("\n").map((l) => `   ${l}`).join("\n"));
  return lines.join("\n");
}

/**
 * Generates the canonical JSON Schema (identical to the committed
 * `schemas/adm.json`) from the bundled Zod schema — fully offline.
 */
export function generateAdmJsonSchema(): string {
  const schema = z.toJSONSchema(AstRootSchema) as unknown as Record<string, unknown>;
  schema.$id = ADM_SCHEMA_ID;
  schema.title = "Spica Open ADM Specification";
  schema.description =
    "The canonical schema defining Application Domain Models (ADM) for Spec-Driven Development (SDD).";
  return JSON.stringify(schema, null, 2) + "\n";
}
