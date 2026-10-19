-- Migration 6: shifts (Phase 7). A work day runs from Start shift to End shift.
-- Never edit this file after it has shipped; add a new migration instead.

-- One row per work day. day_key is the local date the shift started on (YYYY-MM-DD); starting
-- again on the same date reopens that row. ended_at is null while the shift is open.
CREATE TABLE shifts (
  id TEXT PRIMARY KEY,
  day_key TEXT NOT NULL UNIQUE,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  -- 'user' (End shift) or 'auto' (left open and ended by Timi)
  ended_by TEXT CHECK (ended_by IN ('user', 'auto')),
  -- When the "ended for you" note was dismissed
  noticed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Only one shift is open at a time.
CREATE UNIQUE INDEX shifts_one_open ON shifts (ended_at IS NULL) WHERE ended_at IS NULL;

-- The work day a session belongs to: the open shift's day when it started. Sessions from before
-- shifts keep the old rule, where a day starts at 6 am local time.
ALTER TABLE sessions ADD COLUMN day_key TEXT;
UPDATE sessions SET day_key = date(started_at, 'localtime', '-6 hours');
CREATE INDEX sessions_by_day ON sessions (day_key);
