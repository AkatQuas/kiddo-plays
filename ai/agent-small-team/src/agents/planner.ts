import { Agent } from '@openai/agents';
import { z } from 'zod';
import type { RoleContext } from '../context.js';
import { toolRegistry } from '../tools/index.js';

/**
 * Task schema for structured output from the planner.
 */
const TaskSchema = z.object({
  id: z.string().describe('Unique task identifier, e.g. "T1", "T2"'),
  description: z
    .string()
    .describe('Clear, atomic description of what this sub-task should accomplish'),
  requiredTools: z
    .array(z.string())
    .describe('Tool names needed: read_file, list_directory, write_file, run_command, search_web'),
  isParallel: z.boolean().describe('True if this task can run independently of others'),
  dependsOn: z
    .array(z.string())
    .describe('Task IDs this task depends on (empty array if none). The orchestrator will pass the output from depended-on tasks as context to this worker.'),
  acceptanceCriteria: z
    .string()
    .describe('Concrete, verifiable criteria to determine if this task succeeded'),
});

const TaskListSchema = z.object({
  tasks: z.array(TaskSchema).min(1).describe('The list of sub-tasks to execute'),
  planningRationale: z
    .string()
    .describe('Brief explanation of the decomposition strategy and ordering decisions'),
});

/**
 * Planner agent — receives user request, outputs structured task list.
 */
export const plannerAgent = new Agent<RoleContext, typeof TaskListSchema>({
  name: 'Planner',
  handoffDescription: 'Breaks down complex user requests into atomic sub-tasks',
  instructions: (runContext) => {
    const ctx = runContext.context;
    return `You are the **Planner** — a task decomposition specialist.

Your job is to analyze the user's request and break it down into atomic, independently executable sub-tasks.

## CRITICAL RULES — READ CAREFULLY

1. **Each task is self-contained** but DOES receive the outputs from tasks it depends on (via \`dependsOn\`). Use this to chain work: T1 discovers files → T2 reads them → T3 writes results.

2. **Tasks are atomic** — they do one thing and produce one deliverable.

3. **Tasks should be non-overlapping** — no two tasks should do the same work.

4. **isParallel = true** means the task can run alongside others (no shared data needed).

5. **dependsOn** chains both ordering AND data: the depended task\'s output becomes available to the dependent worker.

6. Every task must be achievable with the tools assigned to it. Each tool call must include the required parameter names.

7. Every task must have **concrete, verifiable acceptance criteria** that can be checked from the task's output alone.

8. **Example of good task decomposition:**
   - T1: "List all .ts files in src/ directory" → tools: [list_directory], acceptance: "Output contains at least 3 .ts file names"
   - T2: "Read the content of src/index.ts and summarize the exports" → tools: [read_file], dependsOn: [T1], acceptance: "Output lists all exported interfaces/functions from index.ts"
   - T3: "Compile the findings into a markdown file" → tools: [write_file], dependsOn: [T2], acceptance: "Output confirms a file was written"

## Available Tools
${Object.entries(toolRegistry)
  .map(([name, t]) => {
    const params = t.parameters?.properties
      ? Object.entries(t.parameters.properties)
          .map(([k, v]: [string, any]) => `      ${k} (${t.parameters.required?.includes(k) ? 'required' : 'optional'}): ${v.description}`)
          .join('\n')
      : '';
    return `  - ${name}: ${t.description}\n${params}`;
  })
  .join('\n')}

## User Request
${ctx.userInput || '(no input provided)'}

Analyze the request carefully. Each task must be self-contained and independently verifiable. Output ONLY valid JSON.`;
  },
  outputType: TaskListSchema,
  modelSettings: { temperature: 0.3 },
  tools: [],
});