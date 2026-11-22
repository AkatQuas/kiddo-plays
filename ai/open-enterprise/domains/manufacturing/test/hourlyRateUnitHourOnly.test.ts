import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadCatalog, requireModule } from "@open-erp/loader";
import { snapshotSourceGuarantee, type Field, type ModuleSchema } from "@open-erp/metamodel";
import { describe, expect, it } from "vitest";

// The time basis spans manufacturing (operation master / routing) and productionProcess (task / work report / settlement).
// Schemas come from the catalog, not a relative import across composite packages, the same rule as production/test/modules.test.ts.
const catalog = await loadCatalog({
  domainsRoot: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.."),
});
const operation = requireModule(catalog, "operation").schema;
const resolve = (code: string): ModuleSchema => requireModule(catalog, code).schema;

const headerField = (schema: ModuleSchema, key: string): Field => {
  const hit = schema.fields.find((field) => field.key === key);
  if (!hit) throw new Error(`${schema.code} has no "${key}"`);
  return hit;
};
/**
 * This group pins the second cause of the incident where every work report was approved and wages still would not settle.
 *
 * The first cause is that there was no entry point (see productionProcess/test/performanceSettlement.test.ts).
 * The second is here: `hourlyRateUnit` used to be an optional choice of minute / hour / day,
 * and only hour could settle a wage, because the conversion factor has no place in the model. So:
 *
 *   · nobody filled the cell at entry (the work-report screen never mentioned "time unit");
 *   · the empty value was snapshotted into the routing, the assignment, and the work report;
 *   · this period's wage slip no longer settles by time, but the basis stays pinned: the hourly price is dimensioned in hours only.
 */
describe("the time basis is closed down to hours", () => {
  it("the operation master has only the hour option, and it is required", () => {
    const field = headerField(operation, "hourlyRateUnit");
    // One extra option is one more inert value. The master saves fine, and Settle at month end is what blocks it,
    // after hundreds of work reports are already entered
    expect(field.options?.map((option) => option.value)).toEqual(["Per hour"]);
    // Required is the load-bearing part of this change. Left optional, an empty value can still be produced, and empty is what those 86 documents were.
    expect(field.required).toBe(true);
  });

  it("the hourly-price label states its own dimension, and does not rely on the cell next to it", () => {
    // "Time price" plus "time unit [hour]" takes two cells to read as a per-hour price. After the close-down the unit is always hour,
    // and the label says so, so someone who negotiated per minute converts before they type
    expect(headerField(operation, "hourlyRate").label).toContain("per hour");
  });

  /**
   * Assert "the source is guaranteed non-empty" at each hop. When that inference holds, `snapshotColumnNotNull`
   * on the table side compiles these columns as NOT NULL, so this kind of empty value can no longer be stored.
   * Assert the criterion, not the generated column. The column is a product. If the criterion drifts, the column drifts with it, and the drift does not error.
   */
  it.each([
    ["the copy frozen on routing.lines and the assignment", { from: "operation", through: null, field: "hourlyRateUnit" }],
    ["the copy frozen on processReport", { from: "processAssignment", through: null, field: "hourlyRateUnit" }],
  ] as const)("%s, the source is guaranteed non-empty", (_at, source) => {
    expect(snapshotSourceGuarantee(resolve, source)).toMatchObject({ guaranteed: true });
  });
});
