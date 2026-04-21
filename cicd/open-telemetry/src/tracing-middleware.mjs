import { trace, context, SpanStatusCode, propagation } from '@opentelemetry/api';

/**
 * Express middleware that creates spans for incoming requests
 * Extracts trace context from incoming requests and propagates to outgoing requests
 */
export function tracingMiddleware(req, res, next) {
  const tracer = trace.getTracer('express-server');

  // Extract trace context from incoming request headers (traceparent)
  const parentContext = propagation.extract(context.active(), req.headers);

  // Create span with extracted context (continues the trace or starts new one)
  const span = tracer.startSpan(`${req.method} ${req.route?.path || req.path}`, {
    kind: 1, // SERVER
    attributes: {
      'http.method': req.method,
      'http.url': req.url,
      'http.route': req.route?.path || req.path,
      'http.scheme': 'http',
      'http.host': req.headers.host,
      'http.user_agent': req.headers['user-agent'],
    },
  }, parentContext);

  // Set the current context so outgoing requests can pick it up
  const ctx = trace.setSpan(parentContext, span);

  // Wrap response to capture status and end span
  const originalEnd = res.end;
  res.end = function (chunk, encoding) {
    span.setAttribute('http.status_code', res.statusCode);
    if (res.statusCode >= 400) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: `HTTP ${res.statusCode}` });
    }
    span.end();
    return originalEnd.call(this, chunk, encoding);
  };

  // Run the rest of the middleware/handler in this context
  context.with(ctx, next);
}
