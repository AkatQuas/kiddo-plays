import {
  defineActionPreparers,
  defineBatchActions,
  defineModule,
  definePlanners,
  normalizeField,
  roundToScale,
  schemaFail,
  type ExecutionCommand,
  type ExecutionPlan,
  type ActionPreparerContext,
  type PlannerContext,
  type PlanRecord,
  requireText,
  requireNumber,
  optionalText,
} from "@open-erp/metamodel";

/**
 * Storage reads a datetime back as a Date. The planner needs a stable wire string when it writes a task operation line.
 * Treating it as ordinary text makes "launch all" throw 500 during preview, even though the task's plan window
 * is complete. Only a Date or ISO text is accepted. It is not widened to an arbitrary object.
 */
function dateTime(value: unknown, label: string): string {
  if (value instanceof Date) {
    if (!Number.isFinite(value.valueOf())) throw new Error(`${label} is not a valid time`);
    return value.toISOString();
  }
  const raw = requireText(value, label);
  if (!Number.isFinite(new Date(raw).valueOf())) throw new Error(`${label} is not a valid time`);
  return raw;
}

/**
 * A datetime from parameters: use it when it was filled, otherwise fall back to the header.
 *
 * Do not use `optionalText`. This cell is `type: "datetime"` in the parameter declaration,
 * and `normalizeField` has already turned it into a `Date` before the planner runs.
 * `optionalText` only accepts a string, so a schedule that was filled correctly throws
 * "Operation 1 start time must be non-empty text", and the client receives a 500 "internal server error".
 * The error says the cell is empty when it was filled, and it talks about text when the value was never text.
 * The first real per-operation schedule in 3.5.0 failed here.
 *
 * Throw `schemaFail`, not a bare `Error`. The value the caller sent does not hold.
 * That is a 400 plus the sentence, not a 500 plus "see the server log".
 */
function optionalDateTime(value: unknown, label: string): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (value instanceof Date) {
    if (!Number.isFinite(value.valueOf())) schemaFail(`${label} is not a valid time`);
    return value.toISOString();
  }
  if (typeof value !== "string") schemaFail(`${label} must be a time`);
  if (!Number.isFinite(new Date(value).valueOf())) schemaFail(`${label} is not a valid time`);
  return value;
}

function rowsOf(value: unknown, label: string): readonly Readonly<Record<string, unknown>>[] {
  if (!Array.isArray(value) || value.length === 0) schemaFail(`${label} needs at least one line`);
  return value.map((row, index) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) schemaFail(`${label} row ${index + 1} is not an object`);
    return row as Readonly<Record<string, unknown>>;
  });
}

const launchProcessLinesField = normalizeField({
  key: "launchProcessLines",
  label: "Launched operation resources",
  type: "subtable",
  ref: "productionLaunchProcessInput",
  required: true,
  fields: [
    { key: "operationId", label: "Operation", type: "ref", ref: "operation", required: true },
    { key: "sequence", label: "Operation sequence", type: "number", required: true },
    { key: "teamId", label: "Team", type: "ref", ref: "orgUnit", person: { role: "receiver", via: { members: "worker", by: "productionOrgId", field: "platformUserId" } } },
    { key: "equipmentId", label: "Equipment", type: "ref", ref: "equipment", refFilter: { status: "active" } },
    { key: "moldId", label: "Mold", type: "ref", ref: "mold", refFilter: { status: "active" } },
    /**
     * Per-operation planned start and end (3.5.0).
     *
     * Every operation used to copy the one pair of dates on the production task header, so a real schedule
     * such as "inspect 8:00-13:00, foil 15:00-17:00" could not be expressed. The shop saw two operations
     * with identical times and had to ask out loud.
     *
     * The values land on `processLines.plannedStartDate / plannedEndDate`.
     * This is the entry that lets a person schedule them.
     *
     * Sequence checks follow the process type (`routing.processType`). Sequential production requires the next operation to start after the previous one.
     * Parallel and unordered do not check. The only rule is the one in the planner below.
     */
    { key: "plannedStartDate", label: "Start time", type: "datetime", required: true },
    { key: "plannedEndDate", label: "End time", type: "datetime", required: true },
  ],
}, "productionTask.launch.processLines");

const launchParams = [
  { key: "launchQty", label: "Quantity launched this time", type: "number" as const, required: true },
  { key: "productionMode", label: "Production mode (sequential / unordered)", type: "text" as const, required: true },
  // Preview and run of a planner edge each execute once. If launch time is each call's own ctx.now, the plan
  // fingerprint is stale because the milliseconds differ. It must be frozen when the action is prepared and reused by both requests.
  { key: "launchedAt", label: "Launch time", type: "text" as const, required: true },
  { key: "launchProcessLines", label: "Launched operation resources", type: "billLines" as const, required: true, lineField: launchProcessLinesField },
] as const;

const LAUNCH_TRANSITIONS = {
  launchAll: { from: "awaitingLaunch", fully: true },
} as const;

async function productionLaunchPlan(ctx: PlannerContext): Promise<ExecutionPlan> {
  const contract = LAUNCH_TRANSITIONS[ctx.transition as keyof typeof LAUNCH_TRANSITIONS];
  if (contract === undefined) throw new Error(`Unknown launch transition ${ctx.transition}`);
  const status = requireText(ctx.bill.header["status"], "Production task status");
  if (status !== contract.from) schemaFail(`The production task is "${status}", so this launch action cannot run`);

  const launchQty = requireNumber(ctx.params["launchQty"], "Quantity launched this time");
  if (launchQty <= 0) schemaFail("The launch quantity must be greater than zero");
  const unitFactor = requireNumber(ctx.bill.header["unitFactor"], "Production task unit conversion factor");
  const baseLaunchQty = roundToScale(launchQty * unitFactor, "number", "Main-unit launch quantity this time");
  // Scheduling operations must schedule the whole task at once. There is no "already launched" ledger
  // (the launch-record module was deleted, and nothing in the workspace ever created it), so the remainder equals the plan itself.
  const plannedBaseQty = requireNumber(ctx.bill.header["basePlannedQty"], "Production task planned quantity in the main unit");
  if (baseLaunchQty > plannedBaseQty) schemaFail(`This launch exceeds the planned quantity. At most ${String(plannedBaseQty / unitFactor)} can be scheduled`);
  const fully = baseLaunchQty === plannedBaseQty;
  if (fully !== contract.fully) {
    schemaFail("Launch operations must schedule the entire remaining quantity at once");
  }

  const mode = requireText(ctx.params["productionMode"], "Production mode");
  if (mode !== "Sequential production" && mode !== "Unordered production") schemaFail("Production mode can only be Sequential production or Unordered production");
  const inputRows = rowsOf(ctx.params["launchProcessLines"], "Launched operation resources");
  const routingId = requireText(ctx.bill.header["routingId"], "Frozen routing");
  const routing = await ctx.read.getBill("routing", routingId);
  /**
   * The sequence check uses the process type (`routing.processType` is required since 3.5.0),
   * not the production mode chosen at launch. If the routing says the route is sequential, it is sequential.
   * The person scheduling must not change that at the moment of launch.
   *   · Sequential production — the next operation must not start before the latest finish of the operations before it
   *   · Parallel / unordered — operation times are not checked against each other
   * Existing routings were backfilled to "Sequential production" (see migration 0021), so this cell always has a value.
   */
  const processType = optionalText(routing.header["processType"], "Process type") ?? "Sequential production";
  const routeRows = [...(routing.lines["lines"] ?? [])].sort(
    (left, right) => requireNumber(left["sequence"], "Operation sequence") - requireNumber(right["sequence"], "Operation sequence"),
  );
  if (routeRows.length === 0) throw new Error("The frozen routing has no operations, so it cannot be launched");
  if (inputRows.length !== routeRows.length) schemaFail("Launch operation lines must match the frozen routing exactly, with no missing or extra operations");

  const inputByCoordinate = new Map(inputRows.map((row, index) => {
    const operationId = requireText(row["operationId"], `Launch operation row ${index + 1} operation`);
    const sequence = requireNumber(row["sequence"], `Launch operation row ${index + 1} sequence`);
    return [`${sequence}\u0000${operationId}`, row] as const;
  }));
  if (inputByCoordinate.size !== inputRows.length) schemaFail("Launch resources cannot repeat the same operation");
  if ((ctx.bill.lines["processLines"] ?? []).length > 0) {
    schemaFail("This task already has operations. Do not schedule more from here");
  }

  const commands: ExecutionCommand[] = [];
  const processLineRows: PlanRecord[] = [];
  let latestEnd = "";
  for (const [index, routeRow] of routeRows.entries()) {
    const operationId = requireText(routeRow["operationId"], `Routing line ${index + 1} operation`);
    const sequence = requireNumber(routeRow["sequence"], `Routing line ${index + 1} sequence`);
    const input = inputByCoordinate.get(`${sequence}\u0000${operationId}`);
    if (input === undefined) schemaFail(`Launch resources are missing the setup for operation sequence ${sequence}`);
    const operation = await ctx.read.getBill("operation", operationId);
    const assignmentRatio = requireNumber(routeRow["assignmentRatio"] ?? 1, `Operation ${sequence} assignment ratio`);
    if (assignmentRatio <= 0) schemaFail(`The assignment ratio for operation ${sequence} must be greater than 0`);
    const teamId = optionalText(input["teamId"], `Operation ${sequence} team`) ?? requireText(routeRow["defaultTeamId"], `Operation ${sequence} default team`);
    const equipmentId = optionalText(input["equipmentId"], `Operation ${sequence} equipment`);
    const moldId = optionalText(input["moldId"], `Operation ${sequence} mold`);
    const wantEquipment = optionalText(operation.header["equipmentType"], `Operation ${sequence} equipment type`);
    const wantMold = optionalText(operation.header["moldType"], `Operation ${sequence} mold type`);
    if (equipmentId !== null) {
      if (wantEquipment === null) schemaFail(`Operation sequence ${sequence} has no equipment type, so equipment cannot be selected`);
      const equipment = await ctx.read.getBill("equipment", equipmentId);
      if (optionalText(equipment.header["category"], "Equipment type") !== wantEquipment) {
        schemaFail(`Operation sequence ${sequence} can only use equipment of type "${wantEquipment}"`);
      }
    }
    if (moldId !== null) {
      if (wantMold === null) schemaFail(`Operation sequence ${sequence} has no mold type, so a mold cannot be selected`);
      const mold = await ctx.read.getBill("mold", moldId);
      if (optionalText(mold.header["moldType"], "Mold type") !== wantMold) {
        schemaFail(`Operation sequence ${sequence} can only use a mold of type "${wantMold}"`);
      }
    }
    /**
     * Per-operation planned start and end prefer the pair filled at scheduling. Only a missing pair falls back to the task header.
     */
    const lineStart = optionalDateTime(input["plannedStartDate"], `Operation ${sequence} start time`);
    const lineEnd = optionalDateTime(input["plannedEndDate"], `Operation ${sequence} end time`);
    const startAt = lineStart ?? dateTime(ctx.bill.header["plannedStartDate"], "Planned start");
    const endAt = lineEnd ?? dateTime(ctx.bill.header["plannedEndDate"], "Planned end");
    const scheduled = lineStart !== null && lineEnd !== null;
    if (scheduled && endAt < startAt) {
      schemaFail(`Operation sequence ${sequence} ends before it starts`);
    }
    if (scheduled && processType === "Sequential production" && latestEnd !== "" && startAt < latestEnd) {
      schemaFail(
        `This routing is Sequential production: operation ${sequence} starts at ${startAt}` +
        ` which is before the previous operation finishes (${latestEnd}). Use Parallel production or Unordered production to run them side by side`,
      );
    }
    if (scheduled) latestEnd = latestEnd === "" || endAt > latestEnd ? endAt : latestEnd;
    processLineRows.push({
      operationId,
      sequence,
      assignmentRatio,
      plannedQty: roundToScale(launchQty * assignmentRatio, "number", `Operation ${sequence} planned quantity`),
      plannedStartDate: startAt,
      plannedEndDate: endAt,
      teamId,
      requiresReportApproval: routeRow["requiresApproval"] !== false,
      pieceRate: requireNumber(routeRow["pieceRate"] ?? 0, `Operation ${sequence} piece rate`),
      outsourcingMode: requireText(routeRow["outsourcingMode"], `Operation ${sequence} subcontract`),
      ...(equipmentId === null ? {} : { equipmentId }),
      ...(moldId === null ? {} : { moldId }),
    });
  }
  commands.push({
    type: "appendSourceLines",
    commandId: "append-process-lines",
    table: "processLines",
    rows: processLineRows,
  });
  return { version: 1, commands };
}

async function prepareProductionLaunch(context: ActionPreparerContext) {
  const routingId = requireText(context.bill.header["routingId"], "Frozen routing");
  const routing = await context.read.getBill("routing", routingId);
  const routeRows = [...(routing.lines["lines"] ?? [])].sort(
    (left, right) => requireNumber(left["sequence"], "Operation sequence") - requireNumber(right["sequence"], "Operation sequence"),
  );
  if (routeRows.length === 0) throw new Error("The frozen routing has no operations, so it cannot be launched");
  /**
   * Starting values for each operation's planned start and end.
   *
   * Sequential production must not copy the task header's one pair onto every operation. The second operation would
   * start at the same instant the first one finishes, and the sequence gate in plan evaluation would reject it immediately.
   * A default that is rejected as soon as the dialog opens makes the user think the system is broken. Sequential production
   * therefore splits the task window into adjoining segments, one per operation.
   * Parallel / unordered production share the whole window (they do not check time).
   *
   * When the window cannot be computed (both header cells empty, or not a valid instant), give no cell at all and let the person fill them.
   * Inventing a default instant is worse than leaving them empty. It looks as if the system already scheduled the work.
   */
  const processType = optionalText(routing.header["processType"], "Process type") ?? "Sequential production";
  const startMs = Date.parse(String(context.bill.header["plannedStartDate"] ?? ""));
  const endMs = Date.parse(String(context.bill.header["plannedEndDate"] ?? ""));
  const spannable = Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > startMs;
  const slice = (index: number, count: number): { plannedStartDate: string; plannedEndDate: string } | null => {
    if (!spannable) return null;
    if (processType !== "Sequential production" || count <= 1) {
      return {
        plannedStartDate: new Date(startMs).toISOString(),
        plannedEndDate: new Date(endMs).toISOString(),
      };
    }
    const step = (endMs - startMs) / count;
    return {
      plannedStartDate: new Date(startMs + step * index).toISOString(),
      plannedEndDate: new Date(startMs + step * (index + 1)).toISOString(),
    };
  };
  return {
    launchQty: requireNumber(context.bill.header["plannedQty"], "Planned quantity"),
    productionMode: "Unordered production",
    launchedAt: context.now.toISOString(),
    launchProcessLines: routeRows.map((row, index) => {
      const window = slice(index, routeRows.length);
      return {
        operationId: requireText(row["operationId"], `Routing line ${index + 1} operation`),
        sequence: requireNumber(row["sequence"], `Routing line ${index + 1} sequence`),
        teamId: requireText(row["defaultTeamId"], `Routing line ${index + 1} default team`),
        ...(window === null ? {} : window),
      };
    }),
  };
}

const assignmentDraftLineField = normalizeField({
  key: "assignmentDraftLines",
  label: "Assigned worker",
  type: "subtable",
  ref: "productionTaskAssignmentDraftLine",
  // A whole-team dispatch does not name a person. The action parameters must allow that omission.
  // The planner builds one team assignment from the operation's remaining quantity.
  required: false,
  fields: [
    {
      key: "workerId",
      label: "Assigned worker",
      type: "ref",
      ref: "worker",
      // No person selected means the whole document is assigned to the operation's team. assignmentPlan creates a team assignment with an empty workerId,
      // and the report later lands on a specific reporting worker. When people are selected, dispatch and dedupe stay per person.
      refFilter: { status: "active" },
    },
    { key: "assignedQty", label: "Assigned quantity", type: "number", required: true },
    { key: "pieceRate", label: "Piece rate", type: "number" },
  ],
}, "productionTask.assign.assignmentDraftLines");

const assignmentLineColumns = [
    { key: "productionTaskId", label: "Production task", type: "ref", ref: "productionTask", required: true },
    { key: "processLineId", label: "Operation line", type: "string", required: true },
    { key: "operationId", label: "Operation", type: "ref", ref: "operation", required: true },
    { key: "workshopOrgId", label: "Workshop", type: "ref", ref: "orgUnit", required: true, refFilter: { orgType: "workshop" } },
    { key: "productionLineOrgId", label: "Production line", type: "ref", ref: "orgUnit", required: true, refFilter: { orgType: "line" } },
    { key: "teamId", label: "Team", type: "ref", ref: "orgUnit", required: true, refFilter: { orgType: "team" } },
    // A named dispatch picks from every active worker, not only the operation's team. The team is the worker record, and it is written on submit.
    { key: "workerId", label: "Worker", type: "ref", ref: "worker", refFilter: { status: "active" } },
    { key: "assignedQty", label: "Assigned quantity", type: "number", required: true },
    { key: "requiresReportApproval", label: "Report approval", type: "bool", required: true },
    { key: "pieceRate", label: "Piece rate", type: "number", required: true },
    { key: "equipmentId", label: "Equipment", type: "ref", ref: "equipment", refFilter: { status: "active" } },
    { key: "moldId", label: "Mold", type: "ref", ref: "mold", refFilter: { status: "active" } },
    { key: "plannedStartDate", label: "Start time", type: "datetime", required: true },
    { key: "plannedEndDate", label: "End time", type: "datetime", required: true },
    { key: "assignedAt", label: "Assigned at", type: "datetime", required: true },
] as const;

const assignmentLineField = normalizeField({
  key: "assignmentLines",
  label: "Assignment lines",
  type: "subtable",
  ref: "productionTaskAssignmentInput",
  required: true,
  fields: assignmentLineColumns,
}, "productionTask.batchActions.dispatchProduction.lineField");

const optionalAssignmentLineField = normalizeField({
  key: "assignmentLines",
  label: "Assignment lines",
  type: "subtable",
  ref: "productionTaskAssignmentInput",
  required: false,
  fields: assignmentLineColumns,
}, "productionTask.assign.assignmentLines");

function bool(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") schemaFail(`${label} must be a boolean`);
  return value;
}

async function validateAssignmentOrg(
  ctx: PlannerContext,
  workshopOrgId: string,
  productionLineOrgId: string,
  teamId: string,
): Promise<void> {
  const [workshop, line, team] = await Promise.all([
    ctx.read.getBill("orgUnit", workshopOrgId),
    ctx.read.getBill("orgUnit", productionLineOrgId),
    ctx.read.getBill("orgUnit", teamId),
  ]);
  if (workshop.header["orgType"] !== "workshop" || workshop.header["status"] !== "active") {
    schemaFail("The assignment workshop is not a valid workshop organization");
  }
  if (line.header["orgType"] !== "line" || line.header["status"] !== "active") {
    schemaFail("The assignment line is not a valid production-line organization");
  }
  if (team.header["orgType"] !== "team" || team.header["status"] !== "active") {
    schemaFail("The assignment team is not a valid team organization");
  }
  // The team does not have to hang under the selected line (a routing's default team and the scheduled line often cross). The line only has to belong to the workshop.
  if (line.header["parentOrgId"] !== workshopOrgId) {
    schemaFail("The assignment line does not belong to the selected workshop");
  }
}

async function assignmentLinesPlan(ctx: PlannerContext): Promise<ExecutionPlan> {
  const mode = ctx.params["assignmentMode"];
  if (mode !== "dispatch" && mode !== "dispatchAll") schemaFail("The dispatch mode is not valid");
  const assignmentQty = mode === "dispatch"
    ? requireNumber(ctx.params["assignmentQty"], "Quantity assigned this time")
    : null;
  if (assignmentQty !== null && assignmentQty <= 0) schemaFail("The quantity assigned this time must be greater than 0");
  const draft = rowsOf(ctx.params["assignmentLines"], "Assignment lines");
  const taskId = requireText(ctx.bill.id, "Production task");
  const lines = new Map((ctx.bill.lines["processLines"] ?? []).map((line) => [requireText(line["id"], "Operation line"), line] as const));
  const totals = new Map<string, number>();
  const seenWorkers = new Map<string, Set<string>>();
  const assignmentWindows = new Map<string, { start: string; end: string }[]>();
  const commands: ExecutionCommand[] = [];
  for (const [index, row] of draft.entries()) {
    const at = `Row ${String(index + 1)}`;
    if (requireText(row["productionTaskId"], `${at}Production task`) !== taskId) schemaFail(`${at} does not belong to this production task`);
    const processLineId = requireText(row["processLineId"], `${at}Operation line`);
    const line = lines.get(processLineId);
    if (line === undefined) schemaFail(`The operation at ${at} does not belong to this production task`);
    const operationId = requireText(row["operationId"], `${at}Operation`);
    if (operationId !== requireText(line["operationId"], "Task operations")) schemaFail(`The operation at ${at} does not match the task operation`);
    const workshopOrgId = requireText(row["workshopOrgId"], `${at}Workshop`);
    const productionLineOrgId = requireText(row["productionLineOrgId"], `${at}Production line`);
    // On a named dispatch the worker is the authority for which team they belong to. The dialog may pick any active worker.
    // The line may still carry the operation's old teamId. Checking that old value would reject a legal worker as
    // not on the team. A default dispatch has no worker, so it must still use the team the user selected.
    const workerId = optionalText(row["workerId"], `${at}Worker`);
    let teamId: string;
    if (workerId === null) {
      teamId = requireText(row["teamId"], `${at}Team`);
    } else {
      const worker = await ctx.read.getBill("worker", workerId);
      if (worker.header["status"] !== "active") {
        schemaFail(`The worker at ${at} is no longer active. Choose again`);
      }
      teamId = requireText(worker.header["productionOrgId"], `${at} worker team`);
    }
    await validateAssignmentOrg(ctx, workshopOrgId, productionLineOrgId, teamId);
    const seen = seenWorkers.get(processLineId) ?? new Set<string>();
    const workerKey = workerId ?? "<team>";
    if (seen.has(workerKey)) schemaFail(`${at} assigns the same worker or team twice`);
    seen.add(workerKey);
    seenWorkers.set(processLineId, seen);
    const assignedQty = requireNumber(row["assignedQty"], `${at}Assigned quantity`);
    if (assignedQty <= 0) schemaFail(`The assigned quantity at ${at} must be greater than 0`);
    totals.set(processLineId, roundToScale((totals.get(processLineId) ?? 0) + assignedQty, "number", `${at}Assigned quantity`));
    const plannedStartDate = dateTime(row["plannedStartDate"], `${at}Start time`);
    const plannedEndDate = dateTime(row["plannedEndDate"], `${at}End time`);
    if (new Date(plannedEndDate).valueOf() < new Date(plannedStartDate).valueOf()) schemaFail(`End time at ${at} cannot be earlier than start time`);
    const windows = assignmentWindows.get(processLineId) ?? [];
    windows.push({ start: plannedStartDate, end: plannedEndDate });
    assignmentWindows.set(processLineId, windows);
    const requiresReportApproval = bool(row["requiresReportApproval"], `${at}Report approval`);
    const commandId = `process-assignment-${String(index + 1).padStart(3, "0")}`;
    commands.push({
      type: "createBill",
      commandId,
      module: "processAssignment",
      header: {
        productionTaskId: taskId,
        processLineId,
        operationId,
        workshopOrgId,
        productionLineOrgId,
        teamId,
        ...(workerId === null ? { teamAssignmentOrgId: teamId } : {}),
        ...(workerId === null ? {} : { workerId }),
        assignedQty,
        unit: requireText(ctx.bill.header["unit"], "Production task unit"),
        requiresReportApproval,
        pieceRate: requireNumber(row["pieceRate"], `${at}Piece rate`),
        assignedAt: dateTime(row["assignedAt"], `${at}Assigned at`),
        plannedStartDate,
        plannedEndDate,
        ...(optionalText(row["equipmentId"], `${at}Equipment`) === null ? {} : { equipmentId: requireText(row["equipmentId"], `${at}Equipment`) }),
        ...(optionalText(row["moldId"], `${at}Mold`) === null ? {} : { moldId: requireText(row["moldId"], `${at}Mold`) }),
      },
      lines: { sourceLines: [{ processLineId, assignedQty }] },
    });
    if (!requiresReportApproval) {
      commands.push({
        type: "setStatus",
        commandId: `approve-${commandId}`,
        target: { kind: "createdId", commandId },
        transition: "syncApprove",
        expectedStatus: "pendingReview",
      });
    }
  }
  const routing = await ctx.read.getBill("routing", requireText(ctx.bill.header["routingId"], "Routing"));
  if (routing.header["processType"] === "Sequential production") {
    const ordered = [...lines.entries()].sort((left, right) =>
      requireNumber(left[1]["sequence"], "Operation sequence") - requireNumber(right[1]["sequence"], "Operation sequence")
    );
    const bySequence = new Map<number, typeof ordered>();
    for (const entry of ordered) {
      const sequence = requireNumber(entry[1]["sequence"], "Operation sequence");
      const sequenceLines = bySequence.get(sequence) ?? [];
      sequenceLines.push(entry);
      bySequence.set(sequence, sequenceLines);
    }
    let previousSequenceLatestEnd = "";
    for (const sequenceLines of bySequence.values()) {
      let currentSequenceLatestEnd = "";
      for (const [processLineId, line] of sequenceLines) {
        const windows = assignmentWindows.get(processLineId) ?? [{
          start: dateTime(line["plannedStartDate"], "Operation planned start"),
          end: dateTime(line["plannedEndDate"], "Operation planned end"),
        }];
        for (const window of windows) {
          if (assignmentWindows.has(processLineId) && previousSequenceLatestEnd !== "" && window.start < previousSequenceLatestEnd) {
            schemaFail(`Operation "${requireText(line["operationName"], "Operation name")}" cannot start before the previous operation ends`);
          }
          if (currentSequenceLatestEnd === "" || window.end > currentSequenceLatestEnd) currentSequenceLatestEnd = window.end;
        }
      }
      previousSequenceLatestEnd = currentSequenceLatestEnd;
    }
  }
  if (mode === "dispatchAll") {
    // Assigned quantity may exceed the quantity not yet assigned. The unassigned quantity is only for the list and the default.
    // It is not a hard limit on submit.
  } else {
    for (const [processLineId, total] of totals) {
      const line = lines.get(processLineId);
      const ratio = requireNumber(line?.["assignmentRatio"] ?? 1, "Operation assignment ratio");
      const expected = roundToScale((assignmentQty ?? 0) * ratio, "number", "Quantity assigned to this operation");
      if (total !== expected) {
        schemaFail(`Assigned quantities must add up to this dispatch quantity times the operation ratio ${String(expected)}. The current total is ${String(total)}`);
      }
    }
  }
  return { version: 1, commands };
}

async function assignmentPlan(ctx: PlannerContext): Promise<ExecutionPlan> {
  if (Array.isArray(ctx.params["assignmentLines"])) return await assignmentLinesPlan(ctx);
  const processLineId = requireText(ctx.params["processLineId"], "Operation line");
  const line = (ctx.bill.lines["processLines"] ?? []).find((row) => requireText(row["id"], "Operation line") === processLineId);
  if (line === undefined) schemaFail("The selected operation does not belong to this production task. Open dispatch again");
  const assignmentMode = typeof ctx.params["assignmentMode"] === "string"
    ? ctx.params["assignmentMode"].trim()
    : "";
  const rawDraft = ctx.params["assignmentDraftLines"];
  const draft = rawDraft === undefined || rawDraft === null
    ? (/team/i.test(assignmentMode)
      ? [{ assignedQty: requireNumber(line["unassignedQty"], "Quantity still available to assign on this operation") }]
      : rowsOf(rawDraft, "Assigned worker"))
    : rowsOf(rawDraft, "Assigned worker");
  const assignedAt = requireText(ctx.params["assignmentOccurredAt"], "Assigned at");
  const teamId = requireText(line["teamId"], "Operation team");
  const defaultPieceRate = optionalNumber(ctx.params["assignmentPieceRate"], "Piece rate");
  const operationId = requireText(line["operationId"], "Operation");
  const sequence = requireNumber(line["sequence"], "Operation sequence");
  const routingId = requireText(ctx.bill.header["routingId"], "Routing");
  const routing = await ctx.read.getBill("routing", routingId);
  const routeRow = (routing.lines["lines"] ?? []).find((candidate) =>
    requireText(candidate["operationId"], "Routing operation") === operationId
    && requireNumber(candidate["sequence"], "Routing sequence") === sequence
  ) ?? (routing.lines["lines"] ?? []).find((candidate) =>
    requireText(candidate["operationId"], "Routing operation") === operationId
  );
  // Whether a report needs approval is read from the routing line (it can be overridden per product). Only when there is no routing line does it fall back to the operation master.
  const requiresReportApproval = routeRow !== undefined
    ? routeRow["requiresApproval"] !== false
    : (await ctx.read.getBill("operation", operationId)).header["requiresApproval"] !== false;
  const seen = new Set<string>();
  let total = 0;
  const commands: ExecutionCommand[] = [];
  for (const [index, row] of draft.entries()) {
    const workerId = optionalText(row["workerId"], `Row ${String(index + 1)} assigned worker`);
    if (workerId !== null) {
      if (seen.has(workerId)) schemaFail("The same person cannot be selected twice on one dispatch");
      seen.add(workerId);
    }
    const qty = requireNumber(row["assignedQty"], `Row ${String(index + 1)} assigned quantity`);
    total = roundToScale(total + qty, "number", "Total assigned this time");
    if (workerId !== null) {
      const worker = await ctx.read.getBill("worker", workerId);
      if (worker.header["status"] !== "active") {
        schemaFail(`The worker on row ${String(index + 1)} is no longer active. Choose again`);
      }
    }
    const pieceRate = optionalNumber(row["pieceRate"], `Row ${String(index + 1)} piece rate`)
      ?? defaultPieceRate
      ?? 0;
    const commandId = `process-assignment-${String(index + 1).padStart(3, "0")}`;
    commands.push({
      type: "createBill",
      commandId,
      module: "processAssignment",
      header: {
        productionTaskId: ctx.bill.id,
        processLineId,
        operationId,
        teamId,
        ...(workerId === null ? { teamAssignmentOrgId: teamId } : {}),
        ...(optionalText(line["workshopOrgId"], "Workshop") === null ? {} : { workshopOrgId: requireText(line["workshopOrgId"], "Workshop") }),
        ...(optionalText(line["productionLineOrgId"], "Production line") === null ? {} : { productionLineOrgId: requireText(line["productionLineOrgId"], "Production line") }),
        ...(workerId === null ? {} : { workerId }),
        assignedQty: qty,
        unit: requireText(ctx.bill.header["unit"], "Production task unit"),
        pieceRate,
        requiresReportApproval,
        assignedAt,
        plannedStartDate: dateTime(line["plannedStartDate"], "Start time"),
        plannedEndDate: dateTime(line["plannedEndDate"], "End time"),
        ...(optionalText(line["equipmentId"], "Equipment") === null ? {} : { equipmentId: requireText(line["equipmentId"], "Equipment") }),
        ...(optionalText(line["moldId"], "Mold") === null ? {} : { moldId: requireText(line["moldId"], "Mold") }),
      },
      lines: { sourceLines: [{ processLineId, assignedQty: qty }] },
    });
    if (!requiresReportApproval) {
      commands.push({
        type: "setStatus",
        commandId: `approve-${commandId}`,
        target: { kind: "createdId", commandId },
        transition: "syncApprove",
        expectedStatus: "pendingReview",
      });
    }
  }
  if (total <= 0) schemaFail("The quantity assigned this time must be greater than 0");
  return { version: 1, commands };
}

// ---------------------------------------------------------------------------
// Production task close cascade: complete / cancel / rejectRunning
//
// Same shape as sales settleSalesOrder and production order settleProductionOrder. setStatus does not
// run the target edge's planner, so this plan must send the force* commands itself.
// Complete force-completes open assignments and open subcontract orders. Cancel / reject force-cancels open assignments and related subcontract orders.
// ---------------------------------------------------------------------------

const OPEN_ASSIGNMENT_STATUSES = ["pendingReview", "awaitingProduction", "inProduction"] as const;

/** Status to push on a subcontract order when the production task closes. Complete leaves an already completed order alone. Cancel withdraws a completed order too. */
const SUBCONTRACT_COMPLETE_STATUSES = ["pendingReview", "awaitingOutsource", "processing"] as const;
const SUBCONTRACT_CANCEL_STATUSES = ["pendingReview", "awaitingOutsource", "processing", "completed"] as const;

async function listOpenAssignments(
  ctx: PlannerContext,
  productionTaskId: string,
): Promise<readonly Readonly<Record<string, unknown>>[]> {
  const rows: Readonly<Record<string, unknown>>[] = [];
  const limit = 100;
  for (let offset = 0; ; offset += limit) {
    const page = await ctx.read.listBills("processAssignment", {
      where: {
        kind: "group",
        join: "and",
        children: [
          { kind: "cond", field: "productionTaskId", op: "eq", value: productionTaskId },
          { kind: "cond", field: "status", op: "in", value: [...OPEN_ASSIGNMENT_STATUSES] },
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
  productionTaskId: string,
  completing: boolean,
): Promise<readonly ExecutionCommand[]> {
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
          { kind: "cond", field: "lines.productionTaskId", op: "eq", value: productionTaskId },
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
    const linked = (bill.lines["lines"] ?? []).some((line) => line["productionTaskId"] === productionTaskId);
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
 * Closing a production task only closes responsibility. It does not invent report facts. Unreported quantity is closed as zero output.
 */
async function settleProductionTask(ctx: PlannerContext): Promise<ExecutionPlan> {
  const completing = ctx.transition === "complete";
  const taskId = requireText(ctx.bill.id, "Production task id");
  const commands: ExecutionCommand[] = [];
  const verb = completing ? "complete" : "cancel";

  for (const row of await listOpenAssignments(ctx, taskId)) {
    const id = requireText(row["id"], "Assignment id");
    const status = requireText(row["status"], "Assignment status");
    commands.push({
      type: "setStatus",
      commandId: `${verb}-process-assignment-${id}`,
      target: { kind: "existing", module: "processAssignment", id },
      transition: completing ? "forceComplete" : "forceCancel",
      expectedStatus: status,
    });
  }

  commands.push(...await subcontractSettlementCommands(ctx, taskId, completing));

  return { version: 1, commands };
}

function optionalNumber(value: unknown, label: string): number | null {
  if (value === undefined || value === null || value === "") return null;
  return requireNumber(value, label);
}

async function prepareAssignment(context: ActionPreparerContext) {
  const lines = context.bill.lines["processLines"] ?? [];
  const requestedId = context.params?.["processLineId"];
  let selected: Readonly<Record<string, unknown>> | undefined;
  if (typeof requestedId === "string" && requestedId !== "") {
    selected = lines.find((row) => requireText(row["id"], "Operation line") === requestedId);
    if (selected === undefined) schemaFail("The selected operation does not belong to this production task. Open dispatch again");
  } else {
    const open = lines.filter((row) => requireNumber(row["unassignedQty"] ?? 0, "Quantity still available to assign") > 0);
    selected = open.length === 1 ? open[0] : undefined;
  }
  if (selected === undefined) {
    return { assignmentOccurredAt: context.now.toISOString() };
  }
  const pieceRate = requireNumber(selected["pieceRate"], "Frozen piece rate on the task operation");
  return {
    assignmentOccurredAt: context.now.toISOString(),
    assignmentPieceRate: pieceRate,
    processLineId: requireText(selected["id"], "Operation line"),
  };
}

export const actionPreparers = defineActionPreparers({
  launchAll: prepareProductionLaunch,
  assign: prepareAssignment,
});

export const planners = definePlanners(
  {
    assign: assignmentPlan,
    batchAssign: assignmentPlan,
    complete: settleProductionTask,
    cancel: settleProductionTask,
    rejectRunning: settleProductionTask,
    launchAll: productionLaunchPlan,
  },
  {
    assign: ["processAssignment"],
    batchAssign: ["processAssignment"],
  },
);

export const batchActions = defineBatchActions({
  dispatchProduction: {
    label: "Dispatch batch",
    sourceStatuses: ["awaitingLaunch", "inProduction"],
    sourceTable: "processLines",
    sourceRemaining: "unassignedQty",
    transition: "batchAssign",
    internalTransitions: [],
    lineField: assignmentLineField,
    seed: {
      productionTaskId: { from: "bill" },
      processLineId: { from: "line", field: "id" },
      operationId: { from: "line", field: "operationId" },
      workshopOrgId: { from: "line", field: "workshopOrgId" },
      productionLineOrgId: { from: "line", field: "productionLineOrgId" },
      teamId: { from: "line", field: "teamId" },
      assignedQty: { from: "line", field: "unassignedQty" },
      requiresReportApproval: { from: "line", field: "requiresReportApproval" },
      pieceRate: { from: "line", field: "pieceRate" },
      equipmentId: { from: "line", field: "equipmentId" },
      moldId: { from: "line", field: "moldId" },
      plannedStartDate: { from: "line", field: "plannedStartDate" },
      plannedEndDate: { from: "line", field: "plannedEndDate" },
      assignedAt: { from: "clock" },
    },
    modes: [{ value: "dispatchAll", label: "Confirm dispatch", primary: true }],
    modeParam: "assignmentMode",
    linesParam: "assignmentLines",
  },
});

export default defineModule({
  label: "Production task",
  // Custom fields are open to the tenant, so this table has a `custom jsonb` column and a GIN index.
  // The chain product → sales order → production order → production task → assignment / shipment
  // is where industry-specific fields are most often passed through, so it is opened first. Open another table by adding this line and shipping a release.
  customFields: true,
  numbering: { prefix: "TASK", seqScope: "day" },

  fields: [
    { key: "code", label: "Production task no.", type: "string", primary: true, auto: true },
    { key: "productionOrderId", label: "Production order no.", type: "ref", ref: "productionOrder", required: true },
    // The candidate rules match the production order side: the two makeable product types, the factory level, this product's
    // active BOM and routing, and this product's custom information. Values the planner writes at release already satisfy
    // the `release_*` gates, so these are always true on the release path. They block a document created by hand.
    { key: "productId", label: "Product", type: "ref", ref: "product", required: true, refFilter: { canProduce: true } },
    // The release path is copied explicitly by the planner (non-empty means the default does not apply). `refDefault` fills the
    // hand-created document named in the comment above. After a production order was selected, a person still had to copy the factory and production mode off the order,
    // even though those values can only be the ones on the order.
    // The completion warehouse is not one of these two cells (the reason is written on that cell). It is a cell that may have no single answer when orders are merged,
    // and refDefault would silently fill "no answer" with the primary source order's warehouse.
    // Both sides use the same `orgType: "factory"`, so a value brought across is inside this cell's candidates.
    {
      key: "productionOrgId",
      label: "Factory",
      type: "ref",
      ref: "orgUnit",
      required: true,
      refFilter: { orgType: "factory" },
      refDefault: { from: "productionOrder", match: "productionOrderId", through: null, field: "productionOrgId" },
    },
    {
      key: "customerId",
      label: "Customer",
      type: "ref",
      ref: "customer",
      hidden: true,
      refDefault: { from: "productionOrder", match: "productionOrderId", through: null, field: "customerId" },
    },
    {
      key: "customerName",
      label: "Customer name",
      type: "string",
      derive: { kind: "lookup", from: "customer", match: "customerId", field: "name" },
    },
    // Besides the code, the list columns are references and quantities.
    // The reference label therefore collapses to "production task 20260730-0001, released on its own". On a cost sheet, a report, or an assignment,
    // picking a production task shows a row of numbers plus the release method, and not what this task is making.
    // Freeze it instead of looking it up. Renaming the product master must not rewrite a task already launched (same discipline as `spec` / `unit`).
    {
      key: "productName",
      label: "Product name",
      type: "string",
      snapshot: { from: "product", match: "productId", through: null, field: "name" },
    },
    {
      key: "spec",
      label: "Product specification",
      type: "string",
      snapshot: { from: "product", match: "productId", through: null, field: "spec" },
    },
    {
      key: "productBarcode",
      label: "SKU code",
      type: "string",
      snapshot: { from: "product", match: "productId", through: null, field: "barcode" },
    },
    {
      key: "productRemark",
      label: "Specification note",
      type: "string",
      snapshot: { from: "product", match: "productId", through: null, field: "remark" },
    },
    { key: "plannedQty", label: "Planned production quantity", type: "number", required: true },
    {
      key: "unit",
      label: "Unit",
      type: "enum",
      required: true,
      refDefault: { from: "product", match: "productId", through: null, field: "mainUnit" },
      unitChoice: { match: "productId", factorInto: "unitFactor" },
    },
    { key: "unitFactor", label: "Unit factor", type: "number" },
    { key: "basePlannedQty", label: "Planned quantity in main unit", type: "number", calculate: { op: "mul", args: [{ field: "plannedQty" }, { field: "unitFactor" }] } },
    { key: "plannedStartDate", label: "Planned start", type: "datetime", required: true },
    { key: "plannedEndDate", label: "Planned end", type: "datetime", required: true },
    // Actual start and finish are a second timeline, not two states of the cells above.
    // The plan window is the promise from scheduling. The actual window is when the shop really started and really finished.
    // Collapsing them into one cell ("overwrite the plan with the actual time after start") makes "how many days was this batch late" unanswerable.
    //
    // Actual start does not follow "entered in production". Scheduling the operations has not started the work.
    // It is written, through setGeneratedHeader, only when a subcontract operation is approved or any assignment is started (the field must be hidden and systemGenerated). An existing value is not overwritten.
    // Approving an assignment only moves it to awaiting production. Work has not started, so this cell is not written.
    { key: "actualStartAt", label: "Actual start", type: "datetime", hidden: true, systemGenerated: true },
    // Actual end has two paths. The first one to write wins. The other sees an existing value and does not write again.
    // · Finish moves the task to completed (stampOnFirstEnter, and an existing value is not overwritten)
    // · Every operation's approved qualified quantity reaches that operation's plan (report approval, an assignment report that does not need approval, or subcontract receipt approval)
    //   Do not compare the header's summed reports with the plan. One operation reporting its full quantity would stamp the end too early.
    { key: "actualEndAt", label: "Actual end", type: "datetime", hidden: true, systemGenerated: true, stampOnFirstEnter: { status: "completed" } },
    // Both cells default to the product's currently active version, and can still be switched (the same sentence as the two cells on the production order line).
    // The release path is copied explicitly by the planner from the order line (non-empty means preselect does not apply). `refPreselect` covers
    // a task created by hand. Both cells are required, and a person used to open the BOM list and look for which version was active.
    //
    // Required plus a default selection do not conflict. When the value gate sees "the candidate set has a referent (a product is selected)", it lets this cell pass first,
    // then the server fills it and runs the same value gate again. If it cannot pick exactly one, it still reports that the BOM is required.
    // Required is no softer. The conclusion just waits for one more IO.
    {
      key: "bomId",
      label: "BOM",
      type: "ref",
      ref: "bom",
      required: true,
      refFilter: { productId: { from: "$bill.productId" }, status: "active" },
      refPreselectSole: true,
    },
    {
      key: "materialRequirementId",
      label: "Frozen material requirement",
      type: "ref",
      ref: "materialRequirement",
    },
    {
      key: "routingId",
      label: "Routing",
      type: "ref",
      ref: "routing",
      required: true,
      refFilter: { productId: { from: "$bill.productId" }, status: "active" },
      refPreselectSole: true,
    },
    {
      key: "issueWarehouseId",
      label: "Issue warehouse",
      type: "ref",
      ref: "warehouse",
      refDefault: { from: "productionOrder", match: "productionOrderId", through: null, field: "issueWarehouseId" },
      help: "Filled from the source order at release. Material is issued from this warehouse",
    },
    // Optional. Release copies this line onto the task, and an empty cell stays empty. The actual warehouse is chosen when the completion receipt is opened.
    // Picking a default warehouse quietly decides for the user, and that decision controls which warehouse the completion receipt posts to.
    //
    // Do not add `refDefault`. It fills a cell because the cell is empty, and it would silently turn an empty warehouse into some warehouse.
    // A hand-created task therefore asks the person to pick a warehouse once. That cost is known.
    //
    // The chain is `productionReceipt.receipt_warehouse_matches_task`. That gate is
    // `ref_field_compare`. When the target field is null, `compare(null,"eq",x)` is false, so it rejects, and
    // a task with an empty completion warehouse could never open a completion receipt. That side was changed to "this document versus this document, with `when` requiring non-empty".
    {
      key: "completionWarehouseId",
      label: "Completion warehouse",
      type: "ref",
      ref: "warehouse",
      help: "Filled from the source order at release. If it is empty, pick the actual warehouse when opening the completion receipt",
    },
    {
      key: "sourceType",
      label: "Release method",
      type: "enum",
      options: ["Release combined", "Release separately"],
      hidden: true,
      plannerSupplied: true,
    },
    {
      key: "completionMode",
      label: "Completion mode",
      type: "enum",
      options: [
        { value: "manual", label: "Confirm completion manually" },
        { value: "automatic", label: "Complete automatically" },
      ],
      plannerSupplied: true,
    },
    // An order and its tasks are many-to-many with an allocated quantity, not many-to-one.
    // One line is one task. This detail records how much of which order line this task allocated.
    // That is the denominator of "has this order been fully released".
    // A batched release makes one order correspond to several tasks. Header `productionOrderId` stays,
    // because a dozen consistency gates on assignment, report, and completion receipt pair on it.
    {
      key: "allocations",
      label: "Source order application",
      type: "subtable",
      ref: "productionTaskAllocation",
      fields: [
        {
          key: "sourceOrderLineId",
          label: "Source order line",
          type: "refLine",
          ref: "productionOrder",
          through: "lines",
          required: true,
        },
        // Companion stored column. Storage writes it from the refLine ownership. The client, push, planner, and seeds must not fill it.
        // It stays so a lookup by order id can answer which tasks allocated that order,
        // and because the declaration requires exactly one `refLine + ref` pair per target module.
        // The `match` of `productionOrder.dispatch_allocated_in_full` is not this column.
        // That gate asks whether each order line's allocated quantity is enough, and it matches `sourceOrderLineId`.
        // Matching `sourceOrderId` is a whole-document total. Product A scheduled 200 and product B scheduled nothing would still look like enough.
        { key: "sourceOrderId", label: "Source production order", type: "ref", ref: "productionOrder", required: true },
        { key: "productId", label: "Product", type: "ref", ref: "product", snapshot: { from: "productionOrder", match: "sourceOrderLineId", through: "lines", field: "productId" } },
        { key: "allocatedQty", label: "Applied quantity", type: "number", required: true },
        { key: "unit", label: "Unit", type: "enum", required: true, refDefault: { from: "productionOrder", match: "sourceOrderLineId", through: "lines", field: "unit" }, unitChoice: { match: "productId", factorInto: "unitFactor" } },
        { key: "unitFactor", label: "Unit factor", type: "number" },
        { key: "allocatedBaseQty", label: "Applied quantity in main unit", type: "number", calculate: { op: "mul", args: [{ field: "allocatedQty" }, { field: "unitFactor" }] } },
      ],
    },
    // The whole BOM explosion frozen at release. Task material issue uses it as the candidate source of the refLine.
    //（`materialIssue.lines.taskLineId`）。
    {
      key: "materialLines",
      label: "Frozen component",
      type: "subtable",
      ref: "productionTaskMaterialLine",
      fields: [
        { key: "componentProductId", label: "Component", type: "ref", ref: "product", required: true },
        { key: "unitQty", label: "BOM quantity per", type: "number", required: true },
        { key: "lossRate", label: "Scrap rate", type: "percent", required: true },
        // `productionBaseQty` (the finished-goods quantity frozen at release, the auditable multiplier of the BOM explosion) is not here.
        // Nothing on the task consumes it. Issue is capped by `requiredQty`.
        // Its audit copy is the other landing of the same explosion, `materialRequirement.lines`.
        { key: "requiredQty", label: "Planned usage", type: "number", required: true },
        { key: "spec", label: "Specification", type: "string" },
        { key: "unit", label: "Unit", type: "enum", required: true, refDefault: { from: "product", match: "componentProductId", through: null, field: "mainUnit" }, unitChoice: { match: "componentProductId", factorInto: "unitFactor" } },
        { key: "unitFactor", label: "Unit factor", type: "number" },
        { key: "baseUnitQty", label: "BOM usage in main unit", type: "number", calculate: { op: "mul", args: [{ field: "unitQty" }, { field: "unitFactor" }] } },
        { key: "baseRequiredQty", label: "Planned usage in main unit", type: "number", calculate: { op: "mul", args: [{ field: "requiredQty" }, { field: "unitFactor" }] } },
        { key: "defaultIssueWarehouseId", label: "Default issue warehouse", type: "ref", ref: "warehouse", required: true },
        { key: "sourceLineNo", label: "BOM line no.", type: "number", required: true },
        // Not shown on screen: erp-web fieldOverrides.hiddenLineFields, and the line-picker dialog hides it the same way.
        { key: "bomPath", label: "BOM path", type: "string", required: true },
        // This rollup has two consumers. See the second one before changing match / through.
        // 1. The minuend of `pendingIssueBaseQty`.
        // 2. Automatic recognition of "quantity already referenced" in `refLineOptions`. It finds this column by
        //    `from === target module && through === target detail table && match === that refLine column` (billRepo).
        //    If it cannot be inferred, the picker does not show quantity already issued, which is how the person opening the document decides whether the line still needs to be issued.
        //
        // The owner is `materialIssue.lines.taskLineId` (issue occupation), not `stockOut`.
        {
          key: "issuedBaseQty",
          label: "Quantity already issued (main unit)",
          type: "number",
          derive: { kind: "rollup", from: "materialIssue", through: "lines", match: "taskLineId", measure: "sum(baseQty)", where: { status: ["pendingReview", "issued"] } },
        },
        // Line eligibility: it is listed only when greater than 0. A fully issued line disappears from the candidates.
        // It is a current value, not a snapshot. It can only be eligibility, not the right-hand side of the cumulative gate
        // (that gate's right-hand side is `baseRequiredQty`, a number that does not move).
        {
          key: "pendingIssueBaseQty",
          label: "Quantity still to issue (main unit)",
          type: "number",
          derive: { kind: "formula", expr: { op: "sub", args: [{ field: "baseRequiredQty" }, { field: "issuedBaseQty" }] } },
        },
      ],
    },
    {
      key: "processLines",
      label: "Operation",
      type: "subtable",
      ref: "productionTaskProcessLine",
      fields: [
        { key: "operationId", label: "Operation", type: "ref", ref: "operation", required: true, refFilter: { status: "active" } },
        { key: "operationName", label: "Operation name", type: "string", snapshot: { from: "operation", match: "operationId", through: null, field: "name" } },
        { key: "sequence", label: "Sequence", type: "number", required: true },
        { key: "teamId", label: "Team", type: "ref", ref: "orgUnit", required: true, refFilter: { orgType: "team" } },
        { key: "productionLineOrgId", label: "Production line", type: "ref", ref: "orgUnit", hidden: true, refFilter: { orgType: "line" } },
        { key: "workshopOrgId", label: "Workshop", type: "ref", ref: "orgUnit", hidden: true, refFilter: { orgType: "workshop" }, snapshot: { from: "orgUnit", match: "productionLineOrgId", through: null, field: "parentOrgId", optional: true } },
        { key: "assignmentRatio", label: "Assignment ratio", type: "number", plannerSupplied: true, hidden: true },
        { key: "requiresReportApproval", label: "Report approval", type: "bool", plannerSupplied: true, hidden: true },
        { key: "pieceRate", label: "Piece rate", type: "money", plannerSupplied: true, hidden: true },
        { key: "outsourcingMode", label: "Operation subcontract", type: "enum", options: ["No subcontract", "Optional subcontract", "Full subcontract"], plannerSupplied: true },
        { key: "equipmentId", label: "Equipment", type: "ref", ref: "equipment", refFilter: { status: "active" } },
        { key: "moldId", label: "Mold", type: "ref", ref: "mold", refFilter: { status: "active" } },
        { key: "plannedQty", label: "Planned quantity", type: "number", required: true },
        { key: "plannedStartDate", label: "Start", type: "datetime", required: true },
        { key: "plannedEndDate", label: "End", type: "datetime", required: true },
        {
          key: "pendingAssignedQty",
          label: "Quantity pending review",
          type: "number",
          derive: { kind: "rollup", from: "processAssignment", through: "sourceLines", match: "processLineId", measure: "sum(assignedQty)", where: { status: "pendingReview" } },
        },
        {
          key: "confirmedAssignedQty",
          label: "Approved assigned quantity",
          type: "number",
          hidden: true,
          derive: { kind: "rollup", from: "processAssignment", through: "sourceLines", match: "processLineId", measure: "sum(assignedQty)", where: { status: ["awaitingProduction", "inProduction"] } },
        },
        {
          key: "openAssignedQty",
          label: "Assigned quantity still occupied",
          type: "number",
          hidden: true,
          derive: { kind: "rollup", from: "processAssignment", through: "sourceLines", match: "processLineId", measure: "sum(assignedQty)", where: { status: ["pendingReview", "awaitingProduction", "inProduction"] } },
        },
        {
          key: "completedAssignedQty",
          label: "Completed assigned quantity",
          type: "number",
          hidden: true,
          derive: { kind: "rollup", from: "processAssignment", through: "sourceLines", match: "processLineId", measure: "sum(assignedQty)", where: { status: "completed" } },
        },
        {
          key: "completedOccupiedQty",
          label: "Completed reservation",
          type: "number",
          hidden: true,
          // Completed occupies only approved qualified quantity. After an assignment is finished, the unreported remainder returns to this operation and can still be assigned up to the plan.
          // Identity is sourceLines.processLineId (refLine). The measure is the assignment header's approved qualified quantity.
          // The child table has maxRows: 1, so one assignment does not add the header quantity more than once.
          derive: { kind: "rollup", from: "processAssignment", through: "sourceLines", match: "processLineId", measure: "sum(approvedQualifiedQty)", where: { status: "completed" } },
        },
        {
          key: "dispatchedQty",
          label: "Quantity already assigned",
          type: "number",
          derive: {
            kind: "formula",
            expr: {
              op: "add",
              args: [
                { orElse: { of: { field: "confirmedAssignedQty" }, whenEmpty: 0 } },
                { orElse: { of: { field: "completedOccupiedQty" }, whenEmpty: 0 } },
              ],
            },
          },
        },
        {
          key: "approvedQualifiedQty",
          label: "Approved qualified quantity",
          type: "number",
          derive: { kind: "rollup", from: "processReport", through: "sourceLines", match: "processLineId", measure: "sum(qualifiedQty)", where: { status: "completed" } },
        },
        {
          key: "approvedDefectQty",
          label: "Approved defect quantity",
          type: "number",
          derive: { kind: "rollup", from: "processReport", through: "sourceLines", match: "processLineId", measure: "sum(defectQty)", where: { status: "completed" } },
        },
        {
          key: "unassignedQty",
          label: "Quantity not yet assigned",
          type: "number",
          // When assigned quantity exceeds the plan, stop at 0. Do not show a negative number as quantity that can still be assigned backwards.
          derive: {
            kind: "formula",
            expr: {
              op: "max",
              args: [
                { value: 0 },
                { op: "sub", args: [
                  { field: "plannedQty" },
                  { op: "add", args: [
                    { orElse: { of: { field: "openAssignedQty" }, whenEmpty: 0 } },
                    { orElse: { of: { field: "completedOccupiedQty" }, whenEmpty: 0 } },
                  ] },
                ] },
              ],
            },
          },
        },
      ],
    },
    { key: "processLineCount", label: "Operation count", type: "number", lineAgg: { of: "processLines", measure: "count()" } },
    { key: "processPlannedQty", label: "Total planned quantity of operations", type: "number", hidden: true, lineAgg: { of: "processLines", measure: "sum(plannedQty)" } },
    {
      key: "openAssignedQty",
      label: "Assigned quantity still occupied",
      type: "number",
      hidden: true,
      derive: { kind: "rollup", from: "processAssignment", match: "productionTaskId", measure: "sum(assignedQty)", where: { status: ["pendingReview", "awaitingProduction", "inProduction"] } },
    },
    {
      key: "completedQualifiedQty",
      label: "Qualified quantity on completed assignments",
      type: "number",
      hidden: true,
      derive: { kind: "rollup", from: "processAssignment", match: "productionTaskId", measure: "sum(approvedQualifiedQty)", where: { status: "completed" } },
    },
    {
      key: "approvedQualifiedQty",
      label: "Qualified finished quantity reported",
      type: "number",
      derive: { kind: "rollup", from: "processReport", match: "productionTaskId", measure: "sum(qualifiedQty)", where: { status: "completed" } },
    },
    {
      key: "approvedDefectQty",
      label: "Defect finished quantity reported",
      type: "number",
      derive: { kind: "rollup", from: "processReport", match: "productionTaskId", measure: "sum(defectQty)", where: { status: "completed" } },
    },
    {
      key: "assignableQty",
      label: "Assignable quantity",
      type: "number",
      // Same floor as unassigned quantity on the operation line. When occupation exceeds the plan total, show 0.
      derive: {
        kind: "formula",
        expr: {
          op: "max",
          args: [
            { value: 0 },
            { op: "sub", args: [
              { orElse: { of: { field: "processPlannedQty" }, whenEmpty: 0 } },
              { op: "add", args: [
                { orElse: { of: { field: "openAssignedQty" }, whenEmpty: 0 } },
                { orElse: { of: { field: "completedQualifiedQty" }, whenEmpty: 0 } },
              ] },
            ] },
          ],
        },
      },
    },

    // Launch, completion, and receipt supply.
    // Issue eligibility: does this task still have material to issue.
    //
    // The three cells together serve one thing: `materialIssue.views.createFrom.sourceRemaining.header`.
    // Without it, "which tasks can be selected" has only status. A task that is fully issued, and a historical task whose frozen material lines are empty,
    // still appear in the picker and the list batch entry. The user clicks and only then hears that no line has a positive remainder.
    // That is not an error design. It drags a judgment the list could have disabled up front until after the click.
    //
    // The line-level copy (`materialLines.pendingIssueBaseQty`) is the same rule at two levels.
    // The line decides which lines expand. The header decides whether this task appears as a candidate. Both must exist.
    // Line-only cannot disable the list. Header-only expands fully issued lines onto the issue document too.
    { key: "planIssueBaseQty", label: "Planned issue quantity (main unit)", type: "number", lineAgg: { of: "materialLines", measure: "sum(baseRequiredQty)" } },
    // `issuedBaseQty` is the occupation that stops a second document from being opened, and pendingReview counts. The list's issue status must recognize only
    // an issue that has been confirmed out of the warehouse. Otherwise a pendingReview document that fills the plan would be shown as fully issued.
    { key: "confirmedIssuedBaseQty", label: "Confirmed issue quantity (main unit)", type: "number", hidden: true, derive: { kind: "rollup", from: "materialIssue", through: "lines", match: "productionTaskId", measure: "sum(baseQty)", where: { status: "issued" } } },
    { key: "issuedBaseQty", label: "Quantity already issued (main unit)", type: "number", derive: { kind: "rollup", from: "materialIssue", through: "lines", match: "productionTaskId", measure: "sum(baseQty)", where: { status: ["pendingReview", "issued"] } } },
    { key: "pendingIssueBaseQty", label: "Quantity still to issue (main unit)", type: "number", derive: { kind: "formula", expr: { op: "sub", args: [{ field: "planIssueBaseQty" }, { field: "issuedBaseQty" }] } } },

    {
      key: "finishedProcessCount",
      label: "Completed operation count",
      type: "number",
      hidden: true,
      derive: { kind: "rollup", from: "processAssignment", match: "productionTaskId", measure: "count()", where: { status: "completed" } },
    },
    {
      key: "inboundReceivedQty",
      label: "Finished quantity already received",
      type: "number",
      derive: {
        kind: "rollup",
        from: "productionReceipt",
        match: "productionTaskId",
        measure: "sum(inboundQty)",
        where: { status: "completed" },
      },
    },
    { key: "remark", label: "Remarks", type: "text" },
  ],

  lifecycle: {
    statuses: [
      // A task created by schedule production starts at pendingReview (requirement wiki 244431994, section 4.5, production task:
      // there is no draft; creating the document means pending review, and pending review can be edited. pendingReview: view, edit,
      // approve, cancel).
      //
      // This status is not ceremonial. A task decides who, on which line, when, and how much.
      // After scheduling, the shop supervisor has to accept it. Scheduling used to go straight to dispatch, so the planner alone
      // decided, and a wrong schedule cost a line a wasted day.
      { key: "pendingReview", label: "pendingReview", color: "amber", initial: true, editable: "whitelist", editableFields: ["plannedStartDate", "plannedEndDate", "processLines", "remark"] },
      // After approval the task waits for dispatch to start. The key stays compatible. The display is awaitingProduction.
      { key: "awaitingLaunch", label: "awaitingProduction", color: "gray", editable: "whitelist", editableFields: ["plannedStartDate", "plannedEndDate", "remark"] },
      { key: "inProduction", label: "inProduction", color: "blue", editable: "whitelist", editableFields: ["plannedStartDate", "plannedEndDate", "remark"] },
      { key: "completed", label: "completed", color: "green", terminal: true, editable: "none" },
      { key: "cancelled", label: "cancelled", color: "red", terminal: true, editable: "none" },
    ],
    // Complete means the user closes responsibility. The planner force-closes open downstream assignments. It does not invent report or receipt facts.
    // Automatic close when reported quantity reaches the plan still uses reportDone (internal). Receipt is another document in the receive domain and does not change the task status.
    transitions: [
      // A subcontract order is no longer pushed from here (it used to be `create_subcontract_order`).
      // Subcontract is a purchasing shape: first a processing order placed with a supplier, then issue and receipt. A push forced
      // "one task = one order" and split "send this whole batch to one supplier" into N documents,
      // each negotiating its own supplier, warehouse, and delivery date.
      //
      // The remaining edge carries the status move at the moment a subcontract order is approved (`subcontractOrder.approve`
      // planner uses setStatus along it). It creates no document itself. Clicking it by hand is blocked by
      // `subcontract_order_approved` below. That gate requires an approved subcontract order to exist.
      // Whole-order, other, and operation subcontract: a task still pending review or awaiting production moves to in production after approval. An in-house task can also be moved by starting an assignment.
      // Both buttons are labeled Approve. Only this one is primary, so two primary buttons with the same name are not shown side by side.
      { code: "approve", from: "pendingReview", to: "awaitingLaunch", action: "Approve", primary: true },
      { code: "approveScheduled", from: "pendingReview", to: "awaitingLaunch", action: "Approve" },
      { code: "cancel", from: "pendingReview", to: "cancelled", action: "Cancel", confirm: true },
      {
        code: "startSubcontractFromReview",
        from: "pendingReview",
        to: "inProduction",
        action: "Convert to subcontract",
        internal: true,
      },
      {
        code: "startSubcontract",
        from: "awaitingLaunch",
        to: "inProduction",
        action: "Convert to subcontract",
        internal: true,
      },
      // The screen has only the word Dispatch (product flow wiki 244431994, section 4.5:
      // production task, approve -- dispatch --> inProduction). Launch is the model's internal word.
      // Equipment, mold, and start and end were already chosen in Schedule production on the order.
      // This step only turns operations into assignment documents. Keeping both words means a person looking for Launch
      // on the screen will not find it. The button says Dispatch.
      { code: "launchAll", from: "awaitingLaunch", to: "inProduction", action: "Launch operations", internal: true, params: launchParams },
      { code: "startFromAssignment", from: "awaitingLaunch", to: "inProduction", action: "Start with assignment", internal: true },
      {
        code: "assign",
        from: "awaitingLaunch",
        to: "awaitingLaunch",
        action: "Dispatch",
        primary: true,
        params: [
          { key: "processLineId", label: "Operation line", type: "text" },
          { key: "assignmentPieceRate", label: "Piece rate", type: "number" },
          { key: "assignmentOccurredAt", label: "Assigned at", type: "text", hidden: true },
          { key: "assignmentDraftLines", label: "Assigned worker", type: "billLines", required: false, lineField: assignmentDraftLineField },
          { key: "assignmentMode", label: "Assignment method", type: "text" },
          { key: "assignmentLines", label: "Assignment lines", type: "billLines", required: false, lineField: optionalAssignmentLineField },
        ],
      },
      {
        code: "assign",
        from: "inProduction",
        to: "inProduction",
        action: "Dispatch",
        params: [
          { key: "processLineId", label: "Operation line", type: "text" },
          { key: "assignmentPieceRate", label: "Piece rate", type: "number" },
          { key: "assignmentOccurredAt", label: "Assigned at", type: "text", hidden: true },
          { key: "assignmentDraftLines", label: "Assigned worker", type: "billLines", required: false, lineField: assignmentDraftLineField },
          { key: "assignmentMode", label: "Assignment method", type: "text" },
          { key: "assignmentLines", label: "Assignment lines", type: "billLines", required: false, lineField: optionalAssignmentLineField },
        ],
      },
      {
        code: "batchAssign",
        from: "awaitingLaunch",
        to: "awaitingLaunch",
        action: "Dispatch batch",
        params: [
          { key: "assignmentMode", label: "Assignment method", type: "text", required: true },
          { key: "assignmentQty", label: "Quantity assigned this time", type: "number", required: false },
          { key: "assignmentLines", label: "Assignment lines", type: "billLines", required: true, lineField: assignmentLineField },
        ],
      },
      {
        code: "batchAssign",
        from: "inProduction",
        to: "inProduction",
        action: "Dispatch batch",
        params: [
          { key: "assignmentMode", label: "Assignment method", type: "text", required: true },
          { key: "assignmentQty", label: "Quantity assigned this time", type: "number", required: false },
          { key: "assignmentLines", label: "Assignment lines", type: "billLines", required: true, lineField: assignmentLineField },
        ],
      },
      { code: "complete", from: "inProduction", to: "completed", action: "Complete", confirm: true },
      { code: "rejectRunning", from: "inProduction", to: "awaitingLaunch", action: "Reject", confirm: true },
      { code: "forceComplete", from: "pendingReview", to: "completed", action: "Complete with production order", internal: true },
      { code: "forceComplete", from: "awaitingLaunch", to: "completed", action: "Complete with production order", internal: true },
      { code: "forceComplete", from: "inProduction", to: "completed", action: "Complete with production order", internal: true },
      { code: "reopenAfterReportCorrection", from: "completed", to: "inProduction", action: "Sync report reversal", internal: true },
      { code: "markSubcontractReady", from: "inProduction", to: "completed", action: "Sync subcontract receipt complete", internal: true },
      { code: "autoCompleteSubcontract", from: "inProduction", to: "completed", action: "Auto-complete subcontract task", internal: true },
      { code: "resumeAfterSubcontractClose", from: "inProduction", to: "awaitingLaunch", action: "Resume awaiting launch after subcontract close", internal: true },
      { code: "reopenCompletedAfterSubcontractReceiptReversal", from: "completed", to: "inProduction", action: "Sync subcontract receipt reversal", internal: true },
      { code: "reopenCompletedAfterSubcontractMaterialReversal", from: "completed", to: "inProduction", action: "Sync subcontract material rework", internal: true },
      { code: "cancel", from: "awaitingLaunch", to: "cancelled", action: "Cancel", confirm: true },
      { code: "cancel", from: "inProduction", to: "cancelled", action: "Cancel", confirm: true },
      { code: "forceCancel", from: "pendingReview", to: "cancelled", action: "Cancel with production order", internal: true },
      { code: "forceCancel", from: "awaitingLaunch", to: "cancelled", action: "Cancel with production order", internal: true },
      { code: "forceCancel", from: "inProduction", to: "cancelled", action: "Cancel with production order", internal: true },
    ],
  },

  preconditions: [
    {
      id: "scheduled_tasks_use_scheduled_approval",
      onTransition: "approve",
      source: "invariant",
      level: "route",
      exit: "approveScheduled",
      message: "This task already has operations from the routing. After approval it waits to start",
      why:
        "Confirming Schedule production on the order writes the operations onto the task lines;" +
        "After approval, this kind of task waits for an assignment to start. It does not enter production early. " +
        "A task with no operations (a subcontract that only creates the task) has zero operations and still takes this edge into awaiting launch. " +
        "The check is whether the operation subtable is non-empty, not the launched quantity.",
      check: {
        primitive: "field_compare",
        left: { ref: "$bill.processLineCount" },
        op: "eq",
        right: { value: 0 },
      },
    },
    {
      id: "subcontract_order_approved_from_review",
      onTransition: "startSubcontractFromReview",
      source: "gate",
      level: "block",
      message: "This production task has no approved subcontract order. Create one, add this task to the lines, and approve it",
      why: "A task pending review can go straight to a whole-order subcontract. Convert to subcontract still requires an approved subcontract order. It cannot be bypassed",
      check: {
        primitive: "related_agg",
        from: "subcontractOrder",
        through: "lines",
        match: "productionTaskId",
        on: "id",
        agg: "count",
        measure: null,
        where: { status: ["awaitingOutsource", "processing"] },
        op: "gte",
        right: { value: 1 },
        plus: null,
      },
    },
    {
      id: "subcontract_order_approved",
      onTransition: "startSubcontract",
      source: "gate",
      level: "block",
      message: "This production task has no approved subcontract order. Create one, add this task to the lines, and approve it",
      why: "Convert to subcontract only projects the status at the moment a subcontract order is approved. Moving the task into production without an approved order leaves a task that can neither be launched in-house nor be taken by a supplier",
      check: {
        primitive: "related_agg",
        from: "subcontractOrder",
        through: "lines",
        match: "productionTaskId",
        on: "id",
        agg: "count",
        measure: null,
        // The source edge runs first and the plan commands run after (runtime executeCommands), so by the time execution reaches here
        // that order is already on awaitingOutsource.
        where: { status: ["awaitingOutsource", "processing"] },
        op: "gte",
        right: { value: 1 },
        plus: null,
      },
    },
    // Cancel / reject: the planner sends forceCancel to close open assignments and open subcontract orders. A gate no longer blocks them.
    // An issue that has not been returned still blocks (cancel and reject share it).
    {
      id: "no_open_issue_on_cancel",
      onTransition: "cancel",
      source: "gate",
      level: "block",
      message: "This production task still has unfinished issues (pending review or already issued). Cancel the ones pending review, and return the ones already issued",
      why: "Cancelling a task after material has been issued, or is held by an issue pending review, adds the released quantity back, so the same plan quantity can be scheduled and issued again",
      check: {
        primitive: "related_agg",
        from: "materialIssue",
        through: "lines",
        match: "productionTaskId",
        on: "id",
        agg: "count",
        measure: null,
        where: { status: ["pendingReview", "issued"] },
        op: "eq",
        right: { value: 0 },
        plus: null,
      },
    },
    {
      id: "no_open_issue_on_reject_running",
      onTransition: "rejectRunning",
      source: "gate",
      level: "block",
      message: "This production task still has unfinished issues (pending review or already issued). Cancel the ones pending review, and return the ones already issued",
      why: "Rejecting a task after material has been issued, or is held by an issue pending review, leaves that material half-committed",
      check: {
        primitive: "related_agg",
        from: "materialIssue",
        through: "lines",
        match: "productionTaskId",
        on: "id",
        agg: "count",
        measure: null,
        where: { status: ["pendingReview", "issued"] },
        op: "eq",
        right: { value: 0 },
        plus: null,
      },
    },
    {
      id: "manual_completed_subcontract_order_required",
      onTransition: "markSubcontractReady",
      source: "gate",
      level: "block",
      message: "A production task can be completed by sync only from a subcontract order that is already completed",
      why: "Task completion must follow a subcontract order that has fully received the task quantity and is completed. It cannot be bypassed by hand",
      check: {
        primitive: "related_agg",
        from: "subcontractOrder",
        through: "lines",
        match: "productionTaskId",
        on: "id",
        agg: "count",
        measure: null,
        where: { status: "completed" },
        op: "gte",
        right: { value: 1 },
        plus: null,
      },
    },
    {
      id: "manual_no_process_task_on_subcontract_complete",
      onTransition: "markSubcontractReady",
      source: "invariant",
      level: "block",
      why: "A whole-order finished-goods subcontract cannot also have in-house operations",
      message: "This production task already has in-house operations, so it cannot be completed as a whole-order subcontract",
      check: {
        primitive: "field_compare",
        left: { ref: "$bill.processLineCount" },
        op: "eq",
        right: { value: 0 },
      },
    },
    {
      id: "manual_subcontract_completion_mode",
      onTransition: "markSubcontractReady",
      source: "gate",
      level: "block",
      why: "A subcontract task frozen as manual confirmation closes on this edge. Both modes are completed once the quantity is fully received",
      check: { primitive: "field_compare", left: { ref: "$bill.completionMode" }, op: "eq", right: { value: "manual" } },
    },
    {
      id: "automatic_completed_subcontract_order_required",
      onTransition: "autoCompleteSubcontract",
      source: "gate",
      level: "block",
      why: "Auto-complete requires a subcontract order that has fully received this task and is already completed",
      check: {
        primitive: "related_agg",
        from: "subcontractOrder",
        through: "lines",
        match: "productionTaskId",
        on: "id",
        agg: "count",
        measure: null,
        where: { status: "completed" },
        op: "gte",
        right: { value: 1 },
        plus: null,
      },
    },
    {
      id: "automatic_no_process_task_on_subcontract_complete",
      onTransition: "autoCompleteSubcontract",
      source: "invariant",
      level: "block",
      why: "A whole-order finished-goods subcontract cannot also have in-house operations",
      message: "This production task already has in-house operations, so it cannot be completed as a whole-order subcontract",
      check: {
        primitive: "field_compare",
        left: { ref: "$bill.processLineCount" },
        op: "eq",
        right: { value: 0 },
      },
    },
    {
      id: "automatic_subcontract_completion_mode",
      onTransition: "autoCompleteSubcontract",
      source: "gate",
      level: "block",
      why: "Only a subcontract task frozen as automatic completion is closed by the system once it is fully received",
      check: { primitive: "field_compare", left: { ref: "$bill.completionMode" }, op: "eq", right: { value: "automatic" } },
    },
    {
      id: "subcontract_order_closed_before_resume",
      onTransition: "resumeAfterSubcontractClose",
      source: "gate",
      level: "block",
      message: "An open subcontract order still exists, so the production task cannot return to awaiting launch",
      why: "The task can choose in-house launch or subcontract again only when no processing fact exists and the subcontract order is already closed",
      check: {
        primitive: "related_agg",
        from: "subcontractOrder",
        through: "lines",
        match: "productionTaskId",
        on: "id",
        agg: "count",
        measure: null,
        // pendingReview is not in this set, on purpose, unlike `no_active_subcontract_order_on_cancel_running`.
        // This edge is driven by the subcontract order's unapprove / close, and the source edge runs first, so by the time execution reaches here
        // that order is already pendingReview or closed. Counting pending review would make unapprove hit the gate on
        // the order it just pushed back to pending review, roll the whole group back, and leave the task stuck in production.
        where: { status: ["awaitingOutsource", "processing", "completed"] },
        op: "eq",
        right: { value: 0 },
        plus: null,
      },
    },
    {
      id: "no_process_task_before_subcontract_resume",
      onTransition: "resumeAfterSubcontractClose",
      source: "invariant",
      level: "block",
      why: "Only a finished-goods subcontract task with no in-house operations can return to awaiting launch",
      message: "This production task already has in-house operations, so it cannot return to awaiting launch and be subcontracted again",
      check: {
        primitive: "field_compare",
        left: { ref: "$bill.processLineCount" },
        op: "eq",
        right: { value: 0 },
      },
    },
    {
      id: "completed_process_task_required",
      onTransition: "complete",
      source: "gate",
      level: "block",
      message: "This production task has no operations yet, so it cannot be completed",
      why: "Complete applies only to in-house tasks that already have operations",
      check: {
        primitive: "field_compare",
        left: { ref: "$bill.processLineCount" },
        op: "gte",
        right: { value: 1 },
      },
    },
    // Open assignments are closed by the complete planner's forceComplete. A gate no longer blocks them.
  ],

  views: {
    workbenches: [{ code: "dispatch", label: "Production assignment", statuses: ["inProduction"] }],
    list: {
      columns: [
        "code", "productName", "spec", "productBarcode", "productRemark",
        "plannedQty", "approvedQualifiedQty", "approvedDefectQty", "inboundReceivedQty",
        "unit", "issueWarehouseId", "completionWarehouseId", "productionOrgId",
        "plannedStartDate", "plannedEndDate", "actualStartAt", "actualEndAt",
        "customerName", "productionOrderId", "status",
      ],
      // The reference cell shows only the production task number. The product name has its own column. Joining it into the label would turn the number column into number plus product.
      referenceLabel: ["code"],
      filters: ["status", "productionOrgId", "productId", "plannedStartDate", "plannedEndDate", "actualStartAt", "actualEndAt"],
      searchable: ["code", "productName", "productBarcode", "customerName"],
      defaultSort: { field: "createdAt", desc: true },
    },
    form: [
      { title: "Task", fields: ["code", "productionOrderId", "productId", "productName", "spec", "productBarcode", "productRemark", "productionOrgId", "customerName", "plannedQty", "remark"] },
      { title: "Source order application", fields: ["allocations"] },
      { title: "Operation", fields: ["processLines", "assignableQty"] },
      { title: "Plan and actual", fields: ["plannedStartDate", "plannedEndDate", "actualStartAt", "actualEndAt"] },
      { title: "Process basis", fields: ["bomId", "routingId", "issueWarehouseId", "completionWarehouseId"] },
    ],
  },
});
