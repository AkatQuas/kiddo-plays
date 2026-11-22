// ---------------------------------------------------------------------------
// OR-branch plan for a multi-keyword search
//
// A mistake at this layer does not throw. It only drops a few words, and the
// empty result looks the same as "there really is nothing". The criterion is
// pinned here; the caller is not expected to notice.
// ---------------------------------------------------------------------------

import { describe, expect, it } from "vitest";
import { searchBranches, searchPhraseTerms } from "../src/repo/queryCompiler.js";

describe("searchBranches", () => {
  const cols = ["code", "name", "spec", "barcode"];

  it("one word: the same shape as before, one branch per searchable column", () => {
    expect(searchBranches(["alpha"], cols)).toEqual([
      { term: "alpha", key: "code" },
      { term: "alpha", key: "name" },
      { term: "alpha", key: "spec" },
      { term: "alpha", key: "barcode" },
    ]);
  });

  it("a batch of words is word × column, and none may be dropped", () => {
    const terms = ["alpha", "beta", "gamma"];
    const out = searchBranches(terms, cols);
    expect(out).toHaveLength(terms.length * cols.length);
    // Every word must appear on every column. Dropping a word is the silent "we looked, and it is not there".
    for (const term of terms) {
      expect(out.filter((b) => b.term === term).map((b) => b.key)).toEqual(cols);
    }
  });

  it("no words means no branches (the caller adds no condition, rather than a constantly false one)", () => {
    expect(searchBranches([], cols)).toEqual([]);
  });
});

describe("searchPhraseTerms", () => {
  it("splits a reference-dropdown phrase on consecutive whitespace", () => {
    expect(searchPhraseTerms("  classic22button(full-steel)  2.12.03002301\tfull-steel  ")).toEqual([
      "classic22button(full-steel)",
      "2.12.03002301",
      "full-steel",
    ]);
  });

  it("an all-blank phrase produces no search terms", () => {
    expect(searchPhraseTerms(" \t\n ")).toEqual([]);
  });
});
