import type { GeneratedTables } from "./generatedTables.js";
import type { DirectoryPersonTable } from "./localRbacRepo.js";

/** Account-directory table. Declared at catalog.authorization.subjectDirectory; the table object lives in the generated output. */
export function subjectDirectoryTable(
  declared: { readonly module: string } | null,
  tables: GeneratedTables,
): DirectoryPersonTable {
  if (declared === null) {
    throw new Error("The whole product must declare subjectDirectory.");
  }
  const table = tables[declared.module];
  if (table === undefined || table === null || typeof table !== "object") {
    throw new Error(`Generated tables have no account-directory module "${declared.module}".`);
  }
  return table as DirectoryPersonTable;
}
