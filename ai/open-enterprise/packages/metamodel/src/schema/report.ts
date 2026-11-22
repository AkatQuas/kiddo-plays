// ---------------------------------------------------------------------------
// Daily-report pipeline registration — not a seventh concept, and it does not live on a module.
//
// The snapshot module code and the narrative-domain axis are declared by the report domain.
// packages only look up the catalog and do not write business words.
// A narrative-domain key must not collide with a ledger code (checked at load against the real ledger catalog; ledger words are not written here).
// ---------------------------------------------------------------------------

import {
  assertClosedKeys,
  requireArray,
  requireCoordinateSegment,
  requireObject,
  requireText,
  schemaFail,
} from "./common.js";

export const REPORT_SNAPSHOT_ROLE = "dailyReportSnapshot";

export interface ReportNarrativeDomain {
  readonly key: string;
  readonly label: string;
}

export interface ReportAssembleCopy {
  readonly pendingAuditTitle: string;
  readonly pendingAuditLabel: string;
  readonly completedPrefix: string;
  readonly attentionHint: string;
}

export type ReportFactClock = "today" | "reportDate";
export type ReportFactAs = "number" | "flag" | "rate" | "rows" | "moduleCounts";

export interface ReportFactCell {
  readonly insight: string;
  readonly cell: string;
  readonly clock: ReportFactClock;
  readonly as: ReportFactAs;
}

export interface ReportDeclaration {
  readonly snapshotModule: string;
  readonly snapshotRole: typeof REPORT_SNAPSHOT_ROLE;
  readonly narrativeDomains: readonly ReportNarrativeDomain[];
  readonly sourceModules: readonly string[];
  readonly assembleCopy: ReportAssembleCopy;
  readonly itemFields: Readonly<Record<string, string>>;
  readonly factCells: Readonly<Record<string, ReportFactCell>>;
  readonly riskCountFacts: readonly string[];
  readonly orFlags: Readonly<Record<string, readonly string[]>>;
  readonly snapshotStatus: string;
  readonly statusAsOf: string;
}

export const DEFINED_REPORT_BY_KERNEL = Symbol.for("open-erp.definedReport");

const REPORT_KEYS = [
  "snapshotModule", "narrativeDomains", "sourceModules", "assembleCopy", "itemFields",
  "factCells", "riskCountFacts", "orFlags", "snapshotStatus", "statusAsOf",
] as const;
const FACT_CELL_KEYS = ["insight", "cell", "clock", "as"] as const;
const FACT_CLOCKS = ["today", "reportDate"] as const;
const FACT_AS = ["number", "flag", "rate", "rows", "moduleCounts"] as const;
const ASSEMBLE_COPY_KEYS = ["pendingAuditTitle", "pendingAuditLabel", "completedPrefix", "attentionHint"] as const;
const NARRATIVE_KEYS = ["key", "label"] as const;

function brandAsDefined(report: ReportDeclaration): ReportDeclaration {
  Object.defineProperty(report, DEFINED_REPORT_BY_KERNEL, { value: true, enumerable: false, writable: false });
  return report;
}

export function isDefinedReport(value: unknown): value is ReportDeclaration {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    (value as Record<symbol, unknown>)[DEFINED_REPORT_BY_KERNEL] === true
  );
}

export function defineReport(raw: unknown): ReportDeclaration {
  const obj = requireObject(raw, "report");
  assertClosedKeys(obj, REPORT_KEYS, "report");
  const snapshotModule = requireCoordinateSegment(obj["snapshotModule"], "report.snapshotModule");
  const rawDomains = requireArray(obj["narrativeDomains"], "report.narrativeDomains");
  if (rawDomains.length === 0) schemaFail("report.narrativeDomains must not be empty");
  const seen = new Set<string>();
  const narrativeDomains = rawDomains.map((item, index): ReportNarrativeDomain => {
    const at = `report.narrativeDomains[${String(index)}]`;
    const domain = requireObject(item, at);
    assertClosedKeys(domain, NARRATIVE_KEYS, at);
    const key = requireCoordinateSegment(domain["key"], `${at}.key`);
    if (seen.has(key)) schemaFail(`${at}.key "${key}" is declared more than once`);
    seen.add(key);
    return { key, label: requireText(domain["label"], `${at}.label`) };
  });
  const sourceModules = obj["sourceModules"] === undefined
    ? []
    : requireArray(obj["sourceModules"], "report.sourceModules").map((item, index) =>
        requireCoordinateSegment(item, `report.sourceModules[${String(index)}]`),
      );
  const assembleCopy = obj["assembleCopy"] === undefined
    ? { pendingAuditTitle: "", pendingAuditLabel: "", completedPrefix: "", attentionHint: "" }
    : (() => {
        const raw = requireObject(obj["assembleCopy"], "report.assembleCopy");
        assertClosedKeys(raw, ASSEMBLE_COPY_KEYS, "report.assembleCopy");
        return {
          pendingAuditTitle: requireText(raw["pendingAuditTitle"], "report.assembleCopy.pendingAuditTitle"),
          pendingAuditLabel: requireText(raw["pendingAuditLabel"], "report.assembleCopy.pendingAuditLabel"),
          completedPrefix: requireText(raw["completedPrefix"], "report.assembleCopy.completedPrefix"),
          attentionHint: requireText(raw["attentionHint"], "report.assembleCopy.attentionHint"),
        };
      })();
  const itemFields = obj["itemFields"] === undefined
    ? {}
    : Object.fromEntries(
        Object.entries(requireObject(obj["itemFields"], "report.itemFields")).map(([key, value]) => [
          requireCoordinateSegment(key, `report.itemFields.${key}`),
          requireText(value, `report.itemFields.${key}`),
        ]),
      );
  const factCellsRaw = obj["factCells"] === undefined ? {} : requireObject(obj["factCells"], "report.factCells");
  const factCells = Object.fromEntries(
    Object.entries(factCellsRaw).map(([key, raw]) => {
      const at = `report.factCells.${key}`;
      const cell = requireObject(raw, at);
      assertClosedKeys(cell, FACT_CELL_KEYS, at);
      return [requireCoordinateSegment(key, at), {
        insight: requireText(cell["insight"], `${at}.insight`),
        cell: requireText(cell["cell"], `${at}.cell`),
        clock: requireText(cell["clock"], `${at}.clock`) as ReportFactClock,
        as: requireText(cell["as"], `${at}.as`) as ReportFactAs,
      } satisfies ReportFactCell];
    }),
  );
  for (const [key, cell] of Object.entries(factCells)) {
    if (!FACT_CLOCKS.includes(cell.clock)) schemaFail(`report.factCells.${key}.clock is not recognized`);
    if (!FACT_AS.includes(cell.as)) schemaFail(`report.factCells.${key}.as is not recognized`);
  }
  const riskCountFacts = (obj["riskCountFacts"] === undefined ? [] : requireArray(obj["riskCountFacts"], "report.riskCountFacts")).map((item, i) =>
    requireCoordinateSegment(item, `report.riskCountFacts[${String(i)}]`),
  );
  const orFlagsRaw = obj["orFlags"] === undefined ? {} : requireObject(obj["orFlags"], "report.orFlags");
  const orFlags = Object.fromEntries(
    Object.entries(orFlagsRaw).map(([key, value]) => [
      requireCoordinateSegment(key, `report.orFlags.${key}`),
      requireArray(value, `report.orFlags.${key}`).map((item, i) =>
        requireCoordinateSegment(item, `report.orFlags.${key}[${String(i)}]`),
      ),
    ]),
  );
  return brandAsDefined({
    snapshotModule,
    snapshotRole: REPORT_SNAPSHOT_ROLE,
    narrativeDomains,
    sourceModules,
    assembleCopy,
    itemFields,
    factCells,
    riskCountFacts,
    orFlags,
    snapshotStatus: obj["snapshotStatus"] === undefined ? "" : requireText(obj["snapshotStatus"], "report.snapshotStatus"),
    statusAsOf: obj["statusAsOf"] === undefined ? "Counted from the status at generation time" : requireText(obj["statusAsOf"], "report.statusAsOf"),
  });
}
