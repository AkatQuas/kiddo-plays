-- Chapter 8: Indexes - larger dataset for index demos
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(200) NOT NULL,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  user_id INTEGER,
  amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed enough rows for index comparison
INSERT INTO users (name, email, status)
SELECT 'User_' || i, 'user' || i || '@example.com',
       CASE WHEN i % 3 = 0 THEN 'inactive' ELSE 'active' END
FROM generate_series(1, 500) AS i
ON CONFLICT DO NOTHING;

INSERT INTO orders (user_id, amount, status)
SELECT (i % 500) + 1, (random() * 500)::decimal(10,2),
       CASE WHEN i % 4 = 0 THEN 'pending' WHEN i % 4 = 1 THEN 'cancelled' ELSE 'completed' END
FROM generate_series(1, 2000) AS i
ON CONFLICT DO NOTHING;
