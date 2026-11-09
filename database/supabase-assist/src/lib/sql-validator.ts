/**
 * SQL gate for controlled ops probes.
 *
 * mode='read'   → SELECT / WITH / EXPLAIN / SHOW / VALUES
 * mode='schema' → read + CREATE TABLE|INDEX|SCHEMA + ALTER TABLE ... ADD ... + COMMENT ON
 *
 * Layers: strip comments/strings → single-statement → leading whitelist →
 * CREATE/ALTER secondary whitelist → keyword blacklist → dangerous functions.
 * Hard backstop for read: BEGIN READ ONLY at execute time.
 */

const MAX_SQL_LENGTH = 8000;

export type SqlMode = 'read' | 'schema';

const ALLOWED_LEADING_BY_MODE: Record<SqlMode, Set<string>> = {
  read: new Set(['SELECT', 'WITH', 'EXPLAIN', 'SHOW', 'VALUES']),
  schema: new Set(['SELECT', 'WITH', 'EXPLAIN', 'SHOW', 'VALUES', 'CREATE', 'ALTER', 'COMMENT']),
};

const ALWAYS_FORBIDDEN_KEYWORDS = [
  'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'MERGE', 'COPY', 'IMPORT',
  'DROP', 'RENAME',
  'GRANT', 'REVOKE', 'SECURITY', 'OWNED', 'OWNER', 'POLICY', 'ROLE',
  'BEGIN', 'COMMIT', 'ROLLBACK', 'SAVEPOINT', 'RELEASE', 'START', 'END', 'DISCARD',
  'SET', 'RESET', 'CHECKPOINT', 'LOAD', 'LOCK',
  'VACUUM', 'ANALYZE', 'REFRESH', 'CLUSTER', 'REINDEX',
  'EXECUTE', 'PREPARE', 'DEALLOCATE', 'FETCH', 'CLOSE', 'MOVE',
  'LISTEN', 'NOTIFY', 'UNLISTEN',
  'CALL', 'DO',
];

const READ_MODE_EXTRA_FORBIDDEN = [
  'CREATE', 'ALTER', 'COMMENT',
  'TRIGGER', 'FUNCTION', 'PROCEDURE', 'EXTENSION', 'TABLESPACE',
  'PUBLICATION', 'SUBSCRIPTION', 'AGGREGATE', 'OPERATOR', 'SEQUENCE',
  'DOMAIN', 'COLLATION', 'CONVERSION', 'LANGUAGE', 'SERVER', 'STATISTICS', 'TRANSFORM',
];

const SCHEMA_ALLOWED_CREATE_TARGETS = new Set(['TABLE', 'INDEX', 'SCHEMA']);

const DANGEROUS_FUNCTIONS = [
  'pg_read_file', 'pg_read_binary_file', 'pg_ls_dir', 'pg_stat_file',
  'pg_reload_conf', 'pg_promote', 'pg_terminate_backend', 'pg_cancel_backend',
  'lo_import', 'lo_export', 'dblink', 'dblink_exec', 'dblink_connect', 'dblink_disconnect',
];

function stripCommentsAndStrings(sql: string): string {
  let out = '';
  let i = 0;
  const n = sql.length;
  while (i < n) {
    const c = sql[i];
    const c2 = sql[i + 1];

    if (c === '-' && c2 === '-') {
      while (i < n && sql[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && c2 === '*') {
      let depth = 1;
      i += 2;
      while (i < n && depth > 0) {
        if (sql[i] === '/' && sql[i + 1] === '*') {
          depth++;
          i += 2;
          continue;
        }
        if (sql[i] === '*' && sql[i + 1] === '/') {
          depth--;
          i += 2;
          continue;
        }
        i++;
      }
      continue;
    }
    if ((c === 'E' || c === 'e') && c2 === "'") {
      i += 2;
      while (i < n) {
        if (sql[i] === '\\' && i + 1 < n) {
          i += 2;
          continue;
        }
        if (sql[i] === "'") {
          i++;
          break;
        }
        i++;
      }
      out += "''";
      continue;
    }
    if (c === "'") {
      i++;
      while (i < n) {
        if (sql[i] === "'" && sql[i + 1] === "'") {
          i += 2;
          continue;
        }
        if (sql[i] === "'") {
          i++;
          break;
        }
        i++;
      }
      out += "''";
      continue;
    }
    if (c === '"') {
      i++;
      while (i < n) {
        if (sql[i] === '"' && sql[i + 1] === '"') {
          i += 2;
          continue;
        }
        if (sql[i] === '"') {
          i++;
          break;
        }
        i++;
      }
      out += '"x"';
      continue;
    }
    if (c === '$') {
      const m = sql.slice(i).match(/^\$([A-Za-z_][A-Za-z0-9_]*)?\$/);
      if (m) {
        const tag = m[0];
        const start = i + tag.length;
        const end = sql.indexOf(tag, start);
        if (end !== -1) {
          i = end + tag.length;
          out += "''";
          continue;
        }
        out += "''";
        i = n;
        continue;
      }
    }
    out += c;
    i++;
  }
  return out;
}

export type SqlValidationResult = { ok: true; sql: string; mode: SqlMode } | { ok: false; error: string };

export function validateSql(input: unknown, mode: SqlMode = 'read'): SqlValidationResult {
  if (typeof input !== 'string') return { ok: false, error: 'sql must be a string' };
  const raw = input.trim();
  if (!raw) return { ok: false, error: 'sql is empty' };
  if (raw.length > MAX_SQL_LENGTH) return { ok: false, error: `sql exceeds ${MAX_SQL_LENGTH} chars` };
  if (mode !== 'read' && mode !== 'schema') {
    return { ok: false, error: `mode must be 'read' | 'schema', got: ${String(mode)}` };
  }

  const stripped = stripCommentsAndStrings(raw);
  const noTrailing = stripped.replace(/;\s*$/, '');
  if (/;/.test(noTrailing)) {
    return { ok: false, error: 'multiple statements not allowed' };
  }

  const firstKwMatch = noTrailing.match(/^\s*\(*\s*([A-Za-z]+)/);
  const firstKw = firstKwMatch?.[1]?.toUpperCase() ?? '';
  const allowed = ALLOWED_LEADING_BY_MODE[mode];
  if (!allowed.has(firstKw)) {
    return {
      ok: false,
      error: `leading keyword must be ${[...allowed].join(' / ')} (mode='${mode}'), got: ${firstKw || '(empty)'}`,
    };
  }

  if (mode === 'schema') {
    if (firstKw === 'CREATE') {
      const stripped2 = noTrailing.replace(
        /^\s*CREATE\s+(?:OR\s+REPLACE\s+)?(?:UNIQUE\s+)?(?:TEMP(?:ORARY)?\s+)?(?:UNLOGGED\s+)?/i,
        '',
      );
      const targetMatch = stripped2.match(/^\s*([A-Za-z]+)/);
      const target = targetMatch?.[1]?.toUpperCase() ?? '';
      if (!SCHEMA_ALLOWED_CREATE_TARGETS.has(target)) {
        return {
          ok: false,
          error: `CREATE ${target || '(unparsed)'} not allowed; schema mode allows TABLE / INDEX / SCHEMA only`,
        };
      }
    } else if (firstKw === 'ALTER') {
      if (!/^\s*ALTER\s+TABLE\b/i.test(noTrailing)) {
        return { ok: false, error: 'ALTER only allows ALTER TABLE in schema mode' };
      }
      const actionMatch = noTrailing.match(
        /^\s*ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:ONLY\s+)?[\w."]+\s+([A-Za-z]+)/i,
      );
      const action = actionMatch?.[1]?.toUpperCase() ?? '';
      if (action !== 'ADD') {
        return {
          ok: false,
          error: `ALTER TABLE only allows ADD (COLUMN / CONSTRAINT), got: ${action || '(unparsed)'}`,
        };
      }
    } else if (firstKw === 'COMMENT') {
      if (!/^\s*COMMENT\s+ON\b/i.test(noTrailing)) {
        return { ok: false, error: 'COMMENT only allows COMMENT ON ...' };
      }
    }
  }

  const forbiddenList = [...ALWAYS_FORBIDDEN_KEYWORDS, ...(mode === 'read' ? READ_MODE_EXTRA_FORBIDDEN : [])];
  const forbiddenRe = new RegExp(`\\b(${forbiddenList.join('|')})\\b`, 'i');
  const fbHit = noTrailing.match(forbiddenRe);
  if (fbHit) {
    return { ok: false, error: `forbidden keyword: ${fbHit[1].toUpperCase()}` };
  }

  const dangerRe = new RegExp(`\\b(${DANGEROUS_FUNCTIONS.join('|')})\\s*\\(`, 'i');
  const dHit = noTrailing.match(dangerRe);
  if (dHit) {
    return { ok: false, error: `forbidden function: ${dHit[1]}` };
  }

  return { ok: true, sql: raw, mode };
}
