import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, "../..");
export const MIGRATIONS_DIR = path.join(ROOT, "migrator/migrations");
export const GEN_DIR = path.join(ROOT, ".migration-gen");
export const LAST_MANIFEST = path.join(GEN_DIR, "last.json");
