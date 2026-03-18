import { zodResolver } from '@hookform/resolvers/zod';
import { useCallback, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { sessionManager } from '../application/session_manager';
import { configStore } from '../store/config';
import { llmConfigSchema, type LLMConfig } from '../types/config';
import { isValidURL } from '../utils/validation';

export const useConfig = () => {
  const navigate = useNavigate();
  const {
    config,
    hasConfig,
    isLoading,
    setLLMConfig,
    loadConfig,
    resetConfig
  } = configStore();

  // Form setup
  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isValid }
  } = useForm<LLMConfig>({
    resolver: zodResolver(llmConfigSchema),
    defaultValues: config.llmConfig,
    mode: 'onChange'
  });

  // Watch form values for validation
  const apiKey = watch('apiKey');
  const temperature = watch('temperature');
  const baseURL = watch('baseUrl');

  // Derived state
  const baseURLIsValid = isValidURL(baseURL);

  // Load config on mount
  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  // Auto create session and navigate after successful save
  const createSessionAndNavigate = useCallback(async () => {
    try {
      // Create new chat session
      const newSession = await sessionManager.createSession();
      // Navigate to the new chat session
      navigate(`/chat/${newSession.id}`, { replace: true });
    } catch (error) {
      console.error('Failed to create new chat session:', error);
      // Fallback navigation if session creation fails
      navigate('/chat', { replace: true });
    }
  }, [navigate]);

  // Handle form submission
  const onSubmit = async (data: LLMConfig) => {
    await setLLMConfig(data);
    // Auto create session and navigate to chat page
    await createSessionAndNavigate();
  };

  // Reset to default config
  const handleReset = async () => {
    await resetConfig();
    reset();
  };

  return {
    register,
    handleSubmit: handleSubmit(onSubmit),
    handleReset,
    errors,
    isValid,
    isLoading,
    hasConfig,
    baseURLIsValid,
    apiKey,
    temperature
  };
};
