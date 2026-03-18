import { z } from 'zod';

export const llmConfigSchema = z.object({
  model: z.string(),
  apiKey: z.string().min(1, 'API Key cannot be empty'),
  baseUrl: z.string().url('Please enter a valid URL'),
  systemPrompt: z.string().optional(),
  temperature: z.number().min(0).max(1)
});

export type LLMConfig = z.infer<typeof llmConfigSchema>;

export interface AppConfig {
  llmConfig: LLMConfig;
  userPrompt: string;
  longTermMemoryEnabled: boolean;
}
