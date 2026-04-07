import { serve } from '@hono/node-server';
import { Hono } from 'hono';

const app = new Hono();

app.get('/', (c) => {
  return c.text('Hello Hono!');
});

app.post('/post', async (c) => {
  const body = await c.req.json();
  return c.json({ message: 'POST received', data: body });
});

app.put('/put', async (c) => {
  const body = await c.req.json();
  return c.json({ message: 'PUT received', data: body });
});

app.delete('/delete', (c) => {
  return c.json({ message: 'DELETE received' });
});

const server = serve(
  {
    fetch: app.fetch,
    port: 3000
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
  }
);

// graceful shutdown
process.on('SIGINT', () => {
  server.close();
  process.exit(0);
});
process.on('SIGTERM', () => {
  server.close((err) => {
    if (err) {
      console.error(err);
      process.exit(1);
    }
    process.exit(0);
  });
});
