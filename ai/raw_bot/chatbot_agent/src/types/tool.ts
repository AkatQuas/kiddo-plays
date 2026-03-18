export type ToolCallStatus = 'loading' | 'success' | 'failed';

export interface ToolParameters {
  [key: string]: any;
}

export interface ToolCall {
  id: string;
  toolName: string;
  parameters: ToolParameters;
  status: ToolCallStatus;
  error?: string;
  result?: ToolResult;
}

export interface ToolResult {
  content: string;
  raw: any;
}

export interface ToolParametersSchema {
  type: 'object';
  properties: {
    [key: string]: {
      type: string;
      description: string;
      optional?: boolean;
    };
  };
  required: string[];
}

export interface Tool {
  name: string;
  description: string;
  parametersSchema: ToolParametersSchema;
  execute: (parameters: ToolParameters) => Promise<ToolResult>;
}
