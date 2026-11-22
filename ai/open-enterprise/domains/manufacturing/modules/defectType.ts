import { defineModule, singleState } from "@open-erp/metamodel";

/**
 * Defect catalog: the bad-reason dictionary selected on a work report.
 *
 * It is what makes a defect rate attributable by operation. Without it, a report can only say
 * "this operation had 12 defects", not "8 were out of size and 4 were surface scratches",
 * and only the second sentence can change the process.
 *
 * It is master data, not an enum. Defect items change with process and product (a new line
 * adds a few). Every enum add or remove is a release. A dictionary is a business fact the
 * user can maintain.
 *
 * A work report freezes the name and category onto the defect line (`processReport.defects`).
 * Renaming or reclassifying the dictionary does not rewrite historical reports, the same
 * discipline as freezing `spec` and `unit` on a line.
 */
export default defineModule({
  label: "Defect types",
  numbering: { prefix: "DEFECT", seqScope: "tenant" },

  fields: [
    { key: "code", label: "Defect code", type: "string", primary: true, auto: true },
    // The report dialog shows the name ("out of size", "surface scratch"). Two rows with the
    // same name make the reporter pick at random, and the categories may differ, so a rate
    // grouped by category still looks fine.
    { key: "name", label: "Defect name", type: "string", required: true, unique: true },
    {
      key: "category",
      label: "Defect category",
      type: "enum",
      options: ["Quality defect", "Equipment issue", "Material issue", "Process issue", "Other issue"],
      required: true,
      help: "Attribution: whether this defect sits on quality, equipment, or material decides who has to change it",
    },
    {
      key: "sortOrder",
      label: "Sort order",
      type: "number",
      required: true,
      help: "Order in the report dialog. Smaller comes first. Frequent defects at the top save a scroll",
    },
    { key: "remark", label: "Remarks", type: "text" },
  ],

  lifecycle: singleState("active", "Active", "green"),

  views: {
    list: {
      columns: ["sortOrder", "code", "name", "category", "remark"],
      // primary stays code (unique numbering inside the tenant). A reference cell shows the name, not the code or id.
      referenceLabel: ["name"],
      filters: ["category"],
      searchable: ["code", "name"],
      defaultSort: { field: "createdAt", desc: true },
    },
    form: [
      { title: "Defect", fields: ["code", "name", "category", "sortOrder"] },
      { title: "Other", fields: ["remark"] },
    ],
  },
});
