# Verification report

What was built, what was actually run, what passed, and what was **not** checked.
Environment for every run below: Linux, Node.js 22.22.2, npm 10.9.7, Chromium 153 (headless) for the browser tests.

## Summary of results

| Check                                                              | Result                              |
| ------------------------------------------------------------------ | ----------------------------------- |
| `npm ci` from the lockfile in a clean copy extracted from the ZIP  | Passed                              |
| `npm run lint` (ESLint, Next.js rules, type-only imports enforced) | 0 problems                          |
| `npm run format:check` (Prettier)                                  | All files formatted                 |
| `npm run typecheck` (TypeScript, strict)                           | 0 errors                            |
| `npm test`                                                         | **71 tests in 9 files, all passed** |
| `npm run build` (production build)                                 | Passed, no warnings                 |
| `npm run smoke` (API end to end, against the running server)       | **47 of 47 checks passed**          |
| `npm run e2e` (**real browser** driving the actual interface)      | **34 of 34 checks passed**          |
| `npm run dev`, `npm run seed:sample`                               | Both work                           |
| `npm audit --omit=dev` (what actually runs the app)                | 0 vulnerabilities                   |

## Browser test (34 checks, Chromium)

Drives the real interface of a running copy of the app against a throwaway data folder:

- **First run and navigation**: welcome screen and setup checklist, every sidebar link, the not-found page.
- **Profile**: field validation messages, save, persistence after reload, the unsaved/saved indicator.
- **Experience, education, skills, certifications**: add through dialogs, Escape closes without saving, date validation,
  a skill added to an existing category card, delete with confirmation.
- **Project library**: add with comma-separated technology tags and a bullet, import a knowledge-base file through the file picker,
  re-import changes nothing, search and technology filter, archive and restore.
- **Resume builder**: create a resume from a job description, the live preview draws real pages on canvases (pixels checked),
  hiding an item changes the preview, editing a bullet changes only that resume, add from the library, the job-match tab
  (ranking, gaps), template/accent/page-break settings, save and restore a version, the Export menu (keyboard, Escape),
  the unverified-bullets confirmation, a real PDF download and a real Word download, a changed library item flagged and reviewed,
  duplicate and delete.
- **Backup and restore**: download a backup, delete data, restore it through the file picker, a non-backup file is rejected,
  defaults apply to new resumes.
- **Phone-sized screen and accessibility**: the menu drawer, no horizontal scrolling, Edit/Preview switch in the builder,
  every page has exactly one heading and no unnamed buttons, links or unlabeled fields, the skip link works,
  and no console errors or failed requests during the whole run.

## What the automated unit and integration tests cover

- **Library** (7), **resumes** (13), **backup** (5), **knowledge-base import** (4), **matcher** (7): as before, including independence
  of resumes, the hybrid update strategy, immutable versions, all-or-nothing restore, and gaps never being suggested.
- **Exports** (18): real PDFs with selectable text and links; every template, page size and density; headings and short entries
  never split across pages; page-break option; reference-style details (capitalised name, header rule, full-month education
  dates, two-line leadership entry); valid Word files with real hyperlinks and bullet lists.
- **Screens** (8): every page component and every kind of resume-item editor renders on the server with realistic data.
- **Dashboard and navigation** (4) and **API client** (5): the dashboard queries, active-link logic, and error handling for
  validation errors, an unreachable server, and non-JSON responses.

## Changes in this round

1. **Data file renamed** to `manish-resume-vault-data.json`; every reference updated. Its contents are unchanged.
2. **Interface redesign**: a consistent design system (Inter type, navy brand colour, cards, badges, notices, menus, dialogs),
   grouped sidebar with a drawer on phones, a dashboard with stat tiles, attention list, recent resumes and setup progress,
   a profile page with a live header preview and an unsaved-changes indicator, skills as category cards, a project page
   with a side navigation and sticky actions, resume cards, and a builder with collapsible sections, compact rows, a single
   Export menu, and a preview drawn with pdf.js (zoom, page count, works on every browser and phone).
3. **Code quality**: components organised by feature with a `ui/` design system; one typed API client (no hand-built URLs);
   shared API types; the 600-line resume service split into focused modules; shared dashboard queries; error and not-found
   screens; Prettier and stricter ESLint rules enforced across the project; duplicated code removed.

## Problems found and fixed during this round

The real browser caught problems that type checking, linting, the build and server-side rendering all missed:

- A constant exported from a client component file was used by a server page and crashed the Experience & skills page.
  Moved to a plain module; the smoke test now checks each page for its own content.
- On phones, section titles and item names were truncated to a few letters. Titles now wrap and actions move to their own line.
- Soft-focus blur effects froze the page in software-rendered browsers. They were removed from the design.
- A loading screen made missing projects and resumes return "200" instead of 404. It was unnecessary (data loads instantly) and was removed.
- A section body padding conflict in the dashboard card, and the project list now shows 20 projects at a time with "Show more".

## NOT verified (please read)

- **Browsers other than Chromium.** The browser tests ran on Chromium 153 only. Firefox, Safari and real phones were not tested.
  The preview uses pdf.js's compatibility build to support older browsers, but that is untested outside Chromium.
- **Hardware rendering.** The browser tests ran with GPU compositing off. The design avoids heavy effects, but I have not seen it on a real GPU.
- **Microsoft Word.** The `.docx` files were validated structurally and rendered to images with LibreOffice only.
- **Other platforms.** Only Linux and Node 22.22.2 were used. Node 20 (the declared minimum), Windows and macOS were not tested.
- **Screen readers.** Accessibility was checked automatically (names, labels, headings, keyboard) but not with a screen reader.
- **`npm audit` for development tools.** `npm audit` (including dev dependencies) reports advisories in the test runner
  (Vitest/tinypool) and the ESLint glob chain. None is part of the running app (`--omit=dev` reports 0). Fixing them needs
  Vitest 5, which requires Node 22.12 or newer, so they were left alone to keep Node 20 working.
- Non-Latin text in PDFs is not supported (the preview warns). Job-description matching is keyword based, not semantic.

## Suggested future improvements

- Run the browser test in more browsers and on a hardware-accelerated machine; add visual regression screenshots.
- A dark theme, and an unsaved-changes prompt when leaving a form.
- Embedded fonts for non-Latin scripts; drag-and-drop ordering.
- Optional AI-assisted bullet wording, kept strictly separate from facts and always reviewed by you.
