import { type Message } from 'litellm/src/types';
import OpenAI from 'openai';
import { configStore } from '../store/config';
import type { Context, LLMStreamResponse } from '../types/api';

export const llmService = {
  async completions({
    context,
    signal
  }: {
    context: Context;
    signal: AbortSignal;
  }): Promise<AsyncGenerator<LLMStreamResponse>> {
    const { config } = configStore.getState();
    const { apiKey, baseUrl, temperature } = config.llmConfig;

    // Validate configuration
    if (!apiKey) {
      throw new Error(
        'API Key not configured. Please complete setup in settings.'
      );
    }
    if (!baseUrl) {
      throw new Error(
        'baseURL not configured. Please complete setup in settings.'
      );
    }

    console.debug('\x1B[97;100;1m --- config --- \x1B[m', '\n', config);
    // Prepare messages for litellm
    const messages = [
      { role: 'system', content: context.systemPrompt },
      ...context.messages.map((msg) => ({
        role: msg.role,
        content: msg.content
      }))
    ] as Message[];
    const openai = new OpenAI({
      baseURL: baseUrl,
      apiKey: apiKey,
      dangerouslyAllowBrowser: true
    });

    try {
      const completion = await openai.chat.completions.create({
        model: 'qwen/qwen3-coder:free',
        messages,
        stream: true,
        temperature
      });
      // Transform to unified streaming response format
      return this.transformStream(completion);
    } catch (error) {
      throw this.formatLLMError(error as Error);
    }
  },

  // Transform raw LLM stream response to unified format
  async *transformStream(rawStream: any): AsyncGenerator<LLMStreamResponse> {
    for await (const chunk of rawStream) {
      try {
        // Different providers have different response formats
        if (chunk.choices && chunk.choices.length > 0) {
          const choice = chunk.choices[0];

          // Extract content
          const content = choice.delta?.content || '';

          // Extract tool calls if present
          let toolCalls;
          if (choice.delta?.tool_calls) {
            toolCalls = choice.delta.tool_calls.map((tc: any) => ({
              id: tc.id || crypto.randomUUID(),
              toolName: tc.function?.name || tc.tool_name,
              parameters: JSON.parse(tc.function?.arguments || '{}')
            }));
          }

          yield {
            content,
            toolCalls,
            finishReason: choice.finish_reason || null
          };
        }
      } catch (error) {
        console.error('Error transforming stream chunk:', error);
        // Continue processing even if one chunk fails
        yield {
          content: '',
          finishReason: null
        };
      }
    }
  },

  // Format LLM errors with user-friendly messages
  formatLLMError(error: Error): Error {
    const message = error.message.toLowerCase();

    // API key errors
    if (
      message.includes('invalid api key') ||
      message.includes('authentication')
    ) {
      return new Error(
        'API Key is invalid or expired. Please update it in the configuration page.'
      );
    }

    // Rate limit errors
    if (message.includes('rate limit') || message.includes('quota')) {
      return new Error(
        'Rate limit exceeded. Please wait a few minutes and try again.'
      );
    }

    // Model not found errors
    if (message.includes('model') && message.includes('not found')) {
      return new Error(
        'The selected model is not available. Please choose a different provider.'
      );
    }

    // Network errors
    if (message.includes('network') || message.includes('fetch')) {
      return new Error(
        'Network error. Please check your internet connection and try again.'
      );
    }

    // Timeout errors
    if (message.includes('timeout')) {
      return new Error(
        'Request timed out. Please try again with a shorter message.'
      );
    }

    // Generic error
    return new Error(`LLM service error: ${error.message}`);
  }
};
