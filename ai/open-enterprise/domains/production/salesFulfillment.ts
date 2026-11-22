import type { ExecutionCommand, PlannerContext } from "@open-erp/metamodel";

/**
 * Sales order status has converged on `inProgress`. After a production order leaves an
 * open state it no longer pushes the sales order through releaseToShip / releaseToShipping /
 * releaseToComplete. Fulfillment progress is the line quantities and downstream documents.
 * Commercial close is the sales order Complete edge plus CascadeAction.
 */
export async function releaseSalesAfterProductionSettled(
  _ctx: PlannerContext,
  _excludingOrderId: string,
): Promise<readonly ExecutionCommand[]> {
  return [];
}
