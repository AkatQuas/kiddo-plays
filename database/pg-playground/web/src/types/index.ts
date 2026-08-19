export interface ChapterMeta {
  id: string;
  title: string;
  category: string;
  order: number;
}

export interface CategoryGroup {
  category: string;
  chapters: ChapterMeta[];
}

export interface ChapterExample {
  label: string;
  sql: string;
  tooltip?: string;
}

export interface ChapterConfig {
  id: string;
  title: string;
  category: string;
  order: number;
  theory: string;
  learningObjectives: string[];
  dataset: { tables: string[]; description: string };
  examples: ChapterExample[];
  initialSQL: string;
  clozeTemplate?: string;
  features?: { lockGraph?: boolean; migration?: boolean };
}

export interface QueryMessage {
  level: 'INFO' | 'WARNING' | 'ERROR' | 'NOTICE';
  message: string;
  timestamp: string;
}

export interface QueryResultData {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  executionTimeMs: number;
  messages: QueryMessage[];
  explain?: unknown;
  transactionStatus: 'none' | 'active' | 'committed' | 'rolled_back';
  sql: string;
}

export interface MigrationRecord {
  version: string;
  name: string;
  executed_at: string;
  status: string;
  operator: string;
}

export type ChapterStatus = 'not_started' | 'in_progress' | 'completed';

export type ResultTab = 'data' | 'explain' | 'messages' | 'locks' | 'migration';

export interface ApiResponse<T> {
  data: T;
  message: string;
  error: { code: string; detail?: string } | null;
}
