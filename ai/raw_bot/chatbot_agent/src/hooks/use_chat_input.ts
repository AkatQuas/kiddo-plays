import { zodResolver } from '@hookform/resolvers/zod';
import { useCallback, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { createChatAgent } from '../application/chat_agent';
import { chatStore } from '../store/chat';

// Input validation schema
const chatInputSchema = z.object({
  message: z.string().trim().min(1, 'Message cannot be empty')
});

type ChatInputValues = z.infer<typeof chatInputSchema>;

export const useChatInput = (sessionId: string | null) => {
  const { currentInput, setCurrentInput, isStreaming } = chatStore();

  // Form setup
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm<ChatInputValues>({
    resolver: zodResolver(chatInputSchema),
    defaultValues: {
      message: currentInput
    }
  });

  // Sync form value with store
  useEffect(() => {
    setCurrentInput(
      errors.message
        ? ''
        : (document.getElementById('message-input') as HTMLInputElement)
            ?.value || ''
    );
  }, [currentInput]);

  // Handle form submission
  const onSubmit = useCallback(
    async (data: ChatInputValues) => {
      if (!sessionId || isStreaming) return;

      // Reset form
      reset({ message: '' });

      // Create chat agent and send message
      const chatAgent = createChatAgent(sessionId);
      await chatAgent.handleUserMessage(data.message);

      // Clean up
      chatAgent.destroy();
    },
    [sessionId, isStreaming, reset]
  );

  // Handle file upload (placeholder)
  const handleFileUpload = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0 || !sessionId) return;

      // TODO: Implement actual file upload logic
      console.log('Uploading files:', files);

      // For demo purposes, just add a message with file info
      const fileNames = Array.from(files)
        .map((file) => file.name)
        .join(', ');
      setCurrentInput(`Uploaded files: ${fileNames}`);
    },
    [sessionId, setCurrentInput]
  );

  // Handle keyboard shortcuts (Ctrl/Cmd + Enter to send)
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLFormElement>) => {
      if (
        (e.ctrlKey || e.metaKey) &&
        e.key === 'Enter' &&
        !isStreaming &&
        sessionId
      ) {
        e.preventDefault();
        handleSubmit(onSubmit)();
      }
    },
    [handleSubmit, onSubmit, isStreaming, sessionId]
  );

  // Abort current request
  const abortRequest = useCallback(() => {
    if (sessionId) {
      const chatAgent = createChatAgent(sessionId);
      chatAgent.abort();
      chatAgent.destroy();
    }
  }, [sessionId]);

  return {
    register,
    handleSubmit: handleSubmit(onSubmit),
    handleKeyDown,
    handleFileUpload,
    abortRequest,
    reset,
    errors,
    isStreaming,
    currentInput
  };
};
