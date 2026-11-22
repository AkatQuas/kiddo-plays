import type { CreatedIdValue, PlanRecord } from "@open-erp/metamodel";

/** Smallest BOM read model. Impact analysis depends only on business facts, not on a database or the web. */
export interface BomImpactSnapshot {
  readonly id: string;
  readonly productId: string;
  readonly version: string;
  readonly status: string;
  readonly lines: readonly Readonly<Record<string, unknown>>[];
}

export interface BomImpactNode {
  readonly bomId: string;
  readonly productId: string;
  /** 1 = directly references the changed BOM, 2+ = affected indirectly through other semi-finished goods. */
  readonly distance: number;
  /** Reverse chain from the changed semi-finished product to the current product. */
  readonly productPath: readonly string[];
  readonly direct: boolean;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

/**
 * Find every parent BOM that references a BOM (or its product).
 *
 * Match on `componentProductId`: a line that points at that product is affected.
 * Only active parents are scanned. A disabled version is not used in production
 * and should not appear on the affected-product list.
 *
 * A product has only one active BOM at a time (`singleActiveWithin`), so the
 * reference is that product's only active BOM.
 */
export function bomImpactsOf(
  boms: readonly BomImpactSnapshot[],
  changedBomId: string,
): readonly BomImpactNode[] {
  const changed = boms.find((bom) => bom.id === changedBomId);
  if (changed === undefined) return [];

  const active = boms.filter((bom) => bom.status === "active");
  const out: BomImpactNode[] = [];
  const seen = new Set<string>();
  const queue: Array<{ bomId: string; productId: string; distance: number; path: readonly string[]; active: boolean }> = [
    { bomId: changed.id, productId: changed.productId, distance: 0, path: [changed.productId], active: changed.status === "active" },
  ];

  while (queue.length) {
    const current = queue.shift()!;
    for (const parent of active) {
      const references = parent.lines.some((line) => {
        const component = text(line["componentProductId"]);
        // With no stored pin: a parent that points at this product is affected only while current itself is active.
        return component === current.productId && current.active;
      });
      if (!references || parent.id === changedBomId || seen.has(parent.id)) continue;
      seen.add(parent.id);
      const node: BomImpactNode = {
        bomId: parent.id,
        productId: parent.productId,
        distance: current.distance + 1,
        productPath: [...current.path, parent.productId],
        direct: current.distance === 0,
      };
      out.push(node);
      queue.push({ bomId: parent.id, productId: parent.productId, distance: node.distance, path: node.productPath, active: true });
    }
  }
  return out.sort((a, b) => a.distance - b.distance || a.productId.localeCompare(b.productId) || a.bomId.localeCompare(b.bomId));
}

/** Build the next revision by a fixed rule. A user-supplied version number is not accepted. */
export function nextBomVersion(versions: readonly string[]): string {
  let major = 1;
  let minor = -1;
  for (const value of versions) {
    const match = /^V(\d+)\.(\d+)$/.exec(value.trim());
    if (match === null) continue;
    const candidateMajor = Number(match[1]);
    const candidateMinor = Number(match[2]);
    if (candidateMajor > major || (candidateMajor === major && candidateMinor > minor)) {
      major = candidateMajor;
      minor = candidateMinor;
    }
  }
  return `V${major}.${minor + 1}`;
}

/**
 * Copy a parent BOM into a new-version draft. Lines keep business columns only.
 * A cross-document child BOM pin is not written.
 */
export function upgradedBomDraft(
  source: BomImpactSnapshot,
  version: string,
  _generatedByOldBom: ReadonlyMap<string, CreatedIdValue>,
  _changedProductId: string,
  _changedBomPointer: CreatedIdValue,
): { readonly header: PlanRecord; readonly lines: Readonly<Record<string, readonly PlanRecord[]>> } {
  const lines = source.lines.map((line) => {
    const next = { ...line } as Record<string, PlanRecord[string]>;
    // A Planner must not forge platform line columns. The old row's id/lineNo is dropped on create.
    delete next["id"];
    delete next["lineNo"];
    delete next["childBomId"];
    return next;
  });
  return {
    header: {
      productId: source.productId,
      version,
      remark: null,
    },
    lines: { lines },
  };
}
