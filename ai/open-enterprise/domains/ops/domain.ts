import { defineDomain } from "@open-erp/metamodel";

// Support domain: only the shared in-app agents and skills (meta-operation scripts). No documents.
// `modules: false` must be written out. Inferring "no modules/ means a support domain" would turn
// a typo in `modules` into a silent zero-module domain.
export default defineDomain({
  label: "Operations",
  modules: false,
  choiceSets: [
    {
      // In-app message types are a word list, not a database check constraint.
      // Adding a type should not come back as a table change or a framework change.
      // `oe_notification_message.type` deliberately has no check (see the note in db/framework.ts).
      code: "ops.messageType",
      label: "Message type",
      items: [
        // `system` is first and is the default. Someone configuring a notification does not care
        // whether a row is "service" or "activity", and forcing a choice only picks the wrong one.
        // The other four stay for a future split by channel.
        { code: "system", label: "System notice" },
        { code: "service", label: "Service message" },
        { code: "security", label: "Security message" },
        { code: "activity", label: "Activity message" },
        { code: "product", label: "Product message" },
      ],
    },
  ],
});
