import { initTracing } from './tracing.mjs';
import { tracingMiddleware } from './tracing-middleware.mjs';
import express from 'express';

await initTracing({ serviceName: 'service-c' });

const app = express();
const PORT = 3003;

app.use(express.json());
app.use(tracingMiddleware);

app.get('/service-c', (req, res) => {
  console.log('[Service C] Received request - this is the leaf service');
  res.json({ from: 'service-c', message: 'Hello from service C (leaf)' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'service-c', port: PORT });
});

app.listen(PORT, () => {
  console.log(`Service C running on port ${PORT}`);
});
