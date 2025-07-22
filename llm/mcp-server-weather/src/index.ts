import { getServerConfig } from './config';
import { App } from './app';
import { BasicService } from './services/basic';
import { WeatherService } from './services/weather';

export async function startServer(): Promise<void> {
  const app = new App();

  // Cleanup on exit
  process.on('SIGINT', async () => {
    await app.close();
    process.exit(0);
  });

  // add service and register
  // service might accept `config` as arguments
  const basicService = new BasicService();
  const weatherService = new WeatherService();

  // it's important to register service before server start
  basicService.register(app.mcpServer);
  weatherService.register(app.mcpServer);

  // Check if we're running in stdio mode (e.g., via tty)
  const isStdioMode = process.argv.includes('--stdio');

  if (isStdioMode) {
    app.onInitialized(() => {
      app.sendLoggingMessage({
        data: 'Hello, you are connected through STDIO',
      });
    });
    await new Promise((resolve, reject) => {
      process.nextTick(() => {
        app.startServerStdio().then(resolve, reject);
      });
    });

    return;
  }
  const config = getServerConfig();
  app.onInitialized(() => {
    app.sendLoggingMessage({
      data: 'Hello, you are connected through StreamableHTTP',
    });
  });
  await new Promise((resolve, reject) => {
    process.nextTick(() => {
      app.startServerStream(config.port).then(resolve, reject);
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
