-- Migration 1: tasks, sessions, clients and projects.
-- Never edit this file after it has shipped; add a new migration instead.
-- Timestamps are UTC ISO strings. list_day is the local calendar date (YYYY-MM-DD).

CREATE TABLE clients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL COLLATE NOCASE UNIQUE,
  created_at TEXT NOT NULL
);

CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL COLLATE NOCASE,
  kind TEXT NOT NULL CHECK (kind IN ('client', 'internal')),
  client_id TEXT REFERENCES clients (id),
  created_at TEXT NOT NULL,
  UNIQUE (kind, client_id, name)
);

CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('client', 'internal', 'support', 'meeting', 'other')),
  client_id TEXT REFERENCES clients (id),
  project_id TEXT REFERENCES projects (id),
  ticket_number TEXT,
  notes TEXT NOT NULL DEFAULT '',
  estimate_minutes INTEGER,
  list_day TEXT NOT NULL,
  carried_from TEXT,
  position REAL NOT NULL,
  completed_at TEXT,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX tasks_by_day ON tasks (list_day, deleted_at);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks (id),
  started_at TEXT NOT NULL,
  ended_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX sessions_by_task ON sessions (task_id);
CREATE INDEX sessions_by_start ON sessions (started_at);

-- Only one timer runs at a time, enforced by the database.
CREATE UNIQUE INDEX sessions_one_running ON sessions (ended_at IS NULL) WHERE ended_at IS NULL;
