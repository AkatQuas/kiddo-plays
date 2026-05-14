CREATE TABLE IF NOT EXISTS stores (
  id TEXT PRIMARY KEY,
  name TEXT,
  owner TEXT,
  address TEXT,
  phone TEXT,
  coop_status TEXT NOT NULL DEFAULT 'none'
    CHECK (coop_status IN ('none', 'cooperating', 'finished')),
  coop_expire_at TEXT,
  createdAt TEXT
);

CREATE TABLE IF NOT EXISTS issues (
  id TEXT PRIMARY KEY,
  title TEXT,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'fixed', 'ignore')),
  createdAt TEXT
);

CREATE TABLE IF NOT EXISTS versions (
  id TEXT PRIMARY KEY,
  version TEXT,
  description TEXT,
  createdAt TEXT
);
