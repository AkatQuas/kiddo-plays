import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { OTLPTraceExporter as OTLPTraceExporterHttp } from '@opentelemetry/exporter-trace-otlp-http';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';

/**
 * Create and start an OpenTelemetry SDK for a service
 * @param {Object} options
 * @param {string} options.serviceName - Name of the service
 * @param {string} [options.endpoint='http://localhost:4317'] - OTLP collector endpoint
 * @param {'grpc' | 'http'} [options.protocol='grpc'] - Protocol to use: 'grpc' or 'http'
 * @param {number} [options.flushInterval=1000] - Flush interval in ms
 * @returns {Promise<NodeSDK>} The started SDK instance
 */
export const initTracing = async ({
  serviceName,
  endpoint = 'http://localhost:4317',
  protocol = 'grpc',

  // endpoint = 'http://localhost:4318',
  // protocol = 'http',
  flushInterval = 1000
}) => {
  const Exporter = protocol === 'http' ? OTLPTraceExporterHttp : OTLPTraceExporter;
  const exporter = new Exporter({
    endpoint,
    ...(protocol === 'grpc' && { insecure: true })
  });

  const sdk = new NodeSDK({
    serviceName,
    spanProcessor: new BatchSpanProcessor(exporter, {
      maxQueueSize: 100,
      maxExportBatchSize: 10,
      exportTimeoutMillis: flushInterval,
      scheduledDelayMillis: flushInterval
    }),
    instrumentations: [
      // HTTP instrumentation automatically traces HTTP requests
      // and propagates trace context via traceparent header
      new HttpInstrumentation()
    ]
  });

  // Handle graceful shutdown
  process.on('SIGTERM', () => {
    sdk.shutdown().catch(console.error);
  });

  sdk.start();

  return sdk;
};
