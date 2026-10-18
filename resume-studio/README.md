# Resume Studio

A local resume builder. You write your career facts **once** (the *Library*), describe the job you are
applying for (a *Target*), and Resume Studio builds a tailored resume from the most relevant items,
shows a live preview, checks the page count, and exports **DOCX**, **PDF** and **plain text**.

Built around one rule: **a resume should only contain what you can explain in an interview.**
Every bullet and skill carries a status - *Confident*, *Needs review* or *Excluded* - and
auto-tailoring only ever uses *Confident* items. Nothing is invented, and there is no AI involved.

Everything runs on your own computer. Your data never leaves the `data/` folder.

---

## Quick start (Windows)

1. Install **Node.js LTS** (18.18 or newer) from <https://nodejs.org>.
2. Unzip this folder anywhere, e.g. `C:\resume-studio`.
3. Double-click **`start.bat`**. The first run installs and builds (about 2 minutes, needs internet);
   after that it starts in seconds and opens <http://localhost:3000>.

Prefer a terminal?

```bash
npm install
npm run build
npm start            # http://localhost:3000   (listens on this computer only)
```

macOS / Linux use the same commands. For development with hot reload use `npm run dev`.

> **After editing any source file** run `npm run build` again (or use `npm run dev`).
> Changes to your *data* never need a rebuild - they are saved instantly.

---

## How it fits together

```
Library  (what is true about you)        Targets  (what a job wants)
  profile, summaries, experience,          job description text,
  skills, projects, education,             must-have keywords,
  certifications, involvement              projects to always feature
        \                                   /
         \--------->  Auto-tailor  <-------/      (keyword matching, Confident items only)
                          |
                          v
                 Resume  = a *recipe*: which Library items, in what order,
                           plus per-resume wording edits, template and formatting
                          |
              +-----------+-----------+------------+
              v           v           v            v
        Live preview     DOCX         PDF       Plain text
```

A resume **references** Library items, it does not copy them. Fix a typo in the Library and every resume
that uses that bullet is fixed. If you want different wording for *one* resume only, use the pencil (✎)
button in the composer - that is stored as an override on that resume alone.

### The honesty system

| Status | Meaning | Used by auto-tailoring? |
|---|---|---|
| **Confident** | You could explain it and answer follow-up questions | Yes |
| **Needs review** | Imported or unchecked - verify the wording and your understanding first | No |
| **Excluded** | You never want this claimed (e.g. a tool you cannot discuss) | No, and hidden in the composer |

The composer warns when a resume contains anything that is not *Confident*, and the **Interview prep**
page turns the resume into the questions an interviewer is likely to ask about each topic.

---

## Screens

* **Resumes** (home) - all your resumes; create one blank, tailored for a target, or as a copy; export; library health.
* **Library** - edit every section. The **Review queue** tab lists all unreviewed bullets in one place - work through it once and your auto-tailored resumes become much better.
* **Targets** - paste a job description. You see which keywords your Library covers, which are missing *and why* (not in library / needs review / excluded by you), and which projects would be featured. One click creates the resume.
* **Resume composer** - left: choose and reorder content; centre: live preview; right: template, formatting, exact page count with **Fit to N pages**, keyword coverage, honesty & ATS checks, export.
* **Interview prep** - likely questions for everything on a given resume; printable.

### Page fitting
The **Exact pages** figure comes from the real PDF renderer, not an estimate. **Fit to N pages** steps through
tighter spacing, margins and font size until the resume fits. It never deletes content; if it still does not fit,
it tells you to remove a project or some bullets. The preview's dashed page lines are approximate - the exported
file is the reference.

### Templates
Four ATS-safe presets (Classic, Modern, Compact, Serif). All are single column with standard fonts - no tables,
text boxes, columns or images, which is what applicant-tracking systems parse reliably. Every setting
(font, size, spacing, margins, accent colour, heading style, contact separator, short links, project labels,
forced page break before Projects) can be changed per resume.

---

## Your data (`data/`)

Plain JSON, one file per collection - readable, easy to back up, easy to put in Git.

| File | Contents |
|---|---|
| `profile.json` | Name and contact items (with optional short forms such as `in/yourname`) |
| `summaries.json` | Summary variants |
| `experience.json` | Jobs and internships, each with bullets that have a status |
| `skills.json` | Skill groups and skills, each with a status (the *Not claimed* group holds excluded skills) |
| `projects.json` | Projects: type (company / freelance / college / personal), links, tech stack, bullets, and the read-only knowledge-base facts |
| `education.json`, `certifications.json`, `involvement.json` | As named |
| `targets.json` | Job descriptions / focus targets |
| `resumes.json` | Resume recipes (selection, order, overrides, template, options) |

**Safety nets:** every save is validated first (a bad edit is rejected, never written); files are written
atomically; and a timestamped copy of the previous version is kept in `data/_backups/` (at most one per
collection every 10 minutes, newest 30 kept). **Backup** = copy the `data/` folder, or use *Download backup* on the home page.
**Start over** = `npm run seed -- --force` (rebuilds `data/` from the seed files).

### The knowledge base
`seed/project_knowledge_base.json` (your 35-project registry) was imported once. On the **Library → Projects** tab you can
re-import it or import a different file. Importing only *adds* new projects and new bullets (as *Needs review*) and refreshes the
read-only knowledge-base panel; it never overwrites anything you wrote. Projects scoring under 50 start archived (hidden in the composer);
knowledge-base technologies that your own bullets do not mention are listed in a yellow note so you can verify them before claiming them.

---

## How tailoring works

1. The job description is scanned against a built-in dictionary of ~110 technologies and concepts (`lib/terms.js`) - so `Node`, `node.js` and `NodeJS` are the same thing, and `Java` never matches `JavaScript`. Repeated terms and your *must-have keywords* weigh more.
2. Each Library item is scored by the keywords it contains. Only **Confident** items are eligible.
3. The top projects (default 3) are chosen, with their best bullets (default 4 each); jobs keep their best bullets (5 for the newest job, 3 for others); skills inside each group are ordered by relevance; the best certifications are kept. A small tie-break favours employer work over college/personal work. Projects you pin on the target (*Always feature*) go first.
4. The resume is then fitted to your page target by adjusting formatting only.

Tune the numbers in `lib/tailor.js` (`tailor()` options) or add terms in `lib/terms.js`.

---

## Customising

* **New template preset** - add an entry to `TEMPLATES` in `lib/templates.js`.
* **Section titles / order** - section order is per resume in the composer; default titles are in `SECTION_TITLES`.
* **Interview questions** - edit `lib/interview.js`.
* **A new output format** - write a renderer that reads the blocks from `buildModel()` in `lib/model.js` (see `lib/render-text.js`, 25 lines) and register it in `app/api/export/[id]/route.js`.

## Project layout

```
app/                 Next.js pages and API routes
  api/data/[name]    read/write a collection (validated)
  api/export/[id]    DOCX / PDF / TXT download
  api/layout         exact page count + fit-to-pages
  api/import-kb      knowledge-base merge
components/          UI (composer pieces, editors, preview, store with autosave)
lib/                 all logic - pure and tested
  schemas.js         data validation (zod)
  model.js           library + recipe  ->  layout blocks (shared by every output)
  tailor.js terms.js keyword matching and selection
  render-*.js        DOCX, PDF, text
  fit.js             page counting and fitting
  store.js           file storage with backups
data/                your data (JSON)
seed/                starting data + the knowledge base
scripts/seed.mjs     builds data/ from seed/
tests/               npm test
docs/ARCHITECTURE.md design notes
```

Run the tests with `npm test`. They check, among other things, that the "Current resume" in `data/` reproduces your sent resume
paragraph for paragraph, that tailoring never picks non-Confident items, and that exports are valid.

---

## Troubleshooting

* **"Port 3000 is already in use"** - close the other program, or change `3000` in the `dev` and `start` scripts in `package.json`.
* **Blank page / old behaviour after editing code** - run `npm run build` again.
* **"Save failed" badge** - hover it for the reason (usually a validation message). Your last good data is still on disk; backups are in `data/_backups/`.
* **A character shows as `?` in the PDF** - the PDF uses built-in Helvetica/Times, which cover Western characters. Replace unusual symbols, or use the DOCX export.
* **DOCX looks slightly different in Word vs the PDF** - the two renderers use different text engines, so page breaks can differ by a line. Use *Exact pages* (PDF) as your guide and check the DOCX in Word before sending.
* **Another computer** - copy the whole folder (including `data/`), then `npm install`.

## Good to know

* It listens on `127.0.0.1` only, so nobody else on your network can reach it. It has no login because it is a single-user local tool - do not expose it to the internet.
* Two browser tabs editing the same collection at once: the last save wins.
* Resume text is built from your wording. The tool never rewrites or "improves" claims.
