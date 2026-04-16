# NRCan Energy Factbook

Interactive web application for the Natural Resources Canada Energy Factbook (2025–2026 data).

## Project structure

```
NRCan_Energy_Factbook/
├── AGENTS.md                 # Stack, commands, and conventions for contributors / coding agents
├── docs/                     # Guides (pipeline, pages, glossary, Symphony setup, PDFs)
├── public/                   # Static assets served by Vite
│   └── data/                 # Website CSVs (data.csv, metadata.csv, …) — produced by the Python export
├── scripts/                  # Data pipeline (SQL Server → CSV). See scripts/README.md
├── src/                      # React app (Vite): pages, components, utils, assets
├── .github/workflows/        # CI (e.g. GitHub Pages deploy)
├── package.json              # npm scripts and frontend dependencies
├── vite.config.js
└── eslint.config.js
```

- **App routes and sections:** `src/App.jsx`, `src/components/Sidebar.jsx`, `SectionOne.jsx` … `SectionSix.jsx`.
- **Factbook pages:** `src/pages/` (dozens of `Page*.jsx` components).
- **Frontend data:** `src/utils/dataLoader.js` reads `public/data/data.csv` and `metadata.csv`.

## Prerequisites

- **Node.js** 18+ (for the Vite app)
- **Python 3.10+** and **SQL Server** with ODBC — only if you run the full **refresh/export pipeline** (`scripts/main.py`). The site can be developed against committed `public/data/*.csv` without a database.

## Web app (local)

```bash
npm ci
npm run dev
```

Other commands (see **`AGENTS.md`**):

```bash
npm run build   # production build — must pass before PR
npm run lint    # ESLint
```

## Data pipeline (optional)

The **canonical** path from sources to `public/data/` is:

1. Configure `scripts/config.yaml` and `scripts/.env` (copy from `scripts/.env.example`).
2. From the **`scripts/`** directory: `python main.py refresh …` then `python main.py export`, or `python main.py refresh --all --export-after`.

Details: **[`scripts/README.md`](./scripts/README.md)** (commands and layout), **[`docs/DATA_UPDATE_GUIDE.md`](./docs/DATA_UPDATE_GUIDE.md)** (quick steps), **[`docs/DATA_PIPELINE_GUIDE.md`](./docs/DATA_PIPELINE_GUIDE.md)** (architecture). Database naming and tables: **[`scripts/db/README.md`](./scripts/db/README.md)**.

A legacy StatCan helper module may exist as `scripts/data_retrieval.py` in some environments; section processors can import small helpers from it. It is **not** the primary entry point for refreshes — use **`main.py`**.

## Symphony + Linear + Codex (parallel agents)

Contributor conventions and stack commands: **[`AGENTS.md`](./AGENTS.md)**. Symphony / Linear workflow notes: **[`WORKFLOW.md`](./WORKFLOW.md)**. (Team-specific Symphony setup docs may live outside this repo.)

## Accessibility

The application targets WCAG 2.1 AA and Web Experience Toolkit (WET) patterns where applicable.

## License

Government of Canada
