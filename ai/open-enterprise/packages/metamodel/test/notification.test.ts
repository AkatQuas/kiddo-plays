import { describe, expect, it } from "vitest";
import {
  checkNotificationRule,
  defineNotificationPresets,
  normalizeField,
  placeholdersOf,
  renderTemplate,
  triggerLabelOf,
  NOTIFICATION_TITLE_MAX,
} from "../src/index.js";

/*:: A structured rule, with an example of one place above it */
function goodRule(patch: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name: "Purchase order approved",
    scope: { kind: "module", codes: ["purchaseOrder"] },
    trigger: { kind: "data_change", events: ["update"], watchFields: ["status"] },
    condition: null,
    content: { title: "Purchase order approved", body: "Number ${code}", link: null, type: "service" },
    recipients: [{ kind: "field", value: "createdBy", role: "creator", label: "Document creator" }],
    channels: ["station_letter"],
    throttle: { perBillHours: 24 },
    ...patch,
  };
}

describe("deficiencies in the rules on notice", () => {
  it("passes when structure is complete, does not produce", () => {
    const checked = checkNotificationRule(goodRule());
    expect(checked.issues).toEqual([]);
    expect(checked.ok).toBe(true);
    expect(checked.rule?.name).toBe("Purchase order approved");
  });

  // 🔴 This group is the "what's missing is said by the service" payback: the model follows the path and asks:
  // there is no longer a required list in the reminder. With one exception, the dialogue would be stuck in that cell without any reason.
  it.each([
    ["name", { name: "" }],
    ["scope.codes", { scope: { kind: "module", codes: [] } }],
    ["trigger", { trigger: null }],
    ["content.title", { content: { title: "", body: null, link: null, type: "service" } }],
    ["recipients", { recipients: [] }],
    ["channels", { channels: [] }],
  ])("a missing %s names the cell", (path, patch) => {
    const checked = checkNotificationRule(goodRule(patch));
    expect(checked.ok).toBe(false);
    expect(checked.rule).toBeNull();
    expect(checked.issues.map((issue) => issue.path)).toContain(path);
  });

  it("every issue speaks human language, doesn't spit fields. First Name", () => {
    const checked = checkNotificationRule(goodRule({ recipients: [] }));
    const message = checked.issues.find((issue) => issue.path === "recipients")?.message ?? "";
    expect(message).toContain("who should get");
    expect(message).not.toContain("recipients");
  });

  it("the title is too long by character, not by by bytes", () => {
    const title = "Warehouse".repeat(NOTIFICATION_TITLE_MAX + 1);
    const checked = checkNotificationRule(goodRule({ content: { title, body: null, link: null, type: "service" } }));
    expect(checked.issues.map((issue) => issue.path)).toContain("content.title");
  });

  it("each of the three triggers must be separated.", () => {
    expect(
      checkNotificationRule(goodRule({ trigger: { kind: "data_change", events: [] } })).issues.map((i) => i.path),
    ).toContain("trigger.events");
    expect(
      checkNotificationRule(goodRule({ trigger: { kind: "schedule", at: "9:00" } })).issues.map((i) => i.path),
    ).toContain("trigger.at");
    expect(
      checkNotificationRule(goodRule({ trigger: { kind: "date_field", direction: "before", offsetMinutes: 1440 } }))
        .issues.map((i) => i.path),
    ).toContain("trigger.field");
  });

  it("the field is multi-selected, and the single selection is a number of 1 lengths Group", () => {
    const one = checkNotificationRule(goodRule());
    expect(one.rule?.scope.codes).toEqual(["purchaseOrder"]);
    const many = checkNotificationRule(goodRule({ scope: { kind: "module", codes: ["purchaseOrder", "salesOrder"] } }));
    expect(many.rule?.scope.codes).toEqual(["purchaseOrder", "salesOrder"]);
  });
});

describe("placeholder", () => {
  it("recognized which names were cited in the template.", () => {
    expect(placeholdersOf("${productName} below ${safetyStockQty}, ${documentNo}")).toEqual(["productName", "safetyStockQty", "documentNo"]);
  });

  // 🔴 I can't find it. An empty string would get a message that doesn't make sense, and no one knows what's wrong.
  it("the untraceable name is kept in its original form, and it's swallowed up in silence.", () => {
    expect(renderTemplate("Number ${code} was submitted by ${who}", { code: "PO-001" })).toBe("Number PO-001 was submitted by ${who}");
  });

  it("rendering empty string when value is nulla", () => {
    expect(renderTemplate("Remark: ${remark}", { remark: null })).toBe("Remark: ");
  });
});

describe("people who trigger conditions", () => {
  it("list column uses it directly, the front end does not resolve jsonb", () => {
    expect(triggerLabelOf({ kind: "schedule", at: "09:00", weekdays: [] })).toBe("Every day 09:00");
    expect(triggerLabelOf({ kind: "schedule", at: "08:30", weekdays: [1, 5] })).toBe("Mon, Fri 08:30");
    expect(
      triggerLabelOf({ kind: "data_change", events: ["create", "update"], watchFields: [] }),
    ).toBe("Create / Edit");
    expect(
      triggerLabelOf(
        { kind: "date_field", field: "planDate", direction: "before", offsetMinutes: 1440, atTime: null },
        () => "Planned delivery date",
      ),
    ).toBe("Planned delivery date 24 hours before");
  });
});

describe("preset declaration", () => {
  it("development error is fail past - preset is code, not user input", () => {
    expect(() => defineNotificationPresets([{ ...goodRule(), code: "inventory.safety-stock", recipients: [] }])).toThrow(
      /recipients/,
    );
  });

  it("code must be dotted", () => {
    expect(() => defineNotificationPresets([{ ...goodRule(), code: "safetystock" }])).toThrow(/dotted/);
  });

  it("in the same batch, code, do not repeat.", () => {
    const one = { ...goodRule(), code: "inventory.safety-stock" };
    expect(() => defineNotificationPresets([one, one])).toThrow();
  });
});

describe("person: a \"person\" statement on a field", () => {
  it("all three of them.", () => {
    const self = normalizeField({
      key: "manager",
      label: "Equipment owner",
      type: "string",
      person: { role: "owner", via: "self" },
    });
    expect(self.person).toEqual({ role: "owner", via: "self" });

    const followed = normalizeField({
      key: "workerId",
      label: "Staff",
      type: "ref",
      ref: "worker",
      person: { role: "receiver", via: { ref: "worker", field: "platformUserId" } },
    });
    expect(followed.person?.via).toEqual({ ref: "worker", field: "platformUserId" });

    // a pair that falls on this one: "Soldiers are many people."
    const members = normalizeField({
      key: "teamId",
      label: "Team",
      type: "ref",
      ref: "productionOrg",
      person: { role: "receiver", via: { members: "worker", by: "productionOrgId", field: "platformUserId" } },
    });
    expect(members.person?.via).toEqual({ members: "worker", by: "productionOrgId", field: "platformUserId" });
  });

  it("no statement that the person field has been given the nulla -- it will not appear in the recipient 's candidacy Lee.", () => {
    expect(normalizeField({ key: "buyer", label: "Buyer", type: "string" }).person ?? null).toBeNull();
  });

  // 🔴 Hanging on to unmanageable grids to report errors on the spot. If we don't, we'll be able to decipher the empty recipient at the moment of the notification.
  // and no one will come back to read the statement.
  it("hang on to number one, report on the spot.", () => {
    expect(() =>
      normalizeField({ key: "qty", label: "Quantity", type: "number", person: { role: "owner", via: "self" } }),
    ).toThrow(/may be attached only to a string or ref field/);
  });

  it("when the shape is wrong, write correctly", () => {
    expect(() =>
      normalizeField({ key: "who", label: "Who", type: "string", person: { role: "owner", via: { nope: 1 } } }),
    ).toThrow(/self/);
  });
});
