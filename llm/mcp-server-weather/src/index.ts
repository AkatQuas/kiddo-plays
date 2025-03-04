import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { BaseServer } from './server';
import { getServerConfig } from './config';
import { WeatherService } from './services/weather';

export async function startServer(): Promise<void> {
  const config = getServerConfig();
  const server = new BaseServer();

  // add service and register
  // service might accept `config` as arguments
  const weatherService = new WeatherService();

  // it's important to register service before server start
  weatherService.register(server.mcpServer);

  // Check if we're running in stdio mode (e.g., via CLI)
  const isStdioMode = process.env.NODE_ENV === "cli" || process.argv.includes("--stdio");

  if (isStdioMode) {
    console.log("Initializing MCP Server in stdio mode...");
    const transport = new StdioServerTransport();
    await server.connect(transport);
  } else {
    console.log(`Initializing MCP Server in HTTP mode on port ${config.port}...`);
    await server.startHttpServer(config.port);
  }

  console.log("\nAvailable tools:");
  console.log("- get-alerts: Fetch weather alerts for a state");
  console.log("- get-forecast: Fetch weather forecast for a location");
  console.log()

}

// If this file is being run directly, start the server
if (require.main === module) {
  startServer().catch((error) => {
    console.error("Failed to start server:", error);
    process.exit(1);
  });
}
