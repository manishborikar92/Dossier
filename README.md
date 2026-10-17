# Intelligent Resume Builder

An interactive terminal application that scans local software projects, evaluates their technical depth and impact using transparent heuristics, and builds tailored, ATS-compliant resumes in **DOCX** and **PDF** formats.

---

## 🔒 Privacy & Local Execution Guarantees

- **100% Local & Offline**: All project analysis, tokenization, heuristic scoring, and document generation run locally on your machine. No source code or personal data is transmitted to external cloud APIs or language models.
- **Strictly Read-Only Scanning**: The project scanner traverses `C:\Users\manis\Projects` in read-only mode and never modifies, moves, or deletes any files outside of `Resume-Builder`.
- **Git Exclusions**: Personal contact information (`config/profile.json`), local analysis caches (`data/catalog.json`), and generated deliverables (`output/*.docx`, `output/*.pdf`) are excluded from version control via `.gitignore`.

---

## 📁 Project Directory Structure

```
C:\Users\manis\Projects\Resume-Builder\
├── package.json                   # Dependencies (@clack/prompts, docx, picocolors)
├── .gitignore                     # Excludes personal profile data, cache, and output files
├── README.md                      # Project setup, configuration, and architecture guide
├── config/
│   ├── profile.example.json       # Safe template for version control
│   ├── profile.json               # Local verified profile (git-ignored)
│   ├── ranking-weights.json       # Configurable 7-dimension scoring weights and role presets
│   └── settings.json              # Paths, ignore rules, unit conventions, and page budgets
├── src/                           # Application source code (Phases 2–5)
├── templates/
│   └── docx-styles.js             # Reusable Word document styling & paragraph helpers
├── data/                          # Cached project fingerprints & catalog (git-ignored)
└── output/                        # Generated DOCX and PDF resume deliverables (git-ignored)
```

---

## ⚙️ Configuration Guide

### 1. Personal Profile (`config/profile.json`)
The application loads your contact details, education, professional experience, certifications, and skills from `config/profile.json`.
- A safe placeholder template is provided at `config/profile.example.json`.
- Customize `config/profile.json` with your real details. This file is git-ignored.

### 2. Ranking Weights & Presets (`config/ranking-weights.json`)
Defines the 7 evaluation dimensions (Technical Depth, Real-World Impact, Engineering Quality, Breadth of Skills, Architectural Uniqueness, Production Readiness, Storytelling Potential) and role presets (`general`, `fullstack`, `backend`, `ai_ml_data`, `systems_3d`).

### 3. Application Settings (`config/settings.json`)
Configures filesystem scanning roots, directory exclusion lists, sensitive file patterns, Microsoft Edge paths for PDF export, and page-budget parameters.

---

## 📐 Unit Conventions & ATS Layout Standards

In the `docx` library:
- **Font Sizes**: Measured in **half-points** (`20` = 10 pt, `22` = 11 pt, `36` = 18 pt).
- **Paragraph Spacing**: Measured in **twips** / twentieths of a point (`20 twips` = 1 pt, `1440 twips` = 1 in).
- **Page Margins**: `720 twips` (0.50 in) for 1-Page Compact; `1080 twips` (0.75 in) for 2-Page Extended.

---

## 🚀 Setup & Usage

Ensure Node.js (>= 20) and npm are installed:

```bash
# Navigate to the project directory
cd C:\Users\manis\Projects\Resume-Builder

# Install required dependencies
npm install

# Run automated test suites (56 tests across 4 phases)
npm test

# Run project discovery and catalog refresh standalone
npm run scan

# Launch the interactive terminal CLI wizard
npm start
# or: npm run cli
# Force rescan with: npm start -- --refresh
```

---

## 🧭 Interactive Terminal CLI Workflow (Phase 4)

The application provides an interactive wizard powered by `@clack/prompts`:

1. **Target Role Selection**: Select from pre-configured engineering presets (`Full-Stack Engineer`, `Backend & Distributed Systems`, `AI / ML & Data Engineering`, `Systems & 3D Graphics`, `General-Purpose Software Developer`) or define a custom target title.
2. **Optional Job Description (JD)**: Paste an active job posting for semantic token matching ($S_{tech}$, $S_{context}$, $S_{relevance}$), or skip. Uninformative prose gracefully defaults without penalizing scores.
3. **Resume Format Budget**: Choose between **1-Page Compact** (max 2 projects, concise bullets) and **2-Page Extended** (max 4 projects, expanded bullets and sections).
4. **Project Ranking & Inspection**: View the ASCII project table with selection markers, composite scores, deployment status badges (`Live Deployed`, `Desktop Pkg`, `Protocol SDK`, `Container Infrastructure`), technology tags, and scan coverage %. Inspect detailed 7-factor cards.
5. **Selection & Reordering**: Select, deselect, and customize project display order to curate the strongest portfolio narrative.
6. **Bullet Point Review & Claim Confirmation**: Tailor bullet descriptions and confirm or exclude unverified metrics.
7. **Profile & Contact Review**: Inspect and optionally adjust headline, contact channels, or section visibility in memory. Edits only persist to `config/profile.json` upon explicit confirmation.
8. **In-Terminal ASCII Preview & Approval**: Review full resume layout in the terminal before export approval.

---

## 🗺️ Phased Development Roadmap

- **Phase 1: Scaffolding & Configuration** *(Completed & Verified)*: Project structure, dependency manifests, `.gitignore`, profile templates, ranking configurations, styling helpers, and 8 passing tests.
- **Phase 2: Discovery & Change Detection** *(Completed & Verified)*: Filesystem scanner, monorepo/sub-module boundary detection, two-tier content-based fingerprint caching (Git + non-Git), 4-way orthogonal status classification, catalog reconciliation, and 20 passing tests.
- **Phase 3: Scoring & Role Weighting Engine** *(Completed & Validated)*: 7-factor scoring engine (100 raw pts), normalized role weights, grounded evidence scoring, safe JD keyword matcher with prose fallback ($\alpha_{eff} = 0$), and 16 passing tests.
- **Phase 4: Interactive CLI Experience** *(Completed & Validated)*: Terminal UI using `@clack/prompts`, session state machine, budget enforcement, claim confirmation, ASCII resume preview, and 12 passing tests (56 total tests).
- **Phase 5: Dual Export Pipeline & Verification** *(Pending Authorization)*: DOCX generation, zero-dependency headless Microsoft Edge PDF generation, and ATS text extraction testing.
