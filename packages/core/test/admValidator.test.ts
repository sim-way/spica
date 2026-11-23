import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateAdm } from "../src/admValidator.js";
import { projectDomainAggregateMap, projectClassDiagram, projectStateMachineDiagram, projectSystemContextDiagram } from "../src/diagramProjector.js";
import { AstRoot, toAdmStructure, escapeLabel } from "../src/schema.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("Virgo Core ADM Validator & InvariantNode Engine", () => {
  const libraryFixturePath = path.join(__dirname, "fixtures", "canonical-library.adm.json");
  const libraryAdm: AstRoot = JSON.parse(fs.readFileSync(libraryFixturePath, "utf8"));

  it("should validate the Canonical Public Library ADM with zero errors", () => {
    const result = validateAdm(libraryAdm);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.model).toBeDefined();
    expect(result.model?.domainName).toBe("PublicLibraryCirculation");
  });

  it("should reject unknown closed-core build metadata (xxxVersion) as E_SCHEMA_INVALID (#1)", () => {
    const withXxx = { ...libraryAdm, xxxVersion: "2026.10.26-0900" };
    const result = validateAdm(withXxx);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "E_SCHEMA_INVALID")).toBe(true);
  });

  it("should accept a canonical $schema pointer without triggering E_SCHEMA_INVALID (#5)", () => {
    const withSchema = { ...libraryAdm, $schema: "https://spica.simway.io/schema/adm.json" };
    const result = validateAdm(withSchema);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should validate clean Open ADM and default specVersion without closed-core build metadata (#1)", () => {
    // specVersion defaults to "0.0.0" when omitted.
    const bare = { ...libraryAdm } as Record<string, unknown>;
    delete bare.specVersion;
    const bareResult = validateAdm(bare);
    expect(bareResult.valid).toBe(true);
    expect(bareResult.model?.specVersion).toBe("0.0.0");
    expect(bareResult.model?.author).toBe("Spica Core Team");

    // Explicit specVersion and author are preserved.
    const withMeta = { ...bare, specVersion: "0.2.0", author: "Gaudi" };
    const metaResult = validateAdm(withMeta);
    expect(metaResult.valid).toBe(true);
    expect(metaResult.model?.specVersion).toBe("0.2.0");
    expect(metaResult.model?.author).toBe("Gaudi");

    // No unknown version metadata leaks into the parsed model.
    expect(metaResult.model).not.toHaveProperty("xxxVersion");
  });

  it("should reject a missing createdAt as a required property (#3)", () => {
    const bare = { ...libraryAdm } as Record<string, unknown>;
    delete bare.createdAt;
    const result = validateAdm(bare);
    expect(result.valid).toBe(false);
    const err = result.errors.find((e) => e.code === "E_SCHEMA_INVALID" && e.path.includes("createdAt"));
    expect(err).toBeDefined();
    expect(err?.message).toContain("createdAt");
  });

  it("should reject a malformed createdAt with a format error (#3)", () => {
    const malformed = { ...libraryAdm, createdAt: "not-a-date" } as Record<string, unknown>;
    const result = validateAdm(malformed);
    expect(result.valid).toBe(false);
    const schemaErr = result.errors.find((e) => e.code === "E_SCHEMA_INVALID" && e.message.includes("ISO-8601"));
    expect(schemaErr).toBeDefined();
    expect(schemaErr?.hint).toContain("Open ADM Spec & Docs");
  });

  it("should report missing required properties with 'Missing required property' and (root) labels (#3)", () => {
    const missing = { ...libraryAdm } as Record<string, unknown>;
    delete missing.domainName;
    const result = validateAdm(missing);
    expect(result.valid).toBe(false);
    const err = result.errors.find((e) => e.message.includes("Missing required property"));
    expect(err).toBeDefined();
    expect(err?.message).toBe("Missing required property 'domainName'");
    expect(err?.path).toBe("(root).domainName");
    expect(err?.hint).toContain("Add the required 'domainName' property");
    expect(err?.hint).toContain("Open ADM Spec & Docs");
  });

  it("should reject an AggregateNode with a non-existent rootEntity (E_MISSING_ROOT_ENTITY)", () => {
    const cloned: AstRoot = JSON.parse(JSON.stringify(libraryAdm));
    cloned.aggregates[0].rootEntity = "GhostPatron";
    const result = validateAdm(cloned);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "E_MISSING_ROOT_ENTITY")).toBe(true);
  });

  it("should enforce Non-Anemic Modeling: reject stateless aggregates (E_SCHEMA_INVALID)", () => {
    const cloned: AstRoot = JSON.parse(JSON.stringify(libraryAdm));
    cloned.aggregates[0].states = [];
    const result = validateAdm(cloned);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "E_SCHEMA_INVALID")).toBe(true);
  });

  it("should reject unresolved *Id foreign key references (E_UNRESOLVED_ENTITY_ID_REF)", () => {
    const cloned: AstRoot = JSON.parse(JSON.stringify(libraryAdm));
    // Add a ghost entity reference to Hold
    cloned.aggregates[2].entities[0].fields.push({
      name: "ghostBranchId",
      type: "string",
      required: true,
      isList: false
    });
    const result = validateAdm(cloned);
    expect(result.valid).toBe(false);
    const err = result.errors.find((e) => e.code === "E_UNRESOLVED_ENTITY_ID_REF");
    expect(err).toBeDefined();
    expect(err?.message).toContain("ghostBranchId");
  });

  it("should reject commands with invalid state transitions (E_INVALID_STATE_TRANSITION)", () => {
    const cloned: AstRoot = JSON.parse(JSON.stringify(libraryAdm));
    cloned.aggregates[0].commands[1].requiredState = "NonExistentState";
    const result = validateAdm(cloned);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "E_INVALID_STATE_TRANSITION")).toBe(true);
  });

  it("should reject reducers targeting non-existent fields (E_INVALID_REDUCER_REF)", () => {
    const cloned: AstRoot = JSON.parse(JSON.stringify(libraryAdm));
    cloned.aggregates[0].reducers![0].targetField = "nonExistentField";
    const result = validateAdm(cloned);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "E_INVALID_REDUCER_REF")).toBe(true);
  });

  it("should project a valid Mermaid Domain AggregateNode Map", () => {
    const mermaid = projectDomainAggregateMap(libraryAdm);
    expect(mermaid).toContain("graph TD");
    expect(mermaid).toContain("subgraph Patron [AggregateNode: Patron]");
    expect(mermaid).toContain("subgraph BookCopy [AggregateNode: BookCopy]");
    expect(mermaid).toContain("subgraph Hold [AggregateNode: Hold]");
    expect(mermaid).toContain("Patron -.->|\"patronId (1..1)\"| Hold");
    expect(mermaid).toContain("BookCopy -.->|\"bookCopyId (1..1)\"| Hold");
  });

  it("should project a valid formal UML Class Diagram with associations", () => {
    const classDiagram = projectClassDiagram(libraryAdm);
    expect(classDiagram).toContain("classDiagram");
    expect(classDiagram).toContain("class Patron {");
    expect(classDiagram).toContain("+string $id");
    expect(classDiagram).toContain("+string email");
    expect(classDiagram).toContain("Hold --> \"1\" Patron : patronId");
    expect(classDiagram).toContain("Hold --> \"1\" BookCopy : bookCopyId");
  });

  it("should project a valid formal UML State Machine Diagram (stateDiagram-v2)", () => {
    const stateDiagram = projectStateMachineDiagram(libraryAdm);
    expect(stateDiagram).toContain("stateDiagram-v2");
    expect(stateDiagram).toContain("state \"Patron Lifecycle\" as PatronLifecycle");
    expect(stateDiagram).toContain("[*] --> Active : RegisterPatron");
    expect(stateDiagram).toContain("Active --> Suspended : SuspendPatron");
    expect(stateDiagram).toContain("Suspended --> Active : ReactivatePatron");
    expect(stateDiagram).toContain("state \"Hold Lifecycle\" as HoldLifecycle");
    expect(stateDiagram).toContain("[*] --> Placed : PlaceHold");
    expect(stateDiagram).toContain("Placed --> Completed : CompleteHold");
    expect(stateDiagram).toContain("Placed --> Canceled : CancelHold");
  });

  it("should project a valid C4 Model Level 1 System Context Diagram with transport technology (M1-CORE-01)", () => {
    const c4Diagram = projectSystemContextDiagram(libraryAdm);
    expect(c4Diagram).toContain("C4Context");
    expect(c4Diagram).toContain("title System Context: Public Library System");
    expect(c4Diagram).toContain("Person(patron, \"Patron\"");
    expect(c4Diagram).toContain("Person(librarian, \"Librarian\"");
    expect(c4Diagram).toContain("System(publicLibrarySystem, \"Public Library System\"");
    expect(c4Diagram).toContain("System_Ext(notificationGateway, \"NotificationGateway\"");
    expect(c4Diagram).toContain("Rel(patron, publicLibrarySystem, \"Interacts with\", \"Web UI / API\")");
    expect(c4Diagram).toContain("Rel(librarian, publicLibrarySystem, \"Interacts with\", \"Web UI / API\")");
    expect(c4Diagram).toContain("Rel(publicLibrarySystem, notificationGateway, \"Sends pickup notices via async events\", \"Async Event\")");

    // Test explicit bracketed transport tag parsing
    const cloned: AstRoot = JSON.parse(JSON.stringify(libraryAdm));
    cloned.externalSystems = [
      {
        name: "StripeBilling",
        description: "Payment gateway",
        relationship: "Processes fee settlements [HTTPS/REST]"
      },
      {
        name: "EventKafka",
        description: "Message broker",
        relationship: "Streams domain events",
        technology: "Apache Kafka"
      }
    ];
    const bracketC4 = projectSystemContextDiagram(cloned);
    expect(bracketC4).toContain("Rel(publicLibrarySystem, stripeBilling, \"Processes fee settlements\", \"HTTPS/REST\")");
    expect(bracketC4).toContain("Rel(publicLibrarySystem, eventKafka, \"Streams domain events\", \"Apache Kafka\")");
  });

  it("should project cross-aggregate domain event flow edges in Domain AggregateNode Map (M1-CORE-02)", () => {
    const cloned: AstRoot = JSON.parse(JSON.stringify(libraryAdm));
    // Hold reacts to Loan return event
    cloned.aggregates[2].commands.push({
      name: "FulfillHoldOnReturn",
      actor: "System",
      requiredState: "Placed",
      targetState: "Completed",
      parameters: [{ name: "holdId", type: "string", required: true }],
      triggerEvent: "Loan.BookReturned",
      policies: [
        {
          name: "HoldFulfillmentPolicy",
          description: "Notifies patron when Loan emits BookReturned",
          sourceAggregate: "Loan",
          sourceEvent: "BookReturned"
        }
      ]
    });

    const map = projectDomainAggregateMap(cloned);
    expect(map).toContain("graph TD");
    // Verify structural foreign-key edge
    expect(map).toContain("Patron -.->|\"patronId (1..1)\"| Hold");
    // Verify reactive domain event edge
    expect(map).toContain("Loan ==>|\"triggers on BookReturned\"| Hold");
  });

  it("should validate and normalize superset ADM structures with domainName, globalEvents, and deduplication (v0.1.1)", () => {
    const rawSupersetAdm = {
      domainName: "LegacyDomain",
      createdAt: "2026-10-26T00:00:00Z",
      globalEvents: [
        { name: "SystemInitialized", description: "Fired when system starts" }
      ],
      aggregates: [
        {
          name: "Item",
          rootEntity: "Item",
          states: ["Active", "Archived"],
          entities: [
            {
              name: "Item",
              fields: [
                { name: "itemId", type: "string", required: true },
                { name: "status", type: "string", required: true, values: ["ACTIVE", "ARCHIVED"] }
              ]
            }
          ],
          events: [
            { name: "ItemCreated", payload: [{ name: "itemId", type: "string", required: true }] }
          ],
          policies: [
            { name: "ItemPolicy", description: "Enforces max items" }
          ],
          invariants: [
            { name: "ValidItemInvariant", rule: "itemId must be present", scope: "Item" }
          ],
          commands: [],
          transitions: [
            { trigger: "Archive", fromState: "Active", toState: "Archived", guardConditions: ["hasPermissions"] }
          ]
        },
        // Duplicate aggregate to test toAdmStructure deduplication
        {
          name: "Item",
          rootEntity: "Item",
          states: ["Active"],
          entities: [{ name: "Item", fields: [{ name: "itemId", type: "string", required: true }] }],
          commands: []
        }
      ]
    };

    // 1. Test toAdmStructure normalization and deduplication
    const normalized = toAdmStructure(rawSupersetAdm);
    expect(normalized.domainName).toBe("LegacyDomain");
    expect(normalized.aggregates).toHaveLength(1);
    expect(normalized.aggregates[0].events).toHaveLength(1);
    expect(normalized.aggregates[0].invariants).toHaveLength(1);

    // 2. Test validateAdm on normalized superset ADM
    const result = validateAdm(normalized);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);

    // 3. Test escapeLabel
    expect(escapeLabel("Hold [AggregateNode: (Hold)]")).toBe("Hold AggregateNode: Hold");
  });

  // Global Invariants Tests
  describe("Global Invariants (Issue #1)", () => {
    it("should accept a valid ADM with globalInvariants declared", () => {
      const withGlobalInvariants: AstRoot = {
        ...libraryAdm,
        globalInvariants: [
          {
            name: "MaxActivePatrons",
            rule: "Total active patrons must not exceed system capacity",
            scope: "SystemWide",
            intentTrace: "Prevents system overload"
          },
          {
            rule: "No patron can hold more than 10 books simultaneously"
          }
        ]
      };

      const result = validateAdm(withGlobalInvariants);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.model?.globalInvariants).toHaveLength(2);
      expect(result.model?.globalInvariants?.[0].name).toBe("MaxActivePatrons");
      expect(result.model?.globalInvariants?.[1].rule).toBe("No patron can hold more than 10 books simultaneously");
    });

    it("should reject globalInvariants with empty rule (E_GLOBAL_INVARIANT_EMPTY_RULE)", () => {
      const withEmptyRule: AstRoot = {
        ...libraryAdm,
        globalInvariants: [
          {
            name: "InvalidInvariant",
            rule: "",
            scope: "SystemWide"
          }
        ]
      };

      const result = validateAdm(withEmptyRule);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === "E_GLOBAL_INVARIANT_EMPTY_RULE")).toBe(true);
      const err = result.errors.find((e) => e.code === "E_GLOBAL_INVARIANT_EMPTY_RULE");
      expect(err?.path).toContain("globalInvariants[0].rule");
    });

    it("should reject globalInvariants with whitespace-only rule", () => {
      const withWhitespaceRule: AstRoot = {
        ...libraryAdm,
        globalInvariants: [
          {
            rule: "   "
          }
        ]
      };

      const result = validateAdm(withWhitespaceRule);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === "E_GLOBAL_INVARIANT_EMPTY_RULE")).toBe(true);
    });

    it("should handle globalInvariants as optional (undefined when omitted)", () => {
      const withoutGlobalInvariants = { ...libraryAdm } as Record<string, unknown>;
      delete (withoutGlobalInvariants as any).globalInvariants;

      const result = validateAdm(withoutGlobalInvariants);
      expect(result.valid).toBe(true);
      // globalInvariants is optional, so it can be undefined
      expect(result.model?.globalInvariants).toBeUndefined();
    });

    it("should handle multiple globalInvariants with comprehensive metadata", () => {
      const comprehensive: AstRoot = {
        ...libraryAdm,
        globalInvariants: [
          {
            name: "RoleSeparation",
            rule: "Librarians cannot act as patrons in circulation operations",
            scope: "CrossAggregate",
            intentTrace: "Ref: RBAC policy doc section 3.2"
          },
          {
            rule: "Audit trail must be immutable",
            intentTrace: "Compliance requirement"
          },
          {
            name: "ConsistencyBoundary",
            rule: "Hold-to-Loan transitions must maintain referential integrity"
          }
        ]
      };

      const result = validateAdm(comprehensive);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.model?.globalInvariants).toHaveLength(3);
      expect(result.model?.globalInvariants?.[0].name).toBe("RoleSeparation");
      expect(result.model?.globalInvariants?.[2].intentTrace).toBeUndefined();
    });
  });
});
