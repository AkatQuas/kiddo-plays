-- Chapter 11: MVCC demo tables
CREATE TABLE IF NOT EXISTS mvcc_demo (
  id SERIAL PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO mvcc_demo (value)
SELECT * FROM (VALUES ('row-1'), ('row-2'), ('row-3'), ('row-4'), ('row-5')) AS v(value)
WHERE NOT EXISTS (SELECT 1 FROM mvcc_demo LIMIT 1);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(200) NOT NULL,
  status VARCHAR(20) DEFAULT 'active'
);

INSERT INTO users (name, email, status)
SELECT * FROM (VALUES
  ('Alice', 'alice@example.com', 'active'),
  ('Bob', 'bob@example.com', 'active')
) AS v(name, email, status)
WHERE NOT EXISTS (SELECT 1 FROM users LIMIT 1);
