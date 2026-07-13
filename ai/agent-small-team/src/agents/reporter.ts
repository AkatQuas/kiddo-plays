import { Agent } from '@openai/agents';
import { z } from 'zod';
import type { RoleContext } from '../context.js';

/**
 * Structured detail for each task in the report.
 */
const StructuredDetailSchema = z.object({
  taskId: z.string(),
  taskDescription: z.string(),
  output: z.string().describe('The key output/finding from this task'),
});

/**
 * Execution summary.
 */
const ExecutionSummarySchema = z.object({
  totalTasks: z.number(),
  passedTasks: z.number(),
  retriedTasks: z.number(),
  totalDurationMs: z.number(),
});

/**
 * Final report schema.
 */
const FinalReportSchema = z.object({
  naturalLanguageSummary: z
    .string()
    .describe(
      'A well-written natural language summary of the overall results, organized by topic/logic'
    ),
  structuredDetails: z.array(StructuredDetailSchema),
  executionSummary: ExecutionSummarySchema,
});

/**
 * Reporter agent — aggregates passed results into final report.
 */
export const reporterAgent = new Agent<RoleContext, typeof FinalReportSchema>({
  name: 'Reporter',
  handoffDescription: 'Aggregates all passed task results into a final structured report',
  instructions: (runContext) => {
    const ctx = runContext.context;
    const results = ctx.passedResults ?? [];
    const summary = ctx.executionSummary;

    const resultsText = results
      .map(
        (r, i) => `
--- Task ${i + 1}: ${r.taskId} ---
Description: ${r.taskDescription}
Output:
${r.output.slice(0, 3000)}
`
      )
      .join('\n');

    return `You are the **Reporter** — a report aggregation specialist.

Your job is to take all the successfully completed task results and produce a cohesive final report.

## Input Results
${resultsText}

## Execution Context
${summary ? JSON.stringify(summary, null, 2) : 'N/A'}

## User's Original Request
${ctx.userInput || '(no input provided)'}

## Rules
1. **Natural Language Summary**: Organize by the original request's logic/topics, NOT by task IDs.
2. **Structured Details**: List each task's key finding. Keep it factual.
3. **Execution Summary**: Include aggregate statistics.
4. Remove intermediate logs, tool call details, and debugging info.
5. The natural language summary should be self-contained and readable by the end user.
6. Output ONLY valid JSON matching the report schema.`;
  },
  outputType: FinalReportSchema,
  modelSettings: { temperature: 0.3 },
  tools: [],
});
