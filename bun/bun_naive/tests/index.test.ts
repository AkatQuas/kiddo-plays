import type { Server } from 'bun';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { app } from '../src/index';

let server: Server<undefined>;

beforeAll(() => {
  server = Bun.serve({
    port: 0,
    routes: app.routes,
    fetch: app.fetch
  } as Parameters<typeof Bun.serve>[0]);
});

afterAll(() => {
  server.stop();
});

const getUrl = (path: string) => `${server.url}${path}`;

describe.concurrent('Health check', () => {
  test('GET /api/healthy returns OK', async () => {
    const res = await fetch(getUrl('/api/healthy'));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('');
  });
});

describe.concurrent('User routes', () => {
  test('GET /users/:id returns greeting with user id', async () => {
    const res = await fetch(getUrl('/users/123'));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('Hello User 123!');
  });

  test('GET /users/:id with different id', async () => {
    const res = await fetch(getUrl('/users/42'));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('Hello User 42!');
  });
});

describe.concurrent('Dice route', () => {
  test('GET /api/dice returns number with default range (2-10)', async () => {
    const res = await fetch(getUrl('/api/dice'));
    expect(res.status).toBe(200);
    const text = await res.text();
    const num = parseInt(text);
    expect(num).toBeGreaterThanOrEqual(2);
    expect(num).toBeLessThanOrEqual(10);
  });

  test('GET /api/dice?min=1&max=6 returns number in range', async () => {
    const res = await fetch(getUrl('/api/dice?min=1&max=6'));
    expect(res.status).toBe(200);
    const text = await res.text();
    const num = parseInt(text);
    expect(num).toBeGreaterThanOrEqual(1);
    expect(num).toBeLessThanOrEqual(6);
  });

  test('GET /api/dice?min=0&max=100 returns number in range', async () => {
    const res = await fetch(getUrl('/api/dice?min=0&max=100'));
    expect(res.status).toBe(200);
    const text = await res.text();
    const num = parseInt(text);
    expect(num).toBeGreaterThanOrEqual(0);
    expect(num).toBeLessThanOrEqual(100);
  });
});

describe.concurrent('Posts routes', () => {
  test('GET /api/posts returns list posts', async () => {
    const res = await fetch(getUrl('/api/posts'));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('List posts');
  });

  test('POST /api/posts creates post', async () => {
    const res = await fetch(getUrl('/api/posts'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Hello World', content: 'Test content' })
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      created: boolean;
      title: string;
      content: string;
    };
    expect(json.created).toBe(true);
    expect(json.title).toBe('Hello World');
    expect(json.content).toBe('Test content');
  });

  test('POST /api/posts returns echoed body', async () => {
    const res = await fetch(getUrl('/api/posts'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'test', value: 123 })
    });
    const json = (await res.json()) as {
      created: boolean;
      name: string;
      value: number;
    };
    expect(json).toEqual({ created: true, name: 'test', value: 123 });
  });
});

describe.concurrent('Wildcard route', () => {
  test('GET /api/unknown returns 404 with message', async () => {
    const res = await fetch(getUrl('/api/unknown'));
    expect(res.status).toBe(404);
    const json = (await res.json()) as { message: string };
    expect(json.message).toBe('Not found');
  });
});

describe.concurrent('Redirect', () => {
  test('GET /blog/hello redirects to /blog/hello/world', async () => {
    const res = await fetch(getUrl('/blog/hello'), { redirect: 'manual' });
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('/blog/hello/world');
  });
});

describe.concurrent('Fallback route', () => {
  test('GET /unknown returns 404', async () => {
    const res = await fetch(getUrl('/unknown'));
    expect(res.status).toBe(404);
    expect(await res.text()).toBe('Not Found');
  });
});
