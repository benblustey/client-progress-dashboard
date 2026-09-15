# Client Progress Dashboard

A read-only, single-page Next.js dashboard that visualizes a client's onboarding
checklist progress and project phases (with their sub-tasks). Each deployment
points at exactly one client's Google Sheet (via `SPREADSHEET_ID`), matching the
`Client_Onboarding_Checklist_Template.xlsx` workbook's "Checklist Template",
"Phases", and "Phase Tasks" tabs.

Data flows one way: Google Sheet → this app. Nothing here writes back to the sheet.
There is no login yet — this first version is meant to sit behind an unlisted URL
until Pocket ID (or another OIDC provider) is layered on in a later pass.

## How it works

- `lib/sheets.ts` runs only on the server. It authenticates to the Google Sheets API
  with a service account, reads the three tabs, and parses them into the shapes in
  `lib/types.ts`. It looks for header rows ("Category"/"Item"/"Status",
  "Phase"/"Status", and "Phase"/"Sub-task"/"Status") rather than hardcoded cell
  coordinates, so it keeps working even if rows are added or reordered in the sheet
  — but the column headers themselves must match the template. The "Phase Tasks"
  tab is optional: if it's missing (e.g. an older client sheet from before this
  feature existed), phases just render with no sub-tasks instead of erroring.
- `app/page.tsx` is a Server Component that calls `getDashboardData()` at request
  time, cached for 60 seconds (`export const revalidate = 60`) so the Sheets API
  isn't hit on every page view. It also figures out the "current" phase (the first
  one not marked Complete) and tells `MilestoneFlow` to auto-expand it.
- `components/MilestoneFlow.tsx` renders the Intake Checklist (as a percentage)
  and the five project phases as a connected stepper. Clicking a phase node
  toggles a panel showing that phase's sub-tasks (from the "Phase Tasks" tab),
  each with its own Not Started / In Progress / Completed status. The phase right
  after the last completed one is expanded by default on load.
- `components/CategoryBreakdown.tsx` renders the intake checklist's category
  rollups as a card grid; clicking a category expands it to show the individual
  checklist items in that category and their status.
- `components/ThemeToggle.tsx` + the inline script in `app/layout.tsx` handle
  light/dark mode, stored in the browser's `localStorage` — no server-side
  preference, no cookie banner needed.

## One-time setup per client

1. **Google Cloud**: create (or reuse) a Google Cloud project, enable the
   **Google Sheets API**, and create a service account. Generate a JSON key for it.
2. **Share the sheet**: in Google Drive, open the client's copy of
   `Client_Onboarding_Checklist_Template.xlsx` (see that workbook's README tab for
   how to make the copy) and share it with the service account's email address
   (found in the JSON key as `client_email`) — Viewer access is enough.
3. **Get the Sheet ID**: copy it out of the sheet's URL —
   `https://docs.google.com/spreadsheets/d/`**`THIS_PART`**`/edit`.
4. **Configure this app**: copy `.env.example` to `.env.local` and fill in
   `SPREADSHEET_ID` plus the service account credentials (base64 the whole JSON key
   is the easiest path — see the comment in `.env.example`).

## Local development

```bash
pnpm install
cp .env.example .env.local   # then fill in the values
pnpm run dev
```

Visit `http://localhost:3000`. `pnpm run lint` runs ESLint (Next.js 16 removed the
built-in `next lint` command); `pnpm run build` does a production build.

## Deploying on Coolify

This repo includes a `Dockerfile` (multi-stage, using Next.js's `standalone`
output) that Coolify's Dockerfile build pack can use directly:

1. In Coolify, create a new Application from this repository (or a git remote you
   push it to).
2. Set the build pack to **Dockerfile**.
3. Add the environment variables from `.env.example` in Coolify's Environment
   Variables tab (don't commit `.env.local`).
4. Deploy. The container listens on port 3000.
5. Because this is one instance per client, repeat the whole flow (new Coolify
   app, new `.env`, new service-account share) for each new client rather than
   reusing the deployment.

## Adding auth later (Pocket ID)

Nothing here assumes no-auth forever — when you're ready:

- Add `middleware.ts` at the project root to gate all routes behind a session
  check, or wire up [`next-auth`](https://authjs.dev) with a generic OIDC
  provider pointed at Pocket ID's issuer URL.
- Because the Sheets calls already live entirely in server-side code
  (`lib/sheets.ts`), adding auth doesn't change how data is fetched — it only
  changes who's allowed to load the page.

## Known limitations (first pass)

- Read-only: editing status still happens in the Google Sheet itself.
- One sheet per deployment; there's no multi-client picker in the UI.
- No auth yet — treat the deployed URL as unlisted, not public, until Pocket ID
  is added.
- If a category or phase name is edited in the sheet, this app just reflects
  whatever text is there — it doesn't validate against the original template.
- Sub-tasks on the "Phase Tasks" tab are matched to a phase by exact name text —
  a typo or a renamed phase on the "Phases" tab will silently orphan that phase's
  sub-tasks instead of erroring.
