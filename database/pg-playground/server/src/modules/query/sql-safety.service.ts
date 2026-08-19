import { Injectable } from '@nestjs/common';

const DANGEROUS_PATTERNS = [
  /\bDROP\s+DATABASE\b/i,
  /\bDROP\s+SCHEMA\b/i,
  /\bTRUNCATE\b/i,
  /\bALTER\s+SYSTEM\b/i,
  /\bCOPY\s+.*\s+TO\s+PROGRAM\b/i,
  /\bpg_read_file\b/i,
  /\bpg_write_file\b/i,
  /\blo_import\b/i,
  /\blo_export\b/i,
];

const DML_PATTERN = /^\s*(INSERT|UPDATE|DELETE)\b/i;
const DDL_PATTERN = /^\s*(CREATE|ALTER|DROP)\b/i;

export interface SqlValidationResult {
  valid: boolean;
  error?: string;
  isDml: boolean;
  isDdl: boolean;
}

@Injectable()
export class SqlSafetyService {
  validate(sql: string, options?: { allowDdl?: boolean }): SqlValidationResult {
    const trimmed = sql.trim();
    if (!trimmed) {
      return { valid: false, error: 'SQL is empty', isDml: false, isDdl: false };
    }

    for (const pattern of DANGEROUS_PATTERNS) {
      if (pattern.test(trimmed)) {
        return {
          valid: false,
          error: `Dangerous SQL command detected: ${pattern.source}`,
          isDml: false,
          isDdl: false,
        };
      }
    }

    const isDml = DML_PATTERN.test(trimmed);
    const isDdl = DDL_PATTERN.test(trimmed);

    if (isDdl && !options?.allowDdl) {
      return {
        valid: false,
        error: 'DDL statements are only allowed in migration chapters',
        isDml,
        isDdl,
      };
    }

    return { valid: true, isDml, isDdl };
  }

  substituteCloze(sql: string, values: Record<string, string>): string {
    let result = sql;
    for (const [key, value] of Object.entries(values)) {
      if (!/^[a-zA-Z0-9_.'" -]+$/.test(value)) {
        throw new Error(`Invalid value for placeholder ${key}`);
      }
      result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    }
    if (/\{\{[^}]+\}\}/.test(result)) {
      throw new Error('All cloze placeholders must be filled');
    }
    return result;
  }
}
