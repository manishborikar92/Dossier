# Resume Vault

A local-first career library and resume builder. Enter your profile, experience, education, skills and
projects **once**, then build as many independent, tailored resumes from them as you need and export each
as a PDF or an editable Word document.

Everything runs on your own computer. Your data is stored in a single SQLite file; nothing is sent to any server.

## What it does

- **Profile**: name, contact details, links, and several named summary variants.
- **Experience and skills**: jobs, internships, freelance, leadership roles, education, skills, certifications.
- **Project library**: add, edit, search, filter, archive and delete projects. Each has a name, overview, problem and
  solution, your role and contributions, technologies, features, decisions, verified results, links, tags, keywords
  and resume-ready bullet points. Import a `project_knowledge_base.json` file in one step.
- **Multiple resumes**: each resume has its own selection, order, wording, template and saved versions. Duplicate,
  rename, mark draft/final, delete (with confirmation).
- **Live preview**: the preview *is* the exported PDF, so what you see is what you download.
- **Keyword matching for a job description** (no AI): ranks your projects and skills for a posting, shows which
  requirements you have evidence for and which you do not. It never adds anything you have not recorded.
- **Verified flags**: imported or unconfirmed bullets are marked unverified, and you are warned before exporting them.
- **Backup and restore**: one JSON file holds your whole library, resumes and saved versions.

### How resumes relate to your library

A resume gets its own *copy* of the library items you choose, remembers where each came from, and keeps your edits.
If you later change something in the library, the resume shows **Library changed. Review** on that item and lets you
compare, then either *use the library version* or *keep mine*. The resume never changes by itself. **Saved versions**
are frozen snapshots; a version is also saved automatically whenever you download a PDF or Word file, so you can always
reproduce exactly what you sent.

## Prerequisites

- **Node.js 20.9 or newer** (Node 22 LTS recommended) and npm. Check with `node -v`.
- Windows, macOS or Linux. No database server, no browser downloads and no other software are needed.

The SQLite driver (`better-sqlite3`) installs a prebuilt binary for current Node versions. If `npm install` ever has to
compile it, you need a C++ toolchain (on Windows: "Desktop development with C++" from Visual Studio Build Tools).

## Install and run

```bash
# 1. In the project folder
npm install

# 2. Build once, then start
npm run build
npm start
```

Open **http://localhost:3000**. To use another port: `npm start -- -p 3001`.

For development with automatic reloading use `npm run dev` instead of the two commands above.

The app only listens on `127.0.0.1` (your own computer) and refuses requests addressed to any other host name.

### Using your own data

1. Open **Settings & backup → Restore from a backup file** and choose a Resume Vault backup file (for example
   `my-resume-vault-data.json` if you were given one). Or fill in **Profile** and **Experience & skills** by hand.
2. Open **Projects → Import knowledge base** and choose `project_knowledge_base.json`. Projects already in your library are
   skipped, so importing twice is safe. Imported bullets are marked unverified until you confirm them.
3. Open **Resumes → New resume**.

To explore the app with clearly fictional data instead, use a separate data folder:

```bash
DATA_DIR=./data-demo npm run seed:sample      # macOS / Linux
DATA_DIR=./data-demo npm start
```
On Windows PowerShell: `$env:DATA_DIR="./data-demo"; npm run seed:sample; npm start`.

## Where your data lives

| What | Where |
| --- | --- |
| Database | `data/vault.db` (plus `vault.db-wal` / `-shm` while the app runs) |
| Automatic safety copies | `data/backups/` (written before a restore and before a database upgrade) |

Change the folder with the `DATA_DIR` environment variable (see `.env.example`; copy it to `.env` to use it).

**Back up** from *Settings & backup → Download backup* (a JSON file). **Restore** with the same page; restoring replaces
everything, writes a safety copy first, and is all-or-nothing. To move to another computer, download a backup here and
restore it there. You can also copy the `data` folder while the app is stopped.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server with reloading |
| `npm run build` | Production build |
| `npm start` | Run the production build |
| `npm test` | Automated tests (Vitest) |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript type check |
| `npm run smoke` | End-to-end check of a running copy of the app (see below) |
| `npm run seed:sample` | Add fictional sample data to an empty library |

### Running the tests

```bash
npm test            # unit and integration tests, no server needed
npm run lint
npm run typecheck
npm run build
```

End-to-end smoke test (uses a throwaway data folder because it adds records and performs a restore):

```bash
npm run build
DATA_DIR=./data-smoke npm start -- -p 3100        # terminal 1
BASE_URL=http://localhost:3100 npm run smoke       # terminal 2
```

## Exports

- **PDF**: real selectable text, clickable links, standard section headings, single column, built-in PDF fonts
  (Helvetica or Times), no hyphenation, and headings are never left stranded at the bottom of a page.
- **Word (.docx)**: real paragraphs, a real bullet list, real hyperlinks and tab-aligned dates. It follows the same
  content and structure as the PDF, but it is laid out by Word, so spacing can differ slightly from the PDF.
- **Print**: use **Open PDF** and print from your browser's PDF viewer.
- **Backup**: JSON (see above).

Three templates (Classic, Compact, Minimal), A4 or US Letter, three spacing levels, accent colours, custom section
headings, section order and visibility.

## Project layout

```
src/app/            pages and API routes (Next.js App Router)
src/components/     interface components; builder/ holds the resume builder
src/lib/            code shared by server and browser: schemas, matcher, templates, resume document model
src/server/         database, repositories, resume service, backup, importer, PDF/DOCX renderers
src/proxy.ts        localhost-only and same-origin request guard
tests/              automated tests
scripts/            sample-data seeder and smoke test
docs/               architecture notes, database schema, verification report
```
See `docs/ARCHITECTURE.md` for the data model and design decisions, and `docs/schema.sql` for the database schema.

## Known limitations

- **Single user, no login.** It is built to run on your own computer. Run only one copy at a time on a data folder.
- **Latin text in PDFs.** The built-in PDF fonts cover Western European characters. Anything else (for example
  Devanagari or Chinese) cannot be drawn; the preview warns you and such characters are replaced.
- **Word and PDF are not pixel-identical.** Word lays text out itself. The Word file was checked by rendering it
  with LibreOffice, not with Microsoft Word.
- **The PDF preview is a browser PDF viewer in a frame.** Some phone browsers do not show it; use **Open PDF**.
- **Job-description matching is keyword based.** It knows a fixed vocabulary of common technologies plus every term in
  your own skills and project technologies. It does not understand synonyms beyond that list.
- **Months are abbreviated** (Jun 2025). Items are reordered with up/down buttons, not drag and drop.
- **Telemetry.** Next.js collects anonymous usage statistics by default. Turn it off with `npx next telemetry disable`
  or by setting `NEXT_TELEMETRY_DISABLED=1`. The app itself sends nothing anywhere.

## Troubleshooting

- **Port already in use**: `npm start -- -p 3001`.
- **`better-sqlite3` fails to install**: use a current Node LTS, or install a C++ build toolchain and retry `npm install`.
- **"database is locked"**: another copy of the app is using the same data folder. Stop it first.
- **A resume looks different after a library edit**: it should not. Open the item and look for *Library changed. Review*.
