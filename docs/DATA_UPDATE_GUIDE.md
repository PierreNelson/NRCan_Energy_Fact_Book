# Data Update Guide

Operator runbook for refreshing Energy Factbook data: fetching sources into SQL Server, building indicators, and exporting CSVs for the website.

**All commands in one place:** root [`README.md`](../README.md#command-reference-master-list). This guide adds workflows, prerequisites, and troubleshooting.

For **architecture and adding sources**, see [DATA_PIPELINE_GUIDE.md](DATA_PIPELINE_GUIDE.md). For **regenerating the glossary** (`public/glossary/`), see [GLOSSARY_UPDATE_GUIDE.md](GLOSSARY_UPDATE_GUIDE.md). For **CLI layout and folder structure**, see [`scripts/README.md`](../scripts/README.md).

---

## Introduction

The pipeline runs in **three separate stages**. Each stage is a distinct CLI command — export does **not** run automatically after update or transform.

| Stage | Command | What it does |
|-------|---------|--------------|
| 1. EEDAS update | `python main.py eedas update …` | Download/fetch source data; write **publisher-native** rows to EEDAS SQL tables |
| 2. EFB transform | `python main.py efb transform …` | Read raw SQL; aggregate to Factbook vectors; write **`nrcan_efb_indicators`** |
| 3. Export | `python main.py export` | Copy indicators to **`public/data/*.csv`** for the React app |

Run all three in order for a full website data publish.

---

## Prerequisites

Before running pipeline commands, ensure the following are in place.

### SQL Server and database

**What it means:** An empty SQL Server database (default name `NRCanEnergyFactbook`) holds all pipeline data between runs.

- Create the database in SSMS or `sqlcmd` — it can be empty.
- The first **`python main.py eedas update`** applies table DDL from [`scripts/db/setup_database.sql`](../scripts/db/setup_database.sql) and seeds `nrcan_fb_data_sources` only if that table is empty.

### Credentials (`.env`)

**What it means:** Python connects to SQL Server using settings in `scripts/.env`.

```bash
cd scripts
cp .env.example .env
```

Set `DB_SERVER`, `DB_DATABASE`, and optionally `DB_USERNAME` / `DB_PASSWORD`. Leave username/password empty for Windows Authentication.

### Python dependencies

**What it means:** Section handlers use pandas, pyodbc, requests, and other libraries listed in `requirements.txt`.

```bash
cd scripts
python -m pip install -r requirements.txt
```

### Local Excel workbooks

**What it means:** Some sources read proprietary or manual Excel files instead of (or in addition to) web downloads. These files are **not** in git.

Place workbooks in one folder and set **`EXTERNAL_XLSX_DATA_DIR`** in `scripts/.env`. If unset, scripts fall back to the **repository root** (local dev only — use a mounted path in CI).

| File | Used by |
|------|---------|
| `CEA_2023.xlsx` | Canadian Energy Assets |
| IEA World Energy Balances workbook | World energy production |
| ECCC GHG Annex CSV/XLSX | GHG emissions (also has web URL) |
| `EE Improvement.xlsx` | Section 4 residential/commercial/industrial |
| `Primary Energy Use Demand.xlsx` | Section 4 primary energy (page 48) |
| `SEU Final Demand.xlsx` | Section 4 SEU by fuel (page 49) |
| `tsx-and-amp-tsxv-listed-companies-2026-02-17-en.xlsx` | Section 5 cleantech (optional) |
| `Section 6.xlsx` | Section 6 gasoline prices (page 138) |

See [`scripts/xlsx_paths.py`](../scripts/xlsx_paths.py) for the full default filename list.

---

## Verify setup

**Test database connection:**

```bash
cd scripts
python main.py test-connection
```

**List sections and sources** (no database required):

```bash
python main.py list
```

---

## Full update workflow

Run from the **`scripts/`** directory:

```bash
python main.py eedas update --all
python main.py efb transform --all
python main.py export
```

| Stage only | When to use |
|------------|-------------|
| EEDAS update only | Source data changed; you will transform and export later |
| EFB transform only | Transform logic changed, or raw data already loaded |
| Export only | Indicators already in SQL; you need fresh CSVs for the website |

After a full run, spot-check `public/data/data.csv` row counts and open affected pages in the browser (`npm run dev` from repo root).

---

## Partial updates

You can scope each stage independently.

### By section

```bash
python main.py eedas update --section section2_indicators
python main.py efb transform --section section2_indicators
python main.py export
```

### By source (EEDAS) or indicator (EFB)

For a single source, the indicator key usually matches the `source_key`:

```bash
python main.py eedas update --source capital_expenditures
python main.py efb transform --indicator capital_expenditures
python main.py export --source capital_expenditures   # optional: export only that source's vectors
```

### Section CLI keys

| Section | CLI key |
|---------|---------|
| Key Indicators | `section1_indicators` |
| Investment | `section2_indicators` |
| Energy Efficiency | `section4_indicators` |
| Clean Power | `section5_indicators` |
| Oil, Gas and Coal | `section6_indicators` |

Section 3 (`section3_skills`) is not wired in the pipeline yet.

---

## Configuration toggles

Settings live in [`scripts/config.yaml`](../scripts/config.yaml). Each section and each source has an `enabled: true/false` flag.

| Level | `eedas update --all` | `eedas update --section` / `--source` |
|-------|----------------------|---------------------------------------|
| Section `enabled: false` | Section skipped entirely | Error: section not found or not enabled |
| Source `enabled: false` | That source skipped | Error: source disabled |

Typical reasons to disable:

- Upstream source is broken (URL or format change) while other sources still run
- Optional Excel workbook not yet on the machine
- Work-in-progress source not ready for website export

Disabled sources **do not remove** existing database rows or CSV rows. Stale vectors remain until the next successful update, transform, and export overwrites them.

The repo uses a **single** `config.yaml` (~250 lines). If it grows substantially, consider splitting into `scripts/config/sections/*.yaml` merged by [`config_loader.py`](../scripts/config_loader.py).

---

## Export options

Export reads **`nrcan_efb_indicators`** (via `prepare_export_data()`) and writes CSVs under `public/data/` (configurable in `config.yaml`).

```bash
python main.py export                              # All vectors
python main.py export --source capital_expenditures
python main.py export --vectors "capex_*"
python main.py export --restore-latest             # Restore CSVs from latest backup
python main.py export --list-backups
```

Selective exports **merge** matching vectors into existing `data.csv` / `metadata.csv` on disk so other vectors are preserved.

Before overwrite, files are backed up to `public/data/.backups/` when `export.backup_enabled` is true.

---

## Logs and status

Use terminal output, log files, and SQL audit together:

| Location | Contents |
|----------|----------|
| **Terminal stdout** | Live output during the run. Level from `config.yaml` → `logging.level` (default `INFO`). |
| **`scripts/logs/`** | Full run transcript. Filename: `{command}_{YYYYMMDD_HHMMSS}.log`. Path printed at startup. |
| **`scripts/logs/last_refresh_summary.json`** | Summary of the last pipeline run (legacy filename). |
| **`nrcan_fb_run_history` (SQL)** | Per-source audit: status, errors, row counts. Export runs appear as `website_export`. |

**After a run:**

1. Non-zero exit code means at least one source or indicator failed.
2. Open the log file in `scripts/logs/` for the full transcript.
3. Run `python main.py status --failed-only` (or query `nrcan_fb_run_history` in SSMS).

Log files are enabled by default (`logging.file.enabled: true`). Set `logging.file.enabled: false` to disable file output.

---

## Resilience

| Scenario | Behavior |
|----------|----------|
| StatCan/OEE transient outage | HTTP retries (`resilience.fetch_max_retries` / `fetch_retry_delay_seconds` in `config.yaml`) |
| SQL connection blip | DB connection retries (`database.max_retries`) |
| One source fails in EEDAS update | Other sources continue; CLI exit code `1`; fix before transform/export |
| Export interrupted | Pre-export backups in `public/data/.backups/`; `export --restore-latest` |

Config keys in [`scripts/config.yaml`](../scripts/config.yaml):

- `resilience.fetch_max_retries` / `resilience.fetch_retry_delay_seconds`
- `export.backup_enabled` / `export.backup_dir` / `export.keep_backups`

---

## Per-section source index

Page-level detail (getter → handler → files) lives in each section README. Use this table to find `source_key` values for partial updates.

| Section | Sources | Source map |
|---------|---------|------------|
| **1 — Key Indicators** | `economic_contributions`, `nominal_gdp`, `provincial_gdp`, `world_energy_production`, `canadian_energy_assets`, `ghg_emissions` | [`section1_indicators/README.md`](../scripts/sections/section1_indicators/README.md) |
| **2 — Investment** | `capital_expenditures`, `infrastructure`, `investment_by_asset`, `international_investment`, `foreign_control`, `environmental_protection`, `major_projects`, `major_projects_map`, `clean_tech` | [`section2_indicators/README.md`](../scripts/sections/section2_indicators/README.md) |
| **4 — Energy Efficiency** | `energy_use`, `seu_by_fuel`, `residential_daily_lives`, `residential_pie_charts`, `commercial_institutional`, `industrial_sector` | [`section4_indicators/README.md`](../scripts/sections/section4_indicators/README.md) |
| **5 — Clean Power** | `environmental_clean_tech`, `cleantech_companies_geo`, `cleantech_companies_industry`, `ev_sales` | [`section5_indicators/README.md`](../scripts/sections/section5_indicators/README.md) |
| **6 — Oil, Gas and Coal** | `rpp_supply_demand`, `rpp_refinery_input`, `crude_prices`, `oil_sands`, `canadian_production`, `kal_gas_prices`, `osm_refin_cap` | [`section6_indicators/README.md`](../scripts/sections/section6_indicators/README.md) |

**Cross-section sources:** `economic_contributions`, `canadian_energy_assets`, and `ghg_emissions` are owned by Section 1 but feed Section 2 and Section 6 pages — update them with `--source` on Section 1 keys.

---

## Typical workflows

**Monthly full publish:**

```bash
cd scripts
python main.py eedas update --all
python main.py efb transform --all
python main.py export
```

**Update Investment section only:**

```bash
cd scripts
python main.py eedas update --section section2_indicators
python main.py efb transform --section section2_indicators
python main.py export
```

**Single source (e.g. capital expenditures):**

```bash
cd scripts
python main.py eedas update --source capital_expenditures
python main.py efb transform --indicator capital_expenditures
python main.py export
```

**Regenerate glossary from SQL:**

```bash
cd scripts
python export_glossary_html.py
```

---

## Troubleshooting

### Connection failed

```bash
python main.py test-connection
```

Check `scripts/.env` for correct `DB_SERVER`, `DB_DATABASE`, and credentials. Confirm SQL Server is running and ODBC Driver 17 or 18 is installed.

### Source not found or disabled

```bash
python main.py list
```

Verify the source is `enabled: true` in `config.yaml`.

### Data not appearing on the website

1. Confirm you ran **export** after transform.
2. Confirm the page's vector prefix exists in `public/data/data.csv`.
3. Run `python main.py status --failed-only` for failed handlers.

### StatCan timeout

Some StatCan queries are slow. Retry the individual source:

```bash
python main.py eedas update --source capital_expenditures
python main.py efb transform --indicator capital_expenditures
python main.py export
```

### Section 4 Excel missing

If a handler logs "file not found", set `EXTERNAL_XLSX_DATA_DIR` or place the workbook at the repo root. See the Section 4 source map for which file each page needs.

For DevOps setup (ODBC, secrets, scheduled runs, release zips), see [EFB_MODERNIZATION_REVIEW.md §7](EFB_MODERNIZATION_REVIEW.md#7-sql-and-database-refresh-environment) and [DEPLOYMENT.md](DEPLOYMENT.md).

---

## Command cheat sheet

All commands run from **`scripts/`**:

```bash
# === FULL PUBLISH ===
python main.py eedas update --all
python main.py efb transform --all
python main.py export

# === BY SECTION ===
python main.py eedas update --section section2_indicators
python main.py efb transform --section section2_indicators

# === BY SOURCE / INDICATOR ===
python main.py eedas update --source capital_expenditures
python main.py efb transform --indicator capital_expenditures

# === EXPORT ===
python main.py export
python main.py export --source capital_expenditures
python main.py export --vectors "capex_*"
python main.py export --restore-latest
python main.py export --list-backups

# === UTILITIES ===
python main.py list
python main.py test-connection
python main.py status
python main.py status --failed-only
python export_glossary_html.py
```
