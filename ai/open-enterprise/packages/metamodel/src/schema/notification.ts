// ---------------------------------------------------------------------------
// Custom notifications — rule declaration and checks
//
// "A message notification is not a module. It is a cross-cutting concern" (see FORBIDDEN_MODULE_KEYS in module.ts).
// The rule itself is tenant configuration, not a business document: no state machine, no ledger, no data scope.
// So it lives in a framework table. This file defines the shape, in the same family as moduleSetting / choiceSet.
//
// ## Boundary of this file
//
// Zero IO, no business names. No module code, status literal, or position name appears here.
// Words such as a purchase order, a crew, or production staff must not appear in this file — those are L2
// declarations under domains/. This file only defines how something may be declared.
//
// ## Two legs: normalize and check
//
// The same shape has two consumers. The criterion is the same and the failure mode is opposite:
//
//   · `normalizeNotificationPreset` — a preset written by a developer. A mistake fails fast
//     and throws, because that is a code defect and must not ship with a bad configuration.
//   · `checkNotificationRule` — a rule filled in by a user. Issues are collected and returned. It does not throw.
//     This is the source of truth for "the server says what is missing": the model follows the issues,
//     and the prompt does not copy a required-field list (a copy would drift).
// ---------------------------------------------------------------------------

import {
  assertClosedKeys,
  assertUniqueKeys,
  requireArray,
  requireObject,
  requireText,
  schemaFail,
} from "./common.js";
import { PERSON_ROLES, type PersonRole } from "./fields.js";

// ── Vocabulary ──────────────────────────────────────────────────────────────

export const NOTIFICATION_TRIGGER_KINDS = ["data_change", "schedule", "date_field"] as const;
export type NotificationTriggerKind = (typeof NOTIFICATION_TRIGGER_KINDS)[number];

export const NOTIFICATION_TRIGGER_TEXT: Readonly<Record<NotificationTriggerKind, string>> = Object.freeze({
  data_change: "Data change",
  schedule: "Scheduled",
  date_field: "By a time field",
});

export const NOTIFICATION_CHANGE_EVENTS = ["create", "update", "delete"] as const;
export type NotificationChangeEvent = (typeof NOTIFICATION_CHANGE_EVENTS)[number];

export const NOTIFICATION_CHANGE_EVENT_TEXT: Readonly<Record<NotificationChangeEvent, string>> = Object.freeze({
  create: "Create",
  update: "Edit",
  delete: "Delete",
});

export const NOTIFICATION_SCOPE_KINDS = ["module", "surface"] as const;
export type NotificationScopeKind = (typeof NOTIFICATION_SCOPE_KINDS)[number];

/** Three recipient sources. Distinct from the `person` declaration slot: here is what the rule selected, there is whether a field can be selected. */
/**
 * Four recipient sources.
 *
 * · `user`  named people: the value is an account, and every trigger goes to those people
 * · `dept`  a department: the value is an organization id, expanded to the people attached to that organization (including children) at that moment
 * · `role`  a role: expanded to the people holding that role at that moment
 * · `field` a person on the document: delivered to the actual person on each row at that moment
 *
 * 🔴 Both `dept` and `role` expand "as of that moment". The difference is what they expand from:
 * a department looks at the organization tree (where people belong), a role looks at authorization.
 * When the business says "notify production", they almost always mean the former — and when only
 * roles existed, they had to pick a role that happened to match, and the rule quietly sent to the
 * wrong people after the next transfer.
 */
export const NOTIFICATION_RECIPIENT_KINDS = ["user", "dept", "role", "field"] as const;
export type NotificationRecipientKind = (typeof NOTIFICATION_RECIPIENT_KINDS)[number];

export const NOTIFICATION_RULE_STATUSES = ["enabled", "disabled"] as const;
export type NotificationRuleStatus = (typeof NOTIFICATION_RULE_STATUSES)[number];

export const NOTIFICATION_RULE_STATUS_TEXT: Readonly<Record<NotificationRuleStatus, string>> = Object.freeze({
  enabled: "Enabled",
  disabled: "Disabled",
});

export const NOTIFICATION_RULE_SOURCES = ["manual", "agent", "preset"] as const;
export type NotificationRuleSource = (typeof NOTIFICATION_RULE_SOURCES)[number];

/**
 * Run result.
 *
 * 🔴 `throttled` is not a variant of success. It is a fifth result: the data matched and recipients were resolved,
 * but this round does not send because of the throttle rule. Folding it into any of the first four
 * means the troubleshooting page can no longer answer "I can see the product is below safety stock, so why did I not receive it" —
 * and that is the only reason the page exists.
 */
export const NOTIFICATION_RUN_RESULTS = ["success", "partial", "no_match", "throttled", "failed"] as const;
export type NotificationRunResult = (typeof NOTIFICATION_RUN_RESULTS)[number];

export const NOTIFICATION_RUN_RESULT_TEXT: Readonly<Record<NotificationRunResult, string>> = Object.freeze({
  success: "Succeeded",
  partial: "Partly succeeded",
  no_match: "No matching data",
  throttled: "Skipped by throttle",
  failed: "Failed",
});

/** What triggered the run. The execution log looks at auto by default — a manual debug must not pollute the troubleshooting view. */
export const NOTIFICATION_RUN_SOURCES = ["auto", "debug", "manual"] as const;
export type NotificationRunSource = (typeof NOTIFICATION_RUN_SOURCES)[number];

/**
 * Content length caps.
 *
 * 🔴 Classify before it reaches PostgreSQL: too long is a user input error and must be pinned to that cell.
 * A column constraint must not act as the validator and then be rewritten into a 400.
 */
export const NOTIFICATION_TITLE_MAX = 100;
export const NOTIFICATION_BODY_MAX = 5000;

/** Used when no message type is specified. Aligned with the first item of the `ops.messageType` dictionary. */
export const DEFAULT_MESSAGE_TYPE = "system";

/** A channel code is checked for shape only, not for membership — adding a channel is an L1 registration and must not come back and edit this file. */
const CHANNEL_CODE = /^[a-z][a-z0-9_]*$/;
/** Same for the message type: it is an L2 vocabulary. Adding a type changes neither the table nor this file. */
const MESSAGE_TYPE_CODE = /^[a-z][a-z0-9_]*$/;
const TIME_OF_DAY = /^([01]\d|2[0-3]):[0-5]\d$/;

// ── Rule shape ─────────────────────────────────────────────────────────────

export interface NotificationScope {
  readonly kind: NotificationScopeKind;
  /** The scope may select many. A single selection is an array of length 1, not a second shape. */
  readonly codes: readonly string[];
}

export interface DataChangeTrigger {
  readonly kind: "data_change";
  readonly events: readonly NotificationChangeEvent[];
  /** An empty array means any field change counts. Non-empty means only these cells changing will trigger. */
  readonly watchFields: readonly string[];
}

export interface ScheduleTrigger {
  readonly kind: "schedule";
  readonly at: string;
  /** 1=Monday … 7=Sunday. An empty array means every day. */
  readonly weekdays: readonly number[];
}

export interface DateFieldTrigger {
  readonly kind: "date_field";
  readonly field: string;
  readonly direction: "before" | "after";
  readonly offsetMinutes: number;
  /** null = fire at the exact instant; a value = send at this time of day on the day it comes due. */
  readonly atTime: string | null;
}

export type NotificationTrigger = DataChangeTrigger | ScheduleTrigger | DateFieldTrigger;

export interface NotificationContent {
  readonly title: string;
  readonly body: string | null;
  readonly link: string | null;
  /** One item from the L2 vocabulary. This file checks shape only. */
  readonly type: string;
}

export interface NotificationRecipient {
  readonly kind: NotificationRecipientKind;
  /** user → account id; role → role code; field → a field key on this module. */
  readonly value: string;
  /** Only when kind=field: which role of person. Default follows the field's own declaration. */
  readonly role: PersonRole | null;
  /** For display. Not the source of truth — when the person changes it must be resolved again, not sent from this text. */
  readonly label: string | null;
}

export interface NotificationThrottle {
  /** Do not remind again about the same row within this many hours. 0 = no throttle. */
  readonly perBillHours: number;
}

export interface NotificationRuleBody {
  readonly name: string;
  readonly scope: NotificationScope;
  readonly trigger: NotificationTrigger;
  /** QueryNode shape. The server deep-checks it against the target module (this package is zero IO and has no catalog). */
  readonly condition: unknown;
  readonly content: NotificationContent;
  readonly recipients: readonly NotificationRecipient[];
  readonly channels: readonly string[];
  readonly throttle: NotificationThrottle | null;
  /**
   * When many rows match, send one summary or one message per row.
   *
   * 🔴 This cell exists because of a measurement: a rule that runs daily matched 61 sales orders,
   * and the recipient got 61 in-app messages that day, the titles differing only by ${documentNo}.
   * They will not read the fourth. They will turn notifications off.
   * A schedule asks "how many match right now". The answer is one table, not 61 sentences.
   *
   * The default follows the trigger (see `defaultAggregate`): a schedule summarizes; a data change cannot summarize
   * (that firing is already one document); a time-field trigger defaults to one message per row — each document's
   * day differs, and the recipient is often a person on that document, so a summary washes out "this document is yours to handle".
   */
  readonly aggregate: boolean;
}

/**
 * When it was not stated, follow the trigger.
 *
 * 🔴 Old rules have no such cell. Reading them yields undefined, and that is this default.
 * The default must match what the user expected when they configured the rule, not what the implementation did then —
 * a schedule used to send one message per row, and nobody expected to receive 61.
 */
export function defaultAggregate(trigger: NotificationTrigger, content?: NotificationContent | null): boolean {
  if (trigger.kind !== "schedule") return false;
  // 🔴 An old rule's body may contain `${productName}` or `${documentNo}` — values that exist only on one message per row.
  // Forcing a summary sends the message with an unreplaced `${productName}` or `${documentNo}` still in the title,
  // and the recipient will think the system is broken. If the body has a per-row placeholder, leave it as-is until someone edits it.
  if (content === undefined || content === null) return true;
  return digestUnsafeTokens(content).length === 0;
}

/** Placeholders in this content that a summary message cannot fill. An empty array means it can be summarized. */
export function digestUnsafeTokens(content: NotificationContent): readonly string[] {
  const known = Object.keys(NOTIFICATION_DIGEST_TOKENS);
  const used = [...placeholdersOf(content.title), ...placeholdersOf(content.body ?? "")];
  return [...new Set(used.filter((token) => !known.includes(token)))];
}

/** Placeholders a summary message may use. Only these — a summary stands for N rows and has no single row's ${productName} or ${documentNo}. */
export const NOTIFICATION_DIGEST_TOKENS: Readonly<Record<string, string>> = Object.freeze({
  quantity: "number of matches",
  document: "document name in the scope",
  date: "date of this trigger",
});

// ── issues: what is missing, shown to the user ─────────────────────────────

export interface NotificationIssue {
  /** Points at one cell. The card marks the error under that control. */
  readonly path: string;
  readonly message: string;
}

export interface NotificationCheck {
  readonly ok: boolean;
  readonly issues: readonly NotificationIssue[];
  /** The normalized rule when the structure holds; null when it does not. */
  readonly rule: NotificationRuleBody | null;
}

class IssueBag {
  readonly items: NotificationIssue[] = [];
  add(path: string, message: string): void {
    this.items.push({ path, message });
  }
  get ok(): boolean {
    return this.items.length === 0;
  }
}

function textOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

// ── Placeholders ───────────────────────────────────────────────────────────

const PLACEHOLDER = /\$\{([^}]*)\}/g;

/**
 * Which names the template references.
 *
 * The returned names are verbatim. They may be a field key or a display label — this package does not know labels,
 * and resolution is the caller's job (it has the schema). Accepting only keys would force business users to memorize keys.
 */
export function placeholdersOf(template: string): readonly string[] {
  const found: string[] = [];
  for (const match of template.matchAll(PLACEHOLDER)) {
    const name = (match[1] ?? "").trim();
    if (name !== "" && !found.includes(name)) found.push(name);
  }
  return found;
}

/**
 * Replace placeholders from a lookup table.
 *
 * A name that is not found is kept as-is, not silently turned into an empty string: a sent message that still contains `${xxx}` looks bad,
 * but it can be seen and fixed. An empty string is a sentence that does not read, and nobody knows where it went wrong.
 */
export function renderTemplate(template: string, lookup: Readonly<Record<string, unknown>>): string {
  return template.replace(PLACEHOLDER, (whole, rawName: string) => {
    const name = rawName.trim();
    if (!(name in lookup)) return whole;
    const value = lookup[name];
    if (value === null || value === undefined) return "";
    return String(value);
  });
}

// ── check: user input ──────────────────────────────────────────────────────

function checkScope(raw: unknown, bag: IssueBag): NotificationScope | null {
  if (raw === undefined || raw === null) {
    bag.add("scope", "No scope yet — which document should this notification watch?");
    return null;
  }
  if (typeof raw !== "object") {
    bag.add("scope", "The scope is not in the right shape");
    return null;
  }
  const obj = raw as Record<string, unknown>;
  const kindRaw = obj["kind"];
  const kind: NotificationScopeKind =
    kindRaw === "surface" ? "surface" : "module";
  if (kindRaw !== undefined && kindRaw !== "module" && kindRaw !== "surface") {
    bag.add("scope.kind", "Scope kind can only be module or surface");
    return null;
  }
  const rawCodes = obj["codes"];
  const codes = Array.isArray(rawCodes) ? rawCodes.filter((c): c is string => typeof c === "string" && c.trim() !== "") : [];
  if (codes.length === 0) {
    bag.add("scope.codes", "No scope yet — which document should this notification watch?");
    return null;
  }
  const unique = [...new Set(codes.map((c) => c.trim()))];
  return { kind, codes: unique };
}

function checkTrigger(raw: unknown, bag: IssueBag): NotificationTrigger | null {
  if (raw === undefined || raw === null) {
    bag.add("trigger", "No trigger yet — a data change, a schedule, or a time field?");
    return null;
  }
  const obj = requireObjectSoft(raw);
  if (!obj) {
    bag.add("trigger", "The trigger is not in the right shape");
    return null;
  }
  const kind = obj["kind"];
  if (kind === "data_change") {
    const rawEvents = obj["events"];
    const events = Array.isArray(rawEvents)
      ? rawEvents.filter((e): e is NotificationChangeEvent =>
          (NOTIFICATION_CHANGE_EVENTS as readonly string[]).includes(e as string),
        )
      : [];
    if (events.length === 0) {
      bag.add("trigger.events", "Watch at least one of create, edit, or delete");
    }
    const rawWatch = obj["watchFields"];
    const watchFields = Array.isArray(rawWatch)
      ? [...new Set(rawWatch.filter((f): f is string => typeof f === "string" && f.trim() !== "").map((f) => f.trim()))]
      : [];
    if (events.length === 0) return null;
    return { kind: "data_change", events: [...new Set(events)], watchFields };
  }
  if (kind === "schedule") {
    const at = textOrNull(obj["at"]);
    if (at === null) {
      bag.add("trigger.at", "No time yet — what time of day should it send?");
      return null;
    }
    if (!TIME_OF_DAY.test(at)) {
      bag.add("trigger.at", `"${at}" is not a valid time. Write it like 09:00`);
      return null;
    }
    const rawDays = obj["weekdays"];
    const weekdays = Array.isArray(rawDays)
      ? [...new Set(rawDays.filter((d): d is number => typeof d === "number" && Number.isInteger(d) && d >= 1 && d <= 7))].sort()
      : [];
    return { kind: "schedule", at, weekdays };
  }
  if (kind === "date_field") {
    const field = textOrNull(obj["field"]);
    if (field === null) {
      bag.add("trigger.field", "No date field yet — which date should it count from?");
      return null;
    }
    const dirRaw = obj["direction"];
    const direction = dirRaw === "after" ? "after" : "before";
    if (dirRaw !== undefined && dirRaw !== "before" && dirRaw !== "after") {
      bag.add("trigger.direction", "It can only be before or after");
      return null;
    }
    const rawOffset = obj["offsetMinutes"];
    const offsetMinutes = typeof rawOffset === "number" && Number.isFinite(rawOffset) ? Math.trunc(rawOffset) : NaN;
    if (!Number.isFinite(offsetMinutes) || offsetMinutes < 0) {
      bag.add("trigger.offsetMinutes", "How long before or after is not set");
      return null;
    }
    const atTime = textOrNull(obj["atTime"]);
    // 🔴 The send time is required. Without it this rule runs every minute — the cell was already on the screen,
    // it was just allowed to be empty. Measured result: a delivery reminder with an empty time and no throttle
    // sent 1569 in-app messages in 6.6 hours, and the recipient accumulated 700+ unread.
    if (atTime === null) {
      bag.add("trigger.atTime", "No time of day yet — a reminder based on a time field must have a fixed send time");
      return null;
    }
    if (!TIME_OF_DAY.test(atTime)) {
      bag.add("trigger.atTime", `"${atTime}" is not a valid time. Write it like 09:00`);
      return null;
    }
    return { kind: "date_field", field, direction, offsetMinutes, atTime };
  }
  bag.add("trigger.kind", "The trigger can only be a data change, a schedule, or a time field");
  return null;
}

function checkContent(raw: unknown, bag: IssueBag): NotificationContent | null {
  const obj = requireObjectSoft(raw);
  if (!obj) {
    bag.add("content.title", "No notification content yet — what will the recipient see?");
    return null;
  }
  const title = textOrNull(obj["title"]);
  if (title === null) {
    bag.add("content.title", "No title yet — it is the first thing the recipient sees");
  } else if ([...title].length > NOTIFICATION_TITLE_MAX) {
    bag.add("content.title", `A title is at most ${String(NOTIFICATION_TITLE_MAX)} characters, and this one has ${String([...title].length)}`);
  }
  const body = textOrNull(obj["body"]);
  if (body !== null && [...body].length > NOTIFICATION_BODY_MAX) {
    bag.add("content.body", `A body is at most ${String(NOTIFICATION_BODY_MAX)} characters, and this one has ${String([...body].length)}`);
  }
  /**
   * Message type: the default is the system notification, and the screen no longer asks anyone to pick one.
   *
   * 🔴 It used to be required, and the cost was that every rule made the business pick among service / safety / activity / product —
   * they do not care about that classification, the pick does not change what the recipient sees,
   * and the stored value had no business meaning (one deployment still had 58 rows of `text`).
   * A required field that changes no behavior is pure friction.
   *
   * The four categories stay in the dictionary, for a future split of channels by type.
   * Configuration no longer has to specify one.
   */
  const rawType = textOrNull(obj["type"]);
  const type = rawType ?? DEFAULT_MESSAGE_TYPE;
  if (!MESSAGE_TYPE_CODE.test(type)) {
    bag.add("content.type", `Message type "${type}" has the wrong shape`);
  }
  if (title === null || type === null) return null;
  return { title, body, link: textOrNull(obj["link"]), type };
}

function checkRecipients(raw: unknown, bag: IssueBag): readonly NotificationRecipient[] | null {
  const list = Array.isArray(raw) ? raw : [];
  if (list.length === 0) {
    bag.add("recipients", "No one is set to receive this yet — who should get this reminder?");
    return null;
  }
  const out: NotificationRecipient[] = [];
  list.forEach((rawItem, index) => {
    const at = `recipients[${String(index)}]`;
    const item = requireObjectSoft(rawItem);
    if (!item) {
      bag.add(at, "This recipient is not in the right shape");
      return;
    }
    const kind = item["kind"];
    if (!(NOTIFICATION_RECIPIENT_KINDS as readonly unknown[]).includes(kind)) {
      bag.add(`${at}.kind`, "A recipient can only be a named person, a position, or a person field on the document");
      return;
    }
    const value = textOrNull(item["value"]);
    if (value === null) {
      bag.add(`${at}.value`, "This recipient does not say who it is yet");
      return;
    }
    const rawRole = item["role"];
    const role =
      typeof rawRole === "string" && (PERSON_ROLES as readonly string[]).includes(rawRole)
        ? (rawRole as PersonRole)
        : null;
    out.push({ kind: kind as NotificationRecipientKind, value, role, label: textOrNull(item["label"]) });
  });
  if (out.length === 0) return null;
  return out;
}

function checkChannels(raw: unknown, bag: IssueBag): readonly string[] | null {
  const list = Array.isArray(raw) ? raw.filter((c): c is string => typeof c === "string" && c.trim() !== "") : [];
  if (list.length === 0) {
    bag.add("channels", "No delivery channel yet");
    return null;
  }
  const unique = [...new Set(list.map((c) => c.trim()))];
  for (const code of unique) {
    if (!CHANNEL_CODE.test(code)) {
      bag.add("channels", `Delivery channel "${code}" has the wrong shape`);
      return null;
    }
  }
  return unique;
}

function checkThrottle(raw: unknown, bag: IssueBag): NotificationThrottle | null {
  if (raw === undefined || raw === null) return null;
  const obj = requireObjectSoft(raw);
  if (!obj) {
    bag.add("throttle", "The throttle setting is not in the right shape");
    return null;
  }
  const hours = obj["perBillHours"];
  if (typeof hours !== "number" || !Number.isFinite(hours) || hours < 0) {
    bag.add("throttle.perBillHours", "Throttle hours must be a number that is not less than 0");
    return null;
  }
  return { perBillHours: Math.trunc(hours) };
}

function requireObjectSoft(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/**
 * Check a rule the user filled in.
 *
 * 🔴 It does not throw. What is missing, and why, is written into issues for the caller to relay.
 * This is the source of truth for missing fields — the model asks from it. Do not copy the required-field list into the prompt again.
 */
export function checkNotificationRule(raw: unknown): NotificationCheck {
  const bag = new IssueBag();
  const obj = requireObjectSoft(raw);
  if (!obj) {
    bag.add("", "The rule is not in the right shape");
    return { ok: false, issues: bag.items, rule: null };
  }

  const name = textOrNull(obj["name"]);
  if (name === null) bag.add("name", "No name yet — the list recognizes this notification by it");

  const scope = checkScope(obj["scope"], bag);
  const trigger = checkTrigger(obj["trigger"], bag);
  const content = checkContent(obj["content"], bag);
  const recipients = checkRecipients(obj["recipients"], bag);
  const channels = checkChannels(obj["channels"], bag);
  const throttle = checkThrottle(obj["throttle"], bag);
  const aggregateRaw = obj["aggregate"];
  if (aggregateRaw !== undefined && aggregateRaw !== null && typeof aggregateRaw !== "boolean") {
    bag.add("aggregate", "Summarize into one message can only be yes or no");
  }
  // A data change is already one document, so a summary means nothing. Silently forcing false would make the user
  // think they checked it, and they would wait for a summary that never arrives
  if (trigger?.kind === "data_change" && aggregateRaw === true) {
    bag.add("aggregate", "A data-change trigger fires for one document, so there is nothing to summarize. This option matters only for a schedule and a time-field trigger");
  }

  if (!bag.ok || name === null || !scope || !trigger || !content || !recipients || !channels) {
    return { ok: false, issues: bag.items, rule: null };
  }
  const aggregate = typeof aggregateRaw === "boolean" ? aggregateRaw : defaultAggregate(trigger, content);
  if (aggregate) {
    // 🔴 A summary stands for N rows. `${productName}` and `${documentNo}` have no single row to read. Leaving them in
    // sends the message with an unreplaced `${productName}` or `${documentNo}` in the title — and by then it is already in the recipient's hands
    const known = Object.keys(NOTIFICATION_DIGEST_TOKENS);
    const bad = digestUnsafeTokens(content);
    if (bad.length > 0) {
      bag.add(
        "content",
        `When summarizing into one message, the body may use only ${known.map((token) => `\${${token}}`).join(", ")}; ` +
          `${bad.map((token) => `\${${token}}`).join(", ")} read a value from one row, and a summary has no single row`,
      );
      return { ok: false, issues: bag.items, rule: null };
    }
  }
  return {
    ok: true,
    issues: [],
    rule: {
      name,
      scope,
      trigger,
      condition: obj["condition"] ?? null,
      content,
      recipients,
      channels,
      throttle,
      aggregate,
    },
  };
}

// ── Presets: declarations written by developers ────────────────────────────

export interface NotificationPresetSchema extends NotificationRuleBody {
  /** Stable identity, unique across the product. The tenant database uses it to decide whether this one has already been seeded. */
  readonly code: string;
}

const PRESET_CODE = /^[a-z][A-Za-z0-9]*(?:\.[a-z][A-Za-z0-9-]*)+$/;
const PRESET_KEYS = [
  "code",
  "name",
  "scope",
  "trigger",
  "condition",
  "content",
  "recipients",
  "channels",
  "throttle",
  "aggregate",
] as const;

/**
 * A preset notification declaration.
 *
 * 🔴 A mistake fails fast — this is code a developer wrote, not a form a user filled in. Shipping a bad preset
 * shows up as "some tenant's notification never sends", and nobody goes looking.
 */
export function normalizeNotificationPreset(raw: unknown, at = "notificationPreset"): NotificationPresetSchema {
  const obj = requireObject(raw, at);
  assertClosedKeys(obj, PRESET_KEYS, at);
  const code = requireText(obj["code"], `${at}.code`);
  if (!PRESET_CODE.test(code)) {
    schemaFail(`${at}.code "${code}" must be dotted (for example inventory.safety-stock)`);
  }
  const checked = checkNotificationRule(obj);
  if (!checked.ok || checked.rule === null) {
    const detail = checked.issues.map((issue) => `${issue.path || "(root)"}: ${issue.message}`).join("; ");
    schemaFail(`${at} declaration does not hold — ${detail}`);
  }
  return { code, ...checked.rule };
}

export function defineNotificationPresets(raw: unknown, at = "notifications"): readonly NotificationPresetSchema[] {
  const list = requireArray(raw, at).map((item, index) => normalizeNotificationPreset(item, `${at}[${String(index)}]`));
  assertUniqueKeys(list.map((preset) => preset.code), `${at}.code`);
  return list;
}

// ── Plain-language rendering: list columns use it directly. The frontend does not parse jsonb.

export function triggerLabelOf(trigger: NotificationTrigger, fieldLabel?: (key: string) => string): string {
  if (trigger.kind === "data_change") {
    const events = trigger.events.map((event) => NOTIFICATION_CHANGE_EVENT_TEXT[event]).join(" / ");
    if (trigger.watchFields.length === 0) return events;
    const fields = trigger.watchFields.map((key) => (fieldLabel ? fieldLabel(key) : key)).join(", ");
    return `${events} (only ${fields})`;
  }
  if (trigger.kind === "schedule") {
    const days =
      trigger.weekdays.length === 0
        ? "Every day"
        : trigger.weekdays.map((day) => ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][day - 1] ?? String(day)).join(", ");
    return `${days} ${trigger.at}`;
  }
  const label = fieldLabel ? fieldLabel(trigger.field) : trigger.field;
  const hours = trigger.offsetMinutes / 60;
  const span =
    Number.isInteger(hours) && hours >= 1
      ? `${String(hours)} hour${hours === 1 ? "" : "s"}`
      : `${String(trigger.offsetMinutes)} minute${trigger.offsetMinutes === 1 ? "" : "s"}`;
  const dir = trigger.direction === "before" ? "before" : "after";
  const tail = trigger.atTime === null ? "" : ` sent at ${trigger.atTime}`;
  return `${label} ${span} ${dir}${tail}`;
}

export function recipientLabelOf(recipients: readonly NotificationRecipient[]): string {
  return recipients
    .map((recipient) => recipient.label ?? recipient.value)
    .join(", ");
}
