import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Where domains/ lives. The service process and the demo-data installer share this.
 *
 * By default, three levels up from this file (src and dist are the same distance from the repo root).
 * `OE_DOMAINS` can override it: at deploy time the framework and domains/ are not always siblings.
 * If the override points at a directory that does not exist, throw. Do not fall back to the derived path.
 */
export function domainsRoot(env: NodeJS.ProcessEnv = process.env): string {
  const override = env["OE_DOMAINS"];
  if (override !== undefined && override.trim() !== "") {
    const at = path.resolve(override);
    if (!existsSync(at)) throw new Error(`OE_DOMAINS points at a directory that does not exist: ${at}`);
    return at;
  }
  return fileURLToPath(new URL("../../../domains", import.meta.url));
}
