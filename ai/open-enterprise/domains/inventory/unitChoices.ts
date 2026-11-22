export const INVENTORY_UNIT_CHOICE_SET = "inventory.unit";

/** `code` is what is stored. `label` is the on-screen name, and it is not a Latin abbreviation. */
export const INVENTORY_UNITS = [
  { code: "piece", label: "Piece" },
  { code: "unit", label: "Unit" },
  { code: "item", label: "Item" },
  { code: "set", label: "Set" },
  { code: "machine", label: "Machine" },
  { code: "strip", label: "Strip" },
  { code: "rod", label: "Rod" },
  { code: "sheet", label: "Sheet" },
  { code: "slice", label: "Slice" },
  { code: "kg", label: "Kilogram" },
  { code: "g", label: "Gram" },
  { code: "ton", label: "Ton" },
  { code: "meter", label: "Meter" },
  { code: "liter", label: "Liter" },
  { code: "box", label: "Box" },
  { code: "pack", label: "Pack" },
  { code: "roll", label: "Roll" },
  { code: "bundle", label: "Bundle" },
  { code: "barrel", label: "Barrel" },
] as const;
