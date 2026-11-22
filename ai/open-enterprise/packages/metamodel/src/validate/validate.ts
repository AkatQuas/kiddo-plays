// ---------------------------------------------------------------------------
// Semantic gates — a shape that parses is not yet a model that is right
//
// The shape layer (normalizeModule) stops at the first error. Here the **whole report is listed at once**,
// because an FDE and an AI need "what else is wrong with this module", not "what is the first problem".
//
// These gates are the core asset of this product, not something a generic framework can supply.
// EFFECT_REVERSE_UNREACHABLE is the example: it is **accounting meaning (every debit has a credit) projected onto graph theory (terminal reachability)**.
// No generic state-machine framework has it, because their edges have no dual relationship.
// ---------------------------------------------------------------------------

import { requireCoordinateSegment, requireText, schemaFail } from "../schema/common.js";
import { refFilterOperands } from "../normalize/refFilter.js";
import { type EffectRef } from "../schema/effects.js";
import { inventoryLedgerDefinition, ledgerContract } from "../normalize/ledger.js";
import {
  formulaFields,
  hasColumn,
  hasEnumOption,
  isAutoNumbered,
  isDerived,
  isLineAggregated,
  isRefLineCompanion,
  isLocalMeasure,
  isFormulaOperandType,
  isNumericFieldType,
  isSystemSupplied,
  maxRowsOf,
  NUMERIC_FIELD_TYPES,
  refLinePairs,
  refSupplyOf,
  stampOnFirstEnterOf,
  generatedSequenceOf,
  uniqueDefaultWithinOf,
  uniqueRefusalOf,
  type CreateBlocker,
  type Expr,
  type Field,
  type RefSupplyVia,
} from "../schema/fields.js";
import { editableFields, hasTransitionAt, transitionEdges } from "../derive/engine.js";
import { ALL_TRANSITIONS } from "../schema/preconditions.js";
import { isSummarizableType, PLATFORM_QUERY_FIELDS } from "../normalize/query.js";
import { transitionAction, transitionActions, type Lifecycle } from "../schema/lifecycle.js";
import {
  isPlatformField,
  isPlatformLineField,
  MODULE_DRAFT,
  normalizeModule,
  PLATFORM_FIELDS,
  PLATFORM_LINE_FIELDS,
  type ModuleDraft,
  type ModuleSchema,
  type ModuleShape,
  type PushOrigin,
  type TargetedPushOrigin,
} from "../schema/module.js";
import {
  ACTOR_KEYS,
  availabilityOf,
  checkActorKeys,
  checkBillFields,
  checkLineFields,
  checkParamKeys,
  keySpaceOf,
  linesRequiredIfRefFieldOf,
  referenceComparisonOf,
  relatedAggKeyOf,
  relatedAggregationOf,
  type KeySpace,
  type NormalizedCheck,
} from "../derive/primitives.js";

export interface ValidationError {
  readonly code: string;
  readonly path: string;
  readonly message: string;
}

export interface ValidationReport {
  readonly ok: boolean;
  readonly errors: readonly ValidationError[];
}

type Add = (code: string, path: string, message: string) => void;

// ── Graph algorithms ──────────────────────────────────────────────────────

function reachableFrom(lifecycle: Lifecycle, start: string, excluded: ReadonlySet<string>): Set<string> {
  const seen = new Set<string>();
  const stack = [start];
  while (stack.length) {
    const at = stack.pop();
    if (at === undefined || seen.has(at)) continue;
    seen.add(at);
    for (const edge of lifecycle.transitions) {
      if (excluded.has(edge.code) || edge.from !== at) continue;
      stack.push(edge.to);
    }
  }
  return seen;
}

/**
 * Starting from start, **avoiding the edges in excluded**, can some terminal status be reached? If so, return that status.
 *
 * This is the criterion for EFFECT_REVERSE_UNREACHABLE. Reachability is checked instead of existence:
 * the previous generation only asked whether the edges named by reverseOn exist, so `submit` (which reserves exposure) declaring
 * `reverseOn: ["unapprove"]` passed the gate — but the normal business flow `submit → ship → finish` never
 * passes the unapprove edge, and the reservation **stays on the books forever**. Existing is not the same as being walked.
 */
function terminalEscapeFrom(lifecycle: Lifecycle, start: string, excluded: ReadonlySet<string>): string | null {
  const terminals = new Set(lifecycle.statuses.filter((s) => s.terminal).map((s) => s.key));
  // With no terminal status this **must not** pass as "there is no escape path". That is fail-open: a cyclic state machine
  // (draft → pendingReview → effective → pendingReview…, with no status marked terminal) would let this whole gate pass in silence,
  // while the "reservation stays posted forever" case it exists to prevent still happens. STATUS_NO_TERMINAL makes this branch unreachable
  if (!terminals.size) return null;
  for (const key of reachableFrom(lifecycle, start, excluded)) {
    if (terminals.has(key)) return key;
  }
  return null;
}

// ── Individual gates ──────────────────────────────────────────────────────

function checkStatuses(module: ModuleSchema, add: Add): void {
  const { lifecycle } = module;
  const initial = lifecycle.statuses.filter((s) => s.initial);
  if (!initial.length) {
    add("STATUS_NO_INITIAL", "lifecycle.statuses", "there is no initial status: a new bill has nowhere to land");
  }
  // A module that posts must have a terminal status. The criterion is not "a bill should have an end" — master data (toggling enabled and disabled)
  // has no end, and that shape is legal. The criterion is the **premise** of EFFECT_REVERSE_UNREACHABLE:
  // that gate asks "can a terminal status still be reached while avoiding the reversal edges". With zero terminals it passes as vacuously true,
  // so a reservation that should have been released can stay posted forever, and yarn test says nothing.
  // A gate that fails in silence has to have its premise pinned down here
  const posting = lifecycle.transitions.filter((t) => t.effects.length > 0);
  if (posting.length && !lifecycle.statuses.some((s) => s.terminal)) {
    add(
      "STATUS_NO_TERMINAL",
      "lifecycle.statuses",
      `"${posting.map((t) => t.code).join(", ")}" writes a ledger, but the state machine has no terminal status. ` +
        "The posting gate that asks whether a terminal status is reachable while avoiding the reversal edges is then entirely off, and a reservation can stay posted forever. " +
        "Add a terminal status (completed / closed), or confirm these edges really should not post",
    );
  }
  if (initial.length > 1) {
    add(
      "STATUS_MULTI_INITIAL",
      "lifecycle.statuses",
      `${initial.length} initial statuses were declared (${initial.map((s) => s.key).join(", ")}): there is no basis for which one a new bill uses`,
    );
  }

  // An edge parameter must not share a name with a bill field.
  //
  // A shape that has been observed: `salesDelivery.confirm` declares `params: [{ key: "warehouseId" }]`,
  // the header already has `warehouseId`, and the posting `scope` uses `$bill.warehouseId`.
  // The user fills in the actual outbound warehouse in the dialog. The value only reaches RuleContext and the audit log.
  // The ledger still deducts the header warehouse — **a second entry point that does not persist**, and the two share a name,
  // so no layer says these two warehouses are not the same thing.
  //
  // A parameter cannot reach the bill or a posting coordinate anyway (effect prefixes are closed to $bill / $line, on purpose:
  // a posting amount and its coordinates must come from a fact already stored). Same names are therefore always rejected — to change a value on the bill, save it.
  const fieldKeys = new Set(module.fields.map((f) => f.key));
  for (const sub of module.fields.filter((f) => f.type === "subtable")) {
    for (const col of sub.fields ?? []) fieldKeys.add(col.key);
  }
  for (const edge of lifecycle.transitions) {
    for (const param of edge.params) {
      if (fieldKeys.has(param.key) || isPlatformField(param.key)) {
        add(
          "TRANSITION_PARAM_SHADOWS_FIELD",
          `lifecycle.transitions.${edge.code}.params.${param.key}`,
          `Parameter "${param.key}" collides with a field of the same name on the bill. A parameter cannot enter the bill or a posting coordinate (it only reaches rules and audit), ` +
            `so the value the user fills in and the value the system uses are two values, while the UI calls them the same name. To change a value on the bill, save it. Do not open a second entry.`,
        );
      }
      if (param.seed != null) {
        const seedAt = `lifecycle.transitions.${edge.code}.params.${param.key}.seed`;
        const table = module.fields.find((field) => field.key === param.seed!.from);
        if (table === undefined || table.type !== "subtable") {
          add(
            "TRANSITION_BILL_LINES_SEED_UNKNOWN",
            `${seedAt}.from`,
            `seed.from "${param.seed.from}" is not a line table of this module`,
          );
        } else {
          const sourceCols = new Set(["id", ...(table.fields ?? []).map((column) => column.key)]);
          const paramCols = new Set((param.lineField?.fields ?? []).map((column) => column.key));
          for (const [column, fromField] of Object.entries(param.seed.columns)) {
            if (!paramCols.has(column)) {
              add(
                "TRANSITION_BILL_LINES_SEED_UNKNOWN",
                `${seedAt}.columns.${column}`,
                `the parameter line table has no column "${column}"`,
              );
            }
            if (!sourceCols.has(fromField)) {
              add(
                "TRANSITION_BILL_LINES_SEED_UNKNOWN",
                `${seedAt}.columns.${column}`,
                `the source line table has no field "${fromField}"`,
              );
            }
          }
          if (param.seed.skipNonPositive !== null && !sourceCols.has(param.seed.skipNonPositive)) {
            add(
              "TRANSITION_BILL_LINES_SEED_UNKNOWN",
              `${seedAt}.skipNonPositive`,
              `the source line table has no field "${param.seed.skipNonPositive}"`,
            );
          }
        }
      }
    }
  }

  const keys = new Set(lifecycle.statuses.map((s) => s.key));
  for (const edge of lifecycle.transitions) {
    if (!keys.has(edge.from)) {
      add("TRANSITION_UNKNOWN_STATUS", `lifecycle.transitions.${edge.code}.from`, `unknown status "${edge.from}"`);
    }
    if (!keys.has(edge.to)) {
      add("TRANSITION_UNKNOWN_STATUS", `lifecycle.transitions.${edge.code}.to`, `unknown status "${edge.to}"`);
    }
    if (edge.remaining != null) {
      const remainingAt = `lifecycle.transitions.${edge.code}.remaining`;
      const parts = edge.remaining.split(".");
      if (parts.length === 1) {
        const field = module.fields.find((candidate) => candidate.key === parts[0]);
        if (field === undefined || field.type === "subtable") {
          add(
            "TRANSITION_REMAINING_UNKNOWN",
            remainingAt,
            `Remaining field "${edge.remaining}" is not a numeric header field of this module. When it is <= 0 this edge must disappear from the buttons, so the coordinate must be readable on the bill projection`,
          );
        } else if (!isNumericFieldType(field.type)) {
          add(
            "TRANSITION_REMAINING_NOT_NUMERIC",
            remainingAt,
            `Remaining field "${edge.remaining}" is ${field.type}. Hiding a button accepts only number / money`,
          );
        }
      } else if (parts.length === 2 && parts[0] && parts[1]) {
        const table = module.fields.find((candidate) => candidate.key === parts[0]);
        const column = table?.type === "subtable" ? (table.fields ?? []).find((candidate) => candidate.key === parts[1]) : undefined;
        if (table === undefined || table.type !== "subtable" || column === undefined) {
          add(
            "TRANSITION_REMAINING_UNKNOWN",
            remainingAt,
            `Remaining field "${edge.remaining}" is not "line table.numeric column". The detail page decides whether the button is present from any line > 0`,
          );
        } else if (!isNumericFieldType(column.type)) {
          add(
            "TRANSITION_REMAINING_NOT_NUMERIC",
            remainingAt,
            `Remaining field "${edge.remaining}" is ${column.type}. Hiding a button accepts only number / money`,
          );
        }
      } else {
        add(
          "TRANSITION_REMAINING_UNKNOWN",
          remainingAt,
          `Remaining field "${edge.remaining}" accepts only a header field, or a two-part path "line table.column"`,
        );
      }
    }
  }

  const start = initial[0];
  if (!start) return;

  // ── singleActiveWithin: one active record inside a coordinate ─────────────
  const single = lifecycle.singleActiveWithin;
  if (single !== null) {
    const statusKeys = new Set(lifecycle.statuses.map((s) => s.key));
    if (!statusKeys.has(single.status)) {
      add(
        "SINGLE_ACTIVE_UNKNOWN_STATUS",
        "lifecycle.singleActiveWithin.status",
        `singleActiveWithin.status "${single.status}" is not a lifecycle status of this module`,
      );
    }
    if (!statusKeys.has(single.supersedeTo)) {
      add(
        "SINGLE_ACTIVE_UNKNOWN_STATUS",
        "lifecycle.singleActiveWithin.supersedeTo",
        `singleActiveWithin.supersedeTo "${single.supersedeTo}" is not a lifecycle status of this module`,
      );
    }
    const headerKeys = new Set(module.fields.filter((f) => f.type !== "subtable").map((f) => f.key));
    single.within.forEach((key, i) => {
      if (!headerKeys.has(key)) {
        add(
          "SINGLE_ACTIVE_UNKNOWN_COORDINATE",
          `lifecycle.singleActiveWithin.within[${i}]`,
          `singleActiveWithin.within "${key}" is not a header field of this module. Superseding the old record cannot bound sibling records at the same coordinate`,
        );
      }
    });
  }

  const reachable = reachableFrom(lifecycle, start.key, new Set());
  for (const status of lifecycle.statuses) {
    if (!reachable.has(status.key)) {
      add(
        "STATUS_UNREACHABLE",
        `lifecycle.statuses.${status.key}`,
        `No path from the initial status "${start.key}" reaches here. Add an edge, or delete it`,
      );
    }
    // Single-status master data (both initial and terminal, with zero edges) is legal and is not in this list
    if (!status.terminal && !lifecycle.transitions.some((t) => t.from === status.key)) {
      add(
        "STATUS_ORPHAN",
        `lifecycle.statuses.${status.key}`,
        `Not terminal, and it has no outgoing edge: a bill can enter and cannot leave. Mark it terminal, or add an outgoing edge`,
      );
    }
  }
}

/**
 * The criterion for a ledger coordinate (`$bill.x` / `$line.x`). **Posting and rules share one copy.**
 *
 * Sharing is not there to save code: `effects` declare "which warehouse to deduct", and an availability rule declares "which warehouse to query".
 * Two separate criteria eventually produce "the check looks at the Shanghai warehouse and the posting deducts the Beijing warehouse" — and each declaration looks correct on its own.
 * The caller supplies the error code (the report has to say whether this is a posting or a rule). The judgment itself exists only once.
 */
interface CoordCodes {
  readonly lineNoSubtable: string;
  readonly lineAmbiguous: string;
  readonly fieldUnknown: string;
  readonly notRef: string;
  readonly wrongEntity: string;
}

interface CoordChecker {
  /** Resolve the field `$bill.x` / `$line.x` points at. Returns null when it is missing; the caller reports the error */
  readonly resolve: (ref: EffectRef) => Field | null;
  /** Premise of a per-line coordinate: exactly one line table. On failure, report and return false */
  readonly lineTableOk: (path: string, codes: CoordCodes) => boolean;
  /** This coordinate must be a ref field pointing at the `want` entity */
  readonly entityRef: (
    ref: EffectRef,
    want: string,
    what: string,
    path: string,
    target: string,
    codes: CoordCodes,
  ) => void;
}

function coordChecker(module: ModuleSchema, add: Add): CoordChecker {
  const subtables = module.fields.filter((f) => f.type === "subtable");
  const lineFields = subtables[0]?.fields ?? [];

  const resolve = (ref: EffectRef): Field | null => {
    const pool = ref.from === "bill" ? module.fields : lineFields;
    return pool.find((f) => f.key === ref.field) ?? null;
  };

  return {
    resolve,
    lineTableOk(path, codes) {
      // With two line tables there is no basis for which one `$line.` means. Refuse it at modeling time instead of guessing
      if (!subtables.length) {
        add(codes.lineNoSubtable, path, `This references $line, but this module has no line table`);
        return false;
      }
      if (subtables.length > 1) {
        add(
          codes.lineAmbiguous,
          path,
          `This module has ${subtables.length} line tables (${subtables.map((s) => s.key).join(", ")}), ` +
            `$line has no basis for which one it means`,
        );
        return false;
      }
      return true;
    },
    entityRef(ref, want, what, path, target, codes) {
      const field = resolve(ref);
      if (!field) {
        add(codes.fieldUnknown, `${path}.${what}`, `$${ref.from}.${ref.field} is not a field of this module`);
        return;
      }
      if (field.type !== "ref") {
        add(
          codes.notRef,
          `${path}.${what}`,
          `"${ref.field}" is a ${field.type} field, not a reference. The ${target} ledger lands on ${want}`,
        );
        return;
      }
      if (field.ref !== want) {
        add(
          codes.wrongEntity,
          `${path}.${what}`,
          `"${ref.field}" points at ${String(field.ref)}, but the ${target} ledger must land on ${want}`,
        );
      }
    },
  };
}

const EFFECT_COORD_CODES: CoordCodes = Object.freeze({
  lineNoSubtable: "EFFECT_LINE_NO_SUBTABLE",
  lineAmbiguous: "EFFECT_LINE_AMBIGUOUS",
  fieldUnknown: "EFFECT_SUBJECT_FIELD_UNKNOWN",
  notRef: "EFFECT_SUBJECT_NOT_REF",
  wrongEntity: "EFFECT_SUBJECT_WRONG_ENTITY",
});

/** Field key of the module's only line table. Returns null for zero or many — other gates cover those two cases */
function subtableKeyOf(module: ModuleSchema): string | null {
  const subtables = module.fields.filter((f) => f.type === "subtable");
  return subtables.length === 1 ? (subtables[0]?.key ?? null) : null;
}

function checkEffects(module: ModuleSchema, add: Add): void {
  const { lifecycle } = module;
  const codes = new Set(transitionActions(lifecycle).map((action) => action.code));
  const coord = coordChecker(module, add);
  const resolve = coord.resolve;

  for (const edge of lifecycle.transitions) {
    // `postsToLedger` is derived (`normalizeLifecycle` fills it back), not declared.
    // It is the **only derived field whose absence silently turns a safety gate off**: the web receives the live JSON,
    // cannot re-normalize, and can only assert that the field is present (`httpAdapter.assertDerivedPresent`) —
    // and that step checks presence, not correctness. A handwritten or pasted schema with `postsToLedger: false`
    // turns off "a posting must be confirmed", with no symptom. A pure semantic gate here covers it
    if (edge.effects.length > 0 && !edge.postsToLedger) {
      add(
        "TRANSITION_POSTS_TO_LEDGER_WRONG",
        `lifecycle.transitions.${edge.code}.postsToLedger`,
        `This edge declares ${edge.effects.length} effects, but postsToLedger is false. ` +
          `It is a derived field (filled back by normalizeLifecycle). Seeing it here means this declaration did not pass through kernel normalization. ` +
          `The hard boundary "a posting must not be stored before the user can see it" is then silently turned off`,
      );
    }

    edge.effects.forEach((effect, index) => {
      const path = `lifecycle.transitions.${edge.code}.effects[${index}]`;

      // Premise of per-line expansion: exactly one line table
      if (effect.perLine && !coord.lineTableOk(path, EFFECT_COORD_CODES)) return;

      if (effect.amount.kind === "field") {
        const at = effect.amount.from === "bill" ? "header" : "line";
        const found = resolve({ from: effect.amount.from, field: effect.amount.field });
        if (!found) {
          add("EFFECT_AMOUNT_FIELD_UNKNOWN", `${path}.amount`, `References a ${at} field "${effect.amount.field}" that does not exist`);
        } else if (!hasColumn(found)) {
          // A posting amount must come from a **fact already stored**.
          //
          // The criterion is **whether it has a column** (`hasColumn`), not "whether the system supplies the value" — the two are no longer equivalent:
          // `lineAgg` is computed by the system, but it is written into a column on save, a fact as hard as a hand-entered amount,
          // so it can be posted; `derive` (rollup / lookup / formula) builds no column and is computed at query time.
          // Posting it writes a number that can be recomputed at any moment into an append-only ledger.
          // Judging with isSystemSupplied would permanently lock out the most common posting amount in this repo (a header total),
          // and the modeler's only remaining path would be to hand-enter a number they cannot compute — the second source of truth this gate exists to prevent.
          add(
            "EFFECT_AMOUNT_NOT_STORED",
            `${path}.amount`,
            `"${effect.amount.field}" is a derive field and is not stored as a column. ` +
              `A posting amount accepts only a fact already stored, not a number computed at query time. ` +
              `To post the total of this bill's lines, declare it as lineAgg (computed on save, and it has a column)`,
          );
        } else if (!isNumericFieldType(found.type)) {
          // After the criterion widened from isSystemSupplied to hasColumn, an `auto` field (has a column, string)
          // also entered the allowed set. It would only blow up on `fieldNumber` at execution time, and the error shape is "the whole edge is unusable".
          // Modeling time should say it plainly: a document number is not an amount
          add(
            "EFFECT_AMOUNT_NOT_NUMERIC",
            `${path}.amount`,
            `"${effect.amount.field}" is a ${found.type} field and cannot record an amount. ` +
              `A posting amount can reference only one of ${NUMERIC_FIELD_TYPES.join(" / ")}`,
          );
        } else if (found.lineAgg) {
          // When a line total is posted, the line table must not be editable on the stretch where this posting **is still open**.
          //
          // A reversal amount is evaluated from the **current bill**, not from a ledger snapshot (`reconcileReversals` pushes
          // `candidate.effect`; only `sourceLineId` is taken from the matched row). If the total changes while the posting is open,
          // release does not release the number reserve originally occupied: a residual stays on that subject forever,
          // and the in-row and the out-row in the ledger each look completely legal.
          //
          // A hand-entered amount is not covered by this rule, and a total is: putting a hand-entered field on the editable allow-list
          // is the modeler **directly** saying "this amount may change", one explicit decision. Opening `lines` says
          // "the lines may change", and the total changing with them is an **indirect** consequence — nobody opening the lines thinks
          // "this changes a reservation already sitting on the customer". Indirectness is the criterion.
          //
          // The range matches EFFECT_REVERSE_UNREACHABLE / EFFECT_COORD_FIELD_EDITABLE:
          // every status reachable from `to`, avoiding reversal edges — once the posting is gone, later edits are free
          const source = found.lineAgg.of;
          for (const status of reachableFrom(lifecycle, edge.to, new Set(effect.reverseOn))) {
            if (!editableFields(module, status).includes(source)) continue;
            add(
              "EFFECT_AMOUNT_SOURCE_EDITABLE",
              `${path}.amount`,
              `This posting's amount comes from line total "${effect.amount.field}" (rolled up from "${source}"), ` +
                `and when the bill reaches status "${status}", "${source}" is still editable. ` +
                `After the lines change, the released or reversed amount no longer equals the amount originally reserved, ` +
                `and the difference stays on ${effect.target} forever with no error. ` +
                `Remove that status from editable, or take the line table off the editable allow-list`,
            );
            break;
          }
        }
      }

      // A self-loop edge (from === to) must not carry effects.
      //
      // The criterion is not "a self-loop edge is a problem" — `ship_more` (shipping → shipping) is normal business:
      // shipping twice is two outbound bills, and the second execution **is legal in meaning**.
      // The problem is that the only defense against "posting twice" on this kind of edge does not hold: the optimistic lock in `setStatus` writes
      // `where status = from`, and when from === to that condition still holds on the second execution.
      // A double click, a network retry, or two concurrent clicks each store a posting, and every ledger row looks legal on its own.
      // (An idempotency key can stop a programmatic retry, but a person clicking twice is two real intents, and is not treated as a replay.)
      if (edge.from === edge.to) {
        add(
          "EFFECT_ON_SELF_LOOP",
          `${path}`,
          `"${edge.code}" is a self-loop edge (${edge.from} -> ${edge.to}). Nothing stops it from posting twice: ` +
            `The status optimistic lock always holds when from === to, so repeating the edge stores a posting each time and every one is legal. ` +
            `Move the posting onto an edge that actually changes status`,
        );
      }

      // A field referenced by a posting coordinate must not be editable on the stretch where this posting **is still open**.
      //
      // The coordinate (subject / scope) is the execution side's **reconciliation key**: `reconcileReversals` takes the candidate's
      // subjectId / scopeId and looks for that forward row in the ledger. A miss drops the candidate.
      // The candidate is evaluated from the **current** bill — so once the coordinate is changed after posting,
      // release fails in silence: the customer changes from A to B and then close runs, the candidate computes B, the ledger holds A,
      // nothing matches, and the reservation on A **stays posted forever**. The screen shows "closed",
      // and the balance is a completely legal number that is simply too large, with no anomaly to see.
      //
      // (Sharing the amount source is deliberate, and reconciliation is not looser than the amount — see planEffects in engine.ts. Do not mix the two halves.)
      //
      // The range matches EFFECT_REVERSE_UNREACHABLE: every status reachable from `to`,
      // avoiding reversal edges — after a reversal edge the posting is gone, and later coordinate edits do not matter.
      for (const ref of [effect.subject, effect.scope]) {
        if (!ref) continue;
        const what = ref === effect.subject ? "subject" : "scope";
        // Editability of `$line.x` follows **that line table**: replacing the whole table can change the coordinate on a row
        const guarded = ref.from === "bill" ? ref.field : subtableKeyOf(module);
        if (guarded === null) continue;
        for (const status of reachableFrom(lifecycle, edge.to, new Set(effect.reverseOn))) {
          if (!editableFields(module, status).includes(guarded)) continue;
          add(
            "EFFECT_COORD_FIELD_EDITABLE",
            `${path}.${what}`,
            `This posting hangs on "$${ref.from}.${ref.field}", and when the bill reaches status "${status}" ` +
              `"${guarded}" is still editable. After the coordinate changes, release and reversal can never match this ledger row again, ` +
              `and this ${effect.target} ${effect.op} stays posted forever with zero errors. ` +
              `Take that status off editable, or take the coordinate field off the editable allow-list`,
          );
          break;
        }
      }

      // subject / scope must be ref fields pointing at the **prescribed entity**.
      // This gate turns "an inventory posting that never says which product" and "stock that never lands in a warehouse" from possible into impossible —
      // not by discipline, but because yarn test refuses to pass
      const contract = ledgerContract(effect.target);
      coord.entityRef(effect.subject, contract.subject, "subject", path, effect.target, EFFECT_COORD_CODES);
      if (effect.scope && contract.scope) {
        coord.entityRef(effect.scope, contract.scope, "scope", path, effect.target, EFFECT_COORD_CODES);
      }

      // A commitment and a fact are two kinds of posting, and the check is not the same strength.
      //
      //   Commitment (reserve / release) — exposure that has not happened yet, such as the payable exposure a purchase order reserves on approval.
      //     It **must** have a rollback path: a reservation nobody releases stays on the books forever, and there is no way to see who holds it.
      //
      //   Fact (in / out) — something that has already happened, such as inventory deducted by a shipment, and the receivable that follows.
      //     It **is supposed to stay on the books**. "No rollback" is the normal state of a fact, not a defect;
      //     only an explicit reversal, such as a red-ink entry, withdraws it.
      //
      // Treating the two the same produces an absurd requirement: every shipment must have a return edge that is destined to be taken.
      const isCommitment = effect.op === "reserve" || effect.op === "release";

      if (!effect.reverseOn.length) {
        if (isCommitment) {
          add(
            "EFFECT_REVERSE_MISSING",
            `${path}.reverseOn`,
            `${effect.target} ${effect.op} is a commitment, and no edge is declared to release it. A reservation with no way out is not allowed`,
          );
        }
        return;
      }

      const unknown = effect.reverseOn.filter((code) => !codes.has(code));
      if (unknown.length) {
        add("EFFECT_REVERSE_UNKNOWN", `${path}.reverseOn`, `points at an edge that does not exist: "${unknown.join(", ")}"`);
        return;
      }

      if (!isCommitment) return;

      // The core gate: after avoiding every reversal edge, can a terminal status still be reached?
      // Yes means there is a normal business path that finishes the bill without ever releasing this reservation, which stays posted forever.
      // This checks **reachability**, not existence. The previous generation only asked whether the edges named by reverseOn exist,
      // so "reserve on approve, release on unapprove" passed the gate, while the normal flow approve → ship → finish never passes unapprove.
      const escape = terminalEscapeFrom(lifecycle, edge.to, new Set(effect.reverseOn));
      if (escape) {
        add(
          "EFFECT_REVERSE_UNREACHABLE",
          `${path}.reverseOn`,
          `Avoiding ${effect.reverseOn.join(", ")} can still walk from "${edge.to}" to the terminal status "${escape}": ` +
            `on this path ${effect.target} ${effect.op} is never released, and the reservation stays posted forever. ` +
            `Add the edges on that path to reverseOn`,
        );
      }
    });
  }
}

function checkPreconditions(module: ModuleSchema, add: Add): void {
  const codes = new Set(transitionActions(module.lifecycle).map((action) => action.code));
  const coord = coordChecker(module, add);

  for (const pc of module.preconditions) {
    if (pc.onCreate) {
      if (pc.onTransition !== ALL_TRANSITIONS) {
        add("PRECONDITION_CREATE_TRANSITION", `preconditions.${pc.id}.onTransition`, "a create precondition's onTransition must be *");
      }
      if (pc.exit) add("PRECONDITION_CREATE_EXIT", `preconditions.${pc.id}.exit`, "a create precondition cannot configure a route exit");
      const path = `preconditions.${pc.id}`;
      if (pc.check) auditCheck(module, pc.check, `${path}.check`, ALL_TRANSITIONS, path, coord, add);
      if (pc.when) auditCheck(module, pc.when, `${path}.when`, ALL_TRANSITIONS, path, coord, add);
      continue;
    }
    const path = `preconditions.${pc.id}`;
    if (pc.onTransition !== "*" && !codes.has(pc.onTransition)) {
      add("PRECONDITION_EDGE_UNKNOWN", `${path}.onTransition`, `hangs on an action that does not exist: "${pc.onTransition}"`);
    }
    if (pc.exit && !codes.has(pc.exit)) {
      add("PRECONDITION_EXIT_UNKNOWN", `${path}.exit`, `reroutes to an action that does not exist: "${pc.exit}"`);
    } else if (pc.exit && pc.onTransition !== ALL_TRANSITIONS && codes.has(pc.onTransition)) {
      // Existing is not the same as reachable. Same lesson as EFFECT_REVERSE_UNREACHABLE:
      // a route is "do not take this edge, take that one", and the two edges must start from **the same status**.
      // If the exit lives on another status, the user clicks reroute and finds the button is not there —
      // a rule that fails in silence: validation passes, and at runtime there is no path.
      //
      // Check once for each start of the blocked action: the gate hangs on the action and blocks the user at every start.
      // Skip one start and the user blocked on that status has nowhere to go.
      for (const guarded of transitionEdges(module, pc.onTransition)) {
        if (hasTransitionAt(module, guarded.from, pc.exit)) continue;
        const exitFrom = transitionEdges(module, pc.exit).map((edge) => `「${edge.from}」`).join("、");
        add(
          "PRECONDITION_EXIT_UNREACHABLE",
          `${path}.exit`,
          `This rule blocks "${pc.onTransition}" (starting from "${guarded.from}"), but the exit "${pc.exit}" can only start from ${exitFrom}. ` +
            `The bill is at "${guarded.from}" right now, so this exit cannot be reached. A reroute exit must share the blocked edge's start`,
        );
      }
    }
    // When onTransition is "*", starts are not checked: it hangs on every edge, so there is no single start to compare.
    // This repo currently has no route + "*" combination. If one is written, the shape of the exit has to be thought through first

    // **The main criterion (`check`) and the condition tier (`when`) go through the same static check.**
    //
    // Checking them separately costs a pure silent failure: a misspelled field name in `when` reads undefined,
    // the comparison is always false, so this gate **never applies**, a block-level rule is quietly turned off by its guard,
    // and the declaration looks completely normal. That is more hidden than a wrong main criterion — a wrong main criterion at least still blocks someone.
    if (pc.check) {
      auditCheck(module, pc.check, `${path}.check`, pc.onTransition, path, coord, add);
    }
    if (pc.when) {
      auditCheck(module, pc.when, `${path}.when`, pc.onTransition, path, coord, add);
    }
  }
}

/**
 * The main criterion, a gate's when, and an edge's when share this: a misspelled field name makes the comparison always false.
 * A gate whose when is always false is a gate turned off in silence. An edge whose when is always false is an outgoing edge that is never seen.
 */
function auditCheck(
  module: ModuleSchema,
  check: NormalizedCheck,
  at: string,
  onTransition: string,
  availabilityPath: string,
  coord: CoordChecker,
  add: Add,
): void {
  const fields = new Set(module.fields.map((f) => f.key));
  for (const key of checkBillFields(check)) {
    if (!fields.has(key) && !isPlatformField(key)) {
      add("PRECONDITION_FIELD_UNKNOWN", at, `references a field that does not exist: "${key}"`);
      continue;
    }
    // `$bill.tenantId` is a **silently failing** spelling: the storage header projection deliberately drops the tenant column
    // (the isolation axis is not business data; handing it back only tempts the layer above to use it as a condition), so the rule reads undefined,
    // the comparison never holds, a block-level rule never passes, and it looks as if the business configured the rule tightly.
    // The criterion does not hold anyway: the query is already bound to the current tenant, and `$bill.tenantId`
    // equals the current tenant on every row that can be read. To judge the tenant, write `$actor.tenantId` (the identity axis, always present).
    if (key === "tenantId") {
      add(
        "PRECONDITION_FIELD_NOT_PROJECTED",
        at,
        `references "$bill.tenantId": the header projection deliberately omits the tenant column, so the rule reads undefined and the comparison never holds. ` +
          `The query is already bound to the current tenant, so this criterion is always true on every readable row. To judge the tenant, write $actor.tenantId`,
      );
    }
  }
  // `$actor.` has to be checked the same way as `$bill.`. The cost of not checking is **silent failure**:
  // a comparison that reads undefined is always false, a block-level rule never passes,
  // and it looks like "the business configured the rule tightly", not like a typo — nobody suspects a key name
  for (const key of checkActorKeys(check)) {
    if (!(ACTOR_KEYS as readonly string[]).includes(key)) {
      add(
        "PRECONDITION_ACTOR_KEY_UNKNOWN",
        at,
        `references "$actor.${key}", which the actor does not have. Choices: ${ACTOR_KEYS.join(" / ")} (a closed set). ` +
          `Job roles are a **set** (roles). To test one role write left:{value:"role"} op:"in" right:{ref:"$actor.roles"}`,
      );
    }
  }

  // `$param.` is the third closed prefix, and it has to be checked the same way as `$bill.` / `$actor.`.
  // The cost of not checking is identical: a wrong key reads undefined, `eq` is always false — a block
  // never passes, a warn pops every time, and both look like "the business configured the rule tightly".
  // The criterion is **the params this edge itself declares** (the `$actor.` criterion is a global closed set; this one is not).
  const paramKeys = checkParamKeys(check);
  if (paramKeys.length) {
    if (onTransition === ALL_TRANSITIONS) {
      // `*` hangs on every edge, and each edge's params differ, so there is no single criterion to check.
      // Letting it pass hands this dimension of static checking back to luck
      add(
        "PRECONDITION_PARAM_ON_ALL",
        at,
        `a rule hanging on "*" cannot reference $param. (this one references ${paramKeys.map((k) => `$param.${k}`).join(", ")}): ` +
          `it applies to every edge, while parameters are declared per edge. On an edge that did not declare the parameter it always reads undefined, and the rule fails in silence`,
      );
    } else {
      // Parameters are an action-level fact: every edge of the same action declares the same params, character for character
      const action = transitionAction(module.lifecycle, onTransition);
      const declared = new Set((action === null ? [] : action.params).map((prm) => prm.key));
      for (const key of paramKeys) {
        if (declared.has(key)) continue;
        add(
          "PRECONDITION_PARAM_UNKNOWN",
          at,
          `references "$param.${key}", but edge "${onTransition}" does not declare this parameter` +
            ` (declared: ${[...declared].join(", ") || "none"}). The value read is undefined, and the comparison is always false`,
        );
      }
    }
  }

  // `$line.` is the fourth. Both facts have to be checked; missing either one fails in silence:
  //   1. Whether this module has a line table — without one, `ctx.lines` is always empty: `lines_all` is vacuously true on the empty set,
  //      and `lines_any` is vacuously false. Whichever quantifier it is, that is not the business meaning of a per-line rule the modeler declared
  //   2. Whether the referenced column is in the line declaration — the same undefined problem as 1
  //
  // The exception is **platform fields on a line** (`PLATFORM_LINE_FIELDS`: `id` / `lineNo`):
  // the framework provides them, and by definition they must not be declared, but every row of the read model has them, so a rule may reference them.
  // Leaving this opening closed has been observed twice: "every order line must be fully consumed downstream" can only degrade to
  // a whole-bill measure, and that is not the same gate — the bill total is enough, one line is not, and it still passes.
  const lineFieldKeys = checkLineFields(check);
  if (lineFieldKeys.length && coord.lineTableOk(at, AVAILABILITY_COORD_CODES)) {
    for (const key of lineFieldKeys) {
      if (isPlatformLineField(key)) continue;
      if (coord.resolve({ from: "line", field: key })) continue;
      add(
        "PRECONDITION_LINE_FIELD_UNKNOWN",
        at,
        `references a column that does not exist on the line: "$line.${key}"` +
          ` (the only platform fields on a line are ${PLATFORM_LINE_FIELDS.join(" / ")})`,
      );
    }
  }

  checkAvailability(module, check, availabilityPath, coord, add);
  checkLinesRequiredIfRefField(module, check, availabilityPath, add);
  checkReferenceComparison(module, check, availabilityPath, coord, add);
  checkRelatedAggregation(module, check, availabilityPath, coord, add);
}

/** Local reference-coordinate gate for `lines_required_if_ref_field`. The loader checks the target field against the full catalog. */
function checkLinesRequiredIfRefField(
  module: ModuleSchema,
  check: NormalizedCheck,
  path: string,
  add: Add,
): void {
  const p = linesRequiredIfRefFieldOf(check);
  if (!p) return;
  const via = module.fields.find((field) => field.key === p.via);
  if (!via) return; // PRECONDITION_FIELD_UNKNOWN already reported
  if (via.type !== "ref") {
    add(
      "PRECONDITION_LINES_REQUIRED_VIA_NOT_REF",
      `${path}.check.via`,
      `"${p.via}" is a ${via.type} field, not a header reference, so ${p.entity}.${p.field} cannot be read from it`,
    );
    return;
  }
  if (via.ref !== p.entity) {
    add(
      "PRECONDITION_LINES_REQUIRED_ENTITY_MISMATCH",
      `${path}.check.entity`,
      `"${p.via}" points at ${String(via.ref)}, but the rule reads ${p.field} from ${p.entity}`,
    );
  }
}

const AVAILABILITY_COORD_CODES: CoordCodes = Object.freeze({
  lineNoSubtable: "PRECONDITION_LINE_NO_SUBTABLE",
  lineAmbiguous: "PRECONDITION_LINE_AMBIGUOUS",
  fieldUnknown: "PRECONDITION_SUBJECT_FIELD_UNKNOWN",
  notRef: "PRECONDITION_SUBJECT_NOT_REF",
  wrongEntity: "PRECONDITION_SUBJECT_WRONG_ENTITY",
});

/**
 * Coordinate gate for an availability comparison.
 *
 * The criterion is **the same copy** as `checkEffects` (`coordChecker`): the rule asks "which warehouse is enough",
 * the effect deducts "which warehouse", and both must land in the same cell of the ledger. Two separate criteria
 * will one day produce "the check looks at the Shanghai warehouse and the posting deducts the Beijing warehouse" — and each declaration looks correct on its own.
 *
 * The arity of `target × scope` (stock must give a scope, the others must not) is already thrown at **normalize time**
 * (see available_sufficient.normalize in primitives), consistent with how normalizeEffect treats the same fact.
 * Checking it again here is dead code that can never run.
 */
function checkAvailability(
  module: ModuleSchema,
  check: NormalizedCheck,
  path: string,
  coord: CoordChecker,
  add: Add,
): void {
  const p = availabilityOf(check);
  if (!p) return;
  const at = `${path}.check`;

  if (p.perLine && !coord.lineTableOk(at, AVAILABILITY_COORD_CODES)) return;

  const contract = ledgerContract(p.target);
  coord.entityRef(p.subject, contract.subject, "subject", at, p.target, AVAILABILITY_COORD_CODES);
  if (p.scope && contract.scope) {
    coord.entityRef(p.scope, contract.scope, "scope", at, p.target, AVAILABILITY_COORD_CODES);
  }

  // The needed quantity must be a field this module actually has. The `$bill.` tier was already checked by checkBillFields.
  // What is added here is `$line.` — line columns are not in the header field set, and not drilling into them is a blind spot
  if (p.need.from === "line" && !coord.resolve(p.need)) {
    add(
      "PRECONDITION_NEED_FIELD_UNKNOWN",
      `${at}.need`,
      `"${coordTextOf(p.need)}" is not a column of the line table, so "how much this step reserves" cannot be read and this rule cannot judge`,
    );
  }

  if (!p.limit) return;
  // Limit source: `via` must be a ref field on this bill, and the entity it points at must match limit.entity.
  // A mismatch is "looking up a product master with a customer-master field name" — the read is undefined, and availability becomes NaN
  const via = module.fields.find((f) => f.key === p.limit?.via);
  if (!via) {
    add("PRECONDITION_LIMIT_VIA_UNKNOWN", `${at}.limit.via`, `"${p.limit.via}" is not a header field of this module`);
    return;
  }
  if (via.type !== "ref") {
    add(
      "PRECONDITION_LIMIT_VIA_NOT_REF",
      `${at}.limit.via`,
      `"${p.limit.via}" is a ${via.type} field, not a reference. The limit lives on the master record it points at`,
    );
    return;
  }
  if (via.ref !== p.limit.entity) {
    add(
      "PRECONDITION_LIMIT_ENTITY_MISMATCH",
      `${at}.limit.entity`,
      `"${p.limit.via}" points at ${String(via.ref)}, but limit.entity is ${p.limit.entity}. ` +
        `The limit field is read from the wrong entity, comes back undefined, and availability cannot be computed`,
    );
  }
}

/**
 * Local coordinate gate for `ref_field_compare`.
 *
 * The target entity and target field can only be checked once the full catalog is in hand. Here, first make sure `via`
 * really is a reference on this bill to that entity, and that a header ref and a line refLine are not swapped.
 */
function checkReferenceComparison(
  module: ModuleSchema,
  check: NormalizedCheck,
  path: string,
  coord: CoordChecker,
  add: Add,
): void {
  const p = referenceComparisonOf(check);
  if (!p) return;
  const at = `${path}.check`;

  // Zero or many line tables for `$line` were already reported by checkLineFields from the same projection.
  // Do not manufacture a second error here.
  if (p.via.from === "line" && module.fields.filter((f) => f.type === "subtable").length !== 1) return;
  const via = coord.resolve(p.via);
  if (!via) return; // PRECONDITION_(LINE_)FIELD_UNKNOWN already reported

  if (p.through === null) {
    if (via.type !== "ref") {
      add(
        "PRECONDITION_REF_VIA_NOT_REF",
        `${at}.via`,
        `"${coordTextOf(p.via)}" is a ${via.type} field. Looking up the target header must go through a ref field`,
      );
      return;
    }
  } else {
    if (via.type !== "refLine") {
      add(
        "PRECONDITION_REF_VIA_NOT_REF_LINE",
        `${at}.via`,
        `"${coordTextOf(p.via)}" is a ${via.type} field. Looking up target line "${p.through}" must go through a refLine field`,
      );
      return;
    }
    if (via.through !== p.through) {
      add(
        "PRECONDITION_REF_THROUGH_MISMATCH",
        `${at}.through`,
        `"${coordTextOf(p.via)}" points at line table "${String(via.through)}", but the rule looks up "${p.through}"`,
      );
    }
  }

  if (via.ref !== p.entity) {
    add(
      "PRECONDITION_REF_ENTITY_MISMATCH",
      `${at}.entity`,
      `"${coordTextOf(p.via)}" points at ${String(via.ref)}, but the rule reads a field from ${p.entity}. ` +
        `The source entity does not match, so this cannot be judged from it`,
    );
  }
}

/**
 * Local coordinate gate for `related_agg.on` — "whose head this accumulation is charged to" must be an **identity coordinate**.
 *
 * This gate used to be entirely missing, and the gap was silent: `on` was only checked for "does this cell exist"
 * (`checkBillFields` / `checkLineFields`). Nobody checked "is it an id".
 * So `on: "$line.qty"` was all green at modeling time, and at runtime `list()` compared a **quantity** to an upstream id column —
 * no row matches, the total is 0, "the accumulation must not exceed the limit" always passes, and `verdict = pass` has no anomaly.
 *
 * The cross-module half (whether `on` and `match` land in the **same** coordinate space) can only be checked with the full catalog,
 * in `checkCrossReferences`. Both sides share the kernel's one `keySpaceOf`. They do not each keep a separate ruler.
 */
function checkRelatedAggregation(
  module: ModuleSchema,
  check: NormalizedCheck,
  path: string,
  coord: CoordChecker,
  add: Add,
): void {
  const p = relatedAggregationOf(check);
  if (!p) return;
  const at = `${path}.check`;
  const key = relatedAggKeyOf(p);

  // Zero or many line tables for `$line` were already reported by checkLineFields from the same projection.
  // Do not manufacture a second error here (same as that line in checkReferenceComparison).
  if (key.from === "line" && module.fields.filter((f) => f.type === "subtable").length !== 1) return;

  const own: KeySpace = {
    module: module.code,
    through: key.from === "line" ? subtableKeyOf(module) : null,
  };
  const field = coord.resolve(key) ?? undefined;
  if (keySpaceOf(key.field, field, own) !== null) return;

  // When the cell does not exist at all, PRECONDITION_(LINE_)FIELD_UNKNOWN has already reported it — say each thing once.
  // Platform fields must fall through to the report below: `$line.lineNo` is the tier that **cannot be declared, yet can be read**
  // (`isPlatformLineField` lets it through). Without an explicit catch it slips between the two gates.
  const platform = isPlatformField(key.field) || isPlatformLineField(key.field);
  if (!field && !platform) return;

  add(
    "PRECONDITION_ON_NOT_KEY",
    `${at}.on`,
    `Related key "${coordTextOf(key)}" is not an identity coordinate${field ? ` (it is a ${field.type} field)` : ""}. ` +
      `"Whose head this accumulation is charged to" has only three spellings: id (this ${key.from === "line" ? "line" : "bill"} itself), ` +
      `a ref column (pointing at some header), or a refLine column (pointing at some line). ` +
      `Using a quantity, an amount, or a line number as the key reports no error. It only matches downstream rows when the values happen to be equal: ` +
      `usually no row matches, the total is 0, the limit gate always passes, and the result looks completely normal`,
  );
}

function coordTextOf(ref: EffectRef): string {
  return `$${ref.from}.${ref.field}`;
}

/**
 * Formula gate.
 *
 * A formula is a calculation on **the same row**: a header formula references header fields, and a line-column formula references columns of the same line table.
 * A cross-layer reference has no compilation basis (when the header is computed there are N lines — which row should it take?), so it is refused.
 */
function checkFormulas(module: ModuleSchema, add: Add): void {
  /** Check one layer (the header, or the columns of one line table) */
  const checkLayer = (layer: readonly Field[], layerPath: string, layerName: string): void => {
    const byKey = new Map(layer.map((f) => [f.key, f]));
    const formulas = new Map<string, Expr>();
    for (const f of layer) {
      if (f.derive !== null && f.derive.kind === "formula") formulas.set(f.key, f.derive.expr);
      if (f.calculate !== null) formulas.set(f.key, f.calculate);
    }
    if (!formulas.size) return;

    for (const [key, expr] of formulas) {
      const path = `${layerPath}.${key}`;
      const self = byKey.get(key);

      // A formula computes a number. If the field that carries it is not numeric, the value has no usable presentation or comparator —
      // that was the old disease of computed: a value with no type
      if (self && !isNumericFieldType(self.type)) {
        add(
          "FORMULA_RESULT_NOT_NUMERIC",
          path,
          `A formula computes a number, but "${key}" is declared as ${self.type}. ` +
            `Change it to one of ${NUMERIC_FIELD_TYPES.join(" / ")}`,
        );
      }

      checkDivByZero(expr, path, add);

      for (const ref of formulaFields(expr)) {
        if (ref === key) {
          add("FORMULA_SELF_REFERENCE", path, `the formula references itself ("${ref}"). A self-reference has no defined value, and evaluation never terminates`);
          continue;
        }
        const target = byKey.get(ref);
        if (!target) {
          add(
            "FORMULA_FIELD_UNKNOWN",
            path,
            `the formula references "${ref}", but ${layerName} has no such field. ` +
              `A formula only computes the same row: a header formula references header fields, and a line-column formula references columns of the same line table`,
          );
          continue;
        }
        if (!isFormulaOperandType(target.type)) {
          add(
            "FORMULA_FIELD_NOT_NUMERIC",
            path,
            `the formula references "${ref}", which is a ${target.type} field, not a number or a bool. It can reference only ${NUMERIC_FIELD_TYPES.join(" / ")} / bool`,
          );
        }
      }
    }

    // A cycle: A references B and B references A. Self-reference was already reported on its own. Here only cycles of length >= 2 are found
    const cycle = findCycle(formulas);
    const head = cycle?.[0];
    if (cycle && head !== undefined) {
      add(
        "FORMULA_CYCLE",
        `${layerPath}.${head}`,
        `formula cycle: ${[...cycle, head].join(" → ")}. No value on the cycle can be computed, and evaluation never terminates`,
      );
    }
  };

  checkLayer(module.fields, "fields", "header");
  for (const sub of module.fields) {
    if (sub.fields) checkLayer(sub.fields, `fields.${sub.key}.fields`, `line table "${sub.key}"`);
  }
}

/** The divisor is the literal 0 — statically it has no value, so there is no need to wait until some row is evaluated for it to blow up. */
function checkDivByZero(expr: Expr, path: string, add: Add): void {
  if ("field" in expr || "value" in expr) return;
  if ("orElse" in expr) {
    checkDivByZero(expr.orElse.of, path, add);
    return;
  }
  if (expr.op === "div") {
    const divisor = expr.args[1];
    if (divisor && "value" in divisor && divisor.value === 0) {
      add("FORMULA_DIV_BY_ZERO", path, "the formula divides by the literal 0. It has no value; it is not a result that computes to 0");
    }
  }
  for (const arg of expr.args) checkDivByZero(arg, path, add);
}

/** Find a cycle in the formula dependency graph. Returns the key sequence on the cycle, or null when there is none. */
function findCycle(formulas: ReadonlyMap<string, Expr>): readonly string[] | null {
  const deps = new Map<string, readonly string[]>();
  for (const [key, expr] of formulas) {
    deps.set(key, formulaFields(expr).filter((r) => r !== key && formulas.has(r)));
  }

  const done = new Set<string>();
  const stack: string[] = [];
  const onStack = new Set<string>();

  const walk = (key: string): readonly string[] | null => {
    if (onStack.has(key)) return stack.slice(stack.indexOf(key));
    if (done.has(key)) return null;
    const edges = deps.get(key);
    // The keys of deps are the keys of formulas, and walk is only called with those keys. Missing one means the graph was built wrong
    if (edges === undefined) return null;
    stack.push(key);
    onStack.add(key);
    for (const next of edges) {
      const hit = walk(next);
      if (hit) return hit;
    }
    stack.pop();
    onStack.delete(key);
    done.add(key);
    return null;
  };

  for (const key of deps.keys()) {
    const hit = walk(key);
    if (hit) return hit;
  }
  return null;
}

/**
 * Line-total gate.
 *
 * Division of labor with the formula gate: a formula is arithmetic on **the same row** (a line amount), and a total is **across rows**
 * (the order amount on the header). Stacked, they are the most common chain in an ERP —
 * line amount = quantity × unit price × discount, order amount = the sum of the line amounts.
 */
function checkLineAggregates(module: ModuleSchema, add: Add): void {
  const byKey = new Map(module.fields.map((f) => [f.key, f]));

  for (const field of module.fields) {
    const spec = field.lineAgg;
    if (!spec) continue;
    const path = `fields.${field.key}.lineAgg`;

    const table = byKey.get(spec.of);
    if (!table || table.type !== "subtable") {
      const subtables = module.fields.filter((f) => f.type === "subtable").map((f) => f.key);
      add(
        "LINE_AGG_TARGET_UNKNOWN",
        `${path}.of`,
        `"${spec.of}" is not a line table of this module. ` +
          (subtables.length ? `Choices: ${subtables.join(", ")}` : "this module has no line table, so there are no rows to total"),
      );
      continue;
    }
    // The shape gate guarantees that a subtable declares fields
    const cols = table.fields ?? [];

    if (spec.agg === "count") {
      // A row count is an integer. Landing it on money or a percent has no reading
      if (field.type !== "number") {
        add("LINE_AGG_TYPE_MISMATCH", path, `count counts rows, so the carrying field must be number (this field is ${field.type})`);
      }
      continue;
    }

    const col = cols.find((c) => c.key === spec.measure);
    if (!col) {
      add(
        "LINE_AGG_MEASURE_UNKNOWN",
        `${path}.measure`,
        `line table "${spec.of}" has no column "${String(spec.measure)}". Choices: ${cols.map((c) => c.key).join(", ")}`,
      );
      continue;
    }

    // The criterion is the kernel's `isLocalMeasure` — the evaluator and the line-table footer read the same copy (see the comment there)
    const nonLocal = isLocalMeasure(col) ? null : col.derive;
    if (nonLocal !== null) {
      // A total is computed **on save** (a pure function, zero IO), while lookup / rollup have to query the database.
      // Letting it through looks like: the offline gate passes, the first save blows up inside storage,
      // and the error then points at a call stack the modeler never wrote
      add(
        "LINE_AGG_MEASURE_NOT_LOCAL",
        `${path}.measure`,
        `measure column "${col.key}" is a ${nonLocal.kind} derivation, and it has a value only after a database query. ` +
          `A total is computed on save, so a measure can only be a column on the line or a formula on the same row`,
      );
    }

    if (!isSummarizableType(col.type)) {
      // Summing percent adds percentages and produces a number with no reading.
      // The criterion comes from the kernel's `isSummarizableType` — the same copy as the list footer and the line-table footer
      add(
        "LINE_AGG_MEASURE_NOT_SUMMABLE",
        `${path}.measure`,
        `measure column "${col.key}" is ${col.type}, and it cannot be totaled into a number with business meaning. Only number / money can be totaled`,
      );
      continue;
    }

    if (col.type !== field.type) {
      // sum(unit price: money) landing in a number column drops the display scale and precision of money (money is four places, number is six),
      // while the two numbers look the same
      add(
        "LINE_AGG_TYPE_MISMATCH",
        path,
        `the total is of ${col.type} column "${col.key}", but the carrying field is ${field.type}. ` +
          `The two must be the same type, or precision and display scale are silently swapped at the total`,
      );
    }
  }
}

function checkHandoff(module: ModuleSchema, add: Add): void {
  const statuses = new Set(module.lifecycle.statuses.map((s) => s.key));
  const codes = new Set(transitionActions(module.lifecycle).map((action) => action.code));

  for (const h of module.handoff) {
    const path = `handoff.${h.id}`;
    if (h.onStatus && !statuses.has(h.onStatus)) {
      add("HANDOFF_TARGET_UNKNOWN", `${path}.onStatus`, `hangs on a status that does not exist: "${h.onStatus}"`);
    }
    if (h.onTransition && !codes.has(h.onTransition)) {
      add("HANDOFF_TARGET_UNKNOWN", `${path}.onTransition`, `hangs on an edge that does not exist: "${h.onTransition}"`);
    }
  }
}

/**
 * The four `unique` gates.
 *
 * Uniqueness is an index emitted at **table-build time** plus one duplicate check on the **write path**. Neither place has room for "roughly this meaning":
 * a vague declaration does not produce an error. It produces meaning A, which the modeler thinks they declared, and meaning B, which the system actually does.
 * Combinations that do not hold are refused here one by one, and each of the four has its own error code — the criteria differ, so the guidance differs.
 */
function checkUnique(field: Field, path: string, inSubtable: boolean, add: Add): void {
  if (inSubtable) {
    // "Unique" on a line column has **two readings that both hold and are completely different**:
    //   1. Unique across the tenant — the value may appear only once among every line of every bill in the company;
    //   2. Unique within this bill — the same bill may not record the same product on two lines (the common real-business case).
    // Emitting `uniqueIndex(tenant_id, column)` on the child table does 1, while the person who writes it on a line column usually wants 2,
    // and neither reports an error — the modeler thinks the bill is constrained, the system constrains the whole tenant, and the second bill collides.
    // Only the reading that can be stated clearly is supported (header = unique across the tenant). 2 is explicitly refused: when it is really needed it should be an explicit
    // scope dimension (such as unique: "bill"), not a guess from position.
    add(
      "FIELD_UNIQUE_ON_LINE",
      path,
      "unique can only hang on the header. Unique on a line column has two readings: unique across the tenant (what the emitted index actually does) " +
        "and not repeated within this bill (what the writer usually wants). Both hold, neither reports an error, and choosing the wrong one is visible only on the second bill. " +
        "Express not-repeated-within-this-bill with a precondition",
    );
  }
  const mechanism = field.derive
    ? `${field.derive.kind} derived fields build no column, so there is nowhere to emit a unique index. A value computed only at query time also has no moment that can be constrained`
    : field.lineAgg
      ? "lineAgg is the total of this bill's lines. Two bills having the same total is ordinary, and unique would reject normal business"
      : field.auto
        ? "auto is numbered by the platform and is already unique within the tenant (the primary index covers it). Numbering also happens **after** the write-path duplicate check, so the checker structurally cannot see this value"
        : null;
  if (mechanism !== null) {
    add("FIELD_UNIQUE_SYSTEM_SUPPLIED", path, `a system-supplied field cannot be marked unique: ${mechanism}`);
  }
  const refusal = uniqueRefusalOf(field.type);
  if (refusal !== null) {
    add("FIELD_UNIQUE_TYPE", path, `a ${field.type} field cannot be marked unique: ${refusal}`);
  }
  if (field.primary) {
    // primary already had `uniqueIndex(tenant_id, primary)` emitted by the table builder. Marking it again emits a second
    // identical index (paying the write-maintenance cost twice). Worse, "the unique scope of the document number" then has two
    // declaration sites — change one later and the other stays still in silence
    add(
      "FIELD_UNIQUE_WITH_PRIMARY",
      path,
      "a primary field is already unique within the tenant (the table builder emitted a unique index for it). Marking unique again emits a second identical index, " +
        "and gives document-number uniqueness two declaration sites",
    );
  }
}

/**
 * Gates that make `hidden` mutually exclusive with manual-create and Planner supply.
 *
 * `hidden` means "the database has the column, the UI does not render it".
 */
function checkHiddenAndManualCreate(
  module: ModuleSchema,
  field: Field,
  path: string,
  inSubtable: boolean,
  add: Add,
): void {
  if (field.requiredOnManualCreate === true) {
    if (field.required) {
      add(
        "FIELD_MANUAL_CREATE_REQUIRED_REDUNDANT",
        path,
        "requiredOnManualCreate duplicates required. The former is only for a field that system generation may leave empty and a manual create must fill",
      );
    }
    if (field.type === "subtable" || isSystemSupplied(field, inSubtable ? undefined : module.fields)) {
      add(
        "FIELD_MANUAL_CREATE_REQUIRED_UNFILLABLE",
        path,
        "requiredOnManualCreate can only be marked on a stored field that a manual create can fill. It cannot be marked on a line table or a system-supplied field",
      );
    }
    if (field.hidden === true) {
      add(
        "FIELD_MANUAL_CREATE_REQUIRED_HIDDEN",
        path,
        "a requiredOnManualCreate field must be visible on the manual-create form. hidden leaves the user unable to fill a required value",
      );
    }
  }
  if (field.plannerSupplied === true) {
    const clash = field.systemGenerated
      ? "systemGenerated"
      : field.auto
        ? "auto"
        : field.createDefault !== null
          ? "createDefault"
          : field.derive
            ? "derive"
            : field.calculate
              ? "calculate"
              : field.lineAgg
                ? "lineAgg"
                : field.snapshot
                  ? "snapshot"
                  : field.refDefault
                    ? "refDefault"
                    : field.refPreselect
                      ? "refPreselect"
                      : field.unitChoice
                        ? "unitChoice"
                        : null;
    if (field.type === "subtable") {
      add(
        "FIELD_PLANNER_SUPPLIED_SUBTABLE",
        path,
        "plannerSupplied can only be marked on one stored field. A line table is generated row by row through the Planner lines channel, and the whole table cannot be marked as a frozen value",
      );
    }
    if (clash !== null) {
      add(
        "FIELD_PLANNER_SUPPLIED_EXCLUSIVE",
        path,
        `plannerSupplied is mutually exclusive with ${clash}. This cell must be given explicitly by the Planner and enter the preview fingerprint. Another supply or hiding mechanism must not rewrite it`,
      );
    }
  }
  if (field.hidden === true) {
    if (field.required) {
      add(
        "FIELD_HIDDEN_REQUIRED",
        path,
        "a hidden field cannot be marked required. The user has no way to fill it, and required only jams the bill. " +
          "If the column must be non-null, cover it with server logic on the write path (systemGenerated), or let system-supplied notNull cover it on the table-build side",
      );
    }
    if (field.unique) {
      add(
        "FIELD_HIDDEN_UNIQUE",
        path,
        "a hidden field cannot be marked unique. hidden means the form UI does not render it, but the unique duplicate check and index still apply, " +
          "so the user cannot see or change the cell and is still blocked from saving by it. If it must be unique in the business, make it editable",
      );
    }
  }
}

function checkStatusWritePolicies(
  module: ModuleSchema,
  field: Field,
  path: string,
  inSubtable: boolean,
  add: Add,
): void {
  const statuses = new Set(module.lifecycle.statuses.map((status) => status.key));
  const unique = uniqueDefaultWithinOf(field);
  if (unique !== null) {
    if (inSubtable) {
      add(
        "FIELD_UNIQUE_DEFAULT_ON_LINE",
        path,
        "uniqueDefaultWithin can only hang on the header. The default pointer is a coordinate of the whole bill, not a cell on a line",
      );
    }
    if (field.unique) {
      add(
        "FIELD_UNIQUE_DEFAULT_WITH_UNIQUE",
        path,
        "uniqueDefaultWithin is mutually exclusive with unique: the former demotes the old pointer on entering a status, the latter is a hard rejection across the tenant",
      );
    }
    if (!hasColumn(field)) {
      add(
        "FIELD_UNIQUE_DEFAULT_NO_COLUMN",
        path,
        "uniqueDefaultWithin must hang on a bool field that has a column, or there is nowhere to write the demotion of the old pointer",
      );
    }
    if (!statuses.has(unique.status)) {
      add(
        "FIELD_UNIQUE_DEFAULT_STATUS_UNKNOWN",
        `${path}.uniqueDefaultWithin.status`,
        `uniqueDefaultWithin.status "${unique.status}" is not a lifecycle status of this module`,
      );
    }
    const seen = new Set<string>();
    for (const key of unique.within) {
      if (key === field.key) {
        add(
          "FIELD_UNIQUE_DEFAULT_WITHIN_SELF",
          `${path}.uniqueDefaultWithin.within`,
          `within cannot contain this field "${key}". The default pointer itself is not a coordinate dimension`,
        );
        continue;
      }
      if (seen.has(key)) {
        add(
          "FIELD_UNIQUE_DEFAULT_WITHIN_DUP",
          `${path}.uniqueDefaultWithin.within`,
          `within declares "${key}" more than once`,
        );
        continue;
      }
      seen.add(key);
      const peer = module.fields.find((candidate) => candidate.key === key);
      if (!peer) {
        add(
          "FIELD_UNIQUE_DEFAULT_WITHIN_UNKNOWN",
          `${path}.uniqueDefaultWithin.within`,
          `within references a header field that does not exist: "${key}"`,
        );
        continue;
      }
      if (!hasColumn(peer)) {
        add(
          "FIELD_UNIQUE_DEFAULT_WITHIN_NO_COLUMN",
          `${path}.uniqueDefaultWithin.within`,
          `within "${key}" has no column, so the coordinate cannot be compared from what is stored`,
        );
      }
    }
  }

  const sequence = generatedSequenceOf(field);
  if (sequence !== null) {
    if (inSubtable) {
      add(
        "FIELD_GENERATED_SEQUENCE_ON_LINE",
        path,
        "generatedSequence can only hang on the header. A sequence inside a coordinate belongs to the whole bill, not to a line",
      );
    }
    if (field.systemGenerated !== true) {
      add(
        "FIELD_GENERATED_SEQUENCE_NOT_SYSTEM",
        path,
        "generatedSequence must hang on a systemGenerated field, written by the write path, and a person must not fill it",
      );
    }
    if (field.type !== "string") {
      add(
        "FIELD_GENERATED_SEQUENCE_NOT_STRING",
        path,
        "generatedSequence must hang on string (a version number is text)",
      );
    }
    for (const key of sequence.within) {
      const peer = module.fields.find((candidate) => candidate.key === key);
      if (!peer) {
        add(
          "FIELD_GENERATED_SEQUENCE_WITHIN_UNKNOWN",
          `${path}.generatedSequence.within`,
          `within "${key}" is not a header field of this module`,
        );
      } else if (!hasColumn(peer)) {
        add(
          "FIELD_GENERATED_SEQUENCE_WITHIN_NO_COLUMN",
          `${path}.generatedSequence.within`,
          `within "${key}" has no column, so the sequence coordinate cannot be compared from what is stored`,
        );
      }
    }
  }

  const stamp = stampOnFirstEnterOf(field);
  if (stamp === null) return;
  if (inSubtable) {
    add(
      "FIELD_STAMP_ON_LINE",
      path,
      "stampOnFirstEnter can only hang on the header. The stamp on first entering a status is the bill's audit date, not a line",
    );
  }
  if (field.systemGenerated !== true) {
    add(
      "FIELD_STAMP_NOT_SYSTEM_SUPPLIED",
      path,
      "stampOnFirstEnter must hang on a systemGenerated date / datetime, written when the status is stored, and a person must not fill it",
    );
  }
  if (!hasColumn(field)) {
    add("FIELD_STAMP_NO_COLUMN", path, "stampOnFirstEnter must hang on a date / datetime field that has a column, or there is nowhere to write the stamp");
  }
  if (!statuses.has(stamp.status)) {
    add(
      "FIELD_STAMP_STATUS_UNKNOWN",
      `${path}.stampOnFirstEnter.status`,
      `stampOnFirstEnter.status "${stamp.status}" is not a lifecycle status of this module`,
    );
  }
}

/** A companion column of a composite unique must be resolvable, have a column, and not be the field itself. */
function checkUniqueWith(module: ModuleSchema, add: Add): void {
  const byKey = new Map(module.fields.map((f) => [f.key, f]));
  for (const field of module.fields) {
    if (field.uniqueWith === null) continue;
    const path = `fields.${field.key}.uniqueWith`;
    // This cannot be stuffed into `checkUnique`: that function only enters when `unique: true`,
    // so "uniqueWith without unique" would always be missed and silently become no constraint.
    if (!field.unique) {
      add(
        "FIELD_UNIQUE_WITH_WITHOUT_UNIQUE",
        path,
        "uniqueWith is meaningful only when unique: true. It says unique together with these columns, not a constraint on its own",
      );
    }
    const seen = new Set<string>();
    for (const key of field.uniqueWith) {
      if (key === field.key) {
        add("FIELD_UNIQUE_WITH_SELF", path, `uniqueWith cannot contain this field "${key}"`);
        continue;
      }
      if (seen.has(key)) {
        add("FIELD_UNIQUE_WITH_DUP", path, `uniqueWith declares "${key}" more than once`);
        continue;
      }
      seen.add(key);
      const peer = byKey.get(key);
      if (!peer) {
        add("FIELD_UNIQUE_WITH_UNKNOWN", path, `uniqueWith references a header field that does not exist: "${key}"`);
        continue;
      }
      if (!hasColumn(peer)) {
        add(
          "FIELD_UNIQUE_WITH_NO_COLUMN",
          path,
          `uniqueWith "${key}" has no column (${peer.type}${peer.derive ? `/${peer.derive.kind}` : ""}), so there is nowhere to emit a composite unique index`,
        );
      }
    }
  }
}

/**
 * **What to write next** when no hop will ever evaluate the value.
 *
 * The tiers exist so the correct spelling of the four `via` values stays different. After collapsing them into one sentence "change the match",
 * a person who hung a snapshot one hop too deep goes and changes a coordinate that was already right.
 * The criterion (`refSupplyOf`) says why it does not work. This copy says how to write it.
 * Both sentences are required. An error message missing the second only moves the 500 forward to modeling time, and the person still does not know what to change.
 */
function unresolvedRemedy(via: RefSupplyVia, match: Field): string {
  switch (via) {
    case "depth":
      // One more hop on the chain would be a third hop. The upstream cell freezes the same source record, so the correct fix is to **skip the middle hop**
      return (
        `hang this field's snapshot directly on the root reference above "${match.key}"` +
        ` (the same source record, one fewer hop), or switch to derive.lookup (computed at query time, no column, no hop limit)`
      );
    case "cycle":
      return `the snapshot chain is a cycle. Break the cycle first — no cell on the cycle can have a value before the others`;
    case "line":
      return (
        `a line-level reference must not be system-supplied: change "${match.key}" back to a refLine the user can fill (it is the only input). ` +
        `The companion header ref is the column the system fills`
      );
    case "derived":
      return (
        `"${match.key}" comes from derive / auto / lineAgg, and the write path has no reference-resolution hop for it. ` +
        `Bring it across with derive.lookup (computed at query time), or hang the snapshot on a real user-input reference`
      );
    case "broken":
      return `point match at a ref / refLine on the same layer first (another gate in this same declaration reports that coordinate)`;
    // The two tiers below do not reach unreachable (`refSupplyOf` classifies them as input / resolved)
    case "input":
    case "companion":
    case "chain":
      return schemaFail(`supply timing "${via}" must not land in the unreachable tier — the classification and the consumer have drifted`);
  }
}

/** What to write next when the timing is right but a value is not guaranteed. The two tiers have different correct fixes, and they must not be merged. */
function optionalRemedy(via: RefSupplyVia, match: Field): string {
  switch (via) {
    case "input":
      return `mark "${match.key}" required (the user must pick one record, and the server can then always freeze a value)`;
    case "companion":
      // Marking the companion column itself required does nothing: its value comes from the join of the paired refLine.
      // The line-level reference is what must be required (same as class 2 of `createBlockersOf`)
      return (
        `"${match.key}" is a companion column. Marking it does nothing — mark the paired refLine required` +
        ` (a companion bill id exists only after a line is chosen)`
      );
    case "chain":
      return `mark the user-fillable reference at the root of this chain required — non-null can be guaranteed only by that root cell`;
    case "depth":
    case "cycle":
    case "line":
    case "derived":
    case "broken":
      return schemaFail(`supply timing "${via}" must not land on the guaranteed dimension — it did not even pass the stage`);
  }
}

function checkFieldsAndViews(module: ModuleSchema, add: Add): void {
  const fields = new Map(module.fields.map((f) => [f.key, f]));

  if (!module.fields.some((f) => f.primary)) {
    add("FIELD_NO_PRIMARY", "fields", "no field is marked primary: the list and the reference picker do not know what to display");
  }

  // Numbering: at most one auto field in the whole module; numbering is required only when there is an auto field. A suggestion-code-only case may keep numbering alone,
  // and the route or form fetches a suggestion once on create, instead of the save path filling it automatically.
  const autoFields = module.fields.filter(isAutoNumbered);
  if (autoFields.length > 1) {
    add(
      "NUMBERING_MULTI_AUTO",
      "fields",
      `at most one auto field (the numbering identity is unique). Now there are: ${autoFields.map((f) => f.key).join(", ")}`,
    );
  }
  if (autoFields.length > 0 && module.numbering === null) {
    add(
      "NUMBERING_MISSING",
      "numbering",
      `field "${autoFields.map((f) => f.key).join(", ")}" is marked auto, so the module must declare numbering (prefix + seqScope, and neither has a default)`,
    );
  }
  if (autoFields.length === 0 && module.numbering !== null) {
    // Allowed: master data that wants an editable code the backend can still suggest.
    // Consumers of this kind of module are not on the automatic save path. They are on the explicit "fetch a suggested code on create" interface.
  }

  // Columns of a child table are likewise given platform fields such as id / createdAt by the framework. They likewise must not be declared,
  // and a derived field likewise must not be marked required — both gates drill one level down, and being inside lines is not a reason to let them through
  const checkField = (field: Field, path: string, inSubtable: boolean, siblings: readonly Field[]): void => {
    if (isPlatformField(field.key)) {
      add(
        "FIELD_SHADOWS_PLATFORM",
        path,
        `"${field.key}" is a platform field the framework provides automatically (${PLATFORM_FIELDS.join(", ")}). ` +
          `Declaring it again is not needed and not allowed — a declaration is a second source of truth. Views and rules can reference it directly`,
      );
    }
    if (
      field.required &&
      isSystemSupplied(field, siblings) &&
      !isRefLineCompanion(field, siblings) &&
      field.systemGenerated !== true
    ) {
      add(
        "FIELD_REQUIRED_SYSTEM_SUPPLIED",
        path,
        "a system-supplied field (derive / auto / lineAgg / snapshot / calculate / plannerSupplied) cannot be marked required. " +
          "The user has no way to fill it, and required only jams the bill. " +
          "auto is guaranteed non-null by numbering, lineAgg by the line total, and snapshot by required match plus a non-null source guarantee. The table builder emits notNull automatically. " +
          "systemGenerated is supplied by the write path and may be required (it blocks a manual create, and the column is NOT NULL)",
      );
    }
    if (field.snapshot) {
      const match = siblings.find((candidate) => candidate.key === field.snapshot?.match);
      if (!match) {
        add(
          "SNAPSHOT_MATCH_UNKNOWN",
          `${path}.snapshot.match`,
          `snapshot match "${field.snapshot.match}" is not on the ${inSubtable ? "current line layer" : "current header layer"}. It must point at a ref / refLine field on the same layer`,
        );
      } else if (match.type !== "ref" && match.type !== "refLine") {
        add(
          "SNAPSHOT_MATCH_NOT_REF",
          `${path}.snapshot.match`,
          `snapshot match "${match.key}" is ${match.type}. It must be a ref / refLine reference`,
        );
      } else {
        const expectedThrough = match.type === "ref" ? null : match.through;
        if (field.snapshot.through !== expectedThrough) {
          add(
            "SNAPSHOT_THROUGH_MISMATCH",
            `${path}.snapshot.through`,
            `snapshot through must match the reference coordinate of match "${match.key}" (expected ${JSON.stringify(expectedThrough)})`,
          );
        }
        if (match.ref !== field.snapshot.from) {
          add(
            "SNAPSHOT_FROM_MISMATCH",
            `${path}.snapshot.from`,
            `snapshot source module "${field.snapshot.from}" must match "${String(match.ref)}", which match "${match.key}" points at`,
          );
        }
        // An ordinary frozen column is notNull on the table-build side (the system writes the value, and the user has no entry point), and the value comes only from the reference
        // that match points at. So that match cell has to pass **two dimensions**. Missing one is a path that blows up only when it reaches PG.
        // Explicit snapshot.optional relaxes only existence, and compiles the target column as nullable:
        //
        //   · **timing** — is there any hop that will evaluate its value (`stage`);
        //   · **existence** — at the moment of evaluation, is a value guaranteed (`guaranteed`).
        //
        // Both dimensions come from the kernel's one `refSupplyOf`, the same copy read by the first hop `refSitesOf`, the second hop
        // `chainedRefSitesOf`, and `snapshotColumnNotNull` on the table-build side.
        // This used to write chain depth as an inline `chainOk` expression (a third implicit assumption),
        // and it recognized only one kind of late arrival, "match is itself a snapshot". The companion-ref kind fell in the gap:
        // the declaration was all green, and save was a 500 (document number / business date on an accounts-payable reconciliation line).
        //
        // The way out is not to make the column nullable: that would make "a frozen column may be empty" a legal shape,
        // and an inventory row with an empty unit is exactly what this discipline exists to eliminate.
        const supply = refSupplyOf(match, siblings);
        if (supply === null) {
          schemaFail(`${path}.snapshot.match: "${match.key}" is ${match.type}, and this point should already have judged it to be ref / refLine`);
        } else if (supply.stage === "unreachable") {
          add(
            "SNAPSHOT_MATCH_UNRESOLVED",
            `${path}.snapshot.match`,
            `no hop will ever evaluate the value of snapshot match "${match.key}": ${supply.why}. ` +
              `This is not "the reference may be left unchosen". Even a declared reference can never be resolved. ` +
              `If the column is notNull, save becomes a 500. If the column is nullable, a wrong empty value is left in silence. ` +
              `${unresolvedRemedy(supply.via, match)}`,
          );
        } else if (!supply.guaranteed && field.snapshot.optional !== true) {
          add(
            "SNAPSHOT_MATCH_OPTIONAL",
            `${path}.snapshot.match`,
            `snapshot match "${match.key}" does not guarantee a value: ${supply.why}. ` +
              `The frozen column is notNull on the table-build side. When the reference is left empty there is no source, and it hits PG not-null and becomes a 500. ` +
              `${optionalRemedy(supply.via, match)}. If the business allows leaving the source unchosen, declare snapshot.optional: true explicitly. ` +
                `Otherwise remove this field's snapshot`,
          );
        }
      }
    }
    if (field.refDefault) {
      const match = siblings.find((candidate) => candidate.key === field.refDefault?.match);
      if (!match) {
        add(
          "REF_DEFAULT_MATCH_UNKNOWN",
          `${path}.refDefault.match`,
          `refDefault match "${field.refDefault.match}" is not on the ${inSubtable ? "current line layer" : "current header layer"}. It must point at a ref / refLine field on the same layer`,
        );
      } else if (match.type !== "ref" && match.type !== "refLine") {
        add(
          "REF_DEFAULT_MATCH_NOT_REF",
          `${path}.refDefault.match`,
          `refDefault match "${match.key}" is ${match.type}. It must be a ref / refLine reference`,
        );
      } else {
        const expectedThrough = match.type === "ref" ? null : match.through;
        if (field.refDefault.through !== expectedThrough) {
          add(
            "REF_DEFAULT_THROUGH_MISMATCH",
            `${path}.refDefault.through`,
            `refDefault through must match the reference coordinate of match "${match.key}" (expected ${JSON.stringify(expectedThrough)})`,
          );
        }
        if (match.ref !== field.refDefault.from) {
          add(
            "REF_DEFAULT_FROM_MISMATCH",
            `${path}.refDefault.from`,
            `refDefault source module "${field.refDefault.from}" must match "${String(match.ref)}", which match "${match.key}" points at`,
          );
        }
      }
    }
    if (field.defaultFrom) {
      if (!inSubtable) {
        add(
          "DEFAULT_FROM_NOT_LINE",
          `${path}.defaultFrom`,
          "defaultFrom can only hang on a line column",
        );
      } else {
        const source = module.fields.find((candidate) => candidate.key === field.defaultFrom?.header);
        if (source === undefined) {
          add(
            "DEFAULT_FROM_HEADER_UNKNOWN",
            `${path}.defaultFrom.header`,
            `defaultFrom header field "${field.defaultFrom.header}" does not exist`,
          );
        } else if (source.type !== field.type) {
          add(
            "DEFAULT_FROM_TYPE_MISMATCH",
            `${path}.defaultFrom.header`,
            `defaultFrom header "${source.key}" is ${source.type}, which does not match this column's ${field.type}`,
          );
        }
      }
    }
    if (field.refPreselect) {
      // There is only one definition of the candidate set, and `refFilter` is that definition. Without it, "the only one" is counted across the **whole tenant**:
      // on the days when the tenant happens to have exactly one default version, this cell auto-fills a BOM of **some other product**.
      // It is completely legal, and it really can be picked in the dropdown — what is wrong is that it has nothing to do with this line, and nowhere reports it.
      // Wanting "the tenant-wide default" (a default warehouse, for example) still has to be written out: `refFilter: { status: "active" }`.
      // That is an explicit declaration, not an omission.
      if (field.refFilter === null) {
        add(
          "REF_PRESELECT_WITHOUT_FILTER",
          `${path}.refPreselect`,
          "refPreselect was declared without refFilter. The default selection can be picked only inside **this cell's candidate set**, " +
            "and the candidate set is bounded by refFilter. Without it, the only one is counted across the whole tenant: " +
            "when early data happens to contain exactly one record, an unrelated record is filled in automatically, with zero errors. " +
            "A tenant-wide scope must be written explicitly (for example refFilter: { status: \"active\" })",
        );
      } else {
        for (const key of Object.keys(field.refPreselect)) {
          if (!Object.hasOwn(field.refFilter, key)) continue;
          // Two places each give a condition on the same column. ANDed, they are either redundant or always empty. The always-empty half is the worst:
          // "nothing can be picked" and "this batch of data really has no default version" look identical on the screen
          add(
            "REF_PRESELECT_KEY_SHADOWS_FILTER",
            `${path}.refPreselect.${key}`,
            `"${key}" already has a condition on refFilter. The two places each judge the same column once. ` +
              `ANDed, they are either redundant or always empty (always empty shows up as "a default can never be chosen", which cannot be told apart from "the data really has none"). ` +
              `Narrow the candidates in refFilter, and pick the default row in refPreselect. The same column must not be written on both sides`,
          );
        }
      }
    }
    if (field.refPreselectSole) {
      // Same reason as REF_PRESELECT_WITHOUT_FILTER: the candidate set has only the one `refFilter` copy.
      // Without it, "the only candidate" is counted across the **whole tenant** — when early data happens to contain exactly one record,
      // an unrelated record is filled in automatically, with zero errors.
      if (field.refFilter === null) {
        add(
          "REF_PRESELECT_SOLE_WITHOUT_FILTER",
          `${path}.refPreselectSole`,
          "refPreselectSole was declared without refFilter. Auto-fill when the candidate is unique can be counted only inside **this cell's candidate set**, " +
            "and the candidate set is bounded by refFilter. Without it, the only one is counted across the whole tenant: " +
            "when early data happens to contain exactly one record, an unrelated record is filled in automatically, with zero errors",
        );
      }
    }
    if (field.auto && inSubtable) {
      add("FIELD_AUTO_ON_LINE", path, "auto can only hang on the header. A line has no independent document-number identity");
    }
    if (isLineAggregated(field) && inSubtable) {
      // Lines have only one level (`normalizeField`'s allowSubtable), so there is no row set under a line that can be totaled.
      // Letting it through grows a column that is forever 0
      add("LINE_AGG_ON_LINE", path, "lineAgg can only hang on the header. There is no second level of lines under a line to total");
    }
    if (field.unique) checkUnique(field, path, inSubtable, add);
    checkStatusWritePolicies(module, field, path, inSubtable, add);
    if (field.createDefaultBy !== null && field.createDefaultBy !== undefined) {
      const source = siblings.find((candidate) => candidate.key === field.createDefaultBy?.field);
      if (source === undefined) {
        add(
          "FIELD_CREATE_DEFAULT_BY_SOURCE_UNKNOWN",
          `${path}.createDefaultBy.field`,
          `the classified default references a field that does not exist on the same layer: "${field.createDefaultBy.field}"`,
        );
      } else if (source.type !== "enum" || source.options === null) {
        add(
          "FIELD_CREATE_DEFAULT_BY_SOURCE_TYPE",
          `${path}.createDefaultBy.field`,
          `the source of the classified default "${source.key}" must be a code-closed enum field`,
        );
      } else {
        const declared = new Set(Object.keys(field.createDefaultBy.values));
        const missing = source.options.filter((option) => !declared.has(option.value)).map((option) => option.value);
        const extra = [...declared].filter((option) => !hasEnumOption(source.options, option));
        if (missing.length > 0 || extra.length > 0) {
          add(
            "FIELD_CREATE_DEFAULT_BY_NOT_CLOSED",
            `${path}.createDefaultBy.values`,
            `the default map must cover every option of "${source.key}". Missing: ${missing.join(", ") || "none"}. Extra: ${extra.join(", ") || "none"}`,
          );
        }
      }
    }
    checkHiddenAndManualCreate(module, field, path, inSubtable, add);
    if (field.headerEmptyFill === true && !inSubtable) {
      add(
        "HEADER_EMPTY_FILL_ON_HEADER",
        `${path}.headerEmptyFill`,
        "headerEmptyFill can only hang on a line ref. A header has no such thing as filling an empty table with rows",
      );
    }
  };

  for (const field of module.fields) {
    checkField(field, `fields.${field.key}`, false, module.fields);
    if (field.fields) {
      for (const sub of field.fields) {
        checkField(sub, `fields.${field.key}.fields.${sub.key}`, true, field.fields);
      }
    }
  }

  for (const table of module.fields) {
    if (table.type !== "subtable" || table.fields === null) continue;
    const fillCols = table.fields.filter((column) => column.headerEmptyFill === true);
    if (fillCols.length > 1) {
      add(
        "HEADER_EMPTY_FILL_MULTIPLE",
        `fields.${table.key}`,
        `line table "${table.key}" declares ${String(fillCols.length)} headerEmptyFill columns (${fillCols.map((column) => column.key).join(", ")}). ` +
          `A table can have only one column that decides what this row is. Several columns lay out two sets of rows that overwrite each other`,
      );
    }
    for (const column of fillCols) {
      const path = `fields.${table.key}.fields.${column.key}.headerEmptyFill`;
      if (column.refFilter === null) {
        add(
          "HEADER_EMPTY_FILL_WITHOUT_FILTER",
          path,
          "headerEmptyFill was declared without refFilter. Filling rows can use only this column's candidate set. " +
            "Without it, the whole tenant is poured into the draft",
        );
        continue;
      }
      const operands = refFilterOperands(column.refFilter);
      if (operands.some((operand) => operand.scope === "line")) {
        add(
          "HEADER_EMPTY_FILL_LINE_OPERAND",
          path,
          "the refFilter of headerEmptyFill cannot contain a $line. operand. An empty table has no rows yet, so there is nothing to read per row",
        );
      }
      if (!operands.some((operand) => operand.scope === "bill")) {
        add(
          "HEADER_EMPTY_FILL_NO_BILL_OPERAND",
          path,
          "the refFilter of headerEmptyFill must contain a $bill. operand. Otherwise filling the header lays out the static full set",
        );
      }
      if (maxRowsOf(table) === 1) {
        add(
          "HEADER_EMPTY_FILL_MAX_ROWS_ONE",
          path,
          "a line table with maxRows: 1 cannot use headerEmptyFill. It already starts with one row, and laying out candidates necessarily exceeds the limit",
        );
      }
      if (refLinePairs(table.fields).some((pair) => pair.line.required)) {
        add(
          "HEADER_EMPTY_FILL_REQUIRED_REFLINE",
          path,
          "a line table with a required refLine cannot use headerEmptyFill. The laid-out rows lack the upstream line coordinate, and save is necessarily rejected",
        );
      }
      if (isSystemSupplied(column, table.fields)) {
        add(
          "HEADER_EMPTY_FILL_SYSTEM_SUPPLIED",
          path,
          "a system-supplied column cannot use headerEmptyFill. The user has no way to change these rows, so laying them in decides for the user and cannot be undone",
        );
      }
    }
  }

  // Platform fields can be referenced by views and rules. They just cannot be declared.
  //
  // Which platform fields may enter the business UI is one tier narrower than which platform fields exist:
  // the user-visible ones are only `PLATFORM_QUERY_FIELDS` (status plus four audit fields),
  // while `id` / `tenantId` / `orgId` are **pipes**. Putting them in list columns, filters, or search
  // puts the isolation axis on the business screen, and the user cannot permanently remove them through column settings (they are in defaults).
  // The rule side is not under this limit: `$bill.orgId` is a legal business criterion.
  const known = (key: string): boolean => fields.has(key) || isPlatformField(key);
  const visible = new Set<string>(PLATFORM_QUERY_FIELDS.map((p) => p.key));
  const pipeOnly = (key: string): boolean => isPlatformField(key) && !visible.has(key) && !fields.has(key);

  const checkRefs = (keys: readonly string[], path: string, code: string): void => {
    for (const key of keys) {
      if (!known(key)) add(code, path, `references a field that does not exist: "${key}"`);
    }
  };

  /** On the view side: besides whether it exists, also judge whether the user should see it */
  const checkViewRefs = (keys: readonly string[], path: string): void => {
    checkRefs(keys, path, "VIEW_FIELD_UNKNOWN");
    for (const key of keys) {
      if (!pipeOnly(key)) continue;
      add(
        "VIEW_FIELD_PLATFORM_PIPE",
        path,
        `"${key}" is a pipe field (id / tenantId / orgId) and does not enter the business UI. ` +
          `The only user-visible platform fields are ${PLATFORM_QUERY_FIELDS.map((f) => f.key).join(", ")}. ` +
          `Seeing data by organization is the isolation axis, not a list column`,
      );
    }
  };

  checkViewRefs(module.views.list.columns, "views.list.columns");
  checkViewRefs(module.views.list.referenceLabel ?? [], "views.list.referenceLabel");
  for (const key of module.views.list.referenceLabel ?? []) {
    const field = fields.get(key);
    if (field === undefined || isPlatformField(key)) continue;
    if (
      field.type === "subtable" ||
      field.type === "attachment" ||
      field.type === "ref" ||
      field.type === "refLine" ||
      isNumericFieldType(field.type)
    ) {
      add(
        "VIEW_REFERENCE_LABEL_UNREADABLE",
        "views.list.referenceLabel",
        `the value of "${key}" cannot name a record directly. Choose a readable text field such as a code, a name, or a specification`,
      );
    }
  }
  checkViewRefs(module.views.list.filters, "views.list.filters");
  checkViewRefs(module.views.list.searchable, "views.list.searchable");
  if (module.views.list.defaultSort) {
    checkViewRefs([module.views.list.defaultSort.field], "views.list.defaultSort");
  }
  module.views.form.forEach((group, i) => {
    checkViewRefs(group.fields, `views.form[${i}].fields`);
  });
  const viewStatuses = new Set(module.lifecycle.statuses.map((status) => status.key));
  module.views.workbenches.forEach((workbench, i) => {
    workbench.statuses.forEach((status, j) => {
      if (!viewStatuses.has(status)) {
        add(
          "VIEW_WORKBENCH_STATUS_UNKNOWN",
          `views.workbenches[${i}].statuses[${j}]`,
          `workbench "${workbench.label}" references a status that does not exist: "${status}"`,
        );
      }
    });
  });
  module.views.createFrom.forEach((entry, i) => {
    const at = `views.createFrom[${i}].path`;
    const parts = entry.path.split(".");
    if (parts.length === 1) {
      // A header createFrom has no server prepare. Remaining quantity (sourceRemaining) must be computed per line on the server.
      // A header entry cannot provide it, and declaring it would be bypassed in silence — keep it forbidden.
      // sourceStatuses is only a **frontend display threshold**: the list hides buttons by line status (ListPage already filters by flow.sourceStatuses).
      // It does not enter the server eligibility sites (createFromEligibilitySitesOf builds sites only for line flows). A real write
      // constraint needs a separate refFilter or a precondition on the target edge — sourceStatuses on this entry does not enforce anything on the server.
      if (entry.sourceRemaining !== null) {
        add(
          "VIEW_CREATE_FROM_HEADER_ELIGIBILITY_UNSUPPORTED",
          `views.createFrom[${i}]`,
          "a header createFrom does not accept sourceRemaining. A header entry has no server prepare, so remaining-quantity meaning has nowhere to be computed. " +
            "A document conversion with a balance meaning should use a line refLine create flow",
        );
      }
      const field = fields.get(parts[0] ?? "");
      if (field === undefined) {
        add(
          "VIEW_CREATE_FROM_FIELD_UNKNOWN",
          at,
          `source coordinate "${entry.path}" is not a header field of this module`,
        );
      } else if (field.type !== "ref") {
        add(
          "VIEW_CREATE_FROM_HEADER_NOT_REF",
          at,
          `source coordinate "${entry.path}" is ${field.type}. A header entry must point at a ref field. ` +
            `The source module is derived only from that field's ref, and is not guessed from the name`,
        );
      }
      return;
    }
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      add(
        "VIEW_CREATE_FROM_PATH_INVALID",
        at,
        `source coordinate "${entry.path}" accepts only a header field, or a two-part path "line table.refLine column"`,
      );
      return;
    }
    const table = fields.get(parts[0]);
    if (table === undefined) {
      add(
        "VIEW_CREATE_FROM_TABLE_UNKNOWN",
        at,
        `source coordinate "${entry.path}" points at a line table that does not exist: "${parts[0]}"`,
      );
      return;
    }
    if (table.type !== "subtable") {
      add(
        "VIEW_CREATE_FROM_TABLE_NOT_SUBTABLE",
        at,
        `the first segment "${parts[0]}" of source coordinate "${entry.path}" is ${table.type}, not a line table`,
      );
      return;
    }
    const line = (table.fields ?? []).find((field) => field.key === parts[1]);
    if (line === undefined) {
      add(
        "VIEW_CREATE_FROM_LINE_UNKNOWN",
        at,
        `line table "${parts[0]}" has no source column "${parts[1]}"`,
      );
    } else if (line.type !== "refLine") {
      add(
        "VIEW_CREATE_FROM_LINE_NOT_REF_LINE",
        at,
        `source coordinate "${entry.path}" is ${line.type}. A line entry must point at refLine. ` +
          `An ordinary ref points at a header and cannot stand for the source line the user checked`,
      );
    }
  });
  if (module.views.hierarchy !== null) {
    const hierarchy = module.views.hierarchy;
    checkViewRefs([hierarchy.parent, hierarchy.level, hierarchy.label], "views.hierarchy");
    const parent = fields.get(hierarchy.parent);
    const level = fields.get(hierarchy.level);
    const label = fields.get(hierarchy.label);
    if (parent !== undefined && (parent.type !== "ref" || parent.ref !== module.code)) {
      add(
        "VIEW_HIERARCHY_PARENT_NOT_SELF_REF",
        "views.hierarchy.parent",
        `"${hierarchy.parent}" must be a ref pointing at this module "${module.code}". The hierarchy tree only projects an existing direct parent-child relation`,
      );
    }
    if (
      level !== undefined &&
      (level.type !== "enum" ||
        ((level.options === null || level.options.length < 2) && level.choiceSet === null))
    ) {
      add(
        "VIEW_HIERARCHY_LEVEL_NOT_ENUM",
        "views.hierarchy.level",
        `"${hierarchy.level}" must be an enum or choiceSet with at least two options. Enum order is the tree's fixed level order`,
      );
    }
    if (label !== undefined && label.type !== "string") {
      add(
        "VIEW_HIERARCHY_LABEL_NOT_TEXT",
        "views.hierarchy.label",
        `"${hierarchy.label}" must be string. A tree node needs a stable human name`,
      );
    }
    if (new Set([hierarchy.parent, hierarchy.level, hierarchy.label]).size !== 3) {
      add(
        "VIEW_HIERARCHY_FIELDS_OVERLAP",
        "views.hierarchy",
        "parent / level / label must be three different fields. One cell cannot express parent, level, and name at once",
      );
    }
    const listed = new Set(module.views.list.columns);
    for (const key of [hierarchy.parent, hierarchy.level, hierarchy.label]) {
      if (!listed.has(key)) {
        add(
          "VIEW_HIERARCHY_FIELD_NOT_LISTED",
          "views.hierarchy",
          `hierarchy field "${key}" must also appear in views.list.columns. The hierarchy view reuses the list query and does not open a wider field projection`,
        );
      }
    }
  }

  // The three coordinates of the availability panel.
  //
  // The criterion is the warehouse-dimensioned inventory ledger already in the loaded catalog — the same catalog the effects gate and the renderer
  // use to derive coordinates. Writing the subject / scope again here would be a second source of truth,
  // and the drift shows up as "modeling time lets it through, and the panel returns a cross-warehouse total".
  //
  // Everything is checked at **build time**: a mistake has to go red in `yarn test`. Left until runtime,
  // the first time that form opens the whole right rail is gone — and "this module never had this panel"
  // looks identical to "the coordinate was written wrong".
  if (module.views.availability !== null) {
    const availability = module.views.availability;
    const stock = inventoryLedgerDefinition();
    checkViewRefs([availability.scopeField, availability.lines], "views.availability");
    const scopeField = fields.get(availability.scopeField);
    const lines = fields.get(availability.lines);
    if (scopeField !== undefined && (scopeField.type !== "ref" || scopeField.ref !== stock.scope)) {
      add(
        "VIEW_AVAILABILITY_SCOPE_NOT_REF",
        "views.availability.scopeField",
        `"${availability.scopeField}" must be a ref pointing at ${stock.scope}. An inventory balance is "how much is left in a given warehouse". ` +
          `A wrong coordinate produces a cross-warehouse total: the number looks completely normal, and it does not answer whether this bill should proceed`,
      );
    }
    if (lines !== undefined && lines.type !== "subtable") {
      add(
        "VIEW_AVAILABILITY_LINES_NOT_SUBTABLE",
        "views.availability.lines",
        `"${availability.lines}" must be a line table (subtable). The panel reports, row by row, how much of this line's goods is left`,
      );
    }
    if (lines !== undefined && lines.type === "subtable") {
      const subjectField = (lines.fields ?? []).find((column) => column.key === availability.subjectField);
      if (subjectField === undefined) {
        add(
          "VIEW_AVAILABILITY_SUBJECT_UNKNOWN",
          "views.availability.subjectField",
          `line table "${availability.lines}" has no column "${availability.subjectField}"`,
        );
      } else if (subjectField.type !== "ref" || subjectField.ref !== stock.subject) {
        add(
          "VIEW_AVAILABILITY_SUBJECT_NOT_REF",
          "views.availability.subjectField",
          `"${availability.lines}.${availability.subjectField}" must be a ref pointing at ${stock.subject}. The inventory ledger is kept on the product`,
        );
      }
    }
  }

  // The nine coordinates of the multi-level explosion panel.
  //
  // Everything is checked at **build time**, for the same reason as the block above, except the consequence is more expensive: the reader of this panel
  // is someone who wants to see the whole tree before releasing. A wrong coordinate shows a tree of only one level (which looks like
  // "this product's structure really is that simple"), or a tree multiplied in the entered unit —
  // the numbers have values, decimals, and a sortable order, and they are all wrong.
  if (module.views.explosion !== null) {
    const explosion = module.views.explosion;
    checkViewRefs([explosion.entity, explosion.lines], "views.explosion");
    const entity = fields.get(explosion.entity);
    const lines = fields.get(explosion.lines);
    if (entity !== undefined && (entity.type !== "ref" || entity.ref === null)) {
      add(
        "VIEW_EXPLOSION_ENTITY_NOT_REF",
        "views.explosion.entity",
        `"${explosion.entity}" must be a ref on the header. Recursion depends on the chain "this row's component entity has another record of this module pointing at it"`,
      );
    }
    if (lines !== undefined && lines.type !== "subtable") {
      add(
        "VIEW_EXPLOSION_LINES_NOT_SUBTABLE",
        "views.explosion.lines",
        `"${explosion.lines}" must be a line table (subtable). Components live on line rows`,
      );
    }
    if (lines !== undefined && lines.type === "subtable") {
      const columns = lines.fields ?? [];
      const columnOf = (key: string, at: string): Field | undefined => {
        const hit = columns.find((column) => column.key === key);
        if (hit === undefined) {
          add("VIEW_EXPLOSION_COLUMN_UNKNOWN", at, `line table "${explosion.lines}" has no column "${key}"`);
        }
        return hit;
      };
      const component = columnOf(explosion.component, "views.explosion.component");
      if (component !== undefined && (component.type !== "ref" || component.ref === null)) {
        add(
          "VIEW_EXPLOSION_COMPONENT_NOT_REF",
          "views.explosion.component",
          `"${explosion.lines}.${explosion.component}" must be a ref. It points at this row's component entity`,
        );
      } else if (component !== undefined && entity !== undefined && entity.type === "ref") {
        if (component.ref !== entity.ref) {
          add(
            "VIEW_EXPLOSION_COMPONENT_ENTITY_MISMATCH",
            "views.explosion.component",
            `the component column points at "${String(component.ref)}" while the header entity points at "${String(entity.ref)}". ` +
              `Both sides must share the target, or the chain "the component itself also has a record of this module" cannot connect, ` +
              `and the tree is forever only one level`,
          );
        }
      }
      if (explosion.childBom !== null) {
        const childBom = columnOf(explosion.childBom, "views.explosion.childBom");
        if (childBom !== undefined && (childBom.type !== "ref" || childBom.ref !== module.code)) {
          add(
            "VIEW_EXPLOSION_CHILD_BOM_NOT_REF",
            "views.explosion.childBom",
            `"${explosion.lines}.${explosion.childBom}" must be an optional ref pointing at this module "${module.code}". ` +
              "An explicit version is only for pinning a child BOM to one record",
          );
        }
      }
      for (const [key, at] of [
        [explosion.qty, "views.explosion.qty"],
        [explosion.loss, "views.explosion.loss"],
      ] as const) {
        const column = columnOf(key, at);
        if (column !== undefined && !isNumericFieldType(column.type)) {
          add(
            "VIEW_EXPLOSION_MEASURE_NOT_NUMERIC",
            at,
            `"${explosion.lines}.${key}" is ${column.type}. Quantity and scrap must be numeric. Multiplying level by level needs a number, not a label`,
          );
        }
        if (column !== undefined && key === explosion.qty && column.type !== "number" && column.type !== "money") {
          add(
            "VIEW_EXPLOSION_QTY_NOT_QUANTITY",
            at,
            `"${explosion.lines}.${key}" must be number or money. Quantity is a count, and percent is not accepted as a quantity coordinate`,
          );
        }
        if (column !== undefined && key === explosion.loss && column.type !== "percent") {
          add(
            "VIEW_EXPLOSION_LOSS_NOT_PERCENT",
            at,
            `"${explosion.lines}.${key}" must be percent. A scrap rate cannot be expressed as an ordinary quantity or amount`,
          );
        }
        // A derived column must not be a quantity: explosion happens at the moment of release, and derive is a value computed only at query time.
        // Multiplying by it writes a number that can be recomputed at any moment into a material-issue bill that has already been sent out
        if (column !== undefined && isDerived(column)) {
          add(
            "VIEW_EXPLOSION_MEASURE_DERIVED",
            at,
            `"${explosion.lines}.${key}" is a derived column (not stored, computed at query time). The exploded quantity would change with downstream data, ` +
              `while a material-issue bill is a fact that has already been sent out`,
          );
        }
      }
      if (explosion.stop !== null) {
        const stop = columnOf(explosion.stop, "views.explosion.stop");
        if (stop !== undefined && stop.type !== "bool") {
          add(
            "VIEW_EXPLOSION_STOP_NOT_BOOL",
            "views.explosion.stop",
            `"${explosion.lines}.${explosion.stop}" must be bool. It only answers whether this row drills further`,
          );
        }
      }
    }
    if (!module.lifecycle.statuses.some((status) => status.key === explosion.activeStatus)) {
      add(
        "VIEW_EXPLOSION_ACTIVE_STATUS_UNKNOWN",
        "views.explosion.activeStatus",
        `"${explosion.activeStatus}" is not a status this module declared. Written wrong, every level says there is no effective child, ` +
          `and that sentence looks identical on the screen to "this component is already a leaf material"`,
      );
    }
    if (explosion.preferred !== null) {
      checkViewRefs([explosion.preferred], "views.explosion.preferred");
      const preferred = fields.get(explosion.preferred);
      if (preferred !== undefined && preferred.type !== "bool") {
        add(
          "VIEW_EXPLOSION_PREFERRED_NOT_BOOL",
          "views.explosion.preferred",
          `"${explosion.preferred}" must be a bool on the header. It is the sort key for which record to take when one entity has several effective records`,
        );
      }
    }
    if (explosion.label !== null) {
      checkViewRefs([explosion.label], "views.explosion.label");
      const label = fields.get(explosion.label);
      if (label !== undefined && (label.type === "subtable" || isDerived(label))) {
        add(
          "VIEW_EXPLOSION_LABEL_NOT_STORED",
          "views.explosion.label",
          `"${explosion.label}" must be a stored scalar on the header. The tree uses it to name which record each level uses`,
        );
      }
    }
  }

  for (const status of module.lifecycle.statuses) {
    if (status.editableFields) {
      checkRefs(status.editableFields, `lifecycle.statuses.${status.key}.editableFields`, "STATUS_FIELD_UNKNOWN");
      const supplied = status.editableFields.filter((k) => {
        const f = fields.get(k);
        return f !== undefined && isSystemSupplied(f);
      });
      if (supplied.length) {
        add(
          "STATUS_FIELD_SYSTEM_SUPPLIED",
          `lifecycle.statuses.${status.key}.editableFields`,
          `"${supplied.join(", ")}" is computed by the system. Putting it on the allow-list still cannot change it`,
        );
      }
    }
  }

}

/**
 * Primary button: on the same `from`, at most one primary has no when. Edges that all have a when may all be marked primary
 * (meaning: if this edge is visible, it is the primary button). An unconditional primary and a primary that has a when cannot coexist.
 */
function checkPrimaryButtons(module: ModuleSchema, add: Add): void {
  const coord = coordChecker(module, add);
  const byStatus = new Map<string, typeof module.lifecycle.transitions[number][]>();
  for (const edge of module.lifecycle.transitions) {
    if (edge.when) {
      auditCheck(
        module,
        edge.when,
        `lifecycle.transitions.${edge.code}.when`,
        edge.code,
        `lifecycle.transitions.${edge.code}`,
        coord,
        add,
      );
    }
    if (!edge.primary) continue;
    const list = byStatus.get(edge.from) ?? [];
    list.push(edge);
    byStatus.set(edge.from, list);
  }
  for (const [status, edges] of byStatus) {
    const unconditional = edges.filter((edge) => edge.when == null);
    const conditional = edges.filter((edge) => edge.when != null);
    if (unconditional.length > 1) {
      add(
        "TRANSITION_MULTI_PRIMARY",
        `lifecycle.transitions`,
        `status "${status}" has ${unconditional.length} edges marked primary (${unconditional.map((edge) => edge.code).join(", ")}). There can be only one primary button`,
      );
    }
    if (unconditional.length > 0 && conditional.length > 0) {
      add(
        "TRANSITION_CONDITIONAL_PRIMARY_MIXED",
        `lifecycle.transitions`,
        `under status "${status}", the unconditional primary button (${unconditional.map((edge) => edge.code).join(", ")}) ` +
          `cannot coexist with a conditional primary button (${conditional.map((edge) => edge.code).join(", ")}): ` +
          `the unconditional primary button already occupies this status, so a conditional edge can only be a secondary action even when it is visible`,
      );
    }
  }
}

/**
 * Run every semantic gate. **A pure function, zero IO** — `yarn test` runs it offline on an FDE laptop from this.
 */
/**
 * Gate for line-level references: by default each target module must have exactly one `refLine + ref` pair on the same row.
 * When the same target really has several refs, the refLine names its companion column explicitly with `refOwner`.
 *
 * `refLine` is the only business input. `ref` is a stored companion column kept so downstream can be looked up in reverse. When storage checks
 * whether the `refLine` exists it already has to join back to the upstream header, so it takes `bill_id` from that same query
 * and writes the companion column. That adds no extra round trip, and there is no question of which of two client-sent values to trust.
 *
 * Why the companion column still has to be declared: a merged outbound shipment pushes "which order" from the header down onto the line, and looking downstream up
 * (the block on the order detail page that says which outbound bills) can compare only a **bill id**
 * (`isReverseQueryable`). Without this column the related-documents panel is silently empty.
 *
 * Why each target can have only one pair: when pairing automatically by `ref` target alone, two `refLine`s of the same target
 * or two `ref`s of the same target have no basis for who goes with whom. Taking the first one writes the source bill id into the wrong column,
 * and that is a legal id, so nothing reports it later. A real business shape like that should extend the pairing syntax explicitly first.
 *
 * The `where` of a line-level rollup references fields of the **downstream header** (a line has no state machine). That is not checked here:
 * this function can see only one module, and is structurally blind to which fields a downstream module has. The loader's
 * `checkCrossReferences` (`layerOf`) catches it.
 */
function checkLineReferences(module: ModuleSchema, add: Add): void {
  for (const table of module.fields) {
    if (table.type !== "subtable" || !table.fields) continue;
    const targets = new Set(table.fields.filter((field) => field.type === "refLine").map((field) => field.ref));
    const claimedOwners = new Map<string, string>();
    for (const target of targets) {
      const lines = table.fields.filter((field) => field.type === "refLine" && field.ref === target);
      const bills = table.fields.filter((field) => field.type === "ref" && field.ref === target);
      const line = lines[0];
      const path = `fields.${table.key}.fields.${line?.key ?? "?"}`;
      if (bills.length === 0) {
        add(
          "REF_LINE_NO_BILL_PARTNER",
          path,
          `a line-level reference points at a line of "${String(target)}", but the same row has no ref companion column pointing at its header. ` +
            `The companion column is written by storage from the refLine's owning relation, and the caller does not fill it. It must still exist, ` +
            `or the other side's detail page cannot look related documents up by bill id`,
        );
      }
      for (const candidate of lines) {
        const candidatePath = `fields.${table.key}.fields.${candidate.key}`;
        const owner = candidate.refOwner ?? null;
        if (owner === null) {
          if (lines.length > 1 || bills.length > 1) {
            add(
              "REF_LINE_BILL_PARTNER_AMBIGUOUS",
              candidatePath,
              `the same row has ${String(lines.length)} refLine fields and ${String(bills.length)} ref fields pointing at "${String(target)}". ` +
                `They cannot be paired automatically. Name the companion header ref field explicitly in refLine.refOwner`,
            );
          }
          continue;
        }
        const ownerField = table.fields.find((field) => field.key === owner);
        if (ownerField?.type !== "ref" || ownerField.ref !== target) {
          add(
            "REF_LINE_OWNER_INVALID",
            `${candidatePath}.refOwner`,
            `refOwner "${owner}" must be a ref field on the same row pointing at "${String(target)}"`,
          );
          continue;
        }
        const previous = claimedOwners.get(owner);
        if (previous !== undefined) {
          add(
            "REF_LINE_OWNER_DUPLICATE",
            `${candidatePath}.refOwner`,
            `companion ref "${owner}" is already used by refLine "${previous}", and cannot belong to two line-level references at once`,
          );
        } else {
          claimedOwners.set(owner, candidate.key);
        }
      }
    }
  }
}

/** Unit-set and unit-choice constraints that can be judged inside this module. Cross-module sources are judged separately by validateUnitChoiceSources. */
function checkUnits(module: ModuleSchema, add: Add): void {
  if (module.unitSet !== null) {
    const entries = [
      ["main", module.unitSet.main],
      ["auxiliary", module.unitSet.auxiliary],
      ["conversionRate", module.unitSet.conversionRate],
    ] as const;
    if (new Set(entries.map(([, key]) => key)).size !== entries.length) {
      add("UNIT_SET_FIELDS_OVERLAP", "unitSet", "main, auxiliary, and conversionRate must point at three different header fields");
    }
    for (const [role, key] of entries) {
      const field = module.fields.find((candidate) => candidate.key === key);
      if (!field) {
        add("UNIT_SET_FIELD_UNKNOWN", `unitSet.${role}`, `unitSet.${role} points at a header field that does not exist: "${key}"`);
      } else if (role === "conversionRate" && field.type !== "number") {
        add("UNIT_SET_RATE_NOT_NUMBER", `unitSet.${role}`, `conversion-rate field "${key}" must be number, but it is ${field.type}`);
      } else if (role !== "conversionRate" && field.type !== "string" && field.type !== "enum") {
        add("UNIT_SET_VALUE_NOT_UNIT", `unitSet.${role}`, `unit field "${key}" must be string / enum, but it is ${field.type}`);
      } else if (!hasColumn(field)) {
        add("UNIT_SET_FIELD_NOT_STORED", `unitSet.${role}`, `unitSet source field "${key}" must be stored as a column, and cannot be a field derived at query time`);
      }
    }
    const main = module.fields.find((field) => field.key === module.unitSet?.main);
    const auxiliary = module.fields.find((field) => field.key === module.unitSet?.auxiliary);
    const rate = module.fields.find((field) => field.key === module.unitSet?.conversionRate);
    if (main && !main.required) {
      add("UNIT_SET_MAIN_OPTIONAL", "unitSet.main", `main-unit field "${main.key}" must be required. A product with no main unit has no usable unit`);
    }
    if (auxiliary && rate && auxiliary.required !== rate.required) {
      add(
        "UNIT_SET_AUX_RATE_REQUIRED_MISMATCH",
        "unitSet",
        `auxiliary unit "${auxiliary.key}" and conversion rate "${rate.key}" must both be required or both be optional, so a half pair is not stored`,
      );
    }
  }

  const checkLayer = (fields: readonly Field[], path: string): void => {
    const factors = new Map<string, string>();
    for (const field of fields) {
      if (field.unitChoice === null) continue;
      const choice = field.unitChoice;
      const at = `${path}.${field.key}.unitChoice`;
      if (field.type !== "enum") {
        add(
          "UNIT_CHOICE_NOT_ENUM",
          at,
          `unit field "${field.key}" must be enum. Dynamic main and auxiliary choices need to render as a select, and string degrades to free text`,
        );
      }
      if (!field.required) {
        add(
          "UNIT_CHOICE_REQUIRED",
          at,
          `unit field "${field.key}" must be required. unitChoice can fill the default main unit after resolving the product, but the final business fact cannot lack a unit`,
        );
      }
      const match = fields.find((candidate) => candidate.key === choice.match);
      if (!match) {
        add("UNIT_CHOICE_MATCH_UNKNOWN", `${at}.match`, `match "${choice.match}" is not on the current layer`);
      } else if (match.type !== "ref") {
        add("UNIT_CHOICE_MATCH_NOT_REF", `${at}.match`, `match "${match.key}" must be a ref on the same layer, but it is ${match.type}`);
      } else if (refSupplyOf(match, fields)?.guaranteed !== true) {
        add(
          "UNIT_CHOICE_MATCH_OPTIONAL",
          `${at}.match`,
          `match "${match.key}" must guarantee a value. Without a product record the main and auxiliary units cannot be read, and the conversion factor cannot be written. ` +
            `Mark a user-entered ref required, and make sure a system-supplied ref's source chain is reachable and non-null`,
        );
      }
      const factor = fields.find((candidate) => candidate.key === choice.factorInto);
      if (!factor) {
        add("UNIT_CHOICE_FACTOR_UNKNOWN", `${at}.factorInto`, `factorInto "${choice.factorInto}" is not on the current layer`);
      } else if (factor.type !== "number") {
        add("UNIT_CHOICE_FACTOR_NOT_NUMBER", `${at}.factorInto`, `conversion-factor field "${factor.key}" must be number, but it is ${factor.type}`);
      } else if (
        factor.auto ||
        factor.derive !== null ||
        factor.calculate !== null ||
        factor.lineAgg !== null ||
        factor.snapshot !== null ||
        factor.refDefault !== null ||
        factor.pushFrom !== null
      ) {
        add(
          "UNIT_CHOICE_FACTOR_HAS_OTHER_SOURCE",
          `${at}.factorInto`,
          `conversion factor "${factor.key}" can be written only by unitChoice. It must not also declare another supply, default, or push source`,
        );
      }
      if (choice.factorInto === field.key || choice.match === field.key) {
        add("UNIT_CHOICE_SELF_REFERENCE", at, "unitChoice match / factorInto cannot point at the unit field itself");
      }
      const previous = factors.get(choice.factorInto);
      if (previous !== undefined) {
        add(
          "UNIT_CHOICE_FACTOR_AMBIGUOUS",
          `${at}.factorInto`,
          `conversion factor "${choice.factorInto}" is written by both unit field "${previous}" and "${field.key}"`,
        );
      } else {
        factors.set(choice.factorInto, field.key);
      }
    }
  };
  checkLayer(module.fields, "fields");
  for (const table of module.fields) {
    if (table.fields !== null) checkLayer(table.fields, `fields.${table.key}.fields`);
  }
}

export function validateModule(module: ModuleSchema): ValidationReport {
  const errors: ValidationError[] = [];
  const add: Add = (code, path, message) => {
    errors.push({ code, path, message });
  };

  checkStatuses(module, add);
  checkEffects(module, add);
  checkPreconditions(module, add);
  checkHandoff(module, add);
  checkFieldsAndViews(module, add);
  checkUniqueWith(module, add);
  checkFormulas(module, add);
  checkUnits(module, add);
  checkLineAggregates(module, add);
  checkLineReferences(module, add);
  checkPrimaryButtons(module, add);

  return { ok: errors.length === 0, errors };
}

/** Throw when validation does not pass. Used at load time — a module that is ill must not enter the runtime. */
export class ModuleValidationError extends Error {
  override readonly name = "ModuleValidationError";
  readonly report: ValidationReport;
  constructor(code: string, report: ValidationReport) {
    super(
      `module ${code} failed static validation (${report.errors.length} errors):\n` +
        report.errors.map((e) => `  [${e.code}] ${e.path}：${e.message}`).join("\n"),
    );
    this.report = report;
  }
}

export function assertValidModule(module: ModuleSchema): ModuleSchema {
  const report = validateModule(module);
  if (!report.ok) throw new ModuleValidationError(module.code, report);
  return module;
}

/**
 * The only place a module declaration is written. A module file is always `export default defineModule({...})`.
 *
 * Only the **shape** layer runs, and it produces a draft **with no identity**: `code` and `domain` are derived from the file path
 * (file name = module code, directory name = domain code). They cannot be written in the declaration, so there is no second source of truth to drift.
 * The semantic gates run only after the identity is injected (`sealModule`) — they use `code` as a value. See there.
 *
 * The shape gate finishes at **import** time: the seventh-concept allow-list, key closure, and closed enums throw on the spot.
 * The location is `normalizeModule`'s label path string (`module.fields[3].key`), and it does not depend on code.
 */
export function defineModule(input: unknown): ModuleDraft {
  return brandAsDraft(normalizeModule(input));
}

/** A module's identity. The only source is the file path, derived by the loader and then injected. */
export interface ModuleIdentity {
  readonly code: string;
  readonly domain: string;
}

/**
 * Seal — inject the identity derived from the path into the draft, then run the semantic gates, and produce a complete `ModuleSchema`.
 *
 * The order cannot be swapped: the semantic gates use `code` as a value. The error heading uses it to say which module is bad, and the self-reference check
 * (`hierarchy.parent`, and a BOM component must ref back to this module) compares against it. Run the semantic gates first and the heading is empty,
 * and the self-reference check is also always false, so a correctly written module is judged wrong.
 *
 * The identity itself has to pass a gate too: `code` goes through a coordinate segment (a file name `foo-bar.ts` cannot derive a legal code),
 * and `domain` goes through non-empty text. This used to be fulfilled in passing by `requireCoordinateSegment` on the declaration side.
 * After that declaration site was removed it has to be added at the injection point, or a malformed file name silently becomes a malformed module code.
 */
export function sealModule(draft: ModuleDraft, identity: ModuleIdentity): ModuleSchema {
  // Sealing a bare object that bypassed the shape gate means the seventh-concept allow-list and key closure never run. The brand is the only criterion
  if (!isModuleDraft(draft)) {
    schemaFail("what was sealed is not the product of defineModule({...}). An object that did not pass the shape gate must not receive an identity");
  }
  const shape: ModuleShape = draft;
  return assertValidModule({
    ...shape,
    code: requireCoordinateSegment(identity.code, "module.code"),
    domain: requireText(identity.domain, "module.domain"),
  });
}

function brandAsDraft(shape: ModuleShape): ModuleDraft {
  Object.defineProperty(shape, MODULE_DRAFT, { value: true, enumerable: false, writable: false });
  return shape as ModuleDraft;
}

/** Is this object the product of `defineModule()`? */
export function isModuleDraft(value: unknown): value is ModuleDraft {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as Record<symbol, unknown>)[MODULE_DRAFT] === true
  );
}

/**
 * Fill back `creatable.pushedFrom` — the second source of a derivation, visible only with the whole module table.
 *
 * Same rule as the reverse side of `normalizeLifecycle` filling `postsToLedger`, except the view is one level wider:
 * "who pushes to me" is written on an edge of **another module**, and `normalizeModule` looks at one module at a time,
 * so it is structurally blind to this. The assembler of the module table (`@open-erp/loader`) calls it once after scanning every domain.
 *
 * `additionalOrigins` are Planner generation paths. Those targets may be generated only by the system, and assembly appends
 * a `creatable` blocker for that path. An ordinary `transition.push` does not append this one.
 */
/**
 * The "push only" shape: there is an upstream push, and a manual create is left with only "pick one upstream bill" —
 * the other required facts are snapshot / system-supplied, and the initial status also locks that upstream reference.
 *
 * The criterion must be computed at assembly time (when `pushedFrom` is visible): single-module normalization is blind to "who pushes to me".
 * On a hit it is merged into `creatable.blockers` and `manual` becomes false — the list disables "create" and explains the source,
 * the same shape as the companion-ref hole class of blocker.
 */
function pushOnlyBlockersOf(
  module: ModuleSchema,
  originCodes: ReadonlySet<string>,
): readonly CreateBlocker[] {
  if (originCodes.size === 0) return [];

  for (const table of module.fields) {
    if (table.type !== "subtable" || !table.fields) continue;
    if (table.fields.some((field) => field.required && !isSystemSupplied(field, table.fields ?? undefined))) {
      return [];
    }
  }

  const requiredUser = module.fields.filter(
    (field) => field.required && !isSystemSupplied(field) && field.type !== "subtable",
  );
  if (requiredUser.length === 0) return [];
  if (
    !requiredUser.every(
      (field) => field.type === "ref" && field.ref !== null && originCodes.has(field.ref),
    )
  ) {
    return [];
  }

  const initial = module.lifecycle.statuses.find((status) => status.initial);
  if (!initial || initial.editable === "full") return [];
  if (initial.editable === "whitelist") {
    const allowed = new Set(initial.editableFields ?? []);
    if (requiredUser.some((field) => allowed.has(field.key))) return [];
  }

  return requiredUser.map((field) => ({
    path: field.key,
    label: field.label,
    type: field.type,
    why:
      `this bill is produced by a push from upstream "${String(field.ref)}". "${field.label}" is locked in the initial status. ` +
      `Creating it by hand repeats the push. Produce it from the matching action on the upstream bill`,
  }));
}

export function withPushOrigins(
  modules: readonly ModuleSchema[],
  additionalOrigins: readonly TargetedPushOrigin[] = [],
): readonly ModuleSchema[] {
  const origins = new Map<string, PushOrigin[]>();
  const generatedOnlyTargets = new Set(additionalOrigins.map((origin) => origin.target));
  const addOrigin = (target: string, origin: PushOrigin): void => {
    const list = origins.get(target) ?? [];
    if (!list.some((candidate) => candidate.module === origin.module && candidate.transition === origin.transition)) {
      list.push(origin);
    }
    origins.set(target, list);
  };
  for (const source of modules) {
    for (const edge of source.lifecycle.transitions) {
      if (edge.push === null) continue;
      addOrigin(edge.push, {
        module: source.code,
        moduleLabel: source.label,
        transition: edge.code,
        action: edge.action,
      });
    }
  }
  for (const origin of additionalOrigins) {
    addOrigin(origin.target, {
      module: origin.module,
      moduleLabel: origin.moduleLabel,
      transition: origin.transition,
      action: origin.action,
    });
  }
  return modules.map((module) => {
    const pushedFrom = origins.get(module.code) ?? [];
    const originCodes = new Set(pushedFrom.map((origin) => origin.module));
    const generatedOnlyBlockers: readonly CreateBlocker[] = generatedOnlyTargets.has(module.code)
      ? [{
          path: "creatable",
          label: "generated automatically",
          type: "string",
          why: "this module can be generated by the system only from confirmed source-document facts, and cannot be created by hand without a source",
        }]
      : [];
    const blockers = [
      ...module.creatable.blockers,
      ...pushOnlyBlockersOf(module, originCodes),
      ...generatedOnlyBlockers,
    ];
    return {
      ...module,
      creatable: {
        manual: blockers.length === 0,
        blockers,
        pushedFrom,
      },
    };
  });
}
