// ---------------------------------------------------------------------------
// value shape for attachment
//
// this one was empty: the watchlock against the attachment all over, for reasons written in AGENTS.md...
// "One set of shapes will immediately become the second real source." After the shapes are declared, this one with the pattern is:
// ** The statement is the same as that of the consumer** and several "wrong without symptoms" borders.
// ---------------------------------------------------------------------------

import { describe, expect, it } from "vitest";
import {
  ATTACHMENT_MAX_COUNT,
  attachmentSitesOf,
  attachmentsOf,
  canonicalAttachmentContentType,
  checkAttachmentValue,
  checkBillPatch,
  checkNewBill,
  formatAttachmentSize,
  isInlineSafeContentType,
  normalizeFixtureModule,
  type AttachmentRef,
  type ModuleSchema,
} from "../src/index.js";

const REF: AttachmentRef = {
  key: "oe/t-1/doc/contract/202607/9f0c2a1e",
  name: "framework-contract.pdf",
  size: 1_482_301,
  contentType: "application/pdf",
  uploadedAt: "2026-07-01T09:31:00.000Z",
};

function schema(): ModuleSchema {
  return normalizeFixtureModule({
    code: "doc",
    label: "Document",
    domain: "fx",
    fields: [
      { key: "title", label: "Title", type: "string", required: true, primary: true },
      { key: "contract", label: "Contract files", type: "attachment" },
      { key: "seal", label: "Required file", type: "attachment", required: true },
      {
        key: "lines",
        label: "Lines",
        type: "subtable",
        ref: "docLine",
        fields: [
          { key: "note", label: "Note", type: "string" },
          { key: "photos", label: "Site photos", type: "attachment" },
        ],
      },
    ],
    lifecycle: {
      statuses: [{ key: "draft", label: "draft", initial: true, terminal: true, editable: "full" }],
      transitions: [],
    },
    views: { list: { columns: ["title"] } },
  });
}

describe("value shape: one attachment is a group** files**", () => {
  it("many are the shape of the value itself.", () => {
    const second: AttachmentRef = { ...REF, key: `${REF.key}-2`, name: "acceptance-standard.pdf" };
    const checked = checkAttachmentValue([REF, second]);
    expect(checked.ok).toBe(true);
    if (!checked.ok) return;
    expect(checked.value.map((r) => r.name)).toEqual(["framework-contract.pdf", "acceptance-standard.pdf"]);
  });

  it("🔴 Rebuild in the declared key order. Do not take the client's copy as it is.", () => {
    // jsonb Keeps the key order: the same content will be given two values because the key order is different.
    // and they look like two different modifications in fingerprints like diff / audit / chalk.
    const scrambled = {
      uploadedAt: REF.uploadedAt,
      size: REF.size,
      name: REF.name,
      contentType: REF.contentType,
      key: REF.key,
    };
    const checked = checkAttachmentValue([scrambled]);
    expect(checked.ok).toBe(true);
    if (!checked.ok) return;
    expect(Object.keys(checked.value[0] ?? {})).toEqual(["key", "name", "size", "contentType", "uploadedAt"]);
  });

  it("the extra key is a refusal, not a silent abandonment -- discard will make the caller think he saved it.", () => {
    const checked = checkAttachmentValue([{ ...REF, url: "https://evil.example/x" }]);
    expect(checked.ok).toBe(false);
    if (checked.ok) return;
    expect(checked.reason).toContain("url");
  });

  it("🔴 Object keys walk closed character sets: path travel, leading slash, blanks rejected", () => {
    for (const key of ["../other-tenant/x", "/oe/t-1/x", "oe/t-1/x y", "oe/t-1/x\nSet-Cookie: a"]) {
      const checked = checkAttachmentValue([{ ...REF, key }]);
      expect(checked.ok, `key "${key}" must not pass`).toBe(false);
    }
  });

  it("the same key appears twice to be rejected: deleting one of the interfaces becomes meaningless.", () => {
    const checked = checkAttachmentValue([REF, { ...REF, name: "another-name.pdf" }]);
    expect(checked.ok).toBe(false);
  });

  it("quantities have upper bounds - values are derived from browsers and models, and an array of 100,000 bars does not violate the shape of any single element", () => {
    const many = Array.from({ length: ATTACHMENT_MAX_COUNT + 1 }, (_, i) => ({ ...REF, key: `${REF.key}-${String(i)}` }));
    expect(checkAttachmentValue(many).ok).toBe(false);
  });

  it("size and time stamp shape, one short, no.", () => {
    expect(checkAttachmentValue([{ ...REF, size: -1 }]).ok).toBe(false);
    expect(checkAttachmentValue([{ ...REF, size: 1.5 }]).ok).toBe(false);
    expect(checkAttachmentValue([{ ...REF, uploadedAt: "last week" }]).ok).toBe(false);
    expect(checkAttachmentValue([{ ...REF, name: "  " }]).ok).toBe(false);
  });

  it("🔴 ** Not judged** content type is not on the white list: a narrow upload rule should not make inventory documents illegal", () => {
    // the white list is the gate of the portal. If it's in a value shape, one of the types will be removed.
    // a collection of documents that already exist in the library will be rejected at the next time they are saved, and the user has not changed anything.
    const checked = checkAttachmentValue([{ ...REF, contentType: "application/x-not-in-list" }]);
    expect(checked.ok).toBe(true);
    // The shape still has to be a mime. `"contract"` is a value no consumer understands.
    expect(checkAttachmentValue([{ ...REF, contentType: "contract" }]).ok).toBe(false);
  });
});

describe("white list of content types", () => {
  it("parameters after suffix are removed and then compared: Browser will bring charset, and the whole string is \"txt rejected\"", () => {
    expect(canonicalAttachmentContentType("text/plain; charset=utf-8")).toBe("text/plain");
    expect(canonicalAttachmentContentType("IMAGE/PNG")).toBe("image/png");
  });

  it("🔴 SVG is not on the white list: it's a document with scripts, not pictures.", () => {
    expect(canonicalAttachmentContentType("image/svg+xml")).toBeNull();
    expect(isInlineSafeContentType("image/svg+xml")).toBe(false);
  });

  it("🔴 The type you don't know can't be connected.", () => {
    expect(isInlineSafeContentType("text/html")).toBe(false);
    expect(isInlineSafeContentType("application/pdf")).toBe(false);
    expect(isInlineSafeContentType("image/png")).toBe(true);
  });
});

describe("bond: According to this statement, the data is invalid.", () => {
  it("shape does not constitute field by field report ATTACHMENT MALFORMED, not an anomaly", () => {
    const check = checkNewBill(schema(), { title: "T", seal: [REF], contract: "a contract" }, {});
    expect(check.ok).toBe(false);
    if (check.ok) return;
    const issue = check.issues.find((i) => i.path === "contract");
    expect(issue?.code).toBe("ATTACHMENT_MALFORMED");
    expect(issue?.message).toContain("Contract files");
  });

  it("🔴 The empty array is the same as the Null harvest.", () => {
    const check = checkNewBill(schema(), { title: "T", seal: [REF], contract: [] }, {});
    expect(check.ok).toBe(true);
    if (!check.ok) return;
    expect(check.header["contract"]).toBeNull();
  });

  it("🔴 You have to fill in the empty attachment grid and you can't go all the way to the column. Let's go.", () => {
    // If you don't harvest, `isEmptyValue([])` It's false lycées that will fill in the release
    // drop an empty array into the NOT NULL column (or drop into the second "unfilled" column)
    const check = checkNewBill(schema(), { title: "T", seal: [] }, {});
    expect(check.ok).toBe(false);
    if (check.ok) return;
    expect(check.issues.find((i) => i.path === "seal")?.code).toBe("REQUIRED_BLANK");
  });

  it("it's the same thing with the details.", () => {
    const check = checkNewBill(
      schema(),
      { title: "T", seal: [REF] },
      { lines: [{ note: "Row one", photos: [{ ...REF, size: "large" }] }] },
    );
    expect(check.ok).toBe(false);
    if (check.ok) return;
    expect(check.issues[0]?.path).toBe("lines[0].photos");
    expect(check.issues[0]?.code).toBe("ATTACHMENT_MALFORMED");
  });

  it("the attachment key that did not appear in the Patch file is not determined -- the value is not moving Pass.", () => {
    const check = checkBillPatch(schema(), { title: "Retitle" }, null);
    expect(check.ok).toBe(true);
  });
});

describe("attachmentSitesof: kernel says which coordinates should be checked, server.", () => {
  it("the result of missing the half of the line is over-authorization.", () => {
    const line = { ...REF, key: "oe/t-1/doc/lines.photos/202607/abcd" };
    const sites = attachmentSitesOf(
      schema(),
      { contract: [REF] },
      { lines: [{ photos: [line] }, { photos: null }] },
    );
    expect(sites.map((s) => s.path)).toEqual(["contract", "lines[0].photos"]);
    expect(sites[1]?.refs[0]?.key).toBe(line.key);
    expect(sites[1]?.label).toContain("line 1");
  });

  it("unvalued coordinates do not appear.", () => {
    expect(attachmentSitesOf(schema(), {}, {})).toEqual([]);
    expect(attachmentSitesOf(schema(), { contract: null }, {})).toEqual([]);
  });
});

describe("read an attachment value that has dropped", () => {
  it("if you can't get it out, throw it, and it doesn't degrade into an empty array -- degradation will describe the dirty data as \"this list has no attachment.\"", () => {
    expect(() => attachmentsOf({ key: "x" }, "doc.contract")).toThrow(/does not hold/);
    expect(attachmentsOf(null, "doc.contract")).toEqual([]);
  });
});

describe("file size for humans: list, read-only, common control", () => {
  it("slotting", () => {
    expect(formatAttachmentSize(512)).toBe("512 B");
    expect(formatAttachmentSize(2048)).toBe("2.0 KB");
    expect(formatAttachmentSize(1_482_301)).toBe("1.4 MB");
  });
});
