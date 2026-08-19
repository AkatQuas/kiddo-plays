-- Chapter 10: Locks - same ecommerce data
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(200) NOT NULL,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO users (name, email, status) VALUES
  ('Alice', 'alice@example.com', 'active'),
  ('Bob', 'bob@example.com', 'active'),
  ('Charlie', 'charlie@example.com', 'inactive')
ON CONFLICT DO NOTHING;

INSERT INTO orders (user_id, amount, status) VALUES
  (1, 99.99, 'completed'),
  (2, 199.00, 'pending'),
  (3, 29.99, 'cancelled')
ON CONFLICT DO NOTHING;
