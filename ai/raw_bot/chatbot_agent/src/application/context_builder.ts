import { configStore } from '../store/config';
import type { Context, Message } from '../types/chat';
import { compactMessages } from './message_compact';

// Build context for LLM requests (system prompt + history + current message)
export const contextBuilder = {
  async buildContext({
    sessionId,
    message,
    messages
  }: {
    sessionId: string;
    message: Message;
    messages?: Message[];
  }): Promise<Context> {
    const { config } = configStore.getState();
    const systemPrompt =
      config.llmConfig.systemPrompt || 'You are a helpful assistant.';

    // Get message history if not provided
    const messageHistory = messages || [];

    // Combine history with current message
    let allMessages = [
      ...messageHistory.filter((m) => m.role !== 'tool'),
      message
    ];

    // Compact messages if needed (long conversations)
    const compactedContext = await compactMessages(sessionId);
    if (compactedContext.compacted) {
      allMessages = compactedContext.messages;
    }

    return {
      systemPrompt,
      messages: allMessages
    };
  }
};
