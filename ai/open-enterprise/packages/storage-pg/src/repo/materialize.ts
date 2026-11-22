import {
  evaluateFormula,
  formulaFields,
  formulaResolverOf,
  NUMERIC_PRECISION,
  roundToScale,
  type Field,
} from "@open-erp/metamodel";

export interface StoredCalculationIssue {
  readonly field: string;
  readonly label: string;
  readonly code: "TYPE_MISMATCH" | "NUMBER_OUT_OF_RANGE";
  readonly message: string;
}

export interface StoredCalculationResult {
  readonly values: Readonly<Record<string, unknown>>;
  readonly issues: readonly StoredCalculationIssue[];
}

/**
 * Materialize `Field.calculate` on the same layer.
 *
 * This is the shared source of truth for repository writes and seed: evaluate in calculate dependency order, round each carrying field
 * once at its own scale, then check the same precision as the table column. An old frozen value is deleted from the input first,
 * so a patch recompute never misreads the old result still in the database.
 */
export function materializeStoredCalculations(
  fields: readonly Field[],
  input: Readonly<Record<string, unknown>>,
): StoredCalculationResult {
  const calculated = fields.filter((field) => field.calculate != null);
  if (calculated.length === 0) return { values: { ...input }, issues: [] };

  const byKey = new Map(calculated.map((field) => [field.key, field]));
  const allByKey = new Map(fields.map((field) => [field.key, field]));
  const ordered: Field[] = [];
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (field: Field): void => {
    if (visited.has(field.key)) return;
    if (visiting.has(field.key)) {
      // Declaration checks should already have rejected a formula cycle; keep a loud failure so the runtime stack does not overflow.
      throw new Error(`Stored calculation field "${field.label}" references itself in a cycle — the declaration did not pass the formula-cycle check.`);
    }
    visiting.add(field.key);
    // calculate can depend on another calculate indirectly through one or more layers of derive.formula.
    // Looking only at the direct key would let the evaluator consume that calculate's unrounded intermediate value inside the recursion.
    const formulaStack = new Set<string>();
    const visitFormulaDependencies = (keys: readonly string[]): void => {
      for (const dependency of keys) {
        const nested = byKey.get(dependency);
        if (nested) {
          visit(nested);
          continue;
        }
        if (formulaStack.has(dependency)) continue;
        const declared = allByKey.get(dependency);
        if (declared?.derive?.kind !== "formula") continue;
        formulaStack.add(dependency);
        visitFormulaDependencies(formulaFields(declared.derive.expr));
        formulaStack.delete(dependency);
      }
    };
    visitFormulaDependencies(formulaFields(field.calculate!));
    visiting.delete(field.key);
    visited.add(field.key);
    ordered.push(field);
  };
  for (const field of calculated) visit(field);

  const values: Record<string, unknown> = { ...input };
  for (const field of calculated) delete values[field.key];
  const issues: StoredCalculationIssue[] = [];
  const resolver = formulaResolverOf(fields);

  for (const field of ordered) {
    if (
      (field.type !== "number" && field.type !== "money" && field.type !== "percent") ||
      field.calculate == null
    ) {
      throw new Error(`Stored calculation field "${field.label}" is not a numeric field — declaration checks should have rejected it first.`);
    }
    try {
      const value = evaluateFormula(field.calculate, values, resolver);
      const rounded = roundToScale(value, field.type, `"${field.label}"`);
      const { precision, scale } = NUMERIC_PRECISION[field.type];
      if (Math.abs(rounded) >= 10 ** (precision - scale)) {
        issues.push({
          field: field.key,
          label: field.label,
          code: "NUMBER_OUT_OF_RANGE",
          message: `"${field.label}" result ${String(rounded)} is outside the range numeric(${String(precision)},${String(scale)}) can store`,
        });
        continue;
      }
      values[field.key] = rounded;
    } catch (error) {
      issues.push({
        field: field.key,
        label: field.label,
        code: "TYPE_MISMATCH",
        message: `"${field.label}" cannot be calculated: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }
  return { values, issues };
}
