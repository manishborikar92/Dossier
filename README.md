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

## 🚀 Setup & Installation

Ensure Node.js (>= 20) and npm are installed:

```bash
# Navigate to the project directory
cd C:\Users\manis\Projects\Resume-Builder

# Install required dependencies
npm install

# Validate configuration files
npm run lint
```

---

## 🗺️ Phased Development Roadmap

- **Phase 1: Scaffolding & Configuration** *(Current)*: Project structure, dependency manifests, `.gitignore`, profile templates, ranking configurations, styling helpers, and Phase 1 checks.
- **Phase 2: Discovery & Change Detection**: Filesystem scanner, monorepo/sub-module boundary detection, and two-tier fingerprint caching (`git rev-parse HEAD` + manifest hashing).
- **Phase 3: Scoring & Role Weighting Engine**: 7-factor scoring engine, normalized role weights, and deterministic JD keyword overlap matcher.
- **Phase 4: Interactive CLI Experience**: Step-by-step terminal UI using `@clack/prompts`, metric confirmation, and in-terminal layout preview.
- **Phase 5: Dual Export Pipeline & Verification**: DOCX generation, zero-dependency headless Microsoft Edge PDF generation, and ATS text extraction testing.
