# Client Progress Dashboard

A read-only, single-page Next.js dashboard that visualizes a client's project
as one nested tree — an intake checklist, project phases, and any sub-tasks
under either, at whatever depth the sheet defines. Each deployment points at
exactly one client's Google Sheet (via `SPREADSHEET_ID`), matching the
`Client_Onboarding_Checklist_Template.xlsx` workbook's single "Project Tree" tab.

Data flows one way: Google Sheet → this app. Nothing here writes back to the sheet.
There is no login yet — this first version is meant to sit behind an unlisted URL
until Pocket ID (or another OIDC provider) is layered on in a later pass.

## The tree data model

Everything on the "Project Tree" tab is one row of `ID, ParentID, Title, Status, Notes`.
A row with children (i.e. other rows list it as their ParentID) is a **list**;
a row with no children is a **task**, and it's the only kind of row that
carries a real Status. A list's displayed status is always a computed
rollup over its leaf (task) descendants — you never set a list's status by hand.

- `ID` — a short, unique-per-sheet slug you choose, e.g. `access`,
  `access-domain`, `phase1-define`. Referenced by child rows as their `ParentID`.
- `ParentID` — the `ID` of the row this one nests under. Blank means it's a
  top-level branch (a "root"), like `Intake Checklist` or `Project Phases`.
- `Title` — what's shown on the dashboard.
- `Status` — one of `Not Started`, `In Progress`, `Completed`, `Blocked`,
  `N/A`. Leave blank on any row that has children (it's ignored either way —
  the dashboard always computes a list's status from its descendants).
  `N/A` tasks are excluded from rollup percentages entirely.
- `Notes` — optional, not currently shown on the dashboard but read and kept
  available for a future pass.

Because nesting is by ID reference rather than row position, you can insert,
reorder, or move rows anywhere on the tab without breaking the structure —
only the `ID`/`ParentID` relationship matters, and row order just controls
display order among siblings.

The root named exactly `Intake Checklist` and the root named exactly
`Project Phases` are special-cased into one combined section: the Intake
Checklist root itself becomes the first step, followed by each of
`Project Phases`'s direct children as the remaining steps. Rather than the
generic accordion, that combined step list renders as both a horizontal
connected-dot stepper and a full row list of the same steps underneath it,
kept in sync (see below). Any other root — and everything nested more than
one level inside a step — uses the generic tree view.

## How it works

- `lib/sheets.ts` runs only on the server. It authenticates to the Google
  Sheets API with a service account and reads the single "Project Tree" tab
  into flat rows. It looks for a header row containing `ID`/`ParentID`/`Title`/`Status`
  rather than hardcoded cell coordinates, so it keeps working even if rows are
  added or reordered. `getDashboardData()` also keeps a 60-second in-memory
  cache so repeated page loads don't each hit the Sheets API — deliberately
  a manual cache here rather than Next.js's route-level `revalidate`, since
  that would statically pre-render the page at `next build` time (see
  `app/page.tsx` below).
- `lib/tree.ts` turns those flat rows into the actual node tree (`buildTree`)
  and computes each list node's rollup status (`computeRollup`). A row whose
  `ParentID` doesn't match any real row's `ID` — a typo, or two rows that
  point at each other — gets filed under a synthetic
  "⚠ Unlinked rows (check ParentID)" root instead of silently vanishing from
  the dashboard; check the server logs for which row and why.
- `app/page.tsx` is a Server Component, marked `export const dynamic =
  "force-dynamic"` so it always renders per-request rather than being
  statically pre-rendered at `next build` time — a build-time pre-render
  would run inside the Docker builder stage, where the Sheets credentials
  don't exist, and would permanently bake a "missing env var" error into the
  image. It calls `getDashboardData()`, builds the combined step list —
  `Intake Checklist` first, then each of `Project Phases`'s children — and
  renders it with `Stepper`; any other root gets its own titled section
  rendered with `TreeAccordion`.
- `components/Stepper.tsx` renders that step list twice, in sync: a
  horizontal connected-dot stepper on top, and a full row list of the same
  steps underneath — every step is always visible as a row, not just the
  open ones. Clicking a dot and clicking its row both toggle the exact same
  shared open/closed state, so either one expands that step's children in
  place (a step can itself contain nested lists, to whatever depth the sheet
  defines). The first step that isn't yet fully complete is expanded by
  default on load; if every step is complete, the last one is.
- `components/TreeAccordion.tsx` is the generic recursive tree: leaves show
  their entered status, list nodes show a computed rollup (`x/y` complete,
  percent) and expand to reveal their children. Its default export owns its
  own expand/collapse state and is used for any other (non-stepper) top-level
  section; it also exports `TreeLevel`, the underlying recursive renderer,
  which `Stepper` reuses directly so the dots and the row list can share one
  state instead of each getting its own out-of-sync copy.
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

## Migrating an existing client sheet from the old 3-tab format

If a client's sheet still has the old "Checklist Template" / "Phases" /
"Phase Tasks" tabs from before this rework, it needs a one-time manual
restructure into the single "Project Tree" tab:

1. Add a new "Project Tree" tab with header row `ID | ParentID | Title | Status | Notes`.
2. Keep the client info block (Client Name:, Project Name:, etc.) at the top,
   same as before.
3. Add one root row per old top section: `checklist` → "Intake Checklist",
   `phases` → "Project Phases" (both `ParentID` blank).
4. For each old checklist Category, add a row with `ParentID=checklist`; for
   each Item under it, add a row with `ParentID` set to that category's `ID`
   and carry its old Status across, translating the old vocabulary as you go
   (old `Received`/`N/A` → new `Completed`/`N/A`; old `Requested` → `In Progress`).
5. For each old Phase, add a row with `ParentID=phases`, carrying its old
   Status across (`Complete` → `Completed`). For each old Phase Task under
   it, add a row with `ParentID` set to that phase's `ID`.
6. Delete the three old tabs once the new tab looks right.

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
output) that Coolify's Dockerfile build pack can use directly. `build-main.yml`
builds and pushes it as a multi-arch image (`linux/amd64` + `linux/arm64`, via
QEMU) on every push to `main`, so the same tags pull cleanly on both an amd64
Coolify server and an Apple Silicon Mac for local testing. `promote.yml` just
retags an existing `:sha-<short>` image (`docker buildx imagetools create`),
so a promoted release tag carries over whichever platforms that source image
was built with.

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
- If a row's `Title` is edited in the sheet, the dashboard just reflects
  whatever text is there — it doesn't validate against the original template.
- `ID` values must stay unique across the entire tab (both branches share one
  namespace) — a duplicate is silently ignored (first occurrence wins) other
  than a warning in the server logs.
- A row whose `ParentID` doesn't resolve to a real `ID` gets filed under a
  visible "⚠ Unlinked rows" section rather than causing an error, so a typo
  is noticeable on the dashboard itself, not just in server logs.
