import { afterAll, beforeAll } from 'bun:test';

beforeAll(async () => {
  // global setup
  console.log('Global test setup');
  console.log('NODE_ENV', process.env.NODE_ENV);
  // Initialize database connections, start servers, etc.
});

afterAll(async () => {
  // global teardown
  console.log('Global test teardown');
  // Close database connections, stop servers, etc.
});
