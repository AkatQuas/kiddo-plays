// @vitest-environment jsdom
// catalog. Jsdom skips firmCatalog.setup.
import { describe, expect, it } from "vitest";
import {
  bindPivotModules,
  defineFixtureModule,
  defineSurfaces,
  isDefinedSurfaces,
  normalizeSurfaceParams,
  surfaceNavCode,
} from "../src/index.js";

const stockQuery = {
  label: "Inventory report",
  permission: "system:stockQuery:read",
  path: "/_stock-query",
  params: [
    { key: "mode", label: "Mode", type: "enum", options: [
      { value: "byWarehouse", label: "By warehouse" },
      { value: "crossWarehouse", label: "Total stock" },
    ] },
    { key: "page", label: "Page", type: "integer" },
    { key: "active", label: "Enabled", type: "boolean" },
  ],
  columns: [{ key: "productCode", label: "Product number", type: "string" }],
  sql: "SELECT p.code AS product_code FROM {{table:product}} p LIMIT {{param:pageSize}} OFFSET {{offset}}",
};

describe("defineSurfaces", () => {
  it("only recipients passing through the entrance", () => {
    const surfaces = defineSurfaces({ stockQuery });
    expect(isDefinedSurfaces(surfaces)).toBe(true);
    expect(surfaces["stockQuery"]?.label).toBe("Inventory report");
    expect(surfaces["stockQuery"]?.params[0]?.required).toBe(false);
    expect(surfaceNavCode("/_stock-query")).toBe("stock-query");
  });

  it("empty watch, unknown key, illegal access, failure to deliver module or desk account denied", () => {
    expect(() => defineSurfaces({})).toThrow(/must not be empty/);
    expect(() => defineSurfaces({ stockQuery: { ...stockQuery, extra: 1 } })).toThrow(/unknown key/);
    expect(() => defineSurfaces({ stockQuery: { ...stockQuery, permission: "module:product:read" } }))
      .toThrow(/is not a system permission key/);
    expect(() => defineSurfaces({ stockQuery: { ...stockQuery, reads: { modules: ["product"], ledgers: [] } } }))
      .toThrow(/unknown key/);
    expect(() => defineSurfaces({
      stockQuery: {
        ...stockQuery,
        sql: "SELECT 1 AS n LIMIT {{param:pageSize}} OFFSET {{offset}}",
      },
    })).toThrow(/derives neither a module nor a ledger/);
  });

  it("mission only system: <name>: <action> shape, no more against closed directories", () => {
    expect(() => defineSurfaces({ stockQuery: { ...stockQuery, permission: "module:product:read" } }))
      .toThrow(/is not a system permission key/);
    expect(() => defineSurfaces({ stockQuery: { ...stockQuery, permission: "system:lookup-demo:read" } }))
      .toThrow(/is not a system permission key/);
    expect(defineSurfaces({ stockQuery: { ...stockQuery, permission: "system:lookupDemo:read" } })["stockQuery"]?.permission)
      .toBe("system:lookupDemo:read");
    expect(() => defineSurfaces({
      lookupDemo: { ...stockQuery, permission: "system:foo:READ", path: "/_lookup-demo" },
    })).toThrow(/is not a system permission key/);
    expect(defineSurfaces({
      lookupDemo: {
        ...stockQuery,
        permission: "system:lookupDemo:read",
        path: "/_lookup-demo",
      },
    })["lookupDemo"]?.permission).toBe("system:lookupDemo:read");
    expect(defineSurfaces({
      productArchive: {
        ...stockQuery,
        permission: "system:productArchive:read",
        path: "/_product-archive",
      },
    })["productArchive"]?.permission).toBe("system:productArchive:read");
  });

  it("path must be / kebab; enum must take options", () => {
    expect(() => defineSurfaces({ stockQuery: { ...stockQuery, path: "/stock-query" } }))
      .toThrow(/is not a legal framework page path/);
    expect(() => defineSurfaces({
      stockQuery: { ...stockQuery, params: [{ key: "mode", label: "Mode", type: "enum" }] },
    })).toThrow(/type=enum must declare options/);
  });

  it("column type accepted ModeuleLabel, unknown type rejected", () => {
    expect(defineSurfaces({
      stockQuery: {
        ...stockQuery,
        columns: [{ key: "sourceModuleLabel", label: "Source", type: "moduleLabel" }],
      },
    })["stockQuery"]?.columns[0]?.type).toBe("moduleLabel");
    expect(() => defineSurfaces({
      stockQuery: {
        ...stockQuery,
        columns: [{ key: "sourceModuleLabel", label: "Source", type: "moduleName" }],
      },
    })).toThrow(/unknown/);
  });

  it("choice columns must be accompanied by choiceset, other types prohibited And...", () => {
    expect(defineSurfaces({
      stockQuery: {
        ...stockQuery,
        columns: [{ key: "mainUnit", label: "Main unit", type: "choice", choiceSet: "inventory.unit" }],
      },
    })["stockQuery"]?.columns[0]).toEqual({
      key: "mainUnit",
      label: "Main unit",
      type: "choice",
      choiceSet: "inventory.unit",
    });
    expect(defineSurfaces({
      stockQuery: {
        ...stockQuery,
        columns: [{ key: "productCode", label: "Product number", type: "string" }],
      },
    })["stockQuery"]?.columns[0]?.choiceSet).toBeNull();
    expect(() => defineSurfaces({
      stockQuery: {
        ...stockQuery,
        columns: [{ key: "mainUnit", label: "Main unit", type: "choice" }],
      },
    })).toThrow(/type=choice must declare choiceSet/);
    expect(() => defineSurfaces({
      stockQuery: {
        ...stockQuery,
        columns: [{ key: "productCode", label: "Product number", type: "string", choiceSet: "inventory.unit" }],
      },
    })).toThrow(/only choice may declare choiceSet/);
  });

  it("reads from sql /modes / extras placeholders, first appearance order", () => {
    expect(defineSurfaces({ stockQuery })["stockQuery"]?.reads).toEqual({
      modules: ["product"],
      ledgers: [],
    });
    const withModes = defineSurfaces({
      stockQuery: {
        ...stockQuery,
        sql: undefined,
        modes: {
          byWarehouse: "SELECT p.code FROM {{table:product}} p JOIN {{table:warehouse}} w ON true LIMIT {{param:pageSize}} OFFSET {{offset}}",
          crossWarehouse: "SELECT p.code FROM {{table:product}} p LIMIT {{param:pageSize}} OFFSET {{offset}}",
        },
      },
    });
    expect(withModes["stockQuery"]?.reads.modules).toEqual(["product", "warehouse"]);
    const withExtra = defineSurfaces({
      stockQuery: {
        ...stockQuery,
        extras: {
          warehouseOptions: {
            kind: "sql",
            sql: "SELECT w.id FROM {{table:warehouse}} w",
          },
        },
      },
    });
    expect(withExtra["stockQuery"]?.reads.modules).toEqual(["product", "warehouse"]);
    expect(withExtra["stockQuery"]?.extras["warehouseOptions"]).toEqual({
      kind: "sql",
      sql: "SELECT w.id FROM {{table:warehouse}} w",
    });
    expect(() => defineSurfaces({
      stockQuery: { ...stockQuery, extras: { src: { kind: "sourceModule" } } },
    })).toThrow(/sourceModule/);
  });
});

describe("normalizeSurfaceParams", () => {
  const surfaces = defineSurfaces({ stockQuery });
  const params = surfaces["stockQuery"]?.params ?? [];

  it("empty string when not given, string bul/ integer received, unknown key denied", () => {
    expect(normalizeSurfaceParams(params, { mode: ["byWarehouse"], page: ["2"], active: ["1"] }, "q"))
      .toEqual({ mode: "byWarehouse", page: 2, active: true });
    expect(normalizeSurfaceParams(params, { mode: [""], page: [] }, "q")).toEqual({});
    expect(() => normalizeSurfaceParams(params, { unknown: ["x"] }, "q")).toThrow(/unknown parameters/);
    expect(() => normalizeSurfaceParams(params, { mode: ["all"] }, "q")).toThrow(/unknown/);
    expect(() => normalizeSurfaceParams(params, { page: ["1", "2"] }, "q")).toThrow(/cannot be given more than one value/);
  });
});

describe("pivot vulnerable gate", () => {
  const pivotBase = {
    facts: [{
      module: "salesOrder",
      status: ["inProgress"],
      dateField: "createdAt",
      measures: { qty: { field: "qty" } },
    }],
    measures: {
      qty: { label: "Count", format: "integer", expr: { kind: "sum", of: "qty" } },
    },
    maxRangeDays: 7,
    requiredRowDims: [],
  };

  function definePivotSurface(
    dimensions: Record<string, unknown>,
    defaultRowDims: string[],
  ) {
    return defineSurfaces({
      gate: {
        label: "Gate",
        permission: "system:gate:read",
        path: "/_gate",
        pivot: { ...pivotBase, dimensions, defaultRowDims, requiredRowDims: [] },
      },
    });
  }

  it("file: dateRange and file: papers rejected", () => {
    expect(() => definePivotSurface({
      promiseDate: {
        label: "Delivery date",
        on: "header",
        field: "promiseDate",
        filterable: false,
        filter: "dateRange",
      },
    }, ["promiseDate"])).toThrow(/filterable must be true/);
  });

  it("butt: pastDue and free: papers rejected", () => {
    expect(() => definePivotSurface({
      overdue: {
        label: "Overdue status",
        on: "header",
        field: "promiseDate",
        filterable: false,
        bucket: "pastDue",
        options: { past: "Overdue", notPast: "inProgress" },
      },
    }, ["overdue"])).toThrow(/filterable must be true/);
  });

  it("attr key conflict with dimension key rejection", () => {
    expect(() => definePivotSurface({
      customer: { label: "Customer", path: ["customerId"], filterable: false },
      product: {
        label: "Product",
        path: ["productId"],
        filterable: false,
        attrs: { customer: { label: "Customer", field: "name" } },
      },
    }, ["customer"])).toThrow(/conflicts with/);
  });

  it("attrkey and Pioneer rejected", () => {
    expect(() => definePivotSurface({
      customer: { label: "Customer", path: ["customerId"], filterable: false },
      product: {
        label: "Product",
        path: ["productId"],
        filterable: false,
        attrs: { customerLabel: { label: "Customer name", field: "name" } },
      },
    }, ["customer"])).toThrow(/conflicts with/);
  });

  it("attr key is a reservation.", () => {
    expect(() => definePivotSurface({
      product: {
        label: "Product",
        path: ["productId"],
        filterable: false,
        attrs: { order: { label: "Sequence", field: "name" } },
      },
    }, ["product"])).toThrow(/is an SQL reserved word/);
  });

  it("agg: single / kind: single / format: text", () => {
    expect(() => defineSurfaces({
      gate: {
        label: "Gate",
        permission: "system:gate:read",
        path: "/_gate",
        pivot: {
          ...pivotBase,
          facts: [{ ...pivotBase.facts[0]!, measures: { qty: { field: "qty", agg: "single" } } }],
          dimensions: { customer: { label: "Customer", path: ["customerId"], filterable: false } },
          defaultRowDims: ["customer"],
        },
      },
    })).toThrow(/unknown/);
    expect(() => defineSurfaces({
      gate: {
        label: "Gate",
        permission: "system:gate:read",
        path: "/_gate",
        pivot: {
          ...pivotBase,
          measures: { qty: { label: "Count", format: "integer", expr: { kind: "single", of: "qty" } } },
          dimensions: { customer: { label: "Customer", path: ["customerId"], filterable: false } },
          defaultRowDims: ["customer"],
        },
      },
    })).toThrow(/unknown/);
    expect(() => defineSurfaces({
      gate: {
        label: "Gate",
        permission: "system:gate:read",
        path: "/_gate",
        pivot: {
          ...pivotBase,
          measures: { qty: { label: "Count", format: "text", expr: { kind: "sum", of: "qty" } } },
          dimensions: { customer: { label: "Customer", path: ["customerId"], filterable: false } },
          defaultRowDims: ["customer"],
        },
      },
    })).toThrow(/unknown/);
  });

  describe("requiredRowDims", () => {
    const dimensions = {
      customer: { label: "Customer", path: ["customerId"], filterable: false },
      product: { label: "Product", path: ["productId"], filterable: false },
    };
    const declared = {
      ...pivotBase,
      dimensions,
      defaultRowDims: ["customer", "product"],
      requiredRowDims: ["product"],
    };

    function defineGate(pivot: Record<string, unknown>) {
      return defineSurfaces({
        gate: {
          label: "Gate",
          permission: "system:gate:read",
          path: "/_gate",
          pivot,
        },
      });
    }

    it("missing RowDims Rejected", () => {
      const without = Object.fromEntries(Object.entries(declared).filter(([key]) => key !== "requiredRowDims"));
      expect(() => defineGate(without)).toThrow(/requiredRowDims must be an array/);
    });

    it("entries are not dimensions rejected", () => {
      expect(() => defineGate({ ...declared, requiredRowDims: ["nope"] }))
        .toThrow(/requiredRowDims "nope" is not a key of dimensions/);
    });

    it("defaultRowDims Rejected", () => {
      expect(() => defineGate({
        ...declared,
        defaultRowDims: ["customer"],
        requiredRowDims: ["product"],
      })).toThrow(/requiredRowDims "product" must appear in defaultRowDims/);
    });

    it("repeat Item Rejection", () => {
      expect(() => defineGate({ ...declared, requiredRowDims: ["product", "product"] }))
        .toThrow(/requiredRowDims declared "product" more than once/);
    });

    it("empty array is passed, visible fill items remain as they are", () => {
      expect(defineGate({ ...declared, requiredRowDims: [] })["gate"]?.pivot?.requiredRowDims).toEqual([]);
      expect(defineGate(declared)["gate"]?.pivot?.requiredRowDims).toEqual(["product"]);
    });
  });
});

describe("kindPivotModules attr storage gate", () => {
  function archive(
    code: string,
    label: string,
    fields: readonly Record<string, unknown>[],
    statuses: readonly Record<string, unknown>[] = [{ key: "active", initial: true, terminal: true }],
  ) {
    const first = fields[0];
    if (first === undefined || typeof first["key"] !== "string") throw new Error("fields[0].key");
    return defineFixtureModule({
      code,
      label,
      domain: "test",
      fields,
      lifecycle: { statuses, transitions: [] },
      views: { list: { columns: [first["key"]] } },
    });
  }

  const product = archive("product", "Product", [
    { key: "name", label: "Name", type: "string", required: true, primary: true },
    { key: "familyId", label: "Product family", type: "ref", ref: "family", required: true },
    {
      key: "familyCode",
      label: "Product code",
      type: "string",
      derive: { kind: "lookup", from: "family", match: "familyId", field: "code" },
    },
  ]);
  const salesOrder = archive("salesOrder", "Order", [
    { key: "code", label: "Document number", type: "string", required: true, primary: true },
    { key: "occurredAt", label: "Occurred at", type: "datetime", required: true },
    { key: "qty", label: "Count", type: "number", required: true },
    { key: "productId", label: "Product", type: "ref", ref: "product", required: true },
  ]);
  const catalog = { product, salesOrder };

  function gateSurface(attrs: Record<string, { label: string; field: string }>) {
    const surfaces = defineSurfaces({
      gate: {
        label: "Gate",
        permission: "system:gate:read",
        path: "/_gate",
        pivot: {
          facts: [{
            module: "salesOrder",
            status: ["active"],
            dateField: "occurredAt",
            measures: { qty: { field: "qty" } },
          }],
          measures: {
            qty: { label: "Count", format: "integer", expr: { kind: "sum", of: "qty" } },
          },
          dimensions: {
            product: {
              label: "Product",
              path: ["productId"],
              filterable: false,
              attrs,
            },
          },
          defaultRowDims: ["product"],
          requiredRowDims: [],
          maxRangeDays: 7,
        },
      },
    });
    const surface = surfaces["gate"];
    if (surface === undefined || surface.pivot === null) throw new Error("gate");
    return surface.pivot;
  }

  it("attr points to lookup field rejected", () => {
    const pivot = gateSurface({ productCode: { label: "Product code", field: "familyCode" } });
    expect(() => bindPivotModules(pivot, catalog, "surfaces.gate.pivot")).toThrow(/has no stored column/);
  });

  it("attr hangs on a string field with a storage column", () => {
    const pivot = gateSurface({ productName: { label: "Name", field: "name" } });
    expect(() => bindPivotModules(pivot, catalog, "surfaces.gate.pivot")).not.toThrow();
  });
});
