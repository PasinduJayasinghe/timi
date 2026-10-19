-- Migration 8: a planned time for tasks, for time-blocking on the Plan tab (Phase 9).
-- Never edit this file after it has shipped; add a new migration instead.

-- When the task is planned to start (UTC ISO) and for how long. Both null when unscheduled.
ALTER TABLE tasks ADD COLUMN planned_start TEXT;
ALTER TABLE tasks ADD COLUMN planned_minutes INTEGER;
