-- Migration demo schema: teaching tables for migration chapters
CREATE SCHEMA IF NOT EXISTS migration_demo;

CREATE TABLE IF NOT EXISTS migration_demo.schema_migrations (
  version VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status VARCHAR(50) NOT NULL DEFAULT 'success',
  operator VARCHAR(100) DEFAULT 'local_user'
);

CREATE TABLE IF NOT EXISTS migration_demo.app_users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(200) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS migration_demo.products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO migration_demo.app_users (name, email)
SELECT * FROM (VALUES
  ('Alice', 'alice@example.com'),
  ('Bob', 'bob@example.com')
) AS v(name, email)
WHERE NOT EXISTS (SELECT 1 FROM migration_demo.app_users LIMIT 1);

INSERT INTO migration_demo.products (name, price)
SELECT * FROM (VALUES
  ('Laptop', 999.99),
  ('Mouse', 29.99),
  ('Keyboard', 79.99)
) AS v(name, price)
WHERE NOT EXISTS (SELECT 1 FROM migration_demo.products LIMIT 1);
