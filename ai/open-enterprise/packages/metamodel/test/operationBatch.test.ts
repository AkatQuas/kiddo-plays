import { describe, expect, it } from "vitest";
import {
  compileOperations,
  defineFixtureModule,
  OPERATION_BATCH_MAX_ITEMS,
  withPlannerExpansion,
} from "../src/index.js";

const module = defineFixtureModule({
  code: "batchContract",
  label: "Batch contract",
  domain: "demo",
  fields: [{ key: "code", label: "Code", type: "string", primary: true }],
  lifecycle: {
    statuses: [
      { key: "draft", label: "draft", initial: true },
      { key: "done", label: "Done", terminal: true },
    ],
    transitions: [
      { code: "finish", from: "draft", to: "done", action: "Finish" },
      { code: "plan", from: "draft", to: "done", action: "Plan generate" },
    ],
  },
  views: { list: { columns: ["code"] } },
});

describe("operation batch contract", () => {
  it("a standard single operator derives the collection-call contract, and the collection query itself is not wrapped in batch again", () => {
    const operations = compileOperations(module);
    const by = (name: string) => operations.find((operation) => operation.name === name)?.batch;
    expect(by("batchContract.get")).toEqual({
      selector: "explicit-items",
      transaction: "snapshot",
      maxItems: OPERATION_BATCH_MAX_ITEMS,
    });
    for (const name of ["create", "update", "delete"]) {
      expect(by(`batchContract.${name}`)).toEqual({
        selector: "explicit-items",
        transaction: "atomic",
        maxItems: OPERATION_BATCH_MAX_ITEMS,
      });
    }
    expect(by("batchContract.list")).toBeNull();
    expect(by("batchContract.explain")).toBeNull();
  });

  it("an ordinary transition batches atomically; a Planner edge only goes through explicit batchActions", () => {
    const expanded = withPlannerExpansion(module, new Set(["plan"]));
    const operations = compileOperations(expanded);
    expect(operations.find((operation) => operation.name === "batchContract.finish")?.batch)
      .toMatchObject({ transaction: "atomic" });
    expect(operations.find((operation) => operation.name === "batchContract.plan")?.batch).toBeNull();
  });
});
