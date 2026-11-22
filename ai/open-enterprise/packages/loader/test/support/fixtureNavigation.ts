import { existsSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

function moduleCodes(domainsRoot: string): string[] {
  const codes: string[] = [];
  if (!existsSync(domainsRoot)) return codes;
  for (const domain of readdirSync(domainsRoot, { withFileTypes: true })) {
    if (!domain.isDirectory()) continue;
    const modulesRoot = path.join(domainsRoot, domain.name, "modules");
    if (!existsSync(modulesRoot)) continue;
    for (const entry of readdirSync(modulesRoot, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith(".ts")) {
        codes.push(entry.name.slice(0, -3));
      } else if (entry.isDirectory() && existsSync(path.join(modulesRoot, entry.name, "index.ts"))) {
        codes.push(entry.name);
      }
    }
  }
  return [...new Set(codes)].sort();
}

function navigationSource(codes: readonly string[]): string {
  const items = codes.map((code) => `        { module: ${JSON.stringify(code)}, hidden: true },`).join("\n");
  return `import { defineNavigation } from "@open-erp/metamodel";

export default defineNavigation({
  groups: [
    {
      code: "fixture",
      label: "fixture",
      items: [
${items}
      ],
    },
  ],
});
`;
}

/** When the fixture directory itself is the domainsRoot, navigation.ts lives inside that directory. */
export function writeEmbeddedNavigation(domainsRoot: string): void {
  const codes = moduleCodes(domainsRoot);
  if (codes.length === 0) return;
  writeFileSync(path.join(domainsRoot, "navigation.ts"), navigationSource(codes));
}

/** Hatch: write navigation.ts in the sibling of domainsRoot, matching the product repo root layout. */
export function writeSiblingNavigation(domainsRoot: string): void {
  const codes = moduleCodes(domainsRoot);
  if (codes.length === 0) return;
  writeFileSync(path.join(path.dirname(domainsRoot), "navigation.ts"), navigationSource(codes));
}
