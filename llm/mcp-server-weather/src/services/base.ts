import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export interface BaseService {
  /**
   * register mcp capabilities
   */
  register(s: McpServer): void;
}
