import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export interface BaseService {
  register(s: McpServer): void;
}
