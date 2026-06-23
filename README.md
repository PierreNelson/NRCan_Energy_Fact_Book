# NRCan Energy Factbook

Interactive web application for the Natural Resources Canada Energy Factbook (2025–2026 data). The repository contains a **React/Vite website** and an optional **Python data pipeline** that loads source data into SQL Server and exports CSVs for the site.

## Two ways to work

| Mode | What you need | What you do |
|------|---------------|-------------|
| **Frontend only** | Node.js 18+ | Use committed CSVs in `public/data/`; run the dev server and edit pages in `src/`. No database required. |
| **Full data refresh** | Node.js, Python 3.10+, SQL Server, ODBC driver, local Excel workbooks | Run the three-stage pipeline in `scripts/` to fetch sources, build indicators, and export CSVs. |

## Project structure

```
NRCan_Energy_Factbook/
├── AGENTS.md                 # Stack, commands, and conventions for contributors
├── docs/                     # Guides — start at docs/README.md
├── public/                   # Static assets served by Vite
│   └── data/                 # Website CSVs (data.csv, metadata.csv, …) — produced by export
├── scripts/                  # Data pipeline (SQL Server → CSV). See scripts/README.md
├── src/                      # React app: pages, components, utils, assets
├── .github/workflows/        # CI (e.g. GitHub Pages deploy)
├── package.json
├── vite.config.js
└── eslint.config.js
```

- **App routes and sections:** `src/App.jsx`, `src/components/Sidebar.jsx`, `SectionOne.jsx` … `SectionSix.jsx`.
- **Factbook pages:** `src/pages/` (dozens of `Page*.jsx` components).
- **Frontend data:** `src/utils/dataLoader.js` reads `public/data/data.csv` and `metadata.csv`.

## Prerequisites (explained)

| Requirement | Why it matters |
|-------------|----------------|
| **Node.js 18+** | Builds and runs the Vite/React website (`npm ci`, `npm run dev`, `npm run build`). |
| **Python 3.10+** | Runs the data pipeline CLI in `scripts/` (only if you refresh data yourself). |
| **SQL Server** | Stores raw source data (EEDAS) and Factbook indicators before CSV export. |
| **ODBC Driver 17 or 18** | Lets Python (`pyodbc`) connect to SQL Server. |
| **`EXTERNAL_XLSX_DATA_DIR`** (optional) | Folder path for local Excel workbooks (CEA, IEA, ECCC, OEE demand files, etc.) that are not fetched from the web. Set in `scripts/.env`. |

## Command reference (master list)

All commands used in this repository. Run **npm** commands from the **repository root**; run **`python main.py`** from **`scripts/`** unless noted.

### Web app (Node.js)

| Command | Purpose |
|---------|---------|
| `npm ci` | Clean install of frontend dependencies (fresh clones / CI) |
| `npm run dev` | Local dev server with hot reload |
| `npm run build` | Production build to `dist/` — must pass before PR |
| `npm run lint` | ESLint on `src/` |
| `npm run preview` | Serve the production build locally (after `npm run build`) |

The dev server uses committed CSVs in `public/data/`. No Python or SQL Server required for frontend-only work.

### Data pipeline — full publish

Run all three stages in order from **`scripts/`**:

```bash
cd scripts
python main.py eedas update --all    # 1. Fetch and load source-native data into SQL
python main.py efb transform --all   # 2. Aggregate into Factbook indicators
python main.py export                # 3. Write public/data/*.csv
```

Configure `scripts/config.yaml` and `scripts/.env` (copy from `scripts/.env.example`) before the first run.

### Data pipeline — `main.py` commands

Global option (any subcommand): `--config PATH` / `-c PATH` — alternate `config.yaml`.

| Command | Purpose |
|---------|---------|
| **EEDAS update** | |
| `python main.py eedas update --all` | Update every enabled source in every enabled section |
| `python main.py eedas update --section SECTION` | Update all sources in one section (e.g. `section2_indicators`) |
| `python main.py eedas update --source SOURCE` | Update one source by key (e.g. `capital_expenditures`) |
| `python main.py eedas update … --skip-ensure-schema` | Skip applying DDL from `setup_database.sql` |
| **EFB transform** | |
| `python main.py efb transform --all` | Transform all indicators (dependency order) |
| `python main.py efb transform --section SECTION` | Transform all indicators in one section |
| `python main.py efb transform --indicator KEY` | Transform one indicator (usually same as `source_key`) |
| `python main.py efb transform … --skip-ensure-schema` | Skip schema ensure step |
| **Export** | |
| `python main.py export` | Export all vectors to `public/data/*.csv` |
| `python main.py export --source SOURCE` | Export vectors for one source only (merges into existing CSVs) |
| `python main.py export --vectors "PATTERN"` | Export vectors matching glob (e.g. `"capex_*"`) |
| `python main.py export --restore-latest` | Restore CSVs from latest backup in `public/data/.backups/` |
| `python main.py export --list-backups` | List available CSV backups |
| **Utilities** | |
| `python main.py list` | List enabled sections and sources (no DB required) |
| `python main.py test-connection` | Test SQL Server connection |
| `python main.py status` | Recent run history (default: last 24 hours) |
| `python main.py status --failed-only` | Show failed runs only |
| `python main.py status --hours N` | Look back N hours |

**Section CLI keys:** `section1_indicators`, `section2_indicators`, `section4_indicators`, `section5_indicators`, `section6_indicators`. Source keys: run `python main.py list` or see [`docs/DATA_UPDATE_GUIDE.md`](./docs/DATA_UPDATE_GUIDE.md).

### Glossary export

From **`scripts/`** (or pass full path from repo root):

| Command | Purpose |
|---------|---------|
| `python export_glossary_html.py` | Regenerate `public/glossary/` from SQL |
| `python export_glossary_html.py --out DIR` | Write glossary CSVs and viewer to `DIR` |
| `python export_glossary_html.py --skip-prepare-export` | Skip rebuilding export staging table first |
| `python export_glossary_html.py --seed-from-public` | Build glossary from `public/data/` only (no SQL) |

See [`docs/GLOSSARY_UPDATE_GUIDE.md`](./docs/GLOSSARY_UPDATE_GUIDE.md).

### Release packaging

From the **repository root**:

| Command | Purpose |
|---------|---------|
| `python scripts/zip_website_release.py` | `npm run build` + zip deployable `dist/` + `DEPLOYMENT.md` → `release/` |
| `python scripts/zip_website_release.py --full` | Larger zip with `src/`, `public/`, `package.json`, etc. |
| `python scripts/zip_website_release.py --skip-build` | Zip existing `dist/` without running npm |
| `python scripts/zip_website_release.py --output-dir PATH` | Change output directory (default: `release/`) |
| `python scripts/zip_data_release.py` | Zip `public/data/`, `public/glossary/`, `translations.js` |
| `python scripts/zip_data_release.py --output-dir PATH` | Change output directory |

See [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md).

### Typical workflows

| Goal | Commands |
|------|----------|
| Develop a page locally | `npm ci` → `npm run dev` |
| Full data refresh | `eedas update --all` → `efb transform --all` → `export` (from `scripts/`) |
| One source only | `eedas update --source KEY` → `efb transform --indicator KEY` → `export` |
| One section only | `eedas update --section …` → `efb transform --section …` → `export` |
| Ship static site | `python scripts/zip_website_release.py` |
| Ship data overlay only | `python scripts/zip_data_release.py` |

Operational details: **[`docs/DATA_UPDATE_GUIDE.md`](./docs/DATA_UPDATE_GUIDE.md)**. Architecture: **[`docs/DATA_PIPELINE_GUIDE.md`](./docs/DATA_PIPELINE_GUIDE.md)**.

## Documentation map

| Guide | Audience | Purpose |
|-------|----------|---------|
| **[`docs/README.md`](./docs/README.md)** | Everyone | Index — which guide to read when |
| **[`scripts/README.md`](./scripts/README.md)** | Pipeline operators | CLI layout, setup, commands, troubleshooting |
| **[`docs/DATA_UPDATE_GUIDE.md`](./docs/DATA_UPDATE_GUIDE.md)** | Operators | Day-to-day data refresh runbook |
| **[`docs/DATA_PIPELINE_GUIDE.md`](./docs/DATA_PIPELINE_GUIDE.md)** | Developers | Architecture, adding sources, handler patterns |
| **[`docs/PAGE_CREATION_GUIDE.md`](./docs/PAGE_CREATION_GUIDE.md)** | Frontend devs | Building and wiring new pages |
| **[`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md)** | Hosting / release | Static deploy, zips, Azure CI |
| **[`docs/GLOSSARY_UPDATE_GUIDE.md`](./docs/GLOSSARY_UPDATE_GUIDE.md)** | Operators | Regenerate `public/glossary/` |
| **[`AGENTS.md`](./AGENTS.md)**  Stack, commands, repo conventions |

## Static deployment

Hosting the production build, URL base path, nginx/IIS, and data-only zip overlays: **[`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md)**. Release packaging: **`scripts/zip_website_release.py`** and **`scripts/zip_data_release.py`**.

