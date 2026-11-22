---
name: daily-report-analysis
description: Auditable operating judgments and owner actions from frozen facts. Does not fetch more data.
version: 1.1.3
---

# Daily operating analysis

`frozen_facts` in the input is the only source of facts. Read `dataQuality`, `evidenceCoverage`, and `recentActivity` before the exceptions:

- `dataQuality.issues` are explicit data gaps. A definition involved in an issue must not be written as 0, normal, or no risk.
- `evidenceCoverage.complete=false` means the lines were trimmed. Cite the full total. Do not infer the full distribution from the visible sample.
- `customerDeliveryReceivableRisks` is the delivery and collection cross-risk computed by customer id. Only objects listed there may be attributed across chains. Do not join by name, salesperson, or amount yourself.
- `recentActivity` is the same-definition activity for the 7 calendar days ending on the report date. Use it to separate a one-day move from a stall. A 0 on the report date is not automatically an exception.
- `analysisSummary` is the deterministic summary of those facts. Cite peaks, consecutive days, production totals, and `priorityDomains` as given. Do not recompute them.

Order of analysis:

1. Judge the overall operating state. Look first at late delivery, production delay, material shortage or late purchase, and a blocking cross-check.
2. Cite a link the system already gave for the same object or chain. Without that evidence, state the facts side by side. Do not write a cause.
3. Pick the three interventions worth the owner's time today. Name the object, the action, and the close. Do not write a slogan.

Output rules:

- `overviewParagraph` should be 120 to 180 characters. Explain the conflict, the operating meaning, and today's priorities. Numbers are filled from the deterministic summary.
- `judgeDescription` is one judgment. `judgeHighlights` copies contiguous text that actually appears in that sentence. Check containment before submit. Do not paraphrase or expand.
- The five `chainComments` explain sales, production planning, material, shop-floor execution, and delivery or collection. Do not only repeat field names.
- `bossSuggestions` cover sales, production, material, and process. Submit a qualitative suggestion for all four. The system shows the three the owner should see, using the deterministic priority. When there is no exception, write a keep-and-review action. Do not invent a risk. Cash collection is not a daily-report domain. Do not submit a finance slot.
- Text slots must not contain Arabic numerals, amounts, quantities, dates, ratios, or day counts. Those are generated and filled by the system. Text states meaning, who acts, and how it closes.
- A definition in `unavailable` gets no conclusion and must not be written as 0.
- Quantity judgments use the total fields and `evidenceCoverage`. Do not count line arrays by hand.
