import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(scriptDirectory, "..");
const repositoryRoot = path.resolve(packageRoot, "../..");
const source = path.join(repositoryRoot, "skills", "spica-architect", "SKILL.md");
const destination = path.join(packageRoot, "dist", "skills", "spica-architect", "SKILL.md");

fs.mkdirSync(path.dirname(destination), { recursive: true });
fs.copyFileSync(source, destination);
console.log("Copied spica-architect skill into packages/core/dist/skills/spica-architect/SKILL.md");
