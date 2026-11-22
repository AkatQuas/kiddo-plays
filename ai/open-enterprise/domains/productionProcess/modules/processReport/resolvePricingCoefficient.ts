import type { PlannerBillSnapshot } from "@open-erp/metamodel";

/** Only a finite number counts as filled. A numeric string counts too (storage sometimes returns numeric as string). */
function finiteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/**
 * Freeze the coefficient when pay is created. Match the worker's default-operation line first, then fall back to the worker header. If both are empty, return null (pay treats that as 1).
 */
export function resolveWorkerPricingCoefficient(
  worker: Pick<PlannerBillSnapshot, "header" | "lines">,
  operationId: unknown,
): number | null {
  const op =
    typeof operationId === "string" && operationId.trim() !== "" ? operationId.trim() : null;
  if (op !== null) {
    const rows = worker.lines["defaultOperations"] ?? [];
    const match = rows.find((row) => row["operationId"] === op);
    if (match) {
      const fromLine = finiteNumber(match["pricingCoefficient"]);
      if (fromLine !== null) return fromLine;
    }
  }
  return finiteNumber(worker.header["pricingCoefficient"]);
}
