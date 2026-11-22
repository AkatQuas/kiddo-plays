export const ATTACHMENT_KEY_PREFIX = "oe";
const SEGMENT_SHAPE = /^[A-Za-z0-9._-]+$/;

export class AttachmentKeyError extends Error {
  override readonly name = "AttachmentKeyError";
}

export function objectKeySegment(raw: string, what: string): string {
  if (!SEGMENT_SHAPE.test(raw)) {
    throw new AttachmentKeyError(`${what} "${raw}" cannot be one segment of an object key (only letters, digits, and . _ -)`);
  }
  return raw;
}

export function tenantKeyPrefix(tenantId: string): string {
  return `${ATTACHMENT_KEY_PREFIX}/${objectKeySegment(tenantId, "tenant id")}/`;
}

export function isKeyOwnedBy(tenantId: string, key: string): boolean {
  return key.startsWith(tenantKeyPrefix(tenantId));
}

export function assertKeyOwnedBy(tenantId: string, key: string, what: string): void {
  if (!isKeyOwnedBy(tenantId, key)) {
    throw new AttachmentKeyError(`${what}: attachment "${key}" does not belong to the current tenant`);
  }
}
