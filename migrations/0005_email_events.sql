-- 0005_email_events.sql

CREATE TABLE IF NOT EXISTS email_events (
  id TEXT PRIMARY KEY,
  followup_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  owner_id TEXT NOT NULL,

  kind TEXT NOT NULL,                -- initial | followup
  sequence_step INTEGER NOT NULL DEFAULT 0,

  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_text TEXT,

  status TEXT NOT NULL DEFAULT 'sent',  -- queued | sent | failed
  provider TEXT,                        -- resend | postmark | simulated
  provider_message_id TEXT,
  error_message TEXT,

  created_at TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (followup_id) REFERENCES followups(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_email_events_followup
  ON email_events(followup_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_events_workspace
  ON email_events(workspace_id, created_at DESC);
