import 'dart:convert';
import 'dart:io';
import 'package:crypto/crypto.dart';
import 'package:sqlite3/sqlite3.dart';
import 'package:path/path.dart' as p;
import '../utils/path.dart';

late Database db;

const int _schemaVersion = 1;

void initDatabase() {
  final documentsDir = getDataDir();
  final dbPath = p.join(documentsDir, 'ops_tool.db');
  print('dbPath -> $dbPath');
  db = sqlite3.open(dbPath);
  _initMigrationTable();
  _runMigrations();
}

void _initMigrationTable() {
  db.execute('''
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      filename TEXT NOT NULL,
      hash TEXT NOT NULL,
      applied_at TEXT NOT NULL
    )
  ''');
}

void _runMigrations() {
  final currentVersion = _getCurrentVersion();
  print('current version $currentVersion');
  for (int version = currentVersion + 1; version <= _schemaVersion; version++) {
    _applyMigration(version);
  }
}

int _getCurrentVersion() {
  final result = db.select('SELECT MAX(version) as version FROM schema_migrations');
  if (result.isEmpty || result.first['version'] == null) {
    return 0;
  }
  return result.first['version'] as int;
}

void _applyMigration(int version) {
  final migration = _loadMigrationSql(version);
  if (migration == null) {
    throw Exception('Migration $version not found');
  }

  final (filename, sql) = migration;
  final hash = _computeHash(sql);
  print('Apply Migration file not found: $filename, hash: $hash');

  final existing = db.select(
    'SELECT hash FROM schema_migrations WHERE version = ?',
    [version],
  );
  if (existing.isNotEmpty) {
    final existingHash = existing.first['hash'] as String;
    if (existingHash != hash) {
      throw Exception(
        'Migration conflict: version $version has different hash. '
        'Expected: $hash, got: $existingHash',
      );
    }
    print('Migration $version already applied with matching hash');
    return;
  }

  _executeSql(sql);

  final appliedAt = DateTime.now().toIso8601String();
  db.execute(
    'INSERT INTO schema_migrations (version, filename, hash, applied_at) VALUES (?, ?, ?, ?)',
    [version, filename, hash, appliedAt],
  );
  print('Applied migration $version ($filename)');
}

(String filename, String sql)? _loadMigrationSql(int version) {
  final scriptDir = getDataDir();
  final migrationsDir = p.join(scriptDir, 'migrations');
  final filename = '${version.toString().padLeft(3, '0')}.sql';
  final migrationPath = p.join(migrationsDir, filename);

  try {
    final file = File(migrationPath);
    if (!file.existsSync()) {
      print('Migration file not found: $migrationPath');
      return null;
    }
    return (filename, file.readAsStringSync());
  } catch (e) {
    print('Failed to load migration $migrationPath: $e');
    return null;
  }
}

String _computeHash(String sql) {
  final bytes = utf8.encode(sql);
  final digest = md5.convert(bytes);
  return digest.toString();
}

void _executeSql(String sql) {
  final statements = sql.split(';').where((s) => s.trim().isNotEmpty);
  for (final statement in statements) {
    db.execute(statement.trim());
  }
}
