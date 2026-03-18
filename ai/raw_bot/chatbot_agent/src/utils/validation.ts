import { ZodSchema } from 'zod';

export const validateWithSchema = <T>(
  schema: ZodSchema<T>,
  data: unknown
): { success: boolean; data?: T; errors?: string[] } => {
  const result = schema.safeParse(data);
  if (!result.success) {
    return {
      success: false,
      errors: result.error.issues.map(
        (issue) => `${issue.path.join('.')}: ${issue.message}`
      )
    };
  }
  return {
    success: true,
    data: result.data
  };
};

export const isValidApiKey = (provider: string, apiKey: string): boolean => {
  switch (provider) {
    case 'openrouter':
      return apiKey.startsWith('sk-or-');
    case 'openai':
      return apiKey.startsWith('sk-');
    case 'anthropic':
      return apiKey.startsWith('sk-ant-');
    case 'gemini':
      return apiKey.length > 10; // Basic check for Gemini API key
    default:
      return apiKey.length > 0;
  }
};

export const isValidURL = async (baseURL?: string) => {
  if (!baseURL) {
    return true;
  }
  try {
    new URL(baseURL);
    return true;
  } catch {
    return false;
  }
};
