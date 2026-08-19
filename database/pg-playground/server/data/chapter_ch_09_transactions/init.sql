-- Chapter 1: Basic SELECT - users and orders
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
  ('Charlie', 'charlie@example.com', 'inactive'),
  ('Diana', 'diana@example.com', 'active'),
  ('Eve', 'eve@example.com', 'active'),
  ('Frank', 'frank@example.com', 'inactive'),
  ('Grace', 'grace@example.com', 'active'),
  ('Henry', 'henry@example.com', 'active'),
  ('Ivy', 'ivy@example.com', 'active'),
  ('Jack', 'jack@example.com', 'inactive')
ON CONFLICT DO NOTHING;

INSERT INTO orders (user_id, amount, status) VALUES
  (1, 99.99, 'completed'),
  (1, 49.50, 'completed'),
  (2, 199.00, 'pending'),
  (3, 29.99, 'cancelled'),
  (4, 150.00, 'completed'),
  (5, 75.25, 'completed'),
  (6, 300.00, 'pending'),
  (7, 45.00, 'completed'),
  (8, 88.88, 'completed'),
  (9, 12.50, 'pending'),
  (10, 500.00, 'completed'),
  (2, 33.33, 'completed')
ON CONFLICT DO NOTHING;
