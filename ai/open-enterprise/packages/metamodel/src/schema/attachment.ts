// ---------------------------------------------------------------------------
// attachment value shape — this file is the only source of truth
//
// This used to be a hole: `attachment` compiled to a `jsonb` column, the control
// only collected `File[]`, there was no write path, and the value gate skipped it
// entirely. AGENTS.md said "inventing a shape out of thin air immediately becomes
// a second source of truth; fill this cell in only after the shape is declared" —
// this file is that declaration.
//
// 🔴 Four consumers read this one file. None of them may write its own copy:
//   · table creation   `builder/codegen.ts` compiles attachment to `jsonb` (the value in this file is a JSON array)
//   · value gate       `case "attachment"` in `instance.ts`
//   · outbound / write `server` upload, download, and the write path (object-key ownership, content type, size)
//   · control          frontend attachment upload (for example product images in erp-web); the value shape is still this one
// Writing it in several places fails with zero errors: the control sends shape A,
// the value gate accepts shape B, a legal attachment is judged illegal, or worse —
// an illegal attachment is judged legal and lands as jsonb nobody can read.
//
// ── Why the value itself is an array ───────────────────────────────────────
//
// In the system the business actually uses, three of the four attachment sites
// are naturally many: material images are their own child table (one material,
// many pictures), shop-floor photos taken while reporting work are a set, and
// sales-order attachments are a stack of scanned contracts. Only a spec drawing
// looks like a single file — and "single" is a business convention of that cell,
// not a property of the attachment type.
//
// So "many" is not expressed by opening another line table (that would pull in
// `subtable`, and a line has a line number, a push-down, and a cumulative gate,
// none of which an attachment needs), and not by adding `maxCount` on Field
// (adding a property on Field also has to pass the "foreseeable n" test, and today n=1).
// The value is a list. One file is a list of length 1.
//
// ── Why these five keys ────────────────────────────────────────────────────
//
// The test is "without it, the UI or the server has to guess":
//   key         the key in object storage. Issued by the server. The client never
//               specifies it (see objectKey.ts on the server side: it is also the carrier of tenant isolation)
//   name        the original file name. The object key deliberately omits it (file names
//               contain path separators, non-ASCII, and collide), so without a copy
//               nobody can say what the file was originally called
//   size        byte count. The list has to show it, and a person should know how big it is before download
//   contentType the content type. The canonical value fixed by the allow-list at upload time, not whatever the client says
//   uploadedAt  the upload instant, ISO 8601. The document's `createdAt` cannot answer this cell —
//               a document created in March can have a receipt attached in May
// ---------------------------------------------------------------------------

import { schemaFail } from "./common.js";

/**
 * What one attachment looks like on a document. This is the element shape stored in the jsonb column (the value is an array of these).
 *
 * 🔴 Key order is storage order (`normalizeAttachments` rebuilds the object in this order): jsonb keeps key order,
 * and two values with the same content and a different key order look like two different values in a diff, an audit, and an idempotency fingerprint.
 */
export interface AttachmentRef {
  /** Key in object storage. Issued by the server. The client must not specify it — it is the carrier of tenant isolation */
  readonly key: string;
  /** Original file name, including the extension. The object key does not contain it */
  readonly name: string;
  /** Byte count */
  readonly size: number;
  /** Canonical content type fixed by the allow-list at upload time */
  readonly contentType: string;
  /** Upload instant, ISO 8601 */
  readonly uploadedAt: string;
}

/** Closed keys of an element. One extra key is rejected — silently dropping it would make the caller think it was stored */
export const ATTACHMENT_REF_KEYS = ["key", "name", "size", "contentType", "uploadedAt"] as const;

/**
 * Byte cap for a single file.
 *
 * 🔴 The upload gate reads it, and the control's precheck reads it too. Two copies
 * show up as the control allowing it and the server rejecting it, after the user waited 30 seconds to be told "too big".
 *
 * 20 MiB is the basis: an ERP attachment is a scanned contract, a shop-floor photo, or a spec drawing, not a video.
 * It is also the memory budget of the same-origin proxy download path (see the server attachments route).
 */
export const ATTACHMENT_MAX_BYTES = 20 * 1024 * 1024;

/**
 * How many files one attachment cell may hold.
 *
 * 🔴 The value gate must have this bound. It is not fussiness: the value comes from
 * a browser and a model. An array of a hundred thousand refs is jsonb nobody can open
 * plus a parse that blows memory, and it violates no single element's shape.
 * The number is wide (a stack of thirty to fifty scanned contract pages is real). The point is that it is bounded.
 */
export const ATTACHMENT_MAX_COUNT = 50;

/**
 * Allowed content types → canonical value and whether it may be rendered inline.
 *
 * 🔴 The allow-list is not a block-list: the default is reject. The same-origin proxy
 * returns the bytes to the browser with the original type. An open list is a stored XSS —
 * upload an `.html`, and downloading it executes a script on the ERP's own origin.
 *
 * 🔴 `image/svg+xml` is deliberately absent. SVG is a document that can carry `<script>`.
 * It looks like an image, people put it in `<img>` and in the "safe to inline" column,
 * and the whole point of that column is "the browser may render it directly". Convert vector art to PNG.
 *
 * `inline` = send `Content-Disposition: inline` on download, so `<img src>` can display it.
 * Everything else is `attachment` (save as). Together with `nosniff`, the browser will not execute it as a document.
 */
export const ATTACHMENT_CONTENT_TYPES: Readonly<Record<string, { readonly inline: boolean }>> = Object.freeze({
  "image/png": { inline: true },
  "image/jpeg": { inline: true },
  "image/gif": { inline: true },
  "image/webp": { inline: true },
  "application/pdf": { inline: false },
  "text/plain": { inline: false },
  "text/csv": { inline: false },
  "application/zip": { inline: false },
  "application/msword": { inline: false },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": { inline: false },
  "application/vnd.ms-excel": { inline: false },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": { inline: false },
  "application/vnd.ms-powerpoint": { inline: false },
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": { inline: false },
});

/**
 * Client-reported content type → the canonical value on the allow-list. Returns `null` when it is not on the list.
 *
 * Parameters and a charset suffix (`text/plain; charset=utf-8`) are stripped before the comparison:
 * browsers send them, and comparing the whole string shows up as "uploading txt was rejected" with a reason that cannot say why.
 */
export function canonicalAttachmentContentType(raw: string): string | null {
  const base = raw.split(";")[0]?.trim().toLowerCase() ?? "";
  return Object.hasOwn(ATTACHMENT_CONTENT_TYPES, base) ? base : null;
}

/**
 * Whether the browser may render this type directly (`Content-Disposition: inline`).
 *
 * 🔴 An unknown type is always `false`. "Inline it because we do not recognize it" is exactly what this allow-list blocks.
 */
export function isInlineSafeContentType(contentType: string): boolean {
  return ATTACHMENT_CONTENT_TYPES[contentType]?.inline === true;
}

/** How to read a value whose shape does not hold. One sentence, for a person. The value gate shows it as-is. */
export type AttachmentCheck =
  | { readonly ok: true; readonly value: readonly AttachmentRef[] }
  | { readonly ok: false; readonly reason: string };

/**
 * Closed character set of an object key. A key the server issues looks like `oe/<tenant>/<module>/<field>/<uuid>`.
 *
 * 🔴 An allow-list, not a block-list: the key is spliced into an OBS URL and into this service's response headers.
 * "Allow everything except these bad characters" misses one and that miss is an injection surface, with no symptom.
 */
const ATTACHMENT_KEY_SHAPE = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;

const MIME_SHAPE = /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/;

function refReason(index: number, what: string): string {
  return `attachment ${String(index + 1)} ${what}`;
}

/**
 * Check and normalize one attachment cell. Zero IO, a pure function — it cannot
 * decide "is this object really in the bucket?". That hop is on the server side
 * (the same way `refSitesOf` cannot decide "does the referenced record exist?").
 *
 * 🔴 This does not check whether the content type is on the allow-list, and it does
 * not check whether a single file exceeds `ATTACHMENT_MAX_BYTES`. Those two gates
 * belong to the upload entrance (see the server attachments route), not to the value shape.
 * Checking them here has a concrete cost: the day the allow-list narrows by one entry,
 * a batch of existing documents is judged illegal on the next save, and the user changed nothing.
 * Narrowing an upload rule must not make a fact already in the database illegal.
 * The count bound is the exception — it is a bound of this jsonb cell itself, not a rule of one upload.
 */
export function checkAttachmentValue(raw: unknown): AttachmentCheck {
  if (!Array.isArray(raw)) {
    return { ok: false, reason: `expected a set of attachments (an array), got ${raw === null ? "null" : typeof raw}` };
  }
  if (raw.length > ATTACHMENT_MAX_COUNT) {
    return { ok: false, reason: `at most ${String(ATTACHMENT_MAX_COUNT)} attachments, got ${String(raw.length)}` };
  }

  const out: AttachmentRef[] = [];
  const seen = new Set<string>();
  for (const [index, item] of raw.entries()) {
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      return { ok: false, reason: refReason(index, `is not an attachment record (got ${typeof item})`) };
    }
    const row = item as Record<string, unknown>;
    const extra = Object.keys(row).filter((k) => !(ATTACHMENT_REF_KEYS as readonly string[]).includes(k));
    if (extra.length) {
      // Silently dropping it would make the caller think it was stored — same criterion as the closed-key gate in `readBody`
      return { ok: false, reason: refReason(index, `has extra keys "${extra.join(", ")}"`) };
    }

    const key = row["key"];
    if (typeof key !== "string" || key.trim() === "") {
      return { ok: false, reason: refReason(index, "is missing the object key (key)") };
    }
    // Which tenant it belongs to is decided by the server (the kernel has no identity). Here only the shape is pinned: a closed character set, and no `..`.
    // Path traversal, a leading slash, whitespace, and control characters let the key escape the tenant prefix or inject into a downstream request header,
    // while the assembled request looks completely normal. An allow-list, not a block-list, for the same reason as the content type.
    if (!ATTACHMENT_KEY_SHAPE.test(key) || key.includes("..")) {
      return { ok: false, reason: refReason(index, `has an illegal object key: "${key}"`) };
    }
    if (seen.has(key)) {
      // The same key twice means the same file is listed twice. The UI action that deletes one of them then means nothing.
      return { ok: false, reason: refReason(index, `repeats an earlier object key: "${key}"`) };
    }
    seen.add(key);

    const name = row["name"];
    if (typeof name !== "string" || name.trim() === "") {
      return { ok: false, reason: refReason(index, "is missing the file name (name)") };
    }

    const size = row["size"];
    if (typeof size !== "number" || !Number.isSafeInteger(size) || size < 0) {
      return { ok: false, reason: refReason(index, `size is not a non-negative integer byte count (got ${JSON.stringify(size)})`) };
    }

    const contentType = row["contentType"];
    if (typeof contentType !== "string" || !MIME_SHAPE.test(contentType)) {
      return {
        ok: false,
        reason: refReason(index, `content type is not a legal MIME type (got ${JSON.stringify(contentType)})`),
      };
    }

    const uploadedAt = row["uploadedAt"];
    if (typeof uploadedAt !== "string" || !Number.isFinite(Date.parse(uploadedAt))) {
      return {
        ok: false,
        reason: refReason(index, `upload time is not a parseable timestamp (got ${JSON.stringify(uploadedAt)})`),
      };
    }

    // 🔴 Rebuild in ATTACHMENT_REF_KEYS order. Do not accept `row` as-is:
    // jsonb keeps key order, and accepting it as-is would store the same content as two values because the client ordered the keys differently.
    out.push({ key: key.trim(), name: name.trim(), size, contentType, uploadedAt });
  }
  return { ok: true, value: out };
}

/**
 * Read an attachment value that is already stored. If it cannot be read, throw — do not degrade to an empty array.
 *
 * Shared by the outbound projection, the control, and the server download route. Degrading to empty
 * shows up as "this document has no attachments", while it actually has a dirty jsonb cell nobody can read. The gap has to be visible.
 */
export function attachmentsOf(raw: unknown, label: string): readonly AttachmentRef[] {
  if (raw === null || raw === undefined || raw === "") return [];
  const checked = checkAttachmentValue(raw);
  if (!checked.ok) schemaFail(`attachment value of "${label}" does not hold: ${checked.reason}`);
  return checked.value;
}

/** A file size in words. The list, the read-only form, and the control share this one. Do not write another. */
export function formatAttachmentSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) schemaFail(`attachment size is not a non-negative number: ${String(bytes)}`);
  if (bytes < 1024) return `${String(bytes)} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(kb < 10 ? 1 : 0)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(mb < 10 ? 1 : 0)} MB`;
}
