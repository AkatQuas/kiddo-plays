import { trace, context, SpanStatusCode, propagation } from '@opentelemetry/api';
import http from 'http';

/**
 * General HTTP request wrapper that automatically propagates trace context
 * @param {Object} options
 * @param {string} options.hostname
 * @param {number} options.port
 * @param {string} options.path
 * @param {string} [options.method='GET']
 * @param {Object} [options.headers]
 * @param {Object} [options.body]
 * @param {string} [options.spanName] - Custom span name, defaults to URL
 * @param {Object} [options.attributes] - Additional span attributes
 * @returns {Promise<{status: number, data: any}>}
 */
export function httpRequest(options) {
  const tracer = trace.getTracer('http-client');
  const spanName = options.spanName || `${options.method || 'GET'} ${options.path}`;

  return new Promise((resolve, reject) => {
    // Create span in current context (which should have the parent span from middleware)
    const span = tracer.startSpan(spanName, {
      kind: 1, // CLIENT
      attributes: {
        'http.url': `http://${options.hostname}:${options.port}${options.path}`,
        'http.method': options.method || 'GET',
        'net.peer.name': options.hostname,
        'net.peer.port': options.port,
        ...options.attributes,
      },
    });

    // Inject trace context into headers before making request
    const headers = { ...options.headers };
    propagation.inject(context.active(), headers);

    const req = http.request(
      {
        hostname: options.hostname,
        port: options.port,
        path: options.path,
        method: options.method || 'GET',
        headers,
      },
      (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          span.setAttribute('http.status_code', res.statusCode);
          span.end();
          resolve({ status: res.statusCode, data, headers: res.headers });
        });
      }
    );

    req.on('error', (err) => {
      span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
      span.end();
      reject(err);
    });

    req.setTimeout(10000, () => {
      span.setStatus({ code: SpanStatusCode.ERROR, message: 'Request timeout' });
      span.end();
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    req.end();
  });
}
