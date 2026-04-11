// Global mocks
import { afterEach, beforeEach, mock } from 'bun:test';

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.API_URL = 'http://localhost:3001';

beforeEach(async () => {
  // Mock external dependencies
  mock.module('./api-client', () => ({
    fetchUser: mock(() => Promise.resolve({ id: 1, name: 'Test User' })),
    createUser: mock(() => Promise.resolve({ id: 2 }))
  }));
});

afterEach(async () => {
  // Clear all mocks after each test
  mock.restore();
});
