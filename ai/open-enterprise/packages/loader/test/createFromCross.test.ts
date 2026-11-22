import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { checkCrossReferences, loadCatalog, type Catalog } from "../src/index.js";
import { batchActions as productionOrderBatchActions } from "../../../domains/production/modules/productionOrder/index.js";

const releaseDraftLineField = productionOrderBatchActions["releaseProduction"]!.lineField;

const DOMAINS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../domains");
const loaded = await loadCatalog({ domainsRoot: DOMAINS });

function withReleaseSource(
  source: string,
  sourceRemaining: { readonly header: string | null; readonly line: string } | null = null,
): Catalog {
  const sourceModule = loaded.modules.get("productionOrder");
  if (!sourceModule) throw new Error("the test catalog has no productionOrder");
  const code = sourceModule.schema.fields.find((field) => field.key === "code");
  if (code === undefined) throw new Error("productionOrder has no code");
  const fields = [code, releaseDraftLineField].map((field) =>
    field.key !== "lines"
      ? field
      : {
          ...field,
          fields: field.fields === null
            ? null
            : field.fields.map((column) =>
                column.key === "sourceOrderLineId" ? { ...column, ref: source } : column),
        });
  const modules = new Map(loaded.modules);
  modules.set("productionRelease", {
    ...sourceModule,
    code: "productionRelease",
    schema: {
      ...sourceModule.schema,
      code: "productionRelease",
      label: "production release test fixture",
      fields,
      views: {
        ...sourceModule.schema.views,
        createFrom: [{ path: "lines.sourceOrderLineId", label: null, sourceStatuses: null, sourceRemaining }],
      },
    },
  });
  return { ...loaded, modules };
}

describe("the cross-module gate for views.createFrom", () => {
  it("a field ref that points at a source inside the catalog passes the createFrom check", () => {
    const errors = checkCrossReferences(withReleaseSource("productionOrder"));
    expect(errors.filter((error) => error.path.startsWith("views.createFrom"))).toEqual([]);
  });

  it("a line-only sourceRemaining does not require the source module to have a header balance field", () => {
    const errors = checkCrossReferences(withReleaseSource(
      "productionOrder",
      { header: null, line: "lines.pendingReleaseQty" },
    ));
    expect(errors.filter((error) => error.path.startsWith("views.createFrom"))).toEqual([]);
  });

  it("when the source module does not exist the error is pinned on createFrom.path, and the entry is not silently discovered as empty", () => {
    const errors = checkCrossReferences(withReleaseSource("missingOrder"));
    expect(errors).toEqual(expect.arrayContaining([
      expect.objectContaining({
        module: "productionRelease",
        path: "views.createFrom[0].path",
        message: expect.stringContaining("missingOrder"),
      }),
    ]));
  });
});
