-- Workspaces (one per company)
CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Users (minimal v1)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'REP',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(workspace_id, email),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

-- Companies
CREATE TABLE IF NOT EXISTS companies (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  name TEXT NOT NULL,
  industry TEXT,
  size TEXT,
  website TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

-- Contacts
CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  company_id TEXT NOT NULL,
  full_name TEXT NOT NULL,
  title TEXT,
  email TEXT,
  phone TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

-- Follow-ups
CREATE TABLE IF NOT EXISTS followups (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  contact_id TEXT NOT NULL,
  company_id TEXT NOT NULL,
  owner_id TEXT NOT NULL,

  title TEXT NOT NULL,
  summary TEXT,

  status TEXT NOT NULL,
  due_at TEXT NOT NULL,

  last_touch_at TEXT,
  last_touch_channel TEXT,

  next_step TEXT NOT NULL,
  segment TEXT,

  deal_label TEXT,
  deal_value_eur INTEGER,
  is_key_account INTEGER NOT NULL DEFAULT 0,

  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_followups_workspace_due ON followups(workspace_id, due_at);
CREATE INDEX IF NOT EXISTS idx_followups_workspace_status ON followups(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_followups_owner ON followups(workspace_id, owner_id);

-- Events (timeline)
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  followup_id TEXT NOT NULL,

  occurred_at TEXT NOT NULL,
  type TEXT NOT NULL,
  channel TEXT,
  title TEXT NOT NULL,
  detail TEXT,
  meta_json TEXT,

  created_at TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (followup_id) REFERENCES followups(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_events_followup ON events(workspace_id, followup_id, occurred_at);
