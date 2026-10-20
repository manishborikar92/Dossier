# Architecture notes

## Decisions and why

| Decision | Choice | Reason |
|---|---|---|
| App form | Local Next.js 16 web app (App Router, Turbopack) | Private, free, nothing to host; you already know the stack |
| Language | Plain JavaScript + Zod validation | You can explain every line; Zod gives runtime safety on all saved data |
| Storage | JSON files in `data/` | Readable, diff-able, trivial to back up; no database to install on Windows |
| Output | One layout model, three renderers | DOCX, PDF and the preview can never disagree about *content* |
| PDF engine | pdfkit (pure JavaScript) | Real selectable text, no Chromium download, works offline |
| Tailoring | Deterministic keyword matching | Free, offline, explainable, cannot fabricate claims |
| Truthfulness | Per-item status (confident / needs review / excluded) | Directly addresses the risk of an over-claiming resume |

## Data flow

```
data/*.json --readAll()--> {profile, summaries, experience, skills, projects, ...}
                                   |
        resume recipe -------> resolveResume()  (look up ids, apply overrides, drop dangling ids)
                                   |
                              buildModel()  ->  blocks[]  (name, contact, section, entryHeader, bullet, ...)
                                   |
        +------------+-------------+--------------+
        v            v             v              v
   Preview.js   render-docx   render-pdf     render-text
   (browser)    (server)      (server)       (server)
```

`resolveResume()` is also the single source for `collectIncluded()`, which feeds the honesty warnings,
keyword coverage and interview prep - so those always describe exactly what will be exported.

## Resume recipe (resumes.json)

```jsonc
{
  "id": "...", "name": "...", "targetId": "...|null", "template": "classic",
  "options": { "paper": "letter", "fontSize": 10, "spacing": "normal", "margin": 0.75, "accent": "#1F3864",
               "targetPages": 2, "projectsOnNewPage": false, ... },
  "sectionOrder": ["summary", "skills", ...], "sections": { "projects": false },
  "selection": {
    "summaryId": "...", "contactIds": [...],
    "skills": [{ "groupId": "...", "items": ["itemId", ...] }],
    "experience": [{ "id": "...", "bullets": ["bulletId", ...] }],
    "projects":   [{ "id": "...", "bullets": [...] }],
    "education": [...], "certifications": [...], "involvement": [...]
  },
  "overrides": { "<bulletId>": "wording for this resume only", "summary:<id>": "..." }
}
```

Array order in `selection` is display order. Ids that no longer exist in the Library are skipped silently.

## Adding a new section type
1. Add its collection to `lib/schemas.js` and `lib/store.js`' list (it derives from `SCHEMAS`).
2. Add a `SECTIONS[key]` builder in `lib/model.js` and a title in `lib/templates.js`.
3. Add a spec in `app/library/page.js` and a picker panel in the composer.

## Source layout and boundaries
```
src/app         routes. Pages are thin server components that read async params/searchParams and render a feature view.
src/features    interactive product areas (client components) - each owns its panels, hooks and local styles' class names.
src/components  ui/ (design-system primitives), layout/ (shell), providers/ (theme, toasts, confirm, store).
src/lib/domain  pure, isomorphic logic. No Node APIs. Relative imports only (scripts and tests load it directly).
src/lib/server  Node-only: file storage, HTTP helpers, fit-to-pages, renderers. Never import from client components.
src/lib/client  browser helpers: fetch wrapper, resume-creation actions, formatting.
```
* **One shared store.** `StoreProvider` lives in the root layout: all collections are loaded once, edits are applied locally at once and
  saved per collection after a short debounce. Navigating between pages is instant and the save status is global.
* **Server vs client.** Only `src/app/api/*` and `src/lib/server/*` touch the file system. The browser works on a copy of the data and
  sends validated whole collections back; the server re-validates with the same Zod schemas.
* **Exact layout.** Page counts come from `POST /api/layout`, which runs the real PDF renderer on the recipe the browser sends,
  so unsaved edits are measured too.

## Adding a page
1. Create `src/features/<area>/<Area>View.js` (a client component using `useStore()`).
2. Add `src/app/<route>/page.js` that exports `metadata` and renders the view.
3. Add a nav item in `src/components/layout/Sidebar.js`.
4. Add a journey to `tests/e2e/run.mjs` and the route to its accessibility list.
