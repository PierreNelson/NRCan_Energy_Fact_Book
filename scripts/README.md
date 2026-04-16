# NRCan Energy Factbook — data pipeline

Python CLI for fetching data into **SQL Server**, then exporting **`public/data/data.csv`**, **`metadata.csv`**, and related files for the Vite/React app.

Further reading: **[`db/README.md`](db/README.md)** (schema and table names), **[`../docs/DATA_PIPELINE_GUIDE.md`](../docs/DATA_PIPELINE_GUIDE.md)** (end-to-end design), **[`../docs/DATA_UPDATE_GUIDE.md`](../docs/DATA_UPDATE_GUIDE.md)** (operational updates).

## Layout

```
scripts/
├── main.py                    # CLI: refresh, export, list, test-connection
├── config.yaml                # Sections, sources, export paths, logging
├── config_loader.py           # Loads config; env overrides for DB
├── requirements.txt
├── .env.example               # Copy to .env for DB_* variables
├── data_retrieval.py          # Legacy StatCan/helper routines (optional; may be gitignored)
├── xlsx_paths.py              # Resolves paths to external XLSX inputs
├── export_glossary_html.py    # Glossary / data-gallery HTML (optional; see docs/GLOSSARY_UPDATE_GUIDE.md)
├── zip_website_release.py     # Zip app source + public/ for handoff (see "Release zips" below)
├── zip_data_release.py        # Zip public/data (incl. metadata.csv), public/glossary, translations.js
├── db/
│   ├── README.md              # Schema overview (authoritative for table names)
│   ├── setup_database.sql     # DDL (applied on refresh via ensure_schema)
│   ├── ensure_schema.py       # Runs idempotent batches from setup_database.sql
│   ├── eedas_registry.yaml    # source_key → physical source_table
│   ├── eedas_registry.py      # TABLE_* constants and registry helpers
│   ├── connection.py          # pyodbc connection wrapper
│   ├── models.py              # DataRepository — merge, upsert, export staging
│   ├── patch_setup_unified.py # One-off developer tool to regenerate DDL chunks (not used by refresh)
│   └── __init__.py
├── sections/
│   ├── base.py                # Base processor: store_raw_data, merge, logging
│   ├── section1_indicators.py # Key Indicators
│   ├── section2_investment.py # Investment
│   ├── section4_indicators.py # Energy Efficiency (OEE, residential, commercial, SEU)
│   └── section5_clean_power.py # Clean Power / environmental clean technology
├── export/
│   ├── website_files.py       # prepare_export_data + write data.csv / metadata.csv / major_projects_map.csv
│   └── source_vectors.py      # SOURCE_VECTOR_PREFIXES for `main.py list`
└── templates/
    └── data-gallery.html      # Template used by glossary export tooling
```

**Section registry** (`main.py`): `section1_indicators`, `section2_investment`, `section4_indicators`, `section5_clean_power`.  
`config.yaml` may also define **placeholders** `section3_skills` and `section6_oil_gas` (disabled by default).

## Release zips (station / dev test handoff)

Two stdlib Python helpers write timestamped archives under **`release/`** (gitignored). Run from the **repository root**:

**Full website** (React app + `public/` data and glossary assets — no Python pipeline, no `docs/`):

```bash
python scripts/zip_website_release.py
```

Produces `release/nrcan-energy-factbook-website-YYYYMMDD-HHMMSS.zip` containing `index.html`, `package.json`, `package-lock.json`, `vite.config.js`, `eslint.config.js`, optional `.env.example`, and the full **`src/`** and **`public/`** trees.

Recipients unzip at the project root, then:

```bash
npm ci
npm run build
```

**Data and text only** (CSV data, glossary files, English/French strings):

```bash
python scripts/zip_data_release.py
```

Produces `release/nrcan-energy-factbook-data-YYYYMMDD-HHMMSS.zip` with the full **`public/data/`** tree (including `data.csv`, **`metadata.csv`**, `major_projects_map.csv`), **`public/glossary/`**, and **`src/utils/translations.js`**. Unzip at the project root to overwrite those paths in an existing clone.

Optional: `--output-dir PATH` on either script to change the output directory.

## Prerequisites

1. **Python 3.10+**
2. **SQL Server** (e.g. Developer Edition) — [download](https://www.microsoft.com/en-us/sql-server/sql-server-downloads)
3. **ODBC Driver 17 or 18 for SQL Server** — [Microsoft docs](https://docs.microsoft.com/en-us/sql/connect/odbc/download-odbc-driver-for-sql-server)

## Setup

### 1. Install Python dependencies

```bash
cd scripts
python -m pip install -r requirements.txt
```

### 2. Create the database

Create an **empty** database whose name matches `config.yaml` / `.env` (default: `NRCanEnergyFactbook`).

### 3. Configure connection

```bash
cd scripts
cp .env.example .env
```

Edit `.env`:

```bash
DB_SERVER=localhost
DB_DATABASE=NRCanEnergyFactbook
DB_USERNAME=
DB_PASSWORD=
```

Leave `DB_USERNAME` / `DB_PASSWORD` empty for **Windows Authentication**. Do not commit secrets; `.env` is gitignored.

### 4. Test connection

```bash
python main.py test-connection
```

### 5. Schema and first refresh

On **`python main.py refresh …`**, the pipeline runs **`ensure_schema`** unless you pass **`--skip-ensure-schema`**. That applies `db/setup_database.sql` (skips `CREATE DATABASE`, destructive re-seed of `nrcan_fb_data_sources`, and standalone `USE` batches). If `nrcan_fb_data_sources` is empty, default rows are inserted.

Optional full manual run of the raw SQL file (creates DB / destructive seed if your copy includes those blocks): use SSMS or `sqlcmd` with `db/setup_database.sql`.

## Usage

### List sections and sources

```bash
python main.py list
```

### Refresh data

```bash
python main.py refresh --all
python main.py refresh --section section2_investment
python main.py refresh --source capital_expenditures
```

Refresh options:

| Flag | Meaning |
|------|---------|
| `--export-after` / `-e` | Run website CSV export after refresh |
| `--skip-ensure-schema` | Skip `setup_database.sql` batches (advanced) |

### Export only (from existing DB)

```bash
python main.py export
python main.py export --source capital_expenditures
python main.py export --vectors "cea_*"
```

Export writes under **`export.output_dir`** in `config.yaml` (default: **`../public/data`**): `data_csv`, `metadata_csv`, `major_projects_csv`.

## Configuration (`config.yaml`)

- **`database`**: server, database name, driver, timeouts (overridable via `DB_*` env vars).
- **`sections`**: each section has `enabled`, `name`, and **`sources`** with per-source `enabled`, `description`, and fetch keys (`statcan_table`, `file_path`, `source_url`, OEE paths, etc.).
- **`export`**: `output_dir`, `files` names for CSV outputs.
- **`logging`**: level and format.

Disable a section or source with `enabled: false` to skip it during `--all` refreshes.

## Data flow

```
Sources (StatCan, IEA, NRCan HTML/XLSX/API, …)
    → section processors → per-source series tables (see db/eedas_registry.yaml)
    → optional nrcan_fb_s1_*, nrcan_fb_s2_*, nrcan_fb_s4_* calc tables
    → nrcan_fb_export (staging)
    → public/data/data.csv, metadata.csv (+ major_projects_map.csv when applicable)
```

Website **`data.csv`** is built from **`nrcan_fb_export`**, which unions configured physical tables via `prepare_export_data()` in **`db/models.py`**.

## Troubleshooting

### Connection issues

1. SQL Server service is running.
2. Mixed Mode authentication if using SQL logins.
3. `python -c "import pyodbc; print(pyodbc.drivers())"` lists ODBC drivers.

### Missing or partial data

1. Source enabled in `config.yaml`.
2. `nrcan_fb_run_history` for errors.
3. For exports, run `python main.py export` after a successful refresh.

### Export problems

1. Confirm `nrcan_fb_export` has rows after refresh (`prepare_export_data` runs inside export).
2. Write permissions on `public/data/`.

## Adding a new data source

1. Add the source under the right **`sections.*.sources`** block in **`config.yaml`**.
2. Implement the handler in the matching **`sections/section*.py`** and register it in **`get_source_handlers()`** in **`base.py`** or the section class.
3. Add **`source_key`** → **`source_table`** in **`db/eedas_registry.yaml`**; add a **`CREATE TABLE`** for new physical names in **`db/setup_database.sql`**.
4. Refresh and export; update the frontend **`dataLoader.js`** / page as needed.
