import { config } from "dotenv";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

// Load environment variables from .env file
config();

interface ServerConfig {
  port: number;
  configSources: {
    port: "cli" | "env" | "default";
  };
}


interface CliArgs {
  port?: number;
}

export function getServerConfig(): ServerConfig {
  // Parse command line arguments
  const argv = yargs(hideBin(process.argv))
    .options({
      port: {
        type: "number",
        description: "Port to run the server on",
      },
    })
    .help()
    .parseSync() as CliArgs;

  const config: ServerConfig = {
    port: 3333,
    configSources: {
      port: "default",
    },
  };

  // Handle PORT
  if (argv.port) {
    config.port = argv.port;
    config.configSources.port = "cli";
  } else if (process.env.PORT) {
    config.port = parseInt(process.env.PORT, 10);
    config.configSources.port = "env";
  }

  // Validate configuration
  if (isNaN(config.port)) {
    console.error("Invalid PORT configuration");
    process.exit(1);
  }

  // Log configuration sources
  console.log("\nConfiguration:");
  console.log(`- PORT: ${config.port} (source: ${config.configSources.port})`);
  console.log(); // Empty line for better readability

  return config;
}
