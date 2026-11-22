// ---------------------------------------------------------------------------
// Fixture seal entry — **tests only**
//
// On the production path a module's identity comes from the file path: the loader
// derives code from `modules/<code>.ts` and domain from `domains/<domain>/`, then
// injects them with `sealModule`. A fixture has no such path — it is an inline
// literal, so nobody can infer where it "lives", and the identity has to be
// written in the arguments.
//
// This is not a second path into `defineModule`: `defineModule` / `sealModule`
// take no optional identity argument, and production declarations never get a way
// to write code / domain. The point is that this entry returns a **complete
// ModuleSchema, not a draft** — if it were written into a module file, the
// loader's credential check would re-run the shape gate on the bare object, and
// `creatable` / `code` / `domain` would hit the closed-keys gate on the spot.
// ---------------------------------------------------------------------------

import { requireCoordinateSegment, requireObject, requireText } from "../schema/common.js";
import { normalizeModule, type ModuleSchema } from "../schema/module.js";
import { defineModule, sealModule, type ModuleIdentity } from "./validate.js";

function splitIdentity(
  input: unknown,
  label: string,
): { readonly declaration: Record<string, unknown>; readonly identity: ModuleIdentity } {
  const { code, domain, ...declaration } = requireObject(input, label);
  return {
    declaration,
    identity: {
      code: requireCoordinateSegment(code, `${label}.code`),
      domain: requireText(domain, `${label}.domain`),
    },
  };
}

/**
 * Shape gate plus semantic gate plus identity injection, the same pair of
 * functions the loader uses. Replaces `defineModule({...})` in fixtures.
 */
export function defineFixtureModule(input: unknown, label = "module"): ModuleSchema {
  const { declaration, identity } = splitIdentity(input, label);
  return sealModule(defineModule(declaration), identity);
}

/**
 * Runs only the shape gate and then injects identity, **not the semantic gate**
 * — the same tier as `normalizeModule`.
 *
 * Many fixtures want exactly this tier: they deliberately declare a module that
 * does not hold up semantically, in order to pin one downstream behavior.
 */
export function normalizeFixtureModule(input: unknown, label = "module"): ModuleSchema {
  const { declaration, identity } = splitIdentity(input, label);
  return { ...normalizeModule(declaration, label), ...identity };
}
