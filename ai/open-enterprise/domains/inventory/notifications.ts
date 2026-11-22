import { defineNotificationPresets } from "@open-erp/metamodel";

/**
 * Preset notifications for the inventory domain.
 *
 * The declaration is a seed. The row in the tenant database is the source of truth.
 * Seeding writes a code only when it is missing: after a plant changes the recipient
 * or the body, an upgrade does not put the original back. To stop it, disable it.
 * Deleting it only makes the next startup seed it again, and the user will think it cannot be deleted.
 */
export default defineNotificationPresets([
  {
    code: "inventory.safety-stock",
    name: "Stock warning",
    // The rule lives on the query surface (`stockBelowSafety`). The notification engine
    // does not need to know what "stock" means.
    scope: { kind: "surface", codes: ["stockBelowSafety"] },
    trigger: { kind: "schedule", at: "09:00", weekdays: [] },
    condition: null,
    content: {
      title: "Stock warning: ${quantity} products are at or below safety stock",
      body: "These products are at or below safety stock. Replenish them.",
      link: "/_stock-query",
      type: "system",
    },
    // "System administrator" is the tenant-admin role in local RBAC.
    recipients: [{ kind: "role", value: "tenant-admin", label: "System administrator" }],
    channels: ["station_letter"],
    /**
     * One summary, not one message per product.
     *
     * This used to send one letter per row. Thirty products below safety stock meant
     * thirty nearly identical in-app letters. Nobody reads past the third one; they turn
     * notifications off. The whole reason this preset exists is so replenishment is not missed.
     */
    aggregate: true,
    /**
     * No throttle after aggregation.
     *
     * This used to be `{ perBillHours: 24 }`, which blocked "the same product every day".
     * The schedule now sends one summary a day. Throttle does not apply on that path
     * (it dedupes by document, and a summary is not attached to one document).
     * Leaving it in place is a setting that does nothing.
     */
    throttle: null,
  },
]);
