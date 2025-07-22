import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { BaseService } from './base';
import z from 'zod';

export class BasicService implements BaseService {
  register(s: McpServer): void {
    s.tool(
      'add-number',
      {
        a: z.number(),
        b: z.number(),
      },
      async ({ a, b }) => {
        return {
          content: [
            {
              type: 'text',
              text: String(a + b),
            },
          ],
        };
      }
    );
    // Add a dynamic greeting resource
    s.resource(
      'greeting',
      new ResourceTemplate('greeting://{name}', { list: undefined }),
      async (uri, { name }) => ({
        contents: [
          {
            uri: uri.href,
            text: `Hello, ${name}!`,
          },
        ],
      })
    );

    // Add a prompt which is a reusable template that help LLMs interact with your server effectively
    s.prompt('review-code', { code: z.string() }, ({ code }) => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Please review this code:\n\n${code}`,
          },
        },
      ],
    }));


  }
}
