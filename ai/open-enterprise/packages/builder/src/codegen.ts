// ---------------------------------------------------------------------------
// Table-definition code generation — "code is the only source of truth for the schema", cashed out in the persistence layer
//
// Table shape is not handwritten. It is compiled from the declarations in domains/. Add a field to salesOrder,
// `yarn gen:db` writes tables/; incremental SQL goes only through a handwritten open-migrate script plus apply.
//
// The output goes into git and through code review. That is not extra: one generator change can quietly change the
// column type of a hundred tables, and the diff is the only place a person can see it. A generator whose output is not in the repo has no review.
//
// Only business-module tables are generated. Ledgers, handoffs, audit, references, and user views are framework mechanisms,
// handwritten in packages/storage-pg/src/db/framework.ts. Generated tables appear and disappear with declarations. Those framework tables stay.
// ---------------------------------------------------------------------------

import { loadCatalog } from "@open-erp/loader";
// `hasColumn` comes from the kernel. Do not write another copy here: table generation, seed writes, and the write gate share one criterion.
// Separate copies do not fail loudly — the generator creates a column the writer does not fill, or the other way around.
import {
  generatedSequenceOf,
  hasColumn,
  isPlannerSupplied,
  isUnitChoiceFactor,
  snapshotColumnNotNull,
  uniqueFieldsOf,
  NUMERIC_PRECISION,
  PLATFORM_FIELDS,
  snake,
  type Field,
  type ModuleSchema,
  type SnapshotModuleResolver,
} from "@open-erp/metamodel";

/**
 * The only source of truth for camelCase → snake_case lives in metamodel.
 * The table generator, the analysis catalog, and the SQL gate must import that one copy. It is re-exported here only for older tests.
 */
export { snake } from "@open-erp/metamodel";

/**
 * Numeric column precision comes from the kernel (`NUMERIC_PRECISION`). Do not write another copy here.
 *
 * Separate copies do not fail loudly: the generator builds a 4-digit column while the write path's total
 * (the rounding in `computeLineAggregates`) is computed at 6 digits, and Postgres silently truncates on insert —
 * the header total and the sum of the lines then differ by one cent, and each number looks legal on its own.
 */
function numericCall(type: "number" | "money" | "percent"): string {
  const { precision, scale } = NUMERIC_PRECISION[type];
  return `numeric("%c", { precision: ${String(precision)}, scale: ${String(scale)} })`;
}

/**
 * Field type → column type.
 *
 * Numbers are always `numeric`, never `double`: in an ERP, 0.1 + 0.2 must equal 0.3.
 * Floating point in a financial system is not a precision problem. It is a books-that-do-not-tie problem.
 */
const COLUMN_TYPE: Readonly<Record<string, { readonly call: string; readonly import: string }>> = Object.freeze({
  string: { call: 'text("%c")', import: "text" },
  text: { call: 'text("%c")', import: "text" },
  phone: { call: 'text("%c")', import: "text" },
  // enum does not emit a CHECK constraint. Options change repeatedly during modeling, and a migration per new option
  // is a real tax on the FDE. The write gate lives in the application (normalizeField already validates options).
  enum: { call: 'text("%c")', import: "text" },
  // ref is only a foreign-key value. No FK is emitted — see the note in emitModule below.
  ref: { call: 'text("%c")', import: "text" },
  // A line-level reference is also only an id. The reason not to emit an FK is stricter than for ref: it points at an upstream line,
  // and that line table cascades deletes from its own header. An FK here would make deleting an order draft fail because of a downstream row,
  // or (written as cascade) would delete already-posted outbound lines with it. Existence is checked by the application reference gate.
  refLine: { call: 'text("%c")', import: "text" },
  number: { call: numericCall("number"), import: "numeric" },
  money: { call: numericCall("money"), import: "numeric" },
  percent: { call: numericCall("percent"), import: "numeric" },
  bool: { call: 'boolean("%c")', import: "boolean" },
  date: { call: 'date("%c")', import: "date" },
  datetime: { call: 'timestamp("%c", { withTimezone: true })', import: "timestamp" },
  attachment: { call: 'jsonb("%c")', import: "jsonb" },
});


interface Column {
  readonly name: string;
  readonly decl: string;
  readonly import: string;
}

function columnOf(
  field: Field,
  at: string,
  /** Sibling fields on the same level — whether a snapshot column is nullable also depends on when the match cell has a value */
  siblings: readonly Field[],
  resolve: SnapshotModuleResolver,
): Column {
  const spec = COLUMN_TYPE[field.type];
  if (!spec) {
    throw new Error(`${at}: field type "${field.type}" has no column-type mapping — a new FIELD_TYPE must be added here, and must not fall through to a default branch`);
  }
  const name = snake(field.key);
  // Fields the system writes into a column have a value at creation, so the column is notNull, and none of them require `required`
  // (`required` talks about the user entry, and these have no user entry — FIELD_REQUIRED_SYSTEM_SUPPLIED rejects marking them):
  //   · auto               number allocation
  //   · generatedSequence  increments by coordinate inside the create transaction (BOM version)
  //   · lineAgg            line total; an empty line set still has a value (the empty sum/count is 0)
  //   · snapshot           a reference snapshot, frozen from the source on save — conditional, see below
  //
  // `systemGenerated` by itself does not mean "a value exists at creation":
  //   · `stampOnFirstEnter` — the stamp is written the first time a named status is entered, and is still empty when the draft is stored
  //     (BOM `effectiveDate`). Emitting NOT NULL anyway is a Postgres 500.
  //   · A cell stamped only later by `setGeneratedHeader` (production task `actualStartAt`,
  //     written when assignment or outsourcing is approved) is the same: creating a task during scheduling must allow null, or INSERT hits NOT NULL
  //     and becomes "internal server error".
  //   systemGenerated that really is written at create goes through `generatedSequence` / `auto` / `required`.
  //
  // plannerSupplied is a fact that must exist when the system generates this bill, so it is always NOT NULL.
  // Relaxing it would drop physical integrity of a pure Planner fact.
  //
  // The snapshot rule is not unconditional. That is the load-bearing point of this change.
  // "snapshot ⇒ a value always exists ⇒ column NOT NULL" needs all three halves at once:
  //
  //   · `SNAPSHOT_MATCH_UNRESOLVED` (validate.ts) guarantees some hop will resolve this reference (timing);
  //   · `SNAPSHOT_MATCH_OPTIONAL` (validate.ts) guarantees the reference exists (match has a value);
  //     an explicit `snapshot.optional: true` relaxes this half, so the target column must be nullable;
  //   · `snapshotSourceGuarantee` (kernel) guarantees a value can be read when the reference exists (source is non-null).
  //
  // Missing any half, the column constraint is lying about the declaration. The cost of missing the first half was measured:
  // an accounts-payable statement line froze a companion ref as the business bill number. The source is the receipt number (`auto`, fully guaranteed),
  // and neither hop ever resolves that companion ref ⇒ column NOT NULL, value always undefined ⇒ save 500.
  // The cost of missing the other two halves was also measured: the sales order's spec
  // is optional (product master-detail is unfinished), and the outbound bill freezes it. The declaration says the source may be empty and the column says it may not,
  // so an order with a blank spec cannot ship after approval (400 SNAPSHOT_SOURCE_EMPTY),
  // and the bill has already left draft and is stuck in "awaitingShipment" with no way back.
  //
  // The criterion is not inlined here. It is the kernel's copy. The write path asks the same question (reject when the source is empty, or write null).
  // Two copies drift, and the drift is not an error — a nullable column while the write path still returns 400 (the bill stays stuck),
  // or a NOT NULL column while the write path allows null (an unreadable 500, and only when the source happens to be empty).
  const notNull =
    field.required ||
    field.auto ||
    generatedSequenceOf(field) !== null ||
    field.lineAgg !== null ||
    field.calculate !== null ||
    isPlannerSupplied(field) ||
    isUnitChoiceFactor(field, siblings) ||
    (field.snapshot !== null && snapshotColumnNotNull(field, siblings, resolve))
      ? ".notNull()"
      : "";
  return { name, decl: `${spec.call.replace("%c", name)}${notNull}`, import: spec.import };
}

/**
 * Column-name uniqueness gate.
 *
 * camel→snake is many-to-one: `totalQty` and `total_qty` collide into one column.
 * The declaration layer cannot see it (the two keys really are different). It shows up only here.
 * A collision throws. Generating a table that is missing a column hides the mistake until runtime.
 */
function assertNoCollision(columns: readonly Column[], table: string): void {
  const seen = new Map<string, string>();
  for (const c of columns) {
    const prev = seen.get(c.name);
    if (prev) throw new Error(`Table ${table}: column name "${c.name}" conflicts (two keys become the same name after camelCase to snake_case) — change one field key`);
    seen.set(c.name, c.name);
  }
  const platform = new Set(PLATFORM_FIELDS.map(snake));
  for (const c of columns) {
    if (platform.has(c.name)) {
      throw new Error(`Table ${table}: column "${c.name}" collides with a platform field — platform fields are provided by the framework and must not be declared in fields`);
    }
  }
}

/**
 * Who asked for a `uniqueIndex(tenant_id, column)`.
 *
 * The two sources emit a byte-identical index on the table side and mean different things everywhere else, so they cannot collapse into one boolean:
 *   · `primary` — the bill-number index. The field itself writes no `unique` (`FIELD_UNIQUE_WITH_PRIMARY`
 *     forbids marking it again), and the write path's application duplicate check (`uniqueSitesOf`) does not look at it.
 *     primary is always numbered by the platform. A collision can only be concurrency, which is 409, not "you typed a duplicate".
 *   · `declared` — `unique` marked on the field itself. It enters the application duplicate check. A collision is 400 plus a per-field
 *     `UNIQUE_DUPLICATE` (it can be marked on that cell).
 * After collapsing them into one boolean, explain has no answer to "how is a duplicate on this cell reported".
 */
export type UniqueBy = "primary" | "declared";

export interface UniqueIndexed {
  readonly field: Field;
  readonly by: UniqueBy;
}

/**
 * Which fields on this level the table generator emits `uniqueIndex(tenant_id, column)` for.
 *
 * Table generation and `yarn catalog` share this criterion. Separate copies do not fail loudly: explain says "this cell
 * must not repeat" while no index was emitted (the wording an FDE already confirmed with a customer fails in production), or the reverse —
 * an index was emitted and explain never mentions it, so nobody can answer "can this product barcode repeat",
 * and the unique index in the database answers for us the second time a customer scans the same barcode.
 *
 * This holds only for the header. A line table emits no business unique index. `unique` on a line column is rejected by
 * `FIELD_UNIQUE_ON_LINE` (both readings are possible, and position must not be used to guess), and `primary` on a line column
 * has no consumer. Callers invoke this only on the header level. Passing line columns would describe an index the generator will not emit.
 */
export function uniqueIndexedFieldsOf(fields: readonly Field[]): readonly UniqueIndexed[] {
  // Bill number unique: a primary field is unique within the tenant. Two bills with the same number are a disaster in an ERP,
  // and an application "look then insert" does not hold under concurrency.
  // `hasColumn` cannot be skipped: a derived field has no column, so there is nowhere to put an index.
  const primary = fields.find((f) => f.primary && hasColumn(f));
  return [
    ...(primary ? [{ field: primary, by: "primary" as const }] : []),
    ...uniqueFieldsOf(fields).map((field) => ({ field, by: "declared" as const })),
  ];
}

const HEADER_PLATFORM = `    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    orgId: text("org_id").notNull(),
    status: text("status").notNull(),
    revision: integer("revision").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: text("created_by").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    updatedBy: text("updated_by").notNull(),`;

/** Generate one module's tables (a header plus one line table per subtable). */
function emitModule(
  schema: ModuleSchema,
  // Column nullability depends on other modules (where a snapshot source lives, and whether it is required),
  // so the generator is no longer a pure projection of one schema in, one table out. `genDb` supplies the resolver from
  // the same catalog. Loading domains twice would be two sources of truth.
  resolve: SnapshotModuleResolver,
  tenantScopedIdentity = false,
): { readonly code: string; readonly imports: ReadonlySet<string> } {
  const imports = new Set<string>(["pgTable", "text", "integer", "timestamp", "index", "uniqueIndex"]);
  const tableVar = schema.code;
  const tableName = `oe_${snake(schema.code)}`;
  if (tenantScopedIdentity) imports.add("primaryKey");

  const cols = schema.fields
    .filter(hasColumn)
    .map((f) => columnOf(f, `${schema.code}.fields.${f.key}`, schema.fields, resolve));
  assertNoCollision(cols, tableName);
  for (const c of cols) imports.add(c.import);

  const body = schema.fields
    .filter(hasColumn)
    .map((f) => `    ${f.key}: ${columnOf(f, "", schema.fields, resolve).decl},`)
    .join("\n");

  // A business field's `unique` and the primary index are the same shape: both include `tenantId`,
  // so `uniqueIndexedFieldsOf` returns both at once (`explain` reads the same list).
  //
  // Dropping tenantId does not fail loudly: a barcode filled by tenant A can never be filled by tenant B,
  // and the rejection itself leaks "another tenant has this value" — a cross-tenant channel.
  //
  // No `where` (not a partial index). A Postgres unique index is NULLS DISTINCT by default,
  // so many NULLs do not conflict, and a batch of products with no barcode still stores. The value gate collapses an empty string to null
  // (the header of instance.ts), so an empty string does not degrade into a real value that everyone filled in the same way.
  // Adding `where col is not null` is the same behavior plus a harder declaration. Noise.
  // A module that opens custom fields gets one extra `custom jsonb` column: cells configured by the tenant live here,
  // and travel with the business row. The index is handwritten as GIN (`jsonb_path_ops`) in the migration —
  // drizzle's index().using("gin") can express it, but a migration diff compares columns and not indexes,
  // so writing it here would look like the index already exists. The source of truth for the index is that SQL.
  // Line tables get the same column. Cardinality follows the level the value lives on. "Product" on a sales order lives on the line,
  // and N lines are N product-archive values. Pushing them onto the header would require an aggregation rule. Opening is module-scoped
  // (`ModuleSchema.customFields`), so every line table of that module opens too. The boundary stays the one declaration,
  // with no second runtime metadata for "which line tables are open".
  const customColumn = schema.customFields ? '\n    custom: jsonb("custom"),' : "";
  if (schema.customFields) imports.add("jsonb");

  const indexes = [
    ...(tenantScopedIdentity ? [`    primaryKey({ name: "${tableName}_pkey", columns: [t.tenantId, t.id] }),`] : []),
    `    index("${tableName}_scope_idx").on(t.tenantId, t.status),`,
    ...uniqueIndexedFieldsOf(schema.fields).map(({ field: f }) => {
      // Composite unique: `(tenant, …uniqueWith, this field)`. A single column stays `(tenant, this field)`.
      const cols = ["t.tenantId", ...(f.uniqueWith ?? []).map((k) => `t.${k}`), `t.${f.key}`];
      const suffix = f.uniqueWith?.length ? `${[...f.uniqueWith, f.key].map(snake).join("_")}` : snake(f.key);
      return `    uniqueIndex("${tableName}_${suffix}_uq").on(${cols.join(", ")}),`;
    }),
  ];

  const parts: string[] = [];
  parts.push(`export const ${tableVar} = pgTable(
  "${tableName}",
  {
${tenantScopedIdentity ? HEADER_PLATFORM.replace('text("id").primaryKey()', 'text("id").notNull()') : HEADER_PLATFORM}
${body}${customColumn}
  },
  (t) => [
${indexes.join("\n")}
  ],
);`);

  // Line tables: one per subtable.
  for (const field of schema.fields.filter((f) => f.type === "subtable")) {
    if (!field.fields) throw new Error(`${schema.code}.fields.${field.key}: subtable has no column declarations`);
    // A line column must not be unique (`FIELD_UNIQUE_ON_LINE`: `uniqueIndex(tenant_id, column)` on a line table means
    // "unique across the whole tenant", while someone writing it on a line column usually means "not repeated inside this bill"). If the gate is bypassed, fail here.
    // Do not silently omit the index — that would let a modeler believe a constraint exists that does not.
    for (const column of field.fields) {
      if (column.unique) {
        throw new Error(
          `${schema.code}.${field.key}.${column.key}: a line column must not be unique — the declaration-time gate should already have rejected it`,
        );
      }
    }
    const lineVar = `${schema.code}_${field.key}`;
    const lineTable = `oe_${snake(schema.code)}_${snake(field.key)}`;
    const lineColumns = field.fields;
    const lineCols = lineColumns
      .filter(hasColumn)
      .map((f) => columnOf(f, `${schema.code}.${field.key}.${f.key}`, lineColumns, resolve));
    assertNoCollision(lineCols, lineTable);
    for (const c of lineCols) imports.add(c.import);
    imports.add("integer");
    if (tenantScopedIdentity) imports.add("foreignKey");

    const lineBody = field.fields
      .filter(hasColumn)
      .map((f) => `    ${f.key}: ${columnOf(f, "", lineColumns, resolve).decl},`)
      .join("\n");

    // Each reference column on a line gets an index. Merged outbound moved two hot queries off the header and onto the line:
    //   · reverse lookup of downstream (`exists (select 1 from line where order_id = ?)`)
    //   · line rollup (shipped quantity of an order line = sum of outbound lines by order_line_id)
    // Both are subqueries the detail page and the list page run on every render. Without an index the result is still correct.
    // It is only a full scan, so nothing errors. It only gets slow after the data grows.
    const refCols = field.fields.filter((f) => hasColumn(f) && (f.type === "ref" || f.type === "refLine"));
    const refIndexes = refCols.map(
      (f) => `    index("${lineTable}_${snake(f.key)}_idx").on(t.tenantId, t.${f.key}),`,
    );
    const ownerColumn = tenantScopedIdentity ? '    billId: text("bill_id").notNull(),' : `    billId: text("bill_id")
      .notNull()
      .references(() => ${tableVar}.id, { onDelete: "cascade" }),`;

    // A line has no status machine and no orgId of its own. It is always reached through the header, and ownership follows the header.
    // Cascade delete is the foreign key inside this file, the only place an FK is emitted. When a draft bill is deleted, its lines must go with it.
    // An orphan line would make "how many lines does this bill have" permanently wrong.
    parts.push(`export const ${lineVar} = pgTable(
  "${lineTable}",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
${ownerColumn}
    lineNo: integer("line_no").notNull(),
${lineBody}${customColumn}
  },
  (t) => [
${tenantScopedIdentity ? `    foreignKey({ columns: [t.tenantId, t.billId], foreignColumns: [${tableVar}.tenantId, ${tableVar}.id] }).onDelete("cascade"),\n` : ""}\
    index("${lineTable}_bill_idx").on(t.tenantId, t.billId),
${refIndexes.join("\n")}${refIndexes.length ? "\n" : ""}    uniqueIndex("${lineTable}_no_uq").on(${tenantScopedIdentity ? 't.tenantId, ' : ''}t.billId, t.lineNo),
  ],
);`);
  }

  return { code: parts.join("\n\n"), imports };
}

/**
 * Generated-file banner.
 *
 * It is also the criterion `gen:db` uses when cleaning old output (cli.ts): only files that carry this banner are deleted.
 * The criterion is not "every .ts in the directory". A wrong `--out` one directory off would silently delete handwritten framework table definitions.
 * Changing this text moves the check in cli.ts with it, because that check imports this constant.
 */
export const GENERATED_BANNER = `// 🔴 This file is generated by \`yarn gen:db\` from the module declarations in domains/. **Do not hand-edit.**
// Changing the table shape means changing the module declaration, then regenerating. A hand edit is overwritten on the next generate,
// and it would make "code is the only source of truth for the schema" false.`;

const BANNER = GENERATED_BANNER;

export interface GenDbResult {
  readonly files: readonly { readonly path: string; readonly content: string }[];
}

/**
 * Generate Drizzle table definitions for every module. A pure function — it returns file contents and does not write.
 * The CLI writes, so the generation itself can be unit-tested.
 */
export async function genDb(domainsRoot: string): Promise<GenDbResult> {
  const catalog = await loadCatalog({ domainsRoot });
  const files: { path: string; content: string }[] = [];
  const names: string[] = [];
  // The snapshot-source resolver comes from this catalog. Column nullability follows the source's nullability,
  // and the source lives in another module. Loading again would be a second source of truth.
  const resolve: SnapshotModuleResolver = (code) => catalog.modules.get(code)?.schema;

  for (const m of [...catalog.modules.values()].sort((a, b) => a.code.localeCompare(b.code))) {
    // Directory ids are platform identities, shared across tenants by design.
    const { code, imports } = emitModule(m.schema, resolve, m.code === catalog.authorization.subjectDirectory?.module);
    const importList = [...imports].sort().join(", ");
    files.push({
      path: `${m.code}.ts`,
      content: `${BANNER}\n// Source: domains/${m.file}\n\nimport { ${importList} } from "drizzle-orm/pg-core";\n\n${code}\n`,
    });
    names.push(m.code);
  }

  files.push({
    path: "index.ts",
    content: `${BANNER}\n\n${names.map((n) => `export * from "./${n}.js";`).join("\n")}\n`,
  });

  return { files };
}

/**
 * Write `genDb` output into the given directory. Fixtures and domain-switch gates use a temp directory and do not touch the repo-root `tables/`.
 */
export async function writeGeneratedTables(domainsRoot: string, outDir: string): Promise<GenDbResult> {
  const { mkdirSync, writeFileSync } = await import("node:fs");
  const { default: path } = await import("node:path");
  const result = await genDb(domainsRoot);
  mkdirSync(outDir, { recursive: true });
  for (const file of result.files) {
    writeFileSync(path.join(outDir, file.path), file.content, "utf8");
  }
  return result;
}
