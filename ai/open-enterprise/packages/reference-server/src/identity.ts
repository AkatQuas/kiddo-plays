import { ALL_DATA_SCOPE } from "@open-erp/metamodel";
import type { Catalog } from "@open-erp/loader";
import type { Identity } from "@open-erp/runtime-core";

const DEFAULT_TENANT = "reference-tenant";
const DEFAULT_ORG = "reference-org";
const DEFAULT_USER = "reference-user";

export function referenceIdentity(catalog: Catalog, overrides?: Partial<Pick<Identity, "tenantId" | "orgId" | "userId">>): Identity {
  const tenantId = overrides?.tenantId?.trim() || process.env["OE_REFERENCE_TENANT_ID"]?.trim() || DEFAULT_TENANT;
  const orgId = overrides?.orgId?.trim() || process.env["OE_REFERENCE_ORG_ID"]?.trim() || DEFAULT_ORG;
  const userId = overrides?.userId?.trim() || process.env["OE_REFERENCE_USER_ID"]?.trim() || DEFAULT_USER;
  const dataScopes: Identity["dataScopes"] = {};
  for (const code of catalog.modules.keys()) dataScopes[code] = ALL_DATA_SCOPE;
  const stamp = new Date().toISOString();
  return {
    tenantId,
    orgId,
    userId,
    identify: "1",
    agentId: null,
    roles: [{ code: "reference-admin", name: "Reference admin" }],
    permissions: ["*"],
    dataScopes,
    authorization: {
      applicationId: "open-erp",
      policyVersion: "reference",
      catalogDigest: "reference",
      decisionId: "reference",
      issuedAt: stamp,
      expiresAt: "2099-01-01T00:00:00.000Z",
    },
  };
}