import {
  defineModule,
  definePlanners,
  roundToScale,
  schemaFail,
  type ExecutionCommand,
  type ExecutionPlan,
  type PlanRecord,
  type PlannerContext,
  EXECUTION_TIME,
  requireText,
  requireNumber,
} from "@open-erp/metamodel";
import { planSubcontractReceiptReportCommands } from "../subcontractReceipt/confirmPlanner.ts";

function created(commandId: string) {
  return { kind: "createdId", commandId } as const;
}

/** awaitingOutsource, processing, and completed share one parameter set. The warehouse comes from the receipt dialog. The order header is only a default. */
const RECEIVE_PARAMS = [
  { key: "receiptDate", label: "Receipt date", type: "date" as const, required: false },
  { key: "warehouseId", label: "Receiving warehouse", type: "ref" as const, ref: "warehouse", required: false },
  { key: "receiptRemark", label: "Receipt remark", type: "text" as const, required: false },
  { key: "receiveLinesJson", label: "Receipt lines", type: "text" as const, required: false },
];

function taskIdsOf(ctx: PlannerContext): readonly string[] {
  return orderRows(ctx).map((row, index) => requireText(row["productionTaskId"], `Subcontract line ${index + 1} production task`));
}

/** Operation subcontract takes a task operation line. On approval, a task that is still awaiting production moves to in production. A task already in production stays put. */
function isProcessOutsourcing(ctx: PlannerContext): boolean {
  return requireText(ctx.bill.header["sourceType"], "Type") === "Operation subcontract";
}

/**
 * The subcontract lines are the rows this order takes on.
 *
 * Whole-order and Other: the same production task must not appear twice. Quantity, issue, and remaining receipt are all calculated per task.
 * Operation subcontract: one task may carry several operations. The unique key is `processLineId`.
 */
function orderRows(ctx: PlannerContext): readonly Readonly<Record<string, unknown>>[] {
  const rows = ctx.bill.lines["lines"] ?? [];
  if (rows.length === 0) schemaFail("This subcontract order has no lines, so this action cannot run");
  const process = isProcessOutsourcing(ctx);
  const seen = new Set<string>();
  for (const [index, row] of rows.entries()) {
    const at = `Subcontract line ${index + 1}`;
    if (process) {
      const processLineId = requireText(row["processLineId"], `${at}Operation line`);
      if (seen.has(processLineId)) schemaFail(`The same operation appears on more than one subcontract line (line ${index + 1}). Merge them into one line`);
      seen.add(processLineId);
      requireText(row["productionTaskId"], `${at}Production task`);
    } else {
      const taskId = requireText(row["productionTaskId"], `${at}Production task`);
      if (seen.has(taskId)) schemaFail(`The same production task appears on more than one subcontract line (line ${index + 1}). Merge them into one line`);
      seen.add(taskId);
    }
  }
  return rows;
}

/**
 * The subcontract WIP warehouse is the fixed destination of a subcontract issue. The operator should not have to fill it again after the push.
 * It is resolved from the warehouse master this tenant can see, so a physical id from one tenant is not hard-coded.
 */
async function wipWarehouseId(ctx: PlannerContext): Promise<string> {
  const wipWarehouses = await ctx.read.listBills("warehouse", {
    where: { kind: "cond", field: "name", op: "eq", value: "Subcontract WIP warehouse (gross, before consumption)" },
    search: null,
    sort: [{ field: "createdAt", desc: false }],
    limit: 2,
    offset: 0,
  });
  if (wipWarehouses.rows.length !== 1) {
    schemaFail(wipWarehouses.rows.length === 0 ? "The subcontract WIP warehouse was not found. Maintain the warehouse master first" : "More than one warehouse has the subcontract WIP name. Clean up the warehouse master first");
  }
  return requireText(wipWarehouses.rows[0]!["id"], "Subcontract WIP warehouse");
}

/**
 * On approval, source tasks and orders that are still waiting to start move to "inProduction".
 *
 * This is the moment the subcontract commitment actually holds. The same edge also reserves the payable exposure.
 * Doing it at create time does not work. A pending-review document nobody has approved yet must not freeze the shop's scheduling choices.
 *
 * - Whole-order, Other, and operation subcontract: a task in pending review or awaitingLaunch moves to inProduction. A task already in production is not moved again.
 * - Source production order: releasing moves to inProduction. An order already in production is not moved again.
 */
async function approvePlan(ctx: PlannerContext): Promise<ExecutionPlan> {
  const status = requireText(ctx.bill.header["status"], "Subcontract order status");
  if (status !== "pendingReview") schemaFail(`The subcontract order is "${status}", so it cannot be approved`);

  const process = isProcessOutsourcing(ctx);
  const commands: ExecutionCommand[] = [];
  const seen = new Set<string>();
  const orderIds = new Set<string>();
  for (const taskId of taskIdsOf(ctx)) {
    if (seen.has(taskId)) continue;
    seen.add(taskId);

    const task = await ctx.read.getBill("productionTask", taskId);
    const taskStatus = requireText(task.header["status"], `Production task status`);
    orderIds.add(requireText(task.header["productionOrderId"], "Production order of the production task"));

    if (process && (task.header["actualStartAt"] === null || task.header["actualStartAt"] === undefined || task.header["actualStartAt"] === "")) {
      commands.push({
        type: "setGeneratedHeader",
        commandId: `stamp-subcontract-task-start-${taskId}`,
        target: { kind: "existing", module: "productionTask", id: taskId },
        patch: { actualStartAt: EXECUTION_TIME },
        expectedStatus: taskStatus,
        expectedRevision: task.revision,
      });
    }

    if (taskStatus === "pendingReview") {
      commands.push({
        type: "setStatus",
        commandId: `start-subcontract-${taskId}`,
        target: { kind: "existing", module: "productionTask", id: taskId },
        transition: "startSubcontractFromReview",
        expectedStatus: "pendingReview",
      });
    } else if (taskStatus === "awaitingLaunch") {
      commands.push({
        type: "setStatus",
        commandId: `start-subcontract-${taskId}`,
        target: { kind: "existing", module: "productionTask", id: taskId },
        transition: "startSubcontract",
        expectedStatus: "awaitingLaunch",
      });
    } else if (taskStatus !== "inProduction") {
      schemaFail(
        `The production task is "${taskStatus}". ${process ? "Operation subcontract" : "Finished-goods subcontract"} can only take a task that is pending review, awaiting production, or in production`,
      );
    }
  }

  for (const orderId of orderIds) {
    const order = await ctx.read.getBill("productionOrder", orderId);
    const orderStatus = requireText(order.header["status"], "Production order status");
    if (orderStatus === "releasing") {
      commands.push({
        type: "setStatus",
        commandId: `start-subcontract-order-${orderId}`,
        target: { kind: "existing", module: "productionOrder", id: orderId },
        transition: "startProduction",
        expectedStatus: "releasing",
      });
    } else if (orderStatus !== "inProduction") {
      schemaFail(`The production order is "${orderStatus}". Schedule production before approving the subcontract order`);
    }
  }
  return { version: 1, commands };
}

async function issuePlan(ctx: PlannerContext): Promise<ExecutionPlan> {
  const status = requireText(ctx.bill.header["status"], "Subcontract order status");
  if (status !== "awaitingOutsource") schemaFail(`The subcontract order is "${status}", so a subcontract issue cannot be created`);
  const warehouseId = requireText(ctx.bill.header["issueWarehouseId"], "Sending warehouse");
  const rows = orderRows(ctx);
  const subcontractWarehouseId = await wipWarehouseId(ctx);

  const materialLines: PlanRecord[] = [];
  for (const [index, row] of rows.entries()) {
    const at = `Subcontract line ${index + 1}`;
    const taskId = requireText(row["productionTaskId"], `${at}Production task`);
    const task = await ctx.read.getBill("productionTask", taskId);
    const taskStatus = requireText(task.header["status"], `${at} production task status`);
    if (!["awaitingLaunch", "inProduction"].includes(taskStatus)) {
      schemaFail(`The production task at ${at} is "${taskStatus}", so a subcontract issue cannot be created`);
    }
    const bomId = requireText(task.header["bomId"], `${at} production task default BOM`);
    // Issue quantity explodes from the task's planned quantity, the same basis as the issue line's `requirementBaseQty`
    // (that cell is `productionQty × bomUnitQty × (1 + scrap)`, and `productionQty`
    // looks up the task's planned quantity). Using the order line's qty would make the two sides of the cumulative issue gate come from different sources.
    const plannedQty = requireNumber(task.header["plannedQty"], `${at}Task quantity`);
    const bom = await ctx.read.getBill("bom", bomId);
    const bomLines = bom.lines["lines"] ?? [];
    if (bomLines.length === 0) schemaFail(`The default BOM of the production task at ${at} has no lines, so a subcontract issue cannot be created`);
    for (const [bomIndex, line] of bomLines.entries()) {
      const bomAt = `${at} default BOM line ${bomIndex + 1}`;
      const unitQty = requireNumber(line["unitQty"], `${bomAt}Quantity per`);
      const lossRate = requireNumber(line["lossRate"], `${bomAt}Scrap rate`);
      const unitFactor = requireNumber(line["unitFactor"], `${bomAt}Unit factor`);
      if (unitFactor <= 0) schemaFail(`The unit conversion factor at ${bomAt} must be greater than zero`);
      const qty = roundToScale(plannedQty * unitQty * (1 + lossRate / 100) / unitFactor, "number", `${bomAt} subcontract issue quantity`);
      materialLines.push({
        taskLineId: requireText(line["id"], bomAt),
        productionTaskId: taskId,
        unit: requireText(line["unit"], `${bomAt}Unit`),
        qty,
      });
    }
  }

  return {
    version: 1,
    commands: [
      {
        type: "createBill",
        commandId: "subcontract-issue",
        module: "subcontractIssue",
        header: { orderId: ctx.bill.id, warehouseId, targetWarehouseId: subcontractWarehouseId },
        lines: { materialLines },
      },
      {
        type: "createReference",
        commandId: "order-issue-reference",
        source: { kind: "existing", module: "subcontractOrder", id: ctx.bill.id },
        target: created("subcontract-issue"),
      },
    ],
  };
}

function optionalNumber(value: unknown, label: string): number | null {
  if (value === undefined || value === null || value === "") return null;
  return requireNumber(value, label);
}

function optionalText(value: unknown): string | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  return value;
}

/** A subcontract date is stored as a datetime snapshot on the work report. */
function dateAsDateTime(value: unknown, label: string): string {
  const text = requireText(value, label).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return `${text}T00:00:00.000Z`;
  return text;
}

/**
 * Assignment columns on a subcontract work report are frozen from the subcontract order when there is no source assignment.
 * - Assigned quantity comes from the line's subcontract quantity
 * - Start and assigned-at come from the subcontract date
 * - End comes from the planned delivery date
 * - Cumulative reported quantity is this line's received quantity in the main unit plus this receipt, converted back to the display unit
 */
function assignmentFieldsFromOrder(input: {
  readonly orderHeader: Readonly<Record<string, unknown>>;
  readonly orderLine: Readonly<Record<string, unknown>>;
  readonly receiveQty: number;
  readonly unitFactor: number;
  readonly priorReceivedBaseQty: number;
  readonly at: string;
}): PlanRecord {
  const assignedQty = requireNumber(input.orderLine["qty"], `${input.at} subcontract quantity`);
  const orderDate = requireText(input.orderHeader["orderDate"], `${input.at}Subcontract date`);
  const delivery = optionalText(input.orderLine["plannedDeliveryDate"])
    ?? requireText(input.orderHeader["plannedDeliveryDate"], `${input.at}Planned delivery date`);
  const assignedAtRaw = optionalText(input.orderHeader["createdAt"]) ?? orderDate;
  const thisBase = input.receiveQty * input.unitFactor;
  const cumulativeReportedQty = roundToScale(
    (input.priorReceivedBaseQty + thisBase) / input.unitFactor,
    "number",
    `${input.at}Cumulative reported quantity`,
  );
  return {
    assignedQty,
    plannedStartDate: dateAsDateTime(orderDate, `${input.at}Assignment start`),
    plannedEndDate: dateAsDateTime(delivery, `${input.at}Assignment end`),
    assignedAt: dateAsDateTime(assignedAtRaw, `${input.at}Assigned at`),
    cumulativeReportedQty,
  };
}

async function priorReceivedBaseQty(
  ctx: PlannerContext,
  orderLineId: string,
): Promise<number> {
  const received = await ctx.read.invariantLineSummary(
    "subcontractReceipt",
    "lines",
    { orderLineId, status: "received" },
    { field: "baseQty", fn: "sum" },
  );
  return received.value ?? 0;
}

function paramRows(ctx: PlannerContext): readonly Readonly<Record<string, unknown>>[] | null {
  // The dialog sends receiveLines. Older tests may still pass an array of objects.
  const raw = ctx.params["receiveLines"] ?? (() => {
    const json = ctx.params["receiveLinesJson"];
    if (typeof json !== "string" || json.trim() === "") return null;
    try {
      return JSON.parse(json) as unknown;
    } catch {
      schemaFail("The receipt-line parameter is not valid JSON");
    }
  })();
  if (raw === undefined || raw === null) return null;
  if (!Array.isArray(raw)) schemaFail("The receipt-line parameter must be an array");
  return raw as readonly Readonly<Record<string, unknown>>[];
}

/**
 * Receipt after the dialog confirms: build one subcontract receipt awaiting approval from the line quantities. Skip lines whose qty is 0 or less.
 * Each receipt line also creates one pending-review subcontract work report. After that, status follows only the receipt's approval or cancellation.
 */
async function receiptPlan(ctx: PlannerContext): Promise<ExecutionPlan> {
  const status = requireText(ctx.bill.header["status"], "Subcontract order status");
  // Only a normal completion keeps the catch-up receipt. After a close or an upstream cancel, no further receipt, stock, or payable fact is created.
  if (status !== "awaitingOutsource" && status !== "processing" && status !== "completed") {
    schemaFail(`The subcontract order is "${status}", so a subcontract receipt cannot be created`);
  }
  const supplierId = requireText(ctx.bill.header["supplierId"], "Subcontract supplier");
  // The warehouse chosen on the dialog wins. The order header is only the default. Operation subcontract often leaves the receiving warehouse empty, so an empty header must not block confirm.
  const warehouseId = optionalText(ctx.params["warehouseId"])
    ?? requireText(ctx.bill.header["receiptWarehouseId"], "Receiving warehouse");
  const processAssignmentId = await readableProcessAssignmentId(ctx);
  const orderLineById = new Map(
    (ctx.bill.lines["lines"] ?? []).map((row) => [String(row["id"] ?? ""), row] as const),
  );

  const fromParams = paramRows(ctx);
  const receiptLines: PlanRecord[] = [];
  /** Work-report inputs aligned with the receipt lines on the dialog path, including task snapshot fields. */
  const reportLines: PlanRecord[] = [];

  if (fromParams !== null) {
    for (const [index, draft] of fromParams.entries()) {
      const at = `Receipt line ${index + 1}`;
      const qty = optionalNumber(draft["qty"], `${at}Receipt quantity`) ?? 0;
      if (qty <= 0) continue;
      const orderLineId = optionalText(draft["orderLineId"]);
      const orderLine = orderLineId !== null ? orderLineById.get(orderLineId) : undefined;
      if (orderLine === undefined) schemaFail(`${at} does not match a subcontract line`);
      const taskId = requireText(orderLine["productionTaskId"], `${at}Production task`);
      const task = await ctx.read.getBill("productionTask", taskId);
      const taskStatus = requireText(task.header["status"], `${at} production task status`);
      if (taskStatus !== "inProduction" && taskStatus !== "completed") {
        schemaFail(`The production task at ${at} is "${taskStatus}", so a subcontract receipt cannot be created`);
      }
      const defectQty = optionalNumber(draft["defectQty"], `${at}Defect quantity`) ?? 0;
      if (defectQty < 0) schemaFail(`Defect quantity at ${at} cannot be negative`);
      if (defectQty > qty) schemaFail(`Defect quantity at ${at} cannot exceed the receipt quantity`);
      const qualifiedQty = roundToScale(qty - defectQty, "number", `${at}Qualified quantity`);
      const defectTypeIds = Array.isArray(draft["defectTypeIds"])
        ? (draft["defectTypeIds"] as unknown[]).map((id, i) => requireText(id, `${at} defect reason ${i + 1}`))
        : [];
      if (defectQty > 0 && defectTypeIds.length === 0) {
        schemaFail(`Select a defect reason at ${at} when there is a defect quantity`);
      }
      if (defectQty <= 0 && defectTypeIds.length > 0) {
        schemaFail(`There is no defect quantity at ${at}. Do not enter a defect reason`);
      }
      const defectDeduction = optionalNumber(draft["defectDeduction"], `${at}Defect deduction`) ?? 0;
      const processLineId = optionalText(orderLine["processLineId"]) ?? optionalText(draft["processLineId"]);
      const operationName = optionalText(orderLine["operationName"]) ?? optionalText(draft["operationName"]);
      const productId = requireText(task.header["productId"], `${at} finished goods`);
      const unit = requireText(task.header["unit"], `${at}Unit`);
      const unitFactor = requireNumber(task.header["unitFactor"], `${at}Unit factor`);
      const productionOrderId = optionalText(task.header["productionOrderId"]);
      let operationId: string | null = null;
      if (processLineId !== null) {
        const processLine = (task.lines["processLines"] ?? []).find(
          (row) => String(row["id"] ?? "") === processLineId,
        );
        if (processLine !== undefined) {
          operationId = optionalText(processLine["operationId"]);
        }
      }
      // Only qty > 0 becomes a line, so 0 creates neither a receipt line nor a work report.
      // productId (snapshot) and unitFactor (unitChoice) cannot be written onto the receipt line by hand.
      receiptLines.push({
        orderLineId: requireText(orderLine["id"], `${at}Subcontract order line`),
        productionTaskId: taskId,
        qty,
        taxPrice: requireNumber(orderLine["taxPrice"], `${at} subcontract processing price`),
        qualifiedQty,
        defectQty,
        defectDeduction,
        defectTypeIds: defectTypeIds.length > 0 ? JSON.stringify(defectTypeIds) : "",
        ...(processLineId === null ? {} : { processLineId }),
        ...(operationName === null ? {} : { operationName }),
      });
      reportLines.push({
        productionTaskId: taskId,
        ...(processAssignmentId === null ? {} : { processAssignmentId }),
        qty,
        qualifiedQty,
        defectQty,
        defectTypeIds: defectTypeIds.length > 0 ? JSON.stringify(defectTypeIds) : "",
        productId,
        unit,
        unitFactor,
        ...(productionOrderId === null ? {} : { productionOrderId }),
        ...(operationId === null ? {} : { operationId }),
        ...(processLineId === null ? {} : { processLineId }),
        ...assignmentFieldsFromOrder({
          orderHeader: ctx.bill.header,
          orderLine,
          receiveQty: qty,
          unitFactor,
          priorReceivedBaseQty: await priorReceivedBaseQty(ctx, requireText(orderLine["id"], `${at}Subcontract order line`)),
          at,
        }),
      });
    }
    if (receiptLines.length === 0) schemaFail("Enter at least one receipt quantity greater than 0");
  } else {
    // Compatibility path when there are no dialog parameters (tests and older clients): build lines from each task's remaining quantity.
    const rows = orderRows(ctx);
    for (const [index, row] of rows.entries()) {
      const at = `Subcontract line ${index + 1}`;
      const orderLineId = requireText(row["id"], `${at}Subcontract order line`);
      const taskId = requireText(row["productionTaskId"], `${at}Production task`);
      const task = await ctx.read.getBill("productionTask", taskId);
      const taskStatus = requireText(task.header["status"], `${at} production task status`);
      if (taskStatus !== "inProduction" && taskStatus !== "completed") {
        schemaFail(`The production task at ${at} is "${taskStatus}", so a subcontract receipt cannot be created`);
      }
      const taskBaseQty = requireNumber(task.header["basePlannedQty"], `${at}Task quantity in main unit`);
      const unitFactor = requireNumber(task.header["unitFactor"], `${at} task unit conversion factor`);
      if (unitFactor <= 0) schemaFail(`The production task unit conversion factor at ${at} must be greater than zero`);
      const priorReceived = await priorReceivedBaseQty(ctx, orderLineId);
      const remainingBaseQty = taskBaseQty - priorReceived;
      if (remainingBaseQty <= 0) continue;
      const qty = roundToScale(remainingBaseQty / unitFactor, "number", `${at} subcontract receipt quantity this time`);
      if (qty <= 0) continue;
      const productionOrderId = optionalText(task.header["productionOrderId"]);
      const processLineId = optionalText(row["processLineId"]);
      const operationName = optionalText(row["operationName"]);
      let operationId: string | null = null;
      if (processLineId !== null) {
        const processLine = (task.lines["processLines"] ?? []).find(
          (line) => String(line["id"] ?? "") === processLineId,
        );
        if (processLine !== undefined) operationId = optionalText(processLine["operationId"]);
      }
      receiptLines.push({
        orderLineId,
        productionTaskId: taskId,
        qty,
        taxPrice: requireNumber(row["taxPrice"], `${at} subcontract processing price`),
        qualifiedQty: qty,
        defectQty: 0,
        defectDeduction: 0,
        defectTypeIds: "",
        ...(processLineId === null ? {} : { processLineId }),
        ...(operationName === null ? {} : { operationName }),
      });
      reportLines.push({
        productionTaskId: taskId,
        ...(processAssignmentId === null ? {} : { processAssignmentId }),
        qty,
        qualifiedQty: qty,
        defectQty: 0,
        defectTypeIds: "",
        productId: requireText(task.header["productId"], `${at} finished goods`),
        unit: requireText(task.header["unit"], `${at}Unit`),
        unitFactor,
        ...(productionOrderId === null ? {} : { productionOrderId }),
        ...(operationId === null ? {} : { operationId }),
        ...(processLineId === null ? {} : { processLineId }),
        ...assignmentFieldsFromOrder({
          orderHeader: ctx.bill.header,
          orderLine: row,
          receiveQty: qty,
          unitFactor,
          priorReceivedBaseQty: priorReceived,
          at,
        }),
      });
    }
    if (receiptLines.length === 0) schemaFail("Every production task on this subcontract order is fully received, so another subcontract receipt cannot be created");
  }

  const receiptDate = optionalText(ctx.params["receiptDate"]);
  const receiptRemark = optionalText(ctx.params["receiptRemark"]);
  const commands: ExecutionCommand[] = [
    {
      type: "createBill",
      commandId: "subcontract-receipt",
      module: "subcontractReceipt",
      header: {
        orderId: ctx.bill.id,
        supplierId,
        warehouseId,
        ...(receiptDate !== null ? { receiptDate } : {}),
        ...(receiptRemark !== null ? { remark: receiptRemark } : {}),
      },
      lines: { lines: receiptLines },
    },
    {
      type: "createReference",
      commandId: "order-receipt-reference",
      source: { kind: "existing", module: "subcontractOrder", id: ctx.bill.id },
      target: created("subcontract-receipt"),
    },
  ];
  commands.push(...planSubcontractReceiptReportCommands({
    receiptId: created("subcontract-receipt"),
    // The automatic document number is generated when the receipt is created. The executor resolves createdField and then writes it onto the work report.
    receiptCode: { kind: "createdField", commandId: "subcontract-receipt", field: "code" },
    supplierId,
    processAssignmentId,
    remark: receiptRemark,
    lines: reportLines,
  }));
  return { version: 1, commands };
}

/**
 * The source assignment on a subcontract order is a legacy field. Early data may hold sample text or a deleted id.
 * It is used only to write assignment progress back after receipt. It is not a precondition of receiving. When it is invalid, treat the receipt as having no source assignment,
 * so creating the subcontract work report is not blocked by the processAssignmentId reference check.
 */
async function readableProcessAssignmentId(ctx: PlannerContext): Promise<string | null> {
  const id = optionalText(ctx.bill.header["processAssignmentId"]);
  if (id === null) return null;
  try {
    await ctx.read.getBill("processAssignment", id);
    return id;
  } catch {
    return null;
  }
}

/** Each of the four exits that leave "inProgress" must close every production task this order holds. */
const TASK_SYNC_TRANSITIONS: Readonly<Record<string, string>> = {
  unapprove: "resumeAfterSubcontractClose",
  close: "resumeAfterSubcontractClose",
  close_processing: "cancel",
};

async function taskStatusPlan(ctx: PlannerContext): Promise<ExecutionPlan> {
  // Closing an operation subcontract does not roll the task status back. The task may still have in-house assignments or other operation subcontracts in progress.
  if (isProcessOutsourcing(ctx)) return { version: 1, commands: [] };
  const commands: ExecutionCommand[] = [];
  for (const taskId of taskIdsOf(ctx)) {
    let transition = TASK_SYNC_TRANSITIONS[ctx.transition];
    if (ctx.transition === "finish") {
      const task = await ctx.read.getBill("productionTask", taskId);
      const mode = requireText(task.header["completionMode"], "Production task completion mode");
      transition = mode === "manual"
        ? "markSubcontractReady"
        : mode === "automatic"
          ? "autoCompleteSubcontract"
          : undefined;
      if (transition === undefined) schemaFail(`Task completion mode "${mode}" is not an implemented branch`);
    }
    if (transition === undefined) throw new Error(`Unknown subcontract close transition ${ctx.transition}`);
    commands.push({
      type: "setStatus",
      commandId: `close-production-task-${taskId}`,
      target: { kind: "existing", module: "productionTask", id: taskId },
      transition,
      expectedStatus: "inProduction",
    });
  }
  return { version: 1, commands };
}

async function finishPlan(ctx: PlannerContext): Promise<ExecutionPlan> {
  const issues = await ctx.read.listBills("subcontractIssue", {
    where: { kind: "cond", field: "orderId", op: "eq", value: ctx.bill.id },
    search: null,
    sort: [{ field: "createdAt", desc: false }],
    limit: 100,
    offset: 0,
  });
  for (const row of issues.rows) {
    const status = requireText(row["status"], "Subcontract issue status");
    if (["awaitingIssueOut", "cancelled"].includes(status)) continue;
    const issueId = requireText(row["id"], "Subcontract issue");
    const issue = await ctx.read.getBill("subcontractIssue", issueId);
    for (const [index, line] of (issue.lines["materialLines"] ?? []).entries()) {
      const remaining = requireNumber(line["unclosedBaseQty"], `Subcontract issue ${issueId} row ${String(index + 1)} unprocessed material`);
      if (Math.abs(remaining) > 0.000001) {
        schemaFail(`Subcontract issue ${issue.header["code"] ?? issueId} row ${String(index + 1)} still has ${remaining} main-unit material open. Return the leftover or have an authorized person confirm the loss before completing the subcontract`);
      }
    }
  }
  return taskStatusPlan(ctx);
}

export const planners = definePlanners(
  {
    approve: approvePlan,
    unapprove: taskStatusPlan,
    issue: issuePlan,
    receive: receiptPlan,
    finish: finishPlan,
    close: taskStatusPlan,
    close_processing: taskStatusPlan,
  },
  {
    approve: [],
    unapprove: [],
    issue: ["subcontractIssue"],
    receive: ["subcontractReceipt", "processReport"],
    finish: [],
    close: [],
    close_processing: [],
  },
);

/**
 * Subcontract order. Created by hand. Each line picks a production task.
 *
 * It is not pushed from a production task. The old `productionTask.create_subcontract_order` edge was removed.
 * Subcontracting is a purchasing shape: first a processing order to a supplier, then issue and receipt. A push forced
 * "one task = one order", which split "send this batch to one supplier" into N documents,
 * and each document negotiated supplier, warehouse, and due date again.
 *
 * The only link is still the production task. The line's `productionTaskId` is the single coordinate.
 * Issue BOM, remaining receipt, and completion are all calculated from it. The header no longer holds a production task, so one order can take several.
 */
export default defineModule({
  label: "Subcontract order",
  numbering: { prefix: "SCORD", seqScope: "day" },

  fields: [
    { key: "code", label: "Subcontract no.", type: "string", primary: true, auto: true },
    { key: "sourceType", label: "Type", type: "enum", options: ["Whole-order subcontract", "Operation subcontract", "Other subcontract"], required: true },
    { key: "orderDate", label: "Subcontract date", type: "date", required: true, createDefault: "today" },
    { key: "plannedDeliveryDate", label: "Planned delivery date", type: "date", required: true, createDefault: "today" },
    {
      // References a system account. The value is the platform userId. via:self means the value is already the account.
      key: "buyer", label: "Subcontract owner", type: "ref", ref: "subject",
      refFilter: { status: "active" },
      person: { role: "receiver", via: "self" },
    },
    /**
     * Deliberately no `refFilter: { canSubcontract: true }`, even though supplier already has that cell.
     *
     * The reason is existing data. `canSubcontract` was added in 3.5.0. The kernel has no literal default
     * (`createDefault` accepts only today/now), so after migration every historical supplier has this cell empty.
     * Turning the filter on now would make the subcontract-order supplier dropdown empty, and nothing on screen
     * would say why. That is the "it looks unfinished" failure AGENTS.md keeps naming.
     *
     * Turn it on only after existing data is filled in (check the suppliers that already subcontract). Then add the filter.
     */
    { key: "supplierId", label: "Subcontract supplier", type: "ref", ref: "supplier", required: true },
    { key: "issueWarehouseId", label: "Sending warehouse", type: "ref", ref: "warehouse" },
    { key: "receiptWarehouseId", label: "Receiving warehouse", type: "ref", ref: "warehouse" },
    { key: "processAssignmentId", label: "Source assignment", type: "string", hidden: true },
    {
      key: "lines",
      label: "Subcontract lines",
      type: "subtable",
      ref: "subcontractOrderLine",
      fields: [
        {
          key: "productionTaskId",
          label: "Production task",
          type: "ref",
          ref: "productionTask",
          required: true,
          // A whole-order subcontract can be created while the task is pending review. The approval gate and the planner both accept pending review, awaitingLaunch, and inProduction.
          refFilter: { status: ["pendingReview", "awaitingLaunch", "inProduction"] },
        },
        {
          // Filled only for operation subcontract. Not a refLine: an optional refLine would treat productionTaskId as a companion column
          // and break the finished-goods snapshot and unitChoice. When the screen picks an operation line it writes this column and operationName together.
          key: "processLineId",
          label: "Operation line",
          type: "string",
        },
        {
          key: "operationName",
          label: "Operation name",
          type: "string",
        },
        {
          key: "productId",
          label: "Finished goods",
          type: "ref",
          ref: "product",
          snapshot: { from: "productionTask", match: "productionTaskId", through: null, field: "productId" },
        },
        {
          key: "productName",
          label: "Product name",
          type: "string",
          snapshot: { from: "productionTask", match: "productionTaskId", through: null, field: "productName" },
        },
        {
          key: "spec",
          label: "Product specification",
          type: "string",
          snapshot: { from: "product", match: "productId", through: null, field: "spec" },
        },
        {
          key: "skuCode",
          label: "SKU code",
          type: "string",
          // The SKU code is the product barcode. The product serial `code` is an internal number and must not be shown as the SKU.
          derive: { kind: "lookup", from: "product", match: "productId", through: null, field: "barcode" },
        },
        {
          // Must be string, not text. The archive page expand area drops text as a type that does not fit.
          key: "specRemark",
          label: "Specification note",
          type: "string",
          snapshot: { from: "product", match: "productId", through: null, field: "remark", optional: true },
        },
        {
          key: "unit",
          label: "Unit",
          type: "enum",
          required: true,
          refDefault: { from: "productionTask", match: "productionTaskId", through: null, field: "unit" },
          unitChoice: { match: "productId", factorInto: "unitFactor" },
        },
        { key: "unitFactor", label: "Unit factor", type: "number" },
        {
          // Not a snapshot. Operation subcontract must let a person change the subcontract quantity. Whole-order still uses the whole_task_qty
          // gate to keep the quantity equal to the task quantity. The default is brought across with refDefault.
          key: "qty",
          label: "Task quantity",
          type: "number",
          required: true,
          refDefault: { from: "productionTask", match: "productionTaskId", through: null, field: "plannedQty" },
        },
        { key: "baseQty", label: "Task quantity in main unit", type: "number", calculate: { op: "mul", args: [{ field: "qty" }, { field: "unitFactor" }] } },
        { key: "taxPrice", label: "Tax-inclusive process price", type: "money", required: true },
        { key: "amount", label: "Tax-inclusive amount", type: "money", derive: { kind: "formula", expr: { op: "mul", args: [{ field: "qty" }, { field: "taxPrice" }] } } },
        { key: "baseUnitPrice", label: "Tax-inclusive process price in main unit", type: "money", calculate: { op: "div", args: [{ field: "taxPrice" }, { field: "unitFactor" }] } },
        { key: "plannedDeliveryDate", label: "Planned delivery date", type: "date", required: true, defaultFrom: { header: "plannedDeliveryDate" } },
        { key: "receivedBaseQty", label: "Quantity already received (main unit)", type: "number", derive: { kind: "rollup", from: "subcontractReceipt", through: "lines", match: "orderLineId", measure: "sum(baseQty)", where: { status: "received" } } },
        { key: "returnedBaseQty", label: "Quantity already returned (main unit)", type: "number", derive: { kind: "rollup", from: "subcontractReturn", through: "lines", match: "orderLineId", measure: "sum(baseQty)", where: { status: "returnedGoods" } } },
        { key: "netReceivedBaseQty", label: "Net received quantity (main unit)", type: "number", derive: { kind: "formula", expr: { op: "sub", args: [{ field: "receivedBaseQty" }, { field: "returnedBaseQty" }] } } },
      ],
    },
    { key: "totalAmount", label: "Subcontract amount", type: "money", lineAgg: { of: "lines", measure: "sum(amount)" } },
    // The header no longer has a production-task coordinate. The issued-document count is looked up from this order. It should mean "how many times this order issued material".
    { key: "issuedCount", label: "Issued document count", type: "number", derive: { kind: "rollup", from: "subcontractIssue", match: "orderId", measure: "count()", where: { status: "issuedOut" } } },
    { key: "remark", label: "Remarks", type: "text" },
  ],

  lifecycle: {
    statuses: [
      // Create starts at pending review. Do not set editable: "none": pending review must stay editable, or the form cannot be filled.
      { key: "pendingReview", label: "pendingReview", color: "amber", initial: true },
      { key: "awaitingOutsource", label: "awaitingOutsource", color: "blue", editable: "whitelist", editableFields: ["remark"] },
      { key: "processing", label: "processing", color: "purple", editable: "whitelist", editableFields: ["remark"] },
      { key: "completed", label: "completed", color: "green", terminal: true },
      { key: "closedOut", label: "closedOut", color: "red", terminal: true },
      { key: "cancelled", label: "cancelled", color: "red", terminal: true },
    ],
    transitions: [
      {
        code: "approve",
        from: "pendingReview",
        to: "awaitingOutsource",
        action: "Approve",
        primary: true,
        effects: [{ target: "ap", op: "reserve", subject: "$bill.supplierId", amount: "{totalAmount}", reverseOn: ["unapprove", "finish", "close", "close_processing", "forceComplete", "forceCancel"] }],
      },
      { code: "unapprove", from: "awaitingOutsource", to: "pendingReview", action: "Unapprove" },
      { code: "issue", from: "awaitingOutsource", to: "processing", action: "Push subcontract issue", primary: true },
      // awaitingOutsource, processing, and completed all have "Receive subcontract". The list is handled by the dialog on the subcontract order page.
      // The parameter is text holding JSON. Custom dialog fields, such as a multi-select of defect reasons, are outside the billLines column contract.
      {
        code: "receive",
        from: "awaitingOutsource",
        to: "processing",
        action: "Receive subcontract",
        params: RECEIVE_PARAMS,
      },
      {
        code: "receive",
        from: "processing",
        to: "processing",
        action: "Receive subcontract",
        primary: true,
        params: RECEIVE_PARAMS,
      },
      {
        code: "receive",
        from: "completed",
        to: "completed",
        action: "Receive subcontract",
        params: RECEIVE_PARAMS,
      },
      { code: "finish", from: "processing", to: "completed", action: "Complete subcontract" },
      { code: "forceComplete", from: "pendingReview", to: "completed", action: "Complete with production order", internal: true },
      { code: "forceComplete", from: "awaitingOutsource", to: "completed", action: "Complete with production order", internal: true },
      { code: "forceComplete", from: "processing", to: "completed", action: "Complete with production order", internal: true },
      {
        code: "reopenAfterReceiptReversal",
        from: "completed",
        to: "processing",
        action: "Sync receipt reversal",
        internal: true,
      },
      { code: "close", from: "awaitingOutsource", to: "closedOut", action: "Close order" },
      { code: "close_processing", from: "processing", to: "closedOut", action: "Stop subcontract" },
      // An upstream cancel of the whole chain and a manual close are two different facts. After a cancel, no further receipt is allowed.
      { code: "forceCancel", from: "pendingReview", to: "cancelled", action: "Cancel with upstream", internal: true },
      { code: "forceCancel", from: "awaitingOutsource", to: "cancelled", action: "Cancel with upstream", internal: true },
      { code: "forceCancel", from: "processing", to: "cancelled", action: "Cancel with upstream", internal: true },
      { code: "forceCancel", from: "completed", to: "cancelled", action: "Cancel with upstream", internal: true },
    ],
  },

  preconditions: [
    { id: "lines_required", onTransition: "approve", source: "invariant", level: "block", why: "A subcontract order must list the production tasks and the processing commitment", check: { primitive: "lines_not_empty" } },
    { id: "product_matches_task", onTransition: "approve", source: "invariant", level: "block", why: "The finished good must match the production task", check: { primitive: "ref_field_compare", via: "$line.productionTaskId", entity: "productionTask", field: "productId", op: "eq", right: { ref: "$line.productId" } } },
    {
      id: "whole_task_qty",
      onTransition: "approve",
      source: "invariant",
      level: "block",
      when: { primitive: "field_compare", left: { ref: "$bill.sourceType" }, op: "in", right: { value: ["Whole-order subcontract", "Other subcontract"] } },
      message: "This release can subcontract only the whole task. The subcontract quantity must equal the task quantity",
      why: "Finished-goods subcontract does not split one production task into a partial subcontract. The quantity must cover the whole task. Operation subcontract is counted from the operation-line quantity instead",
      check: { primitive: "ref_field_compare", via: "$line.productionTaskId", entity: "productionTask", field: "basePlannedQty", op: "eq", right: { ref: "$line.baseQty" } },
    },
    { id: "qty_positive", onTransition: "approve", source: "invariant", level: "block", why: "Task quantity must be positive", check: { primitive: "lines_all", left: { ref: "$line.qty" }, op: "gt", right: { value: 0 } } },
    { id: "price_positive", onTransition: "approve", source: "invariant", level: "block", why: "The subcontract process price must be positive", check: { primitive: "lines_all", left: { ref: "$line.taxPrice" }, op: "gt", right: { value: 0 } } },
    { id: "header_required", onTransition: "approve", source: "invariant", level: "block", why: "Owner, supplier, warehouse, and delivery date are required before the subcontract can be approved", check: { primitive: "required_fields", fields: ["buyer", "supplierId", "issueWarehouseId", "receiptWarehouseId", "orderDate", "plannedDeliveryDate"] } },
    { id: "supplier_active", onTransition: "approve", source: "gate", level: "block", why: "A disabled supplier cannot take subcontract work", check: { primitive: "ref_field_compare", via: "supplierId", entity: "supplier", field: "status", op: "eq", right: { value: "active" } } },
    // Approval moves tasks that are still waiting to start into "inProduction". Tasks already in production keep their status.
    {
      id: "task_pending_launch",
      onTransition: "approve",
      source: "gate",
      level: "block",
      when: { primitive: "field_compare", left: { ref: "$bill.sourceType" }, op: "in", right: { value: ["Whole-order subcontract", "Other subcontract"] } },
      message: "A production task on the subcontract lines is not pending review, not started, or in production, so it cannot be sent out. Remove it from the lines first",
      why: "A whole finished-goods subcontract can cover a task that is pending review, not started, or in production",
      check: { primitive: "ref_field_compare", via: "$line.productionTaskId", entity: "productionTask", field: "status", op: "in", right: { value: ["pendingReview", "awaitingLaunch", "inProduction"] } },
    },
    // A required processLineId on an operation-subcontract line is guaranteed by the screen and by a later declared gate. This modeling pass
    // does not use required_fields here, because that primitive only sees the header.
    // This document is in "pendingReview", which is not in that status set, so the count is entirely other orders.
    // If "pendingReview" were included, this document would count itself and the gate would never pass.
    // Operation subcontract coexists by operation line. It is not limited to one active subcontract order per task.
    {
      id: "no_other_active_order",
      onTransition: "approve",
      source: "gate",
      level: "block",
      when: { primitive: "field_compare", left: { ref: "$bill.sourceType" }, op: "in", right: { value: ["Whole-order subcontract", "Other subcontract"] } },
      message: "A production task on these subcontract lines is already on another subcontract order in progress. Deal with that order first",
      why: "Two open finished-goods subcontract orders on one task would commit the task quantity twice",
      check: { primitive: "related_agg", from: "subcontractOrder", through: "lines", match: "productionTaskId", on: "$line.productionTaskId", agg: "count", measure: null, where: { status: ["awaitingOutsource", "processing"], sourceType: ["Whole-order subcontract", "Other subcontract"] }, op: "eq", right: { value: 0 }, plus: null },
    },
    { id: "receive_task_active", onTransition: "receive", source: "gate", level: "block", when: { primitive: "field_compare", left: { ref: "$bill.status" }, op: "ne", right: { value: "completed" } }, why: "A subcontract receipt can cover only a production task that is still in production", check: { primitive: "ref_field_compare", via: "$line.productionTaskId", entity: "productionTask", field: "status", op: "eq", right: { value: "inProduction" } } },
    // Catch-up receipt after the sales order is completed: the task may be in production or completed. Remaining quantity is judged by receiptPlan.
    { id: "receive_after_complete_task_open", onTransition: "receive", source: "gate", level: "block", when: { primitive: "field_compare", left: { ref: "$bill.status" }, op: "eq", right: { value: "completed" } }, why: "A late receipt after completion requires the task to be in production or already completed", check: { primitive: "ref_field_compare", via: "$line.productionTaskId", entity: "productionTask", field: "status", op: "in", right: { value: ["inProduction", "completed"] } } },
    // "Some task is not fully received" has no declared form. `related_agg` with `on: "$line.x"` is
    // a per-line universal quantifier (every line must hold). On a multi-task order, "task A is fully received and task B is not" is the normal
    // state during receipt. Using that gate would block further receipt for the whole order the moment the first task is full.
    // The judgment therefore lives in receiptPlan: skip lines that are already full, and refuse only when every line is full, and say so.
    { id: "fully_received", onTransition: "finish", source: "gate", level: "block", message: "Subcontract receipts have not yet reached the task quantity", why: "Every production task must be fully received before the subcontract can be completed", check: { primitive: "lines_all", left: { ref: "$line.netReceivedBaseQty" }, op: "gte", right: { ref: "$line.baseQty" } } },
  ],

  handoff: [
    { id: "notify_approver", kind: "todo", onStatus: "pendingReview", to: "procurement-manager", title: "Subcontract order awaiting review", why: "Approval creates the supplier's processing commitment" },
    { id: "notify_finance", kind: "notify", onTransition: "finish", to: "finance", title: "Subcontract order completed", why: "Completing the subcontract releases the commitment" },
  ],

  views: {
    list: { columns: ["code", "sourceType", "orderDate", "supplierId", "buyer", "totalAmount", "status"], filters: ["status", "sourceType", "supplierId", "orderDate"], searchable: ["code"], defaultSort: { field: "createdAt", desc: true } },
    form: [
      { title: "Subcontract", fields: ["code", "sourceType", "orderDate", "plannedDeliveryDate", "buyer", "supplierId", "issueWarehouseId", "receiptWarehouseId"] },
      { title: "Subcontract lines", fields: ["lines", "totalAmount"] },
      { title: "Other", fields: ["remark"] },
    ],
  },
});
