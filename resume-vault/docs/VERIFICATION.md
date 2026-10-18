# Verification report

What was built, what was actually run, what passed, and what was **not** checked.
Environment for every run below: Linux, Node.js 22.22.2, npm 10.9.7.

## Summary of results

| Check | Result |
| --- | --- |
| `npm ci` from the lockfile in a clean copy extracted from the ZIP | Passed |
| `npm run lint` (ESLint, Next.js rules) | 0 problems |
| `npm run typecheck` (TypeScript, strict) | 0 errors |
| `npm test` | **55 tests in 7 files, all passed** |
| `npm run build` (production build) | Passed, no warnings |
| `npm run smoke` (end-to-end, against the running production server) | **46 of 46 checks passed** |
| Server restarted for real on the same data folder | Profile, resumes, versions and bullets all still there; PDF export still works |
| `npm run dev` | Served `/` and `/projects` (HTTP 200), no errors in the log |
| `npm run seed:sample` | Adds sample data to an empty library; refuses to run on a non-empty one |
| `npm audit --omit=dev` (what actually runs the app) | 0 vulnerabilities |

## What the automated tests cover

- **Library** (7): profile save and versioning, only-bump-when-changed, validation, bullets create/update/delete with stable
  identity, project lists, archive, reorder, deleting an item used by resumes (resumes keep their copy).
- **Resumes** (13): creation from the library, refusing to create before the profile has a name, job-description pre-selection,
  **independence** (editing one resume changes neither the library nor another resume), hidden bullets, validation, the
  **hybrid update strategy** (changed/pull/keep/deleted sources, profile changes flag the header), versions (immutable,
  restore, protects unsaved edits first, exporting an older version), duplicate, reorder, hide/rename sections, add from
  library, duplicate rejection, summary replacement.
- **Backup** (5): full round trip into an empty database (exported data identical), restore replaces and keeps working,
  invalid files rejected, a failing restore leaves the data untouched, safety copy of a file database, data survives closing
  and reopening the file.
- **Knowledge-base import** (4): unverified bullets, order by rank, nothing invented (role, results, repository stay empty),
  re-import skips existing, minimum score, unreadable records reported.
- **Matcher** (7): aliases, evidence, ranking, gaps are never suggested, terms from the user's own library, evidence found in
  bullet text, no matches inside longer words.
- **Exports** (11): the PDF is real, with selectable text and clickable links; hidden bullets and hidden sections are absent;
  long content flows to several pages without losing text; every template x page size x density renders; an older saved version
  exports as it was; **headings, entry headers and tech lines are never stranded at the bottom of a page** (this test was
  confirmed to fail against the earlier layout); the DOCX is a valid Word file with real hyperlinks, a real bullet list and the
  chosen page size.
- **Screens** (8): every page component and every kind of resume-item editor renders on the server with realistic data
  (this catches render-time crashes; it does not exercise clicks).

## End-to-end smoke test (46 checks)

Against the running production server with a throwaway data folder: all pages render; unknown project/resume are 404; request
safeguards (wrong host, cross-site change, cross-site fetch metadata are refused); validation (field messages, malformed JSON,
creating a resume before a profile exists); profile, experience, education, skills and projects CRUD; knowledge-base import and
safe re-import; resume creation with job-description matching, duplication, independence from edits; the match endpoint; PDF
preview and download (real PDF, page count, attachment header); Word download (real zip); a version saved automatically **once**
on download; manual versions and restore; the changed-library flag, which keeps the resume's text until you pull; backup
download, delete, restore with a safety copy, and the deleted resume coming back; settings.

## Verification with the real files you supplied

Run on your actual files (not shipped in the ZIP):

- A backup file was generated from your resume (`generate_resume.js`, strings read from the file rather than retyped) and
  restored into a fresh database: profile, 4 experience entries (3 jobs/internships + the NSS leadership role), 3 education
  entries, 3 certifications, 32 skills, 3 projects (19 bullets, all marked verified because you confirmed the resume is correct)
  and a resume rebuilt from them.
- Your `project_knowledge_base.json` was then imported: **32 projects imported, 3 skipped** (IWLARS, CA-Workflow and Smart Healthcare
  already exist from your resume, whose wording wins). Importing again changed nothing (35 skipped).
- The rebuilt resume was exported to PDF and Word and compared word by word with your original `.docx`:
  **788 words in both**. The Word export differs in four places: "Apr 2021" and "Mar 2019" (the app abbreviates months),
  and the NSS entry prints the organisation next to the title with the description below, instead of the original's
  organisation-then-description line. The PDF's only differences are the order in which a text extractor reads right-aligned
  dates; the page images show the same content as the original.
- A stress resume with all 35 projects renders (6 pages), as expected.

## Problems found and fixed during verification

- PDF header: the name overlapped the headline; the contact line wrapped awkwardly. Fixed.
- PDF page breaks: "Key Projects" heading and a project title could sit alone at the bottom of a page. Fixed and covered by a test.
- Bullet indentation in the PDF now matches the Word file and your original.
- The dashboard crashed (HTTP 500) because a client-only helper was called from a server page. Fixed (found by the smoke test).
- After "Save and analyse" the job-match tab still said "Not analysed yet". Fixed.
- The server listened on every network interface although the app has no login. It now binds to `127.0.0.1`, refuses other
  host names, and refuses cross-site change requests.
- A leftover test route from early experiments was removed before packaging; lint and file-tracing warnings were cleared.

## NOT verified (please read)

- **No real browser was used.** I could not open the interface in Chrome, Firefox, Safari or a phone. The screens are checked by
  type checking, linting, a production build, server-side rendering of every component with realistic data, and the API
  smoke test. Interactive behaviour (dialogs, keyboard tabbing, the PDF preview frame, file pickers, drag/scroll behaviour, the
  responsive layout, colour contrast, screen-reader behaviour) has **not** been exercised. Expect to spot small visual or
  interaction rough edges on first use.
- **Microsoft Word.** The `.docx` files were validated structurally and rendered to images with LibreOffice only.
- **Other platforms.** Only Linux and Node 22.22.2 were used. Node 20 (the declared minimum), Windows and macOS were not tested.
  The dependencies declare support for Node 20.9+.
- **`npm audit` for development tools.** `npm audit` (including dev dependencies) reports 8 advisories in the test runner
  (Vitest/tinypool) and the ESLint glob chain. None of these packages is part of the running app (`--omit=dev` reports 0). The
  fixes require Vitest 5, which needs Node 22.12 or newer, so they were left alone to keep Node 20 working.
- Non-Latin text in PDFs is not supported (the preview warns). Job-description matching is keyword based, not semantic.

## Suggested future improvements

- Browser-based end-to-end tests (Playwright) and an accessibility audit.
- Embedded fonts for non-Latin scripts.
- Drag-and-drop ordering, and a diff view that highlights changes inside a single line.
- A date-format setting (full month names) and a per-resume page-count target.
- Optional AI-assisted bullet wording, kept strictly separate from facts and always reviewed by you.
