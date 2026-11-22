import { createHmac, timingSafeEqual } from "node:crypto";

const MAX_AGE_MS = 12 * 60 * 60 * 1000;

export function issueSession(user, secret, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({
    sub: user.id,
    tenantId: user.tenantId,
    role: user.role,
    exp: now + MAX_AGE_MS,
  })).toString("base64url");
  const sig = sign(payload, secret);
  return `${payload}.${sig}`;
}

export function readSession(token, secret, now = Date.now()) {
  if (!token || !token.includes(".")) return null;
  const [payload, sig] = token.split(".");
  const expected = sign(payload, secret);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  let body;
  try {
    body = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!body?.sub || !body.tenantId || !body.role || !body.exp || body.exp < now) return null;
  return { id: body.sub, tenantId: body.tenantId, role: body.role };
}

export function readCookie(header, name) {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

export function tokensMatch(presented, expected) {
  const a = Buffer.from(String(presented ?? ""));
  const b = Buffer.from(String(expected));
  if (a.length === 0 || a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function sign(payload, secret) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}
