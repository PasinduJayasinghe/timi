# Timi

Timi is a sticky-note style desktop app for daily tasks, task timers, a day timeline, meetings and reminders. Stack: Tauri 2, React, TypeScript, Vite, Tailwind CSS v4 and SQLite.

## The design is the source of truth

- The final design is in `docs/design/` (exported design files, screenshots and the token sheet).
- Match layout, colours, spacing, radius, shadows, typography and copy exactly. Do not redesign, "improve" or add visual elements.
- If a screen or state is missing from the design, ask before inventing it.
- The design may say "Daybar". The app name is "Timi".

## How we work

- Build one phase at a time from `docs/PHASES.md`. Never start the next phase without my approval.
- Before coding a phase, write a short plan (files to add or change, risks) and wait for my approval.
- At the end of each phase, run `npm run build` and `npm run tauri dev`, give me a manual test list, and stop.
- One commit per phase, with the message `phase-N: short summary`.

## Code rules

- TypeScript strict mode. No `any`.
- Design tokens live in `src/styles/tokens.css` and are mapped to Tailwind with `@theme`. Components use tokens, never raw hex values.
- Fonts are self-hosted with Fontsource (Inter and JetBrains Mono). No fonts loaded from the network.
- `useEffect` callbacks always use block bodies, because a returned value is treated as a cleanup function.
- Elapsed time is always calculated from stored timestamps (`started_at`, `ended_at`). Never count time by incrementing with `setInterval`.
- Store times as UTC ISO strings and display them in local time. Treat "today" as the open shift's work day (`useShift`): a day runs from Start shift to End shift, and sessions store their `day_key`. Between shifts and for older data, a work day starts at 6 am, so a night shift counts as one day (`DAY_START_HOUR` in `src/lib/date.ts`).
- Only one timer runs at a time.
- Reminders and meeting alarms are scheduled in Rust, not with web view timers, so they fire while the window is hidden.
- Every list has loading, empty and error states. Every control has hover and visible focus states, with a minimum target of 32 x 32 px. Respect the system "reduce motion" setting.
- Keep Tauri capabilities minimal. Allow only the permissions the current phase needs.

## Data and security

- Data stays local in SQLite until the sync phase.
- Use placeholder names only (Client A, Client B, SLE Hub). Never put real client names in code, seed data, tests or screenshots.
- Never commit secrets, tokens or `.env` files.
- Google sign-in uses the SLE company Workspace project, never a personal account.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run tauri dev` | Run the app in development |
| `npm run build` | Type-check and build the front end |
| `npm run tauri build` | Build the Windows installer (NSIS) |
| `npm run tauri icon ./app-icon.png` | Regenerate all app icons |
