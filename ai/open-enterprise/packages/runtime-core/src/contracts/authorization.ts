import type {
  EffectTarget,
  ModulePermissionAction,
  ModuleSchema,
  Query,
  SummarySpec,
} from "@open-erp/metamodel";
import type { Identity } from "./identity.js";

/** Minimum authorization port the runtime needs; the server Authorizer satisfies it structurally. */
export interface RuntimeAuthorizer {
  /**
   * Permission catalog. A missing coordinate is a declared result; callers use `byKey.has`
   * to tell "this key was never issued" from "the key name is wrong".
   * `assert` is still a configuration error for a module key that is not in the catalog.
   * Query-surface permissions live in byKey and are grantable coordinates.
   */
  readonly catalog: {
    readonly byKey: { has(key: string): boolean };
  };
  /**
   * Which modules may write which ledger is decided only inside the server `Authorizer`.
   * This port receives an `EffectTarget` that has already been resolved.
   */
  canLedger(identity: Identity, target: EffectTarget): boolean;
  assertLedger(identity: Identity, target: EffectTarget): void;
  assert(identity: Identity, permission: string): void;
  assertModule(identity: Identity, module: string, action: ModulePermissionAction): void;
  assertTransition(identity: Identity, module: string, transition: string): void;
  assertWritePayload(
    identity: Identity,
    module: string,
    header: Readonly<Record<string, unknown>>,
    lines: Readonly<Record<string, readonly Readonly<Record<string, unknown>>[]>> | null,
  ): void;
  assertQuery(
    identity: Identity,
    schema: ModuleSchema,
    query: Query,
    aggregates?: readonly SummarySpec[],
  ): void;
}
