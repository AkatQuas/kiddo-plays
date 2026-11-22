// ---------------------------------------------------------------------------
// Analysis catalog — project queryable relations from module declarations
//
// The developer declaration is the only source of truth. This file is a pure
// projection: it does not read the database and it does not hand-write a second
// copy of metadata. The generated artifact (tables/analysis-catalog.json) can
// be reviewed; runtime uses this same function. A drift gate compares the two.
//
// Anything without a column must not enter fields: derive / attachment /
// subtable show up in missingFacts, so the catalog does not claim a column that
// makes SQL explode, or worse, a queryable illusion.
// ---------------------------------------------------------------------------

import { hasColumn, isDerived, type Field, type FieldType } from "../schema/fields.js";
import { PLATFORM_LINE_FIELDS, type ModuleSchema } from "../schema/module.js";
import { relationsOf, type Relation } from "../relations/relations.js";
import { businessColumnName, businessTableName } from "./pgNames.js";

export const ANALYSIS_CATALOG_VERSION = 1 as const;

/** Snapshot exports may freeze a declared header label lookup using the normal
 * read projection. It remains absent from the physical SQL relation catalog.
 * Numeric/aggregate/formula/line lookups are deliberately outside this contract.
 */
export function analysisSnapshotLookupOf(module:ModuleSchema,key:string):Field|undefined {
  const field=module.fields.find(f=>f.key===key);
  return field?.derive?.kind==='lookup' && field.derive.through===null && ['string','text','phone','enum'].includes(field.type) ? field : undefined;
}

export type AnalysisGrain = "header" | "line";
export type AnalysisJoinVia = "header_line" | "ref" | "refLine";
export type AnalysisCardinality = "one" | "many";

export interface AnalysisField {
  readonly key: string;
  readonly column: string;
  readonly type: FieldType;
  readonly label: string;
  readonly unit: string | null;
  readonly scope: boolean;
}

export interface AnalysisJoin {
  readonly to: string;
  readonly fromColumns: readonly string[];
  readonly toColumns: readonly string[];
  readonly cardinality: AnalysisCardinality;
  readonly fanoutRisk: boolean;
  readonly via: AnalysisJoinVia;
  readonly field: string;
}

export interface AnalysisMissingFact {
  readonly code: string;
  readonly path: string;
  readonly reason: string;
}

export interface AnalysisRelation {
  readonly name: string;
  readonly module: string;
  readonly moduleLabel: string;
  readonly grain: AnalysisGrain;
  readonly through: string | null;
  readonly throughLabel: string | null;
  readonly primaryFacts: readonly string[];
  readonly fields: readonly AnalysisField[];
  readonly joins: readonly AnalysisJoin[];
  readonly businessTimeFields: readonly string[];
  readonly statusFields: readonly string[];
  readonly validFactSemantics: string;
  readonly missingFacts: readonly AnalysisMissingFact[];
}

export interface AnalysisCatalog {
  readonly version: typeof ANALYSIS_CATALOG_VERSION;
  readonly generatedFrom: "domains";
  readonly relations: readonly AnalysisRelation[];
}

const HEADER_PLATFORM: readonly AnalysisField[] = [
  fieldOf("id", "string", "document id", null, false),
  fieldOf("tenantId", "string", "tenant", null, true),
  fieldOf("orgId", "string", "organization", null, true),
  fieldOf("status", "enum", "status", null, false),
  fieldOf("revision", "number", "revision", null, false),
  fieldOf("createdAt", "datetime", "created at", "datetime", false),
  fieldOf("createdBy", "string", "created by", null, false),
  fieldOf("updatedAt", "datetime", "updated at", "datetime", false),
  fieldOf("updatedBy", "string", "updated by", null, false),
];

const LINE_PLATFORM: readonly AnalysisField[] = [
  fieldOf("id", "string", "line id", null, false),
  fieldOf("tenantId", "string", "tenant", null, true),
  fieldOf("billId", "string", "header id", null, false),
  fieldOf("lineNo", "number", "line number", null, false),
];

function fieldOf(
  key: string,
  type: FieldType,
  label: string,
  unit: string | null,
  scope: boolean,
): AnalysisField {
  return { key, column: businessColumnName(key), type, label, unit, scope };
}

function unitOf(field: Field): string | null {
  if (field.type === "money") return "money";
  if (field.type === "percent") return "percent";
  if (field.type === "date" || field.type === "datetime") return field.type;
  if (field.type === "number" && field.unitChoice !== null) return "qty";
  return null;
}

function storedFields(declared: readonly Field[], extras: readonly AnalysisField[]): readonly AnalysisField[] {
  const business = declared
    .filter((field) => hasColumn(field) && field.type !== "attachment")
    .map((field) => fieldOf(field.key, field.type, field.label, unitOf(field), false));
  return [...extras, ...business];
}

function missingOf(module: ModuleSchema, declared: readonly Field[], at: string): readonly AnalysisMissingFact[] {
  const missing: AnalysisMissingFact[] = [];
  for (const field of declared) {
    if (isDerived(field)) {
      missing.push({
        code: "DERIVED_NOT_STORED",
        path: `${at}.${field.key}`,
        reason: `"${field.label}" is a derived field recomputed at query time, has no physical column, and cannot be written into SQL`,
      });
    } else if (field.type === "attachment") {
      missing.push({
        code: "ATTACHMENT_NOT_ANALYTIC",
        path: `${at}.${field.key}`,
        reason: `"${field.label}" is an attachment object key, not an aggregable analytic fact`,
      });
    }
  }
  if (!declared.some((field) => hasColumn(field) && (field.type === "number" || field.type === "money" || field.type === "percent"))) {
    missing.push({
      code: "NO_ADDITIVE_MEASURE",
      path: at,
      reason: "This grain has no stored numeric column, so sum/avg/ratio are not available here",
    });
  }
  return missing;
}

function timeFieldsOf(fields: readonly AnalysisField[]): readonly string[] {
  return fields.filter((field) => field.type === "date" || field.type === "datetime").map((field) => field.key);
}

function joinKey(join: AnalysisJoin): string {
  return `${join.to}|${join.fromColumns.join(",")}|${join.toColumns.join(",")}|${join.via}|${join.field}`;
}

function uniqueJoins(joins: readonly AnalysisJoin[]): readonly AnalysisJoin[] {
  const seen = new Set<string>();
  const out: AnalysisJoin[] = [];
  for (const join of joins) {
    const key = joinKey(join);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(join);
  }
  return out;
}

function refJoin(
  fromModule: string,
  relation: Relation,
  fromGrain: AnalysisGrain,
  fromThrough: string | null,
): AnalysisJoin | null {
  if (relation.from !== fromModule) return null;
  if (fromGrain === "header" && relation.via === "line") return null;
  if (fromGrain === "line" && relation.via === "line" && relation.through !== fromThrough) return null;
  if (fromGrain === "line" && relation.via === "bill") return null;
  const to = businessTableName(relation.to, relation.toLevel === "line" ? relation.toThrough : null);
  return {
    to,
    fromColumns: [businessColumnName(relation.field)],
    toColumns: ["id"],
    cardinality: "one",
    fanoutRisk: false,
    via: relation.toLevel === "line" ? "refLine" : "ref",
    field: relation.field,
  };
}

function inboundJoin(relation: Relation, thisModule: string, thisGrain: AnalysisGrain, thisThrough: string | null): AnalysisJoin | null {
  if (relation.to !== thisModule) return null;
  const thisIsTargetHeader = thisGrain === "header" && relation.toLevel === "bill";
  const thisIsTargetLine = thisGrain === "line" && relation.toLevel === "line" && relation.toThrough === thisThrough;
  if (!thisIsTargetHeader && !thisIsTargetLine) return null;
  const from = businessTableName(relation.from, relation.via === "line" ? relation.through : null);
  return {
    to: from,
    fromColumns: ["id"],
    toColumns: [businessColumnName(relation.field)],
    cardinality: "many",
    fanoutRisk: true,
    via: relation.toLevel === "line" ? "refLine" : "ref",
    field: relation.field,
  };
}

/**
 * Build a stable analysis catalog from module declarations. Relations are sorted
 * by name; fields stay in declaration order (platform columns first).
 */
export function analysisCatalogOf(modules: readonly ModuleSchema[]): AnalysisCatalog {
  const sorted = [...modules].sort((left, right) => left.code.localeCompare(right.code));
  const relations: AnalysisRelation[] = [];

  for (const module of sorted) {
    const graph = relationsOf(sorted, module.code);
    const headerName = businessTableName(module.code);
    const headerFields = storedFields(module.fields, HEADER_PLATFORM);
    const primary = module.fields.find((field) => field.primary && hasColumn(field));
    const statuses = module.lifecycle.statuses.map((status) => status.key);
    const headerMissing = missingOf(module, module.fields, module.code);
    const headerJoins: AnalysisJoin[] = [];

    for (const table of module.fields.filter((field) => field.type === "subtable")) {
      headerJoins.push({
        to: businessTableName(module.code, table.key),
        fromColumns: ["id"],
        toColumns: ["bill_id"],
        cardinality: "many",
        fanoutRisk: true,
        via: "header_line",
        field: table.key,
      });
    }
    for (const edge of graph.outbound) {
      const join = refJoin(module.code, edge, "header", null);
      if (join) headerJoins.push(join);
    }
    for (const edge of graph.inbound) {
      const join = inboundJoin(edge, module.code, "header", null);
      if (join) headerJoins.push(join);
    }

    relations.push({
      name: headerName,
      module: module.code,
      moduleLabel: module.label,
      grain: "header",
      through: null,
      throughLabel: null,
      primaryFacts: primary ? ["id", primary.key] : ["id"],
      fields: headerFields,
      joins: uniqueJoins(headerJoins),
      businessTimeFields: timeFieldsOf(headerFields),
      statusFields: ["status"],
      validFactSemantics:
        `"${module.label}" header: one document per row. status is the current lifecycle state (${statuses.join(" / ") || "none"}). ` +
        `Narrow to valid facts with status yourself; the catalog does not collapse drafts and posted rows into one measure.`,
      missingFacts: headerMissing,
    });

    for (const table of module.fields.filter((field) => field.type === "subtable")) {
      const lineName = businessTableName(module.code, table.key);
      const lineDeclared = table.fields ?? [];
      const lineFields = storedFields(lineDeclared, LINE_PLATFORM);
      const lineJoins: AnalysisJoin[] = [
        {
          to: headerName,
          fromColumns: ["bill_id"],
          toColumns: ["id"],
          cardinality: "one",
          fanoutRisk: false,
          via: "header_line",
          field: "billId",
        },
      ];
      for (const edge of graph.outbound) {
        const join = refJoin(module.code, edge, "line", table.key);
        if (join) lineJoins.push(join);
      }
      for (const edge of graph.inbound) {
        const join = inboundJoin(edge, module.code, "line", table.key);
        if (join) lineJoins.push(join);
      }
      relations.push({
        name: lineName,
        module: module.code,
        moduleLabel: module.label,
        grain: "line",
        through: table.key,
        throughLabel: table.label,
        primaryFacts: ["id", "billId", "lineNo"],
        fields: lineFields,
        joins: uniqueJoins(lineJoins),
        businessTimeFields: timeFieldsOf(lineFields),
        statusFields: [],
        validFactSemantics:
          `"${module.label}" / "${table.label}": one line per row, owned by the header through bill_id. ` +
          `SUM of a header amount would be multiplied by the line count. Lines have no status of their own; validity follows the header.`,
        missingFacts: missingOf(module, lineDeclared, `${module.code}.${table.key}`),
      });
    }
  }

  return {
    version: ANALYSIS_CATALOG_VERSION,
    generatedFrom: "domains",
    relations: relations.sort((left, right) => left.name.localeCompare(right.name)),
  };
}

export function analysisRelationOf(catalog: AnalysisCatalog, name: string): AnalysisRelation | undefined {
  return catalog.relations.find((relation) => relation.name === name);
}

export function analysisFieldOf(relation: AnalysisRelation, column: string): AnalysisField | undefined {
  const key = column.includes(".") ? column.slice(column.lastIndexOf(".") + 1) : column;
  return relation.fields.find((field) => field.column === key || field.key === key);
}

/** Platform line-field types, shared by tests and gates. */
export const ANALYSIS_LINE_PLATFORM_TYPES: Readonly<Record<(typeof PLATFORM_LINE_FIELDS)[number], FieldType>> = {
  id: "string",
  lineNo: "number",
};
