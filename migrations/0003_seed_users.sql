-- 0003_seed_users.sql
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Zorg dat default workspace/user bestaan
INSERT OR IGNORE INTO workspaces (id, name) VALUES ('ws_1', 'Default workspace');
INSERT OR IGNORE INTO users (id, name) VALUES ('u_1', 'Default user');
