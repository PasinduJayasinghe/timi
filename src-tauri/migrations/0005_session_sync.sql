-- Migration 5: offline-first upload of sessions to the company Supabase project (Phase 6a).
-- Never edit this file after it has shipped; add a new migration instead.

-- When the session was last uploaded (UTC ISO). Null means it is waiting to upload; closing,
-- reopening or editing its task makes it wait again.
ALTER TABLE sessions ADD COLUMN synced_at TEXT;
