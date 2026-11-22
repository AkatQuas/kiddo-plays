// ---------------------------------------------------------------------------
// How to name one record — reference candidates, the echo of a stored
// reference, and pivot-report dimension labels share this one copy
// ---------------------------------------------------------------------------

import { schemaFail } from "../schema/common.js";
import { isNumericFieldType } from "../schema/fields.js";
import { isPlatformField, type ModuleSchema } from "../schema/module.js";

/**
 * What a reference dropdown shows.
 *
 * The criterion is declared, not guessed: `primary` is the form's main
 * identifier, and `views.list.columns` is "how the list recognizes this row".
 * Take primary plus the first list column (at most two after dedup, and only
 * columns that exist or can be derived). A customer then shows as
 * "C001 Shanghai Example", not a uuid.
 *
 * Whether a cell is readable is "can this cell's value itself be recognized",
 * not "does it have a column". A `ref` / `refLine` value is the id of another
 * record or another line (a uuid). Dropped into a candidate label, it is
 * exactly the uuid the comment above is trying to keep out. Observed shape:
 * after the first column of `product.views.list.columns` comes `spuId`
 * (ref → product master), so the product cell on a sales-order line shows
 * "SKU-0001 248104d1-e660-4228-ab0e-f07e19a540a8". Customer and warehouse on
 * the same screen only look right because their second column happens to be
 * `name`. Those two modules were not declared better; this filter missed a
 * whole class.
 *
 * Do not resolve one more hop and read the label off the target record.
 * Candidates are already one `select ... limit N`. One more hop is one extra
 * query per candidate (N+1), and it only buys one extra word in the dropdown.
 * To show a related record's name, the target module should declare a `lookup`
 * column in its own `views.list.columns` (computed at query time, projected
 * once). That declaration is also reused by the list page. The criterion stays
 * in the schema; this function does not grow a second copy.
 *
 * A numeric column is not a label either, for the same reason as ref: a label
 * answers "what is this record called", and a number does not. Observed shape:
 * the first column of `processAssignment.views.list.columns` is numeric, so
 * the assignment cell on a labor report shows "PA-20260730-0001 10.000000".
 * That tail is not part of the code and does not identify anything; the user
 * reads it as "the code has a lot of decimal points". Five modules hit this
 * (`productionTask.plannedQty` / `processAssignment.assignedQty` /
 * `processReport.qualifiedQty` / `processAssignment.approvedQualifiedQty` /
 * `defectType.sortOrder`), and this label feeds the candidate dropdown, the
 * echo of a stored value, and import/export, so all three are wrong together.
 *
 * That decimal string has a second cause, and both must be fixed. This
 * function only decides which columns to take. `refOptions` joins the values
 * into text and bypasses `decodeRow` (Postgres `numeric` comes back as
 * `"10.000000"`). After numeric columns are dropped, that path can still see
 * other numbers (a `lineAgg` total stored on a column), so `refOptions` also
 * decodes by `field.type`.
 *
 * Degradation is acceptable: when every list column is a ref or a number, only
 * primary remains (the code / document number). "SKU-0001" is far better than
 * "SKU-0001 248104d1-…" — one fewer word, not the wrong word.
 */
export function labelFieldsOf(schema: ModuleSchema): readonly string[] {
  const candidates: string[] = schema.views.list.referenceLabel === undefined
    ? []
    : [...schema.views.list.referenceLabel];
  if (schema.views.list.referenceLabel === undefined) {
    const primary = schema.fields.find((f) => f.primary);
    if (primary) candidates.push(primary.key);
    for (const key of schema.views.list.columns) {
      if (!candidates.includes(key)) candidates.push(key);
    }
  }
  const usable = candidates.filter((key) => {
    const field = schema.fields.find((f) => f.key === key);
    if (!field) return isPlatformField(key);
    return (
      field.type !== "subtable" &&
      field.type !== "attachment" &&
      // The value is an id, not a name — see the two notes above.
      field.type !== "ref" &&
      field.type !== "refLine" &&
      // A number is not a name: appended to a code, it reads as part of the code.
      !isNumericFieldType(field.type)
    );
  });
  if (!usable.length) {
    schemaFail(`Module "${schema.code}" has neither a primary field nor a displayable list column — a reference dropdown has nothing to show`);
  }
  return schema.views.list.referenceLabel === undefined ? usable.slice(0, 2) : usable;
}

/** The separator for a multi-cell label is `views.list.referenceLabelSeparator`. A space is used when it is not declared. */
export function referenceLabelSeparator(schema: ModuleSchema): string {
  const declared = schema.views.list.referenceLabelSeparator;
  if (declared !== undefined) return declared;
  return " ";
}
