import type { CreatedIdValue, ExecutionCommand } from "@open-erp/metamodel";

/** Every completed in-house report creates a pay slip. The rate is frozen by snapshot. The planner writes the coefficient from the default operation or the worker header (blank becomes 1). */
export function performanceSettlementCreateCommand(
  processReportId: string | CreatedIdValue,
  commandId: string,
  pricingCoefficient: number | null = null,
): ExecutionCommand {
  return {
    type: "createBill",
    commandId,
    module: "performanceSettlement",
    // plannerSupplied columns are NOT NULL. A blank coefficient is stored as 1, matching the pay calculation fallback.
    header: { processReportId, pricingCoefficient: pricingCoefficient ?? 1 },
    lines: {},
  };
}
