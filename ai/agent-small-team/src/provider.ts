import { OpenAIProvider } from '@openai/agents';
import { setDefaultModelProvider } from '@openai/agents';

/**
 * Configure the model provider for all agents.
 * 
 * For Chat Completions–compatible APIs (DeepSeek, proxy, etc.):
 * - Set `useResponses: false` to use /v1/chat/completions instead of /v1/responses
 * - Set `baseURL` from OPENAI_BASE_URL env var, or falls back to the SDK default
 */
export function configureProvider(): void {
  const baseURL = process.env.OPENAI_BASE_URL || undefined;
  const apiKey = process.env.OPENAI_API_KEY || undefined;

  const provider = new OpenAIProvider({
    apiKey,
    baseURL,
    useResponses: false,
  });

  setDefaultModelProvider(provider);
}