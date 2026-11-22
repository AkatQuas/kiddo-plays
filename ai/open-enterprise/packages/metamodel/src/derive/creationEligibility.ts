// ---------------------------------------------------------------------------
// create-from final-write eligibility sites
//
// This is only create eligibility: list the source lines the final payload
// actually references that are under an eligibility constraint, so the IO layer
// can check source status / balance. It is not reservation / consumption. It
// neither holds nor deducts any balance.
//
// This file is zero IO and does not accept a URL path/sourceId context. Source
// discovery, through, status, and balance coordinates all consume the canonical
// SourceBinding. This file does not reinterpret views.createFrom or a refLine
// declaration.
// ---------------------------------------------------------------------------

import { schemaFail } from "../schema/common.js";
import type { ModuleSchema } from "../schema/module.js";
import { sourceBindingsOf, type CreationBinding, type SourceCoordinate } from "../relations/sourceBindings.js";

export interface CreateFromEligibilitySite {
  /** Target coordinate in the final payload that carries the source line id. */
  readonly target: {
    readonly module: string;
    readonly path: string;
  };
  /** Source coordinate the IO layer must check by walking the line back to its header. */
  readonly source: {
    readonly module: string;
    readonly through: string;
    readonly lineId: string;
  };
  readonly sourceStatuses: readonly string[] | null;
  readonly sourceRemaining: {
    readonly header: SourceCoordinate | null;
    readonly line: SourceCoordinate;
  } | null;
}

export type FinalLineRows = Readonly<
  Record<string, readonly Readonly<Record<string, unknown>>[]>
>;

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function siteKey(site: CreateFromEligibilitySite): string {
  return JSON.stringify([
    site.target.module,
    site.target.path,
    site.source.module,
    site.source.through,
    site.source.lineId,
  ]);
}

function targetCoordinate(binding: CreationBinding): SourceCoordinate {
  if (binding.target.path === null) {
    return schemaFail(
      `create-from eligibility: the create-from binding of ${binding.target.module} has no target path`,
    );
  }
  const hits = binding.mappings.filter((mapping) => mapping.target.path === binding.target.path);
  if (hits.length !== 1 || !hits[0]) {
    return schemaFail(
      `create-from eligibility: target "${binding.target.module}.${binding.target.path}"` +
        ` has no unique mapping coordinate (hit ${String(hits.length)})`,
    );
  }
  return hits[0].target;
}

function requireFinalLineId(value: unknown, at: string): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || value.trim() === "" || value.trim() !== value) {
    return schemaFail(
      `create-from eligibility: final normalized value "${at}" must be a non-empty, already-trimmed refLine id,` +
        ` received ${JSON.stringify(value)}`,
    );
  }
  return value;
}

/**
 * Derive create-from eligibility sites from a final, already-normalized whole-table replacement payload.
 *
 * Only a line create-from that declares sourceStatuses or sourceRemaining produces
 * a site. An ordinary refLine and an ordinary create-from need no eligibility
 * check. Repeated references to the same source line inside one flow are
 * deduped by canonical coordinate. Return order does not depend on module or
 * payload row order.
 */
export function createFromEligibilitySitesOf(
  modules: readonly ModuleSchema[],
  targetModule: string,
  finalLines: FinalLineRows,
): readonly CreateFromEligibilitySite[] {
  // sourceBindingsOf itself reuses creationFlowsOf for source discovery and
  // fails fast on an incomplete module table. Project the full IR first; do not
  // guess the source by scanning only target.views.createFrom.
  const bindings = sourceBindingsOf(modules);
  if (!modules.some((module) => module.code === targetModule)) {
    schemaFail(`create-from eligibility: the module table has no target module "${targetModule}"`);
  }

  const unique = new Map<string, CreateFromEligibilitySite>();
  for (const binding of bindings) {
    if (
      binding.kind !== "creation" ||
      binding.mechanism !== "create-from" ||
      binding.target.module !== targetModule ||
      (binding.sourceStatuses === null && binding.sourceRemaining === null)
    ) {
      continue;
    }
    if (binding.source.level !== "line" || binding.source.table === null) {
      // sourceStatuses on a header create-from is only a frontend display threshold
      // (the list hides the button by line status). There is no server prepare, so
      // no eligibility site is built — the server enforces it through refFilter /
      // the target edge's preconditions. sourceRemaining always needs a line flow
      // to compute the remainder row by row (the header shape is already forbidden
      // by schema validation). A non-line flow still fails fast here.
      if (binding.sourceRemaining !== null) {
        schemaFail(
          `create-from eligibility: an entry with sourceRemaining` +
            ` "${binding.target.module}.${String(binding.target.path)}" must be a line flow`,
        );
      }
      continue;
    }

    const target = targetCoordinate(binding);
    if (target.level !== "line" || target.table === null) {
      schemaFail(
        `create-from eligibility: entry "${binding.target.module}.${String(binding.target.path)}"` +
          ` did not resolve to a target line coordinate`,
      );
    }
    const rows = finalLines[target.table];
    if (rows === undefined) continue;
    if (!Array.isArray(rows)) {
      schemaFail(`create-from eligibility: final lines "${target.module}.${target.table}" must be an array`);
    }

    for (const [index, row] of rows.entries()) {
      if (row === null || typeof row !== "object" || Array.isArray(row)) {
        schemaFail(
          `create-from eligibility: final line "${target.module}.${target.table}[${String(index)}]" is not a row`,
        );
      }
      const lineId = requireFinalLineId(
        row[target.field],
        `${target.module}.${target.table}[${String(index)}].${target.field}`,
      );
      if (lineId === null) continue;
      const site: CreateFromEligibilitySite = {
        target: { module: target.module, path: target.path },
        source: { module: binding.source.module, through: binding.source.table, lineId },
        sourceStatuses: binding.sourceStatuses,
        sourceRemaining: binding.sourceRemaining,
      };
      unique.set(siteKey(site), site);
    }
  }

  return [...unique.entries()]
    .sort(([left], [right]) => compareText(left, right))
    .map(([, site]) => site);
}
