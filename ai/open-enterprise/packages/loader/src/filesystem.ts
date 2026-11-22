import { statSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { fail } from "./errors.js";

export function isDirectory(p: string): boolean {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}

export function exists(p: string): boolean {
  try {
    statSync(p);
    return true;
  } catch {
    return false;
  }
}

export type ImportedExports = Readonly<Record<string, unknown>>;

export async function importExports(file: string): Promise<ImportedExports> {
  const loaded: unknown = await import(pathToFileURL(file).href);
  if (!loaded || typeof loaded !== "object") {
    fail(`${file} did not export a module`);
  }
  return loaded as ImportedExports;
}

export function requireDefault(loaded: ImportedExports, file: string): unknown {
  if (!("default" in loaded)) {
    fail(`${file} has no export default — a module file must \`export default defineModule({...})\``);
  }
  return loaded["default"];
}

export async function importDefault(file: string): Promise<unknown> {
  return requireDefault(await importExports(file), file);
}
