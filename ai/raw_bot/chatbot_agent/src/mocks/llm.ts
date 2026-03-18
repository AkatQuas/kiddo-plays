import type { LLMStreamResponse } from '../types/api';

// Mock LLM streaming responses for development/testing
export const mockLLMResponses = {
  // Basic text response
  basicResponse: async function* (
    content: string
  ): AsyncGenerator<LLMStreamResponse> {
    // Split content into chunks for streaming simulation
    const chunks = content.split(/\s+/).filter(Boolean);

    for (let i = 0; i < chunks.length; i++) {
      // Simulate network delay
      await new Promise((resolve) => setTimeout(resolve, 100));

      yield {
        content: chunks[i] + ' ',
        toolCalls: undefined,
        finishReason: i === chunks.length - 1 ? 'stop' : null
      };
    }
  },

  // Response with tool call
  toolCallResponse: async function* (): AsyncGenerator<LLMStreamResponse> {
    // First send some text
    const introChunks = [
      "I'll",
      'check',
      'the',
      'weather',
      'for',
      'you',
      '.',
      '\n\n'
    ];

    for (const chunk of introChunks) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      yield {
        content: chunk,
        toolCalls: undefined,
        finishReason: null
      };
    }

    // Send tool call
    await new Promise((resolve) => setTimeout(resolve, 200));
    yield {
      content: '',
      toolCalls: [
        {
          id: crypto.randomUUID(),
          toolName: 'weather',
          parameters: {
            city: 'New York',
            date: new Date().toISOString().split('T')[0]
          }
        }
      ],
      finishReason: 'tool_calls'
    };
  },

  // Error response
  errorResponse: async function* (): AsyncGenerator<LLMStreamResponse> {
    // Simulate partial response then error
    yield {
      content: 'I',
      toolCalls: undefined,
      finishReason: null
    };

    await new Promise((resolve) => setTimeout(resolve, 300));

    yield {
      content: ' was',
      toolCalls: undefined,
      finishReason: null
    };

    throw new Error('API rate limit exceeded');
  }
};
