import { configureGlobalLogger, LogLevel } from '@langfuse/core';
import { LangfuseSpanProcessor } from '@langfuse/otel';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { config } from 'dotenv';

// Set the log level to DEBUG to see all log messages
configureGlobalLogger({ level: LogLevel.DEBUG });

config({ debug: true });

// Export the processor to be able to flush it later
// This is important for ensuring all spans are sent to Langfuse
export const langfuseSpanProcessor = new LangfuseSpanProcessor({
  publicKey: process.env.LANGFUSE_PUBLIC_KEY,
  secretKey: process.env.LANGFUSE_SECRET_KEY,
  baseUrl: process.env.LANGFUSE_BASE_URL,
  environment: process.env.NODE_ENV ?? 'development' // Default to development if not specified
});

// Initialize the OpenTelemetry SDK with our Langfuse processor
export const sdk = new NodeSDK({
  spanProcessors: [langfuseSpanProcessor]
});
