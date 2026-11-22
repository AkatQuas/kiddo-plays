import {
  isSystemSupplied,
  lineIssueLabel,
  lineIssuePath,
  schemaFail,
  type BillIssue,
  type ModuleSchema,
  type Transition,
} from "@open-erp/metamodel";
import { BillInvalidError } from "../contracts/errors.js";
import type { BillRecord } from "../contracts/repositories.js";

interface PushDraftLike {
  readonly header: Record<string, unknown>;
  readonly lines: Record<string, readonly Readonly<Record<string, unknown>>[]>;
  readonly lineLink: { readonly sourceKey: string; readonly targetKey: string } | null;
}

export interface AppliedPushBillLines {
  readonly draft: PushDraftLike;
  readonly sourceRows: readonly Readonly<Record<string, unknown>>[];
  /**
   * Aligned with `sourceRows`: cells on the dialog row that land on the target header (for example the plant on convert-to-production).
   * When the target line table has `maxRows: 1`, each row becomes its own bill and that bill's header is filled from the matching patch.
   */
  readonly headerPatches: readonly Readonly<Record<string, unknown>>[];
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * The per-line remaining column for this edge. It comes from the edge's existing `remaining` declaration (`"lines.openQty"`)
 * and is the segment to the right of the dot.
 *
 * Do not hard-code `openQty` here: one bill can have more than one remaining quantity.
 * A sales order's "remaining to ship" is `openQty` (ordered minus shipment reservation), while "remaining to convert to production"
 * also subtracts quantity already converted. They are different numbers. One `openQty` cannot serve both edges.
 * Hard-coding it looks like this: an order of 1000 can be converted to production for 1000 and then converted again for another 1000
 * (remaining-to-ship is still 1000, because nothing has shipped). The shop then builds twice the work from two bills,
 * and each bill looks legal on its own.
 *
 * A header remaining (`remaining: "openQty"`, no dot) is not a per-line cap. Return null and fall back.
 */
function remainingColumnOf(edge: Transition): string | null {
  const remaining = edge.remaining ?? null;
  if (remaining === null || remaining.trim() === "") return null;
  const dot = remaining.indexOf(".");
  return dot > 0 ? remaining.slice(dot + 1) : null;
}

/**
 * Cap for this quantity: the remaining column declared on the edge, then the open quantity on the row,
 * then the ordered quantity when an in-memory fixture has no derived column.
 */
function openQtyOf(line: Readonly<Record<string, unknown>>, remainingColumn: string | null): number {
  if (remainingColumn !== null) {
    const declared = finiteNumber(line[remainingColumn]);
    if (declared !== null) return declared;
  }
  const open = finiteNumber(line["openQty"]);
  if (open !== null) return open;
  const openBase = finiteNumber(line["openBaseQty"]);
  const factor = finiteNumber(line["unitFactor"]);
  if (openBase !== null && factor !== null && factor !== 0) return openBase / factor;
  return finiteNumber(line["qty"]) ?? 0;
}

function issue(
  path: string,
  label: string,
  code: BillIssue["code"],
  message: string,
): BillIssue {
  return { path, label, code, message };
}

function billLinesParamOf(edge: Transition) {
  return edge.params.find((param) => param.type === "billLines") ?? null;
}

function headerPatchOf(
  paramRow: Readonly<Record<string, unknown>>,
  target: ModuleSchema,
  skip: ReadonlySet<string>,
): Readonly<Record<string, unknown>> {
  const patch: Record<string, unknown> = {};
  for (const field of target.fields) {
    if (field.type === "subtable") continue;
    if (isSystemSupplied(field)) continue;
    if (skip.has(field.key)) continue;
    const value = paramRow[field.key];
    if (value === undefined || value === null || value === "") continue;
    patch[field.key] = value;
  }
  return patch;
}

function defaultParamRows(
  sourceRows: readonly Readonly<Record<string, unknown>>[],
  matchKey: string,
  remainingColumn: string | null,
): readonly Readonly<Record<string, unknown>>[] {
  return sourceRows.flatMap((row) => {
    const open = openQtyOf(row, remainingColumn);
    if (open <= 0) return [];
    const id = row["id"];
    if (typeof id !== "string" || id === "") return [];
    return [{ [matchKey]: id, qty: open }];
  });
}

/**
 * Overlay "quantity this time" from the action dialog onto the push draft.
 *
 * A plain push copies same-named fields and would carry the ordered quantity into the shipment request.
 * With billLines: match by source line id, overwrite `qty` with the quantity this time, and drop rows at or below 0.
 * If no lines are passed, ship the full open quantity.
 */
export function applyPushBillLines(
  source: ModuleSchema,
  target: ModuleSchema,
  edge: Transition,
  record: BillRecord,
  draft: PushDraftLike,
  params: Readonly<Record<string, unknown>>,
): AppliedPushBillLines {
  const billLines = billLinesParamOf(edge);
  if (billLines === null) {
    const link = draft.lineLink;
    const sourceRows = link ? (record.lines[link.sourceKey] ?? []) : [];
    return {
      draft,
      sourceRows,
      headerPatches: sourceRows.map(() => ({})),
    };
  }
  const link = draft.lineLink;
  if (link === null) {
    schemaFail(`${source.code}.${edge.code} declares billLines, but the push has no line pairing`);
  }
  const targetTable = target.fields.find((field) => field.key === link.targetKey);
  const matchKey = targetTable?.fields?.find((column) => column.type === "refLine" && column.ref === source.code)?.key;
  if (matchKey === undefined) {
    schemaFail(`The push target lines of ${source.code}.${edge.code} have no refLine back to the source module, so quantity-this-time cannot be overlaid per line`);
  }
  const qtyColumn = targetTable?.fields?.find((column) => column.key === "qty" && !isSystemSupplied(column));
  if (qtyColumn === undefined) {
    schemaFail(`${target.code} lines have no writable qty, so the billLines overlay has nowhere to land`);
  }

  const sourceRows = record.lines[link.sourceKey] ?? [];
  const sourceById = new Map(
    sourceRows.flatMap((row) => {
      const id = row["id"];
      return typeof id === "string" && id !== "" ? [[id, row] as const] : [];
    }),
  );
  const pushedById = new Map(
    (draft.lines[link.targetKey] ?? []).flatMap((row) => {
      const id = row[matchKey];
      return typeof id === "string" && id !== "" ? [[id, row] as const] : [];
    }),
  );

  const remainingColumn = remainingColumnOf(edge);
  const raw = params[billLines.key];
  const paramRows: readonly Readonly<Record<string, unknown>>[] =
    raw === undefined || raw === null
      ? defaultParamRows(sourceRows, matchKey, remainingColumn)
      : Array.isArray(raw)
        ? raw.map((row, index) => {
            if (row === null || typeof row !== "object" || Array.isArray(row)) {
              schemaFail(`${billLines.label} row ${String(index + 1)} must be an object`);
            }
            return row as Readonly<Record<string, unknown>>;
          })
        : schemaFail(`${billLines.label} must be an array of lines`);

  const skipHeader = new Set([matchKey, "qty"]);
  const paramColumns = billLines.lineField?.fields ?? [];
  const labelOf = (key: string, fallback: string): string =>
    paramColumns.find((column) => column.key === key)?.label ?? fallback;
  const qtyLabel = labelOf("qty", "this time");
  const matchLabel = labelOf(matchKey, "source line");
  const requiredExtras = paramColumns.filter(
    (column) => column.required === true && column.key !== "qty" && column.key !== matchKey,
  );
  const keptById = new Map<string, {
    qty: number;
    sourceLine: Readonly<Record<string, unknown>>;
    pushed: Readonly<Record<string, unknown>>;
    headerPatch: Readonly<Record<string, unknown>>;
  }>();
  const issues: BillIssue[] = [];

  paramRows.forEach((paramRow, index) => {
    const lineId = paramRow[matchKey];
    const at = lineIssuePath(billLines.key, index, "qty");
    const label = lineIssueLabel(billLines.label, index, qtyLabel);
    if (typeof lineId !== "string" || lineId === "") {
      issues.push(issue(lineIssuePath(billLines.key, index, matchKey), lineIssueLabel(billLines.label, index, matchLabel), "REQUIRED_BLANK", `${lineIssueLabel(billLines.label, index, matchLabel)} does not match a line on this bill`));
      return;
    }
    const sourceLine = sourceById.get(lineId);
    if (sourceLine === undefined) {
      issues.push(issue(lineIssuePath(billLines.key, index, matchKey), lineIssueLabel(billLines.label, index, matchLabel), "REF_NOT_FOUND", `${lineIssueLabel(billLines.label, index, matchLabel)} does not belong to the current ${source.label}`));
      return;
    }
    const qty = finiteNumber(paramRow["qty"]);
    if (qty === null || qty <= 0) return;
    for (const column of requiredExtras) {
      const value = paramRow[column.key];
      if (value === undefined || value === null || value === "") {
        issues.push(
          issue(
            lineIssuePath(billLines.key, index, column.key),
            lineIssueLabel(billLines.label, index, column.label),
            "REQUIRED_BLANK",
            `"${lineIssueLabel(billLines.label, index, column.label)}" is required`,
          ),
        );
      }
    }
    const open = openQtyOf(sourceLine, remainingColumn);
    const nextQty = (keptById.get(lineId)?.qty ?? 0) + qty;
    if (nextQty > open) {
      issues.push(
        issue(at, label, "NUMBER_OUT_OF_RANGE", `"${label}" cannot exceed the available remaining quantity ${String(open)}`),
      );
      return;
    }
    const pushed = pushedById.get(lineId);
    if (pushed === undefined) {
      issues.push(issue(at, label, "REF_NOT_FOUND", `"${label}" has no matching row in the push draft`));
      return;
    }
    keptById.set(lineId, {
      qty: nextQty,
      sourceLine,
      pushed,
      headerPatch: headerPatchOf(paramRow, target, skipHeader),
    });
  });

  const keptEntries = [...keptById.values()];
  const kept = keptEntries.map((row) => ({ ...row.pushed, qty: row.qty }));
  const keptSource = keptEntries.map((row) => row.sourceLine);
  const headerPatches = keptEntries.map((row) => row.headerPatch);

  if (issues.length > 0) {
    throw new BillInvalidError(`Push from this "${source.label}" to a new "${target.label}"`, issues);
  }
  if (kept.length === 0) {
    throw new BillInvalidError(`Push from this "${source.label}" to a new "${target.label}"`, [
      issue(billLines.key, billLines.label, "REQUIRED_BLANK", `"${billLines.label}" needs at least one row with a quantity this time`),
    ]);
  }

  return {
    draft: {
      ...draft,
      lines: { ...draft.lines, [link.targetKey]: kept },
    },
    sourceRows: keptSource,
    headerPatches,
  };
}

/**
 * When the target line table has `maxRows: 1`, each row becomes one downstream bill, and header cells from the dialog row (the plant) land on that bill.
 * Other pushes stay one bill. A single header patch may still write the plant onto the header.
 */
export function splitPushDrafts(
  target: ModuleSchema,
  applied: AppliedPushBillLines,
): readonly { readonly draft: PushDraftLike; readonly sourceRows: readonly Readonly<Record<string, unknown>>[] }[] {
  const link = applied.draft.lineLink;
  const table = link === null ? undefined : target.fields.find((field) => field.key === link.targetKey);
  const maxRows = table?.maxRows ?? null;
  const rows = link === null ? [] : (applied.draft.lines[link.targetKey] ?? []);
  if (maxRows === 1 && rows.length > 0 && link !== null) {
    return rows.map((row, index) => ({
      draft: {
        ...applied.draft,
        header: { ...applied.draft.header, ...applied.headerPatches[index] },
        lines: { ...applied.draft.lines, [link.targetKey]: [row] },
      },
      sourceRows: applied.sourceRows[index] === undefined ? [] : [applied.sourceRows[index]],
    }));
  }
  if (applied.headerPatches.length === 1) {
    return [{
      draft: { ...applied.draft, header: { ...applied.draft.header, ...applied.headerPatches[0] } },
      sourceRows: applied.sourceRows,
    }];
  }
  return [{ draft: applied.draft, sourceRows: applied.sourceRows }];
}
