import { setupServer } from 'msw/node';
import { userApiMock } from './user';

export const server = setupServer(...userApiMock);
