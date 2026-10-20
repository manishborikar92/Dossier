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

1. Install **Node.js LTS** (20.9 or newer) from <https://nodejs.org>.
2. Unzip this folder anywhere, e.g. `C:\resume-studio`.
3. Double-click **`start.bat`**. The first run installs and builds (about 2 minutes, needs internet);
   after that it starts in seconds and opens <http://localhost:3000>.

Prefer a terminal?

```bash
npm install
npm run build
npm start            # http://localhost:3000   (listens on this computer only)
```

macOS and Linux use the same commands. For development with hot reload use `npm run dev`.

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
that uses that bullet is fixed. To word something differently for *one* resume only, use the pencil button
beside a bullet in the editor - that is stored as an override on that resume alone.

### The honesty system

| Status | Meaning | Used by auto-tailoring? |
|---|---|---|
| **Confident** | You could explain it and answer follow-up questions | Yes |
| **Needs review** | Imported or unchecked: verify the wording and your understanding first | No |
| **Excluded** | You never want this claimed (for example a tool you cannot discuss) | No, and hidden in the editor |

The status system is also the visual language of the app, borrowed from proofreading: anything *Needs review* is
**highlighted like marker pen**, in the Library, the Review queue, the editor's content list and (with
*Highlight unconfirmed text* on) on the paper preview itself. A resume with unchecked claims literally looks marked up.
The editor warns when a resume contains anything that is not Confident, and **Interview prep** turns a resume into
the questions an interviewer is likely to ask.

---

## Screens

* **Resumes** - your resumes as paper thumbnails, the state of your library, and a short getting-set-up list. Create a resume blank, tailored for a target, or as a copy; export; duplicate; delete (with Undo).
* **Library** - edit every section. The **Review queue** lists every unreviewed bullet in one place: work through it once and auto-tailoring becomes much better. Rows you just changed stay in place until you change the filter.
* **Targets** - paste a job description. See which keywords your library covers, which are missing *and why* (not in library / needs review / excluded by you), and which projects would be featured. One click creates the resume.
* **Resume editor** - left: choose and reorder content; centre: the paper; right: **Design** (template, page, style, details), **Checks** (exact page count with *Fit to N pages*, honesty, readability for recruiting software) and **Target** (keyword coverage). Export from the toolbar.
* **Interview prep** - likely questions for everything on a resume; printable.

On narrow screens the editor shows one pane at a time (Content, Preview, Design and checks). A light and a dark theme are available and remembered.

### Page fitting
The page count shown is exact: it comes from the real PDF renderer, not an estimate. **Fit to N pages** steps through
tighter spacing, margins and font size until the resume fits. It never deletes content; if it still does not fit,
it tells you to remove a project or some bullets. The preview's dashed lines are approximate; the exported file is the reference.

### Templates
Four ATS-safe presets (Classic, Modern, Compact, Serif). All are a single column with standard fonts: no tables,
text boxes, columns or images, which is what applicant-tracking systems parse reliably. Font, size, spacing, margins,
accent colour, heading style, contact separator, short links, project labels and a forced page break before Projects
can all be changed per resume.

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
| `targets.json` | Job descriptions and focus targets |
| `resumes.json` | Resume recipes (selection, order, overrides, template, options) |

**Safety nets:** every save is validated first (a bad edit is rejected, never written); files are written atomically;
and a timestamped copy of the previous version is kept in `data/_backups/` (at most one per collection every 10 minutes,
newest 30 kept). **Back up** by copying the `data/` folder, or use *Download backup* on the Resumes page.
**Start over** with `npm run seed -- --force` (rebuilds `data/` from the seed files).

### The knowledge base
`seed/project_knowledge_base.json` (your 35-project registry) was imported once. On **Library, Projects** you can
re-import it or import a different file. Importing only *adds* new projects and new bullets (as *Needs review*) and refreshes the
read-only panel on each project; it never overwrites anything you wrote. Projects scoring under 50 start archived;
technologies the knowledge base lists but your own bullets do not mention appear in a note so you can verify them before claiming them.

---

## How tailoring works

1. The job description is scanned against a built-in dictionary of about 110 technologies and concepts (`src/lib/domain/terms.js`), so `Node`, `node.js` and `NodeJS` are the same thing and `Java` never matches `JavaScript`. Repeated terms and your *must-have keywords* weigh more.
2. Each Library item is scored by the keywords it contains. Only **Confident** items are eligible.
3. The top projects (default 3) are chosen with their best bullets (default 4 each); jobs keep their best bullets (5 for the newest, 3 for the others); skills in each group are ordered by relevance; the best certifications are kept. A small tie-break favours employer work over college and personal work. Projects you pin on the target go first.
4. The resume is then fitted to your page target by adjusting formatting only.

Tune the numbers in `src/lib/domain/tailor.js` or add terms in `src/lib/domain/terms.js`.

---

## Project structure

The code follows the Next.js 16 `src/` convention. Pages are thin server components; the interactive work lives in feature folders.

```
src/
  app/                        routes only (Next.js App Router)
    layout.js                 fonts, global styles, providers, app shell
    page.js  library/  targets/  resume/[id]/  prep/[id]/     thin server pages -> feature views
    api/                      route handlers: data, export, layout (page count + fit), import-kb
    error.js  not-found.js  icon.svg
  features/                   one folder per product area
    dashboard/  library/  targets/  composer/  prep/  preview/
  components/
    ui/                       design-system primitives (Button, Field, Tabs, Dialog, Menu, ...)
    layout/                   app shell, sidebar, page header
    providers/                theme, toasts, confirm dialog, shared autosaving store
  lib/
    domain/                   pure logic shared by browser and server: schemas, model, tailor, terms, templates, ...
    server/                   file storage, HTTP helpers, fit-to-pages, render/ (docx, pdf, text)
    client/                   fetch wrapper, actions, formatting helpers
  styles/                     tokens.css, base.css, ui.css, shell.css, features.css
data/        your data (JSON)            seed/       starting data + the knowledge base
scripts/     seed script                 tests/      unit tests (tests/*.test.mjs) and e2e (tests/e2e)
docs/        ARCHITECTURE.md, DESIGN.md
```

Import rules: `@/` points at `src/`. Code in `src/lib/domain` and `src/lib/server` uses relative imports so the Node scripts and tests can load it without a bundler.
`lib/domain` must never import Node APIs (it runs in the browser too); `lib/server` must never be imported from a client component.

---

## Testing

```bash
npm test             # 10 unit tests (domain logic, exports, tailoring guarantees) - no browser needed
npm run build        # then:
npm run test:e2e     # 14 browser tests: real journeys + an accessibility audit (WCAG 2.2 AA, light and dark)
```

The unit tests check, among other things, that the "Current resume" in `data/` reproduces your sent resume paragraph for paragraph,
that tailoring never picks anything that is not Confident, and that DOCX/PDF/text exports are valid.

The end-to-end tests start the built app on a temporary copy of your data (your real `data/` is never touched) and drive your installed
**Chrome or Edge** (found automatically; set `CHROME_PATH` to use another). They cover creating, editing, fitting and exporting resumes, the review queue,
confirmations and undo, theme switching, keyboard navigation, the small-screen layout, and run axe-core for accessibility problems on every page.

---

## Troubleshooting

* **"Port 3000 is already in use"** - close the other program, or change `3000` in the `dev` and `start` scripts in `package.json`.
* **Blank page or old behaviour after editing code** - run `npm run build` again.
* **"Could not save" in the sidebar** - it names the reason (usually a validation message). Your last good data is still on disk; backups are in `data/_backups/`.
* **A character shows as `?` in the PDF** - the PDF uses built-in Helvetica/Times, which cover Western characters. Replace unusual symbols, or use the DOCX export.
* **DOCX looks slightly different in Word than the PDF** - the two renderers use different text engines, so a page break can differ by a line. Use the exact page count (PDF) as your guide and check the DOCX in Word before sending.
* **Another computer** - copy the whole folder (including `data/`), then `npm install`.

## Good to know

* It listens on `127.0.0.1` only, so nobody else on your network can reach it. It has no login because it is a single-user local tool: do not expose it to the internet.
* Two browser tabs editing the same collection at once: the last save wins.
* Resume text is built from your wording. The tool never rewrites or "improves" claims.
