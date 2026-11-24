import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

describe("JSON Schema package exports", () => {
  it("loads the canonical schema through the package subpath", () => {
    const schema = require("@simway/spica/schemas/adm.json");

    expect(schema.$id).toBe("https://spica.simway.io/schema/adm.json");
    expect(schema.title).toBe("Spica Open ADM Specification");
    expect(schema.type).toBe("object");
    expect(require("@simway/spica/schema")).toEqual(schema);
  });
});