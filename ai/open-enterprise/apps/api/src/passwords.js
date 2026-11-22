import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export function hashPassword(password, salt = randomBytes(16).toString("hex")) {
  const hash = scryptSync(password, salt, 32).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  const [salt, hash] = String(stored).split(":");
  if (!salt || !hash) return false;
  const actual = scryptSync(password, salt, 32);
  const expected = Buffer.from(hash, "hex");
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

export const DEMO_USERS = [
  {
    id: "user-clerk",
    email: "clerk@sample.test",
    name: "Casey Clerk",
    role: "clerk",
    tenantId: "tenant-sample",
    password: "demo-pass",
  },
  {
    id: "user-manager",
    email: "manager@sample.test",
    name: "Morgan Manager",
    role: "manager",
    tenantId: "tenant-sample",
    password: "demo-pass",
  },
];
