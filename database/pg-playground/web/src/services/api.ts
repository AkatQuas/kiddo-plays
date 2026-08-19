import axios from 'axios';
import type {
  ApiResponse,
  CategoryGroup,
  ChapterConfig,
  MigrationRecord,
  QueryResultData,
} from '../types';

const client = axios.create({ baseURL: '/api', timeout: 60000 });

export const api = {
  getChapters: () =>
    client.get<ApiResponse<CategoryGroup[]>>('/chapters').then((r) => r.data),

  getChapter: (id: string) =>
    client.get<ApiResponse<ChapterConfig>>(`/chapters/${id}`).then((r) => r.data),

  executeQuery: (chapterId: string, sql: string, options?: {
    explain?: boolean;
    clozeValues?: Record<string, string>;
  }) =>
    client.post<ApiResponse<QueryResultData>>('/query/execute', {
      chapterId,
      sql,
      sessionId: 'default',
      ...options,
    }).then((r) => r.data),

  commit: (chapterId: string) =>
    client.post<ApiResponse<{ transactionStatus: string }>>('/query/commit', {
      chapterId,
      sessionId: 'default',
    }).then((r) => r.data),

  rollback: (chapterId: string) =>
    client.post<ApiResponse<{ transactionStatus: string }>>('/query/rollback', {
      chapterId,
      sessionId: 'default',
    }).then((r) => r.data),

  resetChapter: (chapterId: string) =>
    client.post<ApiResponse<{ reset: boolean }>>('/session/reset', {
      chapterId,
      sessionId: 'default',
    }).then((r) => r.data),

  getMigrationHistory: () =>
    client.get<ApiResponse<MigrationRecord[]>>('/migration/history').then((r) => r.data),

  runMigrationUp: (version: string, name: string, sql: string) =>
    client.post<ApiResponse<MigrationRecord>>('/migration/up', { version, name, sql }).then((r) => r.data),

  runMigrationDown: (version: string, sql: string) =>
    client.post<ApiResponse<{ version: string }>>('/migration/down', { version, sql }).then((r) => r.data),

  getSchemaStatus: () =>
    client.get<ApiResponse<{ tables: string[]; migrationCount: number }>>('/schema/status').then((r) => r.data),
};
