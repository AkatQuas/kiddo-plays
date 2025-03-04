import {
  McpServer,
  ResourceTemplate,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import express, { Request, Response } from 'express';
import { IncomingMessage, ServerResponse } from 'http';
import { z } from 'zod';

export class BaseServer {
  private readonly server: McpServer;
  private sseTransport: SSEServerTransport | null = null;

  constructor() {
    this.server = new McpServer({
      name: 'Weather MCP Server',
      version: '1.0.0',
    });
    this.setupTools();
  }

  // basic capability for server
  private setupTools() {
    this.server.tool(
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
    this.server.resource(
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
    this.server.prompt('review-code', { code: z.string() }, ({ code }) => ({
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

  get mcpServer() {
    return this.server;
  }

  async connect(transport: Transport) {
    await this.server.connect(transport);
  }

  async startHttpServer(port: number) {
    const app = express();
    app.get('/sse', async (req: Request, res: Response) => {
      console.log('New SSE connection established');
      this.sseTransport = new SSEServerTransport(
        '/messages',
        res as unknown as ServerResponse<IncomingMessage>
      );
      await this.server.connect(this.sseTransport);
    });

    app.post('/messages', async (req: Request, res: Response) => {
      if (!this.sseTransport) {
        // @ts-expect-error Not sure why Express types aren't working
        res.sendStatus(400);
        return;
      }
      await this.sseTransport.handlePostMessage(
        req as unknown as IncomingMessage,
        res as unknown as ServerResponse<IncomingMessage>
      );
    });

    app.listen(port, () => {
      console.log(`HTTP server listening on port ${port}`);
      console.log(`SSE endpoint available at http://localhost:${port}/sse`);
      console.log(
        `Message endpoint available at http://localhost:${port}/messages`
      );
    });
  }
}
