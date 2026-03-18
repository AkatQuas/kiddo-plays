import { v4 as uuidv4 } from 'uuid';
import { calculatorTool } from '../mocks/tools/calculator';
import { translatorTool } from '../mocks/tools/translator';
import { weatherTool } from '../mocks/tools/weather';
import { toolStore } from '../store/tool';
import type { ToolCall, ToolResult } from '../types/tool';

// Tool registry (extend by adding new tools)
const TOOL_REGISTRY = {
  weather: weatherTool,
  calculator: calculatorTool,
  translator: translatorTool
};

export const toolService = {
  // Get all available tools
  getAvailableTools() {
    return Object.values(TOOL_REGISTRY);
  },

  // Execute a tool call
  async executeTool(toolCall: ToolCall): Promise<ToolResult> {
    const { id, toolName, parameters } = toolCall;

    // Validate tool exists
    const tool = TOOL_REGISTRY[toolName as keyof typeof TOOL_REGISTRY];
    if (!tool) {
      throw new Error(`Tool "${toolName}" not found`);
    }

    // Update tool call status to "loading"
    toolStore.getState().addToolCall({
      id: id || uuidv4(),
      toolName,
      parameters,
      status: 'loading'
    });

    try {
      // Execute the tool
      const result = await tool.execute(parameters);

      // Update status to "success"
      toolStore
        .getState()
        .updateToolCallStatus(id, 'success', undefined, result);

      return result;
    } catch (error) {
      const errorMessage = (error as Error).message;

      // Update status to "failed"
      toolStore.getState().updateToolCallStatus(id, 'failed', errorMessage);

      throw error;
    }
  },

  // Parse tool calls from LLM response
  parseToolCalls(llmResponse: string): ToolCall[] {
    // TODO: Implement actual parsing logic
    // This is a placeholder for demo purposes
    const toolCalls: ToolCall[] = [];

    // Simple pattern matching for demo
    if (llmResponse.includes('weather(')) {
      toolCalls.push({
        id: uuidv4(),
        toolName: 'weather',
        parameters: { city: 'Beijing' },
        status: 'loading'
      });
    }

    if (llmResponse.includes('calculate(')) {
      toolCalls.push({
        id: uuidv4(),
        toolName: 'calculator',
        parameters: { expression: '2 + 2 * 3' },
        status: 'loading'
      });
    }

    return toolCalls;
  }
};
