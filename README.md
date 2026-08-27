# Recovery Docket

Farmart's accounts-receivable legal recovery tracker: a docket table, an
overall recovery funnel, and per-case-type step funnels (CORD/Arbitration,
Section 138, Civil Suit, NCLT, Criminal). Anyone with the link can view it;
saving changes requires the shared edit password.

This replaces the earlier Claude Artifacts version of the tracker, which
could only be edited by its owner. Here, viewing is open to anyone with the
link and editing is gated by a shared password instead of Claude's
per-account sharing.

## Stack

- **Next.js** (App Router, plain JavaScript) — one route serves the page,
  a handful of API routes serve/save case data.
- **Postgres** — one `cases` table (each case as a JSONB row) and one
  `meta` row for sync/threshold info. Works with Vercel's Postgres
  (Neon-backed) integration or any Postgres reachable via a connection
  string.
- **Auth** — a single shared password (`EDIT_PASSWORD`). Entering it sets a
  signed, httpOnly cookie valid for 30 days. Viewing the docket needs no
  login; saving a case does. Only the fields the UI lets you edit (status,
  legal stage, case type/step, assignee, notes, flags) are ever writable —
  everything else (balances, invoices, contact info) is read-only at the
  API level regardless of what a client sends.

## Deploying on Vercel

1. **Push this repo to GitHub** (already done if you're reading this from
   the repo) and import it into Vercel: [vercel.com/new](https://vercel.com/new)
   → select the `LegalTracker` repo → Deploy. Vercel auto-detects Next.js;
   no build settings need changing.

2. **Add a Postgres database.** In the Vercel project → **Storage** tab →
   **Create Database** → choose **Postgres** (Neon-backed). This
   automatically sets a `POSTGRES_URL` environment variable on the project
   — no manual copy-pasting needed.

3. **Set the remaining environment variables.** Project → **Settings** →
   **Environment Variables**, add:
   - `EDIT_PASSWORD` — the password Pradeep/Mehtab/Ahatshame/Anusha will
     use to sign in and save changes.
   - `SESSION_SECRET` — any long random string, e.g. generate one with
     `openssl rand -hex 32` locally and paste it in.

   Apply both to all environments (Production/Preview/Development), then
   redeploy so the new variables take effect.

4. **Seed the database** with the current case data (one-time — the table
   starts empty otherwise):
   ```
   npm install -g vercel        # if you don't have the CLI
   vercel link                  # connect this folder to the Vercel project
   vercel env pull .env.local   # pulls POSTGRES_URL etc. into .env.local
   npm install
   npm run seed
   ```
   This reads `data/seed-cases.json` (a snapshot of the cases at the time
   this app was built) and loads it into the `cases`/`meta` tables. Re-run
   it any time to reset the data back to that snapshot — it deletes and
   re-inserts every row, so don't run it after real edits have accumulated
   unless you mean to discard them.

5. **Open the deployed URL** and confirm cases load. Click **Sign in to
   edit** in the top bar, enter `EDIT_PASSWORD`, and confirm you can save a
   change to a case (edit a field in the detail panel → **Save Changes**).

## Local development

```
npm install
# Point at a local or remote Postgres:
export DATABASE_URL=postgres://postgres:yourpassword@localhost:5432/legaltracker
export EDIT_PASSWORD=devpassword
export SESSION_SECRET=any-string-for-local-dev
npm run seed     # first time only, populates the tables
npm run dev       # or: npm run build && npm start
```

## Project layout

```
app/route.js                 GET / — serves the tracker page
app/api/cases/route.js       GET  — all cases + meta (public)
app/api/cases/[id]/route.js  PUT  — update one case's editable fields (auth required)
app/api/login/route.js       POST — check password, set session cookie
app/api/logout/route.js      POST — clear session cookie
app/api/session/route.js     GET  — whether the current cookie is valid
lib/db.js                    Postgres queries
lib/auth.js                  password check + cookie signing/verification
lib/page-html.js             the page's HTML/CSS/JS, as a JS string constant
data/seed-cases.json         one-time seed snapshot of case data
scripts/seed.mjs             loads data/seed-cases.json into Postgres
```

`lib/page-html.js` is generated from a single self-contained HTML/CSS/JS
file — the same one that ran as a Claude Artifact — with the
artifact-specific self-publishing logic stripped out and replaced with
plain `fetch()` calls to the API routes above. To change the page's markup,
styling, or client-side behavior, edit that source and regenerate
`lib/page-html.js` (a small script JSON-encodes the HTML into a JS string
literal, which is how the file is produced — ask Claude to do this if
you're not sure how).
