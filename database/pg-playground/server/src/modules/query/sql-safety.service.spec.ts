import { SqlSafetyService } from './sql-safety.service';

describe('SqlSafetyService', () => {
  let service: SqlSafetyService;

  beforeEach(() => {
    service = new SqlSafetyService();
  });

  it('should reject empty SQL', () => {
    const result = service.validate('');
    expect(result.valid).toBe(false);
  });

  it('should reject DROP DATABASE', () => {
    const result = service.validate('DROP DATABASE pgplayground');
    expect(result.valid).toBe(false);
  });

  it('should reject TRUNCATE', () => {
    const result = service.validate('TRUNCATE users');
    expect(result.valid).toBe(false);
  });

  it('should allow SELECT queries', () => {
    const result = service.validate('SELECT * FROM users');
    expect(result.valid).toBe(true);
    expect(result.isDml).toBe(false);
  });

  it('should detect DML', () => {
    const result = service.validate('INSERT INTO users (name) VALUES (\'test\')');
    expect(result.valid).toBe(true);
    expect(result.isDml).toBe(true);
  });

  it('should substitute cloze values safely', () => {
    const sql = service.substituteCloze(
      'SELECT {{column}} FROM users WHERE status = {{status}}',
      { column: 'name', status: "'active'" },
    );
    expect(sql).toBe("SELECT name FROM users WHERE status = 'active'");
  });

  it('should reject invalid cloze values', () => {
    expect(() =>
      service.substituteCloze('SELECT {{col}}', { col: '1; DROP TABLE users' }),
    ).toThrow();
  });
});
