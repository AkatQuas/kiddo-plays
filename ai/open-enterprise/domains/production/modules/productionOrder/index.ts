import {
  defineBatchActions,
  defineModule,
  definePlanners,
} from "@open-erp/metamodel";
// The runtime container executes source through tsx, so the .ts suffix must stay. The NodeNext build's one-off check is suppressed on the next line.
// @ts-ignore TS5097: runtime source loader resolves the TypeScript module.
import { releaseSalesAfterProductionSettled } from "../../salesFulfillment.ts";
import {
  normalizeField,
  roundToScale,
  schemaFail,
  type ExecutionCommand,
  type ExecutionPlan,
  type CreatedIdValue,
  type PlanRecord,
  type PlannerContext,
  requireText,
  requireNumber,
  optionalText,
} from "@open-erp/metamodel";
// ---------------------------------------------------------------------------
// Business planner for the production release workbench. The form field declaration stays out of the catalog
// and is shared by the list dialog and input validation. It has no table, number, menu, or lifecycle facts.
//
// The host of a release is the set of production orders, not an intermediate document. Which rows are checked,
// how much each row releases, and what the plan window is exist only in this action's parameters. The final facts land on the source order and the task.
//
// This planner is read-only. It only emits createBill / createReference / setStatus.
// It does not change status, write a ledger, or skip a precondition. `setStatus` says which edge of the target module to take
// (`productionOrder.markReleased`). The server hands it back to the same evaluate → execute,
// and the target edge's gates and side effects are all still there. The write path is still only evaluate → execute.
//
// A `throw` inside the planner is a last resort, not validation. Conclusions of the kind "the user filled this in wrong"
// (BOM is not active, BOM does not belong to this line's product, the same for the routing, issue warehouse is empty) belong on
// `preconditions`. What is thrown from here is an unclassified exception. The client receives "internal server error" and the user never sees the reason.
//
// The only test is: could a user operating normally reach this point?
//   · If yes, it is a business conclusion and belongs on `preconditions` (block). The button goes grey and the reason stays visible.
//     `yarn catalog` can say it, and the agent sees the same contract.
//   · If no, leave the throw. It is the last assert.
// When judging "cannot be reached", find the actual gate. A sentence that only feels inevitable is not enough.
// ---------------------------------------------------------------------------

function dateValue(value: unknown, label: string): string {
  if (value instanceof Date) {
    if (Number.isNaN(value.valueOf())) throw new Error(`${label} is not a valid date`);
    return value.toISOString().slice(0, 10);
  }
  const raw = requireText(value, label);
  const match = /^(\d{4}-\d{2}-\d{2})(?:T.*)?$/.exec(raw);
  if (match === null || Number.isNaN(new Date(`${match[1]}T00:00:00.000Z`).valueOf())) {
    throw new Error(`${label} must be a valid ISO date`);
  }
  return match[1]!;
}

function dateTimeValue(value: unknown, label: string): string {
  if (value instanceof Date) {
    if (Number.isNaN(value.valueOf())) throw new Error(`${label} is not a valid time`);
    return value.toISOString();
  }
  const raw = requireText(value, label);
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.valueOf())) throw new Error(`${label} must be a valid ISO time`);
  return parsed.toISOString();
}

function rowsOf(value: unknown, label: string): readonly Readonly<Record<string, unknown>>[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array of lines`);
  return value.map((row, index) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) throw new Error(`${label}[${index}] must be an object`);
    return row as Readonly<Record<string, unknown>>;
  });
}

function planNumber(value: number, label: string): number {
  return roundToScale(value, "number", label);
}

function planPointer(commandId: string): CreatedIdValue {
  return { kind: "createdId", commandId };
}

/**
 * Every group counts from pendingReview (3.5.0 added an approval step to the production task).
 *
 * A task occupies the order's planned quantity as soon as it is created. Approval only decides whether the shop can start.
 * It does not change the fact that these 10 pieces are already scheduled to it. Missing this status is very hard to see: the schedule was made,
 * the task is on the list, and "move to in production" says the task's allocated quantity in the main unit totals 0,
 * because the gate did not count pending review. That happened once in a real run.
 */
const LIVE_TASK_STATUSES = ["pendingReview", "awaitingLaunch", "inProduction", "completed"] as const;
/** Unfinished tasks block order completion. A cancelled task also has no output. Cancelling a task means the quantity must be released again. */
const UNFINISHED_TASK_STATUSES = ["pendingReview", "awaitingLaunch", "inProduction", "cancelled"] as const;

/** Status of a source order that has not yet been released. Only an order sitting here gets `setStatus`. */
const ORDER_PENDING_RELEASE = "awaitingRelease";

/**
 * Source order statuses that can still be released. This is an allow-list.
 *
 * Write an allow-list rather than an exclude-list of "not cancelled / finished". The reason is the same sentence as
 * `salesOrder.not_already_in_production`. When a status is added later,
 * missing it on the allow-list blocks (the user immediately sees that it cannot be released, asks, and it gets added).
 * Missing it on an exclude-list lets it through (no symptom: the shop starts work from a task that should not exist).
 *
 * Why each of the three is included:
 *   · `awaitingRelease` — approved, and production release has not run. This is the normal entry,
 *     and the only status that triggers `setStatus` (moving to releasing).
 *   · `releasing` — already pushed, and the shop has not accepted the first task. An additional release is normal business.
 *     The planner does not send `setStatus` again, and the order stays here.
 *   · `inProduction` — a task has been approved and the shop is already working. The remaining plan can still be released
 *     (the task starts first, the remainder is released later). The planner again does not send `setStatus`, and the order stays in production.
 *
 * Every other status is blocked. `pendingReview` has not finished approval (releasing would skip approval).
 * `reported` (old leftover) / `finished` are already closed, and another batch would have no promise on the order to stand on.
 * `cancelled` is the most expensive status on this gate. See the rule for `*_source_order_releasable` below.
 */
const ORDER_RELEASABLE_STATUSES = [ORDER_PENDING_RELEASE, "releasing", "inProduction"] as const;

function subRows(
  snapshot: { readonly lines: Readonly<Record<string, readonly Readonly<Record<string, unknown>>[]>> },
  key: string,
  label: string,
) {
  const direct = snapshot.lines[key];
  if (direct === undefined) throw new Error(`${label} is missing the declared line table ${key}`);
  return rowsOf(direct, label);
}

interface MaterialLine extends PlanRecord {
  readonly componentProductId: string;
  readonly unitQty: number;
  readonly unit: string;
  readonly lossRate: number;
  readonly productionBaseQty: number;
  readonly requiredQty: number;
  /** Frozen from the standalone SKU header. */
  readonly spec: string;
  readonly defaultIssueWarehouseId: string;
  readonly sourceLineNo: number;
  readonly bomPath: string;
}

/** Material-requirement `lines` carry only the columns this detail has declared and can write. */
function materialRequirementLine(line: MaterialLine): PlanRecord {
  return line;
}

/**
 * The copy on the production task does not carry `productionBaseQty`. The task has no consumer. The audit copy is on the material requirement.
 */
function productionTaskMaterialLine(line: MaterialLine): PlanRecord {
  const { productionBaseQty: _auditMultiplier, ...rest } = line;
  return rest;
}

/**
 * At release, freeze the material specification from the standalone SKU header. SKU spec is required, so there is no compatibility branch that guesses a specification from the style.
 * A missing value means master data already violated a write invariant, and it should fail here.
 */
async function productHeaderOf(
  ctx: PlannerContext,
  productId: string,
  at: string,
  cache: Map<string, Readonly<Record<string, unknown>>>,
): Promise<Readonly<Record<string, unknown>>> {
  const hit = cache.get(productId);
  if (hit !== undefined) return hit;

  const product = await ctx.read.getBill("product", productId);
  cache.set(productId, product.header);
  return product.header;
}

async function productSpecOf(
  ctx: PlannerContext,
  productId: string,
  at: string,
  cache: Map<string, Readonly<Record<string, unknown>>>,
): Promise<string> {
  const product = await productHeaderOf(ctx, productId, at, cache);
  return requireText(product["spec"], `${at} SKU specification`);
}

/**
 * BOM explosion: each root BOM line becomes a material line for direct issue.
 * Multiple levels on the same document use parentLineNo only to rebuild the edit tree. Release does not drill into a child BOM on another document.
 */
async function expandBomTree(
  ctx: PlannerContext,
  rootBomId: string,
  rootProductId: string,
  productionQty: number,
): Promise<readonly MaterialLine[]> {
  const out: MaterialLine[] = [];
  let seq = 0;
  const productCache = new Map<string, Readonly<Record<string, unknown>>>();
  const bom = await ctx.read.getBill("bom", rootBomId);
  const rows = subRows(bom, "lines", "BOM");
  if (rows.length === 0) {
    // This cannot be reached, so the throw is correct (each step was checked):
    //   1. Before exploding, the schedule-production planner re-reads the BOM by id and requires `status === active` and that it belongs to this product.
    //   2. The BOM onCreate gate requires `lines_required` (lines_not_empty).
    //   3. `bom` in `active` is `editable: "none"`, so lines cannot be deleted after it becomes active.
    // Together, a referenced BOM must have lines. Reaching here means the database was changed outside the write path.
    throw new Error("This BOM has no component lines, so material requirements cannot be expanded");
  }
  for (const [index, row] of rows.entries()) {
    const at = `BOM line ${index + 1}`;
    const componentProductId = requireText(row["componentProductId"], `${at} material`);
    const unitQty = requireNumber(row["baseUnitQty"], `${at} main-unit quantity`);
    const unit = requireText(row["unit"], `${at} unit`);
    const unitFactor = requireNumber(row["unitFactor"], `${at} unit conversion factor`);
    const lossRate = requireNumber(row["lossRate"], `${at} scrap rate`);
    if (unitQty <= 0) throw new Error(`${at} quantity per must be greater than zero`);
    if (lossRate < 0) throw new Error(`${at} scrap rate cannot be negative`);
    const defaultIssueWarehouseId = requireText(row["defaultIssueWarehouseId"], `${at} default issue warehouse`);
    const effectiveUnitQty = unitQty;

    seq += 1;
    const spec = await productSpecOf(ctx, componentProductId, at, productCache);
    out.push({
      componentProductId,
      unitQty: planNumber(effectiveUnitQty / unitFactor, `${at} quantity per`),
      unit,
      lossRate: planNumber(lossRate, `${at} scrap rate`),
      productionBaseQty: planNumber(productionQty, "Production quantity in main unit"),
      requiredQty: planNumber(effectiveUnitQty * productionQty * (1 + lossRate / 100) / unitFactor, `${at} required quantity`),
      spec,
      defaultIssueWarehouseId,
      sourceLineNo: seq,
      bomPath: [rootProductId, componentProductId].join(" / "),
    });
  }
  return out;
}

/** A release line after it has been read into business values. Every field comes from a fact already stored (typed by the user, frozen by snapshot, or confirmed after a refDefault). */
interface ReleaseLine {
  readonly at: string;
  readonly sourceOrderLineId: string;
  readonly sourceOrderId: string;
  readonly productId: string;
  readonly releaseQty: number;
  readonly baseReleaseQty: number;
  readonly unit: string;
  readonly unitFactor: number;
  readonly plannedStartDate: string;
  readonly plannedEndDate: string;
  readonly bomId: string;
  readonly routingId: string;
  readonly productionOrgId: string;
  readonly issueWarehouseId: string;
  readonly completionWarehouseId: string | null;
  readonly customerId: string | null;
  readonly remark: string | null;
}

interface ScheduleWindow {
  readonly plannedStartDate: string;
  readonly plannedEndDate: string;
}

/**
 * When operations are scheduled, the task header's plan window can only be the envelope of the operation occupancy: earliest start to latest finish.
 * The two cells on the release line are a summary of that same fact. They are not a second time that can be edited on its own.
 */
function scheduleWindowOfProcessRows(ctx: PlannerContext): ScheduleWindow | null {
  const rows = optionalProcessRows(ctx.params["processLines"]);
  if (rows.length === 0) return null;
  let plannedStartDate = "";
  let plannedEndDate = "";
  for (const [index, row] of rows.entries()) {
    const start = dateTimeValue(row["plannedStartDate"], `Line occupancy row ${String(index + 1)} start time`);
    const end = dateTimeValue(row["plannedEndDate"], `Line occupancy row ${String(index + 1)} end time`);
    if (plannedStartDate === "" || start < plannedStartDate) plannedStartDate = start;
    if (plannedEndDate === "" || end > plannedEndDate) plannedEndDate = end;
  }
  return { plannedStartDate, plannedEndDate };
}

async function readReleaseLines(ctx: PlannerContext, processWindow: ScheduleWindow | null): Promise<readonly ReleaseLine[]> {
  const rows = ctx.params["releaseLines"];
  if (!Array.isArray(rows) || rows.length === 0) schemaFail("Keep at least one production line that is still to be released");
  const seen = new Set<string>();
  const result: ReleaseLine[] = [];
  for (const [index, raw] of rows.entries()) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) schemaFail(`Release line ${index + 1} is not an object`);
    const row = raw as Readonly<Record<string, unknown>>;
    const at = `Release line ${index + 1}`;
    const sourceOrderLineId = requireText(row["sourceOrderLineId"], `${at} source order line`);
    if (seen.has(sourceOrderLineId)) schemaFail(`${at} selected the same source order line twice`);
    seen.add(sourceOrderLineId);
    const sourceOrderId = requireText(row["sourceOrderId"], `${at} source production order`);
    const order = await ctx.read.getBill("productionOrder", sourceOrderId);
    const status = requireText(order.header["status"], `${at} source order status`);
    if (!ORDER_RELEASABLE_STATUSES.includes(status as (typeof ORDER_RELEASABLE_STATUSES)[number])) {
      schemaFail(`The source production order at ${at} is "${status}". Only orders that are awaiting release, releasing, or in production can be released`);
    }
    const source = subRows(order, "lines", `${at} source order`).find((candidate) => candidate["id"] === sourceOrderLineId);
    if (source === undefined) schemaFail(`The source line at ${at} does not belong to the selected production order, or it was deleted`);
    const unitFactor = requireNumber(source["unitFactor"], `${at} unit conversion factor`);
    const releaseQty = requireNumber(row["releaseQty"], `${at} quantity released this time`);
    if (releaseQty <= 0) schemaFail(`The quantity released this time at ${at} must be greater than zero`);
    const baseReleaseQty = planNumber(releaseQty * unitFactor, `${at} main-unit quantity released this time`);
    const pending = requireNumber(source["pendingReleaseBaseQty"], `${at} main-unit quantity still to release`);
    if (baseReleaseQty > pending) {
      schemaFail(`The release quantity at ${at} exceeds what remains. At most ${String(pending / unitFactor)} can be released`);
    }
    const plannedStartDate = processWindow?.plannedStartDate
      ?? dateTimeValue(row["plannedStartDate"], `${at} planned start`);
    const plannedEndDate = processWindow?.plannedEndDate
      ?? dateTimeValue(row["plannedEndDate"], `${at} planned end`);
    if (new Date(plannedStartDate).valueOf() > new Date(plannedEndDate).valueOf()) {
      schemaFail(`Planned start at ${at} cannot be later than planned end`);
    }
    const productId = requireText(source["productId"], `${at} product`);
    const bomId = requireText(row["bomId"], `${at} BOM`);
    const bom = await ctx.read.getBill("bom", bomId);
    if (bom.header["status"] !== "active" || bom.header["productId"] !== productId) {
      schemaFail(`${at} must be an active BOM for this line's product`);
    }
    const routingId = requireText(row["routingId"], `${at} routing`);
    const routing = await ctx.read.getBill("routing", routingId);
    if (routing.header["status"] !== "active" || routing.header["productId"] !== productId) {
      schemaFail(`${at} must be an active routing for this line's product`);
    }
    // The issue warehouse is not required on the source order (it may still be unknown at order time), but this release creates
    // a material requirement, and that requirement's issue warehouse is a stored required fact. Even if the action-parameter value gate is bypassed,
    // a user-input problem must return 400. The createBill below must not become a 500.
    // This check runs before any create command in the planner.
    const issueWarehouseId = optionalText(row["issueWarehouseId"], `${at} issue warehouse`);
    if (issueWarehouseId === null) {
      schemaFail(`${at} needs an issue warehouse. Later material requirements and issues use that warehouse`);
    }

    result.push({
      at,
      sourceOrderLineId,
      sourceOrderId,
      productId,
      releaseQty,
      baseReleaseQty,
      unit: requireText(source["unit"], `${at} unit`),
      unitFactor,
      plannedStartDate,
      plannedEndDate,
      bomId,
      routingId,
      productionOrgId: requireText(order.header["productionOrgId"], `${at} factory`),
      issueWarehouseId,
      completionWarehouseId: optionalText(row["completionWarehouseId"], `${at} receipt warehouse`),
      customerId: optionalText(order.header["customerId"], `${at} customer`),
      remark: optionalText(order.header["remark"], `${at} remark`),
    });
  }
  return result;
}

function optionalProcessRows(value: unknown): readonly Readonly<Record<string, unknown>>[] {
  if (value === undefined || value === null) return [];
  return rowsOf(value, "Line occupancy lines");
}

async function assertEquipmentAndMoldTypes(
  ctx: PlannerContext,
  operationId: string,
  sequence: number,
  equipmentId: string | null,
  moldId: string | null,
): Promise<void> {
  const operation = await ctx.read.getBill("operation", operationId);
  const wantEquipment = optionalText(operation.header["equipmentType"], `Operation ${sequence} equipment type`);
  const wantMold = optionalText(operation.header["moldType"], `Operation ${sequence} mold type`);
  if (equipmentId !== null) {
    if (wantEquipment === null) schemaFail(`Operation sequence ${String(sequence)} has no equipment type, so equipment cannot be selected`);
    const equipment = await ctx.read.getBill("equipment", equipmentId);
    if (optionalText(equipment.header["category"], `Equipment ${equipmentId} type`) !== wantEquipment) {
      schemaFail(`Operation sequence ${String(sequence)} can only use equipment of type "${wantEquipment}"`);
    }
  }
  if (moldId !== null) {
    if (wantMold === null) schemaFail(`Operation sequence ${String(sequence)} has no mold type, so a mold cannot be selected`);
    const mold = await ctx.read.getBill("mold", moldId);
    if (optionalText(mold.header["moldType"], `Mold ${moldId} type`) !== wantMold) {
      schemaFail(`Operation sequence ${String(sequence)} can only use a mold of type "${wantMold}"`);
    }
  }
}

/**
 * When the schedule dialog includes operation occupancy, write the operations onto the production task's child table.
 * The order dialog always sends processLines. Without them, only the task and the material requirement are created (subcontract).
 */
async function occupancyProcessLinesForTask(
  ctx: PlannerContext,
  args: {
    readonly routingId: string;
    readonly plannedQty: number;
  },
): Promise<readonly PlanRecord[]> {
  const inputRows = optionalProcessRows(ctx.params["processLines"]);
  if (inputRows.length === 0) return [];

  const routing = await ctx.read.getBill("routing", args.routingId);
  const processType = optionalText(routing.header["processType"], "Process type") ?? "Sequential production";
  const routeRows = [...(routing.lines["lines"] ?? [])].sort(
    (left, right) => requireNumber(left["sequence"], "Operation sequence") - requireNumber(right["sequence"], "Operation sequence"),
  );
  if (routeRows.length === 0) schemaFail("This routing has no operations, so it cannot be scheduled");
  if (inputRows.length !== routeRows.length) {
    schemaFail("Line occupancy must match the routing operations exactly, with no missing or extra operations");
  }

  const inputByCoordinate = new Map(inputRows.map((row, index) => {
    const operationId = requireText(row["operationId"], `Line occupancy row ${String(index + 1)} operation`);
    const sequence = requireNumber(row["sequence"], `Line occupancy row ${String(index + 1)} sequence`);
    return [`${String(sequence)}\u0000${operationId}`, row] as const;
  }));
  if (inputByCoordinate.size !== inputRows.length) schemaFail("Line occupancy cannot repeat the same operation");

  const rows: PlanRecord[] = [];
  let latestEnd = "";
  for (const [index, routeRow] of routeRows.entries()) {
    const operationId = requireText(routeRow["operationId"], `Routing line ${String(index + 1)} operation`);
    const sequence = requireNumber(routeRow["sequence"], `Routing line ${String(index + 1)} sequence`);
    const input = inputByCoordinate.get(`${String(sequence)}\u0000${operationId}`);
    if (input === undefined) schemaFail(`Line occupancy is missing the setup for operation sequence ${String(sequence)}`);
    const productionLineOrgId = requireText(input["productionLineOrgId"], `Operation ${String(sequence)} line`);
    const productionLine = await ctx.read.getBill("orgUnit", productionLineOrgId);
    if (productionLine.header["orgType"] !== "line" || productionLine.header["status"] !== "active") {
      schemaFail(`Operation ${String(sequence)} must use an active production line`);
    }
    const workshopOrgId = requireText(productionLine.header["parentOrgId"], `Operation ${String(sequence)} parent workshop`);
    const workshop = await ctx.read.getBill("orgUnit", workshopOrgId);
    if (workshop.header["orgType"] !== "workshop" || workshop.header["status"] !== "active") {
      schemaFail(`The line selected for operation ${String(sequence)} has no active parent workshop`);
    }
    const teamId = requireText(routeRow["defaultTeamId"], `Operation ${String(sequence)} default team`);
    const assignmentRatio = requireNumber(routeRow["assignmentRatio"] ?? 1, `Operation ${String(sequence)} assignment ratio`);
    if (assignmentRatio <= 0) schemaFail(`The assignment ratio for operation ${String(sequence)} must be greater than 0`);
    const processPlannedQty = roundToScale(args.plannedQty * assignmentRatio, "number", `Operation ${String(sequence)} planned quantity`);
    const equipmentId = optionalText(input["equipmentId"], `Operation ${String(sequence)} equipment`);
    const moldId = optionalText(input["moldId"], `Operation ${String(sequence)} mold`);
    await assertEquipmentAndMoldTypes(ctx, operationId, sequence, equipmentId, moldId);

    const startAt = dateTimeValue(input["plannedStartDate"], `Operation ${String(sequence)} start time`);
    const endAt = dateTimeValue(input["plannedEndDate"], `Operation ${String(sequence)} end time`);
    if (endAt < startAt) schemaFail(`Operation sequence ${String(sequence)} ends before it starts`);
    if (processType === "Sequential production" && latestEnd !== "" && startAt < latestEnd) {
      schemaFail(
        `This routing is Sequential production: operation ${String(sequence)} starts before the previous operation finishes. Use Parallel production or Unordered production to run them side by side`,
      );
    }
    latestEnd = latestEnd === "" || endAt > latestEnd ? endAt : latestEnd;
    rows.push({
      operationId,
      sequence,
      assignmentRatio,
      plannedQty: processPlannedQty,
      plannedStartDate: startAt,
      plannedEndDate: endAt,
      productionLineOrgId,
      teamId,
      requiresReportApproval: routeRow["requiresApproval"] !== false,
      pieceRate: requireNumber(routeRow["pieceRate"] ?? 0, `Operation ${String(sequence)} piece rate`),
      outsourcingMode: requireText(routeRow["outsourcingMode"], `Operation ${String(sequence)} subcontract`),
      ...(equipmentId === null ? {} : { equipmentId }),
      ...(moldId === null ? {} : { moldId }),
    });
  }
  return rows;
}

/**
 * Release.
 *
 * One production order is one product. One line is one production task plus one material requirement. The batch workbench can still check several
 * orders at once, but it does not merge the same product into one task.
 *
 * `releaseMode` is the mode slot the platform batch action leaves behind. This business has only `separate`.
 * Each task's `allocations` record how much of which order line this task allocated.
 * That is the denominator of "has this order been fully released".
 */
function productionBatchReleasePlan(ctx: PlannerContext): Promise<ExecutionPlan> {
  return (async (): Promise<ExecutionPlan> => {
    const mode = requireText(ctx.params["releaseMode"], "Release method");
    if (mode !== "separate") schemaFail("Schedule production no longer merges orders. releaseMode must be separate");
    const processWindow = scheduleWindowOfProcessRows(ctx);
    const lines = await readReleaseLines(ctx, processWindow);
    if (optionalProcessRows(ctx.params["processLines"]).length > 0 && lines.length !== 1) {
      schemaFail("Scheduling by operation can schedule only one product line at a time");
    }
    if (ctx.read.moduleSetting === undefined) {
      throw new Error("Production release cannot read module settings, so the task completion mode cannot be guessed");
    }
    const taskCompletionMode = await ctx.read.moduleSetting("production.taskCompletionMode");
    if (taskCompletionMode !== "manual" && taskCompletionMode !== "automatic") {
      throw new Error(`Task completion mode "${taskCompletionMode}" is not an implemented branch`);
    }

    const commands: ExecutionCommand[] = [];

    for (const [index, line] of lines.entries()) {
      const at = `Release ${index + 1}`;
      const plannedBaseQty = planNumber(line.baseReleaseQty, "Released main-unit quantity");
      const plannedQty = planNumber(line.baseReleaseQty / line.unitFactor, "Release quantity");

      const materialLines = await expandBomTree(
        ctx,
        line.bomId,
        line.productId,
        plannedBaseQty,
      );
      const suffix = String(index + 1).padStart(3, "0");
      const requirementId = `material-requirement-${suffix}`;
      const taskId = `production-task-${suffix}`;
      const processLines = await occupancyProcessLinesForTask(ctx, { routingId: line.routingId, plannedQty });
      // The material requirement date is this line's planned finish. It used to be a UTC placeholder of `ctx.now + 7 days`.
      // That date had no source, and the warehouse prepared material against it.
      const requiredDate = dateValue(line.plannedEndDate, `${at} material requirement date`);

      commands.push(
        {
          type: "createBill",
          commandId: requirementId,
          module: "materialRequirement",
          header: {
            productionOrderId: line.sourceOrderId,
            bomId: line.bomId,
            productId: line.productId,
            productionOrgId: line.productionOrgId,
            issueWarehouseId: line.issueWarehouseId,
            requiredDate,
          },
          lines: { lines: materialLines.map(materialRequirementLine) },
        },
        {
          type: "createBill",
          commandId: taskId,
          module: "productionTask",
          header: {
            productionOrderId: line.sourceOrderId,
            productId: line.productId,
            productionOrgId: line.productionOrgId,
            plannedQty,
            unit: line.unit,
            plannedStartDate: line.plannedStartDate,
            plannedEndDate: line.plannedEndDate,
            bomId: line.bomId,
            materialRequirementId: planPointer(requirementId),
            routingId: line.routingId,
            issueWarehouseId: line.issueWarehouseId,
            // An empty completion warehouse omits the cell (`productionTask.completionWarehouseId` is optional).
            // Writing a default warehouse quietly decides for the user, and that decision controls which warehouse the completion receipt posts to.
            ...(line.completionWarehouseId === null ? {} : { completionWarehouseId: line.completionWarehouseId }),
            ...(line.customerId === null ? {} : { customerId: line.customerId }),
            sourceType: "Release separately",
            completionMode: taskCompletionMode,
            ...(line.remark === null ? {} : { remark: line.remark }),
          },
          lines: {
            // Write only the refLine (`sourceOrderLineId`). `sourceOrderId` on the same row and the same target is a companion stored column.
            // Storage fills it in the same join that checks the line exists. The planner writing it hits the key gate.
            // One line is one task, so there is one allocation here. A batched release gives each task its own.
            allocations: [{
              sourceOrderLineId: line.sourceOrderLineId,
              allocatedQty: line.releaseQty,
            }],
            // Same source as the material-requirement copy (see the note above `materialRequirementLine`).
            // Issue reads only this copy, so a task missing it cannot issue material. On screen
            // that looks like "a task was selected but no line expanded". It is not an error. It is an empty task.
            materialLines: materialLines.map(productionTaskMaterialLine),
            ...(processLines.length === 0 ? {} : { processLines }),
          },
        },
      );
    }

    // Move source orders to releasing.
    //
    // This is ordered after every createBill. `productionOrder.markReleased` has the gate
    // "this order must already have an allocated quantity", and that quantity is produced by the
    // production tasks created here. Commands run in order inside one transaction.
    // Sending setStatus early makes that gate see an order that still has no task, and the whole group rolls back.
    //
    // Push only orders still on awaitingRelease. An order already on releasing has been released before.
    // Pushing it again hits `expectedStatus` (the optimistic lock's from) and fails the whole group.
    // "This order was released before" is completely normal and must not fail this release.
    // Status is read from `ctx.read.getBill`, not guessed from a draft row in the action parameters.
    const orderIds = [...new Set(lines.map((line) => line.sourceOrderId))];
    let releasedOrders = 0;
    for (const orderId of orderIds) {
      const order = await ctx.read.getBill("productionOrder", orderId);
      const status = requireText(order.header["status"], `Production order ${orderId} status`);
      if (status !== ORDER_PENDING_RELEASE || orderId === ctx.bill.id) continue;
      releasedOrders += 1;
      commands.push({
        type: "setStatus",
        commandId: `production-order-release-${String(releasedOrders).padStart(3, "0")}`,
        target: { kind: "existing", module: "productionOrder", id: orderId },
        transition: "markReleased",
        expectedStatus: ORDER_PENDING_RELEASE,
      });
    }

    return { version: 1, commands };
  })();
}

/** Draft-line declaration for the batch workbench. It does not enter the loader catalog and it is not a database table. */
const releaseDraftLineField = normalizeField({
  key: "lines",
  label: "Release lines",
  type: "subtable",
  ref: "productionBatchReleaseLine",
  fields: [
        // Both source references are required (the same shape as salesDelivery):
        //   `sourceOrderLineId` → one detail line of that order (refLine). Release quantity, allocation, and
        //                          "how much of this line is left" all hold per order line, not per order.
        //   `sourceOrderId`     → the header of that order (ref). Task allocation looks back through it. The order detail
        //                          can sum related tasks by document id.
        // The second is a companion stored column. Storage fills it from the refLine in the same join that checks the line exists.
        // The client, planner, and seeds must not write it. Both must be required for the pair to close. If one is required and the other optional,
        // an empty refLine leaves the companion column with no source, and it becomes a 500 on PG NOT NULL.
        {
          key: "sourceOrderLineId",
          label: "Source order line",
          type: "refLine",
          ref: "productionOrder",
          through: "lines",
          required: true,
        },
        { key: "sourceOrderId", label: "Source production order", type: "ref", ref: "productionOrder", required: true },

        // Frozen at the moment the row is checked. A renamed product master or a changed order-line quantity must not rewrite a release that already went out.
        { key: "productId", label: "Product", type: "ref", ref: "product", snapshot: { from: "productionOrder", match: "sourceOrderLineId", through: "lines", field: "productId" } },
        { key: "spec", label: "Specification", type: "string", snapshot: { from: "productionOrder", match: "sourceOrderLineId", through: "lines", field: "spec" } },
        {
          key: "unit",
          label: "Unit",
          type: "string",
          required: true,
          snapshot: { from: "productionOrder", match: "sourceOrderLineId", through: "lines", field: "unit" },
        },
        {
          key: "unitFactor",
          label: "Unit factor",
          type: "number",
          snapshot: { from: "productionOrder", match: "sourceOrderLineId", through: "lines", field: "unitFactor" },
        },
        {
          key: "orderBaseQty",
          label: "Order quantity in main unit",
          type: "number",
          help: "Brought from the upstream order line, to check that this release does not exceed the remainder",
          snapshot: { from: "productionOrder", match: "sourceOrderLineId", through: "lines", field: "baseQty" },
        },

        {
          key: "releaseQty",
          label: "Quantity released this time",
          type: "number",
          required: true,
          pushFrom: "pendingReleaseQty",
          help: "Defaults to the source order line's quantity still to release. This release can be smaller. The cap is the order-line quantity minus quantity already released",
        },
        { key: "baseReleaseQty", label: "Main-unit quantity released this time", type: "number", calculate: { op: "mul", args: [{ field: "releaseQty" }, { field: "unitFactor" }] } },
        // The plan window is filled by the planner. The planner no longer invents a UTC placeholder from `ctx.now`.
        // The cost of that placeholder was that planned start and planned end on the task looked real,
        // while the date had no source, and the shop scheduled against it.
        { key: "plannedStartDate", label: "Planned start", type: "datetime", required: true },
        { key: "plannedEndDate", label: "Planned end", type: "datetime", required: true },

        // BOM and routing are `refDefault`, not `snapshot`. Switching the version at the moment of release is an explicit business need
        // (the acceptance wording was "it can also be switched"). After a snapshot freezes it, that sentence has nowhere to live.
        // The starting value still comes from the order line (the user already chose it once and should not choose it again). The candidates match the order line
        // (this line's product, and active).
        // Do not also declare `refPreselect`. It is mutually exclusive with `refDefault` (both fill the cell only when it is empty,
        // and declaring both gives the same cell two default sources, with the winner depending on implementation order). `refDefault` is the stronger one here.
        // The version on the order line is a choice the user already made. `refPreselect` picks the product's default version.
        {
          key: "bomId",
          label: "BOM",
          type: "ref",
          ref: "bom",
          required: true,
          refFilter: { productId: { from: "$line.productId" }, status: "active" },
          refDefault: { from: "productionOrder", match: "sourceOrderLineId", through: "lines", field: "bomId" },
          help: "Material requirements explode from this. The starting value is the version selected on the order line, and it can still be switched at release",
        },
        {
          key: "routingId",
          label: "Routing",
          type: "ref",
          ref: "routing",
          required: true,
          refFilter: { productId: { from: "$line.productId" }, status: "active" },
          refDefault: { from: "productionOrder", match: "sourceOrderLineId", through: "lines", field: "routingId" },
          help: "Operations and rates are frozen from this. The starting value is the version selected on the order line, and it can still be switched when scheduling",
        },
        // Values brought down from the source order header (second hop: look up the header by the companion `sourceOrderId`).
        // They are not a spare copy. The factory and warehouse on the task must be facts already stored.
        // A value computed at query time (`derive.lookup`) is not stored, and a gate and the planner would read two different numbers at two moments.
        /**
         * Expected delivery date, brought down from the source production order header, which looks up the source sales order's promised date.
         *
         * The value is copied from the header by `batchActions.seed`. This layer does not declare `derive.lookup`.
         * It used to be `lookup(salesOrder.promiseDate)` plus `match: "salesOrderId"`,
         * but the draft row has no `salesOrderId` cell (it only has `sourceOrderId` /
         * `sourceOrderLineId`, and both point at productionOrder). A draft row is not a business table and does not enter
         * the catalog, so the `sourceBindings` match gate never sees it, and this unsolvable declaration was never blocked.
         * The planner on the schedule workbench always saw an empty delivery date: prepare first clears every cell to null,
         * then overwrites only what seed covers, and seed did not include it.
         *
         * The value itself stays live. The order header cell is a lookup, so when sales changes the delivery date the next schedule brings the new one.
         * This cell is a read-only reference at the moment of scheduling. The planner uses it to set the plan start and end below. The planner does not read a quantity from it.
         *
         * A production order created by hand (no source sales order) leaves this cell empty. That is correct. There is no customer promise.
         */
        {
          key: "promiseDate",
          label: "Expected delivery date",
          type: "date",
          help: "A reference date brought from the sales promise. Plan the end on or before it",
        },
        { key: "productionOrgId", label: "Factory", type: "ref", ref: "orgUnit", snapshot: { from: "productionOrder", match: "sourceOrderId", through: null, field: "productionOrgId" } },
        {
          key: "issueWarehouseId",
          label: "Issue warehouse",
          type: "ref",
          ref: "warehouse",
          required: true,
          refDefault: { from: "productionOrder", match: "sourceOrderId", through: null, field: "issueWarehouseId" },
          help: "Required for this release. The starting value comes from the source order and can be adjusted to the actual issue warehouse for this batch",
        },
        {
          key: "completionWarehouseId",
          label: "Completion warehouse",
          type: "ref",
          ref: "warehouse",
          refDefault: { from: "productionOrder", match: "sourceOrderId", through: null, field: "completionWarehouseId" },
          help: "The starting value comes from the source order. When releasing this batch, adjust it to the actual completion warehouse",
        },
        { key: "remark", label: "Line remark", type: "text" },
  ],
}, "productionOrder.batchActions.releaseProduction.lineField");

/**
 * Transition parameters are a payload the caller has already assembled. They do not reuse the workbench's internal fill-in.
 * The workbench still uses `releaseDraftLineField` for seed, linkage, and calculation. After the submit boundary every cell is an explicit input.
 */
const releaseTransitionLineField = {
  ...releaseDraftLineField,
  key: "releaseLines",
  label: "Lines released this time",
  required: true,
  fields: (releaseDraftLineField.fields ?? []).map((column) => ({
    ...column,
    // The companion ref of a refLine is treated by `isSystemSupplied` as a value filled at resolve time. The action payload already has both ids from the workbench.
    type: column.type === "refLine" ? ("string" as const) : column.type,
    ref: column.type === "refLine" ? null : column.ref,
    refFilter: null,
    through: null,
    primary: false,
    unique: false,
    uniqueWith: null,
    auto: false,
    createDefault: null,
    derive: null,
    snapshot: null,
    refDefault: null,
    calculate: null,
    unitChoice: null,
    refPreselect: null,
    lineAgg: null,
    pushFrom: null,
  })),
};

/**
 * Second table of production order Schedule production: expand the routing's operations, and the person picks team, equipment, mold, and start and end.
 * Equipment and mold types are brought from the operation master by the client, only to filter the choices, and they are not stored.
 * An operation with no type makes the matching cell unselectable. A filled type lists only active records of that type.
 */
const scheduleProcessLinesField = normalizeField({
  key: "processLines",
  label: "Line occupancy lines",
  type: "subtable",
  ref: "productionOrderScheduleProcessInput",
  required: false,
  fields: [
    { key: "operationId", label: "Operation", type: "ref", ref: "operation", required: true },
    { key: "sequence", label: "Operation sequence", type: "number", required: true },
    { key: "productionLineOrgId", label: "Production line", type: "ref", ref: "orgUnit", required: true, refFilter: { orgType: "line", status: "active" } },
    { key: "equipmentType", label: "Equipment type", type: "string" },
    { key: "moldType", label: "Mold type", type: "string" },
    { key: "equipmentId", label: "Equipment", type: "ref", ref: "equipment", refFilter: { status: "active" } },
    { key: "moldId", label: "Mold", type: "ref", ref: "mold", refFilter: { status: "active" } },
    { key: "plannedStartDate", label: "Start time", type: "datetime", required: true },
    { key: "plannedEndDate", label: "End time", type: "datetime", required: true },
  ],
}, "productionOrder.release.params.processLines");

const scheduleProcessLinesParam = {
  key: "processLines",
  label: "Line occupancy lines",
  type: "billLines" as const,
  required: false,
  lineField: scheduleProcessLinesField,
  fixedRows: true,
  readOnlyColumns: ["operationId"],
  hiddenColumns: ["sequence", "equipmentType", "moldType"],
};

function releaseParams() {
  return [
    { key: "releaseMode", label: "Release method", type: "text" as const, required: true },
    {
      key: "releaseLines",
      label: "Lines released this time",
      type: "billLines" as const,
      required: true,
      lineField: releaseTransitionLineField,
    },
    scheduleProcessLinesParam,
  ];
}

async function releaseSalesOnProductionSettled(ctx: PlannerContext): Promise<ExecutionPlan> {
  return {
    version: 1,
    commands: [...await releaseSalesAfterProductionSettled(ctx, requireText(ctx.bill.id, "Production order id"))],
  };
}

const OPEN_ASSIGNMENT_STATUSES = ["pendingReview", "awaitingProduction", "inProduction"] as const;
const OPEN_TASK_STATUSES = ["pendingReview", "awaitingLaunch", "inProduction"] as const;
const ALL_TASK_STATUSES = ["pendingReview", "awaitingLaunch", "inProduction", "completed", "cancelled"] as const;

/** Status to push on a subcontract order when the production order closes. Complete leaves an already completed order alone. Cancel withdraws a completed order too. */
const SUBCONTRACT_COMPLETE_STATUSES = ["pendingReview", "awaitingOutsource", "processing"] as const;
const SUBCONTRACT_CANCEL_STATUSES = ["pendingReview", "awaitingOutsource", "processing", "completed"] as const;

async function listAllHeaders(
  ctx: PlannerContext,
  module: string,
  field: string,
  value: string,
  statuses: readonly string[],
): Promise<readonly Readonly<Record<string, unknown>>[]> {
  const rows: Readonly<Record<string, unknown>>[] = [];
  const limit = 100;
  for (let offset = 0; ; offset += limit) {
    const page = await ctx.read.listBills(module, {
      where: {
        kind: "group",
        join: "and",
        children: [
          { kind: "cond", field, op: "eq", value },
          { kind: "cond", field: "status", op: "in", value: [...statuses] },
        ],
      },
      search: null,
      sort: [{ field: "createdAt", desc: false }],
      limit,
      offset,
    });
    rows.push(...page.rows);
    if (rows.length >= page.total || page.rows.length < limit) return rows;
  }
}

async function subcontractSettlementCommands(
  ctx: PlannerContext,
  taskIds: ReadonlySet<string>,
  completing: boolean,
): Promise<readonly ExecutionCommand[]> {
  if (taskIds.size === 0) return [];
  const statuses = completing ? SUBCONTRACT_COMPLETE_STATUSES : SUBCONTRACT_CANCEL_STATUSES;
  const rows: Readonly<Record<string, unknown>>[] = [];
  const limit = 100;
  for (let offset = 0; ; offset += limit) {
    const page = await ctx.read.listBills("subcontractOrder", {
      where: {
        kind: "group",
        join: "and",
        children: [
          { kind: "cond", field: "status", op: "in", value: [...statuses] },
          { kind: "cond", field: "lines.productionTaskId", op: "in", value: [...taskIds] },
        ],
      },
      search: null,
      sort: [{ field: "createdAt", desc: false }],
      limit,
      offset,
    });
    rows.push(...page.rows);
    if (rows.length >= page.total || page.rows.length < limit) break;
  }

  const commands: ExecutionCommand[] = [];
  for (const row of rows) {
    const id = requireText(row["id"], "Subcontract order id");
    const status = requireText(row["status"], "Subcontract order status");
    const bill = await ctx.read.getBill("subcontractOrder", id);
    const linked = (bill.lines["lines"] ?? []).some((line) => {
      const taskId = line["productionTaskId"];
      return typeof taskId === "string" && taskIds.has(taskId);
    });
    if (!linked) continue;
    commands.push({
      type: "setStatus",
      commandId: `${completing ? "complete" : "cancel"}-subcontract-order-${id}`,
      target: { kind: "existing", module: "subcontractOrder", id },
      transition: completing ? "forceComplete" : "forceCancel",
      expectedStatus: status,
    });
  }
  return commands;
}

/**
 * Closing a production order only closes responsibility. It does not invent output facts. Unfinished quantity is closed as zero output, so this only sends status commands.
 * It does not create a report, a subcontract receipt, a completion receipt, or a stock movement.
 */
async function settleProductionOrder(ctx: PlannerContext): Promise<ExecutionPlan> {
  const completing = ctx.transition === "complete";
  const orderId = requireText(ctx.bill.id, "Production order id");
  const commands: ExecutionCommand[] = [];

  const assignments = await listAllHeaders(
    ctx,
    "processAssignment",
    "productionOrderId",
    orderId,
    OPEN_ASSIGNMENT_STATUSES,
  );
  for (const row of assignments) {
    const id = requireText(row["id"], "Assignment id");
    const status = requireText(row["status"], "Assignment status");
    commands.push({
      type: "setStatus",
      commandId: `${completing ? "complete" : "cancel"}-process-assignment-${id}`,
      target: { kind: "existing", module: "processAssignment", id },
      transition: completing ? "forceComplete" : "forceCancel",
      expectedStatus: status,
    });
  }

  const allTasks = await listAllHeaders(ctx, "productionTask", "productionOrderId", orderId, ALL_TASK_STATUSES);
  const taskIds = new Set(allTasks.map((row) => requireText(row["id"], "Production task id")));
  commands.push(...await subcontractSettlementCommands(ctx, taskIds, completing));
  for (const row of allTasks.filter((task) => OPEN_TASK_STATUSES.includes(task["status"] as typeof OPEN_TASK_STATUSES[number]))) {
    const id = requireText(row["id"], "Production task id");
    const status = requireText(row["status"], "Production task status");
    commands.push({
      type: "setStatus",
      commandId: `${completing ? "complete" : "cancel"}-production-task-${id}`,
      target: { kind: "existing", module: "productionTask", id },
      transition: completing ? "forceComplete" : "forceCancel",
      expectedStatus: status,
    });
  }

  commands.push(...await releaseSalesAfterProductionSettled(ctx, orderId));
  return { version: 1, commands };
}

/** Complete: an order in production closes tasks and assignments as zero output. An old-path order sitting on reported only releases sales. */
async function completeProductionOrder(ctx: PlannerContext): Promise<ExecutionPlan> {
  return requireText(ctx.bill.header["status"], "Production order status") === "reported"
    ? await releaseSalesOnProductionSettled(ctx)
    : await settleProductionOrder(ctx);
}

export const planners = definePlanners(
  {
    release: productionBatchReleasePlan,
    complete: completeProductionOrder,
    cancel: settleProductionOrder,
  },
  {
    release: ["materialRequirement", "productionTask"],
  },
);

export const batchActions = defineBatchActions({
  releaseProduction: {
    // The business says Schedule production (requirement wiki 244431994, section 4.5, production order:
    // awaiting release can run Schedule production and subcontract production). Release is the system word. The button
    // has always said Schedule production, while the workbench title said production release, so a reader would think they were two things.
    label: "Schedule production",
    sourceStatuses: ["awaitingRelease", "releasing", "inProduction"],
    sourceTable: "lines",
    // The workbench list and prepare use the same measure. A line enters the source scope only when its remainder is greater than 0. A fully released line is removed.
    sourceRemaining: "pendingReleaseBaseQty",
    transition: "release",
    internalTransitions: ["markReleased"],
    lineField: releaseDraftLineField,
    seed: {
      sourceOrderLineId: { from: "line", field: "id" },
      sourceOrderId: { from: "bill" },
      productId: { from: "line", field: "productId" },
      spec: { from: "line", field: "spec" },
      unit: { from: "line", field: "unit" },
      unitFactor: { from: "line", field: "unitFactor" },
      orderBaseQty: { from: "line", field: "baseQty" },
      releaseQty: { from: "line", field: "pendingReleaseQty" },
      bomId: { from: "line", field: "bomId" },
      routingId: { from: "line", field: "routingId" },
      productionOrgId: { from: "header", field: "productionOrgId" },
      // The only basis the planner has for planned start and end. The order header cell is a live lookup of salesOrder.promiseDate.
      // The projection carries the value (a derived column emits a subquery, not a column name), so it can be read here.
      // Without this item that column on the workbench is always empty. Prepare first clears every cell to null and overwrites only what seed covers.
      promiseDate: { from: "header", field: "promiseDate" },
      issueWarehouseId: { from: "header", field: "issueWarehouseId" },
      completionWarehouseId: { from: "header", field: "completionWarehouseId" },
    },
    // A platform batch action requires at least one mode slot. Production no longer offers merge or do-not-merge.
    // Only this item remains. The workbench submits it, and the screen no longer treats it as a scheduling choice.
    modes: [
      { value: "separate", label: "Confirm schedule", primary: true },
    ],
    modeParam: "releaseMode",
    linesParam: "releaseLines",
  },
});

// ---------------------------------------------------------------------------
// Production order. The only catalog-module escape hatch in the workspace.
//
// Production release is a batch action on the set of production orders. It no longer lands an intermediate business document. The list workbench only
// assembles this batch's lines in memory. The planner re-reads the source facts and emits an atomic plan of tasks, operations, and material requirements.
//
// What remains of this document is its original sentence: what to make, how much, which factory, and where this batch is now
// (releasing / inProduction / finished). Those statuses are pushed by downstream facts. This document does not compute them. Reported is an old-path leftover.
// ---------------------------------------------------------------------------

export default defineModule({
  label: "Production order",
  // Custom fields are open to the tenant, so this table has a `custom jsonb` column and a GIN index.
  // The chain product → sales order → production order → production task → assignment / shipment
  // is where industry-specific fields are most often passed through, so it is opened first. Open another table by adding this line and shipping a release.
  customFields: true,
  numbering: { prefix: "MO", seqScope: "day" },

  fields: [
    { key: "code", label: "Production order no.", type: "string", primary: true, auto: true },
    // This cell says who makes it, not why it is made.
    // The old values were make-to-order, make-to-stock, and subcontract production, mixing two orthogonal axes in one field.
    // The first two say where demand came from, and whether `salesOrderId` has a value already says that. Keeping them would be a second source of truth.
    // Only the third says who manufactures it. In-house processing (repack or relabel stock already on hand) is a kind of production that really runs,
    // and it did not exist before.
    {
      key: "productionType",
      label: "Production type",
      type: "enum",
      options: [
        { value: "standardProduction", label: "Standard production" },
        { value: "subcontractProduction", label: "Subcontract production" },
        { value: "inHouseProcessing", label: "In-house processing" },
      ],
      required: true,
    },
    { key: "customerId", label: "Customer", type: "ref", ref: "customer" },
    {
      key: "salesOrderId",
      label: "Source sales order",
      type: "ref",
      ref: "salesOrder",
      help: "Records the source when production is organized from a sales order. Make-to-order versus make-to-stock is whether this cell has a value, not a separate enum",
    },
    /**
     * Expected delivery date, from the source sales order's promised date.
     *
     * A lookup, not a snapshot. When sales changes the delivery date with the customer, the shop should see the change
     * (it is the same promise, not a historical fact frozen on this document). Freezing it looks like
     * sales already moved the customer to next week while the shop is still rushing the original day.
     *
     * A production order created by hand (no source sales order) leaves this cell empty. That is correct. There is no customer promise.
     */
    {
      key: "promiseDate",
      label: "Expected delivery date",
      type: "date",
      derive: { kind: "lookup", from: "salesOrder", match: "salesOrderId", field: "promiseDate" },
    },
    // This is not `required`. It may be empty while pending review and is required at approval (see `submit_fields_required` below).
    // `required` means required at save time (it becomes a NOT NULL column), including pending review.
    // The main source of this document is a push from a sales order (`salesOrder.to_production`).
    // A sales order has no factory cell, and `buildPushDraft` copies only fields with the same key and type,
    // so a pushed pending-review document is always missing it and the push returns 400. The system in use sends "to be assigned" here,
    // which says the same thing: at the moment the order is taken, nobody yet knows which factory it goes to.
    // Candidates list only the factory level. The rule and `production_org_is_factory` below are the same sentence at two moments,
    // not a gate that was moved. The filter says who can be chosen when typing. The gate says whether it still holds at approval.
    // Only the gate's consequence was measured. Organizations were listed in full in the dropdown,
    // a user could pick a non-factory node and save the document, and it was rejected only on Approve, without saying which choices were valid then.
    {
      key: "productionOrgId",
      label: "Factory",
      type: "ref",
      ref: "orgUnit",
      refFilter: { orgType: "factory" },
      help: "Released production tasks and material requirements hang off this record",
    },
    // Planned start and end were removed from this document. The planner fills the schedule window line by line on the batch release workbench,
    // and it lands on the production task (planned start / planned end). The order only answers what to make, how much, and which factory.
    // It does not ask which day work starts. That is decided at release.
    //
    // The warehouses stay on the order, but they are decided at release. When the order is taken, nobody yet knows which warehouse issues material
    // or which warehouse receives the completion, so both cells are optional.
    // `awaitingRelease` must leave these two cells editable (see `editableFields`). Otherwise they can never be filled after approval.
    // They cannot be deleted. Batch release prepare copies them onto the draft row,
    // and the planner can still adjust them when releasing this batch. The material requirement and the production task finally use the warehouse on the release line.
    // A missing issue warehouse is blocked on the batch release action's `*_issue_warehouse_required` (a block with a sentence a person can read),
    // and it can be filled on the workbench without going back to edit the source order.
    // The completion warehouse is not required at release. Release copies this line onto the task, an empty cell stays empty,
    // and the actual warehouse is chosen when the completion receipt is opened.
    { key: "completionWarehouseId", label: "Completion warehouse", type: "ref", ref: "warehouse", help: "Completion receipts post to this warehouse. At release it is copied to the release line as an overridable starting value. Optional" },
    { key: "issueWarehouseId", label: "Issue warehouse", type: "ref", ref: "warehouse", help: "Material requirements and issues leave this warehouse. It is required on a batch release" },

    // The detail is `maxRows: 1` (one order, one product), so this cell is how much this order released, not a sum of several lines.
    // It exists to give downstream reports a header coordinate. The wage report needs to show order quantity on the list,
    // and from a pay slip only the order header is reachable (one `lookup` hop), not the order line.
    // Business users are not shown it again (the line already says it), so it is `hidden`.
    { key: "orderQty", label: "Order quantity", type: "number", hidden: true, lineAgg: { of: "lines", measure: "sum(qty)" } },

    // One order, one product (`maxRows: 1`). Sales release to production splits documents per line on this cell. A hand-created order cannot add a second line either.
    // BOM and routing follow the product, so they live on the line, not the header.
    // Release is one line, one task. It no longer merges the same product from several orders into one task.
    {
      key: "lines",
      label: "Production lines",
      type: "subtable",
      ref: "productionOrderLine",
      required: true,
      maxRows: 1,
      fields: [
        // Candidates list only the two types that can be made in house. The reason is not taste. `bom_product_makeable` says
        // only semi-finished goods and finished goods can have a BOM, and both release edges carry `*_bom_matches_product`
        // (this line's BOM must belong to this line's product). A line that picked raw material or packaging can never find a legal BOM.
        // From the moment the order is entered it cannot be released, and nothing says so before release.
        //
        // Known cost: when a sales order sells raw material, `salesOrder.to_production` returns 400 instead of
        // creating a production order that could never be released. The rule is a static attribute. productType is this SKU's
        // inherent class. It will not be pushable today and not tomorrow. A temporal attribute such as `status` is deliberately kept out of the filter (see below).
        // The two source references appear as a pair (the kernel requires exactly one companion ref for a refLine at the same level).
        // `salesOrderSourceId` is for reverse lookup (related documents on the sales order detail can also connect per line).
        // `salesOrderLineId` is the per-line total of how much of this order line has been released to production and how much is left.
        // Storage fills the companion column. The client has no second input.
        {
          key: "salesOrderSourceId",
          label: "Source sales order",
          type: "ref",
          ref: "salesOrder",
          hidden: true,
        },
        {
          // 3.5.x: where a partial release to production lands. This cell remembers which sales order line this line came from.
          //
          // Sales release to production used to convert the whole order. An order for 1000 pieces could only become one production order for 1000 pieces.
          // The shop sentence "only 300 of these 1000 pieces are made in house" had no expression in the system.
          // It is a line reference (`refLine`), not only the header `salesOrderId`.
          // Only a pointer at the line can compute how much of this order line has already been released and how much is left.
          // A header link can only answer whether this order has been released, which is what the old one-shot gate judged.
          //
          // Not required. A hand-created production order, and subcontract or make-to-stock production, have no source sales order line.
          // Hidden. The value is a detail-line id, and on screen it is only a uuid.
          // When the user wants to see the source, they look at the sales order number on the header.
          key: "salesOrderLineId",
          label: "Source sales order line",
          type: "refLine",
          ref: "salesOrder",
          through: "lines",
          hidden: true,
        },
        { key: "productId", label: "Product", type: "ref", ref: "product", required: true, refFilter: { canProduce: true } },
        { key: "qty", label: "Production quantity", type: "number", required: true },
        {
          key: "unit",
          label: "Unit",
          type: "enum",
          required: true,
          refDefault: { from: "product", match: "productId", through: null, field: "mainUnit" },
          unitChoice: { match: "productId", factorInto: "unitFactor" },
        },
        { key: "unitFactor", label: "Unit factor", type: "number" },
        { key: "baseQty", label: "Production quantity in main unit", type: "number", calculate: { op: "mul", args: [{ field: "qty" }, { field: "unitFactor" }] } },
        {
          key: "releasedBaseQty",
          label: "Released on this line (main unit)",
          type: "number",
          help: "Summed by order line from the source-application lines of active production tasks. A cancelled task does not consume released quantity",
          derive: {
            kind: "rollup",
            from: "productionTask",
            through: "allocations",
            match: "sourceOrderLineId",
            measure: "sum(allocatedBaseQty)",
            where: { status: [...LIVE_TASK_STATUSES] },
          },
        },
        { key: "releasedQty", label: "Released on this line", type: "number", derive: { kind: "formula", expr: { op: "div", args: [{ field: "releasedBaseQty" }, { field: "unitFactor" }] } } },
        {
          key: "pendingReleaseBaseQty",
          label: "Still to release on this line (main unit)",
          type: "number",
          derive: { kind: "formula", expr: { op: "sub", args: [{ field: "baseQty" }, { field: "releasedBaseQty" }] } },
        },
        {
          key: "pendingReleaseQty",
          label: "Still to release on this line",
          type: "number",
          help: "Production quantity minus what this line has already released. A batch release uses this as the default quantity when the line is selected",
          derive: { kind: "formula", expr: { op: "div", args: [{ field: "pendingReleaseBaseQty" }, { field: "unitFactor" }] } },
        },
        // Each productId is already a standalone SKU. The specification is brought from that same header. There is no fallback that guesses a hand-typed value.
        { key: "spec", label: "Specification", type: "string", refDefault: { from: "product", match: "productId", through: null, field: "spec" } },
        // Same as the two warehouses. BOM and routing are frozen at release, not when the order is placed.
        // A sales order cannot have these two cells, so a push arrives empty. `required` becomes a NOT NULL column,
        // including pending review, so without the downgrade the push cannot land.
        // The gate was not dropped. It changed host. `bomId` / `routingId` on the workbench line are `required`,
        // and their starting values are brought from these two cells by `refDefault`. When the order leaves them empty, the workbench cell
        // is empty too, the value gate rejects immediately (required), and an order missing a BOM still cannot be released.
        //
        // Candidates are narrowed to this line's product and only active versions. The `refFilter` matches the two cells on the workbench line
        // (the same business sentence must not have two wordings).
        // The `$line.` prefix reads the same line. A BOM follows the product. Reading the header would use the whole order's wording.
        // When that cell is not selected yet, the candidates are an empty set and the prompt is "Select the product to make first". It does not fall back to "no filter".
        // Falling back is exactly the behavior this capability exists to remove (listing the whole tenant),
        // and it happens only when the upstream cell happens to be empty, which is the hardest case to reproduce.
        // It is still not `required` (a sales push of a pending-review document has no BOM). Approval blocks with the fail-closed
        // `submit_bom_matches_product` (ref_field_compare). Required means at approve, not at save.
        //
        // Candidates default to this product's currently active version (`refPreselect`), and can still be switched.
        // The acceptance wording was "when a production order is in production it should link the product's BOM and routing,
        // and it should also be possible to switch". Both sentences are required. Auto-select alone becomes a snapshot (it cannot be changed).
        // Candidates alone is what happens today (every line makes a person hunt the version list for the active one).
        // It picks the one row inside this cell's candidates (already narrowed by productId + status=active),
        // so the value filled automatically is one the user can also pick in the dropdown. It fills only when there is exactly one.
        // Zero (this product has no BOM yet) or more than one (dirty history with two active versions) stays empty and does not guess.
        {
          key: "bomId",
          label: "BOM",
          type: "ref",
          ref: "bom",
          refFilter: { productId: { from: "$line.productId" }, status: "active" },
          refPreselectSole: true,
          help: "Required before submit for approval. Material requirements explode from it. Selecting the product lands on that product's current active version, which can be switched",
        },
        {
          key: "routingId",
          label: "Routing",
          type: "ref",
          ref: "routing",
          refFilter: { productId: { from: "$line.productId" }, status: "active" },
          refPreselectSole: true,
          help: "Required before scheduling. Operations and rates are frozen from it. Selecting the product lands on that product's current active version, which can be switched",
        },
        { key: "remark", label: "Line remark", type: "text" },
      ],
    },
    {
      key: "attachments",
      label: "Attachments",
      type: "attachment",
      help: "Drawings, process files, and the customer's confirmation. A module in this workspace already declares attachment, and OBS credentials are already required at startup",
    },
    { key: "remark", label: "Remarks", type: "text" },
  ],

  lifecycle: {
    statuses: [
      // There is no draft. Creating the document means pendingReview (requirement wiki 244431994, section 4.5, production management:
      // there is no draft status; creating the document means pending review, and pending review can be edited).
      // A production order has only two sources, sales release to production and hand create, and both produce a document waiting for review.
      //
      // The whitelist excludes `salesOrderId`. The source sales order is the push coordinate. Create and release-to-production writes still use
      // `creatableFields` (not constrained by this whitelist). Changing it after save would make the sales-to-production reverse lookup and
      // the "already released to production" gate point at different sources.
      {
        key: "pendingReview",
        label: "pendingReview",
        color: "amber",
        initial: true,
        editable: "whitelist",
        editableFields: [
          "productionType",
          "customerId",
          "productionOrgId",
          "completionWarehouseId",
          "issueWarehouseId",
          "lines",
          "attachments",
          "remark",
        ],
      },
      // The four cells this status leaves editable are decided at release (completion warehouse, issue warehouse, and each line's BOM and routing,
      // the last two live in `lines`). It does not unlock the whole document after approval.
      // After they were downgraded from `required` to "required before release", leaving them locked here means they can never be filled after approval,
      // and the document can never be released. The downgrade and the unlock are two halves of one decision. Missing either half fails with no error.
      //
      // Leaving `lines` editable in this status is safe. `awaitingRelease` means reviewed and not yet released.
      // No production task exists yet, so changing quantity, adding a line, or deleting a line has no downstream to reconcile.
      // `releasing` / `inProduction` deliberately do not unlock `lines`. Those two statuses already have tasks and reports underneath.
      // The gate "a line that already has a report cannot change quantity or be deleted" cannot be attached. Preconditions attach only to edges,
      // and editing goes through `billRepo.save`, which has no precondition hook.
      // See the report "needs a platform capability": line-level preconditions on the save path.
      {
        key: "awaitingRelease",
        // 3.5.0 product wording: awaiting release. Release is the system word. The business says this document has not been sent to the shop yet.
        // The key does not move. It is the stored value. Changing the key would change the status of every historical order.
        label: "Awaiting release",
        color: "blue",
        editable: "whitelist",
        editableFields: ["completionWarehouseId", "issueWarehouseId", "lines", "remark"],
      },
      // releasing is not a decorative status. It carries "tasks have been scheduled, and the shop has not accepted the first one".
      // Without it, an order would have to be called in production as soon as a task is created, and the planner could not separate "scheduled, not started"
      // from "the shop is already working". An additional release still rechecks the remaining lines from the list. The order stays on releasing,
      // and the planner does not push the status again.
      // In 3.5.0 the business calls releasing "awaiting production".
      { key: "releasing", label: "awaitingProduction", color: "blue", editable: "whitelist", editableFields: ["remark"] },
      // Entered after any related task is approved (the product flow's own wording). The remaining plan can still be released.
      // The task starts first and the remainder is released later. Quantity still to release is a number on the line, not the definition of this status.
      { key: "inProduction", label: "inProduction", color: "purple", editable: "whitelist", editableFields: ["remark"] },
      // Old-path leftover status, retired. The database may still have historical rows sitting here, so the key stays or that data would be invalid.
      // New path: when every task is done the order goes from in production straight to completed, and it no longer enters reported.
      // The related edges reportDone / reopenAfterReportCorrection stay internal. Complete on reported
      // exists only to close historical data. It does not appear in the flow for a new document.
      { key: "reported", label: "reported (legacy)", color: "gray", editable: "none" },
      { key: "finished", label: "completed", color: "green", terminal: true, editable: "none" },
      { key: "cancelled", label: "cancelled", color: "red", terminal: true, editable: "none" },
    ],
    transitions: [
      { code: "approve", from: "pendingReview", to: "awaitingRelease", action: "Approve", primary: true },
      // Cancel is open to the user only on awaiting release / awaiting production. Pending review keeps an internal escape edge so the framework cascade can clean a pushed draft.
      { code: "forceCancelFromReview", from: "pendingReview", to: "cancelled", action: "Cancel with production order", internal: true },
      // Pending review has no reject. It is already the first status, so there is nothing to reject back to (the operations on this status in the requirement are
      // view / edit / delete / approve / cancel). The way back is on later statuses (`rejectRelease`
      // returns awaiting release to pending review). Only then is there a previous status to return to.
      // This edge is no longer the release action itself. It only records that this order has been released.
      // The real schedule (create the production task and material requirement; when processLines are present, write operations onto the task)
      // lives on the batch planner in this directory. After it creates them it pushes this edge with `setStatus`.
      // The server hands it back to the same evaluate → execute, and the `release_has_allocation` gate below still runs.
      // The name was changed to "mark released" instead of "release production". A person clicking it would think they
      // released a batch of work, and this edge creates no production task.
      {
        code: "release",
        from: "awaitingRelease",
        to: "releasing",
        action: "Schedule production",
        params: releaseParams(),
      },
      {
        code: "release",
        from: "releasing",
        to: "releasing",
        action: "Schedule production",
        remaining: "lines.pendingReleaseBaseQty",
        params: releaseParams(),
      },
      {
        code: "release",
        from: "inProduction",
        to: "inProduction",
        action: "Schedule production",
        remaining: "lines.pendingReleaseBaseQty",
        params: releaseParams(),
      },
      { code: "markReleased", from: "awaitingRelease", to: "releasing", action: "Sync release status" },
      {
        code: "rejectDispatch",
        from: "awaitingRelease",
        to: "pendingReview",
        action: "Reject release",
        confirm: true,
        params: [{ key: "dispatchRejectReason", label: "Reject reason", type: "text", required: true }],
      },
      // This edge moves when an assignment starts. Approving a task and scheduling operations only prepare facts. They must not call the order in production early.
      { code: "startProduction", from: "releasing", to: "inProduction", action: "Move to in production", internal: true },
      // Old-path leftover: inProduction → reported. The new path does not enter it and has no button a person can click.
      { code: "reportDone", from: "inProduction", to: "reported", action: "Sync reporting complete", internal: true },
      { code: "reopenAfterReportCorrection", from: "reported", to: "inProduction", action: "Sync report reversal", internal: true },
      // Order completion may force a close. Unfinished tasks and assignments are closed as zero output. It does not invent a report, a receipt, or a stock fact.
      { code: "complete", from: "inProduction", to: "finished", action: "Complete", confirm: true },
      // A historical order already on reported can still be closed on the old path.
      { code: "complete", from: "reported", to: "finished", action: "Complete", confirm: true },
      // Used when the report planner flattens consequences. complete has its own planner, so setStatus must not push it nested.
      {
        code: "syncComplete",
        from: "inProduction",
        to: "finished",
        action: "Sync task completion",
        internal: true,
      },
      {
        code: "reopenAfterTaskReopened",
        from: "finished",
        to: "inProduction",
        action: "Sync task reopen",
        internal: true,
      },
      { code: "cancel", from: "awaitingRelease", to: "cancelled", action: "Cancel", confirm: true },
      { code: "cancel", from: "releasing", to: "cancelled", action: "Cancel", confirm: true },
      // The sales order complete / cancelRunning planner pushes these edges with setStatus (it does not nested-run this document's planner).
      { code: "forceComplete", from: "pendingReview", to: "finished", action: "Complete with sales order", internal: true },
      { code: "forceComplete", from: "awaitingRelease", to: "finished", action: "Complete with sales order", internal: true },
      { code: "forceComplete", from: "releasing", to: "finished", action: "Complete with sales order", internal: true },
      { code: "forceComplete", from: "inProduction", to: "finished", action: "Complete with sales order", internal: true },
      { code: "forceComplete", from: "reported", to: "finished", action: "Complete with sales order", internal: true },
      { code: "forceCancel", from: "awaitingRelease", to: "cancelled", action: "Cancel with sales order", internal: true },
      { code: "forceCancel", from: "releasing", to: "cancelled", action: "Cancel with sales order", internal: true },
      { code: "forceCancel", from: "inProduction", to: "cancelled", action: "Cancel with sales order", internal: true },
      { code: "forceCancel", from: "reported", to: "cancelled", action: "Cancel with sales order", internal: true },
    ],
  },

  preconditions: [
    {
      id: "order_lines_required",
      onTransition: "approve",
      source: "invariant",
      level: "block",
      why: "A production order with no product lines has nothing to make",
      check: { primitive: "lines_not_empty" },
    },
    {
      id: "production_qty_positive",
      onTransition: "approve",
      source: "invariant",
      level: "block",
      why: "Each line's production quantity must be positive. Zero or a negative quantity is not an executable production obligation",
      check: { primitive: "lines_all", left: { ref: "$line.qty" }, op: "gt", right: { value: 0 } },
    },
    {
      // The standard shape of "optional while pending review, required before approval" (stated in AGENTS.md). Declaring the cell
      // `required` is a different level. `required` governs the moment of save (including pending review).
      // This governs the moment of moving forward. A pushed pending-review document can therefore be saved, and an order missing a factory cannot reach approval.
      id: "submit_fields_required",
      onTransition: "approve",
      source: "invariant",
      level: "block",
      why: "The factory is what approval decides. Without it, approval would accept an order that belongs nowhere",
      check: {
        primitive: "required_fields",
        fields: ["productionOrgId"],
      },
    },
    {
      id: "production_org_is_factory",
      onTransition: "approve",
      source: "gate",
      level: "block",
      why: "Factory can only be a node whose organization type is factory. Choosing a workshop puts the order in the wrong place, and nothing else will report the error",
      check: {
        primitive: "ref_field_compare",
        via: "productionOrgId",
        entity: "orgUnit",
        through: null,
        field: "orgType",
        op: "eq",
        right: { value: "factory" },
      },
    },
    {
      // BOM is required at approval. An empty reference fails closed ("BOM is not filled in"), and the product ownership is checked at the same time.
      // It is not `required`. A sales push of a pending-review document has no BOM, and required-at-save would make release to production return 400 immediately.
      // It is also not a header `required_fields`. That primitive only looks at `ctx.bill` and cannot see a cell on the line.
      id: "submit_bom_matches_product",
      onTransition: "approve",
      source: "invariant",
      level: "block",
      why: "Each line needs a BOM for that product before approval. Approval accepts an explodable material list, not an empty shell",
      check: {
        primitive: "ref_field_compare",
        via: "$line.bomId",
        entity: "bom",
        through: null,
        field: "productId",
        op: "eq",
        right: { ref: "$line.productId" },
      },
    },

    {
      id: "mark_released_has_allocation",
      onTransition: "markReleased",
      source: "gate",
      level: "block",
      message: "This order has no production-task application yet, so it cannot be synced to releasing",
      why: "This edge only lets a batch-release plan sync other source orders after the task is created. It is not a manual status bypass",
      check: {
        primitive: "related_agg",
        from: "productionTask",
        through: "allocations",
        match: "sourceOrderId",
        on: "id",
        agg: "sum",
        measure: "allocatedBaseQty",
        where: { status: [...LIVE_TASK_STATUSES] },
        op: "gt",
        right: { value: 0 },
        plus: null,
      },
    },

    // ── releasing → inProduction ─────────────────────────────────────────────────────
    // Moving to in production no longer requires every line to be fully scheduled. The product rule is: when any assignment starts, the order enters production.
    // The remaining plan can still be released while in production. The "fully scheduled" gate moved to `syncComplete`, so an unfinished schedule does not close the document.

    // Integrity gate on the historical automatic-complete edge.
    {
      id: "dispatch_allocated_in_full",
      onTransition: "syncComplete",
      source: "gate",
      level: "block",
      message: "This order still has plan quantity that is not on a task. Schedule the remainder, or that part of the plan will never be made",
      why: "Finishing the order means this plan has all been sent to the shop. A batch release can make and release together, but the order cannot be closed while some of the plan is still unreleased",
      // The left side is the sum of allocation lines on live tasks. A cancelled task does not occupy allocated quantity,
      // so after a task is cancelled this gate blocks again, and the gap must be filled by a new batch release.
      //
      // Judged per line, not per document (`on: "$line.id"` times `match: "sourceOrderLineId"`).
      // A whole-document total and a per-line total are not the same gate. On a two-line order, product A scheduled 200 and product B scheduled nothing,
      // the document total is still at least the document quantity, so it would pass, while product B's line has no work.
      // It used to be writable only as a whole document, because `related_agg.on` did not accept this line's id (`id` is a platform field and could not be declared).
      // After the platform added `$line.id` / `$line.lineNo` to that check's allow-list, this gate can say what it actually means.
      // Per line, `plus` is still `null`. Allocated quantity is produced by the production task, and this document is not in that line set.
      check: {
        primitive: "related_agg",
        from: "productionTask",
        through: "allocations",
        match: "sourceOrderLineId",
        on: "$line.id",
        agg: "sum",
        measure: "allocatedBaseQty",
        where: { status: [...LIVE_TASK_STATUSES] },
        op: "gte",
        right: { ref: "$line.baseQty" },
        plus: null,
      },
    },
    {
      id: "production_tasks_reported",
      onTransition: "syncComplete",
      source: "gate",
      level: "block",
      message: "This order still has tasks that are not finished (awaitingLaunch, inProduction, or cancelled). The order can finish only after every task is completed. A cancelled task still counts as not finished. Batch-release again to put that quantity back",
      why: "A production order is finished only when every production task under it is completed. A task that has not started, or is in production, cannot be hidden by the order status",
      // Judge how many are still unfinished, not how many are finished. The second is also true for "3 in total, 2 finished",
      // which is exactly the case that must not pass. A cancelled task also counts as unfinished. It has no output, and the order cannot treat it as if it did not exist.
      check: {
        primitive: "related_agg",
        from: "productionTask",
        through: "allocations",
        match: "sourceOrderId",
        on: "id",
        agg: "count",
        measure: null,
        where: { status: [...UNFINISHED_TASK_STATUSES] },
        op: "eq",
        right: { value: 0 },
        plus: null,
      },
    },
    {
      id: "completed_production_task_required_sync",
      onTransition: "syncComplete",
      source: "gate",
      level: "block",
      message: "This order has no production task in completed. Finish requires at least one task that really finished. A task still in production does not count",
      why: "A production order needs at least one production task that really completed. An empty order cannot be marked finished from a receipt quantity alone",
      check: {
        primitive: "related_agg",
        from: "productionTask",
        through: "allocations",
        match: "sourceOrderId",
        on: "id",
        agg: "count",
        measure: null,
        where: { status: "completed" },
        op: "gte",
        right: { value: 1 },
        plus: null,
      },
    },
  ],

  // When production is withdrawn, sales must know, and the sales order must not get stuck in inProduction.
  //
  // The notification hangs on Cancel (awaitingRelease and releasing both have this edge).
  // The status exit is not in the handoff. Cancel has a planner. After this document is excluded, if no open document is unfinished,
  // it pushes `salesOrder.releaseToShip`. Cancelled does not count, so withdrawing the original order allows another release or a direct shipment.
  //
  // A make-to-stock order (`salesOrderId` empty) also sends the notification when it is cancelled. `handoff` has no condition.
  handoff: [
    {
      id: "notify_sales_cancel",
      kind: "notify",
      onTransition: "cancel",
      to: "sales-representative",
      title: "Production order cancelled",
      why: "Sales already answered the customer from the production plan. After production cancels, that date promise no longer holds, so a person must answer again instead of waiting for the customer to ask. If the shop has already issued material, also confirm with the customer whether to reschedule or switch to purchasing",
    },
  ],

  views: {
    list: {
      columns: ["code", "salesOrderId", "customerId", "promiseDate", "productionType", "productionOrgId", "createdAt", "status"],
      // The reference name is the document number. The type is a list column and is not joined into refOptions, or the selected state would be read as "Standard production".
      referenceLabel: ["code"],
      filters: ["status", "productionType", "salesOrderId", "customerId", "productionOrgId", "promiseDate", "createdAt"],
      searchable: ["code"],
      // Related production orders on the sales order detail share this default sort with this list. Newer documents come first.
      defaultSort: { field: "createdAt", desc: true },
    },
    // Planned start and end are fully removed. The two warehouses stay under Release warehouses. They are filled only before release, and the section is the moment they are filled.
    form: [
      {
        title: "Order",
        fields: [
          "code",
          "productionType",
          "salesOrderId",
          "customerId",
          "productionOrgId",
        ],
      },
      { title: "Production lines", fields: ["lines"] },
      { title: "Release warehouse", fields: ["issueWarehouseId", "completionWarehouseId"] },
      { title: "Attachments", fields: ["attachments"] },
      { title: "Other", fields: ["remark"] },
    ],
    // The header has two warehouse references. The renderer follows "several, do not guess, rather draw nothing" and draws none of the block.
    // This document is exactly where that block should be seen: stock already in the warehouse should not be scheduled for production again.
    // So it is declared, instead of left for the renderer to guess.
    //
    // Choosing the completion warehouse is not an arbitrary pick between two. The panel answers how much of this line's goods is on hand now.
    // This line's goods are output (finished goods or semi-finished goods), and output lands in the completion warehouse. The issue warehouse holds raw material.
    // Calculating against it would show a column of zeros: a panel of numbers that looks fine and answers the wrong question.
    // Whether raw material is enough is the material-requirement chain (`materialRequirement` issues from the issue warehouse).
    availability: { scopeField: "completionWarehouseId", lines: "lines", subjectField: "productId" },
  },
});
