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
- **Live preview**: the preview _is_ the exported PDF (drawn page by page with pdf.js), so what you see is what you download. Zoom to fit or to a fixed size.
- **Keyword matching for a job description** (no AI): ranks your projects and skills for a posting, shows which
  requirements you have evidence for and which you do not. It never adds anything you have not recorded.
- **Verified flags**: imported or unconfirmed bullets are marked unverified, and you are warned before exporting them.
- **Backup and restore**: one JSON file holds your whole library, resumes and saved versions.

### How resumes relate to your library

A resume gets its own _copy_ of the library items you choose, remembers where each came from, and keeps your edits.
If you later change something in the library, the resume shows **Library changed. Review** on that item and lets you
compare, then either _use the library version_ or _keep mine_. The resume never changes by itself. **Saved versions**
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
   `manish-resume-vault-data.json` if you were given one). Or fill in **Profile** and **Experience & skills** by hand.
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

| What                    | Where                                                                    |
| ----------------------- | ------------------------------------------------------------------------ |
| Database                | `data/vault.db` (plus `vault.db-wal` / `-shm` while the app runs)        |
| Automatic safety copies | `data/backups/` (written before a restore and before a database upgrade) |

Change the folder with the `DATA_DIR` environment variable (see `.env.example`; copy it to `.env` to use it).

**Back up** from _Settings & backup → Download backup_ (a JSON file). **Restore** with the same page; restoring replaces
everything, writes a safety copy first, and is all-or-nothing. To move to another computer, download a backup here and
restore it there. You can also copy the `data` folder while the app is stopped.

## Scripts

| Command               | Purpose                                                   |
| --------------------- | --------------------------------------------------------- |
| `npm run dev`         | Development server with reloading                         |
| `npm run build`       | Production build                                          |
| `npm start`           | Run the production build                                  |
| `npm test`            | Automated tests (Vitest)                                  |
| `npm run lint`        | ESLint                                                    |
| `npm run typecheck`   | TypeScript type check                                     |
| `npm run smoke`       | End-to-end check of a running copy of the app (see below) |
| `npm run seed:sample` | Add fictional sample data to an empty library             |

### Running the tests

```bash
npm test            # unit and integration tests, no server needed
npm run lint
npm run typecheck
npm run build
```

End-to-end smoke test of the server and API (uses a throwaway data folder because it adds records and performs a restore):

```bash
npm run build
DATA_DIR=./data-smoke npm start -- -p 3100        # terminal 1
BASE_URL=http://localhost:3100 npm run smoke       # terminal 2
```

Real-browser test: it drives the actual interface (forms, dialogs, the builder and its live preview, exports, backup and
restore, a phone-sized screen, keyboard and accessibility checks). It needs a Chrome, Chromium or Edge installation:

```bash
npm run build
DATA_DIR=./data-e2e npm start -- -p 3100                                   # terminal 1
CHROME_PATH="/path/to/chrome" BASE_URL=http://localhost:3100 npm run e2e   # terminal 2
```

`CHROME_PATH` is optional when Chrome is installed in a standard place. In containers add
`E2E_CHROME_ARGS='["--no-sandbox","--disable-gpu"]'`, and set `E2E_SHOT_DIR=./shots` to save a screenshot whenever a step fails.
Always use a throwaway data folder: the test creates records and restores a backup.

## Exports

- **PDF**: real selectable text, clickable links, standard section headings, single column, built-in PDF fonts
  (Helvetica or Times), no hyphenation, and headings are never left stranded at the bottom of a page.
- **Word (.docx)**: real paragraphs, a real bullet list, real hyperlinks and tab-aligned dates. It follows the same
  content and structure as the PDF, but it is laid out by Word, so spacing can differ slightly from the PDF.
- **Print**: choose **Export → Open PDF to print** and print from your browser's PDF viewer.
- **Backup**: JSON (see above).

Three templates (Classic, Compact, Minimal), A4 or US Letter, three spacing levels, accent colours, custom section
headings, section order and visibility, and a **Start on a new page** option per section.

**Classic** reproduces the look of the resume generated by the original `generate_resume.js`: the name in capitals, a rule under the
contact line, blue underlined contact links, bold project links beside the project title, full month names for education dates
("April 2021"), regular black dates for education and leadership, and the organisation and description of a leadership
role on one grey line. Short entries are never split across two pages.

## Project layout

```
src/app/                 pages, error / not-found screens, and API routes (Next.js App Router)
src/components/ui/       the design system: buttons, fields, dialogs, menu, tabs, toasts, cards, badges
src/components/layout/   app shell and navigation
src/components/          one folder per feature: profile, career, projects, resumes, builder, settings, shared
src/lib/                 code shared by server and browser: schemas, types, typed API client, matcher, templates, resume document model
src/server/              database, repositories, resume service (resumes/), backup, importer, stats, PDF/DOCX renderers
src/proxy.ts             localhost-only and same-origin request guard
tests/                   unit and integration tests (Vitest)
scripts/                 smoke test, browser test, sample-data seeder
docs/                    architecture notes, database schema, verification report
```

See `docs/ARCHITECTURE.md` for the data model and design decisions, and `docs/schema.sql` for the database schema.

## Known limitations

- **Single user, no login.** It is built to run on your own computer. Run only one copy at a time on a data folder.
- **Latin text in PDFs.** The built-in PDF fonts cover Western European characters. Anything else (for example
  Devanagari or Chinese) cannot be drawn; the preview warns you and such characters are replaced.
- **Word and PDF are not pixel-identical.** Word lays text out itself. The Word file was checked by rendering it
  with LibreOffice, not with Microsoft Word.
- **The live preview is drawn by pdf.js in the browser.** If it ever fails to load, use **Export → Open PDF to print**.
- **Job-description matching is keyword based.** It knows a fixed vocabulary of common technologies plus every term in
  your own skills and project technologies. It does not understand synonyms beyond that list.
- **Months are abbreviated** (Jun 2025), except in education where they are written in full (April 2021). Items are reordered with up/down buttons, not drag and drop.
- **Dates sit flush with the right margin.** The original script's right tab stop stopped short of the margin on US Letter, so its dates floated slightly inward; the app aligns them to the margin.
- **Fonts.** PDFs use the standard Helvetica (or Times) fonts, which are not embedded; viewers show a close equivalent. Word files use Arial (or Times New Roman).
- **Telemetry.** Next.js collects anonymous usage statistics by default. Turn it off with `npx next telemetry disable`
  or by setting `NEXT_TELEMETRY_DISABLED=1`. The app itself sends nothing anywhere.

## Troubleshooting

- **Port already in use**: `npm start -- -p 3001`.
- **`better-sqlite3` fails to install**: use a current Node LTS, or install a C++ build toolchain and retry `npm install`.
- **"database is locked"**: another copy of the app is using the same data folder. Stop it first.
- **A resume looks different after a library edit**: it should not. Open the item and look for _Library changed. Review_.
