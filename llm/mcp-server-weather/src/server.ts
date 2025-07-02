import {
  McpServer,
  ResourceTemplate,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { LoggingMessageNotification } from '@modelcontextprotocol/sdk/types.js';
import express, { Request, Response } from 'express';
import { IncomingMessage, ServerResponse } from 'http';
import { z } from 'zod';

export class BaseServer {
  private readonly _mcpServer: McpServer;
  private sseTransport: SSEServerTransport | null = null;

  constructor() {
    this._mcpServer = new McpServer(
      {
        name: 'Weather MCP Server',
        version: '1.0.0',
      },
      {
        capabilities: {
          experimental: {},
          completions: {},
          prompts: {},

          logging: {},
          resources: {},
          tools: {},
        },
      }
    );
    this.setupTools();
  }

  // basic capability for server
  private setupTools() {
    this._mcpServer.tool(
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
    this._mcpServer.resource(
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
    this._mcpServer.prompt('review-code', { code: z.string() }, ({ code }) => ({
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
    return this._mcpServer;
  }

  async onInitialized(fn: () => void) {
    this._mcpServer.server.oninitialized = fn;
  }

  async close() {
    await this._mcpServer.close();
  }

  async cleanup() {
    await Promise.resolve();
    // do some clean up
  }

  async sendLoggingMessage(p: Partial<LoggingMessageNotification['params']>) {
    this._mcpServer.server.sendLoggingMessage(
      Object.assign(
        {
          level: 'info',
        },
        p
      )
    );
  }

  async startCliServer() {
    const transport = new StdioServerTransport();
    await this._mcpServer.connect(transport);
  }

  /**
   * @deprecated
   */
  async startHttpServer(port: number) {
    const app = express();
    app.get('/sse', async (req: Request, res: Response) => {
      this.sseTransport = new SSEServerTransport(
        '/messages',
        res as unknown as ServerResponse<IncomingMessage>
      );
      await this._mcpServer.connect(this.sseTransport);
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

    return new Promise((resolve) => {
      app.listen(port, () => {
        console.error(`HTTP server listening on port ${port}`);
        console.error(`SSE endpoint available at http://localhost:${port}/sse`);
        console.error(
          `Message endpoint available at http://localhost:${port}/messages`
        );
        resolve(1);
      });
    });
  }
}
