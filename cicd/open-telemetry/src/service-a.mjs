import { initTracing } from './tracing.mjs';
import { tracingMiddleware } from './tracing-middleware.mjs';
import { httpRequest } from './http-utils.mjs';
import express from 'express';

await initTracing({ serviceName: 'service-a' });

const app = express();
const PORT = 3001;

app.use(express.json());
app.use(tracingMiddleware);

app.get('/service-a', async (req, res) => {
  console.log('[Service A] Received request');

  // Call Service B with trace context propagation
  const response = await httpRequest({
    hostname: 'localhost',
    port: 3002,
    path: '/service-b',
    spanName: 'HTTP GET service-b',
    attributes: { 'peer.service': 'service-b' },
  });

  res.json({ from: 'service-a', called: 'service-b', response: response.data });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'service-a', port: PORT });
});

app.listen(PORT, () => {
  console.log(`Service A running on port ${PORT}`);
});
