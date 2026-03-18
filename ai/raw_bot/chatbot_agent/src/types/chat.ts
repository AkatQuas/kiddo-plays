import type { ToolCall } from './tool';

export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

export type MessageStatus =
  | 'idle'
  | 'loading'
  | 'success'
  | 'failed'
  | 'aborted';

export interface Attachment {
  id: string;
  type: 'image';
  url: string;
}

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  attachments?: Attachment[];
  toolCalls?: ToolCall[];
  toolCall?: ToolCall; // For tool response messages
}

// API Request/Response Types
export interface CompletionRequest {
  model: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  temperature: number;
  stream: boolean;
  max_tokens?: number;
}

export interface CompletionResponseChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    delta: {
      role?: string;
      content?: string;
    };
    index: number;
    finish_reason: string | null;
  }>;
}

export interface CompactedContext {
  compacted: boolean;
  messages: Message[];
}

export interface PreSendHook {
  (message: Message): Promise<Message>;
}

export interface PostReceiveHook {
  (chunk: { content: string; toolCalls?: ToolCall[] }): Promise<void>;
}

export interface ToolCallHook {
  (toolCalls: ToolCall[]): Promise<ToolCall[]>;
}

export type HookType = 'preSend' | 'postReceive' | 'toolCall';

export interface Context {
  systemPrompt: string;
  messages: Message[];
}
