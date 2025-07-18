import {
  McpServer,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  isInitializeRequest,
  LoggingMessageNotification,
} from '@modelcontextprotocol/sdk/types.js';
import express, { Request, Response } from 'express';
import { IncomingMessage, ServerResponse } from 'http';
import { randomUUID } from 'node:crypto';
import * as http from 'node:http';

export class BaseServer {
  private _expressServer: http.Server| undefined;
  private readonly _mcpServer: McpServer;
  private sseTransport: SSEServerTransport | null = null;
  private transports: Map< string, StreamableHTTPServerTransport> = new Map();

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
    this._expressServer?.close();
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

  async startServerStdio() {
    const transport = new StdioServerTransport();
    await this._mcpServer.connect(transport);
  }

  async startServerStream(port: number) {
    const app = express();
    app.use(express.json());

    // Handle POST requests for client-to-server communication
    app.post('/mcp', async (req: Request, res: Response) => {
      const sessionId = req.headers['mcp-session-id'] as string | undefined;

      if (sessionId && this.transports.has(sessionId)) {
        const transport = this.transports.get(sessionId)!;

        // Handle the request
        await transport.handleRequest(req, res, req.body);
        return;
      }
      if (!sessionId && isInitializeRequest(req.body)) {
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (sessionId) => {
            // Store the transport by session ID
            this.transports.set(sessionId, transport);
          },
          // DNS rebinding protection is disabled by default for backwards compatibility. If you are running this server
          // locally, make sure to set:
          // enableDnsRebindingProtection: true,
          // allowedHosts: ['127.0.0.1'],
        });

        transport.onclose = () => {
          if (transport.sessionId) {
            this.transports.delete(transport.sessionId);
          }
        };

        await this._mcpServer.connect(transport);
        // Handle the request
        await transport.handleRequest(req, res, req.body);
        return;
      }

      // Invalid request
      res.status(400).json({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Bad Request: No valid session ID provided',
        },
        id: null,
      });
      return;
    });

    // Reusable handler for GET and DELETE requests
    const handleSessionRequest = async (req: Request, res: Response) => {
      const sessionId = req.headers['mcp-session-id'] as string | undefined;
      if (!sessionId || !this.transports.has(sessionId)) {
        res.status(400).send('Invalid or missing session ID');
        return;
      }

      const transport = this.transports.get(sessionId)!;
      await transport.handleRequest(req, res);
    };

    // Handle GET requests for server-to-client notifications via SSE
    app.get('/mcp', handleSessionRequest);

    // Handle DELETE requests for session termination
    app.delete('/mcp', handleSessionRequest);

    return new Promise((resolve) => {
      this._expressServer = app.listen(port, () => {
        console.error(`HTTP server listening on port ${port}`);
        console.error(
          `StreamableHTTPServer endpoint available at http://localhost:${port}/mcp`
        );
        resolve(1);
      });
    });
  }

  /**
   * @deprecated SSE is not recommended, use {@link startServerStream} instead
   */
  async startServerSSE(port: number) {
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
        res.sendStatus(400);
        return;
      }
      await this.sseTransport.handlePostMessage(
        req as unknown as IncomingMessage,
        res as unknown as ServerResponse<IncomingMessage>
      );
    });

    return new Promise((resolve) => {
      this._expressServer=app.listen(port, () => {
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
