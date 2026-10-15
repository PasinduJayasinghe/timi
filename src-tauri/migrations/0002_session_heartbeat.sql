-- Migration 2: last time Timi was seen running while a session was open.
-- Never edit this file after it has shipped; add a new migration instead.
-- A gap of more than a few minutes (crash, shutdown or sleep) closes the session at this time.

ALTER TABLE sessions ADD COLUMN last_seen_at TEXT;
