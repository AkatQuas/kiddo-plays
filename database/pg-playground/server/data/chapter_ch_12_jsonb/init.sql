-- Chapter 12: JSONB
CREATE TABLE IF NOT EXISTS documents (
  id SERIAL PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  tags JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO documents (title, metadata, tags) VALUES
  ('Product Guide', '{"author": "Alice", "version": 1, "category": "docs"}', '["guide", "product"]'),
  ('API Reference', '{"author": "Bob", "version": 2, "category": "api", "endpoints": 42}', '["api", "reference"]'),
  ('Tutorial', '{"author": "Charlie", "version": 1, "category": "tutorial", "difficulty": "beginner"}', '["tutorial"]'),
  ('Advanced Topics', '{"author": "Diana", "version": 3, "category": "advanced", "topics": ["mvcc", "locks"]}', '["advanced", "internals"]')
ON CONFLICT DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_documents_metadata ON documents USING GIN (metadata);
CREATE INDEX IF NOT EXISTS idx_documents_tags ON documents USING GIN (tags);
