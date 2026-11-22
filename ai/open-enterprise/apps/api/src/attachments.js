import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { httpError } from "./chain.js";

const MAX_BYTES = 1024 * 1024;

export async function saveAttachment(store, actor, dir, input) {
  if (!actor?.id || !actor.tenantId) throw httpError(401, "missing actor");
  const filename = safeName(input?.filename);
  const bytes = decode(input?.contentBase64);
  const id = randomUUID();
  const storageKey = path.join(actor.tenantId, id);
  const absolute = path.resolve(dir, storageKey);
  const root = path.resolve(dir);
  if (!absolute.startsWith(root + path.sep)) throw httpError(400, "storage path escaped the attachment directory");
  await mkdir(path.dirname(absolute), { recursive: true });
  await writeFile(absolute, bytes);
  const record = await store.insertAttachment({
    id,
    tenantId: actor.tenantId,
    filename,
    storageKey,
    byteLength: bytes.length,
    createdBy: actor.id,
  });
  return { id: record.id, filename: record.filename, byteLength: record.byteLength };
}

function safeName(name) {
  const text = String(name ?? "").trim();
  if (!/^[A-Za-z0-9._-]{1,80}$/.test(text)) {
    throw httpError(400, "filename must use letters, numbers, dots, dashes, or underscores");
  }
  return text;
}

function decode(contentBase64) {
  if (typeof contentBase64 !== "string" || contentBase64.length === 0) {
    throw httpError(400, "contentBase64 is required");
  }
  const bytes = Buffer.from(contentBase64, "base64");
  if (bytes.length === 0 || bytes.length > MAX_BYTES) {
    throw httpError(400, "attachment must be between 1 byte and 1 MiB");
  }
  return bytes;
}
