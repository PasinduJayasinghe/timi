import { isTaskType, type TaskType } from "../lib/taskTypes";

export type Task = {
  id: string;
  title: string;
  type: TaskType;
  clientId: string | null;
  clientName: string | null;
  projectId: string | null;
  projectName: string | null;
  /** Support tickets only, digits as text. */
  ticketNumber: string | null;
  notes: string;
  estimateMinutes: number | null;
  /** Local calendar date the task is listed on, "YYYY-MM-DD". */
  listDay: string;
  /** Previous list day when the task was carried over. */
  carriedFrom: string | null;
  position: number;
  /** UTC ISO timestamps. */
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Client = {
  id: string;
  name: string;
};

export type ProjectKind = "client" | "internal";

export type Project = {
  id: string;
  name: string;
  kind: ProjectKind;
  clientId: string | null;
};

/** Task row as returned by the list query (snake_case, joined names). */
export type TaskRow = {
  id: string;
  title: string;
  type: string;
  client_id: string | null;
  client_name: string | null;
  project_id: string | null;
  project_name: string | null;
  ticket_number: string | null;
  notes: string;
  estimate_minutes: number | null;
  list_day: string;
  carried_from: string | null;
  position: number;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

/** A timed session, with the display fields of its task. */
export type Session = {
  id: string;
  taskId: string;
  /** UTC ISO timestamps. A running session has no `endedAt`. */
  startedAt: string;
  endedAt: string | null;
  /** Last time Timi was seen running while this session was open. */
  lastSeenAt: string | null;
  taskTitle: string;
  taskType: TaskType;
  ticketNumber: string | null;
  clientName: string | null;
  projectName: string | null;
};

/** Session row as returned by the session queries (snake_case, joined task fields). */
export type SessionRow = {
  id: string;
  task_id: string;
  started_at: string;
  ended_at: string | null;
  last_seen_at: string | null;
  task_title: string;
  task_type: string;
  ticket_number: string | null;
  client_name: string | null;
  project_name: string | null;
};

export type ClientRow = { id: string; name: string };

export type ProjectRow = { id: string; name: string; kind: string; client_id: string | null };

export function toTask(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    type: isTaskType(row.type) ? row.type : "other",
    clientId: row.client_id,
    clientName: row.client_name,
    projectId: row.project_id,
    projectName: row.project_name,
    ticketNumber: row.ticket_number,
    notes: row.notes,
    estimateMinutes: row.estimate_minutes,
    listDay: row.list_day,
    carriedFrom: row.carried_from,
    position: row.position,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toSession(row: SessionRow): Session {
  return {
    id: row.id,
    taskId: row.task_id,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    lastSeenAt: row.last_seen_at,
    taskTitle: row.task_title,
    taskType: isTaskType(row.task_type) ? row.task_type : "other",
    ticketNumber: row.ticket_number,
    clientName: row.client_name,
    projectName: row.project_name,
  };
}

export function toClient(row: ClientRow): Client {
  return { id: row.id, name: row.name };
}

export function toProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind === "internal" ? "internal" : "client",
    clientId: row.client_id,
  };
}
