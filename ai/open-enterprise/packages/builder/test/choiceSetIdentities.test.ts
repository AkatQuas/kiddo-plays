import { describe, expect, it } from "vitest";
import {
  assertChoiceSetIdentityEvolution,
  type ChoiceSetIdentityManifest,
} from "../src/choiceSetIdentities.js";

function manifest(
  items: readonly { readonly code: string; readonly retired: boolean }[],
): ChoiceSetIdentityManifest {
  return { version: 1, choiceSets: [{ code: "sales.orderSource", items }] };
}

describe("choiceSet stable-identity upgrade gate", () => {
  it("allows appending an identity, and does not use the upgrade gate to introduce a product-wide disable", () => {
    expect(() => assertChoiceSetIdentityEvolution(
      manifest([{ code: "retail", retired: false }]),
      manifest([{ code: "retail", retired: false }, { code: "b2b", retired: false }]),
    )).not.toThrow();
  });

  it("rejects deleting a published stable code", () => {
    expect(() => assertChoiceSetIdentityEvolution(
      manifest([{ code: "retail", retired: false }]),
      manifest([]),
    )).toThrow('Stable code "retail" of product dictionary "sales.orderSource" cannot be deleted; a published product item must be kept forever, and business enable/disable is maintained by the tenant');
  });

  it("rejects turning an active product item into retired, so a product upgrade does not clear the tenant's candidates", () => {
    expect(() => assertChoiceSetIdentityEvolution(
      manifest([{ code: "retail", retired: false }]),
      manifest([{ code: "retail", retired: true }]),
    )).toThrow(/active → retired.*business enable\/disable is maintained by the tenant/);
  });

  it("rejects reviving or reusing a tombstone that was retired when it was first registered", () => {
    expect(() => assertChoiceSetIdentityEvolution(
      manifest([{ code: "retail", retired: true }]),
      manifest([{ code: "retail", retired: false }]),
    )).toThrow(/retired → active/);
  });

  it("rejects deleting an entire product dictionary", () => {
    expect(() => assertChoiceSetIdentityEvolution(
      manifest([{ code: "retail", retired: false }]),
      { version: 1, choiceSets: [] },
    )).toThrow(/Product dictionary.*cannot be deleted/);
  });
});
