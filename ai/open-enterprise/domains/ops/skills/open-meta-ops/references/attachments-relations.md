---
name: attachments-relations
description: Attachment text, continued reads of long documents, and document relations.
version: 1.0.3
---

# Attachments and relations

## Attachments

`bill_get` first, for the attachment-cell list (header plus this document's lines, at most 20). `{key, name, size, contentType, uploadedAt}` is a list, not the body. Then `attachment_read(module, id, field, key)` with that `key`. A line attachment field is `<subtable>.<column>`. It uses the same permission gate as reading the document.

Readable: plain text, CSV (UTF-8 or GBK), `.xlsx`, `.docx`, and PDFs that have a text layer. Tables are split on tabs. Multiple sheets are sections headed `# <sheet name>`. Styles and date display formats are not restored.

Not readable: images, scanned or camera PDFs, `.ppt` / `.pptx`, the 97-2003 binary formats, and encrypted or damaged packages. If `text` is `null`, say the system cannot read the body and relay `unreadable.reason` and `advice`. Do not say the attachment is empty. Do not guess the content. Do not retry with different arguments.

When a long document has `truncated=true`, continue with `nextOffset`. `maxChars` may be adjusted. Do not claim the full text was covered until the read finishes.

## Relations

`module_describe(module, section="relations")` first:

- An outgoing edge is already projected as `{to, path}`. Take the target `id` from the current document's `path`, then `bill_get(to, id)`.
- An incoming edge is already projected as `{from, where}`. `bill_list(from)` with `where` equal to the current id.
- A line reference that is not in the result cannot become a `bill_get` or a reverse-lookup condition. Do not invent a path.

Keep `module + billId + relation field` as the evidence path at each step. If any segment has no reference, the conclusion is that the current business facts are not enough to attribute the result. Do not assign it to another cause automatically.
