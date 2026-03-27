# Glossary Update Guide

This guide explains how to **regenerate the data glossary**: the CSV bundles under `public/glossary/` and the standalone viewer `data-gallery.html`. The React app’s **Glossary** route opens that HTML viewer (or an override URL), so updating the glossary is a separate step from refreshing pipeline data or exporting `data.csv`.

For **refreshing SQL data and `public/data/*.csv`**, see [DATA_UPDATE_GUIDE.md](DATA_UPDATE_GUIDE.md). For **how data flows from sources into SQL and export tables**, see [DATA_PIPELINE_GUIDE.md](DATA_PIPELINE_GUIDE.md).

---

## Prerequisites

1. **SQL Server** running with the `NRCanEnergyFactbook` database on the **EEDAS-style schema** (per-source ingest tables, `nrcan_fb_export_*`, `nrcan_fb_data_sources`, `nrcan_fb_run_history`, section-scoped calculated tables `nrcan_fb_s1_*`, `nrcan_fb_s2_*`, `nrcan_fb_s4_*`, etc.). Create or upgrade objects with `scripts/db/setup_database.sql` and migrate legacy data with `scripts/db/migrate_legacy_to_eedas.sql` when applicable.
2. **Credentials** in `scripts/.env` (same as the main pipeline).
3. **Python dependencies**: `pip install -r scripts/requirements.txt` (includes `pandas`, `pyodbc`, `pyyaml`).

**Test the database connection:**

```bash
cd scripts
python main.py test-connection
```

---

## Quick reference

| Goal | Command |
|------|---------|
| Regenerate glossary from the database (default output) | From **`scripts/`**: `python export_glossary_html.py` — or from **repo root**: `python scripts/export_glossary_html.py` |
| Same, custom output folder | `python scripts/export_glossary_html.py --out path/to/folder` (from repo root) |
| Skip rebuilding export tables before export | `python scripts/export_glossary_html.py --skip-prepare-export` |
| Build glossary from `public/data` only (no SQL) | `python scripts/export_glossary_html.py --seed-from-public` |

Default output directory: **`public/glossary/`** (under the repo root).

**Note (Windows):** The file is `scripts/export_glossary_html.py`. Running `export_glossary_html.py` or `python export_glossary_html.py` from the repo root will fail; either `cd scripts` first or pass the `scripts/…` path to `python`.

---

## 1. What the glossary contains

Running **`export_glossary_html.py`** (database mode) writes:

| Output | Source in SQL Server | Purpose |
|--------|----------------------|---------|
| `glossary_metadata.csv` | `nrcan_fb_export_metadata` + join to per-source `*_metadata` tables | Vectors, titles, units, `data_source` (`source_key`), attribution |
| `glossary_series.csv` | `nrcan_fb_export_data` | All time series (vector, ref_date, value) after `prepare_export_data()` |
| `glossary_major_projects.csv` | `nrcan_fb_major_projects_map` | Map features for major projects |
| `glossary_data_sources.csv` | `nrcan_fb_data_sources` | Registry of logical sources and sections |
| `glossary_run_history.csv` | `nrcan_fb_run_history` (top 20k rows) | Audit log of runs |
| `glossary_nrcan_fb_s*.csv` | Each `dbo` table matching `nrcan_fb_s[0-9]_*` (validated name pattern) | One file per **section-scoped calculated** table |
| `glossary_manifest.csv` | Generated | Lists every `glossary_*.csv` with English/French titles for the viewer |
| `data-gallery.html` | Copied from `scripts/templates/data-gallery.html` | Standalone browser viewer for the CSVs |

**Ingest tables** (for example `stc_*_data`, `iea_*_data`, `nrcan_oee_*_data`) are **not** dumped as separate glossary CSVs. Their content is reflected in **`glossary_series.csv` / `glossary_metadata.csv`** after `prepare_export_data()` unions them into `nrcan_fb_export_*`.

---

## 2. Recommended workflow: full export from the database

From the **`scripts/`** directory:

```bash
python export_glossary_html.py
```

Or from the **repository root** (same effect):

```bash
python scripts/export_glossary_html.py
```

This will:

1. Call **`DataRepository.prepare_export_data()`** unless you pass **`--skip-prepare-export`**. That step clears `nrcan_fb_export_data` / `nrcan_fb_export_metadata` and repopulates them from **all** registered per-source `*_data` / `*_metadata` tables (see `scripts/db/eedas_registry.yaml`).
2. Query the tables listed in section 1 and write CSVs under **`public/glossary/`**.
3. Discover calculated tables with `INFORMATION_SCHEMA` (`TABLE_NAME LIKE 'nrcan_fb_s[0-9]_%'`) and export each to `glossary_<table_name>.csv`.
4. Refresh **`glossary_manifest.csv`** and copy **`data-gallery.html`**.

**Typical order when refreshing everything:**

1. Refresh pipeline data and/or run `python main.py export` so SQL and `public/data` match your intent (see [DATA_UPDATE_GUIDE.md](DATA_UPDATE_GUIDE.md)).
2. Run **`python export_glossary_html.py`** so the glossary matches the current database.
3. Commit updated files under **`public/glossary/`** and deploy (for example GitHub Pages).

---

## 3. Command-line options

| Option | Effect |
|--------|--------|
| `--out DIR` | Write CSVs and `data-gallery.html` to `DIR` instead of `public/glossary/`. |
| `--skip-prepare-export` | Do not run `prepare_export_data()` first. Use when export tables are already up to date and you want a faster glossary-only pass. |
| `--seed-from-public` | **No database.** Copies `public/data/metadata.csv` → `glossary_metadata.csv`, `public/data/data.csv` → `glossary_series.csv`, `public/data/major_projects_map.csv` → `glossary_major_projects.csv`, and writes **placeholder** headers for data_sources and run_history. Does **not** include calculated-table dumps. Use for offline demos or CI without SQL; not a substitute for a real DB export. |

---

## 4. Website integration

- **`src/components/Glossary.jsx`** links to **`{BASE_URL}glossary/data-gallery.html`** unless **`VITE_GLOSSARY_HTML_URL`** is set in the Vite env (absolute URL override).
- For **GitHub Pages** (and similar), ensure **`public/glossary/`** is deployed with the rest of `public/` so the viewer and CSVs resolve under the same origin as the app.

---

## 5. Section-scoped calculated tables in the glossary

Calculated tables use names like:

- `nrcan_fb_s1_economic_contributions`, `nrcan_fb_s1_provincial_gdp`, `nrcan_fb_s1_world_energy_production`
- `nrcan_fb_s2_capital_expenditures`, `nrcan_fb_s2_infrastructure`, …
- `nrcan_fb_s4_energy_use`

The export script only includes names that match a **strict allowlist pattern** (see `scripts/export_glossary_html.py`: `_is_safe_section_calc_table`). If you add a new calculated table, use the same naming convention or update the script’s pattern.

---

## 6. Troubleshooting

| Symptom | Likely cause | What to do |
|--------|----------------|------------|
| `glossary_nrcan_fb_s*.csv` files missing | Old DB still using `calc_*` only, or tables not created | Run current `setup_database.sql` / migration; confirm tables exist in SSMS. |
| Empty or stale `glossary_series.csv` | Export tables empty or not refreshed | Run pipeline refresh and/or `python main.py export`, then rerun `export_glossary_html.py` **without** `--skip-prepare-export`. |
| Script errors connecting to SQL | `.env` / `config.yaml` | Run `python main.py test-connection`. |
| Live site still shows old glossary | Static assets not redeployed | Regenerate glossary, commit `public/glossary/`, redeploy hosting. |
| `--seed-from-public` missing calc CSVs | By design | Use database mode for full glossary parity. |

---

## 7. Related files

| File | Role |
|------|------|
| `scripts/export_glossary_html.py` | CLI entry point and SQL queries |
| `scripts/templates/data-gallery.html` | Viewer template copied to `public/glossary/` |
| `scripts/db/models.py` | `prepare_export_data()`, export table population |
| `scripts/db/eedas_registry.yaml` | Maps `source_key` → physical `*_data` / `*_metadata` tables |

---

## 8. Optional: custom viewer URL

To point the app at a glossary hosted elsewhere, set in your Vite environment (for example `.env`):

`VITE_GLOSSARY_HTML_URL=https://example.org/path/to/data-gallery.html`

The Glossary page will use that URL instead of the default under `BASE_URL`.
