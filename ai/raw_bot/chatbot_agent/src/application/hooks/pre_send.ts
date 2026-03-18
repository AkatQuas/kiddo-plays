import type { Message, PreSendHook } from '../../types/chat';

// Registry for pre-send hooks
const preSendHooks: PreSendHook[] = [];

// Register a pre-send hook
export const registerPreSendHook = (hook: PreSendHook): void => {
  preSendHooks.push(hook);
};

// Execute global pre-send hooks
export const executePreSendHooks = async (
  message: Message
): Promise<Message> => {
  console.debug('\x1B[91;103;1m --- execute pre send hooks --- \x1B[m', '\n');
  let processedMessage = { ...message };

  for (const hook of preSendHooks) {
    processedMessage = await hook(processedMessage);
  }

  return processedMessage;
};

// Clear all pre-send hooks
export const clearPreSendHooks = (): void => {
  preSendHooks.length = 0;
};
