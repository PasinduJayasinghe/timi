-- Migration 3: task reminders and app settings.
-- Never edit this file after it has shipped; add a new migration instead.

-- When to remind about a task, as a UTC ISO string. Reminders fire from the Rust scheduler.
ALTER TABLE tasks ADD COLUMN remind_at TEXT;

-- Small app preferences, e.g. carry_over = 'true'. Values are JSON text.
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
