import { getDatabase } from '../database';

export interface OperationLog {
  id: number;
  action_type: string;
  detail: string | null;
  operator: string;
  create_time: string;
}

export async function logOperation(
  actionType: string,
  detail?: string
): Promise<number> {
  const db = await getDatabase();
  const result = await db.runAsync(
    `INSERT INTO operation_log_table (action_type, detail) VALUES (?, ?)`,
    [actionType, detail ?? null]
  );
  return result.lastInsertRowId;
}

export async function getRecentLogs(limit = 50): Promise<OperationLog[]> {
  const db = await getDatabase();
  return await db.getAllAsync<OperationLog>(
    'SELECT * FROM operation_log_table ORDER BY create_time DESC LIMIT ?',
    [limit]
  );
}

export async function getLogsByType(
  actionType: string,
  limit = 50
): Promise<OperationLog[]> {
  const db = await getDatabase();
  return await db.getAllAsync<OperationLog>(
    'SELECT * FROM operation_log_table WHERE action_type = ? ORDER BY create_time DESC LIMIT ?',
    [actionType, limit]
  );
}