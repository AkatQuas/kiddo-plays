import { defineModule } from "@open-erp/metamodel";

/**
 * Daily report management: one operating snapshot per day.
 *
 * This module is a read-only fact the system generates. It is not a business document.
 *
 * Why a module and not a framework table
 *   A daily report needs tenant isolation, authorization, audit, and "rerun the same day overwrites",
 *   which only a module table has. The front end and the agent reuse bill_list / bill_get.
 *   A report does not need its own API.
 *
 * Numbers and text
 *   Every number (the five dimension scores, indicators, risk candidates, action-list candidates)
 *   is computed deterministically on the server. Collect freezes those facts onto the generating
 *   report immediately. The agent writes only the text slots from that snapshot (overview, suggestions,
 *   action titles). Finalize does not fetch again. What this module stores when it completes is the
 *   two combined: the page never calls the model again, and payload is the input that day's page renders.
 *
 * Display score and internal score are two cells
 *   The display score is clamp(internal real score, 60, 95). internalScore keeps the real value.
 *   Below 60 the page still shows 60, and the warning area must be marked red. That judgment needs the real score present.
 *
 * What a person can do, and what the system writes
 *   A person can only view (read) and start generation (create; the permission tree calls it Generate).
 *   There is no edit, import, export, or delete. Every status has editable none. Snapshot cells are
 *   systemGenerated, so the permission catalog does not grant update or field write.
 *   The daily-report pipeline writes through internal entry points: createInternalBill, saveInternalHeader,
 *   and executeInternalTransition on the complete / fail / regenerate edges.
 *
 * Rerun
 *   (tenant, reportDate) is unique. Rerunning the same day does not create a new row. It moves the
 *   existing record to generating and writes completed or failed back over it. That day of history
 *   is always one snapshot. Otherwise the front-end latest API and the push link would show two reports for the same day.
 */
export default defineModule({
  label: "Daily report",
  capabilities: { create: "system", export: false },
  numbering: { prefix: "RB", seqScope: "day" },

  fields: [
    { key: "code", label: "Daily report no.", type: "string", primary: true, auto: true },
    {
      key: "reportDate",
      label: "Report date",
      type: "date",
      required: true,
      unique: true,
      help: "Which operating day this report scores, usually yesterday. Uniqueness explicitly includes the tenant: one tenant has one report per day, and a rerun overwrites that record.",
    },
    {
      key: "score",
      label: "Display score",
      type: "number",
      systemGenerated: true,
      help: "The operating health shown outside = clamp(internalScore, 60, 95).",
    },
    {
      key: "internalScore",
      label: "Internal score",
      type: "number",
      systemGenerated: true,
      help: "The real total of the five dimensions (100 points maximum). Below 60 the warning area on the page is marked red.",
    },
    {
      key: "level",
      label: "Operating status",
      type: "enum",
      systemGenerated: true,
      options: ["Healthy operations", "Good operations", "Under control", "Needs attention"],
    },
    {
      key: "summary",
      label: "Operating summary",
      type: "text",
      systemGenerated: true,
      help: "Operating summary, about 120 to 180 words. The AI writes it strictly from the operating facts frozen at collect.",
    },
    {
      key: "payload",
      label: "Report snapshot",
      type: "text",
      systemGenerated: true,
      help: "While generating, this stores the immutable operating facts from collect. When complete, it is overwritten with the full input the page renders (DailyReportData). Finalize does not fetch again.",
    },
    {
      key: "htmlUrl",
      label: "Daily report URL",
      type: "string",
      systemGenerated: true,
      help: "Authenticated preview URL in this system. Sign in and open it to read the full daily report.",
    },
    {
      key: "generatedAt",
      label: "Generated at",
      type: "datetime",
      systemGenerated: true,
    },
    {
      key: "generationKey",
      label: "Generation idempotency key",
      type: "string",
      systemGenerated: true,
      help: "Reused when the same finalize is retried, so the report is not published or rerun twice.",
    },
    {
      key: "failureReason",
      label: "Failure reason",
      type: "text",
      systemGenerated: true,
      help: "When status is failed, this records the failed step and an error summary for rerun and alerts.",
    },
  ],

  lifecycle: {
    statuses: [
      { key: "generating", label: "Generating", color: "blue", initial: true, editable: "none" },
      { key: "completed", label: "Generated", color: "green", terminal: true, editable: "none" },
      { key: "failed", label: "Generation failed", color: "red", editable: "none" },
    ],
    // System edges for the generation pipeline. This system's daily-report pipeline runs them.
    // The screen and ordinary roles are not granted these transitions (see authorization.ts).
    // Both failed and completed can be rerun. A rerun of the same day returns to generating and is written back over.
    transitions: [
      { code: "complete", from: "generating", to: "completed", action: "Mark generated", internal: true },
      { code: "fail", from: "generating", to: "failed", action: "Mark failed", internal: true },
      { code: "regenerate", from: "failed", to: "generating", action: "Regenerate", internal: true },
      { code: "regenerateCompleted", from: "completed", to: "generating", action: "Rerun and overwrite", internal: true },
    ],
  },

  views: {
    list: {
      columns: ["code", "reportDate", "score", "level", "status", "generatedAt"],
      filters: ["status", "level", "reportDate"],
      searchable: ["code"],
      defaultSort: { field: "createdAt", desc: true },
      page: "snapshot-history",
    },
    form: [
      { title: "Operating conclusion", fields: ["reportDate", "score", "level", "summary"] },
      { title: "Full daily report", fields: ["htmlUrl"] },
      { title: "Generation", fields: ["generatedAt", "failureReason"] },
    ],
  },
});
