import { useCallback, useState } from 'react';
import { toolService } from '../services/tool';
import { toolStore } from '../store/tool';

export const useTools = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { toolCalls, activeToolCalls } = toolStore();

  // Get all available tools
  const availableTools = toolService.getAvailableTools();

  // Execute a tool call
  const executeTool = useCallback(
    async (toolName: string, parameters: Record<string, any>) => {
      setIsLoading(true);

      try {
        const toolCallId = crypto.randomUUID();

        // Execute tool
        const result = await toolService.executeTool({
          id: toolCallId,
          toolName,
          parameters,
          status: 'loading'
        });

        return result;
      } catch (error) {
        console.error('Tool execution failed:', error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  // Cancel an active tool call
  const cancelToolCall = useCallback(async (toolCallId: string) => {
    // In a real implementation, this would cancel the ongoing tool execution
    toolStore
      .getState()
      .updateToolCallStatus(toolCallId, 'failed', 'Cancelled by user');
  }, []);

  // Get tool call status
  const getToolCallStatus = useCallback(
    (toolCallId: string) => {
      return toolCalls[toolCallId]?.status || 'unknown';
    },
    [toolCalls]
  );

  return {
    availableTools,
    toolCalls,
    activeToolCalls,
    isLoading,
    executeTool,
    cancelToolCall,
    getToolCallStatus
  };
};
