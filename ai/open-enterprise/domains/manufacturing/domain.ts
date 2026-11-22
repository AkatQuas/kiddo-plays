import { defineDomain } from "@open-erp/metamodel";

export default defineDomain({
  label: "Manufacturing master data",
  line: { code: "production", label: "Production" },
  /**
   * 3.5.0: equipment type and mold type are choice sets.
   *
   * Equipment used to store a free-text category, and the operation definition had neither cell.
   * "Which class of equipment this operation needs" lived only in the process engineer's head.
   * One shared dictionary lets the operation declare the class it needs and the equipment or
   * mold declare the class it is, so scheduling can match them.
   *
   * item.code is the stored identity. label is only the current display name, so a wording
   * change does not rewrite stored rows and does not rebuild indexes.
   * The preset items follow the classes already used on a garment floor, not a generic list.
   */
  choiceSets: [
    {
      code: "manufacturing.equipmentType",
      label: "Equipment type",
      items: [
        { code: "cutting", label: "Cutting equipment" },
        { code: "sewing", label: "Sewing equipment" },
        { code: "embroidery", label: "Embroidery equipment" },
        { code: "printing", label: "Printing equipment" },
        { code: "ironing", label: "Pressing equipment" },
        { code: "inspection", label: "Inspection equipment" },
        { code: "packaging", label: "Packing equipment" },
        { code: "other", label: "Other equipment" },
      ],
    },
    {
      code: "manufacturing.moldType",
      label: "Mold type",
      items: [
        { code: "cuttingTemplate", label: "Cutting template" },
        { code: "pressingTemplate", label: "Pressing template" },
        { code: "embroideryFrame", label: "Embroidery frame" },
        { code: "printingScreen", label: "Printing screen" },
        { code: "sewingJig", label: "Sewing jig" },
        { code: "other", label: "Other mold" },
      ],
    },
    {
      code: "manufacturing.orgType",
      label: "Organization type",
      items: [
        { code: "factory", label: "Factory", color: "geekblue" },
        { code: "workshop", label: "Workshop", color: "blue" },
        { code: "line", label: "Production line", color: "cyan" },
        { code: "team", label: "Team", color: "green" },
        { code: "function", label: "Function", color: "purple" },
      ],
    },
  ],
});
