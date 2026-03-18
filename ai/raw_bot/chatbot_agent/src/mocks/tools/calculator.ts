import type { Tool, ToolParameters, ToolResult } from '../../types/tool';

// Calculator tool Mock implementation
export const calculatorTool: Tool = {
  name: 'calculator',
  description: 'Perform mathematical calculations',
  parametersSchema: {
    type: 'object',
    properties: {
      expression: {
        type: 'string',
        description: 'Mathematical expression to evaluate',
        optional: false
      }
    },
    required: ['expression']
  },

  // Execution logic (Mock)
  async execute(parameters: ToolParameters): Promise<ToolResult> {
    // Simulate calculation delay
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Validate required parameters
    if (!parameters.expression) {
      throw new Error('Parameter "expression" is required for calculator tool');
    }

    try {
      // Simple expression evaluation (SAFE EVALUATION FOR MOCK ONLY)
      // In production, use a proper math expression parser
      const expression = parameters.expression
        .replace(/[^0-9+\-*/().\s]/g, '') // Sanitize input
        .replace(/\s+/g, ''); // Remove whitespace

      // For security, only allow basic arithmetic operations
      const result = Function(`'use strict'; return (${expression})`)();

      // Mock return result
      return {
        content: `Calculation result: ${expression} = ${result}`,
        raw: {
          code: 200,
          input: expression,
          result,
          type: typeof result
        }
      };
    } catch (error) {
      throw new Error(`Calculation error: ${(error as Error).message}`);
    }
  }
};
