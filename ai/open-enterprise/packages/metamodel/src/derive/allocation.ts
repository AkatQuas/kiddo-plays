// ---------------------------------------------------------------------------
// Quantity allocation — several people split one total, and the split must add back up
//
// This is not a seventh concept, and it is not a key derived from a module
// declaration. It lives in derive/ because it is a pure function, zero IO, and
// it shares precision with `roundToScale`. If dispatch and reporting each wrote
// their own division, preview and the stored fact would differ by one decimal
// place and neither side would report an error.
//
// This is not the allocation lines named `allocations` on a document. Here,
// "100 units go to three people."
// ---------------------------------------------------------------------------

import { roundToScale } from "../schema/fields.js";

export const ALLOCATION_METHODS = ["Split evenly", "Split in sequence", "Split freely"] as const;
export type AllocationMethod = (typeof ALLOCATION_METHODS)[number];

export interface AllocationInput {
  readonly workerId: string;
  /** Capacity for this person under sequential split; the decided quantity under a free split. */
  readonly baseQty?: number | null;
}

export interface AllocationResult {
  readonly workerId: string;
  readonly baseQty: number;
}

function quantity(value: unknown, label: string, allowZero = false): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${label} must be a finite number`);
  const normalized = roundToScale(value, "number", label);
  if (allowZero ? normalized < 0 : normalized <= 0) {
    throw new Error(`${label} must be ${allowZero ? "not less than" : "greater than"} 0`);
  }
  return normalized;
}

function normalizedInputs(rows: readonly AllocationInput[]): readonly AllocationInput[] {
  if (rows.length === 0) throw new Error("Assignees cannot be empty");
  const seen = new Set<string>();
  return rows.map((row, index) => {
    const workerId = row.workerId.trim();
    if (!workerId) throw new Error(`Row ${String(index + 1)} assignee cannot be empty`);
    if (seen.has(workerId)) throw new Error(`The same allocation cannot select assignee "${workerId}" more than once`);
    seen.add(workerId);
    return { workerId, baseQty: row.baseQty ?? null };
  });
}

/**
 * The only pure function for allocating a base-unit quantity.
 *
 * Every intermediate value is normalized to the 6-decimal scale of `number`.
 * Even split and hours-by-quantity both let the last share absorb the remainder,
 * so the rows sum to the input exactly and floating-point error does not enter
 * dispatch or reporting facts.
 */
export function allocateBaseQuantity(
  total: number,
  method: AllocationMethod,
  rawRows: readonly AllocationInput[],
): readonly AllocationResult[] {
  const normalizedTotal = quantity(total, "base quantity to allocate");
  const rows = normalizedInputs(rawRows);

  if (method === "Split evenly") {
    const average = roundToScale(normalizedTotal / rows.length, "number", "even split quantity");
    let allocated = 0;
    return rows.map((row, index) => {
      const baseQty = index === rows.length - 1
        ? roundToScale(normalizedTotal - allocated, "number", "even split remainder")
        : average;
      if (baseQty < 0) throw new Error("Even split precision is insufficient; the last quantity cannot be negative");
      allocated = roundToScale(allocated + baseQty, "number", "even split running total");
      return { workerId: row.workerId, baseQty };
    }).filter((row) => row.baseQty > 0);
  }

  if (method === "Split in sequence") {
    let remaining = normalizedTotal;
    const out: AllocationResult[] = [];
    for (const [index, row] of rows.entries()) {
      const capacity = quantity(row.baseQty, `row ${String(index + 1)} capacity`, true);
      const baseQty = Math.min(capacity, remaining);
      if (baseQty > 0) out.push({ workerId: row.workerId, baseQty });
      remaining = roundToScale(remaining - baseQty, "number", "sequential split remaining quantity");
    }
    if (remaining > 0) throw new Error(`Sequential split assignee capacity is insufficient; ${String(remaining)} remains unallocated`);
    return out;
  }

  if (method === "Split freely") {
    const out = rows.map((row, index) => ({
      workerId: row.workerId,
      baseQty: quantity(row.baseQty, `row ${String(index + 1)} free-split quantity`),
    }));
    const sum = out.reduce(
      (totalQty, row) => roundToScale(totalQty + row.baseQty, "number", "free split running total"),
      0,
    );
    if (sum !== normalizedTotal) {
      throw new Error(`Free split total ${String(sum)} must equal the quantity to allocate ${String(normalizedTotal)}`);
    }
    return out;
  }

  throw new Error(`Unknown allocation method "${String(method)}"`);
}

/** Apportion hours by weight; the last share absorbs the precision remainder. */
export function allocateHoursByQuantity(
  hours: number | null | undefined,
  quantities: readonly number[],
): readonly number[] {
  if (hours === null || hours === undefined) return quantities.map(() => 0);
  const totalHours = quantity(hours, "hours", true);
  const totalQty = quantities.reduce(
    (sum, value, index) => roundToScale(sum + quantity(value, `row ${String(index + 1)} quantity`, true), "number", "quantity total"),
    0,
  );
  if (quantities.length === 0) return [];
  if (totalQty === 0) {
    if (totalHours > 0) throw new Error("Cannot apportion positive hours when the reported quantity is 0");
    return quantities.map(() => 0);
  }
  let allocated = 0;
  return quantities.map((value, index) => {
    const share = index === quantities.length - 1
      ? roundToScale(totalHours - allocated, "number", "hours remainder")
      : roundToScale(totalHours * value / totalQty, "number", "hours share");
    allocated = roundToScale(allocated + share, "number", "hours running total");
    return share;
  });
}
