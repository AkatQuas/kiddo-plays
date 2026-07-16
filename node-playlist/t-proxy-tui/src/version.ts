import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packagePath = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "package.json");

export const VERSION = (JSON.parse(readFileSync(packagePath, "utf8")) as { version: string }).version;
