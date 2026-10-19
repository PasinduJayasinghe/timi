-- Migration 7: goals and a note per day, for the Plan tab (Phase 8a).
-- Never edit this file after it has shipped; add a new migration instead.

-- Up to three goals a day (the app enforces the limit). day_key is the work day, YYYY-MM-DD.
CREATE TABLE day_goals (
  id TEXT PRIMARY KEY,
  day_key TEXT NOT NULL,
  text TEXT NOT NULL,
  done_at TEXT,
  position REAL NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX day_goals_by_day ON day_goals (day_key);

-- One note per day. An empty note is deleted rather than stored.
CREATE TABLE day_notes (
  day_key TEXT PRIMARY KEY,
  note TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
