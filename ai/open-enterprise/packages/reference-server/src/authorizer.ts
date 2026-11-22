import type { ModulePermissionAction, ModuleSchema, Query, SummarySpec } from "@open-erp/metamodel";
import type { Identity, RuntimeAuthorizer } from "@open-erp/runtime-core";

/** Demo authorizer: every caller may read/write every module and ledger. Not for production. */
export const referenceAuthorizer: RuntimeAuthorizer = {
  catalog: { byKey: { has: () => true } },
  canLedger: () => true,
  assertLedger: () => undefined,
  assert: () => undefined,
  assertModule: (_identity: Identity, _module: string, _action: ModulePermissionAction) => undefined,
  assertTransition: () => undefined,
  assertWritePayload: () => undefined,
  assertQuery: (
    _identity: Identity,
    _schema: ModuleSchema,
    _query: Query,
    _aggregates?: readonly SummarySpec[],
  ) => undefined,
};