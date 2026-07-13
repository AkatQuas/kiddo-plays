import { Agent } from '@openai/agents';
import type { RoleContext } from '../context.js';
import { resolveTools, toolRegistry } from '../tools/index.js';

/**
 * Factory: creates a Worker agent dynamically for each sub-task.
 * Text output (no Zod schema) to avoid tools + response_format conflict.
 */
export function createWorkerAgent(task: {
  taskId: string;
  description: string;
  requiredTools: string[];
  acceptanceCriteria: string;
  previousResult?: string;
  rejectionReason?: string;
  retryCount?: number;
  predecessorResults?: Array<{ taskId: string; output: string }>;
}): Agent<RoleContext> {
  const toolNames = task.requiredTools?.length
    ? task.requiredTools
    : Object.keys(toolRegistry);
  const tools = resolveTools(toolNames);

  // Build tool help text showing each tool's exact parameter names
  const toolHelp = toolNames
    .map((name) => {
      const t = toolRegistry[name];
      if (!t) return `  - ${name}: (unknown)`;
      const params = t.parameters && t.parameters.properties
        ? Object.entries(t.parameters.properties)
            .map(([k, v]: [string, any]) => `      ${k}: ${v.description}`)
            .join('\n')
        : '    (no parameters)';
      return `  - ${name}: ${t.description || ''}\n${params}`;
    })
    .join('\n');

  // Build predecessor results text
  const predecessorText = task.predecessorResults && task.predecessorResults.length > 0
    ? task.predecessorResults
        .map((p) => `\n--- Output from ${p.taskId} ---\n${p.output}`)
        .join('\n')
    : '';

  return new Agent<RoleContext>({
    name: `Worker-${task.taskId}`,
    handoffDescription: `Executes sub-task ${task.taskId}: ${task.description}`,
    instructions: () => {
      let prompt = `You are the **Worker** — a focused task execution specialist.

Your job is to execute ONE sub-task carefully and return the raw results.

## Task Assignment
- **Task ID**: ${task.taskId}
- **Description**: ${task.description}
- **Acceptance Criteria**: ${task.acceptanceCriteria}

## Data from Previous Tasks
${predecessorText || '  (no predecessor data — this is the first task in the chain)'}

## Available Tools (call them first!)
You MUST call the appropriate tool(s) to do your work. The tools are available to you:

${toolHelp}

## Instructions
1. Call the tool(s) to gather information or produce output.
2. Each tool call MUST include ALL required parameters with explicit values.
3. For listing directories: call list_directory with dirPath="src" or dirPath="."
4. For reading files: call read_file with filePath="src/index.ts"
5. For writing files: call write_file with filePath="output.md" and content="..."
6. After all tool calls complete, write a CONCISE report.

## Output Format
Keep your report BRIEF and STRUCTURED. Use bullet points and short descriptions.
- What you did (which tools you called)
- Key findings only (don't repeat full file contents)
- success: true or false

Do NOT wrap your response in JSON. Just write plain text.`;

      if (task.previousResult && task.rejectionReason) {
        prompt += `\n\n## Previous Attempt (Retry #${task.retryCount ?? 1})
- **Previous Output**: ${task.previousResult.slice(0, 2000)}
- **Rejection Reason**: ${task.rejectionReason}
- **Please fix the issues noted above. Do NOT repeat the same mistakes.`;
      }

      return prompt;
    },
    modelSettings: { temperature: 0.3, maxTokens: 16000 },
    tools,
  });
}