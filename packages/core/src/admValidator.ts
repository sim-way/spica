import { AstRoot, AstRootSchema, CommandNode, FieldNode } from "./schema.js";

/**
 * Canonical reference to the Open ADM Specification & Spica docs. Surfaces as
 * a remediation anchor on validation failures so users and AI agents can jump
 * straight from a diagnostic to the expected structure.
 */
export const ADM_DOCS_URL = "https://github.com/sim-way/spica/tree/main/docs";

export interface ValidationError {
  code: string;
  path: string;
  message: string;
  /** Optional actionable remediation hint pointing to the expected structure or docs section. */
  hint?: string;
}

export interface ValidationWarning {
  code: string;
  path: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  model?: AstRoot;
}

/**
 * Helper to convert camelCase identifier prefix to PascalCase entity name.
 * e.g., "patronId" -> "patron" -> "Patron"
 * "bookCopyId" -> "bookCopy" -> "BookCopy"
 */
export function idFieldToEntityName(fieldName: string): string | null {
  if (fieldName === "$id" || fieldName === "id") {
    return null;
  }
  const match = fieldName.match(/^([a-z][a-zA-Z0-9]*)Id$/);
  if (!match) {
    return null;
  }
  const prefix = match[1];
  return prefix.charAt(0).toUpperCase() + prefix.slice(1);
}

/**
 * Pure, deterministic mathematical AST validator for Virgo Application Domain Models.
 */
export function validateAdm(rawInput: unknown): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Step 1: Syntactic Schema Validation via Zod
  const parseResult = AstRootSchema.safeParse(rawInput);
  if (!parseResult.success) {
    for (const issue of parseResult.error.issues) {
      // Zod `invalid_type` with a received value of `undefined` denotes a
      // missing required property. Surface an explicit, actionable diagnostic
      // (`Missing required property '<field>'`) instead of the raw
      // "expected X, received undefined" message, and label root-level fields
      // as `(root).<field>` for unambiguous source tracing.
      const isMissingRequired =
        issue.code === "invalid_type" &&
        /\breceived undefined\b/.test(issue.message);
      if (isMissingRequired) {
        const fieldName = String(issue.path[issue.path.length - 1]);
        const isRootLevel = issue.path.length === 1;
        errors.push({
          code: "E_SCHEMA_INVALID",
          path: isRootLevel ? `(root).${fieldName}` : issue.path.join("."),
          message: `Missing required property '${fieldName}'`,
          hint: `Add the required '${fieldName}' property. See Open ADM Spec & Docs: ${ADM_DOCS_URL}`
        });
      } else {
        errors.push({
          code: "E_SCHEMA_INVALID",
          path: issue.path.join("."),
          message: issue.message,
          hint: `See the Open ADM Spec & Docs for the expected structure: ${ADM_DOCS_URL}`
        });
      }
    }
    return { valid: false, errors, warnings };
  }

  const model = parseResult.data;

  // Global Registry for cross-aggregate reference auditing
  const aggregateNames = new Set<string>();
  const entityNames = new Set<string>();
  const entitiesByAggregate = new Map<string, Set<string>>();

  // Step 2: Build Global Namespaces & Check Uniqueness
  for (let i = 0; i < model.aggregates.length; i++) {
    const agg = model.aggregates[i];
    const aggPath = `aggregates[${i}]`;

    if (aggregateNames.has(agg.name)) {
      errors.push({
        code: "E_DUPLICATE_AGGREGATE_NAME",
        path: `${aggPath}.name`,
        message: `Duplicate AggregateNode name detected: '${agg.name}'. AggregateNode names must be globally unique.`
      });
    }
    aggregateNames.add(agg.name);

    const aggEntities = new Set<string>();
    for (let j = 0; j < (agg.entities ?? []).length; j++) {
      const ent = (agg.entities ?? [])[j];
      const entPath = `${aggPath}.entities[${j}]`;

      if (entityNames.has(ent.name)) {
        errors.push({
          code: "E_DUPLICATE_ENTITY_NAME",
          path: `${entPath}.name`,
          message: `Duplicate EntityNode name detected: '${ent.name}'. EntityNode names must be globally unique across the domain.`
        });
      }
      entityNames.add(ent.name);
      aggEntities.add(ent.name);
    }
    entitiesByAggregate.set(agg.name, aggEntities);
  }

  // Step 3: Validate Invariants per AggregateNode
  for (let i = 0; i < model.aggregates.length; i++) {
    const agg = model.aggregates[i];
    const aggPath = `aggregates[${i}]`;

    // InvariantNode 3.1: Root EntityNode must exist in aggregate's entities
    const aggEntities = entitiesByAggregate.get(agg.name);
    if (!aggEntities?.has(agg.rootEntity)) {
      errors.push({
        code: "E_MISSING_ROOT_ENTITY",
        path: `${aggPath}.rootEntity`,
        message: `AggregateNode '${agg.name}' specifies rootEntity '${agg.rootEntity}', but no entity with that name exists in this aggregate.`
      });
    }

    // InvariantNode 3.2: Non-Anemic Modeling (Must have at least one lifecycle state)
    const effectiveStates = agg.states || [];
    if (effectiveStates.length === 0) {
      errors.push({
        code: "E_STATELESS_AGGREGATE",
        path: `${aggPath}.states`,
        message: `AggregateNode '${agg.name}' has no declared lifecycle states. Non-anemic modeling requires at least one state in 'states'.`
      });
    }
    const stateSet = new Set(effectiveStates);

    // InvariantNode 3.3: Root EntityNode fields and identity check
    const rootEntityObj = (agg.entities ?? []).find((e) => e.name === agg.rootEntity);
    if (rootEntityObj) {
      const hasId = rootEntityObj.fields.some(
        (f) => f.name === "$id" || f.name === `${agg.rootEntity.charAt(0).toLowerCase() + agg.rootEntity.slice(1)}Id` || f.name === "id"
      );
      if (!hasId) {
        warnings.push({
          code: "W_IMPLICIT_ROOT_ID",
          path: `${aggPath}.entities[${agg.rootEntity}].fields`,
          message: `Root EntityNode '${agg.rootEntity}' has no explicit '$id' or '${agg.rootEntity.charAt(0).toLowerCase() + agg.rootEntity.slice(1)}Id' field. Compiler will synthesize '$id'.`
        });
      }
    }

    // InvariantNode 3.4: Foreign Key InvariantNode (E_UNRESOLVED_ENTITY_ID_REF) on EntityNode Fields
    for (let j = 0; j < (agg.entities ?? []).length; j++) {
      const ent = (agg.entities ?? [])[j];
      const entPath = `${aggPath}.entities[${j}]`;

      for (let k = 0; k < ent.fields.length; k++) {
        const field = ent.fields[k];
        const targetEntity = idFieldToEntityName(field.name);
        if (targetEntity) {
          // It's a foreign key reference. Ensure target entity or aggregate exists.
          if (!entityNames.has(targetEntity) && !aggregateNames.has(targetEntity)) {
            errors.push({
              code: "E_UNRESOLVED_ENTITY_ID_REF",
              path: `${entPath}.fields[${k}].name`,
              message: `FieldNode '${field.name}' in entity '${ent.name}' references entity '${targetEntity}', which does not exist in the domain model.`
            });
          }
        }
      }
    }

    // InvariantNode 3.5: CommandNode State Consistency & Parameter Foreign Key Checks
    const commandMap = new Map<string, CommandNode>();
    for (let c = 0; c < (agg.commands ?? []).length; c++) {
      const cmd = (agg.commands ?? [])[c];
      const cmdPath = `${aggPath}.commands[${c}]`;
      commandMap.set(cmd.name, cmd);

      // Creation command check
      const isCreation = cmd.isCreation ?? (cmd.requiredState === "");

      // State check on requiredState
      if (!isCreation && cmd.requiredState !== "") {
        if (!stateSet.has(cmd.requiredState)) {
          errors.push({
            code: "E_INVALID_STATE_TRANSITION",
            path: `${cmdPath}.requiredState`,
            message: `CommandNode '${cmd.name}' requires state '${cmd.requiredState}', which is not declared in 'states' of aggregate '${agg.name}'.`
          });
        }
      }

      // State check on targetState
      if (cmd.targetState && !stateSet.has(cmd.targetState)) {
        errors.push({
          code: "E_INVALID_STATE_TRANSITION",
          path: `${cmdPath}.targetState`,
          message: `CommandNode '${cmd.name}' transitions to targetState '${cmd.targetState}', which is not declared in 'states' of aggregate '${agg.name}'.`
        });
      }

      // Foreign key check on command parameters
      const params: FieldNode[] = cmd.parameters || cmd.payload || [];
      for (let p = 0; p < params.length; p++) {
        const param = params[p];
        const targetEntity = idFieldToEntityName(param.name);
        if (targetEntity) {
          if (!entityNames.has(targetEntity) && !aggregateNames.has(targetEntity)) {
            errors.push({
              code: "E_UNRESOLVED_ENTITY_ID_REF",
              path: `${cmdPath}.parameters[${p}].name`,
              message: `Parameter '${param.name}' in command '${cmd.name}' references entity '${targetEntity}', which does not exist in the domain model.`
            });
          }
        }
      }
    }

    // InvariantNode 3.6: Explicit TransitionNode Consistency
    const transitions = agg.transitions ?? [];
    for (let t = 0; t < transitions.length; t++) {
      const tr = transitions[t];
      const trPath = `${aggPath}.transitions[${t}]`;

      if (!stateSet.has(tr.fromState)) {
        errors.push({
          code: "E_INVALID_STATE_TRANSITION",
          path: `${trPath}.fromState`,
          message: `TransitionNode '${tr.trigger}' has fromState '${tr.fromState}', which is not in 'states'.`
        });
      }
      if (!stateSet.has(tr.toState)) {
        errors.push({
          code: "E_INVALID_STATE_TRANSITION",
          path: `${trPath}.toState`,
          message: `TransitionNode '${tr.trigger}' has toState '${tr.toState}', which is not in 'states'.`
        });
      }
      if (!commandMap.has(tr.trigger)) {
        warnings.push({
          code: "W_UNRESOLVED_TRANSITION_TRIGGER",
          path: `${trPath}.trigger`,
          message: `TransitionNode trigger '${tr.trigger}' does not match any declared command in aggregate '${agg.name}'.`
        });
      }
    }

    // InvariantNode 3.7: ReducerDescriptor Integrity
    const reducers = agg.reducers || [];
    const rootEntityFields = new Set(rootEntityObj?.fields.map((f) => f.name) || []);

    for (let r = 0; r < reducers.length; r++) {
      const red = reducers[r];
      const redPath = `${aggPath}.reducers[${r}]`;

      const triggeringCmd = commandMap.get(red.commandName);
      if (!triggeringCmd) {
        errors.push({
          code: "E_INVALID_REDUCER_REF",
          path: `${redPath}.commandName`,
          message: `ReducerDescriptor references unknown command '${red.commandName}' in aggregate '${agg.name}'.`
        });
      }

      if (rootEntityObj && !rootEntityFields.has(red.targetField)) {
        errors.push({
          code: "E_INVALID_REDUCER_REF",
          path: `${redPath}.targetField`,
          message: `ReducerDescriptor targetField '${red.targetField}' does not exist on root entity '${agg.rootEntity}'.`
        });
      }

      if (triggeringCmd) {
        const cmdParams = triggeringCmd.parameters || triggeringCmd.payload || [];
        const hasParam = cmdParams.some((p) => p.name === red.sourceParameter);
        if (!hasParam) {
          errors.push({
            code: "E_INVALID_REDUCER_REF",
            path: `${redPath}.sourceParameter`,
            message: `ReducerDescriptor sourceParameter '${red.sourceParameter}' not found in parameters of command '${red.commandName}'.`
          });
        }
      }
    }
  }

  // Step 4: Validate Global Invariants
  const globalInvariants = model.globalInvariants || [];
  for (let i = 0; i < globalInvariants.length; i++) {
    const inv = globalInvariants[i];
    const invPath = `globalInvariants[${i}]`;

    if (!inv.rule || inv.rule.trim() === "") {
      errors.push({
        code: "E_GLOBAL_INVARIANT_EMPTY_RULE",
        path: `${invPath}.rule`,
        message: `GlobalInvariant at index ${i} has an empty or missing rule. Invariant rules must be non-empty strings.`
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    model: errors.length === 0 ? model : undefined
  };
}
