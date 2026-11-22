// a well-shaped **bare object**: not passed through defineModule, and it carries the derived key `postsToLedger: false`.
// this is exactly the criterion for "is a duck check enough" — it has a lifecycle and fields,
// a shape-level duck check lets it through as-is, and the consequence is that "posting requires confirmation" is silently turned off.
export default {
  label: "alpha",
  fields: [
    { key: "code", label: "number", type: "string", primary: true },
    { key: "supplierId", label: "supplier", type: "ref", ref: "supplier", required: true },
    { key: "amount", label: "amount", type: "money", required: true },
  ],
  lifecycle: {
    statuses: [
      { key: "draft", label: "draft", initial: true },
      { key: "done", label: "done", terminal: true },
    ],
    transitions: [
      {
        code: "post",
        from: "draft",
        to: "done",
        action: "post",
        postsToLedger: false,
        effects: [{ target: "ap", op: "in", subject: "$bill.supplierId", amount: "{amount}", reverseOn: [] }],
      },
    ],
  },
  views: { list: { columns: ["code"] } },
};
