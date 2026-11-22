// ---------------------------------------------------------------------------
// Multi-level explosion — the only structure walk and quantity rollup in the repo
//
// It exists for one reason: this criterion used to live only inside the production
// release Planner (`expandBomTree` in
// `domains/production/modules/productionOrder/index.ts`), and "see the whole tree
// before release" needs the same answer. Two copies do not fail loudly. The panel
// shows 31.5 and the release actually issues 30. Both numbers call themselves
// "cumulative quantity", and nothing says which one is right.
//
// Zero IO, and zero business names. This file does not know `bom` /
// `componentProductId` / `lossRate`. Coordinates come from `views.explosion`
// (`ExplosionView`); data comes from the injected `ExplosionReader`. It still
// runs and tests if every business package is deleted.
//
// It reports; it does not throw. A cycle, too much depth, a child with no lines,
// or a cell with no value all become a `state` on the node. The caller decides
// how to say it: the write path (Planner) turns it into today's fail-fast error
// text, and the read path (the detail panel) draws it on the tree. If the kernel
// threw instead, the panel would go blank at the moment it is most needed, and a
// structural error such as a cycle is visible only on this tree.
// ---------------------------------------------------------------------------

import type { ExplosionView } from "../schema/views.js";
import type { Query } from "../normalize/query.js";

/**
 * Explosion depth cap.
 *
 * This is a kernel constant, not a declaration slot. It catches structures that
 * are too deep to be a business shape, not a business parameter of one module.
 * If it were declarable, someone would raise it to "fix" a cycle. A cycle must
 * be pointed at, not walked to the end. A real cycle is detected from `path` and
 * reported in plain language. This cap only covers the case path cannot see
 * (not a cycle, but unbounded depth).
 */
export const EXPLOSION_MAX_DEPTH = 12;

/** One record of this module: header plus rows grouped by line-table key. Same shape as `PlannerBillSnapshot` / `Bill`, with no dependency back on either. */
export interface ExplosionRecord {
  readonly header: Readonly<Record<string, unknown>>;
  readonly lines: Readonly<Record<string, readonly Readonly<Record<string, unknown>>[]>>;
}

/**
 * The read seam. Both methods are bound to the same module, so the kernel never
 * has to name that module.
 *
 * `list` receives the `Query` the kernel built (`explosionChildQuery`). Implementors
 * do not each build their own. "Which record is the next level" (active, preferred
 * first) is part of the criterion. Split across two implementations, one side
 * expands the default version and the other picks a row at random, and both trees
 * look legal on their own.
 */
export interface ExplosionReader {
  /** Load one record of this module by id. */
  record(id: string): Promise<ExplosionRecord>;
  /** Run one list query on this module. Rows must at least carry `id`. */
  list(query: Query): Promise<readonly Readonly<Record<string, unknown>>[]>;
}

/**
 * The conclusion for one component row on the tree.
 *
 * `leaf` and `stopped` are both terminal, and they are not the same sentence.
 * The first means "this component has no active child" (often a semi-finished
 * item with no BOM yet, or a BOM that has been disabled — the silent failure
 * most easily read as "we were supposed to issue this"). The second means "this
 * row declared that it must not be drilled into". Collapse them into one state
 * and the UI can no longer say the first one was unexpected.
 */
export type ExplosionState =
  /** An active child exists and was drilled into. */
  | "expanded"
  /** The child record exists, but its line table is empty. */
  | "emptyChild"
  /** The child record exists, but it has no declared line table at all. */
  | "missingChildTable"
  /** The child record is missing the explosion entity coordinate. */
  | "invalidChild"
  /** This component has no active child, so it is terminal. */
  | "leaf"
  /** This row declared no further drill (`view.stop`), so it is terminal. */
  | "stopped"
  /** The child record exists, but drilling in would form a cycle. */
  | "cycle"
  /** The child record exists, but the depth cap has been reached. */
  | "depth"
  /** The same entity has several active records. Show the preferred one, and warn explicitly. */
  | "multipleActive"
  /** A coordinate cell on this row has no legal value, so nothing can be decided. */
  | "invalid";

/** The cell that yielded no value. `key` is the declared column name; the caller phrases it in its own voice. */
export interface ExplosionInvalid {
  readonly coordinate: "component" | "qty" | "loss";
  readonly key: string;
  readonly expected: "text" | "number";
}

export interface ExplosionNode {
  /** Readable coordinate, for example "BOM row 2". A child level is "child of BOM row 2 row 1". */
  readonly at: string;
  /** Readable coordinate of this row's child level (`child of ${at}`). Error text must use it. */
  readonly childAt: string;
  /** Starts at 1. */
  readonly depth: number;
  /** This row's index in its line table (0-based). */
  readonly index: number;
  readonly row: Readonly<Record<string, unknown>>;
  /** Component entity id this row points at. Empty when `invalid`. */
  readonly entityId: string;
  /** Quantity this row declares at this level (base unit). 0 when `invalid`. */
  readonly qty: number;
  /** Loss rate this row declares. 0 when `invalid`. */
  readonly loss: number;
  /**
   * The factor accumulated down to the parent (1 at the top). The parent's `effective × (1 + parent loss / 100)`.
   *
   * Loss compounds level by level: the extra the next level must make, this
   * level must also issue. Multiplying once at the end under-issues a three-level
   * structure by exactly the cross term, while every level's number looks right
   * on its own.
   */
  readonly carried: number;
  /** `carried × qty` — net quantity of this row for one top-level record (base unit, before this row's loss). */
  readonly effective: number;
  /** Entity-id path, including this row's component. Cycle detection and `bomPath` both read it. */
  readonly path: readonly string[];
  readonly state: ExplosionState;
  /** Non-null only when `invalid`. */
  readonly invalid: ExplosionInvalid | null;
  /** Non-null only for `expanded` / `emptyChild` / `missingChildTable`: the child record's id. */
  readonly childRecordId: string | null;
  /** Non-null only when `expanded`. */
  readonly childLabel: string | null;
  /** Non-null only when `expanded`. */
  readonly childPreferred: boolean;
  readonly children: readonly ExplosionNode[];
}

export interface ExplosionTree {
  readonly recordId: string;
  /** Entity id on the root record's header (`view.entity`). Empty when it cannot be read; `root` is then `invalidEntity`. */
  readonly entityId: string;
  /** `ok` = the root record has lines. The other values mean the same thing as the same-named node states. */
  readonly root: "ok" | "emptyLines" | "missingTable" | "invalidEntity";
  /** Readable coordinate of the root level (supplied by the caller, for example `"BOM"`). */
  readonly at: string;
  readonly nodes: readonly ExplosionNode[];
}

export interface ExplosionOptions {
  /** Readable coordinate of the root level. Error text is built from it, so the caller supplies it. The kernel does not invent one. */
  readonly at: string;
  /**
   * Whether to keep drilling. `false` = expand one level only (the BOM "top node" reading).
   *
   * There is no default. This chooses "a semi-finished item appears as one line
   * to issue" versus "keep drilling down to raw material". Both are real
   * business. Guessing either one makes a batch of issue documents silently
   * issue the wrong thing.
   */
  readonly deep: boolean;
}

// ── Reads: same rule as the rest of the kernel, only stored scalars count ──

function textOf(row: Readonly<Record<string, unknown>>, key: string): string | null {
  const value = row[key];
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function numberOf(row: Readonly<Record<string, unknown>>, key: string): number | null {
  const value = row[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * The only compiled form of "which record is the next level of this entity".
 *
 * `limit: 2` is not a typo. Only the first row is used, but fetching one extra
 * makes "this entity has several active records" visible to the caller. Capped
 * at 1, a data problem such as several versions coexisting can never be seen.
 */
export function explosionChildQuery(view: ExplosionView, entityId: string): Query {
  return {
    where: {
      kind: "group",
      join: "and",
      children: [
        { kind: "cond", field: view.entity, op: "eq", value: entityId },
        { kind: "cond", field: "status", op: "eq", value: view.activeStatus },
      ],
    },
    search: null,
    sort: view.preferred === null ? [] : [{ field: view.preferred, desc: true }],
    limit: 2,
    offset: 0,
  };
}

/**
 * Walk one tree.
 *
 * Order is depth-first, in line-row order. `explosionLeaves` therefore comes out
 * in the same order as the material rows pushed one by one at release (those
 * rows carry `sourceLineNo`; a different order is a different set of line numbers).
 */
export async function walkExplosion(
  reader: ExplosionReader,
  view: ExplosionView,
  recordId: string,
  options: ExplosionOptions,
): Promise<ExplosionTree> {
  const root = await reader.record(recordId);
  const rootEntityId = textOf(root.header, view.entity) ?? "";

  // The root entity is the anchor of the recursive path. Walking on without it
  // hangs every component on an empty path, so a cycle cannot be detected and
  // the user cannot be told which cell is broken. The read path must report this case.
  if (rootEntityId === "") {
    return { recordId, entityId: "", root: "invalidEntity", at: options.at, nodes: [] };
  }

  const childRecordIdOf = async (entityId: string, row: Readonly<Record<string, unknown>>): Promise<{ readonly id: string | null; readonly multiple: boolean; readonly invalid: boolean }> => {
    // An explicit child BOM is a version freeze point. When it has a value, never fall back to the default version.
    const explicit = view.childBom === null ? null : textOf(row, view.childBom);
    if (explicit !== null) {
      const child = await reader.record(explicit);
      // Selection / activation already guaranteed the child version was usable.
      // After the snapshot exists, a later disable of the child version must not
      // stop a historical parent BOM from expanding the original record. Here we
      // only check that the reference really belongs to that component item.
      const matches = textOf(child.header, view.entity) === entityId;
      return { id: explicit, multiple: false, invalid: !matches };
    }
    return { id: null, multiple: false, invalid: false };
  };

  const walk = async (
    record: ExplosionRecord,
    at: string,
    depth: number,
    carried: number,
    path: readonly string[],
  ): Promise<{ readonly root: ExplosionTree["root"]; readonly nodes: readonly ExplosionNode[] }> => {
    const rows = record.lines[view.lines];
    if (rows === undefined) return { root: "missingTable", nodes: [] };
    if (rows.length === 0) return { root: "emptyLines", nodes: [] };

    const nodes: ExplosionNode[] = [];
    for (const [index, row] of rows.entries()) {
      const rowAt = `${at} row ${String(index + 1)}`;
      const childAt = `child of ${rowAt}`;
      const base = {
        at: rowAt,
        childAt,
        depth,
        index,
        row,
        carried,
        path,
        childRecordId: null,
        childLabel: null,
        childPreferred: false,
        children: [] as readonly ExplosionNode[],
      };

      const invalidNode = (invalid: ExplosionInvalid): ExplosionNode => ({
        ...base,
        entityId: "",
        qty: 0,
        loss: 0,
        effective: 0,
        path: [...path],
        state: "invalid",
        invalid,
      });

      const entityId = textOf(row, view.component);
      if (entityId === null) {
        nodes.push(invalidNode({ coordinate: "component", key: view.component, expected: "text" }));
        continue;
      }
      const qty = numberOf(row, view.qty);
      if (qty === null) {
        nodes.push(invalidNode({ coordinate: "qty", key: view.qty, expected: "number" }));
        continue;
      }
      const loss = numberOf(row, view.loss);
      if (loss === null) {
        nodes.push(invalidNode({ coordinate: "loss", key: view.loss, expected: "number" }));
        continue;
      }

      // Character-for-character the same as the release side: this row's net quantity for one top-level unit = the multiplied factor so far × this level's quantity.
      const effective = carried * qty;
      const nextPath = [...path, entityId];
      const settled = {
        ...base,
        entityId,
        qty,
        loss,
        effective,
        path: nextPath,
        invalid: null,
      };

      // A row that declared "do not drill" is terminal even when it is itself a
      // semi-finished item. That row says "deduct this item directly at completion".
      // Drilling one more level would turn the same quantity into two consumption facts.
      if (view.stop !== null && row[view.stop] === true) {
        nodes.push({ ...settled, state: "stopped" });
        continue;
      }
      if (!options.deep) {
        nodes.push({ ...settled, state: "leaf" });
        continue;
      }

      const childMatch = await childRecordIdOf(entityId, row);
      const childRecordId = childMatch.id;
      if (childRecordId === null) {
        nodes.push({ ...settled, state: "leaf" });
        continue;
      }
      if (childMatch.invalid) {
        nodes.push({ ...settled, state: "invalidChild", childRecordId });
        continue;
      }
      if (childMatch.multiple) {
        nodes.push({ ...settled, state: "multipleActive", childRecordId });
        continue;
      }
      // Cycle first, depth second — the same order as the release side. `A → B → A`
      // can report the path; the depth cap can only say "too deep". The other way
      // around, a three-level cycle is reported as a structure that is too deep,
      // and that sentence points at no document.
      if (path.includes(entityId)) {
        nodes.push({ ...settled, state: "cycle", childRecordId });
        continue;
      }
      if (nextPath.length > EXPLOSION_MAX_DEPTH) {
        nodes.push({ ...settled, state: "depth", childRecordId });
        continue;
      }

      const childRecord = await reader.record(childRecordId);
      const inner = await walk(childRecord, childAt, depth + 1, effective * (1 + loss / 100), nextPath);
      if (inner.root !== "ok") {
        nodes.push({
          ...settled,
          state:
            inner.root === "emptyLines"
              ? "emptyChild"
              : inner.root === "invalidEntity"
                ? "invalidChild"
                : "missingChildTable",
          childRecordId,
        });
        continue;
      }
      nodes.push({
        ...settled,
        state: "expanded",
        childRecordId,
        childLabel: view.label === null ? null : textOf(childRecord.header, view.label),
        childPreferred: view.preferred !== null && childRecord.header[view.preferred] === true,
        children: inner.nodes,
      });
    }
    return { root: "ok", nodes };
  };

  const walked = await walk(root, options.at, 1, 1, [rootEntityId]);
  return { recordId, entityId: rootEntityId, root: walked.root, at: options.at, nodes: walked.nodes };
}

/** Preorder flatten. The write path's per-node fail-fast needs this order — the same order a throw during the walk would have used. */
export function explosionNodes(tree: ExplosionTree): readonly ExplosionNode[] {
  const out: ExplosionNode[] = [];
  const visit = (nodes: readonly ExplosionNode[]): void => {
    for (const node of nodes) {
      out.push(node);
      visit(node.children);
    }
  };
  visit(tree.nodes);
  return out;
}

/** Terminal materials, in walk order. Both `leaf` and `stopped` count — neither asks for material further down. */
export function explosionLeaves(tree: ExplosionTree): readonly ExplosionNode[] {
  return explosionNodes(tree).filter((node) => node.state === "leaf" || node.state === "stopped");
}

/**
 * Net quantity of this row for one top-level unit (base unit, excluding this row's loss).
 *
 * A function of its own, rather than letting the caller read `node.effective`:
 * it must always stay paired with the function below. On screen, "cumulative
 * quantity" and "required quantity / quantity" check each other. If each place
 * writes the formula once, a mismatch does not say which place is wrong.
 */
export function explosionUnitQty(node: ExplosionNode): number {
  return node.effective;
}

/**
 * Required quantity of this row when making `rootQty` units (base unit, including this row's loss).
 *
 * Do not change the expression or the association order. The release side
 * divides it by the unit-conversion factor and stores it on the material-requirement
 * line. Floating point does not treat `a * b * c` and `a * (b * c)` as equal, and
 * the leftover digit would make "what the panel computed" and "what was actually
 * issued" differ in the last place forever.
 */
export function explosionRequiredQty(node: ExplosionNode, rootQty: number): number {
  return node.effective * rootQty * (1 + node.loss / 100);
}
