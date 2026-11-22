// ---------------------------------------------------------------------------
// Whole-repo modeling gates — formerly two CLI commands (validate / check), now tests.
//
// 🔴 Why this must be a test, not a command: a gate that relies on someone remembering a command is no gate.
// Contributors get the full tree; what they actually run is `npm test` — so the gate must live on that path.
// Two entry points (command + test) are also forbidden: that is two sources of truth for the same verdict, and they drift.
// ---------------------------------------------------------------------------

import path from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
// 🔴 Hardcode scanning uses a standalone module, not re-exported from index.ts: that pulls in the full TypeScript
// compiler, and index.ts is the `catalog` / `gen:db` entry — wiring it there would load megabytes on every explain.
// Gates run only under `npm test`; the cost belongs there.
import { loadCatalog } from "@open-erp/loader";
import { snapshotColumnNotNull, walkNavigationItems, type Field, type ModuleSchema } from "@open-erp/metamodel";
import { findModuleCodesInSource } from "../src/hardcodes.js";
import { genDb } from "../src/codegen.js";
import { analysisCatalogDrift } from "../src/analysisCatalogGen.js";
import { hatchesDrift } from "../src/hatchesGen.js";
import {
  assertChoiceSetIdentityEvolution,
  choiceSetIdentityManifest,
  genDbDrift,
  validate,
  type ChoiceSetIdentityManifest,
  type ValidateResult,
} from "../src/index.js";

const ROOT = path.resolve(fileURLToPath(new URL("../../../", import.meta.url)));
const DOMAINS = path.join(ROOT, "domains");
const CHOICE_SET_IDENTITIES = path.join(DOMAINS, "choice-set-identities.json");
/** Generated table defs live at repo-root tables/, not under packages/ — they follow domains/, not the framework. */
const TABLES = path.join(ROOT, "tables", "src");

/**
 * Render validation output into the assertion message so a human can fix failures directly.
 *
 * Without this, a red gate only says `expected false to be true` — no hint which module failed.
 * (Error code + path + message) is the real gate output and must not be dropped.
 */
function report(result: ValidateResult): string {
  const lines: string[] = [];
  for (const m of result.perModule) {
    if (!m.errors.length) continue;
    lines.push(`✗ ${m.code} (${String(m.errors.length)} errors)`);
    for (const e of m.errors) lines.push(`    [${e.code}] ${e.path}\n      ${e.message}`);
  }
  for (const e of result.crossRefs) lines.push(`✗ cross-module reference ${e.module} ${e.path}: ${e.message}`);
  for (const e of result.createPaths) lines.push(`✗ [${e.code}] ${e.module} ${e.path}\n      ${e.message}`);
  return lines.join("\n");
}

describe("Gate: all modules in domains/", () => {
  it("every module passes all semantic gates", async () => {
    const result = await validate(DOMAINS);
    expect(result.perModule.filter((m) => m.errors.length), `\n${report(result)}\n`).toEqual([]);
  });

  it("every cross-module reference resolves — this repo deliberately emits no cross-module FKs; the DB will not check for us", async () => {
    const result = await validate(DOMAINS);
    const CURRENT_CROSS_REFS = [
      {
        module: "salesOrder",
        path: "fields.orderSource.choiceSet",
        message:
          'directory module "salesOrder" has custom code / a Planner and cannot bind a tenant-configurable dictionary — build time cannot prove the custom code does not branch on a concrete enum value; keep static options, or move the business logic off a dependency on concrete values first',
      },
      {
        module: "purchaseOrder",
        path: "fields.sourceType.options",
        message:
          'candidate "Manual" is a system code and must be written in options as { value, label } with facing copy — the screen, the sidebar, and the dropdown all show that copy directly, and must not expose a module code or an internal token to a role',
      },
      {
        module: "purchaseReturn",
        path: "fields.handlingType.options",
        message:
          'candidate "Return" is a system code and must be written in options as { value, label } with facing copy — the screen, the sidebar, and the dropdown all show that copy directly, and must not expose a module code or an internal token to a role',
      },
      {
        module: "purchaseReturn",
        path: "fields.handlingType.options",
        message:
          'candidate "Exchange" is a system code and must be written in options as { value, label } with facing copy — the screen, the sidebar, and the dropdown all show that copy directly, and must not expose a module code or an internal token to a role',
      },
      {
        module: "subcontractOrder",
        path: "fields.lines.fields.specRemark.snapshot.field",
        message:
          'snapshot target "specRemark" is string, source "remark" is text — only the same type may be frozen, or an enum source frozen as string',
      },
      {
        module: "processAssignment",
        path: "fields.productRemark.snapshot.field",
        message:
          'snapshot target "productRemark" is string, source "remark" is text — only the same type may be frozen, or an enum source frozen as string',
      },
      {
        // The production task list shows spec notes in the same shape as processAssignment / processReport:
        // list columns freeze product.remark (text) as a per-line string. Converging all three only matters together.
        module: "productionTask",
        path: "fields.productRemark.snapshot.field",
        message:
          'snapshot target "productRemark" is string, source "remark" is text — only the same type may be frozen, or an enum source frozen as string',
      },
      {
        // After stock-in type moved to a data dictionary, the production-receipt precondition still branches on type = production receipt;
        // dictionary values can be added or removed, so the gate stays red. Real fix: a criterion that does not depend on a specific dictionary value
        // (or split production receipt into its own module).
        module: "stockIn",
        path: "preconditions.production_task_required_for_receipt.when",
        message:
          'a rule reads configurable-dictionary field "type" (inventory.stockInType) — a flow criterion cannot depend on a classification value a tenant can add or retire',
      },
      {
        module: "stockIn",
        path: "preconditions.production_receipt_product_matches_task.when",
        message:
          'a rule reads configurable-dictionary field "type" (inventory.stockInType) — a flow criterion cannot depend on a classification value a tenant can add or retire',
      },
    ];
    expect(result.crossRefs, `\n${report(result)}\n`).toEqual(CURRENT_CROSS_REFS);
  });

  it("🔴 every module has at least one creation path — manual create or pushed from another document", async () => {
    // A module with neither shows up in the menu, has a list page, and a New button, but the user
    // cannot fill required fields (no refLine candidate channel yet). Saves fail at value gates,
    // and nothing on screen explains that the document cannot be created this way.
    //
    // 🔴 Do not whitelist known violations to green the gate. Escape hatches are for legitimate mechanisms;
    // a module nobody can create data on is a bug. Whitelisting only hides the gap.
    const result = await validate(DOMAINS);
    expect(result.createPaths, `\n${report(result)}\n`).toEqual([]);
  });

  it("the navigation tree covers every module and every surface that has a path", async () => {
    const catalog = await loadCatalog({ domainsRoot: DOMAINS });
    const items = walkNavigationItems(catalog.navigation);
    const modulesInTree = new Set(items.filter((item) => item.kind === "module").map((item) => item.module));
    const surfacesInTree = new Set(items.filter((item) => item.kind === "surface").map((item) => item.code.replace(/^surface:/, "")));
    const missingModules = [...catalog.modules.keys()].filter((code) => !modulesInTree.has(code)).sort();
    const missingSurfaces = [...catalog.surfaces.values()]
      .filter((surface) => surface.path !== null)
      .map((surface) => surface.path!.slice(2))
      .filter((code) => !surfacesInTree.has(code))
      .sort();
    expect(missingModules, "every module must appear in the repo-root navigation.ts; a module with no entry sets hidden: true").toEqual([]);
    expect(missingSurfaces, "a query surface with a path must appear in the repo-root navigation.ts").toEqual([]);
  });
});

describe("Gate: list default sort is created-at descending", () => {
  it("every module in domains/ uses createdAt desc", async () => {
    const catalog = await loadCatalog({ domainsRoot: DOMAINS });
    const drifted = [...catalog.modules.values()]
      .filter((m) => {
        const sort = m.schema.views.list.defaultSort;
        return sort?.field !== "createdAt" || sort.desc !== true;
      })
      .map((m) => `${m.schema.code}: ${JSON.stringify(m.schema.views.list.defaultSort)}`)
      .sort();
    expect(
      drifted,
      "\nThe default list sort must be created-at descending `{ field: \"createdAt\", desc: true }`." +
        "A new module must not start another scheme (code ascending / updated at / business day). The user can still change the current sort by clicking a column title.\n",
    ).toEqual([]);
  });
});

describe("Gate: choiceSet stable identity may only be appended; existing lifecycle is immutable", () => {
  it("the checked-in artifact matches TS declarations and no historical identity was removed or had its lifecycle changed", async () => {
    const artifactText = readFileSync(CHOICE_SET_IDENTITIES, "utf8");
    const previous = JSON.parse(artifactText) as ChoiceSetIdentityManifest;
    const catalog = await loadCatalog({ domainsRoot: DOMAINS });
    const current = choiceSetIdentityManifest(catalog.choiceSets);

    expect(() => assertChoiceSetIdentityEvolution(previous, current)).not.toThrow();
    expect(
      current,
      "choiceSet identity artifact drifted from the TS declaration: a new code must update the artifact; an existing code must not be deleted or change its retired state",
    ).toEqual(previous);
  });
});

// ---------------------------------------------------------------------------
// Gate: push-created drafts must have an exit
//
// 🔴 Architectural fact: `oe_reference` (push lineage) has only one INSERT site
// (`packages/storage-pg/src/repo/referenceRepo.ts`), zero DELETE, zero UPDATE.
// Push has no undo — lineage written once is permanent.
//
// Therefore `billRepo.assertRemovable` permanently refuses delete for push-created
// documents, which is correct (delete would rewrite history). Deletion is structurally
// closed off, so there must be a second path — a non-business edge to a terminal status
// (void / cancel).
//
// Neither path means a document nobody can dispose of: it cannot submit (initial submit
// sits behind block gates an empty draft cannot satisfy), cannot delete, cannot void,
// and stays on the list forever. Seen twice in production (`processReport` and
// `purchaseOrder`), with the same user-facing message pointing at buttons that do not exist.
//
// ⚠️ Criterion is “initial status has a direct edge to terminal”, not “terminal is reachable”:
// the latter is always true (draft → submit → … → terminal), and that is exactly the path
// an empty draft cannot take.
//
// ⚠️ Related wider case not gated here: `assertRemovable` also honors `oe_audit_log`, so a
// document submitted then withdrawn/rejected back to initial cannot be deleted either.
// Nine modules can re-enter initial without a direct-to-terminal edge — broader than this
// list. Those drafts are not “dead” (they can submit again), so the gate is narrower; the
// same shape of scan could widen the predicate later.
// ---------------------------------------------------------------------------

/**
 * Modules that are push-created but have no exit.
 *
 * Pure function over declarations so the probe below can feed synthetic modules —
 * whether the criterion is alive cannot be proved by “how many hits exist in the full catalog”.
 */
function deadDraftsOf(schemas: readonly ModuleSchema[]): readonly string[] {
  const pushed = new Set(
    schemas.flatMap((s) => s.lifecycle.transitions.map((t) => t.push).filter((c): c is string => c !== null)),
  );
  return schemas
    .filter((s) => pushed.has(s.code))
    .filter((s) => {
      const initial = s.lifecycle.statuses.find((x) => x.initial);
      if (!initial || initial.terminal) return false;
      const terminals = new Set(s.lifecycle.statuses.filter((x) => x.terminal).map((x) => x.key));
      return !s.lifecycle.transitions.some((t) => t.from === initial.key && terminals.has(t.to));
    })
    .map((s) => s.code)
    .sort();
}

describe("Gate: push-created drafts must have an edge to a terminal status", () => {
  it("🔴 the list must stay empty — the first offender fails the gate", async () => {
    // 🔴 This is a must-always-be-empty assertion, not an exemption whitelist.
    // The rule above against whitelisting violations means gaps stay countable; here it is stricter: zero allowed.
    //
    // 🔴 The fix is to add a terminal edge on that module, not another row on this list.
    // Shape is uniform — copy any existing cancel edge:
    //     { code: "cancel", from: "<initial>", to: "cancelled", action: "Cancel", confirm: true }
    // plus `{ key: "cancelled", terminal: true, editable: "none" }`.
    // Do not omit confirm: true — on modules with no effects you do not get a free confirm from postsToLedger;
    // one mistaken click would jump straight to terminal.
    //
    // When adding an exit, read that module’s posting: a new terminal reachable from a reserve/release `to`
    // while bypassing reverseOn trips `EFFECT_REVERSE_UNREACHABLE`. Today’s exit edges all leave initial and
    // initial cannot reach any posted state, so the two gates do not collide. New terminals use
    // `editable: "none"` so they do not trip `EFFECT_COORD_FIELD_EDITABLE` or `EFFECT_AMOUNT_SOURCE_EDITABLE`.
    const catalog = await loadCatalog({ domainsRoot: DOMAINS });
    const dead = deadDraftsOf([...catalog.modules.values()].map((m) => m.schema));
    expect(
      dead,
      "\nA draft created by push has no way out. It cannot be deleted (lineage is insert-only), it cannot be submitted (the initial edge carries a chain of block gates), " +
        "and it cannot be voided, so it stays on the list forever.\n" +
        "The fix is to add an edge to a terminal status (copy salesDelivery.cancel), " +
        "not to widen this assertion.\n",
    ).toEqual([]);
  });
});

describe("Gate: form entry order ≥ candidate dependency order", () => {
  /**
   * 🔴 This invariant has zero runtime symptoms, so it lives here.
   *
   * When `refFilter` operands are missing, fail-closed is correct (empty set + pending;
   * see AGENTS.md — never fall back to unfiltered). The failure mode is ordering: the consumer
   * field appears before the field that supplies its filter value, so top-to-bottom entry hits
   * an eternally empty candidate list and a grammatical “fill in X first” where X is not on the form.
   *
   * Same class seen twice in acceptance (WB-BUG-54 material demand before product; WB-BUG-71
   * production task before material demand). After two hits the check moved to the whole catalog
   * instead of one domain test so new domains inherit it.
   */
  it("🔴 every refFilter dependency appears before its consumer — reversed order never errors at runtime", async () => {
    const result = await validate(DOMAINS);
    expect(
      result.formOrder,
      `\nForm entry order contradicts candidate dependency order:\n    ${result.formOrder.map((e) => e.message).join("\n    ")}\n` +
        `\nChange the order of the two cells in views.form (or that line table's column order), not the fields declaration order — ` +
        `the latter moves the tables/ output and needs a migration.\n`,
    ).toEqual([]);
  });
});

describe("Gate: table definitions are compilation artifacts", () => {
  it("🔴 tables/src stays in sync with declarations — change schema without gen:db and this gate fails", async () => {
    // Drift feels fine locally (the table already exists in your DB) and only blows up elsewhere
    // as “relation does not exist”. Committing generated output is what makes that visible in diff.
    const drift = await genDbDrift(DOMAINS, TABLES);
    expect(drift, `\nTable definitions are out of sync with declarations. Run \`node --import tsx packages/builder/src/cli.ts gen:db\`:\n    ${drift.join("\n    ")}\n`).toEqual([]);
  });

  it("🔴 tables/analysis-catalog.json stays in sync with declarations", async () => {
    const artifact = path.join(ROOT, "tables", "analysis-catalog.json");
    const drift = await analysisCatalogDrift(DOMAINS, artifact);
    expect(drift, `\nAnalysis catalog is out of sync with declarations. Run gen:db:\n    ${drift ?? ""}\n`).toBeNull();
  });

  it("🔴 tables/hatches.json stays in sync — new escape hatch / surface / insight shows in diff", async () => {
    const artifact = path.join(ROOT, "tables", "hatches.json");
    const drift = await hatchesDrift(DOMAINS, artifact);
    expect(drift, `\nHatches / surfaces / insights are out of sync with declarations. Run gen:db:\n    ${drift ?? ""}\n`).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Gate: snapshot column nullability follows source nullability
//
// Pins a demo path that hard-stops and cannot be rolled back: sales order with empty spec
// passes approval but shipment fails with `SNAPSHOT_SOURCE_EMPTY` while the document is no
// longer draft — stuck in progress until unapprove.
//
// Root cause: codegen once emitted `snapshot ⇒ .notNull()` unconditionally, but that holds
// only when match references are required and the source field is guaranteed non-empty.
// After the loader stopped rejecting valid optional-source snapshots, codegen did not
// follow, so contradictory declarations reached runtime.
//
// 🔴 This describe has two legs; either missing makes the gate fake:
//   ① Inventory leg — hand-maintained list of columns that must be nullable. It does not
//      re-derive the rule, so a wrong criterion turns the list red. With only ②, both sides
//      move together and the gate stays green forever.
//   ② Consistency leg — emitted `.notNull()` ⟺ criterion. Codegen must not invent its own copy.
// ---------------------------------------------------------------------------
describe("Gate: snapshot nullability follows reference requiredness and source nullability", () => {
  /** Every snapshot field: coordinate, whether semantics require NOT NULL, whether codegen emitted notNull */
  async function snapshotColumns(): Promise<
    readonly { readonly at: string; readonly expectedNotNull: boolean; readonly notNull: boolean }[]
  > {
    const catalog = await loadCatalog({ domainsRoot: DOMAINS });
    const resolve = (code: string): ModuleSchema | undefined => catalog.modules.get(code)?.schema;
    const emitted = new Map((await genDb(DOMAINS)).files.map((f) => [f.path, f.content]));
    const out: { at: string; expectedNotNull: boolean; notNull: boolean }[] = [];
    for (const m of [...catalog.modules.values()].sort((a, b) => a.code.localeCompare(b.code))) {
      const content = emitted.get(`${m.code}.ts`) ?? "";
      const walk = (fields: readonly Field[], table: string | null): void => {
        for (const f of fields) {
          if (f.type === "subtable" && f.fields) walk(f.fields, f.key);
          if (!f.snapshot) continue;
          // This column in the product is as follows:`    <key>: text("<snake>")[.notNull()],`
          // the header is in the same file from the table, while the snapshot target is the only key in a module that can be located sufficiently
          const decl = new RegExp(`^    ${f.key}: [^\\n]*$`, "m").exec(content);
          if (!decl) throw new Error(`${m.code}.${f.key}: this column is missing from the output — the table builder and the declaration are not the same source`);
          out.push({
            at: `${m.code}.${table ?? "$bill"}.${f.key}`,
            expectedNotNull: snapshotColumnNotNull(f, fields, resolve),
            notNull: decl[0].includes(".notNull()"),
          });
        }
      };
      walk(m.schema.fields, null);
    }
    return out;
  }

  it("🔴 nullable snapshot inventory is fixed — optional source or optional match is a deliberate choice", async () => {
    // 🔴 Pin a list, not a count (same discipline as escape hatches): counts drift unnoticed; list changes fail the test.
    // The list is also a mutation probe for `snapshotSourceGuarantee` — break lineAgg or required handling and it shifts.
    //
    // These columns being nullable is correct, not debt: either the source has no value yet or match allows absence.
    // Early rows use “draft may omit, submit requires” via transition `required_fields`, not column NOT NULL.
    // `salesDelivery.lines.spec` is product-archive migration debt; spec is hand-entered for now.
    const nullable = (await snapshotColumns()).filter((c) => !c.expectedNotNull).map((c) => c.at);
    expect(nullable).toEqual([
      "orgUnit.$bill.ancWorkshopId",
      "orgUnit.$bill.ancFactoryId",
      // Payroll worker now comes from Planner at report time, not a required snapshot on the assignment.
      // Payroll freezes the report’s worker; plannerSupplied breaks source guarantee through, so nullable by source.
      // The report itself still requires workerId; payroll lines in practice still have values.
      "performanceSettlement.$bill.workerId",
      // Payroll is generated for in-house reports; reports now also cover subcontract (receipt, no assignment).
      // Process / assignment / task / order / product / rate / team columns have nothing to freeze on that chain.
      // Subcontract reports do not create payroll; data may still be filled — column rules must not assume that.
      "performanceSettlement.$bill.teamId",
      "performanceSettlement.$bill.operationId",
      "performanceSettlement.$bill.processAssignmentId",
      "performanceSettlement.$bill.productionTaskId",
      "performanceSettlement.$bill.productionOrderId",
      "performanceSettlement.$bill.productId",
      "performanceSettlement.$bill.pieceRate",
      "performanceSettlement.$bill.remark",
      "processAssignment.$bill.hourlyRate",
      "processAssignment.$bill.productBarcode",
      "processAssignment.$bill.productRemark",
      // After subcontract receipt linkage, reports cover in-house and subcontract paths.
      // Name / spec / spec remark / task qty freeze from production task with optional match — nullable columns.
      // Remaining columns snapshot from assignment; subcontract without assignment is empty by source.
      // In-house still gets plannerSupplied values — productId, units, task ids, assignment dates, etc. are
      // plannerSupplied now, not nullable snapshots (see processReport field declarations).
      "processReport.$bill.teamId",
      "processReport.$bill.pieceRate",
      "processReport.$bill.hourlyRate",
      "processReport.$bill.hourlyRateUnit",
      "processReport.$bill.productName",
      "processReport.$bill.spec",
      "processReport.$bill.taskQty",
      "processReport.$bill.equipmentId",
      "processReport.$bill.moldId",
      "processReport.$bill.productBarcode",
      "processReport.$bill.productRemark",
      "processReport.$bill.workshopOrgId",
      "processReport.$bill.factoryOrgId",
      "processReport.$bill.productionLineOrgId",
      // SKU code freezes product barcode; barcode is optional on product archive (e5ba464c explicit optional).
      "productionReceipt.$bill.skuCode",
      "productionReceipt.$bill.specRemark",
      // Production task list freezes product barcode and spec remark; both optional on product archive.
      "productionTask.$bill.productBarcode",
      "productionTask.$bill.productRemark",
      // Workshop on task process lines freezes from line org; historical org trees may lack that ancestor.
      "productionTask.processLines.workshopOrgId",
      "purchaseReturn.lines.productId",
      "purchaseReturn.lines.unit",
      "purchaseReturn.lines.unitFactor",
      "purchaseReturn.lines.baseUnitPrice",
      "salesDelivery.lines.spec",
      // Subcontract order line spec remark freezes product remark; archive remark is optional.
      "subcontractOrder.lines.specRemark",
      // Subcontract return inherits source order line from receipt history; migration backfills only unique matches.
      // Ambiguous legacy lines stay empty — do not guess bindings and corrupt receive/return progress.
      "subcontractReturn.lines.orderLineId",
    ]);
  });

  it("🔴 emitted notNull ⟺ criterion — codegen must not write its own nullability", async () => {
    const wrong = (await snapshotColumns()).filter((c) => c.expectedNotNull !== c.notNull);
    expect(
      wrong.map((c) => `${c.at}: semantics ${c.expectedNotNull ? "require" : "do not require"} NOT NULL, column is ${c.notNull ? "" : "not "}NOT NULL`),
      "\nThe column constraint is lying about the declaration — that is the shape of \"cannot ship after approval, and the document is stuck\".\n",
    ).toEqual([]);
  });

  it("🔴 `salesDelivery.lines.spec` stays nullable — blank spec on the order must still ship", async () => {
    // Prior cases are whole-catalog; this one pins the sales demo main line: red here means the chain is stuck again.
    // `unit` must stay NOT NULL — it chains from required `product.mainUnit`; weakening that halves the gate.
    const line = (await genDb(DOMAINS)).files.find((f) => f.path === "salesDelivery.ts")?.content ?? "";
    expect(line).toContain('spec: text("spec"),');
    expect(line).toContain('unit: text("unit").notNull(),');
  });
});


function stockDecreaseCodesOf(schema: ModuleSchema): readonly string[] {
  const codes = new Set<string>();
  for (const edge of schema.lifecycle.transitions) {
    for (const effect of edge.effects) {
      if (effect.target !== "stock") continue;
      if (effect.op === "out") codes.add(edge.code);
      if (effect.op === "in") for (const code of effect.reverseOn) codes.add(code);
    }
  }
  return [...codes].sort();
}

function hasBlockingStockAvailability(schema: ModuleSchema, code: string): boolean {
  return schema.preconditions.some((rule) => {
    if (rule.level !== "block") return false;
    if (rule.onTransition !== code && rule.onTransition !== "*") return false;
    if (rule.check?.primitive !== "available_sufficient") return false;
    const params = rule.check.params as { readonly target?: string };
    return params.target === "stock";
  });
}

describe("Gate: stock-decreasing edges must attach available_sufficient", () => {
  it("🔴 stock out and reverseOn on stock in must hard-reject negative balance", async () => {
    const catalog = await loadCatalog({ domainsRoot: DOMAINS });
    const missing: string[] = [];
    for (const module of [...catalog.modules.values()].map((m) => m.schema).sort((a, b) => a.code.localeCompare(b.code))) {
      for (const code of stockDecreaseCodesOf(module)) {
        if (hasBlockingStockAvailability(module, code)) continue;
        missing.push(`${module.code}.${code}`);
      }
    }
    expect(
      missing,
      "\nAn edge that decreases stock has no available_sufficient block gate. Issuing stock or reversing a receipt would drive the balance negative. " +
        "The warehouse no longer offers a negative-stock switch. Add one the way stockOut.approve / stockIn.void do, level: block.\n",
    ).toEqual([]);
  });

});

/**
 * Hardcode **identity** — assertions compare only code, file, and text, not line number.
 *
 * Line number is incidental: pinning it means any edit above the hit fails the gate, and gates that
 * fail innocently get ignored.
 *
 * ⚠️ `text` must participate: it is the only way to tell two hits apart in the same file. When two
 * hits share the same `text` verbatim, **occurrence count** matters — array equality does not dedupe,
 * so an extra identical hardcode in the same file still fails.
 */
function hardcodeIdentity(h: { code: string; file: string; text: string }): {
  code: string;
  file: string;
  text: string;
} {
  return { code: h.code, file: h.file, text: h.text };
}

describe("Gate: module-code literal scanner", () => {
  it("🔴 omitting line number does not relax the gate — two identical hardcodes in one file still fail", () => {
    // With `line` out of the comparison, occurrence count is the only way to separate two identical hits.
    // This fixture runs once — whether `toEqual` collapses duplicate array elements is load-bearing.
    const one = `const bad = code === "product";`;
    const codes = new Set(["product"]);

    const single = findModuleCodesInSource([`const x = 1;`, one].join("\n"), "probe.tsx", codes);
    const twice = findModuleCodesInSource([`const x = 1;`, one, `const y = 2;`, one].join("\n"), "probe.tsx", codes);

    const identities = (hits: readonly { code: string; text: string }[]) =>
      hits.map((h) => hardcodeIdentity({ ...h, file: "probe.tsx" }));

    // ① Two verbatim hardcodes both remain — not folded into one row
    expect(identities(twice)).toEqual([
      { code: "product", file: "probe.tsx", text: one },
      { code: "product", file: "probe.tsx", text: one },
    ]);
    // ② Comparing to the single-hit baseline fails — that is the guard this test protects
    expect(identities(twice)).not.toEqual(identities(single));

    // ③ Same hardcode moved down by inserted lines — line number changes, identity does not ⇒ gate stays green
    const moved = findModuleCodesInSource(
      [`const x = 1;`, `// three lines were inserted above`, `// another line`, `// one more line`, one].join("\n"),
      "probe.tsx",
      codes,
    );
    expect(moved[0]?.line).not.toBe(single[0]?.line);
    expect(identities(moved)).toEqual(identities(single));
  });

});
