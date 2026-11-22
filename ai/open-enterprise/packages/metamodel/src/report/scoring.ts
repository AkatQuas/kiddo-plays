// ---------------------------------------------------------------------------
// Daily report — five-dimension scoring (the deterministic implementation of the "operating analysis" section of the requirements).
//
// 🔴 This layer is pure functions and zero IO: the input is counts and amounts already collected,
//    and the output is each dimension's score and level. Every rule comes from the requirements.
//    Changing a rule means changing the constants and pure functions here, pinned by the `domains/report` unit tests.
//    They must not be scattered into SQL or a template.
//
// ── Why it is "deduct from a full score" ───────────────────────────────────
//   The requirements state every dimension as "start from N, deduct for each exception, add back for a positive action".
//   That is a capped and floored range deduction, not a weighted sum — so each dimension clamps to its own
//   full-score range, and the sum is the internal total. The display score clamps to (60, 95) on its own (see displayScore).
// ---------------------------------------------------------------------------

import type { RiskLevel } from "./dailyReportData.js";

/** Net adjustment of one dimension after the requirement's caps (negative = a deduction) */
export interface DimensionInput {
  /** Net of each deduction and bonus rule (already capped per the requirement). Summed, then clamped to this dimension's full score */
  readonly adjustments: readonly number[];
}

export interface DimensionScore {
  readonly full: number;
  /** This dimension's score = clamp(full + Σadjustments, 0, full) */
  readonly score: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function scoreDimension(full: number, input: DimensionInput): DimensionScore {
  const net = input.adjustments.reduce((sum, a) => sum + a, 0);
  return { full, score: clamp(full + net, 0, full) };
}

/** Full scores of the five dimensions. The original 20/25/20/10/10, scaled to 100 by largest remainder, is 24/29/23/12/12. */
export const DIMENSION_FULL = {
  salesDelivery: 24,
  production: 29,
  material: 23,
  warehouse: 12,
  workflow: 12,
} as const;

export const INTERNAL_FULL_SCORE =
  DIMENSION_FULL.salesDelivery +
  DIMENSION_FULL.production +
  DIMENSION_FULL.material +
  DIMENSION_FULL.warehouse +
  DIMENSION_FULL.workflow;

// ── Sales delivery (full score 24) ─────────────────────────────────────────
export interface SalesDeliveryFacts {
  readonly overdueUnshippedCount: number;
  readonly dueIn3DaysUnshippedCount: number;
  readonly dueTodayPendingAuditCount: number;
  readonly hadSalesOutboundYesterday: boolean;
}

export function salesDeliveryScore(f: SalesDeliveryFacts): DimensionScore {
  return scoreDimension(DIMENSION_FULL.salesDelivery, {
    adjustments: [
      -Math.min(f.overdueUnshippedCount * 2, 8),
      -Math.min(f.dueIn3DaysUnshippedCount * 1, 4),
      -Math.min(f.dueTodayPendingAuditCount * 2, 4),
      f.hadSalesOutboundYesterday ? 1 : 0,
    ],
  });
}

// ── Production execution (full score 29) ───────────────────────────────────
export interface ProductionFacts {
  readonly delayedTaskCount: number;
  readonly delayedOver7DaysCount: number;
  readonly reportedNotReceivedCount: number;
  readonly pendingReleaseOrderCount: number;
  readonly hadProductionReceiptYesterday: boolean;
}

export function productionScore(f: ProductionFacts): DimensionScore {
  return scoreDimension(DIMENSION_FULL.production, {
    adjustments: [
      -Math.min(f.delayedTaskCount * 3, 9),
      -Math.min(f.delayedOver7DaysCount * 2, 4),
      -Math.min(f.reportedNotReceivedCount * 2, 6),
      -Math.min(f.pendingReleaseOrderCount * 1, 4),
      f.hadProductionReceiptYesterday ? 1 : 0,
    ],
  });
}

// ── Material supply (full score 23) ────────────────────────────────────────
export interface MaterialFacts {
  readonly keyMaterialZeroStockCount: number;
  readonly tasksWithPendingIssueCount: number;
  readonly overduePurchaseCount: number;
  readonly rejectedReceiptCount: number;
  readonly hadPurchaseReceiptYesterday: boolean;
}

export function materialScore(f: MaterialFacts): DimensionScore {
  return scoreDimension(DIMENSION_FULL.material, {
    adjustments: [
      -Math.min(f.keyMaterialZeroStockCount * 3, 9),
      -Math.min(f.tasksWithPendingIssueCount * 1, 5),
      -Math.min(f.overduePurchaseCount * 2, 6),
      -Math.min(f.rejectedReceiptCount * 1, 3),
      f.hadPurchaseReceiptYesterday ? 1 : 0,
    ],
  });
}

// ── Warehouse flow (full score 12) ─────────────────────────────────────────
export interface WarehouseFacts {
  readonly partialIssueCount: number;
  readonly reportedNotReceivedCount: number;
  readonly pendingAuditDocCount: number;
  /** Deduction tier when returns are abnormally high (-1 or -2), decided by the calculation layer and passed in */
  readonly abnormalReturnPenalty: number;
  readonly hadWarehouseActivityYesterday: boolean;
}

export function warehouseScore(f: WarehouseFacts): DimensionScore {
  return scoreDimension(DIMENSION_FULL.warehouse, {
    adjustments: [
      -Math.min(f.partialIssueCount * 1, 3),
      -Math.min(f.reportedNotReceivedCount * 1, 3),
      -Math.min(f.pendingAuditDocCount * 0.5, 2),
      f.abnormalReturnPenalty,
      f.hadWarehouseActivityYesterday ? 1 : 0,
    ],
  });
}

// ── Workflow coordination (full score 12) ──────────────────────────────────
export interface WorkflowFacts {
  readonly pendingAuditCount: number;
  readonly pendingAuditBlockingTodayCount: number;
  readonly pendingAuditUrgentMaterialCount: number;
  readonly pendingIssueBlockingStartCount: number;
}

export function workflowScore(f: WorkflowFacts): DimensionScore {
  return scoreDimension(DIMENSION_FULL.workflow, {
    adjustments: [
      -Math.min(f.pendingAuditCount * 0.2, 4),
      -Math.min(f.pendingAuditBlockingTodayCount * 2, 4),
      -Math.min(f.pendingAuditUrgentMaterialCount * 1, 2),
      -Math.min(f.pendingIssueBlockingStartCount * 1, 2),
    ],
  });
}

// ── Total ──────────────────────────────────────────────────────────────────

export interface ScoreBreakdown {
  readonly salesDelivery: DimensionScore;
  readonly production: DimensionScore;
  readonly material: DimensionScore;
  readonly warehouse: DimensionScore;
  readonly workflow: DimensionScore;
  /** True total of the five dimensions (internal basis) */
  readonly internalScore: number;
}

export function totalScore(parts: Omit<ScoreBreakdown, "internalScore">): ScoreBreakdown {
  const internalScore =
    parts.salesDelivery.score +
    parts.production.score +
    parts.material.score +
    parts.warehouse.score +
    parts.workflow.score;
  return { ...parts, internalScore };
}

/** Display score = clamp(internal true score, 60, 95). Below 60 the page still shows 60, and the warning area is marked red */
export function displayScore(internalScore: number): number {
  return clamp(Math.round(internalScore), 60, 95);
}

export type ReportLevel = "healthy" | "good" | "under-control" | "needs-attention";

/** Recommended level from the display score (requirement: 90-95 / 80-89 / 70-79 / 60-69) */
export function levelOf(display: number): ReportLevel {
  if (display >= 90) return "healthy";
  if (display >= 80) return "good";
  if (display >= 70) return "under-control";
  return "needs-attention";
}

/** AI judge status (template aiJudge.status): the same source as level, in plainer wording */
export function judgeStatusOf(level: ReportLevel): { readonly status: string; readonly statusColor: string } {
  switch (level) {
    case "healthy":
      return { status: "Steady", statusColor: "green" };
    case "good":
      return { status: "Good", statusColor: "green" };
    case "under-control":
      return { status: "Needs attention", statusColor: "orange" };
    case "needs-attention":
      return { status: "Tight", statusColor: "red" };
  }
}

/** Level → color (the template renders with no branch; the server supplies the color) */
export function riskLevelColor(level: RiskLevel): string {
  switch (level) {
    case "high":
      return "#F5222D";
    case "medium":
      return "#FA8C16";
    case "low":
      return "#1677FF";
  }
}
