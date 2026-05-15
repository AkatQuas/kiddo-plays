import { getDatabase } from '../database';

export interface SystemConfig {
  id: number;
  shop_name: string;
  table_num: number;
  admin_pwd: string;
  bio_unlock: number;
  timeout_time: number;
  encrypt_key: string | null;
  is_initialized: number;
  disclaimer_accepted: number;
  onboarding_completed: number;
  update_time: string;
}

export async function getConfig(): Promise<SystemConfig | null> {
  const db = await getDatabase();
  return await db.getFirstAsync<SystemConfig>(
    'SELECT * FROM system_config_table WHERE id = 1'
  );
}

export async function initializeConfig(config: {
  shop_name: string;
  table_num: number;
  admin_pwd: string;
}): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO system_config_table (id, shop_name, table_num, admin_pwd, is_initialized)
     VALUES (1, ?, ?, ?, 1)`,
    [config.shop_name, config.table_num, config.admin_pwd]
  );
}

export async function updateConfig(
  data: Partial<Omit<SystemConfig, 'id' | 'update_time'>>
): Promise<void> {
  const db = await getDatabase();
  const sets: string[] = [];
  const values: any[] = [];

  const allowedFields: (keyof typeof data)[] = [
    'shop_name', 'table_num', 'admin_pwd', 'bio_unlock',
    'timeout_time', 'encrypt_key', 'is_initialized',
    'disclaimer_accepted', 'onboarding_completed'
  ];

  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      sets.push(`${field} = ?`);
      values.push(data[field]);
    }
  }

  if (sets.length === 0) return;
  sets.push("update_time = datetime('now','localtime')");
  values.push(1);

  await db.runAsync(
    `UPDATE system_config_table SET ${sets.join(', ')} WHERE id = ?`,
    values
  );
}

export async function isInitialized(): Promise<boolean> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM system_config_table WHERE id = 1 AND is_initialized = 1"
  );
  return (row?.count ?? 0) > 0;
}