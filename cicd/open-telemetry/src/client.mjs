import { trace, context, SpanStatusCode } from '@opentelemetry/api';
import http from 'http';
import { httpRequest } from './http-utils.mjs';
import { initTracing } from './tracing.mjs';

/**
 * Initiate request WITH tracing enabled
 * Creates a root span that services will continue as child spans
 */
export async function requestWithTracing() {
  // Initialize OpenTelemetry SDK
  const sdk = await initTracing({ serviceName: 'client' });

  const tracer = trace.getTracer('client');

  console.log('\n=== Request WITH tracing ===\n');

  try {
    // Create a root span for the entire request lifecycle
    const rootSpan = tracer.startSpan('client-request', {
      kind: 1, // CLIENT
      attributes: {
        'http.method': 'GET',
        'http.url': 'http://localhost:3001/service-a',
        'operation': 'full-request-chain',
      },
    });

    // Run the HTTP request in the context of the root span
    // This ensures the trace context is propagated to services
    await context.with(trace.setSpan(context.active(), rootSpan), async () => {
      const result = await httpRequest({
        hostname: 'localhost',
        port: 3001,
        path: '/service-a',
        spanName: 'HTTP GET /service-a',
        attributes: { 'http.client_span': 'true' }
      });
      console.log('Tracing Response:', JSON.parse(result.data));
    });

    rootSpan.end();
  } catch (err) {
    console.error('Tracing Error:', err.message);
    throw err;
  } finally {
    await sdk.shutdown();
  }
}

/**
 * Initiate request WITHOUT tracing
 * No OpenTelemetry initialization - plain HTTP calls only
 */
export async function requestWithoutTracing() {
  return new Promise((resolve, reject) => {
    console.log('\n=== Request WITHOUT tracing ===\n');
    const req = http.get('http://localhost:3001/service-a', (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve(data);
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

// Demo: run both when executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('=== Client Demo ===\n');

  // First, run without tracing
  try {
    const result = await requestWithoutTracing();
    console.log('Non-tracing Response:', result);
    console.log('Non-tracing request completed\n');
  } catch (err) {
    console.error('Non-tracing failed:', err.message);
  }

  // Wait a bit, then run with tracing
  await new Promise((r) => setTimeout(r, 1000));

  try {
    await requestWithTracing();
    console.log('Tracing request completed\n');
  } catch (err) {
    console.error('Tracing failed:', err.message);
  }
}
