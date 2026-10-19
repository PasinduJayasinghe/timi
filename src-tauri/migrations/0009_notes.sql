-- Migration 9: quick notes (Phase 10). Notes stay on this PC.
-- Never edit this file after it has shipped; add a new migration instead.

-- The first line of body is the note's title. pinned is 0 or 1. Deleted notes keep their row
-- (deleted_at) so Undo can bring them back.
CREATE TABLE notes (
  id TEXT PRIMARY KEY,
  body TEXT NOT NULL,
  pinned INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE INDEX notes_by_update ON notes (deleted_at, updated_at);
