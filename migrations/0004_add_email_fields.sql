ALTER TABLE followups ADD COLUMN contact_email TEXT;
ALTER TABLE followups ADD COLUMN email_enabled INTEGER NOT NULL DEFAULT 0;

ALTER TABLE followups ADD COLUMN email_status TEXT NOT NULL DEFAULT 'off';
ALTER TABLE followups ADD COLUMN email_sequence_step INTEGER NOT NULL DEFAULT 0;

ALTER TABLE followups ADD COLUMN last_email_sent_at TEXT;
ALTER TABLE followups ADD COLUMN next_email_at TEXT;

ALTER TABLE followups ADD COLUMN last_email_subject TEXT;
ALTER TABLE followups ADD COLUMN last_email_preview TEXT;

ALTER TABLE followups ADD COLUMN reply_detected_at TEXT;
ALTER TABLE followups ADD COLUMN email_failure_reason TEXT;
