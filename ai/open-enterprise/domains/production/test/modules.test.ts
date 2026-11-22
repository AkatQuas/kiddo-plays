import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadCatalog, requireModule } from "@open-erp/loader";
import {
  evaluateTransition,
  isSystemSupplied,
  normalizeExecutionPlan,
  type CreateBillCommand,
  type ExecutionPlan,
  validateModule,
  type Field,
  type ModulePlanner,
  type ModuleSchema,
  type PlannerBillSnapshot,
  type PlannerContext,
} from "@open-erp/metamodel";
import { describe, expect, it } from "vitest";

// Cross-domain loop (order / process / receive). Schemas come from the catalog, with no relative import across composite packages.
const catalog = await loadCatalog({
  domainsRoot: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.."),
});
const productionOrder = requireModule(catalog, "productionOrder").schema;
const materialRequirement = requireModule(catalog, "materialRequirement").schema;
const productionTask = requireModule(catalog, "productionTask").schema;
const processAssignment = requireModule(catalog, "processAssignment").schema;
const processReport = requireModule(catalog, "processReport").schema;
const materialIssue = requireModule(catalog, "materialIssue").schema;
const materialReturn = requireModule(catalog, "materialReturn").schema;
const productionReceipt = requireModule(catalog, "productionReceipt").schema;
/**
 * Whether the declaration still has a gate that compares `unit` line by line.
 *
 * `NormalizedCheck.params` is `unknown` (each primitive has its own shape, and the kernel does not unfold that in the type),
 * so the shape is asserted here rather than by the type. What is asserted is existence. After the unit is frozen by a snapshot both sides share one source,
 * this kind of gate always passes, and it shows up in the checks list as a defense that passed.
 */
const unitCompareIds = (module: ModuleSchema): readonly string[] =>
  module.preconditions
    .filter((rule) => {
      const check = rule.check;
      return (
        check?.primitive === "ref_field_compare" && (check.params as { readonly field?: unknown }).field === "unit"
      );
    })
    .map((rule) => rule.id);


const MODULES = [
  productionOrder,
  materialRequirement,
  productionTask,
  processAssignment,
  processReport,
  materialIssue,
  materialReturn,
  productionReceipt,
];

const NOW = new Date("2026-07-30T00:00:00.000Z");
const NO_DATA = { get: async () => null, list: async () => [], balance: async () => 0 };

describe("Production execution modules", () => {
  it.each(MODULES.map((module) => [module.code, module] as const))("%s passes the single-module semantic gate", (_code, module) => {
    expect(validateModule(module).errors).toEqual([]);
  });

  // Candidate filters are a declaration, not screen behavior. Deleting one raises no error. The dropdown just lists
  // the whole tenant again, which looks exactly like "there is more data". The narrowing chain is pinned field by field here.
  // Missing one field means the person reporting or dispatching has to scroll through hundreds of rows again.
  const refFilterOf = (module: ModuleSchema, key: string) =>
    module.fields.find((field) => field.key === key)?.refFilter;

  it("the production factory lists only the factory level, and the three places match word for word", () => {
    for (const module of [productionOrder, productionTask, materialRequirement]) {
      expect([module.code, refFilterOf(module, "productionOrgId")]).toEqual([module.code, { orgType: "factory" }]);
    }
    // A filter does not replace a gate. They run at different moments (when picking, and when submitting),
    // and the organization in between can change level or be deactivated. The rule on the submit edge is unchanged.
    expect(productionOrder.preconditions.map((rule) => rule.id)).toContain("production_org_is_factory");
  });

  it("a production task goes to awaiting production after approval", async () => {
    const approve = productionTask.lifecycle.transitions.find((edge) => edge.code === "approve");
    const scheduled = productionTask.lifecycle.transitions.find((edge) => edge.code === "approveScheduled");
    expect(approve).toMatchObject({ from: "pendingReview", to: "awaitingLaunch", action: "Approve", primary: true });
    expect(scheduled).toMatchObject({ from: "pendingReview", to: "awaitingLaunch", action: "Approve" });
    expect(scheduled?.primary).not.toBe(true);
    expect(productionTask.lifecycle.transitions.find((edge) => edge.code === "complete")).toMatchObject({
      from: "inProduction",
      to: "completed",
    });

    const route = productionTask.preconditions.find((rule) => rule.id === "scheduled_tasks_use_scheduled_approval");
    expect(route).toMatchObject({
      onTransition: "approve",
      level: "route",
      exit: "approveScheduled",
    });
    expect(route?.check).toMatchObject({
      primitive: "field_compare",
      params: {
        left: { ref: "$bill.processLineCount" },
        op: "eq",
        right: { value: 0 },
      },
    });

    const taskPlanners = requireModule(catalog, "productionTask").planners;
    expect(taskPlanners.has("approve")).toBe(false);
    expect(taskPlanners.has("approveScheduled")).toBe(false);

    const actor = { id: "planner-1" };
    const unscheduled = await evaluateTransition({
      module: productionTask,
      bill: { id: "task-plain", status: "pendingReview", processLineCount: 0 },
      lines: [],
      params: {},
      actor,
      now: NOW,
      query: NO_DATA,
    }, "approve");
    expect(unscheduled.verdict.pass).toBe(true);
    expect(unscheduled.to).toBe("awaitingLaunch");

    const routed = await evaluateTransition({
      module: productionTask,
      bill: { id: "task-scheduled", status: "pendingReview", processLineCount: 2 },
      lines: [],
      params: {},
      actor,
      now: NOW,
      query: NO_DATA,
    }, "approve");
    expect(routed.verdict).toMatchObject({ pass: false, level: "route", exit: "approveScheduled" });

    const approved = await evaluateTransition({
      module: productionTask,
      bill: { id: "task-scheduled", status: "pendingReview", processLineCount: 2 },
      lines: [],
      params: {},
      actor,
      now: NOW,
      query: NO_DATA,
    }, "approveScheduled");
    expect(approved.verdict.pass).toBe(true);
    expect(approved.to).toBe("awaitingLaunch");
  });

  it("dispatch starts from the production task, and the work report hangs on the assignment", () => {
    expect(refFilterOf(processAssignment, "workerId")).toEqual({
      status: "active",
      productionOrgId: { from: "$bill.teamId" },
    });
    const processLines = productionTask.fields.find((field) => field.key === "processLines")?.fields ?? [];
    expect(processLines.find((field) => field.key === "moldId")?.refFilter).toEqual({ status: "active" });
    expect(processLines.find((field) => field.key === "equipmentId")?.refFilter).toEqual({ status: "active" });
    expect(processLines.find((field) => field.key === "pendingAssignedQty")?.derive).toMatchObject({
      kind: "rollup",
      where: { status: "pendingReview" },
    });
    expect(processLines.find((field) => field.key === "confirmedAssignedQty")?.derive).toMatchObject({
      kind: "rollup",
      where: { status: ["awaitingProduction", "inProduction"] },
    });
    expect(processLines.find((field) => field.key === "openAssignedQty")?.derive).toMatchObject({
      kind: "rollup",
      where: { status: ["pendingReview", "awaitingProduction", "inProduction"] },
    });
    expect(processLines.find((field) => field.key === "dispatchedQty")?.label).toBe("Quantity already assigned");
    expect(processLines.find((field) => field.key === "openAssignedQty")?.label).toBe("Assigned quantity still occupied");
    expect(refFilterOf(processReport, "processAssignmentId")).toEqual({
      status: ["awaitingProduction", "inProduction"],
    });
    const assignmentDraft = productionTask.lifecycle.transitions
      .flatMap((edge) => edge.params)
      .find((param) => param.key === "assignmentDraftLines")
      ?.lineField?.fields ?? [];
    expect(assignmentDraft.find((field) => field.key === "workerId")?.refFilter).toEqual({
      status: "active",
    });
    const assignmentLines = productionTask.lifecycle.transitions
      .flatMap((edge) => edge.params)
      .find((param) => param.key === "assignmentLines")
      ?.lineField?.fields ?? [];
    expect(assignmentLines.find((field) => field.key === "workerId")?.refFilter).toEqual({
      status: "active",
    });
    expect(processReport.preconditions.map((rule) => rule.id)).not.toContain("report_assignment_open");
  });

  it("BOM and routing on a production line are narrowed by this line's product plus effective, and the product itself lists only the two types that can be made in house", () => {
    const lines = productionOrder.fields.find((field) => field.key === "lines")?.fields ?? [];
    const filterOfLine = (key: string) => lines.find((column) => column.key === key)?.refFilter;
    // `$line.` reads the value on the same line. `$bill.` would read the whole order,
    // while BOM and routing follow the product, and the product is on the line.
    expect(filterOfLine("bomId")).toEqual({ productId: { from: "$line.productId" }, status: "active" });
    expect(filterOfLine("routingId")).toEqual({ productId: { from: "$line.productId" }, status: "active" });
    expect(filterOfLine("productId")).toEqual({ canProduce: true });
  });

  it("BOM and routing on a production task are narrowed by this document's product plus effective", () => {
    // Same shape as a production order line, except the coordinate is on the header (one task, one product).
    expect(refFilterOf(productionTask, "bomId")).toEqual({
      productId: { from: "$bill.productId" },
      status: "active",
    });
    expect(refFilterOf(productionTask, "routingId")).toEqual({
      productId: { from: "$bill.productId" },
      status: "active",
    });
  });

  it("production task issue: the header is only the date, and task, material, and warehouse are all on the line", () => {
    // The three header fields (production order, production task, material requirement) were removed together with the issue warehouse.
    // The reason is not that the header was crowded. One document can serve several tasks, cross orders, and use one warehouse per line.
    // Pressed onto the header, one of them has to be written, and the cumulative issue gate, the return snapshot, and cost collection all pair on it.
    // The number stays correct. It just points at the wrong task.
    for (const key of ["productionOrderId", "productionTaskId", "materialRequirementId", "warehouseId"]) {
      expect(materialIssue.fields.some((field) => field.key === key), key).toBe(false);
    }
    const lines = materialIssue.fields.find((field) => field.key === "lines");
    const lineField = (key: string) => lines?.fields?.find((field) => field.key === key);
    // The only business input: one frozen material line of a production task.
    expect(lineField("taskLineId")).toMatchObject({
      type: "refLine",
      ref: "productionTask",
      through: "materialLines",
      required: true,
    });
    // Companion ref: storage writes it from the refLine ownership. It is not a second input.
    expect(lineField("productionTaskId")).toMatchObject({ type: "ref", ref: "productionTask", required: true });
    expect(lineField("productId")?.snapshot).toEqual({
      from: "productionTask",
      match: "taskLineId",
      through: "materialLines",
      field: "componentProductId",
    });
    expect(lineField("warehouseId")).toMatchObject({
      type: "ref",
      ref: "warehouse",
      required: true,
      pushFrom: "defaultIssueWarehouseId",
    });
    // All three stock-out coordinates sit on the line. Leaving one warehouse on the header and deducting line by line would post the wrong warehouse.
    const confirm = materialIssue.lifecycle.transitions.find((edge) => edge.code === "confirm");
    expect(confirm?.effects?.map((effect) => [effect.subject, effect.scope])).toEqual([
      [{ from: "line", field: "productId" }, { from: "line", field: "warehouseId" }],
    ]);
    // The only declaration of "select several production tasks, then expand each frozen material line".
    expect(materialIssue.views.createFrom).toEqual([{
      path: "lines.taskLineId",
      label: "Create task material issue",
      // Issue does not include pendingReview. A task nobody has approved should not have its material taken first.
      // The order measures are different (a task occupies planned quantity as soon as it is created). Do not copy them.
      sourceStatuses: ["awaitingLaunch", "inProduction"],
      sourceRemaining: { header: "pendingIssueBaseQty", line: "materialLines.pendingIssueBaseQty" },
    }]);
    expect(materialIssue.views.createFrom[0]?.sourceStatuses).not.toContain("pendingReview");
    expect(materialIssue.views.createFrom[0]?.sourceStatuses).not.toContain("completed");
    expect(materialIssue.views.createFrom[0]?.sourceStatuses).not.toContain("cancelled");
    const formFields = materialIssue.views.form.flatMap((section) => section.fields);
    expect(formFields).toEqual(["code", "issueDate", "lines", "remark"]);
  });

  it("cancelling or rejecting a production task must clear unfinished issues first; open subcontract is closed by the planner cascade", () => {
    const byId = Object.fromEntries(productionTask.preconditions.map((gate) => [gate.id, gate]));
    // Cancel on pendingReview, awaitingProduction, and in production is the same action and hangs the same gate.
    expect(byId["no_open_issue_on_cancel"]?.onTransition).toBe("cancel");
    expect(byId["no_open_issue_on_reject_running"]?.onTransition).toBe("rejectRunning");
    expect(byId["no_active_subcontract_order_on_cancel"]).toBeUndefined();
    expect(byId["no_active_subcontract_order_on_cancel_running"]).toBeUndefined();
    const paramsOf = (id: string): Record<string, unknown> => {
      const check = byId[id]?.check;
      expect(check?.primitive, id).toBe("related_agg");
      return (check?.params ?? {}) as Record<string, unknown>;
    };
    for (const id of [
      "no_open_issue_on_cancel",
      "no_open_issue_on_reject_running",
    ]) {
      expect(paramsOf(id)).toMatchObject({
        from: "materialIssue",
        through: "lines",
        match: "productionTaskId",
        where: { status: ["pendingReview", "issued"] },
        op: "eq",
        right: { value: 0 },
      });
    }
    expect(productionTask.lifecycle.transitions.find((edge) => edge.code === "rejectRunning")).toMatchObject({
      from: "inProduction",
      to: "awaitingLaunch",
      action: "Reject",
    });
    expect(productionTask.lifecycle.transitions
      .filter((edge) => edge.code === "cancel")
      .map((edge) => [edge.from, edge.to, edge.action])).toEqual([
      ["pendingReview", "cancelled", "Cancel"],
      ["awaitingLaunch", "cancelled", "Cancel"],
      ["inProduction", "cancelled", "Cancel"],
    ]);
  });

  it("the material requirement list defaults to created time descending, so the newest row is on top", () => {
    expect(materialRequirement.views.list.defaultSort).toEqual({ field: "createdAt", desc: true });
  });

  it("a material requirement is no longer a prerequisite of issue: the push edge and the issued-quantity rollup were removed together, and no always-true gate was left behind", () => {
    // The left-hand value of `materials_issued_in_full` and `no_unreversed_issue_on_cancel` is
    // `$line.issuedBaseQty`, and the pairing coordinate of that rollup (materialIssue.lines.requirementLineId)
    // is gone. Leaving them is not "the gate is still there". They are two gates that always pass. A left-hand value of undefined means the comparison does not hold,
    // the engine lets a missing value through, and the screen still shows passed. That is worse than having no gate.
    expect(materialRequirement.preconditions).toEqual([]);
    expect(materialRequirement.lifecycle.transitions.map((edge) => edge.code)).toEqual([
      "toPurchasePlan",
      "complete",
      "cancel",
    ]);
    const requirementLines = materialRequirement.fields.find((field) => field.key === "lines");
    for (const key of ["issuedBaseQty", "issuedQty", "pendingQty", "issueMode", "manualRequiredQty"]) {
      expect(requirementLines?.fields?.some((field) => field.key === key), key).toBe(false);
    }
    // Issued and still-to-issue follow issue occupancy (the same sentence as `not_over_task_requirement`), not the warehouse job.
    // The line match must be `taskLineId`. The picker looks up quantity already referenced by refLine.
    const issuedWhere = { status: ["pendingReview", "issued"] };
    const taskLines = productionTask.fields.find((field) => field.key === "materialLines");
    expect(taskLines?.fields?.some((field) => field.key === "issueMode")).toBe(false);
    expect(taskLines?.fields?.some((field) => field.key === "manualRequiredQty")).toBe(false);
    expect(taskLines?.fields?.find((field) => field.key === "issuedBaseQty")?.derive).toMatchObject({
      kind: "rollup",
      from: "materialIssue",
      through: "lines",
      match: "taskLineId",
      where: issuedWhere,
    });
    expect(productionTask.fields.find((field) => field.key === "issuedBaseQty")?.derive).toMatchObject({
      kind: "rollup",
      from: "materialIssue",
      through: "lines",
      match: "productionTaskId",
      where: issuedWhere,
    });
    expect(productionTask.fields.find((field) => field.key === "confirmedIssuedBaseQty")?.derive).toMatchObject({
      kind: "rollup",
      from: "materialIssue",
      through: "lines",
      match: "productionTaskId",
      where: { status: "issued" },
    });
  });

  // Entry order is at least the candidate dependency order, judged once across the four domains in this cluster.
  //
  // Nothing else carries this invariant. When `refFilter` cannot read an upstream value it returns an empty set plus `pending` by design
  // (fail-closed: when the value cannot be read, return an empty set and say what is missing, and never fall back to unfiltered),
  // so a reversed order raises no error. The user sees a grammatically correct "fill in X first",
  // or simply "no matching options" in the dropdown, while the record is sitting in the database.
  // WB-BUG-54 on the acceptance note (a material requirement cannot select an effective BOM) and the leftover of WB-BUG-71 are this same shape.
  it("every candidate dependency on the form is ordered before the field that uses it (a reversed fail-closed refFilter raises no error)", () => {
    const offenders: string[] = [];
    for (const module of MODULES) {
      const order = module.views.form.flatMap((section) => section.fields);
      const at = (key: string) => order.indexOf(key);
      for (const field of module.fields) {
        if (at(field.key) < 0) continue;
        for (const operand of Object.values(field.refFilter ?? {})) {
          if (typeof operand !== "object" || operand === null || !("from" in operand)) continue;
          const from = (operand as { readonly from: string }).from;
          if (!from.startsWith("$bill.")) continue;
          const dep = from.slice("$bill.".length);
          // A dependency that is not on the form is a different shape (materialIssue does this on purpose) and is covered by its own assertion.
          if (at(dep) >= 0 && at(dep) > at(field.key)) {
            offenders.push(`${module.code}.${field.key} depends on ${dep}, but ${dep} is ordered after it`);
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  // WB-BUG-17, "the production task judged its operation tasks wrong": the judgment was right and the copy was wrong.
  // The default `related_agg` failure copy reports the number and not which set was counted (`where` only enters the rule),
  // so two gates on the same screen, each counting a different set, read as the same thing being both 0 and 2.
  // After task close became a planner cascade over assignments, the copy pin moved to subcontract and issue. The order side still pins the awaiting-launch copy.
  it.each([
    ["productionTask", "no_open_issue_on_cancel", "issues"],
    ["productionOrder", "production_tasks_reported", "awaitingLaunch"],
  ] as const)("%s %s names which set it counted", (code, id, statusWord) => {
    const module = code === "productionTask" ? productionTask : productionOrder;
    const rule = module.preconditions.find((one) => one.id === id);
    expect(rule?.check?.primitive).toBe("related_agg");
    expect(rule?.message).toBeTruthy();
    expect(rule?.message).toContain(statusWord);
  });

  it("the historical sync-complete gate queries only the production task's new statuses, and force complete and cancel no longer block", () => {
    const statusesOf = (id: string): readonly string[] => {
      const rule = productionOrder.preconditions.find((one) => one.id === id);
      const where = (rule?.check?.params as { readonly where?: { readonly status?: unknown } } | undefined)?.where;
      if (!Array.isArray(where?.status)) throw new Error(`${id} has no related_agg status set`);
      return where.status as readonly string[];
    };

    expect(statusesOf("production_tasks_reported")).toEqual(["pendingReview", "awaitingLaunch", "inProduction", "cancelled"]);
    for (const id of ["production_tasks_reported"]) {
      expect(statusesOf(id)).not.toContain("Awaiting start");
      expect(statusesOf(id)).not.toContain("inProgress");
    }
    expect(productionOrder.preconditions.some((rule) => rule.onTransition === "complete")).toBe(false);
    expect(productionOrder.preconditions.some((rule) => rule.onTransition === "cancel")).toBe(false);
  });

  // Actual start is written when a subcontract operation is approved or an assignment starts. It is not stamped on entering production, and it cannot be typed.
  // Actual end is stamped when Complete moves the task to completed. Every operation reaching its reported quantity is another path, and an existing value is not overwritten.
  it("actual start and end on a production task are written by the system and cannot be typed while in production", () => {
    const keys = productionTask.fields.map((field) => field.key);
    expect(keys).toContain("actualStartAt");
    expect(productionTask.fields.find((field) => field.key === "actualStartAt")).toMatchObject({
      type: "datetime",
      hidden: true,
      systemGenerated: true,
    });
    expect(productionTask.fields.find((field) => field.key === "actualStartAt")?.stampOnFirstEnter ?? null).toBeNull();
    expect(productionTask.fields.find((field) => field.key === "actualEndAt")).toMatchObject({
      type: "datetime",
      hidden: true,
      systemGenerated: true,
      stampOnFirstEnter: { status: "completed" },
    });
    const whitelist = (status: string) =>
      productionTask.lifecycle.statuses.find((one) => one.key === status)?.editableFields ?? [];
    expect(whitelist("awaitingLaunch")).not.toContain("actualStartAt");
    expect(whitelist("inProduction")).not.toContain("actualStartAt");
    expect(whitelist("inProduction")).not.toContain("actualEndAt");
  });

  it("release only moves status responsibility and does not write stock; it is now pushed by setStatus from the release document", () => {
    const release = productionOrder.lifecycle.transitions.find((edge) => edge.code === "release");
    expect(release?.effects).toEqual([]);
    expect(release?.from).toBe("awaitingRelease");
    // Release ends at releasing, not inProduction. One release may not schedule the whole order.
    // This status means tasks have been scheduled and the shop has not accepted the first one yet.
    // Entering production is brought by approving the first task. The remaining plan keeps being released while in production.
    expect(release?.to).toBe("releasing");
    const start = productionOrder.lifecycle.transitions.find((edge) => edge.code === "startProduction");
    expect(start?.from).toBe("releasing");
    expect(start?.to).toBe("inProduction");
    expect(start?.internal).toBe(true);

    // First release, an addition while releasing, and an addition while in production are the same Schedule production action and share one batch workbench.
    expect(productionOrder.lifecycle.transitions
      .filter((edge) => edge.code === "release")
      .map((edge) => [edge.from, edge.to, edge.action])).toEqual([
      ["awaitingRelease", "releasing", "Schedule production"],
      ["releasing", "releasing", "Schedule production"],
      ["inProduction", "inProduction", "Schedule production"],
    ]);

    // Clicking `release` by hand cannot skip this. The planner sends setStatus only after it has created the tasks (allocated quantity is then necessarily greater than 0),
    // and anyone can click the button. What comes out otherwise is an order that is releasing with no tasks, and the lines can no longer be edited.
    const gate = productionOrder.preconditions.find((rule) => rule.id === "mark_released_has_allocation");
    expect(gate?.onTransition).toBe("markReleased");
    expect(gate?.level).toBe("block");
    expect(gate?.check?.params).toMatchObject({
      from: "productionTask",
      through: "allocations",
      match: "sourceOrderId",
      op: "gt",
      right: { value: 0 },
      plus: null,
    });

    // Schedule, complete, and cancel each have one planner. The same action on different statuses branches inside the planner by the document's current status.
    expect([...requireModule(catalog, "productionOrder").planners.keys()].sort()).toEqual([
      "cancel",
      "complete",
      "release",
    ]);
    expect(requireModule(catalog, "productionOrder").escapeHatch).toBe(true);
  });

  it("confirming a material issue posts stock; material return and completion receipt still use their own public edges", () => {
    const issueConfirm = materialIssue.lifecycle.transitions.find((edge) => edge.code === "confirm");
    expect(issueConfirm).toMatchObject({ from: "pendingReview", to: "issued", primary: true, push: null });
    expect(issueConfirm?.effects.map((effect) => `${effect.target}:${effect.op}`)).toEqual(["stock:out"]);
    expect(materialIssue.lifecycle.transitions.find((edge) => edge.code === "releaseDemand")).toBeUndefined();

    for (const module of [materialReturn, productionReceipt]) {
      const release = module.lifecycle.transitions.find((edge) => edge.code === "releaseDemand");
      expect(release).toMatchObject({ from: "pendingReview", to: "completed", primary: true, push: null });
      expect(release?.effects.some((effect) => effect.target === "stock")).toBe(module === materialReturn);
      expect(module.lifecycle.transitions.find((edge) => edge.code === "audit")).toBeUndefined();
      expect(module.lifecycle.statuses.map((status) => status.key)).not.toContain("Awaiting work");
    }
  });

  it.each([
    ["Material return", materialReturn],
    ["Completion receipt", productionReceipt],
  ] as const)("%s has no source-document reversal edge", (_label, module) => {
    expect(module.lifecycle.transitions.find((edge) => edge.code === "reverse")).toBeUndefined();
    expect(module.lifecycle.statuses.find((status) => status.key === "Reversed")).toBeUndefined();
  });
});

describe("Production flow counterexamples", () => {
  it("pending review cannot be confirmed when the issue date is missing, and it passes once the date is filled", async () => {
    async function decide(issueDate?: string) {
      return evaluateTransition(
        {
          module: materialIssue,
          bill: { id: "issue-submit-facts", status: "pendingReview", issueDate },
          lines: [{
            taskLineId: "task-line-1",
            productionTaskId: "task-1",
            productId: "product-a",
            warehouseId: "warehouse-1",
            requirementBaseQty: 10,
            qty: 1,
            unit: "piece",
            unitFactor: 1,
            baseQty: 1,
          }],
          params: {},
          actor: { id: "keeper-1" },
          now: NOW,
          query: {
            get: async (entity) => {
              if (entity === "productionTask") return { status: "inProduction" };
              if (entity === "product") return { mainUnit: "piece", auxUnit: "box", conversionRate: 10 };
              return null;
            },
            list: async () => [],
            balance: async () => 100,
          },
        },
        "confirm",
      );
    }

    const missingDate = await decide();
    expect(missingDate.verdict.pass === false && missingDate.verdict.level).toBe("block");
    expect(missingDate.checks.find((check) => check.id === "issue_facts_required")?.ok).toBe(false);

    const completeFacts = await decide("2026-07-30");
    expect(completeFacts.verdict.pass).toBe(true);
  });

  it("issuing demand checks that the task is still running and that the issue does not exceed this task's BOM requirement, both line by line", async () => {
    async function decide(taskStatus: string, qty: number) {
      return evaluateTransition(
        {
          module: materialIssue,
          bill: { id: "issue-source-guard", status: "pendingReview", issueDate: "2026-07-30" },
          lines: [{
            taskLineId: "task-line-1",
            productionTaskId: "task-1",
            productId: "product-a",
            warehouseId: "warehouse-1",
            requirementBaseQty: 10,
            qty,
            unit: "piece",
            unitFactor: 1,
            baseQty: qty,
          }],
          params: {},
          actor: { id: "keeper-1" },
          now: NOW,
          query: {
            get: async (entity) => {
              if (entity === "productionTask") return { status: taskStatus };
              if (entity === "product") return { mainUnit: "piece", auxUnit: "box", conversionRate: 10 };
              return null;
            },
            list: async () => [],
            balance: async () => 100,
          },
        },
        "confirm",
      );
    }

    // The task has already ended, so it cannot be issued more material. The check is on the line. One document can hang several tasks,
    // and one cancelled while the others are still running is normal. Judging on the header would have no right-hand value.
    const finished = await decide("completed", 1);
    expect(finished.verdict.pass === false && finished.verdict.level).toBe("block");
    expect(finished.checks.find((check) => check.id === "issue_task_active")?.ok).toBe(false);

    // Exceeding this task's frozen BOM requirement is blocked. The pairing key taskLineId is
    // the line id of `productionTask.materialLines`. Each task freezes its own copy. It is a document line, not master data.
    // Subcontract hit the opposite: after pointing at bom.lines (master data built per product), the second document for the same product was always blocked by mistake.
    const overIssue = await decide("inProduction", 11);
    expect(overIssue.verdict.pass === false && overIssue.verdict.level).toBe("block");
    expect(overIssue.checks.find((check) => check.id === "not_over_task_requirement")?.ok).toBe(false);

    const valid = await decide("inProduction", 1);
    expect(valid.verdict.pass).toBe(true);
  });

  it("issue product no longer needs a consistency gate: that field is a snapshot and the user has no input for it", () => {
    // `issue_products_match_requirement_lines` was deleted, not relaxed.
    // `lines.productId` changed from "the user fills it and a gate compares it" to a snapshot frozen from the task material line.
    // Hanging "what you filled does not match the source" on a system-supplied field makes both sides the same source, so it always passes.
    // That is the same reason `issue_unit_matches_*` was deleted.
    const lines = materialIssue.fields.find((field) => field.key === "lines");
    const productId = lines?.fields?.find((field) => field.key === "productId");
    expect(productId?.snapshot).not.toBeNull();
    expect(isSystemSupplied(productId!, lines?.fields ?? [])).toBe(true);
    expect(materialIssue.preconditions.map((rule) => rule.id)).not.toContain("issue_products_match_requirement_lines");
  });

  it("a return whose product does not match the source issue line cannot release a warehouse demand", async () => {
    const decision = await evaluateTransition(
      {
        module: materialReturn,
        bill: { id: "return-1", status: "pendingReview", returnDate: "2026-07-30" },
        lines: [{
          materialIssueId: "issue-1",
          issueLineId: "issue-line-1",
          productId: "product-b",
          issueProductId: "product-a",
          warehouseId: "warehouse-1",
          issueWarehouseId: "warehouse-1",
          issueLineQty: 10,
          issueLineBaseQty: 10,
          qty: 1,
          unit: "piece",
          unitFactor: 1,
          baseQty: 1,
        }],
        params: {},
        actor: { id: "keeper-1" },
        now: NOW,
        query: {
          get: async (entity) => entity === "product"
            ? { mainUnit: "piece", auxUnit: "box", conversionRate: 10 }
            : {
                productionOrderId: "order-1",
                productionTaskId: "task-1",
                warehouseId: "warehouse-1",
              },
          list: async () => [],
          balance: async () => 0,
        },
      },
      "releaseDemand",
    );

    expect(decision.verdict.pass === false && decision.verdict.level).toBe("block");
    expect(decision.checks.find((check) => check.id === "return_products_match_issue_lines")?.ok).toBe(false);
  });

  it("a return demand cannot be released when the source material issue has not finished the warehouse job", async () => {
    const decision = await evaluateTransition(
      {
        module: materialReturn,
        bill: { id: "return-2", status: "pendingReview", returnDate: "2026-07-30" },
        lines: [{
          materialIssueId: "issue-1",
          issueLineId: "issue-line-1",
          productId: "product-a",
          issueProductId: "product-a",
          warehouseId: "warehouse-1",
          issueWarehouseId: "warehouse-1",
          issueLineQty: 10,
          issueLineBaseQty: 10,
          qty: 1,
          unit: "piece",
          unitFactor: 1,
          baseQty: 1,
        }],
        params: {},
        actor: { id: "keeper-1" },
        now: NOW,
        query: {
          get: async (entity) => entity === "product"
            ? { mainUnit: "piece", auxUnit: "box", conversionRate: 10 }
            : {
                productionOrderId: "order-1",
                productionTaskId: "task-1",
                warehouseId: "warehouse-1",
                status: "pendingReview",
              },
          list: async () => [],
          balance: async () => 0,
        },
      },
      "releaseDemand",
    );

    expect(decision.verdict.pass === false && decision.verdict.level).toBe("block");
    expect(decision.checks.find((check) => check.id === "return_issue_posted")?.ok).toBe(false);
  });

  it("a production task from another order or another product cannot be used for a completion receipt", async () => {
    const decision = await evaluateTransition(
      {
        module: productionReceipt,
        bill: {
          id: "receipt-1",
          status: "pendingReview",
          productionOrderId: "order-b",
          productionTaskId: "task-a",
          productId: "product-b",
          receiptDate: "2026-08-06",
          handlerId: "keeper-1",
          warehouseId: "warehouse-b",
          inboundQty: 1,
        },
        lines: [{ productionTaskId: "task-a", productId: "product-b", warehouseId: "warehouse-b", qty: 1, unit: "piece", unitFactor: 1, baseQty: 1 }],
        params: {},
        actor: { id: "keeper-1" },
        now: NOW,
        query: {
          get: async (entity) => entity === "product"
            ? { mainUnit: "piece", auxUnit: "box", conversionRate: 10 }
            : {
                productionOrderId: "order-a",
                productId: "product-a",
                completionWarehouseId: "warehouse-a",
                status: "completed",
              },
          list: async () => [],
          balance: async () => 0,
        },
      },
      "releaseDemand",
    );

    expect(decision.verdict.pass === false && decision.verdict.level).toBe("block");
    expect(
      decision.checks
        .filter((check) => check.id.startsWith("receipt_") && !check.ok)
        .map((check) => check.id),
    // After the receipt dropped awaiting submit, the gates that used to hang on `submit` moved together onto
    // `releaseDemand`, which is now this document's only checkpoint. They should fail together here,
    // not only three of them. The gates were not relaxed. There is one fewer checkpoint.
    ).toEqual([
      "receipt_order_matches_task",
      "receipt_product_matches_task",
    ]);
  });

  it("an assignment starts in pending review, and only starting it after approval moves the production order forward", () => {
    const statuses = processAssignment.lifecycle.statuses.map((one) => one.key);
    expect(statuses).toEqual(["pendingReview", "awaitingProduction", "inProduction", "completed", "cancelled"]);
    expect(statuses).not.toContain("Awaiting start");
    expect(productionTask.lifecycle.transitions
      .filter((edge) => edge.code === "assign")
      .map((edge) => [edge.from, edge.to, edge.action])).toEqual([
      ["awaitingLaunch", "awaitingLaunch", "Dispatch"],
      ["inProduction", "inProduction", "Dispatch"],
    ]);
    expect(processAssignment.lifecycle.transitions.find((edge) => edge.code === "start")).toMatchObject({
      from: "awaitingProduction",
      to: "inProduction",
      action: "Start",
      confirm: true,
    });
    expect(requireModule(catalog, "processAssignment").planners.has("start")).toBe(true);
  });

  it("a production task that has not been launched cannot release a completion-receipt demand", async () => {
    const decision = await evaluateTransition(
      {
        module: productionReceipt,
        bill: {
          id: "receipt-2",
          status: "pendingReview",
          productionOrderId: "order-1",
          productionTaskId: "task-1",
          productId: "product-a",
          receiptDate: "2026-08-06",
          handlerId: "keeper-1",
          warehouseId: "warehouse-1",
          inboundQty: 1,
        },
        lines: [{ productionTaskId: "task-1", productId: "product-a", warehouseId: "warehouse-1", qty: 1, unit: "piece", unitFactor: 1, baseQty: 1 }],
        params: {},
        actor: { id: "keeper-1" },
        now: NOW,
        query: {
          get: async (entity) => entity === "product"
            ? { mainUnit: "piece", auxUnit: "box", conversionRate: 10 }
            : {
                productionOrderId: "order-1",
                productId: "product-a",
                completionWarehouseId: "warehouse-1",
                status: "awaitingLaunch",
              },
          list: async () => [],
          balance: async () => 0,
        },
      },
      "releaseDemand",
    );

    expect(decision.verdict.pass === false && decision.verdict.level).toBe("block");
    expect(decision.checks.find((check) => check.id === "receipt_task_completed")?.ok).toBe(false);
    const blockedMessage = decision.checks.find((check) => check.id === "receipt_task_completed")?.message ?? "";
    expect(blockedMessage).toBe(
      "There is no approved qualified quantity, so this cannot be received. Report the work and approve it, then receive once there is qualified quantity. A task still in inProduction can be received. It does not have to wait until the whole task is done.",
    );
    expect(blockedMessage).not.toMatch(/main unit|release quantity|row count is|not less than/);
  });

  it("an in-production task with approved qualified quantity is not blocked by the receipt gate just because the task is not closed", async () => {
    const decision = await evaluateTransition(
      {
        module: productionReceipt,
        bill: {
          id: "receipt-running",
          status: "pendingReview",
          productionOrderId: "order-1",
          productionTaskId: "task-1",
          productId: "product-a",
          receiptDate: "2026-08-06",
          handlerId: "keeper-1",
          warehouseId: "warehouse-1",
          inboundQty: 1,
        },
        lines: [{ productionTaskId: "task-1", productId: "product-a", warehouseId: "warehouse-1", qty: 1, unit: "piece", unitFactor: 1, baseQty: 1 }],
        params: {},
        actor: { id: "keeper-1" },
        now: NOW,
        query: {
          get: async (entity) => entity === "product"
            ? { mainUnit: "piece", auxUnit: "box", conversionRate: 10 }
            : {
                productionOrderId: "order-1",
                productId: "product-a",
                completionWarehouseId: "warehouse-1",
                status: "inProduction",
              },
          list: async () => [],
          balance: async () => 0,
        },
      },
      "releaseDemand",
    );

    expect(decision.checks.find((check) => check.id === "receipt_task_completed")?.ok).toBe(true);
  });

  it("the completion receipt header help says, in shop language, when a receipt can be made", () => {
    const taskHelp = productionReceipt.fields.find((field) => field.key === "productionTaskId")?.help ?? "";
    expect(taskHelp).toContain("inProduction");
    expect(taskHelp).toContain("qualified");
    expect(taskHelp).not.toMatch(/main unit|release quantity|write-off|row count is|not less than/);
  });

  // The unit starts from the upstream value, and it can still be switched among this product's main and auxiliary unit candidates.
  // Saving freezes unitFactor and computes baseQty. Allocation and stock both use the main-unit quantity.
  it.each([
    ["Material issue", materialIssue, { from: "productionTask", match: "taskLineId", through: "materialLines", field: "unit" }],
    ["Material return", materialReturn, { from: "materialIssue", match: "issueLineId", through: "lines", field: "unit" }],
    ["Completion receipt", productionReceipt, { from: "productionTask", match: "productionTaskId", through: null, field: "unit" }],
  ] as const)("%s starts its unit from the upstream measure and freezes the conversion factor into a main-unit quantity", (_label, module, refDefault) => {
    const columns = module.fields.find((field) => field.key === "lines")?.fields ?? [];
    const unit = columns.find((field) => field.key === "unit");
    const factor = columns.find((field) => field.key === "unitFactor");
    const baseQty = columns.find((field) => field.key === "baseQty");
    expect(unit).toMatchObject({ type: "enum", required: true, refDefault, unitChoice: { match: "productId", factorInto: "unitFactor" } });
    expect(isSystemSupplied(unit as Field, columns)).toBe(false);
    expect(factor && isSystemSupplied(factor, columns)).toBe(true);
    expect(baseQty?.calculate).toMatchObject({ op: "mul" });
    expect(unitCompareIds(module)).toEqual([]);
  });

  it("every hop of the unit chain allows a choice but starts from the direct upstream, and does not reread today's product main unit to rewrite history", () => {
    const hop = (module: (typeof MODULES)[number], key: string, table = "lines") =>
      module.fields.find((field) => field.key === table)?.fields?.find((field) => field.key === key);
    expect(hop(materialReturn, "unit")?.refDefault?.from).toBe("materialIssue");
    // The direct upstream of the issue hop is now the production task's frozen material line. That line is the hop frozen from `product.mainUnit`,
    // and the material requirement is no longer on the issue chain.
    expect(hop(materialIssue, "unit")?.refDefault?.from).toBe("productionTask");
    expect(hop(productionTask, "unit", "materialLines")?.refDefault?.from).toBe("product");
    expect(hop(materialRequirement, "unit")?.refDefault?.from).toBe("product");
  });

  it("a production task cannot be completed by reporting when no operation has been reported", async () => {
    const decision = await evaluateTransition(
      {
        module: productionTask,
        bill: { id: "task-1", status: "inProduction" },
        lines: [],
        params: {},
        actor: { id: "manager-1" },
        now: NOW,
        query: NO_DATA,
      },
      "complete",
    );

    expect(decision.verdict.pass === false && decision.verdict.level).toBe("block");
    expect(decision.checks.find((check) => check.id === "completed_process_task_required")?.ok).toBe(false);
  });

  // The complete edge only has the "operations must already be scheduled" gate. Open assignments are force-completed by the planner, so two row-count failures no longer show side by side.
  it("when no operations are scheduled, the complete-gate copy does not fall back to the row-count primitive", async () => {
    const decision = await evaluateTransition(
      {
        module: productionTask,
        bill: { id: "task-1", status: "inProduction", processLineCount: 0 },
        lines: [],
        params: {},
        actor: { id: "manager-1" },
        now: NOW,
        query: {
          get: async () => null,
          list: async (entity, where) => {
            if (entity !== "processAssignment") return [];
            const status = (where as Readonly<Record<string, unknown>>)["status"];
            return Array.isArray(status) && status.includes("inProduction") ? [{ id: "asg-1" }] : [];
          },
          balance: async () => 0,
        },
      },
      "complete",
    );

    const messageOf = (id: string) => decision.checks.find((check) => check.id === id)?.message ?? "";
    expect(messageOf("completed_process_task_required")).toContain("no operations yet");
    expect(messageOf("completed_process_task_required")).not.toContain("row count is");
    expect(decision.checks.some((check) => check.id === "process_tasks_completed")).toBe(false);
    expect(decision.verdict.pass === false && decision.verdict.message).not.toContain("row count is");
  });

  it("when open assignments exist the complete-edge gate does not block, and the planner cascade closes them", async () => {
    const decision = await evaluateTransition(
      {
        module: productionTask,
        bill: { id: "task-1", status: "inProduction", processLineCount: 2 },
        lines: [],
        params: {},
        actor: { id: "manager-1" },
        now: NOW,
        query: {
          get: async () => null,
          list: async (entity, where) => {
            if (entity !== "processAssignment") return [];
            const status = (where as Readonly<Record<string, unknown>>)["status"];
            return Array.isArray(status) && status.includes("inProduction") ? [{ id: "asg-1" }] : [];
          },
          balance: async () => 0,
        },
      },
      "complete",
    );
    expect(decision.verdict.pass).toBe(true);
  });
  it("an order can be force-completed from in production, and the task and cross-product receipt quantity gates are gone", async () => {
    const syncComplete = productionOrder.lifecycle.transitions.find((edge) => edge.code === "syncComplete");
    expect(syncComplete).toMatchObject({ from: "inProduction", to: "finished", action: "Sync task completion", internal: true });
    expect(productionOrder.lifecycle.transitions.find((edge) => edge.code === "reportDone")).toMatchObject({
      from: "inProduction",
      to: "reported",
      internal: true,
    });
    expect(productionOrder.lifecycle.transitions.find((edge) => edge.code === "complete")).toMatchObject({
      from: "inProduction",
      to: "finished",
      confirm: true,
    });
    expect(productionOrder.preconditions.some((rule) => rule.onTransition === "complete")).toBe(false);
    expect(productionOrder.lifecycle.transitions.find((edge) => edge.code === "reopenAfterTaskReopened")).toMatchObject({
      from: "finished",
      to: "inProduction",
      internal: true,
    });

    const decision = await evaluateTransition(
      {
        module: productionOrder,
        bill: { id: "order-1", status: "inProduction" },
        lines: [],
        params: {},
        actor: { id: "manager-1" },
        now: NOW,
        query: {
          get: async () => null,
          list: async () => [],
          balance: async () => 0,
        },
      },
      "syncComplete",
    );

    expect(decision.verdict.pass === false && decision.verdict.level).toBe("block");
    expect(decision.checks.find((check) => check.id === "completed_production_task_required_sync")?.ok).toBe(false);
    expect(decision.checks.find((check) => check.id === "production_receipted_in_full")).toBeUndefined();
  });

});

function snapshot(
  id: string,
  header: Readonly<Record<string, unknown>>,
  lines: Readonly<Record<string, readonly Readonly<Record<string, unknown>>[]>> = {},
): PlannerBillSnapshot {
  return { id, revision: 1, header, lines };
}

// ---------------------------------------------------------------------------
// Production order batch release planner. Several source orders share one transient workbench.
//
// The action parameters carry the lines the planner checked this time, so three things hold at once:
//   1. One line, one production task (one document, one product, and the same product is not merged).
//   2. Each line has its own release quantity. When operations occupy the window, the plan window is the earliest operation start and the latest operation end.
//   3. After release, every involved source order is moved to releasing (setStatus, and only orders still on awaitingRelease are pushed).
// ---------------------------------------------------------------------------

const releasePlanners = requireModule(catalog, "productionOrder").planners;

/** Default shape of one release line. Tests override it field by field so each case does not repeat 15 keys. */
const RELEASE_LINE = {
  productId: "product-p1",
  spec: "Spec-1",
  unit: "piece",
  unitFactor: 1,
  orderBaseQty: 100,
  releaseQty: 10,
  baseReleaseQty: 10,
  plannedStartDate: "2026-08-03T00:00:00.000Z",
  plannedEndDate: "2026-08-07T00:00:00.000Z",
  bomId: "bom-1",
  routingId: "routing-1",
  productionOrgId: "factory-1",
  issueWarehouseId: "warehouse-material",
  completionWarehouseId: "warehouse-a",
} as const;

/** Three lines, two orders. line-1 belongs to order A, line-2 and line-3 belong to order B. line-1 and line-2 are the same product and are not merged. line-3 is another product. */
const THREE_LINES: readonly Readonly<Record<string, unknown>>[] = [
  { ...RELEASE_LINE, id: "prel-1-line-1", sourceOrderLineId: "order-a-line-1", sourceOrderId: "order-a" },
  {
    ...RELEASE_LINE,
    id: "prel-1-line-2",
    sourceOrderLineId: "order-b-line-1",
    sourceOrderId: "order-b",
    releaseQty: 5,
    baseReleaseQty: 5,
    // The completion warehouse and window differ from line-1. One line, one task, each carrying its own, and they are no longer merged into one.
    completionWarehouseId: "warehouse-b",
    plannedStartDate: "2026-08-01T00:00:00.000Z",
    plannedEndDate: "2026-08-09T00:00:00.000Z",
  },
  {
    ...RELEASE_LINE,
    id: "prel-1-line-3",
    sourceOrderLineId: "order-b-line-2",
    sourceOrderId: "order-b",
    productId: "product-p2",
    bomId: "bom-2",
    routingId: "routing-2",
    releaseQty: 7,
    baseReleaseQty: 7,
    completionWarehouseId: "warehouse-b",
  },
];

async function releasePlan(
  mode: "merged" | "separate",
  options: {
    readonly lines?: readonly Readonly<Record<string, unknown>>[];
    readonly processLines?: readonly Readonly<Record<string, unknown>>[];
    readonly orderStatus?: Readonly<Record<string, string>>;
    readonly completionMode?: "manual" | "automatic";
  } = {},
) {
  const lines = options.lines ?? THREE_LINES;
  const orderStatus = options.orderStatus ?? { "order-a": "awaitingRelease", "order-b": "awaitingRelease" };
  // The anchor order uses the same Schedule production action on awaiting release, releasing, and in production.
  const transition = "release";
  const planner = releasePlanners.get(transition) as ModulePlanner;
  const reads: string[] = [];
  const orderSnapshot = (id: string): PlannerBillSnapshot => {
    const status = orderStatus[id];
    if (status === undefined) throw new Error(`unexpected order ${id}`);
    const selected = lines.filter((line) => line["sourceOrderId"] === id);
    const first = selected[0] ?? RELEASE_LINE;
    const extras = first as Readonly<Record<string, unknown>>;
    return snapshot(
      id,
      {
        status,
        productionOrgId: first["productionOrgId"],
        issueWarehouseId: first["issueWarehouseId"],
        completionWarehouseId: first["completionWarehouseId"],
        remark: extras["headerRemark"] ?? null,
      },
      {
        lines: selected.map((line) => ({
          id: line["sourceOrderLineId"],
          productId: line["productId"],
          spec: line["spec"],
          unit: line["unit"],
          unitFactor: line["unitFactor"],
          pendingReleaseBaseQty: line["orderBaseQty"],
          bomId: line["bomId"],
          routingId: line["routingId"],
        })),
      },
    );
  };
  const ctx: PlannerContext = {
    module: "productionOrder",
    transition,
    bill: orderSnapshot("order-a"),
    params: {
      releaseMode: mode,
      releaseLines: lines,
      ...(options.processLines === undefined ? {} : { processLines: options.processLines }),
    },
    read: {
      async moduleSetting(code) {
        if (code !== "production.taskCompletionMode") throw new Error(`unexpected module setting ${code}`);
        return options.completionMode ?? "manual";
      },
      async getBill(module, id) {
        reads.push(`${module}:${id}`);
        if (module === "bom") {
          return snapshot(
            id,
            { productId: id === "bom-1" ? "product-p1" : "product-p2", status: "active" },
            {
              lines: [
                { componentProductId: "component-a", unitQty: 2, unit: "piece", unitFactor: 1, baseUnitQty: 2, lossRate: 5, defaultIssueWarehouseId: "warehouse-a" },
              ],
            },
          );
        }
        if (module === "routing") {
          return snapshot(
            id,
            { productId: id === "routing-1" ? "product-p1" : "product-p2", status: "active" },
            {
              lines: [
                { sequence: 10, operationId: "operation-cut", defaultTeamId: "team-cut", assignmentRatio: 2, pieceRate: 3.5, outsourcingMode: "No subcontract" },
                { sequence: 20, operationId: "operation-assemble", defaultTeamId: "team-assemble", assignmentRatio: 0.5, pieceRate: 1.5, outsourcingMode: "No subcontract" },
              ],
            },
          );
        }
        if (module === "product") {
          return snapshot(id, { mainUnit: "piece", spec: "Spec-A iron seal" });
        }
        if (module === "operation") {
          return snapshot(id, {});
        }
        if (module === "orgUnit") {
          if (id === "line-cut") return snapshot(id, { orgType: "line", status: "active", parentOrgId: "workshop-cut" });
          if (id === "line-assemble") return snapshot(id, { orgType: "line", status: "active", parentOrgId: "workshop-assemble" });
          if (id === "workshop-cut" || id === "workshop-assemble") return snapshot(id, { orgType: "workshop", status: "active" });
        }
        if (module === "productionOrder") {
          return orderSnapshot(id);
        }
        throw new Error(`unexpected read ${module}:${id}`);
      },
      async listBills(module) {
        throw new Error(`unexpected list ${module}`);
      },
      async invariantBillSummary() { throw new Error("the release planner must not read invariant aggregates"); },
      async invariantLineSummary() { throw new Error("the release planner must not read invariant line aggregates"); },
    },
  };
  return { executionPlan: normalizeExecutionPlan(await planner(ctx)), reads };
}

const createdBills = (plan: ExecutionPlan): readonly CreateBillCommand[] =>
  plan.commands.filter((command): command is CreateBillCommand => command.type === "createBill");

describe("productionOrder batch planner: one line, one task", () => {
  it("each release reads the current module settings and freezes them onto the new task, and later setting changes do not change the old plan", async () => {
    const manual = createdBills((await releasePlan("separate", { completionMode: "manual" })).executionPlan)
      .filter((command) => command.module === "productionTask");
    const automatic = createdBills((await releasePlan("separate", { completionMode: "automatic" })).executionPlan)
      .filter((command) => command.module === "productionTask");

    expect(manual.every((command) => command.header["completionMode"] === "manual")).toBe(true);
    expect(automatic.every((command) => command.header["completionMode"] === "automatic")).toBe(true);
    expect(manual.every((command) => command.header["completionMode"] === "manual")).toBe(true);
  });

  it("checking 3 lines across 2 orders creates one task per line, and the same product is not merged", async () => {
    const { executionPlan } = await releasePlan("separate");
    const tasks = createdBills(executionPlan).filter((c) => c.module === "productionTask");
    expect(tasks).toHaveLength(3);
    expect(tasks.map((t) => t.header["plannedQty"])).toEqual([10, 5, 7]);
    expect(tasks.map((t) => t.header["productionOrderId"])).toEqual(["order-a", "order-b", "order-b"]);
    expect(tasks.map((t) => t.header["productId"])).toEqual(["product-p1", "product-p1", "product-p2"]);
    expect(tasks[0]?.lines["allocations"]).toEqual([
      { sourceOrderLineId: "order-a-line-1", allocatedQty: 10 },
    ]);
    expect(tasks[1]?.lines["allocations"]).toEqual([
      { sourceOrderLineId: "order-b-line-1", allocatedQty: 5 },
    ]);
    expect(tasks[2]?.lines["allocations"]).toEqual([
      { sourceOrderLineId: "order-b-line-2", allocatedQty: 7 },
    ]);
    // Write only the refLine. `sourceOrderId` on the same row and the same target is a stored companion column, and the planner writing it hits the key gate.
    for (const task of tasks) {
      for (const row of task.lines["allocations"] ?? []) {
        expect(Object.hasOwn(row, "sourceOrderId")).toBe(false);
      }
      expect(task.lines["allocations"]).toHaveLength(1);
    }
  });

  it("release carries the production order remark as it was, and does not write a separate sales order remark", async () => {
    const { executionPlan } = await releasePlan("separate", {
      lines: [{ ...THREE_LINES[0], headerRemark: "Urgent after the change" }],
    });
    const task = createdBills(executionPlan).find((command) => command.module === "productionTask");
    expect(task?.header["remark"]).toBe("Urgent after the change");
    expect(task?.header).not.toHaveProperty("salesOrderRemark");
  });

  it("each line carries its own completion warehouse and plan window, and they are not merged or reduced to min and max", async () => {
    const { executionPlan } = await releasePlan("separate");
    const tasks = createdBills(executionPlan).filter((c) => c.module === "productionTask");
    expect(tasks.map((t) => t.header["completionWarehouseId"])).toEqual([
      "warehouse-a",
      "warehouse-b",
      "warehouse-b",
    ]);
    expect(tasks[0]?.header["plannedStartDate"]).toBe(THREE_LINES[0]?.["plannedStartDate"]);
    expect(tasks[1]?.header["plannedStartDate"]).toBe("2026-08-01T00:00:00.000Z");
    expect(tasks[1]?.header["plannedEndDate"]).toBe("2026-08-09T00:00:00.000Z");
    expect(createdBills(executionPlan).some((c) => c.module === "processTask")).toBe(false);
    const requirement = createdBills(executionPlan).find((c) => c.commandId === "material-requirement-001");
    expect(requirement?.header["requiredDate"]).toBe(String(THREE_LINES[0]?.["plannedEndDate"]).slice(0, 10));
  });

  it("when no operations are scheduled, the BOM explodes by this line's quantity and only creates material requirements and production tasks", async () => {
    const { executionPlan, reads } = await releasePlan("separate");
    // Reread the source order, BOM, and routing line by line for a pre-concurrency check. Then explode each line once. Component specs are cached.
    expect(reads).toEqual([
      "productionOrder:order-a",
      "bom:bom-1",
      "routing:routing-1",
      "productionOrder:order-b",
      "bom:bom-1",
      "routing:routing-1",
      "productionOrder:order-b",
      "bom:bom-2",
      "routing:routing-2",
      "bom:bom-1",
      "product:component-a",
      "bom:bom-1",
      "product:component-a",
      "bom:bom-2",
      "product:component-a",
      "productionOrder:order-a",
      "productionOrder:order-b",
    ]);
    const requirement = createdBills(executionPlan).find((c) => c.commandId === "material-requirement-001");
    const task = createdBills(executionPlan).find((c) => c.commandId === "production-task-001");
    // 10 pieces times unit quantity 2 times (1 + 5% loss) = 21
    expect(requirement?.lines["lines"]).toEqual([
      {
        componentProductId: "component-a",
        unitQty: 2,
        unit: "piece",
        lossRate: 5,
        productionBaseQty: 10,
        requiredQty: 21,
        spec: "Spec-A iron seal",
        defaultIssueWarehouseId: "warehouse-a",
        sourceLineNo: 1,
        bomPath: "product-p1 / component-a",
      },
    ]);
    for (const row of requirement?.lines["lines"] ?? []) {
      expect(Object.hasOwn(row, "issueMode")).toBe(false);
      expect(Object.hasOwn(row, "manualRequiredQty")).toBe(false);
    }
    expect(task?.lines["materialLines"]).toEqual([
      {
        componentProductId: "component-a",
        unitQty: 2,
        unit: "piece",
        lossRate: 5,
        requiredQty: 21,
        spec: "Spec-A iron seal",
        defaultIssueWarehouseId: "warehouse-a",
        sourceLineNo: 1,
        bomPath: "product-p1 / component-a",
      },
    ]);
    expect(executionPlan.commands.map((c) => `${c.type}:${c.commandId}`)).toEqual([
      "createBill:material-requirement-001",
      "createBill:production-task-001",
      "createBill:material-requirement-002",
      "createBill:production-task-002",
      "createBill:material-requirement-003",
      "createBill:production-task-003",
      "setStatus:production-order-release-001",
    ]);
  });

  it("the plan has no Date instance and no instant from ctx.now, so preview and run evaluate to the same text", async () => {
    const { executionPlan: a } = await releasePlan("separate");
    const { executionPlan: b } = await releasePlan("separate");
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    const walk = (value: unknown): void => {
      expect(value).not.toBeInstanceOf(Date);
      if (Array.isArray(value)) value.forEach(walk);
      else if (value && typeof value === "object") Object.values(value).forEach(walk);
    };
    walk(a);
    // The old placeholder window was pinned to the UTC day boundary of ctx.now, so preview and run returned 409 across that boundary. Nothing comes from it now.
    expect(JSON.stringify(a)).not.toContain("2026-08-01T09:17");
  });

  it("a releaseMode other than separate is rejected immediately, and merge is no longer used", async () => {
    await expect(releasePlan("merged")).rejects.toThrow(/releaseMode must be separate/);
  });

  it("when processLines is omitted, the plan has no launch batch and no operation tasks", async () => {
    const { executionPlan } = await releasePlan("separate");
    expect(createdBills(executionPlan).map((command) => command.module)).toEqual([
      "materialRequirement",
      "productionTask",
      "materialRequirement",
      "productionTask",
      "materialRequirement",
      "productionTask",
    ]);
  });

  it("scheduling only selects the production line, and the task operation team keeps the routing default", async () => {
    const { executionPlan } = await releasePlan("separate", {
      lines: [{
        ...THREE_LINES[0]!,
        plannedStartDate: "2026-08-04T00:00:00.000Z",
        plannedEndDate: "2026-08-06T00:00:00.000Z",
      }],
      processLines: [
        {
          operationId: "operation-cut",
          sequence: 10,
          productionLineOrgId: "line-cut",
          plannedStartDate: "2026-08-03T00:00:00.000Z",
          plannedEndDate: "2026-08-05T00:00:00.000Z",
        },
        {
          operationId: "operation-assemble",
          sequence: 20,
          productionLineOrgId: "line-assemble",
          plannedStartDate: "2026-08-05T00:00:00.000Z",
          plannedEndDate: "2026-08-07T00:00:00.000Z",
        },
      ],
    });
    expect(executionPlan.commands.map((command) => `${command.type}:${command.commandId}`)).toEqual([
      "createBill:material-requirement-001",
      "createBill:production-task-001",
    ]);
    const task = createdBills(executionPlan).find((command) => command.module === "productionTask");
    expect(task?.header["plannedStartDate"]).toBe("2026-08-03T00:00:00.000Z");
    expect(task?.header["plannedEndDate"]).toBe("2026-08-07T00:00:00.000Z");
    const requirement = createdBills(executionPlan).find((command) => command.module === "materialRequirement");
    expect(requirement?.header["requiredDate"]).toBe("2026-08-07");
    expect(task?.lines["processLines"]?.map((row) => row["operationId"])).toEqual(["operation-cut", "operation-assemble"]);
    expect(task?.lines["processLines"]?.map((row) => [row["productionLineOrgId"], row["teamId"]])).toEqual([
      ["line-cut", "team-cut"],
      ["line-assemble", "team-assemble"],
    ]);
    expect(task?.lines["processLines"]?.map((row) => row["productionLineOrgId"])).toEqual([
      "line-cut",
      "line-assemble",
    ]);
    expect(task?.lines["processLines"]?.map((row) => row["outsourcingMode"])).toEqual([
      "No subcontract",
      "No subcontract",
    ]);
    const taskQty = Number(task?.header["plannedQty"]);
    expect(task?.lines["processLines"]?.map((row) => [row["assignmentRatio"], row["plannedQty"]])).toEqual([
      [2, taskQty * 2],
      [0.5, taskQty * 0.5],
    ]);
    expect(createdBills(executionPlan).some((command) => command.module === "processTask" || command.module === "productionLaunch")).toBe(false);
  });

  it("an operation with no equipment type cannot carry production equipment", async () => {
    await expect(releasePlan("separate", {
      lines: [THREE_LINES[0]!],
      processLines: [
        {
          operationId: "operation-cut",
          sequence: 10,
          productionLineOrgId: "line-cut",
          equipmentId: "equipment-cut",
          plannedStartDate: "2026-08-03T00:00:00.000Z",
          plannedEndDate: "2026-08-05T00:00:00.000Z",
        },
        {
          operationId: "operation-assemble",
          sequence: 20,
          productionLineOrgId: "line-assemble",
          plannedStartDate: "2026-08-05T00:00:00.000Z",
          plannedEndDate: "2026-08-07T00:00:00.000Z",
        },
      ],
    })).rejects.toThrow(/has no equipment type/);
  });
});

describe("productionOrder batch planner: lines are issued directly and do not drill into a child BOM across documents", () => {
  it("when the root BOM has a semi-finished line, only that semi-finished goods is issued, and its child BOM is neither read nor exploded", async () => {
    const planner = releasePlanners.get("release") as ModulePlanner;
    const line = {
      ...RELEASE_LINE,
      id: "release-a-line",
      sourceOrderLineId: "order-a-line-1",
      sourceOrderId: "order-a",
      productId: "product-a",
      bomId: "bom-a-v1",
      routingId: "routing-a-v1",
      releaseQty: 10,
      baseReleaseQty: 10,
      orderBaseQty: 10,
      issueWarehouseId: "warehouse-material",
    };
    const order = snapshot("order-a", {
      status: "awaitingRelease",
      productionOrgId: "factory-1",
      issueWarehouseId: "warehouse-material",
      completionWarehouseId: "warehouse-finished",
    }, {
      lines: [{
        id: "order-a-line-1",
        productId: "product-a",
        spec: "A",
        unit: "piece",
        unitFactor: 1,
        pendingReleaseBaseQty: 10,
        bomId: "bom-a-v1",
        routingId: "routing-a-v1",
      }],
    });
    const reads: string[] = [];
    const ctx: PlannerContext = {
      module: "productionOrder",
      transition: "release",
      bill: order,
      params: { releaseMode: "separate", releaseLines: [line] },
      read: {
        async moduleSetting() { return "manual"; },
        async ledgerBalance() { throw new Error("release no longer explodes by the semi-finished stock shortfall"); },
        async invariantLineSummary() { throw new Error("release no longer reserves stock by occupancy still to issue"); },
        async invariantBillSummary() { throw new Error("release must not aggregate the header"); },
        async listBills() { throw new Error("release must not look up other BOM versions"); },
        async getBill(module, id) {
          reads.push(`${module}:${id}`);
          if (module === "productionOrder") return order;
          if (module === "routing" && id === "routing-a-v1") {
            return snapshot(id, { productId: "product-a", status: "active" }, { lines: [] });
          }
          if (module === "bom" && id === "bom-a-v1") {
            return snapshot(id, { productId: "product-a", status: "active" }, { lines: [{
              componentProductId: "product-b",
              // A legacy pinned-version field is ignored by release even if it is still in the database.
              childBomId: "bom-b-frozen-v7",
              unitQty: 1,
              baseUnitQty: 1,
              unit: "piece",
              unitFactor: 1,
              lossRate: 0,
              defaultIssueWarehouseId: "warehouse-material",
            }] });
          }
          if (module === "product" && id === "product-b") {
            return snapshot(id, { productType: "semiFinished", mainUnit: "piece", spec: "B-semi-finished" });
          }
          throw new Error(`unexpected read ${module}:${id}`);
        },
      },
    };
    const plan = normalizeExecutionPlan(await planner(ctx));
    const tasks = createdBills(plan).filter((command) => command.module === "productionTask");
    const requirements = createdBills(plan).filter((command) => command.module === "materialRequirement");
    expect(tasks).toHaveLength(1);
    expect(tasks[0]!.header["productId"]).toBe("product-a");
    expect(tasks[0]!.lines["materialLines"]?.map((row) => [row["componentProductId"], row["requiredQty"]])).toEqual([
      ["product-b", 10],
    ]);
    expect(requirements[0]!.lines["lines"]?.map((row) => [row["componentProductId"], row["unitQty"], row["requiredQty"]])).toEqual([
      ["product-b", 1, 10],
    ]);
    expect(reads).not.toContain("bom:bom-b-frozen-v7");
    expect(createdBills(plan).some((command) =>
      command.module === "productionTask" && command.header["productId"] === "product-b")).toBe(false);
  });
});

describe("productionOrder batch planner: move the other source orders to releasing", () => {
  it("the anchor order is moved by the current edge, other awaiting-release orders get setStatus, and that comes after every create", async () => {
    const { executionPlan } = await releasePlan("separate");
    const setStatus = executionPlan.commands.filter((c) => c.type === "setStatus");
    expect(setStatus).toEqual([
      {
        type: "setStatus",
        commandId: "production-order-release-001",
        target: { kind: "existing", module: "productionOrder", id: "order-b" },
        transition: "markReleased",
        expectedStatus: "awaitingRelease",
      },
    ]);
    // Order is part of the assertion. `markReleased` requires this order to already have allocated quantity,
    // and that quantity is produced by the tasks created in this run. Sending it early rolls the whole group back.
    const firstSetStatus = executionPlan.commands.findIndex((c) => c.type === "setStatus");
    const lastCreate = executionPlan.commands.map((c) => c.type).lastIndexOf("createBill");
    expect(firstSetStatus).toBeGreaterThan(lastCreate);
  });

  it("an order already on releasing is not pushed again; pushing again hits expectedStatus and fails the whole group", async () => {
    // This order having been released before is normal (the remaining lines are checked again),
    // and it must not fail this release.
    const { executionPlan } = await releasePlan("separate", {
      orderStatus: { "order-a": "releasing", "order-b": "awaitingRelease" },
    });
    const setStatus = executionPlan.commands.filter((c) => c.type === "setStatus");
    expect(setStatus).toHaveLength(1);
    expect(setStatus[0]).toMatchObject({
      commandId: "production-order-release-001",
      target: { kind: "existing", module: "productionOrder", id: "order-b" },
    });
  });

  it("when no source order is on awaitingRelease, no setStatus is sent, and the tasks are still created", async () => {
    const { executionPlan } = await releasePlan("separate", {
      orderStatus: { "order-a": "releasing", "order-b": "releasing" },
    });
    expect(executionPlan.commands.filter((c) => c.type === "setStatus")).toHaveLength(0);
    expect(createdBills(executionPlan).filter((c) => c.module === "productionTask")).toHaveLength(3);
  });

  it("an order already inProduction can take an additional release, and its status is not changed back", async () => {
    const { executionPlan } = await releasePlan("separate", {
      orderStatus: { "order-a": "inProduction", "order-b": "inProduction" },
    });
    expect(executionPlan.commands.filter((c) => c.type === "setStatus")).toHaveLength(0);
    expect(createdBills(executionPlan).filter((c) => c.module === "productionTask")).toHaveLength(3);
  });

  // setStatus pushes "which edge to take", not "which status to become". The target edge's preconditions,
  // handoff, and effects all still run. This pins that the edge exists and its start matches,
  // otherwise `assertPlanTargets` only fails at preview.
  it("the edge setStatus names really exists on the production order, and its start equals expectedStatus word for word", () => {
    const edge = productionOrder.lifecycle.transitions.find((one) => one.code === "markReleased");
    expect(edge?.from).toBe("awaitingRelease");
    // The target edge must not bind a planner of its own. A nested plan has no fingerprint, and the confirmation the outer user sees does not include it.
    expect(requireModule(catalog, "productionOrder").planners.has("markReleased")).toBe(false);
  });
});

describe("Completion receipt: the planned warehouse is the default, and the line warehouse is the stock fact", () => {
  it("one document, one task: the task and warehouse sit on the header, and the lines only serve posting", () => {
    expect(productionReceipt.fields.find((one) => one.key === "productionTaskId")?.required).toBe(true);
    expect(productionReceipt.fields.find((one) => one.key === "warehouseId")?.required).toBe(true);
    expect(productionReceipt.fields.find((one) => one.key === "inboundQty")?.required).toBe(true);
    expect(productionReceipt.fields.find((one) => one.key === "warehouseId")?.refDefault).toEqual({
      from: "productionTask",
      match: "productionTaskId",
      through: null,
      field: "completionWarehouseId",
    });
    const lines = productionReceipt.fields.find((one) => one.key === "lines")?.fields ?? [];
    expect(lines.find((one) => one.key === "productionTaskId")?.required).toBe(true);
    expect(lines.find((one) => one.key === "warehouseId")?.required).toBe(true);
    expect(lines.find((one) => one.key === "productionCompletionId")).toBeUndefined();
  });

  it("stock is posted to the warehouse finally chosen on each line, and it is not forced to equal the task's planned warehouse", async () => {
    const decision = await evaluateTransition(
      {
        module: productionReceipt,
        bill: {
          id: "receipt-3",
          status: "pendingReview",
          productionOrderId: "order-1",
          productionTaskId: "task-1",
          productId: "product-a",
          receiptDate: "2026-07-30",
          handlerId: "keeper-1",
          warehouseId: "warehouse-b",
          inboundQty: 1,
        },
        lines: [{
          productionTaskId: "task-1",
          productId: "product-a",
          plannedQty: 10,
          plannedBaseQty: 10,
          taskCompletionWarehouseId: "warehouse-a",
          warehouseId: "warehouse-b",
          qty: 1,
          unit: "piece",
          unitFactor: 1,
          baseQty: 1,
        }],
        params: {},
        actor: { id: "keeper-1" },
        now: NOW,
        query: {
          get: async (entity) => entity === "product"
            ? { mainUnit: "piece", auxUnit: "box", conversionRate: 10 }
            : {
                productionOrderId: "order-1",
                productId: "product-a",
                completionWarehouseId: "warehouse-a",
                status: "completed",
              },
          list: async (entity) => entity === "processAssignment" ? [{ assignedQty: 10 }] : [],
          balance: async () => 0,
        },
      },
      "releaseDemand",
    );
    expect(decision.checks.some((one) => one.id === "receipt_warehouse_matches_task")).toBe(false);
    expect(decision.plan.forward).toEqual([]);
  });
});
