# Glossary Update Guide

This guide explains how to **regenerate the data glossary**: the CSV bundles under `public/glossary/` and the standalone viewer `data-gallery.html`. The React app’s **Glossary** route opens that HTML viewer (or an override URL), so updating the glossary is a separate step from refreshing pipeline data or exporting `data.csv`.

For **refreshing SQL data and `public/data/*.csv`**, see [DATA_UPDATE_GUIDE.md](DATA_UPDATE_GUIDE.md). For **how data flows from sources into SQL and export staging**, see [DATA_PIPELINE_GUIDE.md](DATA_PIPELINE_GUIDE.md). For **table names and registry fields** (`source_url`, series tables), see [`scripts/db/README.md`](../scripts/db/README.md).

---

## Prerequisites

1. **SQL Server** running with the `NRCanEnergyFactbook` database on the **current schema**: per-source **series** tables (names from [`scripts/db/eedas_registry.yaml`](../scripts/db/eedas_registry.yaml)), single wide staging table **`nrcan_fb_export`**, registry **`nrcan_fb_data_sources`** (includes required **`source_url`** for the gallery), **`nrcan_fb_run_history`**, section-scoped tables **`nrcan_fb_s1_*`**, **`nrcan_fb_s2_*`**, **`nrcan_fb_s4_*`**, and **`nrcan_fb_major_projects_map`**. Running **`python main.py refresh`** from `scripts/` applies DDL from **`scripts/db/setup_database.sql`** for missing objects; you can still run that `.sql` file in SSMS/sqlcmd for a full install (including destructive re-seed of `nrcan_fb_data_sources` if you run the seed batch).
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
| Skip rebuilding `nrcan_fb_export` before export | `python scripts/export_glossary_html.py --skip-prepare-export` |
| Build glossary from `public/data` only (no SQL) | `python scripts/export_glossary_html.py --seed-from-public` |

Default output directory: **`public/glossary/`** (under the repo root).

**Note (Windows):** The file is `scripts/export_glossary_html.py`. Running it from the repo root without the `scripts/` path will fail; either `cd scripts` first or pass the full path to `python`.

---

## 1. What the glossary contains

Running **`export_glossary_html.py`** (database mode) writes:

| Output | Source in SQL Server | Purpose |
|--------|----------------------|---------|
| `glossary_metadata.csv` | **`nrcan_fb_export`** (aggregated per vector) + join to discover each vector’s **`source_key`** via **`UNION ALL` of `SELECT vector, source_key FROM [each series table]`** (tables from `unique_source_tables()` / `eedas_registry.yaml`) | Vectors, titles, units, **`data_source`** (`source_key`), **`source_org`**, **`source_url`** (per-vector attribution from export staging) |
| `glossary_series.csv` | **`nrcan_fb_export`** | Time series (`vector`, `ref_date`, `value`) after **`prepare_export_data()`** |
| `glossary_major_projects.csv` | **`nrcan_fb_major_projects_map`** | Map features for major projects |
| `glossary_data_sources.csv` | **`nrcan_fb_data_sources`** | Registry: logical sources, sections, **`source_url`**, flags, timestamps |
| `glossary_run_history.csv` | **`nrcan_fb_run_history`** (top 20k rows) | Audit log of runs |
| `glossary_nrcan_fb_s*.csv` | Each **non-empty** `dbo` table matching **`nrcan_fb_s[0-9]_*`** (validated name pattern) | One file per **section-scoped calculated** table with data. Empty tables are omitted; optional CSVs from a prior run are removed on export. |
| `glossary_manifest.csv` | Generated | Lists every `glossary_*.csv` with English/French titles for the viewer |
| `data-gallery.html` | Copied from **`scripts/templates/data-gallery.html`** | Standalone browser viewer for the CSVs |

**Per-source series tables** (e.g. `stc_capex_3410003601`, `nrcan_oee_neud`) are **not** each dumped as separate glossary CSVs. Their content appears in **`glossary_series.csv`** / **`glossary_metadata.csv`** after **`prepare_export_data()`** unions them into **`nrcan_fb_export`**.

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

1. **Delete stale `glossary_calc_*.csv`** files if present (legacy filenames from the old **`calc_*`** table era; current tables are **`nrcan_fb_s*`**).
2. Call **`DataRepository.prepare_export_data()`** unless you pass **`--skip-prepare-export`**. That **`DELETE`s `nrcan_fb_export`** and repopulates it with **`INSERT … SELECT … UNION ALL …`** across **every** physical table in **`unique_source_tables()`** (from `eedas_registry.yaml`).
3. Query the objects listed in section 1 and write CSVs under **`public/glossary/`**.
4. Discover calculated tables with **`INFORMATION_SCHEMA`** (`TABLE_NAME LIKE 'nrcan_fb_s[0-9]_%'`) and export each **with at least one row** to **`glossary_<table_name>.csv`** (and remove the CSV if the table is empty).
5. Refresh **`glossary_manifest.csv`** and copy **`data-gallery.html`**.

**Typical order when refreshing everything:**

1. Refresh pipeline data and/or run **`python main.py export`** so SQL and **`public/data`** match your intent (see [DATA_UPDATE_GUIDE.md](DATA_UPDATE_GUIDE.md)).
2. Run **`python export_glossary_html.py`** so the glossary matches the current database.
3. Commit updated files under **`public/glossary/`** and deploy (for example GitHub Pages).

---

## 3. Command-line options

| Option | Effect |
|--------|--------|
| `--out DIR` | Write CSVs and `data-gallery.html` to `DIR` instead of `public/glossary/`. |
| `--skip-prepare-export` | Do not run **`prepare_export_data()`** first. Use when **`nrcan_fb_export`** is already up to date and you want a faster glossary-only pass. |
| `--seed-from-public` | **No database.** Copies **`public/data/metadata.csv`** → `glossary_metadata.csv`, **`public/data/data.csv`** → `glossary_series.csv`, **`public/data/major_projects_map.csv`** → `glossary_major_projects.csv`, and writes **placeholder** headers for data_sources and run_history. Does **not** include calculated-table dumps. Use for offline demos or CI without SQL; not a substitute for a real DB export. |

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

The export script only includes names that match a **strict allowlist pattern** (see **`scripts/export_glossary_html.py`**: `_is_safe_section_calc_table`). If you add a new calculated table, use the same naming convention or update the script’s pattern.

---

## 6. Troubleshooting

| Symptom | Likely cause | What to do |
|--------|----------------|------------|
| `glossary_nrcan_fb_s*.csv` files missing | Old DB still using legacy **`calc_*`** only, or tables not created | Run **`python main.py refresh`** (applies schema) or **`setup_database.sql`**; confirm tables exist in SSMS. |
| Empty or stale `glossary_series.csv` | **`nrcan_fb_export`** empty or series tables not refreshed | Run pipeline refresh and/or **`python main.py export`**, then rerun **`export_glossary_html.py`** **without** `--skip-prepare-export`. |
| Script errors connecting to SQL | `.env` / `config.yaml` | Run **`python main.py test-connection`**. |
| Live site still shows old glossary | Static assets not redeployed | Regenerate glossary, commit `public/glossary/`, redeploy hosting. |
| Headings still say **calc_*** after export | Browser cached `glossary_manifest.csv` or old `data-gallery.html` | Hard refresh the viewer (**Ctrl+F5**). The viewer requests CSVs with `cache: no-store`. Confirm `public/glossary/glossary_manifest.csv` lists `glossary_nrcan_fb_s*.csv` only (no `glossary_calc_*.csv`). |
| `--seed-from-public` missing calc CSVs | By design | Use database mode for full glossary parity. |

---

## 7. Related files

| File | Role |
|------|------|
| `scripts/export_glossary_html.py` | CLI entry point and SQL queries |
| `scripts/templates/data-gallery.html` | Viewer template copied to `public/glossary/` |
| `scripts/db/models.py` | **`prepare_export_data()`**, rebuild of **`nrcan_fb_export`** |
| `scripts/db/eedas_registry.yaml` | Maps **`source_key`** → physical **`source_table`** (series table name) |
| `scripts/db/eedas_registry.py` | **`unique_source_tables()`**, **`TABLE_EXPORT`**, **`TABLE_DATA_SOURCES`**, … |

---

## 8. Optional: custom viewer URL

To point the app at a glossary hosted elsewhere, set in your Vite environment (for example `.env`):

`VITE_GLOSSARY_HTML_URL=https://example.org/path/to/data-gallery.html`

The Glossary page will use that URL instead of the default under `BASE_URL`.
