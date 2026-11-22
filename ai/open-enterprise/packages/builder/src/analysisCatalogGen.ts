// ---------------------------------------------------------------------------
// Analysis-catalog artifact — reviewable JSON projected from declarations
//
// Same shape as gen:db: a pure function returns the content, the CLI writes it, and gate.test compares drift.
// Do not hand-write a second copy of this metadata into the database.
// ---------------------------------------------------------------------------

import { readFile } from "node:fs/promises";
import path from "node:path";
import { loadCatalog } from "@open-erp/loader";
import { analysisCatalogOf, type AnalysisCatalog } from "@open-erp/metamodel";

export const ANALYSIS_CATALOG_BANNER =
  "open-erp analysis catalog v1 — generated from domains/; do not hand-edit";

export interface AnalysisCatalogArtifact {
  readonly banner: typeof ANALYSIS_CATALOG_BANNER;
  readonly catalog: AnalysisCatalog;
}

export function renderAnalysisCatalog(catalog: AnalysisCatalog): string {
  const artifact: AnalysisCatalogArtifact = {
    banner: ANALYSIS_CATALOG_BANNER,
    catalog,
  };
  return `${JSON.stringify(artifact, null, 2)}\n`;
}

export async function genAnalysisCatalog(domainsRoot: string): Promise<string> {
  const loaded = await loadCatalog({ domainsRoot });
  const modules = [...loaded.modules.values()].map((module) => module.schema);
  return renderAnalysisCatalog(analysisCatalogOf(modules));
}

export async function analysisCatalogDrift(domainsRoot: string, artifactPath: string): Promise<string | null> {
  const expected = await genAnalysisCatalog(domainsRoot);
  let actual: string | null;
  try {
    actual = await readFile(artifactPath, "utf8");
  } catch {
    actual = null;
  }
  if (actual === expected) return null;
  return path.basename(artifactPath);
}
