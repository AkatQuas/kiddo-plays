import type { Tool, ToolParameters, ToolResult } from '../../types/tool';

// Weather query tool Mock implementation
export const weatherTool: Tool = {
  name: 'weather',
  description: 'Query weather information for a specified city',
  parametersSchema: {
    type: 'object',
    properties: {
      city: { type: 'string', description: 'City name' },
      date: {
        type: 'string',
        description: 'Query date (YYYY-MM-DD)',
        optional: true
      }
    },
    required: ['city']
  },

  // Execution logic (Mock)
  async execute(parameters: ToolParameters): Promise<ToolResult> {
    // Simulate async call
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Mock return result
    return {
      content: `【${parameters.city}】${parameters.date || 'Today'} Weather: Sunny, Temperature 15-28℃, Gentle Breeze`,
      raw: {
        code: 200,
        data: {
          city: parameters.city,
          date: parameters.date || new Date().toISOString().split('T')[0],
          weather: 'Sunny',
          temp: '15-28℃',
          wind: 'Gentle Breeze'
        }
      }
    };
  }
};
