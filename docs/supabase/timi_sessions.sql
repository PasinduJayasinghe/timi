-- Timi session sync (Phase 6a): run once in the company Supabase project's SQL editor.
--
-- Timi uploads closed time-tracking sessions here; nothing syncs back down. Each person signs in
-- with their SLE Google account (Supabase Auth, Google provider, using Timi's Desktop OAuth
-- client ID as an authorised client ID). Row-level security keeps each person to their own rows.

create table if not exists public.timi_sessions (
  -- Timi's own session id, so re-uploading the same session updates it (upsert on id)
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id),
  user_email text not null default (auth.jwt() ->> 'email'),
  task_id uuid not null,
  task_title text not null,
  task_type text not null check (task_type in ('client', 'internal', 'support', 'meeting', 'other')),
  client_name text,
  project_name text,
  ticket_number text,
  -- Set for meeting timers started from a Google Calendar event
  calendar_event_id text,
  -- The work day the session belongs to (Timi's day starts at 6 am)
  work_day date not null,
  started_at timestamptz not null,
  ended_at timestamptz not null check (ended_at >= started_at),
  duration_seconds integer generated always as (extract(epoch from (ended_at - started_at))::integer) stored,
  uploaded_at timestamptz not null default now()
);

create index if not exists timi_sessions_user_day on public.timi_sessions (user_id, work_day);

alter table public.timi_sessions enable row level security;

-- Each person reads and writes only their own rows. There is no delete policy: Timi never deletes.
create policy "timi_sessions: read own" on public.timi_sessions
  for select to authenticated
  using (user_id = auth.uid());

create policy "timi_sessions: insert own" on public.timi_sessions
  for insert to authenticated
  with check (
    user_id = auth.uid()
    -- Optional: only company accounts. Replace example.com with the company domain, or remove.
    and (auth.jwt() ->> 'email') like '%@example.com'
  );

create policy "timi_sessions: update own" on public.timi_sessions
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Keep uploaded_at current when Timi re-uploads a session (e.g. after a task is renamed)
create or replace function public.timi_sessions_touch() returns trigger
language plpgsql as $$
begin
  new.uploaded_at := now();
  return new;
end;
$$;

drop trigger if exists timi_sessions_touch on public.timi_sessions;
create trigger timi_sessions_touch before update on public.timi_sessions
  for each row execute function public.timi_sessions_touch();
