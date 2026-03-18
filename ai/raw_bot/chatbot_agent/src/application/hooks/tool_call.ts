import type { ToolCall, ToolCallHook } from '../../types/tool';

// Registry for tool call hooks
const toolCallHooks: ToolCallHook[] = [];

// Register a tool call hook
export const registerToolCallHook = (hook: ToolCallHook): void => {
  toolCallHooks.push(hook);
};

// Execute all tool call hooks
export const executeToolCallHooks = async (
  toolCalls: ToolCall[]
): Promise<ToolCall[]> => {
  let processedToolCalls = toolCalls.slice(0);

  for (const hook of toolCallHooks) {
    processedToolCalls = await hook(processedToolCalls);
  }

  return processedToolCalls;
};

// Clear all tool call hooks
export const clearToolCallHooks = (): void => {
  toolCallHooks.length = 0;
};
