// ---------------------------------------------------------------------------
// Source creation flows — reverse-discover "what can this source generate"
// from the target module's views.createFrom.
//
// Only explicit declarations count. relations can answer "who references me";
// they cannot answer whether that reference is a user creation entry. Guessing
// from inbound relations would turn business refs and settlement lines into buttons.
// ---------------------------------------------------------------------------

import { schemaFail } from "../schema/common.js";
import type { Field } from "../schema/fields.js";
import type { ModuleSchema } from "../schema/module.js";
import type { CreateFromView } from "../schema/views.js";

export type CreationFlowLevel = "header" | "line";

export interface CreationFlow {
  readonly source: string;
  readonly target: string;
  readonly targetLabel: string;
  readonly path: string;
  readonly level: CreationFlowLevel;
  readonly label: string;
  readonly sourceStatuses: readonly string[] | null;
  readonly sourceRemaining: { readonly header: string | null; readonly line: string } | null;
}

interface ResolvedCreateFrom {
  readonly field: Field;
  readonly level: CreationFlowLevel;
}

function resolveCreateFrom(target: ModuleSchema, entry: CreateFromView): ResolvedCreateFrom {
  const parts = entry.path.split(".");
  if (parts.length === 1) {
    const field = target.fields.find((candidate) => candidate.key === parts[0]);
    if (!field || field.type !== "ref" || field.ref === null) {
      schemaFail(
        `module "${target.code}" views.createFrom "${entry.path}" did not resolve to a header ref — ` +
          `validateModule should already have rejected this declaration`,
      );
    }
    return { field, level: "header" };
  }
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    schemaFail(
      `module "${target.code}" views.createFrom "${entry.path}" is not a two-segment line coordinate — ` +
        `validateModule should already have rejected this declaration`,
    );
  }
  const table = target.fields.find((candidate) => candidate.key === parts[0]);
  const field = table?.type === "subtable"
    ? (table.fields ?? []).find((candidate) => candidate.key === parts[1])
    : undefined;
  if (!field || field.type !== "refLine" || field.ref === null) {
    schemaFail(
      `module "${target.code}" views.createFrom "${entry.path}" did not resolve to a line refLine — ` +
        `validateModule should already have rejected this declaration`,
    );
  }
  return { field, level: "line" };
}

/**
 * Reverse-discover every explicit creation entry for a source module.
 *
 * The full module table is required: the declaration lives on the target, and
 * the source module is derived from the target field's `ref`. A partial table
 * throws instead of quietly presenting "unknown source" as zero flows.
 */
export function creationFlowsOf(modules: readonly ModuleSchema[], source: string): readonly CreationFlow[] {
  const known = new Set(modules.map((module) => module.code));
  if (!known.has(source)) {
    schemaFail(`creation flows: the module table has no source module "${source}"`);
  }

  const flows: CreationFlow[] = [];
  for (const target of modules) {
    for (const entry of target.views.createFrom) {
      const resolved = resolveCreateFrom(target, entry);
      const from = resolved.field.ref;
      if (from === null || !known.has(from)) {
        schemaFail(
          `module "${target.code}" views.createFrom "${entry.path}" points at an unknown source module "${String(from)}" — ` +
            `the module table is partial, or the field ref is wrong`,
        );
      }
      if (from !== source) continue;
      flows.push({
        source,
        target: target.code,
        targetLabel: target.label,
        path: entry.path,
        level: resolved.level,
        label: entry.label ?? `Create ${target.label}`,
        sourceStatuses: entry.sourceStatuses,
        sourceRemaining: entry.sourceRemaining,
      });
    }
  }
  return flows;
}
