-- Migration 4: meeting timers linked to Google Calendar events (Phase 5b).
-- Never edit this file after it has shipped; add a new migration instead.

-- The calendar event a meeting task was started from (4b); shown in the calendar style.
ALTER TABLE tasks ADD COLUMN calendar_event_id TEXT;
