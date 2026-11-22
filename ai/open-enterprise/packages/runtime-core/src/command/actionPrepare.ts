import {
  normalizeTransitionParams,
  requireObject,
  resolveRefPreselect,
  schemaFail,
  seedTransitionParams,
  transitionAction,
  transitionAt,
  type ActionParams,
  type Transition,
} from "@open-erp/metamodel";
import type { RuntimeAuthorizer } from "../contracts/authorization.js";
import { requireRuntimeModule, type RuntimeCatalog } from "../contracts/catalog.js";
import { BillInvalidError } from "../contracts/errors.js";
import type { Identity } from "../contracts/identity.js";
import { readAtRevision, type ExecutionRepos } from "../execute/execute.js";
import { planningReadContext } from "./planner.js";

export interface PrepareActionParamsArgs {
  readonly identity: Identity;
  readonly module: string;
  readonly billId: string;
  readonly transition: string;
  /** The revision the user saw (list row / detail). Preparing params is the first step of this write, so revision is compared before status. */
  readonly expectedRevision: number;
  readonly params?: Readonly<Record<string, unknown>>;
}

interface PrepareActionParamsDeps {
  readonly catalog: RuntimeCatalog;
  readonly repos: Pick<ExecutionRepos, "bills" | "ledger" | "moduleSettings" | "references">;
  readonly authorizer: RuntimeAuthorizer;
  readonly now: () => Date;
}

/**
 * Prepare the initial action params. `null` means the edge has no preparer; the caller should keep an empty draft.
 *
 * This path is read-only: the source bill and every later read inside the preparer go through scoped repositories.
 * The return value keeps only parameter keys the edge declared, and it passes the same value gate as preview / execute.
 * It does not send the source bill header / lines out as-is.
 */
export async function prepareActionParams(
  deps: PrepareActionParamsDeps,
  args: PrepareActionParamsArgs,
): Promise<ActionParams | null> {
  const loaded = requireRuntimeModule(deps.catalog, args.module);
  if (transitionAction(loaded.schema.lifecycle, args.transition) === null) {
    schemaFail(`"${loaded.schema.label}" has no operation "${args.transition}"`);
  }

  // Authorize before reading the bill: without permission for this action, even the bill's status must not be probeable.
  deps.authorizer.assertTransition(args.identity, args.module, args.transition);
  // Compare the revision before resolving the edge by status. If someone else moved the bill first, the user should see "changed after you opened it", not "you cannot do this now".
  const bill = await readAtRevision(args.module, args.billId, args.expectedRevision, () =>
    deps.repos.bills.get(args.identity, args.module, args.billId));
  // Prepare the params of the edge this bill is on right now: resolve by current status, and refuse with the same sentence when it cannot be done.
  const edge = transitionAt(loaded.schema, bill.header["status"], args.transition);

  const preparer = loaded.actionPreparers.get(args.transition);
  const raw = preparer === undefined
    ? seedTransitionParams(edge, bill)
    : await preparer({
      module: args.module,
      transition: args.transition,
      bill,
      read: planningReadContext(deps, args),
      now: deps.now(),
      actor: { userId: args.identity.userId },
      ...(args.params === undefined ? {} : { params: args.params }),
    });
  if (raw === null || raw === undefined) return null;
  const withDefaults = await fillBillLinesPreselects(edge, raw, bill.header, args.identity, deps.repos);
  const normalized = normalizeTransitionParams(
    edge,
    requireObject(withDefaults, preparer === undefined ? `seed defaults for ${args.module}.${args.transition}` : `return value of actionPreparers.${args.transition}`),
    { allowMissingRequired: true },
  );
  if (normalized.issues.length > 0) {
    throw new BillInvalidError(`Default params for action "${edge.action}" are invalid`, normalized.issues);
  }
  return normalized.params;
}

/**
 * Read-only refPreselect on action lines: after seed, fill a default ref per row only when the candidate set has exactly one row.
 * Zero or more than one stays blank. Do not guess.
 */
async function fillBillLinesPreselects(
  edge: Transition,
  params: Readonly<Record<string, unknown>>,
  header: Readonly<Record<string, unknown>>,
  identity: Identity,
  repos: Pick<ExecutionRepos, "bills">,
): Promise<Readonly<Record<string, unknown>>> {
  let changed = false;
  const next: Record<string, unknown> = { ...params };
  for (const param of edge.params) {
    if (param.type !== "billLines" || param.lineField?.fields == null) continue;
    const rows = next[param.key];
    if (!Array.isArray(rows)) continue;
    const columns = param.lineField.fields.filter(
      (column) => (column.refPreselect !== null || column.refPreselectSole) && column.ref !== null,
    );
    if (columns.length === 0) continue;
    const filled: unknown[] = [];
    for (const row of rows) {
      if (row === null || typeof row !== "object" || Array.isArray(row)) {
        filled.push(row);
        continue;
      }
      const current: Record<string, unknown> = { ...(row as Record<string, unknown>) };
      for (const column of columns) {
        const entity = column.ref;
        if (entity === null) continue;
        const existing = current[column.key];
        if (existing !== undefined && existing !== null && existing !== "") continue;
        const resolution = resolveRefPreselect(
          column.refFilter,
          column.refPreselect,
          column.refPreselectSole,
          header,
          current,
        );
        if (resolution === null || resolution.pending.length > 0 || resolution.conditions.length === 0) continue;
        const picked = await repos.bills.refPreselect(identity, entity, resolution.conditions);
        if (typeof picked === "string" && picked !== "") {
          current[column.key] = picked;
          changed = true;
        }
      }
      filled.push(current);
    }
    next[param.key] = filled;
  }
  return changed ? next : params;
}
