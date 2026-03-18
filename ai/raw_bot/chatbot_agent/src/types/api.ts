import type { Message } from './chat';

export interface LLMStreamResponse {
  content: string;
  toolCalls?: {
    id: string;
    toolName: string;
    parameters: Record<string, any>;
  }[];
  finishReason: string | null;
}

export interface Context {
  messages: Message[];
  systemPrompt?: string;
}

export interface LLMError {
  code: string;
  message: string;
  suggestion: string;
}
