import { getServerConfig } from './config';
import { BaseServer } from './server';
import { BasicService } from './services/basic';
import { WeatherService } from './services/weather';

export async function startServer(): Promise<void> {
  const server = new BaseServer();

  // Cleanup on exit
  process.on('SIGINT', async () => {
    await server.close();
    await server.cleanup();
    process.exit(0);
  });

  // add service and register
  // service might accept `config` as arguments
  const basicService = new BasicService();
  const weatherService = new WeatherService();

  // it's important to register service before server start
  basicService.register(server.mcpServer);
  weatherService.register(server.mcpServer);

  // Check if we're running in stdio mode (e.g., via tty)
  const isStdioMode =
    process.env.NODE_ENV === 'stdio' || process.argv.includes('--stdio');

  if (isStdioMode) {
    server.onInitialized(() => {
      server.sendLoggingMessage({
        data: 'Hello, you are connected through STDIO',
      });
    });
    await new Promise((resolve, reject) => {
      process.nextTick(() => {
        server.startServerStdio().then(resolve, reject);
      });
    });

    return;
  }
  const config = getServerConfig();
  server.onInitialized(() => {
    server.sendLoggingMessage({
      data: 'Hello, you are connected through StreamableHTTP',
    });
  });
  await new Promise((resolve, reject) => {
    process.nextTick(() => {
      server.startServerStream(config.port).then(resolve, reject);
    });
  });
}

// If this file is being run directly, start the server
if (require.main === module) {
  startServer().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}
