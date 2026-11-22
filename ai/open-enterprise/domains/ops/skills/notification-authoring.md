---
name: notification-authoring
description: Configure a custom notification: when, to whom, and what. Load on demand. Explains the rule shape, the question order, and how to debug.
version: 1.0.0
triggerWords: [custom notification, set a reminder, scheduled reminder, due-date reminder, stock alert, debug a notification, notification rule]
---

# Configure one custom notification

## First action: show the form. Do not talk first

When the user says "configure a custom notification" or "new notification", the **first action is `notification_rule_preview`** (`rule` may be half filled, or empty). The return includes `ui`, and the host renders the form card.

Do **not** reply "I opened the form" or "tell me which document to watch" and call nothing. The user then sees a sentence and a blank page. The button was asking for the form.
The failure looks like "create did not return a form; it said the form was already open". That sentence causes it.

Do **not** also hand-write a ```open-agent-ui fence. The tool return already has `ui`. A hand-written card makes two identical forms.

## A rule states four things

**When.** **Which document.** **What to send.** **Who receives it.** A rule missing any of the four cannot be stored.

## Do not memorize what is missing

`issues` on `notification_rule_preview` is "which cell is still empty, and why".
**Ask the user along those issues.** Do not keep a required-field list here. If the server adds a required field and you do not ask, the user is stuck on "save failed" without knowing the gap.

`issues[].path` names the cell (`content.title`, `recipients`, `trigger.at`, and so on). Ask about that cell. Do not say "the information is incomplete".

## How to choose a trigger

| The user says | kind | Also ask |
|---|---|---|
| "Notify when it is created, changed, or deleted" | `data_change` | Which actions. Whether to fire only when certain fields change |
| "Every morning at 9" or "every Monday" | `schedule` | What time. Every day, or which weekday |
| "24 hours before the delivery date" or "remind before it is due" | `date_field` | Which date field. Before or after. How long |

**Candidates come from `notification_rule_preview` issues or `rules/schema`.**
Do not claim a document has a field from memory. When several scopes are selected, available fields are the **intersection**, smaller than a single scope.

**A condition on a reference field (customer, supplier, product, warehouse) is an id, not a name.**
A non-empty `fields[].ref` in `rules/schema` is that kind of field. Writing "customer equals Sample Electronics Co." does not error. The rule runs, matches 0 rows, and the execution log says "no matching data". The user thinks the condition is too narrow and edits in the wrong direction.
Look up the id by name first, or show the form and let the user search. That cell is a search box.

## Who receives it

Four kinds. Ask which one the user's words mean:

- **A named person** (`kind: "user"`). "Send it to Alex." Every fire goes to that person.
- **A department** (`kind: "dept"`, `value` is the organization id). "Notify shop 2." Expanded to people in that organization **and its children** at fire time. Candidates are `departments` on `rules/schema`. `label` already includes the path.
- **A role** (`kind: "role"`). "Notify the system administrator." Expanded to people who hold that role at fire time.
- **A person on the document** (`kind: "field"`). "Notify the creator" or "notify whoever the dispatch names." Sent to the person on each row at that moment.

**A department and a role are not the same thing.** "Notify the shop lead" needs a question: which one. A department is "where they work" and expands along the organization tree. A role is "what they are allowed to do" and expands along grants. The wrong choice sends to a whole shop, or to the same job title in another shop. Neither errors.

**Not every "person" field can be notified.** Some documents store "buyer" or "salesperson" as a name string. The system cannot map that string to an account. A field that does **not** appear in `recipientFields` on `rules/schema` is that kind.
Do not select it for the user, and do not say "it is configured". Tell the user this document can notify the creator, or a specific person.

## Do not ask the message type

In-app messages always land in the message center's **system** category (`content.type: "system"`, also the default when omitted).
The form no longer has that cell. Do not ask "which kind of message", and do not fill another value. Nobody subscribes to the other categories. The rule runs, and the recipient sees nothing.

## How many messages when many rows match

A schedule trigger **summarizes into one message** by default. One fire sends one message. Matched rows are a table in the body (at most 100).
A date-field trigger defaults to one message per row. A data-change fire is already one document, so it has no summary mode.

The summary body may use **only** the server digest tokens `${quantity}`, `${document}`, and `${date}` (count of matches, document name, and trigger date). Those three spellings are what the server accepts. One summary stands for N rows. A row placeholder such as `${productName}` has no single row to read. Saving it is rejected, and the message points at `content`.
When the user says "send each document separately", set `aggregate` to false. Document fields are allowed only then.

**Throttle does not apply after a summary.** Throttle deduplicates by document, and a summary is not attached to one document.
If the user says "stop reminding me", the answer for the summary mode is to change the trigger frequency, not to set throttle hours.

## Placeholders in the body

Write `${productName}` or `${documentNo}`. **Both the field key and the on-screen label are accepted.** Do not invent field keys.
After writing, let `preview` check. It reports which placeholder has no cell on the selected documents.

## See the match count before save

`preview` returns `matchedCount`. **Hundreds of rows means tell the user to narrow the condition.**
One rule that sends hundreds of in-app messages will get the notification feature turned off that day.

`throttle.perBillHours` is nearly required for a condition that stays true (low stock, an overdue document).
Low today and low tomorrow, without a throttle, repeats every day.

## Debug

`notification_rule_debug`:

1. `send: false` first. Compose one message from **rows that really matched**.
2. After the user confirms, `send: true`. This **really delivers** to the recipient's inbox. Ask before this step.

**Show step 1 as a card, not a long paragraph.**
The `send:false` return includes `ui` (a preview card plus a "confirm send" choice). The host renders it.
You write one sentence: how many matched, and who receives them. **Do not** copy title, body, source, and recipients into a paragraph. Those cells are already on the card.

Wrong shape, the eight-line reply that has been observed:
"I'll preview what this rule would send. Debug preview finished, nothing was really sent (sent=false).
Rule 'test' currently matches 5 sales orders… Title: test / Body: testtesttest / Source: sales order…
Should I really send these 5, or adjust the rule first?"

Right shape: one sentence, "5 matches, all to alex", plus the card.

A rule can be debugged before it is saved. Pass the whole `rule`, with `id` null.
"Show me what it would send before save" in a conversational create uses this path.

Debug **ignores `throttle`**. A click means "send one now so I can see it".
`sent` on the receipt means **it was actually delivered** (`deliveredCount > 0`). It is not an echo of the argument.
If `send: true` and `sent: false`, read that row in the execution log. Do not tell the user it was sent.

When an automatic fire is throttled, the execution log keeps a `throttled` row (skipped by throttle) and states how many matched and how many were inside the window. "Why didn't I receive it" is answered by that row.

## Edit an existing rule

`notification_rule_inspect` for the id and `revision`, then `notification_rule_apply({op:"save", id, expectedRevision, rule})`.

**Do not guess the id from the name.** Do not write without `expectedRevision`.
A rejection means someone else just changed it. Inspect again, then edit.

**Every `notification_rule_preview` during an edit must include `id` and `expectedRevision`.**
Without them the card falls back to create. The form and the data look right, and "save" **inserts a second rule** while the original is also changed. One edit becomes two rows.

```
notification_rule_preview({ id, expectedRevision, rule })   // edit
notification_rule_preview({ rule })                          // create
```

## Cards

`notification_rule_preview` returns a `ui` field. The host **renders the form card directly**.
Do **not** write another ```open-agent-ui fence in the body. That shows two identical cards.
