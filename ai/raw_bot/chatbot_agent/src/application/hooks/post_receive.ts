import type { PostReceiveHook } from '../../types/chat';
import type { ToolCall } from '../../types/tool';

// Registry for post-receive hooks
const postReceiveHooks: PostReceiveHook[] = [];

// Register a post-receive hook
export const registerPostReceiveHook = (hook: PostReceiveHook): void => {
  postReceiveHooks.push(hook);
};

// Execute global post-receive hooks
export const executePostReceiveHooks = async (chunk: {
  content: string;
  toolCalls?: ToolCall[];
}): Promise<void> => {
  console.debug(
    '\x1B[91;103;1m --- execute post receive hooks --- \x1B[m',
    '\n'
  );
  for (const hook of postReceiveHooks) {
    await hook(chunk);
  }
};

// Clear all post-receive hooks
export const clearPostReceiveHooks = (): void => {
  postReceiveHooks.length = 0;
};
