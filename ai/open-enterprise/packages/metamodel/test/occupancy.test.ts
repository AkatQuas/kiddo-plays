// @vitest-environment jsdom
// catalog is not required for the synthesis folder of this document. The real module runs when it can be loaded; this branch catalog, if it can't be loaded, will not be loaded.
// the group failed alone and did not take the occupancyof/deletableIn with it.
// jsdom is for skipping the Vitast global ensureCatalog.setup (it will not get the entire Node file when loading fails).

import path from "node:path";
import { loadCatalog, type Catalog } from "@open-erp/loader";
import { describe, expect, it } from "vitest";
import {
  defineFixtureModule,
  deletableIn,
  occupancyAuditBlocksRemoval,
  occupancyLeaveFrom,
  occupancyOf,
  operationsFor,
  isMasterDataModule,
  type Occupancy,
} from "../src/index.js";

const DOMAINS = path.resolve(process.cwd(), "domains");
let catalog: Catalog | null = null;
let catalogError: unknown = null;
try {
  catalog = await loadCatalog({ domainsRoot: DOMAINS });
} catch (error) {
  catalogError = error;
}

function moduleOf(code: string) {
  if (catalogError !== null) throw catalogError;
  const loaded = catalog?.modules.get(code);
  if (!loaded) throw new Error(`broken fixture: module "${code}" is not in the catalog`);
  return loaded.schema;
}

const occupancyArchive = defineFixtureModule({
  code: "occupancyArchive",
  label: "Occupancy fixture",
  domain: "demo",
  fields: [{ key: "code", label: "Code", type: "string", primary: true }],
  lifecycle: {
    statuses: [
      { key: "active", label: "Active", initial: true },
      { key: "disabled", label: "Disabled" },
    ],
    transitions: [
      { code: "disable", from: "active", to: "disabled", action: "Disable" },
      { code: "enable", from: "disabled", to: "active", action: "Re-enable" },
    ],
  },
  views: { list: { columns: ["code"] } },
});

const occupancyWorker = defineFixtureModule({
  code: "occupancyWorker",
  label: "Active-employment fixture",
  domain: "demo",
  fields: [{ key: "code", label: "Employee number", type: "string", primary: true }],
  lifecycle: {
    statuses: [
      { key: "active", label: "Employed", initial: true },
      { key: "disabled", label: "Left" },
    ],
    transitions: [
      { code: "disable", from: "active", to: "disabled", action: "Leave" },
      { code: "enable", from: "disabled", to: "active", action: "Reinstate" },
    ],
  },
  views: { list: { columns: ["code"] } },
});

const occupancyBom = defineFixtureModule({
  code: "occupancyBom",
  label: "BOM fixture",
  domain: "demo",
  fields: [{ key: "code", label: "Code", type: "string", primary: true }],
  lifecycle: {
    statuses: [
      { key: "draft", label: "draft", initial: true },
      { key: "active", label: "In effect" },
      { key: "disabled", label: "Disabled" },
    ],
    transitions: [
      { code: "activate", from: "draft", to: "active", action: "Take effect" },
      { code: "disable", from: "active", to: "disabled", action: "Disable" },
      { code: "enable", from: "disabled", to: "active", action: "Re-enable" },
    ],
  },
  views: { list: { columns: ["code"] } },
});

const occupancyBill = defineFixtureModule({
  code: "occupancyBill",
  label: "Document fixture",
  domain: "demo",
  fields: [{ key: "code", label: "Document number", type: "string", primary: true }],
  lifecycle: {
    statuses: [
      { key: "draft", label: "draft", initial: true },
      { key: "pending", label: "pendingReview" },
      { key: "voided", label: "voided", terminal: true },
    ],
    transitions: [
      { code: "submit", from: "draft", to: "pending", action: "Submit" },
      { code: "void", from: "pending", to: "voided", action: "Void" },
    ],
  },
  views: { list: { columns: ["code"] } },
});

describe("occupancyof: border agreement, not module kind", () => {
  it("disable Edge from being occupied, to be exited", () => {
    expect(occupancyOf(occupancyArchive, "active")).toBe("in-use");
    expect(occupancyOf(occupancyArchive, "disabled")).toBe("retired");
    expect(occupancyLeaveFrom(occupancyArchive, "active")?.action).toBe("Disable");
    expect(occupancyLeaveFrom(occupancyArchive, "disabled")).toBeNull();
  });

  it("dismissed side resembling", () => {
    expect(occupancyOf(occupancyWorker, "active")).toBe("in-use");
    expect(occupancyOf(occupancyWorker, "disabled")).toBe("retired");
    expect(occupancyLeaveFrom(occupancyWorker, "active")?.code).toBe("disable");
  });

  it("the draft never left behind the occupation.", () => {
    expect(occupancyOf(occupancyBom, "draft")).toBe("none");
    expect(occupancyOf(occupancyBom, "active")).toBe("in-use");
    expect(occupancyOf(occupancyBom, "disabled")).toBe("retired");
  });

  it("there's no room for normal papers.", () => {
    expect(occupancyOf(occupancyBill, "draft")).toBe("none");
    expect(occupancyOf(occupancyBill, "pending")).toBe("none");
  });

  it("status.occupancy doesn't lose a stamp.", () => {
    const stamped = {
      ...occupancyArchive,
      lifecycle: {
        ...occupancyArchive.lifecycle,
        statuses: occupancyArchive.lifecycle.statuses.map((status) => ({
          ...status,
          occupancy: occupancyOf(occupancyArchive, status.key),
        })),
        transitions: [],
      },
    };
    expect(occupancyOf(stamped, "active")).toBe("in-use");
    expect(occupancyOf(stamped, "disabled")).toBe("retired");
    expect(deletableIn(stamped, "active")).toBe(false);
    expect(deletableIn(stamped, "disabled")).toBe(true);
  });
});

describe("deletable In: Deactivate and delete the occupation and document is still in its infancy", () => {
  it("synthetic occupation of archives: not subject to deletion, after disablement", () => {
    expect(deletableIn(occupancyArchive, "active")).toBe(false);
    expect(deletableIn(occupancyArchive, "disabled")).toBe(true);
  });

  it("synthetic Tables: Drafts may be deleted, they may not be deleted during entry into force, and post-declared Okay.", () => {
    expect(deletableIn(occupancyBom, "draft")).toBe(true);
    expect(deletableIn(occupancyBom, "active")).toBe(false);
    expect(deletableIn(occupancyBom, "disabled")).toBe(true);
  });

  it("synthetic document: the initial state may be deleted and the initial state may not be deleted", () => {
    expect(deletableIn(occupancyBill, "draft")).toBe(true);
    expect(deletableIn(occupancyBill, "pending")).toBe(false);
  });
});

describe("ccupancyAuditBlocksRemoval:retired is only exempt from occupation.", () => {
  const cases: readonly {
    occupancy: Occupancy;
    code: string;
    blocks: boolean;
  }[] = [
    { occupancy: "retired", code: "disable", blocks: false },
    { occupancy: "retired", code: "enable", blocks: false },
    { occupancy: "retired", code: "activate", blocks: true },
    { occupancy: "retired", code: "submit", blocks: true },
    { occupancy: "retired", code: "", blocks: true },
    { occupancy: "retired", code: "Disable", blocks: true },
    { occupancy: "in-use", code: "disable", blocks: true },
    { occupancy: "none", code: "submit", blocks: true },
    { occupancy: "none", code: "disable", blocks: true },
  ];

  it.each(cases)("$occupancy + $code → blocks=$blocks", ({ occupancy, code, blocks }) => {
    expect(occupancyAuditBlocksRemoval(occupancy, code)).toBe(blocks);
  });
});

describe.skipIf(catalogError !== null)("occupancy and delete declarations of real modules", () => {
  it("goods / Vendor: Enabled not to be deleted, after disabled", () => {
    expect(occupancyOf(moduleOf("product"), "active")).toBe("in-use");
    expect(occupancyOf(moduleOf("product"), "disabled")).toBe("retired");
    expect(deletableIn(moduleOf("product"), "active")).toBe(false);
    expect(deletableIn(moduleOf("product"), "disabled")).toBe(true);
    expect(deletableIn(moduleOf("supplier"), "active")).toBe(false);
    expect(deletableIn(moduleOf("supplier"), "disabled")).toBe(true);
  });

  it("personnel: Incumbent, post-employment declaration level Okay.", () => {
    expect(occupancyOf(moduleOf("worker"), "active")).toBe("in-use");
    expect(occupancyOf(moduleOf("worker"), "disabled")).toBe("retired");
    expect(deletableIn(moduleOf("worker"), "active")).toBe(false);
    expect(deletableIn(moduleOf("worker"), "disabled")).toBe(true);
  });

  it("BOM: New to enter into force, non-delegable during entry into force, decommissioned after declaration Okay.", () => {
    expect(occupancyOf(moduleOf("bom"), "active")).toBe("in-use");
    expect(occupancyOf(moduleOf("bom"), "disabled")).toBe("retired");
    expect(deletableIn(moduleOf("bom"), "active")).toBe(false);
    expect(deletableIn(moduleOf("bom"), "disabled")).toBe(true);
  });

  it("inventory documents are still available; departure from the initial form is not possible", () => {
    expect(occupancyOf(moduleOf("stockIn"), "pending")).toBe("none");
    expect(deletableIn(moduleOf("stockIn"), "pending")).toBe(true);
    expect(deletableIn(moduleOf("stockIn"), "approved")).toBe(false);
    expect(deletableIn(moduleOf("stockOut"), "pending")).toBe(true);
    expect(deletableIn(moduleOf("stockOut"), "approved")).toBe(false);
  });

  it("sales orders are now stated: pending review, no one may be deleted", () => {
    expect(occupancyOf(moduleOf("salesOrder"), "pendingReview")).toBe("none");
    expect(deletableIn(moduleOf("salesOrder"), "pendingReview")).toBe(true);
    expect(deletableIn(moduleOf("salesOrder"), "inProgress")).toBe(false);
  });

  it("organisationsFor and DeletableIn: goods are not available", () => {
    const product = moduleOf("product");
    expect(operationsFor(product, "active").some((op) => op.operator === "delete")).toBe(false);
    expect(operationsFor(product, "disabled").some((op) => op.operator === "delete")).toBe(true);
  });

  it("archives = single or occupancy state, document occupied all none, not module lists", () => {
    for (const code of ["product", "worker", "supplier", "customer", "warehouse", "operation", "equipment", "mold"]) {
      expect(isMasterDataModule(moduleOf(code)), code).toBe(true);
    }
    for (const code of ["salesOrder", "purchaseOrder", "productionOrder", "productionTask", "processAssignment", "processReport"]) {
      expect(isMasterDataModule(moduleOf(code)), code).toBe(false);
    }
  });
});
