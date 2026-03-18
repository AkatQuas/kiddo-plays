import { v4 as uuidv4 } from 'uuid';
import { errorService } from '../services/error';
import { llmService } from '../services/llm';
import { toolService } from '../services/tool';
import { chatStore } from '../store/chat';
import type {
  HookType,
  Message,
  PostReceiveHook,
  PreSendHook
} from '../types/chat';
import type { ToolCall, ToolCallHook } from '../types/tool';
import { contextBuilder } from './context_builder';
import { executePostReceiveHooks } from './hooks/post_receive';
import { executePreSendHooks } from './hooks/pre_send';
import { executeToolCallHooks } from './hooks/tool_call';
import { messageGuardian } from './message_guardian';
import { sessionManager } from './session_manager';

export class ChatAgent {
  private sessionId: string;
  private abortController: AbortController | null = null;
  private hooks = {
    preSend: [] as PreSendHook[],
    postReceive: [] as PostReceiveHook[],
    toolCall: [] as ToolCallHook[]
  };

  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  // Register a hook
  registerHook(type: HookType, hook: CallableFunction): void {
    switch (type) {
      case 'preSend':
        this.hooks.preSend.push(hook as PreSendHook);
        break;
      case 'postReceive':
        this.hooks.postReceive.push(hook as PostReceiveHook);
        break;
      case 'toolCall':
        this.hooks.toolCall.push(hook as ToolCallHook);
        break;
    }
  }

  // Handle user message (main entry point)
  async handleUserMessage(
    userMessage: string,
    attachments: Message['attachments'] = []
  ): Promise<void> {
    // Create message object
    const message: Message = {
      id: uuidv4(),
      role: 'user',
      content: userMessage,
      timestamp: Date.now(),
      attachments
    };

    // Abort any existing request
    if (this.abortController) {
      this.abortController.abort();
    }

    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    // Update store state
    chatStore.getState().addMessage(this.sessionId, message);
    chatStore.getState().setIsStreaming(true);
    chatStore.getState().updateMessageStatus(message.id, 'loading');

    try {
      // 1. Execute pre-send hooks (global + agent-specific)
      const globalProcessedMessage = await executePreSendHooks(message);
      let processedMessage = { ...globalProcessedMessage };

      for (const hook of this.hooks.preSend) {
        processedMessage = await hook(processedMessage);
      }

      // 2. Message security validation and transformation
      const guardedMessage =
        await messageGuardian.validateAndTransform(processedMessage);

      // 3. Update session title if it's the first message
      const session = await sessionManager.loadSession(this.sessionId);
      if (session && session.messageCount === 0) {
        const title = sessionManager.generateSessionTitle(userMessage);
        await sessionManager.updateSession(this.sessionId, { title });
      }

      // 4. Build context (system prompt + history + current message)
      const messages = chatStore.getState().messages[this.sessionId] || [];
      const context = await contextBuilder.buildContext({
        sessionId: this.sessionId,
        message: guardedMessage,
        messages
      });

      // 5. Create assistant message for streaming response
      const assistantMessage: Message = {
        id: uuidv4(),
        role: 'assistant',
        content: '',
        timestamp: Date.now()
      };

      chatStore.getState().addMessage(this.sessionId, assistantMessage);
      chatStore.getState().updateMessageStatus(assistantMessage.id, 'loading');

      // 6. Call LLM service (streaming)
      const llmResponse = await llmService.completions({
        context,
        signal
      });

      // 7. Process streaming response
      for await (const chunk of llmResponse) {
        if (signal.aborted) break;

        // Update message content with new chunk
        chatStore
          .getState()
          .appendToMessage(this.sessionId, assistantMessage.id, chunk.content);

        // Execute post-receive hooks (global + agent-specific)
        await executePostReceiveHooks(chunk);

        for (const hook of this.hooks.postReceive) {
          await hook(chunk);
        }

        // Handle tool calls if present
        if (chunk.toolCalls && chunk.toolCalls.length > 0) {
          await this.handleToolCalls(chunk.toolCalls, signal);
        }
      }

      // Update message status
      chatStore.getState().updateMessageStatus(message.id, 'success');
      chatStore.getState().updateMessageStatus(assistantMessage.id, 'success');

      // Update session message count
      await sessionManager.updateSession(this.sessionId, {
        messageCount: (session?.messageCount || 0) + 1
      });
    } catch (error) {
      if (signal.aborted) {
        // Request was aborted by user
        chatStore.getState().updateMessageStatus(message.id, 'aborted');
        chatStore.getState().setIsStreaming(false);
        return;
      }

      // Handle errors
      const errorMessage = errorService.handleLLMError(error as Error);

      // Update message status
      chatStore.getState().updateMessageStatus(message.id, 'failed');

      // Create error message
      const errorMsg: Message = {
        id: uuidv4(),
        role: 'system',
        content: `Error: ${errorMessage}`,
        timestamp: Date.now()
      };

      chatStore.getState().addMessage(this.sessionId, errorMsg);
    } finally {
      // Clean up
      chatStore.getState().setIsStreaming(false);
      this.abortController = null;
      chatStore.getState().setAbortController(null);

      // AT "2026/03/18 16:18"
      // TODO ヾ( • – •*)ง
      // write chat message to persistent storage
    }
  }

  // Handle tool calls from LLM response
  private async handleToolCalls(
    toolCalls: ToolCall[],
    signal: AbortSignal
  ): Promise<void> {
    if (signal.aborted) return;

    // Execute tool call hooks (global + agent-specific)
    const globalProcessedToolCalls = await executeToolCallHooks(toolCalls);
    let processedToolCalls = [...globalProcessedToolCalls];

    for (const hook of this.hooks.toolCall) {
      processedToolCalls = await hook(processedToolCalls);
    }

    // Execute each tool call
    for (const call of processedToolCalls) {
      if (signal.aborted) break;

      // Create tool call message
      const toolCallMessage: Message = {
        id: call.id,
        role: 'tool',
        content: `Calling tool: ${call.toolName}`,
        timestamp: Date.now(),
        toolCall: call
      };

      chatStore.getState().addMessage(this.sessionId, toolCallMessage);

      try {
        // Execute tool
        const result = await toolService.executeTool(call);

        // Update tool call message with result
        chatStore
          .getState()
          .updateMessageContent(
            this.sessionId,
            call.id,
            `Tool ${call.toolName} executed successfully:\n${result.content}`
          );
      } catch (error) {
        // Update tool call message with error
        chatStore
          .getState()
          .updateMessageContent(
            this.sessionId,
            call.id,
            `Tool ${call.toolName} failed: ${(error as Error).message}`
          );
      }
    }
  }

  // Abort current conversation
  abort(): void {
    if (this.abortController) {
      this.abortController.abort();
      chatStore.getState().setIsStreaming(false);
    }
  }

  // Clean up agent resources
  destroy(): void {
    this.abort();
    this.hooks.preSend = [];
    this.hooks.postReceive = [];
    this.hooks.toolCall = [];
  }
}

// Create a singleton agent factory
export const createChatAgent = (sessionId: string): ChatAgent => {
  return new ChatAgent(sessionId);
};
