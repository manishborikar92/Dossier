# Dossier: Architecture and Design Decisions

## 1. Overview & Stack

Dossier is a local-first career library and tailored resume engine designed for high-density, accurate document rendering and effortless resume tailoring.

| Concern | Choice | Rationale |
| ------- | ------ | --------- |
| **Frontend** | Next.js 16 (App Router) + React 19 + TypeScript | Unified server/client execution, server-side data fetching, strict component architecture. |
| **Current Database** | SQLite via `better-sqlite3`, handwritten SQL migrations | Single-file zero-configuration local persistence; high-performance synchronous operations. |
| **Validation** | Zod schemas in `web/src/lib/schemas.ts` | Unified input validation shared between user interfaces and API endpoints. |
| **PDF Engine** | `@react-pdf/renderer` | Client/server JavaScript rendering with precise layout control, real text selection, and vector fidelity. |
| **DOCX Engine** | `docx` | Generates authentic Word OOXML documents (hierarchical styles, numbered bullets, hyperlinked text, right-aligned tabs). |
| **Styling** | Tailwind CSS 4 | Zero runtime overhead design token system configured in `web/src/app/globals.css`. |
| **Testing** | Vitest with pdfjs-dist and JSZip | Integration test suite that reads back exported binary artifacts to verify content integrity. |

---

## 2. Repository Layout

The repository is structured to cleanly separate the web frontend, project-wide documentation, root tooling, and a future dedicated backend service:

```
Dossier/
├── docs/                       # Project-wide documentation and technical blueprints
│   ├── ARCHITECTURE.md         # System architecture, design decisions & roadmap
│   ├── VERIFICATION.md         # Test evidence and verification procedures
│   └── schema.sql              # Relational database schema reference
├── web/                        # Independent Next.js 16 frontend application
│   ├── backups/                # Starter backup files (manish-dossier-data.json, etc.)
│   ├── public/                 # Static web assets
│   ├── scripts/                # Frontend smoke tests, E2E runner, sample seeder
│   ├── src/                    # Application source code
│   │   ├── app/                # App Router pages and route handlers
│   │   ├── components/         # UI component library, layout, and feature screens
│   │   ├── lib/                # Shared utilities, schemas, API client, formatting
│   │   ├── server/             # Local database repository, business services, export renderers
│   │   └── proxy.ts            # Next.js 16 request interceptor (localhost guard)
│   ├── tests/                  # Automated integration and unit tests
│   ├── package.json            # Web application dependencies and scripts
│   └── tsconfig.json           # Frontend TypeScript configuration
├── scripts/                    # Repository-level scripts and tools
├── package.json                # Root package configuration with delegated task scripts
├── .gitignore                  # Root gitignore rules
└── README.md                   # Repository overview and setup guide
```

---

## 3. Data Model & Provenance

The database cleanly delineates between the **Library** (canonical career facts) and **Resumes** (custom tailored selections).

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

Every library row has a `version` that increments whenever its content changes.

### Resume Items: Copy Plus Provenance

A `resume_items` row stores:
- `data`: The specific text and configuration tailored for this resume.
- `source_type` and `source_id`: Origin pointers (deliberately not foreign keys so library deletions do not cascade).
- `source_version`: The library version when the item was copied into the resume.

| Scenario | Behavior |
| -------- | -------- |
| **Library item modified** | Library `version` increases; the resume flags the item as *Library changed* without modifying the tailored text. |
| **User reviews difference** | **Use the library version** updates the resume copy; **Keep mine** acknowledges the change while retaining custom text. |
| **Library item deleted/archived** | The resume retains its copy and displays *Deleted from library* status. |
| **Resume edited** | Changes apply solely to that resume's copy; the canonical library is never mutated. |
| **Resume duplicated** | Items are deep-copied into a new resume record with independent lifecycles. |

### Immutable Versions

`resume_versions.snapshot` stores complete resume settings and item arrays as JSON. Versions are created manually by the user, automatically during PDF/DOCX downloads, and automatically before restoring older versions.

---

## 4. Document Rendering Pipeline

```
resume_items + resumes.settings ──▶ Snapshot ──▶ buildResumeDoc() ──▶ ResumeDoc ──┬──▶ PDF Renderer (@react-pdf/renderer)
                                                                                  └──▶ DOCX Renderer (docx)
```

Both renderers consume the identical intermediate `ResumeDoc` structure defined in `web/src/lib/resumeDoc.ts`. This guarantees that text content, bullet points, hyperlinks, and section order remain consistent across PDF and Word exports.

---

## 5. Security & Request Interception

- **Network Scope**: Dossier is configured to bind exclusively to `127.0.0.1` (`npm start` and `npm run dev`).
- **Next.js 16 Proxy**: Implemented in `web/src/proxy.ts`, intercepting incoming HTTP requests to enforce:
  1. DNS-rebinding protection by validating that the `Host` header resolves to `localhost` or `127.0.0.1` (configurable via `ALLOWED_HOSTS`).
  2. Same-origin protection by rejecting state-changing requests (`POST`, `PUT`, `PATCH`, `DELETE`) with mismatched `Origin` or `Sec-Fetch-Site` headers.
- **SQL Injection Prevention**: All queries utilize bound SQL parameters. Table and column identifiers are strictly whitelist-checked.

---

## 6. Future Architecture: Dedicated Backend (`server/`) & PostgreSQL

The codebase is organized so that transitioning to a multi-tiered architecture with a standalone backend service and PostgreSQL requires zero refactoring of frontend components.

```
┌─────────────────────────────────┐
│     web/ (Next.js 16 / React 19)│
│  - UI Components & Editor       │
│  - Typed API Client (lib/api.ts)│
└────────────────┬────────────────┘
                 │ HTTP / REST
┌────────────────▼────────────────┐
│     server/ (Future Backend)    │
│  - REST API Routes              │
│  - Business Rules & Validation  │
│  - PDF/DOCX Generation Service  │
└────────────────┬────────────────┘
                 │ SQL / Connection Pool
┌────────────────▼────────────────┐
│       PostgreSQL Database       │
│  - Normalized Schema (docs/sql) │
│  - ACID Transactions            │
└─────────────────────────────────┘
```

### Architectural Seams & Boundaries

1. **Frontend API Seam (`web/src/lib/api.ts`)**:
   - The frontend never executes direct database calls from client components.
   - All client interactions flow through the typed `api` object in `web/src/lib/api.ts`.
   - To target a standalone server, configure `NEXT_PUBLIC_API_URL` (or Next.js reverse proxy rewrites in `next.config.ts`) to route `/api/*` to the `server/` instance.

2. **Backend Service (`server/`)**:
   - When a dedicated backend is added, it will be placed at the root level in `server/` with its own `package.json` and service entry point.
   - The domain logic, export renderers, and database operations currently housed in `web/src/server/` will be migrated into `server/src/`.

3. **Database Migration to PostgreSQL**:
   - The normalized SQLite schema in `docs/schema.sql` maps directly to PostgreSQL syntax (e.g. converting `INTEGER PRIMARY KEY AUTOINCREMENT` to `SERIAL PRIMARY KEY` or `BIGINT GENERATED ALWAYS AS IDENTITY`).
   - SQLite JSON columns (`technologies`, `tags`, `keywords`, `settings`, `data`, `snapshot`) map directly to native PostgreSQL `JSONB` columns, offering indexing and high-efficiency querying.
   - In-memory SQLite testing in `vitest` will transition to either testcontainers-based PostgreSQL containers or an isolated PostgreSQL test database schema.
