import OpenAI from 'openai';
import { configStore } from '../store/config';
import type {
  CompletionRequest,
  CompletionResponseChunk,
  Context
} from '../types/chat';
import type { LLMConfig } from '../types/config';

// Default model mappings for different providers
const DEFAULT_MODELS = {
  openrouter: 'z-ai/glm-4.5-air:free',
  openai: 'gpt-3.5-turbo',
  anthropic: 'claude-3-sonnet-20240229',
  gemini: 'gemini-pro',
  mistral: 'mistral-small',
  custom: 'gpt-3.5-turbo'
};

// Default base URLs
const DEFAULT_BASE_URLS = {
  openrouter: 'https://openrouter.ai/api/v1/chat/completions',
  openai: 'https://api.openai.com/v1/chat/completions',
  anthropic: 'https://api.anthropic.com/v1/messages',
  gemini:
    'https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent',
  mistral: 'https://api.mistral.ai/v1/chat/completions'
};

export class LLMService {
  private apiKey: string;
  private baseUrl: string;
  private model: LLMConfig['model'];
  private temperature: number;
  private systemPrompt: string;

  constructor() {
    const { config } = configStore.getState();
    this.apiKey = config.llmConfig.apiKey;
    this.baseUrl = config.llmConfig.baseUrl || DEFAULT_BASE_URLS.openai;
    this.model = config.llmConfig.model;
    this.temperature = config.llmConfig.temperature || 0.7;
    this.systemPrompt =
      config.llmConfig.systemPrompt || 'You are a helpful assistant.';
  }

  // Update configuration (call when config changes)
  updateConfig(): void {
    const { config } = configStore.getState();
    this.apiKey = config.llmConfig.apiKey;
    this.baseUrl = config.llmConfig.baseUrl || DEFAULT_BASE_URLS.openai;
    this.model = config.llmConfig.model;
    this.temperature = config.llmConfig.temperature || 0.7;
    this.systemPrompt =
      config.llmConfig.systemPrompt || 'You are a helpful assistant.';
  }

  // Get headers for API requests
  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json'
    };

    // Add auth headers based on provider
    switch (this.model) {
      case 'openrouter':
      case 'openai':
      case 'mistral':
        headers['Authorization'] = `Bearer ${this.apiKey}`;
        break;
      case 'anthropic':
        headers['x-api-key'] = this.apiKey;
        headers['anthropic-version'] = '2023-06-01';
        break;
      case 'gemini':
        // Gemini uses API key in URL params instead of headers
        break;
    }

    return headers;
  }

  // Prepare request payload
  private prepareRequestPayload(userMessage: string): CompletionRequest {
    return {
      model: this.model,
      messages: [
        { role: 'system', content: this.systemPrompt },
        { role: 'user', content: userMessage }
      ],
      temperature: this.temperature,
      stream: true, // Use streaming for real-time responses
      max_tokens: 1000
    };
  }

  // Process Gemini response (different format)
  private async *processGeminiStream(
    response: Response
  ): AsyncGenerator<string> {
    const reader = response.body?.getReader();
    if (!reader) return;

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Parse Gemini's response format
      const chunks = buffer.split('\n').filter(Boolean);
      buffer = chunks.pop() || '';

      for (const chunk of chunks) {
        if (chunk.startsWith('data: ')) {
          const data = chunk.slice(6);
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            const text =
              parsed.candidates?.[0]?.content?.parts?.[0]?.text || '';
            if (text) {
              yield text;
            }
          } catch (e) {
            console.error('Error parsing Gemini response:', e);
          }
        }
      }
    }
  }

  // Process Anthropic response
  private async *processAnthropicStream(
    response: Response
  ): AsyncGenerator<string> {
    const reader = response.body?.getReader();
    if (!reader) return;

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      const chunks = buffer.split('\n').filter(Boolean);
      buffer = chunks.pop() || '';

      for (const chunk of chunks) {
        if (chunk.startsWith('data: ')) {
          const data = chunk.slice(6);
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            const text = parsed.delta?.content || '';
            if (text) {
              yield text;
            }
          } catch (e) {
            console.error('Error parsing Anthropic response:', e);
          }
        }
      }
    }
  }

  // Process standard OpenAI-style stream
  private async *processOpenAIStream(
    response: Response
  ): AsyncGenerator<string> {
    const reader = response.body?.getReader();
    if (!reader) return;

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      const chunks = buffer.split('\n').filter(Boolean);
      buffer = chunks.pop() || '';

      for (const chunk of chunks) {
        if (chunk.startsWith('data: ')) {
          const data = chunk.slice(6);
          if (data === '[DONE]') continue;

          try {
            const parsed: CompletionResponseChunk = JSON.parse(data);
            const text = parsed.choices?.[0]?.delta?.content || '';
            if (text) {
              yield text;
            }
          } catch (e) {
            console.error('Error parsing OpenAI response:', e);
          }
        }
      }
    }
  }

  async completion(context: Context, signal: AbortSignal) {
    const openai = new OpenAI({
      baseURL: this.baseUrl,
      apiKey: this.apiKey
    });

    // Prepare messages for litellm
    const messages = [
      { role: 'system', content: context.systemPrompt },
      ...context.messages.map((msg) => ({
        role: msg.role,
        content: msg.content
      }))
    ] as any[];
    try {
      const completion = await openai.chat.completions.create({
        model: 'openai/gpt-5.2',
        messages,
        stream: true
      });
      for await (const chunk of completion) {
        const content = chunk.choices?.[0]?.delta?.content;
        if (content) {
          console.log(content);
        }
      }
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        console.log('Stream cancelled');
      } else {
        throw this.formatLLMError(error as Error);
      }
    }
  }

  // Format LLM errors with user-friendly messages
  private formatLLMError(error: Error): Error {
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
  // Main method to get streaming completion
  async *getCompletion(
    userMessage: string,
    signal: AbortSignal
  ): AsyncGenerator<string> {
    if (!this.apiKey) {
      throw new Error('API key is required');
    }

    const payload = this.prepareRequestPayload(userMessage);
    let url = this.baseUrl;

    // Handle Gemini's URL with API key
    if (this.model === 'gemini') {
      url += `?key=${this.apiKey}`;
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payload),
        signal
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API request failed: ${response.status} ${errorText}`);
      }

      // Process stream based on provider
      switch (this.model) {
        case 'gemini':
          yield* this.processGeminiStream(response);
          break;
        case 'anthropic':
          yield* this.processAnthropicStream(response);
          break;
        default: // openai, mistral, custom
          yield* this.processOpenAIStream(response);
          break;
      }
    } catch (error) {
      console.error('LLM Service Error:', error);
      throw error;
    }
  }

  // Non-streaming completion (for simple use cases)
  async getSimpleCompletion(userMessage: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error('API key is required');
    }

    const payload = {
      ...this.prepareRequestPayload(userMessage),
      stream: false
    };

    let url = this.baseUrl;
    if (this.model === 'gemini') {
      url += `?key=${this.apiKey}`;
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API request failed: ${response.status} ${errorText}`);
      }

      const data = await response.json();

      // Extract response based on provider
      switch (this.model) {
        case 'openai':
        case 'mistral':
          return data.choices?.[0]?.message?.content || '';
        case 'anthropic':
          return data.content?.[0]?.text || '';
        case 'gemini':
          return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        default:
          return '';
      }
    } catch (error) {
      console.error('LLM Service Error:', error);
      throw error;
    }
  }
}

// Create singleton instance
export const llmService = new LLMService();

// Subscribe to config changes to update service
configStore.subscribe((s, pS) => {
  if (s.config.llmConfig !== pS.config.llmConfig) {
    llmService.updateConfig();
  }
});
