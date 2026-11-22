// ---------------------------------------------------------------------------
// Fixture flow seal entry — **tests only**
//
// On the production path a flow's identity comes from the file path: the loader
// derives code and domain from `flows/<domain>/<code>.ts`, then injects them with
// `sealFlow`. A fixture has no such path — it is an inline literal, so nobody can
// infer where it "lives", and the identity has to be written in the arguments.
//
// This is not a second path into `defineFlow`: `defineFlow` / `sealFlow` take no
// optional identity argument, and production declarations never get a way to write
// code / domain. The point is that this entry returns a **complete FlowSchema,
// not a draft** — if it were written into a declaration file under flows/, the
// loader's credential check would re-run the shape gate on the bare object, and
// `code` / `domain` would hit the closed-keys gate.
//
// The cross-module semantic gate (`validateFlow`) still does not run here: it
// needs the module catalog and the role catalog, and the caller runs it after
// assembly, in the same order as the loader.
// ---------------------------------------------------------------------------

import { requireObject, requireText } from "../schema/common.js";
import { defineFlow, sealFlow, type FlowSchema } from "../schema/flow.js";

/**
 * Shape gate plus identity injection, the same pair of functions the loader uses.
 * Replaces `defineFlow({...})` in fixtures.
 *
 * This only pulls `code` / `domain` out of the declaration; the kebab shape gate
 * for `code` lives in `sealFlow`, the same one the loader uses.
 */
export function defineFixtureFlow(input: unknown, label = "flow"): FlowSchema {
  const { code, domain, ...declaration } = requireObject(input, label);
  return sealFlow(defineFlow(declaration, label), {
    code: requireText(code, `${label}.code`),
    domain: requireText(domain, `${label}.domain`),
  });
}
