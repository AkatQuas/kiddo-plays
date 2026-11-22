---
name: query-analysis
description: Lists, aggregates, relative time, ledgers, and name resolution.
version: 1.2.2
---

# Query and analysis

## Name resolution

Users give a name or a document number. Write APIs usually want an `id`:

1. `ops_search` for "query + target", or `bill_list` with `search` / `where`.
2. If the field is uncertain, `module_describe(section="query")` for the field and comparator index. Fetch a field detail only when an enum, dictionary, or reference value must be built. `ops_describe` is for an operation already chosen. Do not read it again as a field index.
3. Use an `id` only on a unique hit. Several rows with the same name: list the business-name differences and let the user choose. Zero rows: stop. Do not guess the first row.

## Lists and one document

- `bill_list` filters and sorts live in `query` (`where`, `search`, `sort`). Paging uses top-level `limit` and `offset`.
- Listing records, a few raw columns, or a check: `bill_list` + `fields` + `nextOffset`. Not `analysis_sql`.
- A non-null `nextOffset` means another page exists. Continue only if the question needs more rows. On continue, change only the returned offset. Do not reload the skill or reread the old page. If the user wants only the count, use `total`. Do not page through lines for completeness.
- The count is `total`. Each row's `module` and `id` are how a card opens the record. Do not drop them or rewrite them from prose.
- `bill_get` returns the header, this document's lines (at most 20), and the operations available now. Do not add buttons from history or habit.
- Cross-document line filters, ranks, and weights use `analysis_sql`. Do not invert lines just to see one document.

## Groups and relative time

- Aggregates use `analysis_sql`: read-only `SELECT` or `WITH`. Tables and columns come from `module_describe(section=analysis)`. Bind parameters as `$1..$n`.
- A literal `LIMIT` is required (maximum 20). Sort and truncation are SQL `ORDER BY`, `LIMIT`, and `HAVING`. Do not rank a page of rows in the model.
- Sales by customer, or a sales ranking: `INNER JOIN oe_customer` for `c.name`, `SUM(h.total_amount)`, `GROUP BY c.id, c.name`, `ORDER BY sales DESC LIMIT 20`. No `LEFT JOIN`. Do not write the derived column `customerName`. Customers with zero sales are not in the ranking. "How are sales this month" is still `insight_brief(sales_month)`. "Who is owed the most" is still `sales_receivable`.
- Prefer `current_date`, `date_trunc`, and `date(...)`. Do not replace a relative definition with a hardcoded absolute date.
- When `truncated=true`, say "top N groups" or "the part returned so far".
- An unaggregated `SELECT *` is rejected. Line dumps use `bill_list`.

## Ledgers

Balances use `ledger_query`. Do not guess them from document fields. A net amount uses `fn=net` (reserve positive, release negative). Do not `sum` amounts that were reserved and later released.

## Stop

A read rejected for a schema or contract error allows one targeted `module_describe`. If that fails, report the capability gap. Any 401 or 403 stops. Do not probe with another tool.
