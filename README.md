# Dossier

> A local-first career library, portfolio manager, and tailored resume engine.

**Dossier** lets you curate your professional profile, employment history, technical projects, education, and skills in a single, verified library. From this foundational record, you can rapidly build targeted resumes tailored to specific opportunities and export them with typography and layout fidelity in PDF and Word (`.docx`) formats.

---

## Repository Structure

The repository is organized to support independent frontend operations today while cleanly accommodating a future dedicated backend (`server/`) and PostgreSQL database without disruptive reorganization:

```
Dossier/
├── docs/                       # Project-wide documentation and system blueprints
│   ├── ARCHITECTURE.md         # Core architecture, pipeline specs & backend roadmap
│   ├── VERIFICATION.md         # Automated test evidence & verification results
│   └── schema.sql              # Normalized database schema
├── web/                        # Next.js 16 frontend application
│   ├── backups/                # Starter datasets and export backups
│   ├── public/                 # Static web assets
│   ├── scripts/                # Frontend smoke tests, E2E checks, and seeders
│   ├── src/
│   │   ├── app/                # App Router pages, global styling, API routes
│   │   ├── components/         # Design system (ui/), layout, and feature views
│   │   ├── lib/                # API client, schemas, domain types, matcher, render pipeline
│   │   ├── server/             # Local SQLite repository, export engines (PDF/DOCX)
│   │   └── proxy.ts            # Next.js 16 request guard (localhost security)
│   ├── tests/                  # Automated Vitest integration and unit tests
│   ├── package.json            # Web application dependencies and scripts
│   └── tsconfig.json           # Frontend TypeScript configuration
├── scripts/                    # Repository-level utility scripts
├── package.json                # Root package configuration with delegated task scripts
├── .gitignore                  # Monorepo-level gitignore
└── README.md                   # This project guide
```

---

## Quick Start

### Prerequisites

- **Node.js**: `v20.19.0` or later (`v22` LTS recommended)
- **npm**: `v10` or later

### Installation & Execution

You can run commands from the repository root:

```bash
# 1. Install frontend dependencies
cd web && npm install && cd ..

# 2. Run unit and integration tests
npm test

# 3. Build the frontend
npm run build

# 4. Start the application
npm start
```

For active local development with fast refresh:

```bash
npm run dev
```

The application is accessible at **http://localhost:3000**.

---

## Key Capabilities

1. **Structured Career Library**: Single source of truth for work experience, skills, certifications, and project accomplishments.
2. **Tailored Resumes**: Derive independent resumes with distinct ordering, wording tweaks, and template parameters without mutating library records.
3. **Hybrid Sync Strategy**: Flags library modifications in existing resumes with side-by-side diffing and review controls (*Keep Mine* vs. *Use Library Version*).
4. **Keyword Matching**: Deterministic, non-hallucinatory keyword analysis matching job requirements against recorded evidence and identifying gaps.
5. **Exact PDF & Word Exports**: Dual-engine rendering using `@react-pdf/renderer` and `docx` driven by a unified layout-ready document model (`ResumeDoc`).
6. **Local-First & Private**: Synchronous SQLite database (`data/dossier.db`) running entirely on `127.0.0.1` with DNS-rebinding protection and same-origin enforcement.

---

## Future Backend & PostgreSQL Roadmap

The repository is decoupled to support the future transition to a multi-tiered architecture:

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

- **Frontend Boundaries**: All client components communicate through a single typed API client (`web/src/lib/api.ts`). When a standalone backend is introduced, the frontend simply points its base request URL to the dedicated backend service without modifying UI components.
- **Backend Service (`server/`)**: A dedicated Node.js service (e.g. Express, Fastify, or NestJS) will reside in a new `server/` root directory, inheriting the schemas and export engines currently operating in `web/src/server/`.
- **Database Evolution**: The normalized database schema documented in `docs/schema.sql` translates directly to PostgreSQL table structures, foreign keys, and indexes.

For in-depth architectural details, see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## Available Root Commands

| Command | Action |
| ------- | ------ |
| `npm run dev` | Starts the `web/` development server on `127.0.0.1:3000` |
| `npm run build` | Compiles and builds the `web/` production application |
| `npm start` | Launches the built production server |
| `npm test` | Runs the Vitest test suite in `web/` |
| `npm run lint` | Runs ESLint on `web/` |
| `npm run typecheck` | Validates TypeScript types across `web/` |
| `npm run smoke` | Runs automated HTTP API smoke tests |
| `npm run seed:sample` | Populates the database with sample career records |
| `npm run format` | Formats all code using Prettier |
| `npm run format:check` | Verifies code formatting consistency |

---

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): System architecture, design decisions, data models, and backend evolution plans.
- [docs/VERIFICATION.md](docs/VERIFICATION.md): Verification test procedures, coverage details, and validation evidence.
- [docs/schema.sql](docs/schema.sql): Complete SQL database schema.
