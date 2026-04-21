import { initTracing } from './tracing.mjs';
import { tracingMiddleware } from './tracing-middleware.mjs';
import { httpRequest } from './http-utils.mjs';
import express from 'express';

await initTracing({ serviceName: 'service-b' });

const app = express();
const PORT = 3002;

app.use(express.json());
app.use(tracingMiddleware);

app.get('/service-b', async (req, res) => {
  console.log('[Service B] Received request');

  // Call Service C with trace context propagation
  const response = await httpRequest({
    hostname: 'localhost',
    port: 3003,
    path: '/service-c',
    spanName: 'HTTP GET service-c',
    attributes: { 'peer.service': 'service-c' },
  });

  res.json({ from: 'service-b', called: 'service-c', response: response.data });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'service-b', port: PORT });
});

app.listen(PORT, () => {
  console.log(`Service B running on port ${PORT}`);
});
