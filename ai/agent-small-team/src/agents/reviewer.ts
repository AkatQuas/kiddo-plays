import { Agent } from '@openai/agents';
import { z } from 'zod';
import type { RoleContext } from '../context.js';

/**
 * Single reviewed item schema.
 */
const ReviewedItemSchema = z.object({
  taskId: z.string(),
  taskDescription: z.string(),
  rawOutput: z.string(),
  passed: z.boolean().describe('Whether this task result meets its acceptance criteria'),
  rejectionReason: z
    .string()
    .optional()
    .describe(
      'If failed, the specific reason. Must include what needs to be fixed.'
    ),
  correctionRequirements: z
    .string()
    .optional()
    .describe('If failed, concrete instructions on what to change to pass.'),
});

/**
 * Review output schema.
 */
const ReviewOutputSchema = z.object({
  reviewedItems: z.array(ReviewedItemSchema),
  summary: z
    .string()
    .describe('Brief summary of the review results — how many passed/failed.'),
});

/**
 * Reviewer agent — batch checks all worker results against acceptance criteria.
 */
export const reviewerAgent = new Agent<RoleContext, typeof ReviewOutputSchema>({
  name: 'Reviewer',
  handoffDescription: 'Reviews worker results against acceptance criteria',
  instructions: (runContext) => {
    const ctx = runContext.context;
    const results = ctx.resultsToReview ?? [];

    const resultsText = results
      .map(
        (r, i) => `
--- Task ${i + 1}: ${r.taskId} ---
Description: ${r.taskDescription}
Acceptance Criteria: ${r.acceptanceCriteria}
Output:
${r.rawOutput.slice(0, 2000)}
`
      )
      .join('\n');

    return `You are the **Reviewer** — a quality assurance specialist.

Your job is to examine each worker's output and decide if it meets the acceptance criteria.

## Review Dimensions
1. **Completeness**: Does the output fully address the task description?
2. **Accuracy**: Is the output factually correct based on the data?
3. **Compliance**: Were the right tools used appropriately?
4. **Requirement Match**: Does the output satisfy the acceptance criteria?

## Tasks to Review
${resultsText}

## Rules
1. Be specific in your feedback — vague rejections waste time.
2. For each failed task, provide clear correction requirements.
3. A task passes ONLY if ALL acceptance criteria are met.
4. Output ONLY valid JSON matching the review schema.`;
  },
  outputType: ReviewOutputSchema,
  modelSettings: { temperature: 0.2 },
  tools: [],
});
