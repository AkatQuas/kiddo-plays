import {
  PlannerBusinessError,
  roundToScale,
  type PlannerContext,
  requireText,
  requireNumber,
} from "@open-erp/metamodel";

export const RECEIPT_OCCUPYING_STATUSES = ["pendingReview", "completed"] as const;

function quantity(value: unknown, label: string): number {
  const n = requireNumber(value, label);
  return roundToScale(n, "number", label);
}

/**
 * Available shortfall = the minimum of floor(approved qualified ÷ assignment ratio) across operations
 * (compare after converting to whole finished goods).
 * Example: ratio 1 and 100 qualified → 100; ratio 2 and 160 qualified → 80; ratio 1 and 90 qualified → 90; shortfall 80.
 * No operation lines means nothing is available to receive.
 */
export function bottleneckQualifiedQty(
  processLines: readonly Readonly<Record<string, unknown>>[],
): number {
  if (processLines.length === 0) return 0;
  let bottleneck = Number.POSITIVE_INFINITY;
  for (const line of processLines) {
    const approved = quantity(line["approvedQualifiedQty"] ?? 0, "Approved qualified quantity on the operation");
    const ratioRaw = line["assignmentRatio"] ?? 1;
    const ratio = quantity(ratioRaw, "Operation assignment ratio");
    if (ratio <= 0) throw new Error("The operation assignment ratio must be greater than 0");
    const finished = Math.floor(approved / ratio);
    bottleneck = Math.min(bottleneck, finished);
  }
  return Number.isFinite(bottleneck) ? bottleneck : 0;
}

export function availableInboundQty(bottleneck: number, received: number): number {
  return roundToScale(bottleneck - received, "number", "Quantity available to receive");
}

export async function receivedInboundQty(
  read: PlannerContext["read"],
  productionTaskId: string,
): Promise<number> {
  const summary = await read.invariantBillSummary("productionReceipt", {
    where: {
      kind: "group",
      join: "and",
      children: [
        { kind: "cond", field: "productionTaskId", op: "eq", value: productionTaskId },
        { kind: "cond", field: "status", op: "in", value: [...RECEIPT_OCCUPYING_STATUSES] },
      ],
    },
    search: null,
    sort: [{ field: "createdAt", desc: false }],
    limit: 1,
    offset: 0,
  }, { field: "inboundQty", fn: "sum" });
  return quantity(summary.value ?? 0, "Quantity already received");
}

/**
 * Recalculate on confirm: min(approved qualified ÷ assignment ratio) minus quantity already received for this task (including this pendingReview receipt).
 * This receipt's quantity is already inside the received total. Going over means there is not enough available to receive.
 */
export async function assertReceiptQtyWithinAvailable(ctx: PlannerContext): Promise<void> {
  const taskId = requireText(ctx.bill.header["productionTaskId"], "Production task");
  const inboundQty = quantity(ctx.bill.header["inboundQty"], "Receipt quantity");
  const task = await ctx.read.getBill("productionTask", taskId);
  const bottleneck = bottleneckQualifiedQty(task.lines["processLines"] ?? []);
  const received = await receivedInboundQty(ctx.read, taskId);
  const others = roundToScale(received - inboundQty, "number", "Quantity reserved by other receipts");
  const available = availableInboundQty(bottleneck, others);
  if (inboundQty > available) {
    throw new PlannerBusinessError(
      available <= 0
        ? "There is no approved qualified quantity to receive yet. Every operation needs approved qualified quantity first (the bottleneck after converting by the assignment ratio). Quantity already received, including pending review, uses up the available amount."
        : `The receipt quantity cannot exceed the available quantity ${String(available)}. Available quantity is the bottleneck of approved qualified quantities, converted to finished goods by the assignment ratio, minus quantity already received (including pending review).`,
    );
  }
}
