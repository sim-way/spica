import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AstRoot } from "../src/schema.js";
import {
  projectKiroSpec,
  toFeatureSlug,
  KiroSpecResult,
} from "../src/kiroSpecProjector.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("Kiro Spec Projector (AWS Kiro Agentic IDE Spec Generation)", () => {
  const libraryFixturePath = path.join(__dirname, "fixtures", "canonical-library.adm.json");
  const libraryAdm: AstRoot = JSON.parse(fs.readFileSync(libraryFixturePath, "utf8"));

  it("should convert domain and system names into clean feature slugs", () => {
    expect(toFeatureSlug("PublicLibraryCirculation")).toBe("public-library-circulation");
    expect(toFeatureSlug("Public Library System")).toBe("public-library-system");
    expect(toFeatureSlug("Order_Management")).toBe("order-management");
  });

  it("should project complete system-level Kiro spec files (requirements, design, tasks)", () => {
    const result: KiroSpecResult = projectKiroSpec(libraryAdm);

    expect(result.featureName).toBe("public-library-system");
    expect(result.files).toBeDefined();
    expect(result.files.requirements).toBeDefined();
    expect(result.files.design).toBeDefined();
    expect(result.files.tasks).toBeDefined();

    // Verify Requirements document
    const req = result.files.requirements;
    expect(req).toContain("# Requirements Document: Public Library System");
    expect(req).toContain("## Introduction");
    expect(req).toContain("### Domain Actors (Personas)");
    expect(req).toContain("Patron");
    expect(req).toContain("Librarian");
    expect(req).toContain("NotificationGateway");
    expect(req).toContain("#### Acceptance Criteria (EARS Syntax)");
    expect(req).toContain("**WHEN** a valid \"RegisterPatron\" command is submitted");
    expect(req).toContain("**THE SYSTEM SHALL** instantiate a new Patron aggregate in state \"Active\"");
    expect(req).toContain("**THE SYSTEM SHALL** reject the command with an InvalidStateTransition error.");

    // Verify Design document
    const design = result.files.design;
    expect(design).toContain("# Technical Design: Public Library System");
    expect(design).toContain("## 1. System Architecture & Domain Boundaries");
    expect(design).toContain("```mermaid");
    expect(design).toContain("graph TD");
    expect(design).toContain("subgraph Patron [Aggregate: Patron]");
    expect(design).toContain("## 2. Aggregate Data Models & Entities");
    expect(design).toContain("#### Entity: `Patron`");
    expect(design).toContain("| `$id` | `string` | ✓ Yes |");
    expect(design).toContain("## 3. State Transitions & Command Handlers");
    expect(design).toContain("`RegisterPatron`");
    expect(design).toContain("`PayFee`");
    expect(design).toContain("## 4. Invariants, Reducers & Policies");
    expect(design).toContain("`unpaidFees`");

    // Verify Tasks document
    const tasks = result.files.tasks;
    expect(tasks).toContain("# Implementation Plan: Public Library System");
    expect(tasks).toContain("## Phase 1: Core Domain Entities & Schemas");
    expect(tasks).toContain("- [ ] 1.1 Implement `Patron` entities and field constraints");
    expect(tasks).toContain("## Phase 2: State Machines & Command Handlers");
    expect(tasks).toContain("## Phase 3: Domain Events & Policy Listeners");
    expect(tasks).toContain("## Phase 4: Integration Harness & Acceptance Testing");
    expect(tasks).toContain("_Requirements: Requirement 1_");
  });

  it("should project per-aggregate Kiro specs", () => {
    const result = projectKiroSpec(libraryAdm);

    expect(result.aggregateSpecs).toBeDefined();
    expect(result.aggregateSpecs["Patron"]).toBeDefined();
    expect(result.aggregateSpecs["BookCopy"]).toBeDefined();

    const patronSpec = result.aggregateSpecs["Patron"];
    expect(patronSpec.requirements).toContain("# Requirements Document: Patron Feature");
    expect(patronSpec.design).toContain("# Technical Design: Patron");
    expect(patronSpec.tasks).toContain("# Implementation Plan: Patron");
  });

  it("should support targeting a single aggregate with options.aggregateName", () => {
    const result = projectKiroSpec(libraryAdm, { aggregateName: "Patron" });

    expect(result.featureName).toBe("patron");
    expect(result.files.requirements).toContain("# Requirements Document: Patron Feature");
    expect(result.files.design).toContain("# Technical Design: Patron");
    expect(result.files.tasks).toContain("# Implementation Plan: Patron");
  });

  it("should throw an error when a non-existent aggregate is requested", () => {
    expect(() => {
      projectKiroSpec(libraryAdm, { aggregateName: "NonExistentAgg" });
    }).toThrow('Aggregate "NonExistentAgg" not found');
  });

  it("should project globalInvariants into 'System & Global Invariants' section in requirements", () => {
    const admWithGlobalInvariants: AstRoot = {
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
        },
        {
          name: "RoleSeparation",
          rule: "Librarians cannot act as patrons in circulation operations",
          scope: "CrossAggregate"
        }
      ]
    };

    const result = projectKiroSpec(admWithGlobalInvariants);
    const requirements = result.files.requirements;

    // Verify "System & Global Invariants" section exists
    expect(requirements).toContain("## System & Global Invariants");
    expect(requirements).toContain("cross-aggregate domain invariants");
    
    // Verify all global invariants are projected
    expect(requirements).toContain("### Global Invariant 1 (MaxActivePatrons)");
    expect(requirements).toContain("**Rule:** Total active patrons must not exceed system capacity");
    expect(requirements).toContain("Scope: SystemWide");
    expect(requirements).toContain("Intent: Prevents system overload");

    expect(requirements).toContain("### Global Invariant 2");
    expect(requirements).toContain("**Rule:** No patron can hold more than 10 books simultaneously");

    expect(requirements).toContain("### Global Invariant 3 (RoleSeparation)");
    expect(requirements).toContain("Scope: CrossAggregate");
  });

  it("should omit 'System & Global Invariants' section when globalInvariants is empty", () => {
    const admWithoutGlobalInvariants: AstRoot = {
      ...libraryAdm,
      globalInvariants: []
    };

    const result = projectKiroSpec(admWithoutGlobalInvariants);
    const requirements = result.files.requirements;

    expect(requirements).not.toContain("## System & Global Invariants");
  });
});
