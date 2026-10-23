# Architecture and design decisions

## Stack

| Concern    | Choice                                                            | Why                                                                                                 |
| ---------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| App        | Next.js 16 (App Router) + React 19 + TypeScript                   | One process serves pages and the API; one command to run.                                           |
| Database   | SQLite via `better-sqlite3`, hand-written SQL migrations          | A single file you can copy and back up; no server; synchronous and fast.                            |
| Validation | Zod schemas in `src/lib/schemas.ts`, shared by browser and server | One definition of "valid" for forms and API.                                                        |
| PDF        | `@react-pdf/renderer`                                             | Pure JavaScript (no browser to install), real text and links, and the preview is the exported file. |
| Word       | `docx`                                                            | Real Word structures (styles, numbering, hyperlinks, tab stops).                                    |
| Styling    | Tailwind CSS 4, small in-house component set                      | No extra UI framework.                                                                              |
| Tests      | Vitest, pdf.js and JSZip for inspecting exports                   | Exports are checked by reading them back.                                                           |

Deviation from the original proposal: the database layer uses plain SQL through `better-sqlite3` instead of Drizzle.
There is no ORM code-generation step, fewer moving parts, and the migrations are readable SQL.

## Data model

Library (reusable facts) and resumes (selections and edits) are separate tables.

```
profile (1 row) ── profile_links
summaries                          named summary variants
experiences ──┐
projects ─────┴─ bullets           owner_type + owner_id, each bullet has a `verified` flag
education, certifications, skills

resumes ── resume_items            one row per included library item: a COPY of its data
        └─ resume_versions         immutable JSON snapshots
app_settings                       defaults for new resumes
schema_migrations                  applied migrations
```

Every library row has a `version` that increases whenever its content changes (unchanged saves do not bump it).

### Resume items: copy plus provenance

A `resume_items` row stores `data` (the copy this resume prints and edits), `source_type` and `source_id` (where it came
from, deliberately _not_ a foreign key) and `source_version` (the library version at copy time).

| Situation                        | Result                                                                                                   |
| -------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Library item edited              | `version` rises, so the item shows _Library changed_. The resume's copy is untouched.                    |
| User reviews the difference      | **Use the library version** replaces the copy; **Keep mine** records the new version and keeps the copy. |
| Library item deleted or archived | The resume keeps its copy and shows _Deleted from library_ (archived items are unaffected).              |
| Resume edited                    | Only that resume's copy changes. Library and other resumes are unaffected.                               |
| Resume duplicated                | Items are copied; the two resumes are independent from then on.                                          |

### Versions

`resume_versions.snapshot` holds the resume settings and every item (without database ids) as JSON. Versions are
immutable. They are created manually, automatically on download (skipped when nothing changed since the last version)
and automatically before restoring an older version. Exports can target a version (`?version=<id>`).

## Resume rendering pipeline

```
resume_items + resumes.settings  ->  Snapshot  ->  buildResumeDoc()  ->  ResumeDoc  ->  PDF renderer
                                                                                    ->  DOCX renderer
```

`ResumeDoc` is plain, layout-ready content (header, sections, entries, bullets). Both renderers read it, so PDF and Word
always contain the same text. Templates are data (`src/lib/templates.ts`): font, sizes, margins, header alignment and
heading style. Section headings, an entry's header and its first bullet are kept together across page breaks.

## Job-description matching

`src/lib/matcher.ts`: text is lower-cased and aliases are rewritten to canonical terms (`node.js`, `NodeJS` -> `nodejs`).
Candidate terms are a built-in vocabulary plus every term in the user's skills and project technologies. A term found in the
job description is _matched_ only if the library mentions it somewhere (a skill, a project's technologies, tags, keywords or
text, or an experience bullet); otherwise it is a _gap_. Gaps are only reported, never proposed for inclusion. Projects
are ranked by weighted matches (a listed technology counts 3x a mention in prose, scaled by how often the posting repeats
the term).

## Backup and restore

`GET /api/backup` dumps every table as JSON (JSON columns are real JSON). `POST /api/backup/restore` validates the file,
writes a safety copy of the database file (`VACUUM INTO`), then deletes and re-inserts everything inside one transaction. Any
error rolls back and leaves the data untouched. Row ids are preserved so resume items keep pointing at their sources.

## Security

- Listens on `127.0.0.1` only (`npm start` / `npm run dev`).
- `src/proxy.ts` refuses requests whose `Host` is not localhost (DNS-rebinding protection; extend with `ALLOWED_HOSTS`) and
  refuses state-changing requests that are cross-site (`Origin` or `Sec-Fetch-Site`).
- All SQL uses bound parameters; table and column names come from fixed lists in code.
- No secrets are required. The only environment variables are `DATA_DIR` and `ALLOWED_HOSTS`.
- No real personal data is shipped. Tests and the seeder use clearly fictional data.

## Adding a database change

Append a new `{ id, sql }` entry to `src/server/migrations.ts`. It runs once, in a transaction, at startup; before it runs a
safety copy of an existing database is written to `data/backups/`. Never edit a migration that has shipped.

## Code organisation

- **Server** (`src/server`): `library.ts` (profile and library CRUD), `resumes/` (split by concern: `core` reading and sync state,
  `items` copying and editing items, `match` job-description matching, `records` resume CRUD, `versions` snapshots and export
  documents), `backup.ts`, `kbImport.ts`, `stats.ts` (dashboard and settings queries), `settings.ts`, `export/` (PDF, Word, HTTP
  response), `http.ts` (error handling for route handlers), `pages.ts` (not-found handling for pages).
- **Shared** (`src/lib`): `schemas.ts` (validation, used by forms and API), `types.ts` (domain and API response types),
  `api.ts` (the one typed client for the app's own API, so components never build URLs by hand), `matcher.ts`, `templates.ts`,
  `resumeDoc.ts` (layout-ready content), `format.ts`, `text.ts`, `itemData.ts`, `classes.ts`.
- **Components**: `ui/` is the design system; feature folders own their screens. Plain constants shared with server pages live in
  ordinary modules (for example `career/tabs.ts`), because values exported from a `"use client"` file cannot be used on the server.
- **Next.js 16 conventions**: all pages are server components that read the database directly (the root layout marks the tree
  dynamic so nothing is prerendered at build time); interactive parts are small client components; mutations go through route
  handlers validated with Zod; `error.tsx`, `global-error.tsx` and `not-found.tsx` provide error screens; per-page `metadata`
  and `generateMetadata` set titles; `src/proxy.ts` replaces the older middleware file.

## Interface design system

Tokens (colours, type, shadows) live in `src/app/globals.css`. The brand colour is the navy used by the Classic resume template.
Rules the components follow: one primary action per area, icon buttons always carry an accessible name and tooltip, destructive
actions always confirm and say what happens to other data, status is shown with a badge and never by colour alone, every form
field has a visible label with hints and errors tied to it, and focus is always visible. Layouts are responsive: a sidebar on
large screens and a drawer menu on phones; the builder switches between Edit and Preview on small screens.
