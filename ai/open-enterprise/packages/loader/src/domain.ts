import { readdirSync } from "node:fs";
import path from "node:path";
import { defineDomain, isDomainDraft, sealDomain, type DomainSchema } from "@open-erp/metamodel";
import { fail } from "./errors.js";
import { exists, importDefault, isDirectory } from "./filesystem.js";
import { CROSS_CUTTING_DOMAIN_DIRS } from "./insight.js";
import { listModuleFiles } from "./module.js";

export interface LoadedDomain {
  readonly code: string;
  readonly directory: string;
  readonly schema: DomainSchema;
}

/**
 * Display order of `catalog.domains` (the modeling / permission catalog still lists modules by domain).
 * Business-facing sidebar groups are not here. They live in the repo-root `navigation.ts`.
 *
 * Domains not listed here (such as the `ops` support domain, and future new domains) are appended at the end in code dictionary order.
 */
const DOMAIN_MENU_ORDER: readonly string[] = [
  "sales", // Sales
  "procurement", // Procurement
  "outsourcing", // Outsourcing
  "manufacturing", // Manufacturing master data
  "production", // Order management
  "productionProcess", // Process management
  "productionReceive", // Production receipts and issues
  "inventory", // Inventory
  "report", // Reports
];

export function listDomainDirectories(domainsRoot: string): readonly string[] {
  const all = readdirSync(domainsRoot)
    .filter((domain) => !domain.startsWith("_") && !domain.startsWith("."))
    .filter((domain) => !CROSS_CUTTING_DOMAIN_DIRS.has(domain))
    .filter((domain) => isDirectory(path.join(domainsRoot, domain)));
  const explicit = new Set(DOMAIN_MENU_ORDER);
  const ordered: string[] = [];
  for (const code of DOMAIN_MENU_ORDER) {
    if (all.includes(code)) ordered.push(code);
  }
  // Domains with no registered position are appended at the end in code dictionary order, so a newly added domain does not vanish.
  for (const code of all.sort()) {
    if (!explicit.has(code)) ordered.push(code);
  }
  return ordered;
}

export async function loadDomain(domainsRoot: string, domain: string): Promise<LoadedDomain | null> {
  const domainDir = path.join(domainsRoot, domain);
  const modulesDir = path.join(domainDir, "modules");
  const looksLikeDomain = isDirectory(modulesDir) || exists(path.join(domainDir, "domain.ts"));
  if (!exists(path.join(domainDir, "package.json"))) {
    if (!looksLikeDomain) return null;
    fail(
      `${domain}/ has modules/ or domain.ts, but no package.json — ` +
        `a domain is a workspace package, and without that file the directory is skipped entirely while the modules simply "vanish"`,
    );
  }

  const domainFile = ["domain.ts", "domain.js"].map((name) => path.join(domainDir, name)).find((file) => exists(file));
  if (!domainFile) {
    fail(`domain ${domain} has no domain.ts — every domain must \`export default defineDomain({ label })\` to declare its display name`);
  }
  // Seal this declaration: inject the identity derived from the directory name. "The export must be the return value of defineDomain()"
  // is enforced by a credential — a credential means the shape gate already ran at import time, so seal directly;
  // no credential (compiled output, pasted-back JSON) means treat it as a raw object, run the shape gate in place, then seal.
  const exported = await importDefault(domainFile);
  const label = `${domain}/domain.ts`;
  const draft = isDomainDraft(exported) ? exported : defineDomain(exported, label);
  const declared = sealDomain(draft, { code: domain });

  if (declared.modules && !isDirectory(modulesDir)) {
    fail(
      `domain ${domain} has no modules/ directory — a domain's modules all live under <domain>/modules/; ` +
        `if this is a support domain that only provides agents / skills, declare \`modules: false\` explicitly in ${domain}/domain.ts`,
    );
  }
  if (!declared.modules && isDirectory(modulesDir) && listModuleFiles(modulesDir).length > 0) {
    fail(
      `${domain}/domain.ts declares \`modules: false\`, but ${domain}/modules/ contains module files — ` +
        `none of them will be loaded, and the only symptom is "a few items missing from the menu"`,
    );
  }

  return { code: domain, directory: domainDir, schema: declared };
}
