/**
 * Human label for a line reference: `Line N`.
 * Returns null when the line number is not an integer; the caller decides whether to throw or omit it.
 */
export function lineLabelOf(row: Readonly<Record<string, unknown>>): string | null {
  const raw = row["lineNo"];
  const lineNo = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
  if (!Number.isInteger(lineNo)) return null;
  return `Line ${String(lineNo)}`;
}
