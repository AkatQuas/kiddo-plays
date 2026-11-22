// ---------------------------------------------------------------------------
// Fixture domain seal entry — **tests only**
//
// On the production path a domain's identity comes from the directory name:
// the loader derives code from `domains/<code>/`, then injects it with `sealDomain`.
// A fixture has no such path — it is an inline literal, so nobody can infer where
// it "lives", and the identity has to be written in the arguments.
//
// This is not a second path into `defineDomain`: `defineDomain` / `sealDomain` take
// no optional identity argument, and production declarations never get a way to
// write code. The point is that this entry returns a **complete DomainSchema,
// not a draft** — if it were written into domain.ts, the loader's credential check
// would re-run the shape gate on the bare object, and `code` would hit the closed-keys gate.
// ---------------------------------------------------------------------------

import { requireObject, requireText } from "../schema/common.js";
import { defineDomain, sealDomain, type DomainSchema } from "../schema/domain.js";

/**
 * Shape gate plus identity injection, the same pair of functions the loader uses.
 * Replaces `defineDomain({...})` in fixtures.
 *
 * This only pulls `code` out of the declaration; its coordinate shape gate lives
 * in `sealDomain`, the same one the loader uses.
 */
export function defineFixtureDomain(input: unknown, label = "domain"): DomainSchema {
  const { code, ...declaration } = requireObject(input, label);
  return sealDomain(defineDomain(declaration, label), { code: requireText(code, `${label}.code`) });
}
