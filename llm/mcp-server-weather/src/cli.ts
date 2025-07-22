#!/usr/bin/env node

import { config } from "dotenv";
import { resolve } from "path";
import { startServer } from "./index";

// Load .env from the current working directory
config({ path: resolve(process.cwd(), ".env") });

process.argv.push('--stdio');

startServer().catch((error: unknown) => {
  if (error instanceof Error) {
    console.error("Failed to start server:", error.message);
  } else {
    console.error("Failed to start server with unknown error:", error);
  }
  process.exit(1);
});
