# Timi build phases

Each phase ends with a working app, a manual test list and one commit. Phases 0 to 2 are the MVP for daily use.

## Phase 0: Foundation

Goal: the empty app shell looks exactly like the design.

- [ ] Tailwind CSS v4 with the Vite plugin, and the design token sheet in `src/styles/tokens.css`
- [ ] Self-hosted Inter and JetBrains Mono
- [ ] Frameless, transparent 380 x 780 window with the glass background and colour blobs
- [ ] Custom title bar: drag area, date, pin (always on top), wide mode, collapse and close
- [ ] Today, Calendar and Log tabs with their empty states
- [ ] App icons generated from `app-icon.png`

Done when: the shell matches the design screenshots side by side, and drag, pin, collapse and close all work.

## Phase 1: Tasks

Goal: a real daily to-do list saved on this PC.

- [ ] SQL plugin with SQLite and migrations for `tasks` and `sessions`
- [ ] Quick add with Enter, complete with the animation, delete, and drag to reorder
- [ ] Task types: client project, internal project and support ticket, each with its colour and icon
- [ ] Unfinished tasks carry over to the next day with the "from yesterday" tag
- [ ] Task details popover: title, type, client or project, notes and estimate

Done when: tasks survive a restart and carry over correctly after midnight.

## Phase 2: Timer and log (MVP complete)

Goal: track time per task and copy it to the timesheet.

- [ ] Start task sheet with the three types and the recent-tasks list
- [ ] One running timer; starting another task pauses the current one
- [ ] Elapsed time calculated from timestamps, with recovery of an unclosed session after a crash or restart
- [ ] Session saved on stop, with the "Session saved" toast
- [ ] Log tab: sessions, totals per type, "Copy for timesheet" and the day picker
- [ ] Collapsed mini bar with the running timer

Done when: a full day of real work gives correct totals, including after sleep and restart.

## Phase 3: Timeline

Goal: the Gantt-style day timeline at the bottom of the window.

- [ ] One row per task type plus a Meetings row, on the working-hours axis with a "now" line
- [ ] The running session grows live; hover shows details; click opens the task
- [ ] Day switcher, totals per type, and collapse to a thin bar

Done when: the timeline totals match the Log tab exactly.

## Phase 4: Desktop behaviour

Goal: Timi behaves like a proper always-available desktop app.

- [ ] Tray icon and menu: show, start or pause the timer, quick add, quit
- [ ] Close hides Timi to the tray instead of quitting (until the tray exists, Close quits)
- [ ] Start on login and a global shortcut for quick add
- [ ] Remember window position and size, and allow only one running instance
- [ ] Task reminders: Rust scheduler with native notifications ("Start timer" and "Snooze 10 min")
- [ ] Settings screen

Done when: reminders fire while Timi is hidden in the tray, tested in the installed build.

## Phase 5: Google Calendar and meetings

Goal: meetings appear in Timi and never get missed.

- [ ] Google sign-in (desktop loopback with PKCE) on the SLE Workspace project, read-only calendar access
- [ ] Calendar tab: day and week views, meeting cards and "Join Google Meet"
- [ ] Meetings shown in the timeline
- [ ] Meeting alarm window with chime, Join, Snooze and Dismiss, and an offer to start a Meeting timer on join

Done when: a real test meeting triggers the alarm and opens Google Meet.

## Phase 6: Sync and release

Goal: data backed up to the company and a clean installer.

- [ ] Offline-first sync of sessions to the company Supabase project, with the sync status chip
- [ ] Accessibility pass: keyboard use, focus, contrast and reduced motion
- [ ] Reduce installer size: subset the icon font to the icons Timi uses, or switch to SVG icons (the full Material Symbols Rounded font is 5.4 MB)
- [ ] NSIS installer built with `npm run tauri build`

Done when: the installer works on a clean Windows user account.

## Phase 7: Shifts

Goal: plan the work when a shift starts, and clear the screen when it ends, with every day kept in the database.

Design: `docs/design/drafts/Timi Planner (draft).html`, screens 7d and 7i–7l (approved draft).

- [ ] A work day runs from Start shift to End shift; 6 am is only the fallback for a shift left open (ends itself after 4 idle hours)
- [ ] Sessions store their work day (`day_key`), so the Log, timeline, calendar and sync group by shift
- [ ] Plan my day when a shift starts: review leftovers (Keep, Move, Drop), then plan the shift's tasks and estimates against the hours left
- [ ] End shift: summary, Copy for timesheet, the timer stops, Today clears; Reopen the shift just ended
- [ ] Settings: "Plan my day when a shift starts" replaces "Carry over unfinished tasks"

Done when: a whole shift (start, plan, time, end, start the next) works in the installed build, and earlier days stay in the Log.
