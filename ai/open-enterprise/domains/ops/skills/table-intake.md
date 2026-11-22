---
name: table-intake
description: A rectangular table uploaded in chat. Read the catalog and sample, confirm the column map, then one table_commit creates master records. Not order entry. Not import.
version: 1.0.1
triggerWords: [upload a customer table, create records from this sheet, enter customers from a table, bulk create records, create records from a spreadsheet]
---

# Create master records from a column map

One job only: **one rectangular table becomes new headers of one module**. Not a card, not header plus lines, not upsert, and not "split one contract into many sales orders". Order entry stays on `order-intake`.

A file just uploaded in chat is marked `[File ready]` on the user message. A sheet catalog, worksheet, headers, or a sample means this skill. **Do not** call `attachment_read`. **Do not** hand-write `bill_create`. **Do not** call `POST /api/:module/import`.

## Order

1. The injection already has each sheet's headers, row count, and the first 3 to 5 rows. `complete: true` on a small table means the sample covers the sheet.
2. Other rows use `table_preview`: `op=catalog` for the catalog; `op=page` names a sheet and takes one page (`limit` at most 20, one page per call). The caller attaches the original. Do not invent file contents.
3. **Decide the map, then write.** Three grades. Do not weigh them yourself:
   - **Exact**: the column name matches the field's declared label character for character, and the column is not forbidden. It may be written.
   - **Near** (phone vs mobile, name vs customer name): ask once and **end this turn**. Emit one `open-ask` (`mode:"clarify"`, each option has a self-contained `send`). After the card, **send no more tool calls**.
     Do not call the names `ask_user` or `function_call`. They are not on this agent's tool list. The result is `unknown_tool`, and the user never sees a question. The turn ends because you stop calling tools.
   - **Forbidden or no field**: drop it. Do not map it. Forbidden columns include system-supplied values, `code` / customer code, and attachments.
4. After the user confirms the map, call `table_commit` **once**: `module`, the confirmed `mapping` (column name to field key), and `sheet`. Do not call it again with the same arguments.
5. Answer from the receipt: `created`, `failed`, `total`. The failure summary is capped at 20. The write is not atomic. A failed row does not roll back rows already created.
6. The write side rejects a duplicate name inside the tenant (a `unique` field; for customers that field is `name`). That row is in `failed`, and the text says the value already exists and asks for it to be entered again. Do not treat it as success. Do not call `table_commit` again or fall back to `bill_create`. Report the numbers as returned.

## Do not

- Do not write a second sheet that is outside this module family. Write only the named sheet.
- Do not stuff a dropped column into remarks or another field so the row "looks complete".
- Do not use the import API, `batch/create`, or `bill_create` per row.
- `table_preview` has no filter. To write a row range, use `offset` and `limit` on `table_commit` (maximum 500; over the cap is an error, not a silent trim).
