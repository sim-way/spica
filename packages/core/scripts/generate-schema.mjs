import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(pkgRoot, "../..");

const mod = await import("../dist/index.js");
const schema = z.toJSONSchema(mod.AstRootSchema);
schema.$id = "https://spica.simway.io/schema/adm.json";
schema.title = "Spica Open ADM Specification";
schema.description = "The canonical schema defining Application Domain Models (ADM) for Spec-Driven Development (SDD).";

const jsonStr = JSON.stringify(schema, null, 2) + "\n";

// Write to both monorepo root and package directory
const repoTarget = path.resolve(repoRoot, "schemas/adm.json");
const pkgTarget = path.resolve(pkgRoot, "schemas/adm.json");

fs.mkdirSync(path.dirname(repoTarget), { recursive: true });
fs.writeFileSync(repoTarget, jsonStr, "utf8");
console.log("Generated canonical JSON Schema in schemas/adm.json");

fs.mkdirSync(path.dirname(pkgTarget), { recursive: true });
fs.writeFileSync(pkgTarget, jsonStr, "utf8");
console.log("Generated canonical JSON Schema in packages/core/schemas/adm.json");

// Ensure CLI binary has executable permission cross-platform on POSIX without shell chmod command
const cliPath = path.resolve(pkgRoot, "dist/cli.js");
if (fs.existsSync(cliPath)) {
  try {
    fs.chmodSync(cliPath, 0o755);
  } catch {}
}
