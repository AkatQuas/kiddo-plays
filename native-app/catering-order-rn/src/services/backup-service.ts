import { File, Directory, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { logOperation } from '@/src/db/repositories/operation-log-repository';

const DB_NAME = 'shop_local.db';

function getDbFile(): File {
  const sqliteDir = new Directory(Paths.document, 'SQLite');
  return new File(sqliteDir, DB_NAME);
}

export async function backupDatabase(): Promise<File> {
  const dbFile = getDbFile();
  const backupDir = new Directory(Paths.document, 'backups');
  backupDir.create({ idempotent: true });

  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const backupFile = backupDir.createFile(`backup_${dateStr}.db`, 'application/octet-stream');

  dbFile.copy(backupFile);

  await logOperation('backup_create', `备份文件: ${backupFile.name}`);

  return backupFile;
}

export async function shareBackup(): Promise<void> {
  const file = await backupDatabase();
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/octet-stream',
      dialogTitle: '分享数据库备份',
    });
  } else {
    throw new Error('当前设备不支持文件分享');
  }
}

export async function restoreDatabase(backupPath: string): Promise<void> {
  const dbFile = getDbFile();
  const backupDir = new Directory(Paths.document, 'backups');
  backupDir.create({ idempotent: true });

  // Safety backup before restore
  const safetyFile = backupDir.createFile(`pre_restore_${Date.now()}.db`, 'application/octet-stream');
  dbFile.copy(safetyFile);

  // Restore backup over current db
  const backupFile = new File(backupPath);
  backupFile.copy(dbFile);

  await logOperation('backup_restore', '数据从备份文件恢复');
}

export async function getBackupList(): Promise<
  { name: string; path: string; size: number; date: string }[]
> {
  try {
    const backupDir = new Directory(Paths.document, 'backups');
    const entries = backupDir.list();
    const result = [];
    for (const entry of entries) {
      if (entry instanceof File && entry.name.endsWith('.db') && entry.name.startsWith('backup_')) {
        result.push({
          name: entry.name,
          path: entry.uri,
          size: entry.size ?? 0,
          date: entry.name.replace('backup_', '').replace('.db', ''),
        });
      }
    }
    return result.sort((a, b) => b.date.localeCompare(a.date));
  } catch {
    return [];
  }
}