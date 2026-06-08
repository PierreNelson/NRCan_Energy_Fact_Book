# NRCan Energy Factbook — data pipeline

Python CLI that fetches energy data from StatCan, NRCan, IEA, and other sources into **SQL Server**, then exports **`public/data/data.csv`**, **`metadata.csv`**, and related files for the Vite/React website.

**Full command list:** root **[`README.md`](../README.md#command-reference-master-list)** (npm, pipeline, glossary, release). This file covers setup, layout, and troubleshooting in more detail.

Further reading: **[`db/README.md`](db/README.md)** (schema), **[`../docs/DATA_UPDATE_GUIDE.md`](../docs/DATA_UPDATE_GUIDE.md)** (operator runbook), **[`../docs/DATA_PIPELINE_GUIDE.md`](../docs/DATA_PIPELINE_GUIDE.md)** (developer architecture).

## Layout

This folder is the pipeline entry point. Each subfolder has a focused role:

```
scripts/
├── main.py                    # CLI: eedas update, efb transform, export, status, list
├── eedas/                     # Stage 1 — raw ingest orchestration
├── efb/                       # Stage 2 — indicator transform orchestration
├── config.yaml                # Sections, sources, export paths, logging
├── config_loader.py           # Loads config; env overrides for DB
├── requirements.txt
├── .env.example               # Copy to .env for DB_* and EXTERNAL_XLSX_DATA_DIR
├── xlsx_paths.py              # Resolves paths to external Excel workbooks
├── export_glossary_html.py    # Glossary / data-gallery HTML (see docs/GLOSSARY_UPDATE_GUIDE.md)
├── zip_website_release.py     # npm run build + deploy zip (see Release zips)
├── zip_data_release.py        # Zip public/data, glossary, translations.js
├── db/                        # Schema DDL, registries, DataRepository
├── sections/                  # Per-section update_* and transform_* handlers
├── export/                    # website_files.py, source_vectors.py
└── templates/
    └── data-gallery.html
```

| Folder | Role |
|--------|------|
| **`eedas/`** | Runs `update_*` handlers — fetch sources, write publisher-native rows to EEDAS series tables |
| **`efb/`** | Runs `transform_*` handlers — read raw SQL, aggregate, write `nrcan_efb_indicators` |
| **`sections/`** | One package per Factbook section; each source has paired update and transform modules |
| **`db/`** | SQL schema, `eedas_registry.yaml`, `efb_indicators_registry.yaml`, connection and repository code |
| **`export/`** | Copies indicators to `nrcan_fb_export` staging, writes CSV files under `public/data/` |

**Section registry** (`main.py`): `section1_indicators`, `section2_indicators`, `section4_indicators`, `section5_indicators`, `section6_indicators`.  
`config.yaml` may also define a **placeholder** `section3_skills` (disabled by default).

## Release zips (station / dev test handoff)

Two stdlib Python helpers write timestamped archives under **`release/`** (gitignored). Run from the **repository root**. Client deployment details: **[`../docs/DEPLOYMENT.md`](../docs/DEPLOYMENT.md)**.

**Website deploy zip** (static hosting only — **Node.js** only on the machine that *creates* the zip):

```bash
python scripts/zip_website_release.py
```

This runs **`npm run build`**, then produces `release/nrcan-energy-factbook-website-YYYYMMDD-HHMMSS.zip` containing **`DEPLOYMENT.md`** and the **contents of `dist/`** at the zip root (`index.html`, `assets/`, `data/`, `glossary/`, …). No `src/`, `public/`, or `package.json`.

**Optional full handoff** (large archive for developers who need to rebuild):

```bash
python scripts/zip_website_release.py --full
```

Pack an existing **`dist/`** without running npm:

```bash
python scripts/zip_website_release.py --skip-build
```

**Data and text only** (CSV data, glossary files, `translations.js`):

```bash
python scripts/zip_data_release.py
```

Produces `release/nrcan-energy-factbook-data-YYYYMMDD-HHMMSS.zip` with **`public/data/`**, **`public/glossary/`**, and **`src/utils/translations.js`**. On a server deployed from the default website zip, copy files into flat **`data/`** and **`glossary/`** next to `index.html`. Translation changes require a new **`npm run build`** — see **`docs/DEPLOYMENT.md`**.

Optional: `--output-dir PATH` on either script to change the output directory.

## Prerequisites

You need all three when running the full pipeline locally:

| Requirement | Why |
|-------------|-----|
| **Python 3.10+** | Runs `main.py` and section handlers |
| **SQL Server** (e.g. Developer Edition) — [download](https://www.microsoft.com/en-us/sql-server/sql-server-downloads) | Stores EEDAS raw tables and EFB indicators before CSV export |
| **ODBC Driver 17 or 18 for SQL Server** — [Microsoft docs](https://docs.microsoft.com/en-us/sql/connect/odbc/download-odbc-driver-for-sql-server) | How Python (`pyodbc`) connects to SQL Server |

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
EXTERNAL_XLSX_DATA_DIR=C:\path\to\excel-workbooks
```

### 4. Test connection

```bash
python main.py test-connection
```

### 5. Schema and first run

The first **`python main.py eedas update …`** applies table DDL from **`db/setup_database.sql`** via **`ensure_schema`**, unless you pass **`--skip-ensure-schema`**.

### Three-stage workflow

```bash
python main.py eedas update --all      # 1. Load raw source data into EEDAS
python main.py efb transform --all     # 2. Build Factbook indicators
python main.py export                  # 3. Write website CSVs
```

## Usage

All commands run from the **`scripts/`** directory.

### List sections and sources

```bash
python main.py list
```

Shows enabled sections and sources from `config.yaml`. Does not require a database connection.

### EEDAS update (raw ingest)

Fetches from StatCan, Excel, HTML, APIs and writes **source-native** rows to EEDAS series tables (`stc_*`, `nrcan_*`, `iea_*`).

```bash
python main.py eedas update --all
python main.py eedas update --section section2_indicators
python main.py eedas update --source capital_expenditures
```

### EFB transform (indicators)

Reads raw EEDAS tables, applies Factbook aggregation rules, writes semantic vectors to **`nrcan_efb_indicators`**.

```bash
python main.py efb transform --all
python main.py efb transform --section section2_indicators
python main.py efb transform --indicator capital_expenditures
```

### Export (website CSVs)

Copies indicators from SQL to `public/data/`. Does not fetch from external sources.

```bash
python main.py export
python main.py export --source capital_expenditures
python main.py export --vectors "capex_*"
python main.py export --restore-latest
python main.py export --list-backups
```

Export writes under **`export.output_dir`** in `config.yaml` (default: **`../public/data`**): `data_csv`, `metadata_csv`, `major_projects_csv`. Before overwrite, files are backed up to **`export.backup_dir`** (default: `public/data/.backups/`).

### Pipeline status

```bash
python main.py status
python main.py status --failed-only
python main.py status --hours 48
```

## Configuration (`config.yaml`)

`config.yaml` controls which sections and sources run, where files are fetched from, and where CSVs are written.

- **`database`**: server, database name, driver, timeouts (overridable via `DB_*` env vars).
- **`sections`**: each section has `enabled`, `name`, and **`sources`** with per-source `enabled`, `description`, and fetch keys (`statcan_table`, `file_path`, `source_url`, OEE paths, etc.).
- **`export`**: `output_dir`, `files` names for CSV outputs, `backup_enabled`, `backup_dir`, `keep_backups`.
- **`resilience`**: `fetch_max_retries`, `fetch_retry_delay_seconds` for StatCan HTTP fetches.
- **`logging`**: level, format, and **`file`** (`enabled`, `directory` under `scripts/`). Each CLI run writes **`scripts/logs/{command}_{timestamp}.log`**.

Disable a section or source with `enabled: false` to skip it during **`eedas update --all`**. Disabled sources do not remove existing database or CSV rows until the next successful update, transform, and export.

## Data flow

```
External sources (StatCan, IEA, NRCan HTML/XLSX/API, local Excel)
    → eedas update (update_* handlers)
    → EEDAS series tables (stc_*, nrcan_*, iea_*)
    → efb transform (transform_* handlers)
    → nrcan_efb_indicators
    → prepare_export_data() → nrcan_fb_export (staging)
    → export → public/data/data.csv, metadata.csv, major_projects_map.csv
    → React app (dataLoader.js)
```

Website **`data.csv`** is built from **`nrcan_efb_indicators`** via **`prepare_export_data()`** in **`db/models.py`**, then written by **`export/website_files.py`**.

## Troubleshooting

### Connection issues

1. Confirm SQL Server service is running.
2. Enable Mixed Mode authentication if using SQL logins.
3. List ODBC drivers: `python -c "import pyodbc; print(pyodbc.drivers())"`.

### Missing or partial data

1. Source enabled in `config.yaml`.
2. Run all three stages — export alone does not fetch new data.
3. `python main.py status --failed-only` for recent failures (or query `nrcan_fb_run_history`).
4. Latest **`scripts/logs/`** log file for the run (path printed at startup).

### Export problems

1. Confirm **`nrcan_efb_indicators`** has rows after transform (`prepare_export_data` runs inside export).
2. Write permissions on `public/data/`.
3. Check `public/data/.backups/` for pre-export copies; `python main.py export --list-backups`.
4. Review `scripts/logs/last_refresh_summary.json` after pipeline runs.

## Adding a new data source

1. Add the source under the right **`sections.*.sources`** block in **`config.yaml`**.
2. Register **`source_key` → `source_table`** in **`db/eedas_registry.yaml`**; add DDL in **`db/setup_database.sql`** if the table is new.
3. Implement **`update_*`** in the matching section folder — fetch data, write publisher-native rows via **`replace_raw_data`** / **`store_publisher_rows`**.
4. Register the indicator in **`db/efb_indicators_registry.yaml`**; implement **`transform_*`** — read raw with **`get_raw_dataframe`**, aggregate, call **`store_indicators`**.
5. Add vector prefix in **`export/source_vectors.py`** and a getter in **`src/utils/dataLoader.js`**.
6. Run all three stages for the new source; update the relevant page component.

See **[`../docs/DATA_PIPELINE_GUIDE.md`](../docs/DATA_PIPELINE_GUIDE.md)** for handler patterns and fetch examples.
