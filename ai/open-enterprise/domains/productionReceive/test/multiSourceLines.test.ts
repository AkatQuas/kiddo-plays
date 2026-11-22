import {
  evaluateTransition,
  type Field,
  isSystemSupplied,
  type ModuleSchema,
  type NormalizedCheck,
  sealModule,
  supplyOf,
} from "@open-erp/metamodel";
import { describe, expect, it } from "vitest";
import materialReturnDraft from "../modules/materialReturn.js";

const materialReturn = sealModule(materialReturnDraft, { code: "materialReturn", domain: "productionReceive" });

/**
 * The first of the "a document can hang on only one upstream" family: a material return spans several material issues.
 *
 * The old shape was a required header `materialIssueId` plus `return_lines_match_issue`,
 * which pinned every line's source to that one header document. At month end the shop returns material drawn in batches from a dozen issues this month.
 * Under that shape the only way out was to open a dozen return documents.
 *
 * This assertion pins two things. Miss either one and the change did nothing:
 *   1. That header field is really gone, and the full set of sources lives on the lines (otherwise the screen can still select only one document).
 *   2. Every consistency gate moved down to the line with it (otherwise opening cross-document returns would let issues from other orders, tasks, or warehouses mix into one return, while each declaration still looks fine on its own).
 */

const NOW = new Date("2026-07-30T00:00:00.000Z");

const headerFields = (module: ModuleSchema): readonly Field[] => module.fields;
const lineFields = (module: ModuleSchema): readonly Field[] =>
  module.fields.find((field) => field.key === "lines")?.fields ?? [];

/** Which level this gate's `via` sits on (the coordinate of `ref_field_compare`). */
const viaOf = (check: NormalizedCheck | null): { readonly from: string; readonly field: string } | null => {
  if (!check || check.primitive !== "ref_field_compare") return null;
  return (check.params as { readonly via: { readonly from: string; readonly field: string } }).via;
};

const ruleById = (module: ModuleSchema, id: string) => module.preconditions.find((rule) => rule.id === id);

/**
 * Two material issues, the same production task, the same warehouse.
 * `issue-a` issued 200 meters of fabric and `issue-b` issued 408 buttons. One month-end return sends the leftovers of both documents back together. That document could not be expressed before.
 */
const ISSUES: Readonly<Record<string, Readonly<Record<string, unknown>>>> = {
  "issue-a": {
    productionOrderId: "order-1",
    productionTaskId: "task-1",
    warehouseId: "warehouse-1",
    status: "issued",
  },
  "issue-b": {
    productionOrderId: "order-1",
    productionTaskId: "task-1",
    warehouseId: "warehouse-1",
    status: "issued",
  },
  // Same order and same task, but it was issued from another warehouse.
  "issue-other-warehouse": {
    productionOrderId: "order-1",
    productionTaskId: "task-1",
    warehouseId: "warehouse-2",
    status: "issued",
  },
  // A material issue for another production order.
  "issue-other-order": {
    productionOrderId: "order-2",
    productionTaskId: "task-2",
    warehouseId: "warehouse-1",
    status: "issued",
  },
};

interface LineInput {
  readonly materialIssueId: string;
  readonly issueLineId: string;
  readonly productId: string;
  readonly qty: number;
  /** Issued quantity on the source issue line (`issueLineQty` is a lookup, and the read path already carries it). */
  readonly issueLineQty: number;
  /** Which warehouse this line returns to (defaults to the source issue line's warehouse). */
  readonly warehouseId?: string;
  /** Which warehouse the source issue line was issued from (`issueWarehouseId` is a lookup, and the read path already carries it). */
  readonly issueWarehouseId?: string;
}

const lineOf = (input: LineInput): Readonly<Record<string, unknown>> => ({
  materialIssueId: input.materialIssueId,
  issueLineId: input.issueLineId,
  productId: input.productId,
  // Both sides of the product consistency gate: the product on the source issue line and the product this line returns.
  issueProductId: input.productId,
  qty: input.qty,
  baseQty: input.qty,
  issueLineQty: input.issueLineQty,
  issueLineBaseQty: input.issueLineQty,
  unit: "piece",
  // The warehouse moved down to the line with the issue. Both the outbound and inbound scopes are `$line.warehouseId`.
  warehouseId: input.warehouseId ?? "warehouse-1",
  issueWarehouseId: input.issueWarehouseId ?? "warehouse-1",
});

/**
 * Approve a material return.
 *
 * `history` is how much has already been returned against the same source issue line. It is the left-hand source of `not_over_return`,
 * keyed by `issueLineId`.
 *
 * It must include the document under review. The gate's `where` includes pendingReview, and this edge starts at pendingReview,
 * so a real query always reads this document's lines. A fixture that only stores what other people returned
 * tests a measure that does not exist, and every live posting is doubled (see the full-return case below).
 */
async function auditReturn(
  lines: readonly LineInput[],
  history: Readonly<Record<string, number>> = {},
) {
  return evaluateTransition(
    {
      module: materialReturn,
      // The header is only the date. Order, task, and return warehouse moved down to the line with the issue change.
      bill: { id: "return-multi", status: "pendingReview", returnDate: "2026-07-30" },
      lines: lines.map(lineOf),
      params: {},
      actor: { id: "keeper-1" },
      now: NOW,
      query: {
        get: async (entity, id) => {
          if (entity === "product") return { mainUnit: "piece", auxUnit: "box", conversionRate: 10 };
          if (entity === "materialIssue") return ISSUES[String(id)] ?? null;
          return null;
        },
        list: async (entity, where) => {
          if (entity !== "materialReturn") return [];
          const key = String((where as Readonly<Record<string, unknown>>)["issueLineId"]);
          const already = history[key];
          return already === undefined ? [] : [{ baseQty: already }];
        },
        balance: async () => 0,
      },
    },
    "releaseDemand",
  );
}

const failing = (decision: Awaited<ReturnType<typeof auditReturn>>): readonly string[] =>
  decision.checks.filter((check) => !check.ok).map((check) => check.id);

describe("A material return spans several material issues (prod-087)", () => {
  it("the header has no source material issue field; the full set of sources lives only on the lines", () => {
    expect(headerFields(materialReturn).map((field) => field.key)).not.toContain("materialIssueId");

    const columns = lineFields(materialReturn);
    const companion = columns.find((field) => field.key === "materialIssueId");
    const refLine = columns.find((field) => field.key === "issueLineId");

    // The line reference is the only business input. The ref on the same row is a stored companion column. The client, a push, and a seed must not write it.
    expect(refLine?.type).toBe("refLine");
    expect(refLine?.through).toBe("lines");
    expect(companion?.type).toBe("ref");
    expect(supplyOf(companion as Field, columns)).toBe("refOwner");
    expect(isSystemSupplied(companion as Field, columns)).toBe(true);

    // A required companion ref requires the paired refLine to be required too. If one is required and the other is optional, the companion has no source.
    // The value gate skips system-supplied fields entirely, and the write reaches PostgreSQL NOT NULL as a 500.
    expect(companion?.required).toBe(true);
    expect(refLine?.required).toBe(true);
  });

  it("the gate that pinned the whole document to one material issue is deleted and has not grown back elsewhere", () => {
    expect(ruleById(materialReturn, "return_lines_match_issue")).toBeUndefined();
    // `$bill.materialIssueId` must not appear in any rule. The header has no such field.
    // Leaving it would read undefined, the comparison would never hold, and a block would never pass, which looks like the business rule was configured too strictly.
    const declaration = JSON.stringify(materialReturn.preconditions);
    expect(declaration).not.toContain("$bill.materialIssueId");
  });

  it("every source consistency gate sits on the line; once cross-document returns are open, they are the only defense left", () => {
    // "The source document is not posted yet" is still judged on the source document header, so it is a ref_field_compare on the reference column of the line.
    const via = viaOf(ruleById(materialReturn, "return_issue_posted")?.check ?? null);
    expect([via?.from, via?.field]).toEqual(["line", "materialIssueId"]);

    // `return_order_matches_issue` and `return_task_matches_issue` were deleted, not relaxed.
    // Their right-hand values were the header productionOrderId and productionTaskId, and those fields moved down to the line with the issue change.
    // Leaving them would make the right-hand value always undefined, the comparison would never hold, and a block would never pass.
    // What they judged is now held by a stronger coordinate. The task is looked up from the source issue line, and the user has no input for it.
    for (const id of ["return_order_matches_issue", "return_task_matches_issue"]) {
      expect(ruleById(materialReturn, id), id).toBeUndefined();
    }
    const declaration = JSON.stringify(materialReturn.preconditions);
    expect(declaration).not.toContain("$bill.productionOrderId");
    expect(declaration).not.toContain("$bill.productionTaskId");
    expect(declaration).not.toContain("$bill.warehouseId");

    // The warehouse gate now compares line by line. One material issue can take fabric from the fabric warehouse and buttons from another warehouse,
    // and comparing against the source document header would have no right-hand value.
    expect(ruleById(materialReturn, "return_warehouse_matches_issue")?.check).toMatchObject({
      primitive: "lines_all",
      params: {
        left: { ref: "$line.warehouseId" },
        op: "eq",
        right: { ref: "$line.issueWarehouseId" },
      },
    });
  });

  it("leftovers from two source material issues are returned on one document, and approval passes", async () => {
    const decision = await auditReturn([
      { materialIssueId: "issue-a", issueLineId: "issue-a-line-1", productId: "p-brg", qty: 5, issueLineQty: 200 },
      { materialIssueId: "issue-b", issueLineId: "issue-b-line-1", productId: "p-bolt", qty: 8, issueLineQty: 408 },
    ]);

    expect(failing(decision)).toEqual([]);
    expect(decision.verdict.pass).toBe(true);
  });

  it("one line's source material issue was issued from another warehouse; only the warehouse gate fails, and it names the row", async () => {
    const decision = await auditReturn([
      { materialIssueId: "issue-a", issueLineId: "issue-a-line-1", productId: "p-brg", qty: 5, issueLineQty: 200 },
      {
        materialIssueId: "issue-other-warehouse",
        issueLineId: "issue-other-warehouse-line-1",
        productId: "p-bolt",
        qty: 8,
        issueLineQty: 408,
        // It was issued from warehouse-2, and the return tries to put it into warehouse-1.
        issueWarehouseId: "warehouse-2",
      },
    ]);

    expect(failing(decision)).toEqual(["return_warehouse_matches_issue"]);
    expect(decision.verdict.pass === false && decision.verdict.level).toBe("block");
    expect(decision.checks.find((check) => check.id === "return_warehouse_matches_issue")?.detail).toContain("line 2");
  });

  it("mixing in a material issue from another production order passes today as long as the source line is posted, the warehouse matches, and the product matches (a known narrowing)", async () => {
    // This case records the current boundary, not the ideal. After material issue was decoupled from the production order,
    // a return has nothing left to compare for "cross order" (neither header has an order field anymore).
    // The right check would be the line `productionTaskId` for the same task. That field is a lookup today and is not stored.
    // The rule can read the value, but the right-hand side of the comparison still needs an input the user can see.
    const decision = await auditReturn([
      { materialIssueId: "issue-a", issueLineId: "issue-a-line-1", productId: "p-brg", qty: 5, issueLineQty: 200 },
      {
        materialIssueId: "issue-other-order",
        issueLineId: "issue-other-order-line-1",
        productId: "p-bolt",
        qty: 8,
        issueLineQty: 408,
      },
    ]);

    expect(failing(decision)).toEqual([]);
  });

  it("the source material issue is not posted yet; that line is blocked and stock cannot be increased from nothing", async () => {
    const decision = await auditReturn([
      { materialIssueId: "issue-a", issueLineId: "issue-a-line-1", productId: "p-brg", qty: 5, issueLineQty: 200 },
      { materialIssueId: "issue-draft", issueLineId: "issue-draft-line-1", productId: "p-bolt", qty: 8, issueLineQty: 408 },
    ]);

    // The stub has no `issue-draft`, so `ref_field_compare` fails closed on a reference it cannot load,
    // and the source gates fail together. What matters is that it did not pass silently.
    expect(failing(decision)).toContain("return_issue_posted");
    expect(decision.verdict.pass === false && decision.verdict.level).toBe("block");
  });

  it("a full return can be posted; pendingReview is already in the where clause, so this line must not be added again", async () => {
    // A line issued 10 and returns 10. The "already returned" quantity the query finds is this document's own 10, because it is pending review.
    // This used to `plus` the current line once more and compute 20 > 10, so a full return could never be posted
    // while a partial return of half or less could. That is the contradiction the floor used to see.
    const decision = await auditReturn(
      [{ materialIssueId: "issue-a", issueLineId: "issue-a-line-1", productId: "p-1", qty: 10, issueLineQty: 10 }],
      { "issue-a-line-1": 10 },
    );
    expect(failing(decision)).not.toContain("not_over_return");
  });

  it("a real over-return is still blocked: this line already returned 10, including this document, and someone else returned 1 more", async () => {
    const decision = await auditReturn(
      [{ materialIssueId: "issue-a", issueLineId: "issue-a-line-1", productId: "p-1", qty: 10, issueLineQty: 10 }],
      { "issue-a-line-1": 11 },
    );
    expect(failing(decision)).toContain("not_over_return");
  });

  it("the cumulative return cap is still judged per issue line; balance on another document does not excuse this line", async () => {
    // issue-a-line-1 was issued 200. Others returned 198 plus this document's 5 (both inside the where) = 203, over the cap.
    // issue-b-line-1 was issued 408. Only this document's 8 = 8, which is fine.
    // A whole-document measure (211 <= 608) would pass. That is where a per-line judgment and a whole-document judgment are not the same gate.
    const decision = await auditReturn(
      [
        { materialIssueId: "issue-a", issueLineId: "issue-a-line-1", productId: "p-brg", qty: 5, issueLineQty: 200 },
        { materialIssueId: "issue-b", issueLineId: "issue-b-line-1", productId: "p-bolt", qty: 8, issueLineQty: 408 },
      ],
      { "issue-a-line-1": 203, "issue-b-line-1": 8 },
    );

    expect(failing(decision)).toEqual(["not_over_return"]);
    expect(decision.checks.find((check) => check.id === "not_over_return")?.detail).toContain("line 1");
  });
});
