// ---------------------------------------------------------------------------
// Generated tables for the current catalog — injected at runtime, not package source
//
// `@open-erp/tables` is generated from domains. packages depend only on the abstraction "one table registry":
// it is loaded dynamically by specifier at startup, and a fixture domain takes the same path. Source neither names a concrete table
// nor statically imports it at module top and then picks by name.
// ---------------------------------------------------------------------------

export type GeneratedTables = Readonly<Record<string, unknown>>;

/**
 * Load the generated tables for the current catalog.
 *
 * The specifier defaults to `OE_TABLES_MODULE`, then falls back to `@open-erp/tables`.
 * It must be a variable `import()`: a literal would make tsc resolve concrete table types at compile time.
 */
export async function loadGeneratedTables(specifier?: string): Promise<GeneratedTables> {
  const id = specifier ?? (process.env["OE_TABLES_MODULE"]?.trim() || "@open-erp/tables");
  const loaded: unknown = await import(id);
  if (loaded === null || typeof loaded !== "object") {
    throw new Error(`Generated table module "${id}" is not an object.`);
  }
  return loaded as GeneratedTables;
}
