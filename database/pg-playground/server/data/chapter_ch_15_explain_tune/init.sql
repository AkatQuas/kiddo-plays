-- Chapter 15: Explain tuning - large dataset
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(200) NOT NULL,
  status VARCHAR(20) DEFAULT 'active',
  region VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO users (name, email, status, region)
SELECT 'User_' || i, 'user' || i || '@example.com',
       CASE WHEN i % 5 = 0 THEN 'inactive' ELSE 'active' END,
       CASE i % 4 WHEN 0 THEN 'north' WHEN 1 THEN 'south' WHEN 2 THEN 'east' ELSE 'west' END
FROM generate_series(1, 10000) AS i
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  user_id INTEGER,
  amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO orders (user_id, amount, status)
SELECT (i % 10000) + 1, (random() * 1000)::decimal(10,2),
       CASE WHEN i % 3 = 0 THEN 'pending' ELSE 'completed' END
FROM generate_series(1, 50000) AS i
ON CONFLICT DO NOTHING;
