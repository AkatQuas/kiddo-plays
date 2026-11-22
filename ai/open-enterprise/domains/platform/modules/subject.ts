import { defineModule } from "@open-erp/metamodel";

/**
 * Accounts that can sign in. Directory sync writes this module. The row id is the platform
 * userId and does not go through createBill.
 * One platform account may join several tenants. A directory row is identified by tenantId + id.
 *
 * Manual create is off in capabilities. `sourceSyncedAt` is required and systemGenerated: it is
 * the time directory sync wrote the row.
 * Every status is editable none, and save is refused. disable / enable are internal occupancy
 * edges, not buttons for a person.
 */
export default defineModule({
  label: "System accounts",
  capabilities: { create: false, export: false },

  fields: [
    { key: "userName", label: "Platform account name", type: "string", required: true, primary: true },
    { key: "displayName", label: "Platform display name", type: "string", required: true },
    {
      key: "sourceSyncedAt",
      label: "Directory sync time",
      type: "datetime",
      required: true,
      systemGenerated: true,
      help: "Time written by directory sync",
    },
    { key: "firstSeenAt", label: "First seen", type: "datetime" },
    { key: "lastSeenAt", label: "Last seen", type: "datetime" },
  ],

  lifecycle: {
    statuses: [
      { key: "active", label: "Active", color: "green", initial: true, editable: "none" },
      { key: "disabled", label: "Left", color: "gray", editable: "none" },
    ],
    transitions: [
      { code: "disable", from: "active", to: "disabled", action: "Mark as left", internal: true },
      { code: "enable", from: "disabled", to: "active", action: "Reinstate", internal: true },
    ],
  },

  views: {
    list: {
      columns: ["userName", "displayName", "sourceSyncedAt", "firstSeenAt", "lastSeenAt"],
      // Person references on business documents (salesperson, buyer, and so on) show name and
      // phone so two accounts with the same name can be told apart. The stored value is still the subject id.
      referenceLabel: ["displayName", "userName"],
      referenceLabelSeparator: "-",
      filters: ["status"],
      searchable: ["userName", "displayName"],
      defaultSort: { field: "createdAt", desc: true },
    },
    form: [
      { title: "Account", fields: ["userName", "displayName", "sourceSyncedAt", "firstSeenAt", "lastSeenAt"] },
    ],
  },
});
