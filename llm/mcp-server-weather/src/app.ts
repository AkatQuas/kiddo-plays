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

export class App {
  #httpServer: http.Server| undefined;
  readonly #mcpServer: McpServer;
  #sseTransport: SSEServerTransport | null = null;
  #transports: Map< string, StreamableHTTPServerTransport> = new Map();

  constructor() {
    this.#mcpServer = new McpServer(
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
    return this.#mcpServer;
  }

  async onInitialized(fn: () => void) {
    this.#mcpServer.server.oninitialized = fn;
  }

  async close() {
    await this.#mcpServer.close();
    await this.cleanup();
  }

  async cleanup() {
    this.#httpServer?.close();
    this.#transports.forEach(t => t.close());
    this.#transports.clear();
    await Promise.resolve();
    // do some clean up
  }

  async sendLoggingMessage(p: Partial<LoggingMessageNotification['params']>) {
    this.#mcpServer.server.sendLoggingMessage(
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
    await this.#mcpServer.connect(transport);
  }

  async startServerStream(port: number) {
    const exp = express();
    exp.use(express.json());

    // Handle POST requests for client-to-server communication
    exp.post('/mcp', async (req: Request, res: Response) => {
      const sessionId = req.headers['mcp-session-id'] as string | undefined;

      if (sessionId && this.#transports.has(sessionId)) {
        const transport = this.#transports.get(sessionId)!;

        // Handle the request
        await transport.handleRequest(req, res, req.body);
        return;
      }
      if (!sessionId && isInitializeRequest(req.body)) {
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (session_id: string) => {
            // Store the transport by session ID
            this.#transports.set(session_id, transport);
          },
          onsessionclosed: (session_id: string) => {
            this.#transports.delete(session_id);
          },
          // DNS rebinding protection is disabled by default for backwards compatibility. If you are running this server
          // locally, make sure to set:
          // enableDnsRebindingProtection: true,
          // allowedHosts: ['127.0.0.1'],
        });

        await this.#mcpServer.connect(transport);
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
      if (!sessionId || !this.#transports.has(sessionId)) {
        res.status(400).send('Invalid or missing session ID');
        return;
      }

      const transport = this.#transports.get(sessionId)!;
      await transport.handleRequest(req, res);
    };

    // Handle GET requests for server-to-client notifications via SSE
    exp.get('/mcp', handleSessionRequest);

    // Handle DELETE requests for session termination
    exp.delete('/mcp', handleSessionRequest);

    return new Promise((resolve) => {
      this.#httpServer = exp.listen(port, () => {
        console.error(`StreamableHTTPServer available at http://localhost:${port}/mcp`);
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
      this.#sseTransport = new SSEServerTransport(
        '/messages',
        res as unknown as ServerResponse<IncomingMessage>
      );
      await this.#mcpServer.connect(this.#sseTransport);
    });

    app.post('/messages', async (req: Request, res: Response) => {
      if (!this.#sseTransport) {
        res.sendStatus(400);
        return;
      }
      await this.#sseTransport.handlePostMessage(
        req as unknown as IncomingMessage,
        res as unknown as ServerResponse<IncomingMessage>
      );
    });

    return new Promise((resolve) => {
      this.#httpServer=app.listen(port, () => {
        console.error(`SSE available at http://localhost:${port}/sse`);
        console.error(`Message available at http://localhost:${port}/messages`);
        resolve(1);
      });
    });
  }
}
