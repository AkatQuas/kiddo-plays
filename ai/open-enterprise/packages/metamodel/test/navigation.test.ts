import { describe, expect, it } from "vitest";
import {
  defineNavigation,
  resolveNavigation,
  validateNavigation,
  type NavigationModule,
  type PathSurface,
} from "../src/index.js";

const surfaces = new Map<string, PathSurface>([
  ["stock-query", {
    code: "stockQuery",
    navCode: "stock-query",
    label: "Inventory report",
    path: "/_stock-query",
    permission: "system:stockQuery:read",
  }],
]);

const modules = new Map<string, NavigationModule>([
  ["customer", { label: "Customer record", compositeChild: null }],
  ["salesOrder", { label: "Sales order", compositeChild: null }],
]);

/** Composite file: parent-file Familyviews.composite.child = prevention. */
const compositeModules = new Map<string, NavigationModule>([
  ["productFamily", { label: "Product record", compositeChild: "product" }],
  ["product", { label: "SKU record", compositeChild: null }],
]);

function compositeTree() {
  return defineNavigation({
    groups: [{
      code: "master",
      label: "Master data",
      items: [{ module: "productFamily" }, { module: "product", hidden: true }],
    }],
  });
}

function tree() {
  return defineNavigation({
    groups: [
      { code: "master", label: "Master data", items: [{ module: "customer" }] },
      {
        code: "sales",
        label: "Sales",
        items: [{ module: "salesOrder" }, { surface: "stock-query", hidden: true }],
      },
    ],
  });
}

describe("defineNavigation shape", () => {
  it("items and groups", () => {
    expect(() => defineNavigation({
      groups: [{
        code: "production",
        label: "Production",
        items: [{ module: "customer" }],
        groups: [{ code: "make", label: "Make", items: [{ module: "salesOrder" }] }],
      }],
    })).toThrow(/cannot have both menu items and child groups/);
  });

  it("the empty group is red and named.", () => {
    expect(() => defineNavigation({
      groups: [{ code: "finance", label: "Treasury", items: [] }],
    })).toThrow(/group "finance" \(Treasury\) is empty/);
  });

  it("group Code", () => {
    expect(() => defineNavigation({
      groups: [
        { code: "sales", label: "Sales", items: [{ module: "customer" }] },
        { code: "sales", label: "Also called sales", items: [{ module: "salesOrder" }] },
      ],
    })).toThrow(/group code "sales" appears more than once in the navigation tree/);
  });

  it("the same module is red twice.", () => {
    expect(() => defineNavigation({
      groups: [
        { code: "a", label: "A", items: [{ module: "customer" }] },
        { code: "b", label: "B", items: [{ module: "customer" }] },
      ],
    })).toThrow(/module "customer" appears more than once in the navigation tree/);
  });

  it("on the entry, label, red.", () => {
    expect(() => defineNavigation({
      groups: [{ code: "a", label: "A", items: [{ module: "customer", label: "Alias" }] }],
    })).toThrow(/unknown key "label"/);
  });

  it("run for it again.", () => {
    const once = tree();
    expect(defineNavigation(once)).toEqual(once);
  });
});

describe("validateNavigation", () => {
  it("if you're missing a module, count.", () => {
    const declared = defineNavigation({
      groups: [{ code: "master", label: "Master data", items: [{ module: "customer" }] }],
    });
    expect(() => validateNavigation(declared, {
      moduleCodes: new Set(["customer", "salesOrder"]),
      pathSurfaces: new Map(),
    })).toThrow(/the navigation tree is missing these modules: salesOrder/);
  });

  it("quote non-existent modules by naming groups and modules", () => {
    const declared = defineNavigation({
      groups: [{ code: "master", label: "Master data", items: [{ module: "noSuch" }] }],
    });
    expect(() => validateNavigation(declared, {
      moduleCodes: new Set(["customer"]),
      pathSurfaces: new Map(),
    })).toThrow(/group "master" \(Master data\) references a module "noSuch" that does not exist/);
  });

  it("if you're missing your path, just call in.", () => {
    expect(() => validateNavigation(tree(), {
      moduleCodes: new Set(["customer", "salesOrder"]),
      pathSurfaces: new Map([...surfaces, ["product-archive", {
        code: "productArchive",
        navCode: "product-archive",
        label: "Product record query",
        path: "/_product-archive",
        permission: "system:productArchive:read",
      }]]),
    })).toThrow(/the navigation tree is missing these query surfaces that have a path: product-archive/);
  });
});

describe("resolveNavigation", () => {
  it("schema. label and /code path, kind=surface", () => {
    const resolved = resolveNavigation(tree(), { modules, pathSurfaces: surfaces });
    expect(resolved).toEqual([
      {
        code: "master",
        label: "Master data",
        items: [{
          code: "module:customer",
          kind: "module",
          module: "customer",
          label: "Customer record",
          path: "/customer",
          permissionKey: "module:customer:read",
          hidden: false,
          within: null,
        }],
        groups: [],
      },
      {
        code: "sales",
        label: "Sales",
        items: [
          {
            code: "module:salesOrder",
            kind: "module",
            module: "salesOrder",
            label: "Sales order",
            path: "/salesOrder",
            permissionKey: "module:salesOrder:read",
            hidden: false,
            within: null,
          },
          {
            code: "surface:stock-query",
            kind: "surface",
            module: null,
            label: "Inventory report",
            path: "/_stock-query",
            permissionKey: "system:stockQuery:read",
            hidden: true,
            within: null,
          },
        ],
        groups: [],
      },
    ]);
  });
});

describe("resolveNavigation within", () => {
  it("the sub-module items take the parent module, the code, the parent module itself, and both are left in place. Group", () => {
    const resolved = resolveNavigation(compositeTree(), {
      modules: compositeModules,
      pathSurfaces: new Map(),
    });
    const items = resolved[0]?.items ?? [];
    expect(items.map((item) => [item.code, item.within])).toEqual([
      ["module:productFamily", null],
      ["module:product", "productFamily"],
    ]);
    // permission key does not change semantics by within
    expect(items[1]?.permissionKey).toBe("module:product:read");
    expect(items[1]?.hidden).toBe(true);
    expect(items[1]?.path).toBe("/product");
  });

  it("common.child points to unloaded modules red", () => {
    expect(() => resolveNavigation(
      defineNavigation({ groups: [{ code: "master", label: "Master data", items: [{ module: "productFamily" }] }] }),
      {
        modules: new Map<string, NavigationModule>([
          ["productFamily", { label: "Product record", compositeChild: "noSuch" }],
        ]),
        pathSurfaces: new Map(),
      },
    )).toThrow(/views\.composite\.child "noSuch", which is not a loaded module/);
  });

  it("it's not like you're gonna be able to do that.", () => {
    expect(() => resolveNavigation(
      defineNavigation({ groups: [{ code: "master", label: "Master data", items: [{ module: "productFamily" }] }] }),
      {
        modules: new Map<string, NavigationModule>([
          ["productFamily", { label: "Product record", compositeChild: "productFamily" }],
        ]),
        pathSurfaces: new Map(),
      },
    )).toThrow(/views\.composite\.child pointing at itself/);
  });

  it("the two fathers are in the same class, and they're named.", () => {
    expect(() => resolveNavigation(
      defineNavigation({
        groups: [{
          code: "master",
          label: "Master data",
          items: [{ module: "productFamily" }, { module: "otherFamily" }, { module: "product", hidden: true }],
        }],
      }),
      {
        modules: new Map<string, NavigationModule>([
          ["productFamily", { label: "Product record", compositeChild: "product" }],
          ["otherFamily", { label: "Another record", compositeChild: "product" }],
          ["product", { label: "SKU record", compositeChild: null }],
        ]),
        pathSurfaces: new Map(),
      },
    )).toThrow(/module "product" is declared as a composite-archive child by both "productFamily" and "otherFamily"/);
  });

  it("the sub-unit itself declared that it was red.", () => {
    expect(() => resolveNavigation(
      defineNavigation({
        groups: [{
          code: "master",
          label: "Master data",
          items: [{ module: "productFamily" }, { module: "product" }, { module: "sku" }],
        }],
      }),
      {
        modules: new Map<string, NavigationModule>([
          ["productFamily", { label: "Product record", compositeChild: "product" }],
          ["product", { label: "SKU record", compositeChild: "sku" }],
          ["sku", { label: "A finer record", compositeChild: null }],
        ]),
        pathSurfaces: new Map(),
      },
    )).toThrow(/nested composite archives are not supported/);
  });
});
