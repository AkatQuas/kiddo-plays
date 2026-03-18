import type { LLMError } from '../types/api';

export const errorService = {
  // Classify and handle LLM errors
  handleLLMError(error: Error): string {
    const errorMessage = error.message;

    // Classify error type
    let llmError: LLMError;

    if (errorMessage.includes('API Key')) {
      llmError = {
        code: 'INVALID_API_KEY',
        message: errorMessage,
        suggestion:
          'Please check your API key in the configuration settings and ensure it is valid and not expired.'
      };
    } else if (
      errorMessage.includes('rate limit') ||
      errorMessage.includes('quota')
    ) {
      llmError = {
        code: 'RATE_LIMIT_EXCEEDED',
        message: errorMessage,
        suggestion:
          'You have exceeded your API rate limit. Please wait a few minutes and try again, or upgrade your plan with the provider.'
      };
    } else if (
      errorMessage.includes('network') ||
      errorMessage.includes('fetch')
    ) {
      llmError = {
        code: 'NETWORK_ERROR',
        message: errorMessage,
        suggestion:
          'Please check your internet connection and ensure the LLM provider API is accessible.'
      };
    } else if (errorMessage.includes('model')) {
      llmError = {
        code: 'INVALID_MODEL',
        message: errorMessage,
        suggestion:
          'Please select a different model/provider in the configuration settings.'
      };
    } else {
      llmError = {
        code: 'UNKNOWN_ERROR',
        message: errorMessage,
        suggestion:
          'Please try again later, or contact support if the problem persists.'
      };
    }

    // Log error for debugging
    console.error(`[${llmError.code}] ${llmError.message}`);

    // Return user-friendly message with suggestion
    return `${llmError.message}\n\nSuggestion: ${llmError.suggestion}`;
  },

  // Get error solution documentation link
  getErrorSolutionLink(errorCode: string): string {
    // In a real app, this would link to actual documentation
    const baseUrl = 'https://docs.chatbot-agent.com/errors';
    return `${baseUrl}#${errorCode}`;
  }
};
