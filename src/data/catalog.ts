import { getDb, nowIso } from "./db";
import { toClient, toProject, type Client, type ClientRow, type Project, type ProjectKind, type ProjectRow } from "./types";

export async function listClients(): Promise<Client[]> {
  const db = await getDb();
  const rows = await db.select<ClientRow[]>("SELECT id, name FROM clients ORDER BY name");
  return rows.map(toClient);
}

/** Returns the existing client with this name (case-insensitive), or creates it. */
export async function createClient(name: string): Promise<Client> {
  const db = await getDb();
  const trimmed = name.trim();
  const existing = await db.select<ClientRow[]>("SELECT id, name FROM clients WHERE name = $1", [trimmed]);
  if (existing[0]) return toClient(existing[0]);

  const client: Client = { id: crypto.randomUUID(), name: trimmed };
  await db.execute("INSERT INTO clients (id, name, created_at) VALUES ($1, $2, $3)", [client.id, client.name, nowIso()]);
  return client;
}

/** Client projects belong to one client; internal projects have none. */
export async function listProjects(kind: ProjectKind, clientId: string | null): Promise<Project[]> {
  const db = await getDb();
  const rows = await db.select<ProjectRow[]>(
    "SELECT id, name, kind, client_id FROM projects WHERE kind = $1 AND client_id IS $2 ORDER BY name",
    [kind, kind === "internal" ? null : clientId],
  );
  return rows.map(toProject);
}

/** Returns the existing project with this name for the same kind and client, or creates it. */
export async function createProject(name: string, kind: ProjectKind, clientId: string | null): Promise<Project> {
  const db = await getDb();
  const trimmed = name.trim();
  const owner = kind === "internal" ? null : clientId;
  const existing = await db.select<ProjectRow[]>(
    "SELECT id, name, kind, client_id FROM projects WHERE kind = $1 AND client_id IS $2 AND name = $3",
    [kind, owner, trimmed],
  );
  if (existing[0]) return toProject(existing[0]);

  const project: Project = { id: crypto.randomUUID(), name: trimmed, kind, clientId: owner };
  await db.execute(
    "INSERT INTO projects (id, name, kind, client_id, created_at) VALUES ($1, $2, $3, $4, $5)",
    [project.id, project.name, project.kind, project.clientId, nowIso()],
  );
  return project;
}
