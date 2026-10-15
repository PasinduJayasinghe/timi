import type { Task } from "../data/types";
import { TYPE_FIELDS, TYPE_STYLES, type TaskType } from "./taskTypes";

type DisplayFields = Pick<Task, "type" | "title" | "ticketNumber" | "clientName" | "projectName">;

/** Row title: support tickets show "#4821 Subject". */
export function displayTitle(task: DisplayFields): string {
  if (task.type === "support" && task.ticketNumber) return `#${task.ticketNumber} ${task.title}`;
  return task.title;
}

/**
 * Row meta line: "Client · Project" for client work, the project for internal work,
 * the client for tickets and meetings. Falls back to the type label (as quick add does in 1a).
 */
export function displayMeta(task: DisplayFields): string {
  const parts: string[] = [];
  const fields = TYPE_FIELDS[task.type];
  if (fields.client !== "none" && task.clientName) parts.push(task.clientName);
  if (fields.project !== "none" && task.projectName) parts.push(task.projectName);
  return parts.length > 0 ? parts.join(" · ") : TYPE_STYLES[task.type].label;
}

export type CatalogPatch = {
  type: TaskType;
  clientId: string | null;
  projectId: string | null;
  ticketNumber: string | null;
};

/** Changing type clears the fields the new type doesn't use. */
export function patchForTypeChange(task: Pick<Task, "clientId" | "projectId" | "ticketNumber">, next: TaskType): CatalogPatch {
  const fields = TYPE_FIELDS[next];
  return {
    type: next,
    clientId: fields.client === "none" ? null : task.clientId,
    // Projects belong to one kind (client or internal), so a project never survives a type change
    projectId: null,
    ticketNumber: fields.ticket ? task.ticketNumber : null,
  };
}

/** Ticket numbers are digits only (2c). */
export function isValidTicketNumber(value: string): boolean {
  return /^\d+$/.test(value);
}
