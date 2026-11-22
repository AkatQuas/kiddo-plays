// ---------------------------------------------------------------------------
// Escape-hatch / surface / insight artifact — reviewable JSON projected from declarations
//
// Same shape as analysis-catalog: a pure function returns the content, the CLI writes it, and gate.test compares drift.
// Adding a catalog shape, a query surface, or an operating scenario shows up in the diff.
// ---------------------------------------------------------------------------

import { readFile } from "node:fs/promises";
import path from "node:path";
import { loadCatalog, type Catalog } from "@open-erp/loader";

export const HATCHES_BANNER = "open-erp hatches v1 — generated from domains/; do not hand-edit";

export interface HatchModule {
  readonly code: string;
  readonly file: string;
}

export interface HatchSurface {
  readonly code: string;
  readonly domain: string;
  readonly file: string;
}

export interface HatchInsight {
  readonly code: string;
  readonly file: string;
}

export interface HatchesArtifact {
  readonly banner: typeof HATCHES_BANNER;
  readonly escapeHatches: readonly HatchModule[];
  readonly surfaces: readonly HatchSurface[];
  readonly insights: readonly HatchInsight[];
}

function posix(file: string): string {
  return file.replaceAll("\\", "/");
}

function byCode<T extends { readonly code: string }>(items: readonly T[]): T[] {
  return [...items].sort((left, right) => (left.code < right.code ? -1 : left.code > right.code ? 1 : 0));
}

/** Escape hatches / surfaces / insights currently in the catalog, sorted deterministically by code. */
export function hatchesOf(catalog: Catalog): Omit<HatchesArtifact, "banner"> {
  return {
    escapeHatches: byCode(
      [...catalog.modules.values()]
        .filter((module) => module.escapeHatch)
        .map((module) => ({ code: module.code, file: posix(module.file) })),
    ),
    surfaces: byCode(
      [...catalog.surfaces.values()].map((surface) => ({
        code: surface.code,
        domain: surface.domain,
        file: posix(surface.file),
      })),
    ),
    insights: byCode(
      [...catalog.insights.values()]
        .filter((insight) => posix(insight.file).startsWith("insights/"))
        .map((insight) => ({ code: insight.code, file: posix(insight.file) })),
    ),
  };
}

export function renderHatches(hatches: Omit<HatchesArtifact, "banner">): string {
  const artifact: HatchesArtifact = { banner: HATCHES_BANNER, ...hatches };
  return `${JSON.stringify(artifact, null, 2)}\n`;
}

export async function genHatches(domainsRoot: string): Promise<string> {
  const catalog = await loadCatalog({ domainsRoot });
  return renderHatches(hatchesOf(catalog));
}

export async function hatchesDrift(domainsRoot: string, artifactPath: string): Promise<string | null> {
  const expected = await genHatches(domainsRoot);
  let actual: string | null;
  try {
    actual = await readFile(artifactPath, "utf8");
  } catch {
    actual = null;
  }
  if (actual === expected) return null;
  return path.basename(artifactPath);
}
