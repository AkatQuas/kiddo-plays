import { BaseServer } from './server';
import { getServerConfig } from './config';
import { WeatherService } from './services/weather';

export async function startServer(): Promise<void> {
  const server = new BaseServer();

  // add service and register
  // service might accept `config` as arguments
  const weatherService = new WeatherService();

  // it's important to register service before server start
  weatherService.register(server.mcpServer);

  // Check if we're running in stdio mode (e.g., via CLI)
  const isStdioMode =
    process.env.NODE_ENV === 'cli' || process.argv.includes('--stdio');

  if (isStdioMode) {
    server.onInitialized(() => {
      server.sendLoggingMessage({
        data: 'Hello, you are connected through STDIO',
      });
    });
    process.nextTick(() => {
      server.startCliServer();
    });
  } else {
    const config = getServerConfig();
    server.onInitialized(() => {
      server.sendLoggingMessage({
        data: 'Hello, you are connected through HTTP',
      });
    });
    process.nextTick(() => {
      server.startHttpServer(config.port);
    });
  }

  // Cleanup on exit
  process.on('SIGINT', async () => {
    await server.close();
    await server.cleanup();
    process.exit(0);
  });
  // no more
}

// If this file is being run directly, start the server
if (require.main === module) {
  startServer().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}
