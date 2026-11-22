import { createHash } from "node:crypto";

/** The warn text can be hidden by field permissions; confirmation sends this opaque token, not a boolean. */
export function warningConfirmationToken(message: string): string {
  return `warning:${createHash("sha256").update(message, "utf8").digest("hex")}`;
}
