# Dossier Web Application

A local-first career library and tailored resume engine built with Next.js 16, React 19, and Tailwind CSS 4. Record your profile, experience, education, skills, and projects **once**, then construct independent, tailored resumes from them and export as clean, professional PDFs or editable Word (.docx) documents.

All data runs locally on your machine with SQLite storage; nothing is transmitted to external servers.

## Features

- **Profile**: Identity, contact links, and custom executive summaries.
- **Career Library**: Roles, achievements, education, technical skills, and certifications.
- **Project Catalog**: Comprehensive project inventory (overview, challenges, solutions, technical stack, verified metrics, links, and resume-ready bullets). Supports single-click import of `project_knowledge_base.json`.
- **Tailored Resumes**: Independent resume documents with custom section order, template styling, density settings, and point-in-time version history.
- **Live Vector Preview**: In-browser rendering powered by pdf.js showing exact page geometry, margins, and breaks identical to the exported artifact.
- **Job Matching (Deterministic)**: Ranks portfolio projects against job descriptions and identifies requirement coverage and gaps without artificial hallucinations.
- **Verification Audit**: Tracks unverified bullets with pre-export review confirmations.
- **Backup & Restore**: Portable JSON snapshots containing full library state, resumes, and immutable versions.

## Prerequisites

- **Node.js 20.9 or newer** (Node 22 LTS recommended) and npm.
- Windows, macOS, or Linux.

## Getting Started

From this directory (`web/`):

```bash
# 1. Install dependencies
npm install

# 2. Build for production
npm run build

# 3. Start the application
npm start
```

Or run the development server with hot reloading:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). To specify another port: `npm start -- -p 3001`.

The application binds to `127.0.0.1` by default and enforces same-origin security via Next.js Proxy (`src/proxy.ts`).

### Restoring Your Data

1. Navigate to **Settings & backup → Restore from a backup file** and select your Dossier backup (e.g. `backups/manish-dossier-data.json`).
2. Navigate to **Projects → Import knowledge base** and select `backups/project_knowledge_base.json`.
3. Navigate to **Resumes → New resume** to generate a targeted document.

For demo or testing purposes with a dedicated database:

```bash
DATA_DIR=./data-demo npm run seed:sample
DATA_DIR=./data-demo npm start
```

## Data Storage

| Item                     | Location                                                        |
| ------------------------ | --------------------------------------------------------------- |
| SQLite Database          | `data/dossier.db` (or legacy `data/vault.db` if present)        |
| Automatic Safety Backups | `data/backups/` (created prior to migrations and data restores) |

To customize the storage directory, set `DATA_DIR` in your environment or `.env` file.

## Available Scripts

| Command               | Description                                              |
| --------------------- | -------------------------------------------------------- |
| `npm run dev`         | Starts local Next.js development server                  |
| `npm run build`       | Produces optimized Next.js production build              |
| `npm start`           | Runs built production server                             |
| `npm test`            | Executes unit and integration test suite via Vitest      |
| `npm run lint`        | Runs ESLint analysis                                     |
| `npm run typecheck`   | Validates TypeScript types                               |
| `npm run smoke`       | Runs end-to-end API smoke tests against a running server |
| `npm run e2e`         | Executes Playwright browser automation suite             |
| `npm run seed:sample` | Populates database with sample test records              |

## Directory Layout

```
web/
├── backups/             Seed and sample data files
├── public/              Static web assets
├── scripts/             Test and seeding automation (smoke, e2e, seed)
├── src/
│   ├── app/             Next.js 16 App Router (pages, layouts, route handlers)
│   ├── components/      Modular React components (ui/, layout/, feature modules)
│   ├── lib/             Shared domain logic, types, schemas, API client, formatting
│   ├── server/          SQLite repository, migrations, export engines (PDF, DOCX)
│   └── proxy.ts         Next.js 16 request interception and localhost enforcement
└── tests/               Unit and integration test suites
```

See [../docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md) for architectural notes and [../docs/schema.sql](../docs/schema.sql) for schema details.
