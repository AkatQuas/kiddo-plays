// ---------------------------------------------------------------------------
// PostgreSQL physical names — declared key → table name / column name
//
// The table builder, the analysis catalog, and the SQL gate share this one copy.
// Separate copies do not fail loudly: the catalog says the relation is
// oe_purchase_order while the generator builds oe_purchaseorder, and the gate
// lets through SQL that always returns empty. Both sides look correct.
// ---------------------------------------------------------------------------

/**
 * camelCase → snake_case. No mapping table: a mapping table is a second source
 * of truth and drifts the moment a field is renamed.
 */
export function snake(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
}

/** Header physical table name. Character-for-character the same shape as `yarn gen:db`. */
export function businessTableName(moduleCode: string, through: string | null = null): string {
  return through === null ? `oe_${snake(moduleCode)}` : `oe_${snake(moduleCode)}_${snake(through)}`;
}

/** Field key → physical column name. Character-for-character `snake(field.key)` in the table builder. */
export function businessColumnName(fieldKey: string): string {
  return snake(fieldKey);
}
