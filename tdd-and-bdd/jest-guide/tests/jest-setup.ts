import '@testing-library/jest-dom';
import 'jest-location-mock';
import mockConsole from 'jest-mock-console';
import { server } from './mock-server/server';

mockConsole();
// Mock `localStorage` manually
//
// Object.defineProperty(global, 'localStorage', {
//   value: {
//     store: {} as Record<string, string>,
//     setItem(key: string, value: string) {
//       this.store[key] = value;
//     },
//     getItem(key: string): string {
//       return this.store[key];
//     },
//     removeItem(key: string) {
//       delete this.store[key];
//     },
//     clear() {
//       this.store = {};
//     },
//   },
// });

// See https://jestjs.io/docs/manual-mocks#mocking-methods-which-are-not-implemented-in-jsdom
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

beforeAll(() => {
  server.listen();
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});
