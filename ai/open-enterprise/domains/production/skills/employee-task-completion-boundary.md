---
name: employee-task-completion-boundary
description: Task count, completed count, and completion rate by employee. Uncovered variants go to general exploration.
version: 1.2.0
triggerWords: [tasks per employee, employee task completion rate, completed tasks by employee, task counts by employee, today's employee completion rate]
---

# Employee task completion rate

This boundary covers only "task count / completed task count / completion rate".
Output quantity, reported quantity, qualified quantity, defect quantity, and piece-rate pay are different facts. Sharing the word "employee" does not select this skill. Those questions stay on the production narrow queries, or on constrained general read-only exploration.

## Routing

- This skill defines the business meaning of task count, completed task count, and completion rate. A task is one dispatch (`processAssignment`, header `workerId`). Completion is qualified quantity on reports already completed at the query time. An employee with zero tasks is shown as "no tasks yet". Do not substitute order counts, task-document counts, or report counts for the rate.
- An exact result needs one statistical definition across employees, dispatches, and completed reports. That fact has to be proved by the current tools and declared relations. This skill cannot unilaterally call it unsupported.
- A hit on this skill means prefer the dedicated fast plan. It does not refuse the question, and it does not mean the capability is fully implemented.
- If this turn has no dedicated plan, the plan misses the user's time or person variant, or the plan is rejected by the tool contract, switch to general read-only exploration in `open-meta-ops`. Explore the declared employee, dispatch, task, and report relations before deciding whether the rate can be computed faithfully.
- When exploration can prove the definition, answer and use the matching dynamic UI. When it cannot, still return facts already queried and verified this turn (authorized employees, tasks, completed reports, or data scope). Say those facts are not the completion rate, and suggest how to add the relation or definition, or what to query next.

## When the exact path may stop

Stop the exact path only for a clear 401 or 403 or a data-scope limit, a tool-contract or service error, or a real capability gap proved by schema and relation exploration. When stopping:

1. Say, in plain language, that the exact definition cannot be given reliably yet, and why.
2. Do not invent a figure, do not substitute a nearby metric, and do not describe a tool failure as "no business data".
3. Show facts already verified this turn, without exceeding permission. If permission or a service error blocks the read, say there is nothing to show.
4. Give a next step the user can take: a missing business coordinate, a missing relation or aggregate, a permission fix, or a retry.

Do not end before general exploration has been tried. Do not refuse the user's intent only because a dedicated skill is missing for the moment.
