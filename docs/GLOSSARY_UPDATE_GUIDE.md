# Glossary Update Guide

This guide explains how to **regenerate the data glossary**: the CSV bundles under `public/glossary/` and the standalone viewer `data-gallery.html`. The React app’s **Glossary** route opens that HTML viewer (or an override URL), so updating the glossary is a separate step from the main pipeline export to `public/data/`.

For **refreshing SQL data and `public/data/*.csv`**, see [DATA_UPDATE_GUIDE.md](DATA_UPDATE_GUIDE.md). For **how data flows from sources into SQL**, see [DATA_PIPELINE_GUIDE.md](DATA_PIPELINE_GUIDE.md). For **table names and registry fields**, see [`scripts/db/README.md`](../scripts/db/README.md).

---

## Prerequisites

1. **SQL Server** running with the `NRCanEnergyFactbook` database on the **current schema**: EEDAS series tables (from [`eedas_registry.yaml`](../scripts/db/eedas_registry.yaml)), **`nrcan_efb_indicators`**, staging table **`nrcan_fb_export`**, registry **`nrcan_fb_data_sources`**, **`nrcan_fb_run_history`**, and **`nrcan_fb_major_projects_map`**. The first **`python main.py eedas update`** applies DDL from **`scripts/db/setup_database.sql`** for missing objects.
2. **Credentials** in `scripts/.env` (same as the main pipeline).
3. **Python dependencies**: `pip install -r scripts/requirements.txt`.

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
| Same, custom output folder | `python scripts/export_glossary_html.py --out path/to/folder` |
| Skip rebuilding `nrcan_fb_export` before export | `python scripts/export_glossary_html.py --skip-prepare-export` |
| Build glossary from `public/data` only (no SQL) | `python scripts/export_glossary_html.py --seed-from-public` |

Default output directory: **`public/glossary/`** (under the repo root).

**Note (Windows):** Either `cd scripts` first or pass the full path: `python scripts/export_glossary_html.py`.

---

## What the glossary contains

Running **`export_glossary_html.py`** (database mode) writes:

| Output | Source in SQL Server | Purpose |
|--------|----------------------|---------|
| `glossary_metadata.csv` | **`nrcan_fb_export`** + join to **`nrcan_efb_indicators`** and EEDAS series tables | Vectors, titles, units, `data_source`, attribution |
| `glossary_series.csv` | **`nrcan_fb_export`** | Time series (`vector`, `ref_date`, `value`) after **`prepare_export_data()`** |
| `glossary_nrcan_efb_indicators.csv` | **`nrcan_efb_indicators`** | Full indicator table dump (when non-empty) |
| `glossary_<table>.csv` | Each **non-empty** EEDAS series table (e.g. `glossary_stc_capex_3410003601.csv`) | Raw publisher-native data per source |
| `glossary_major_projects.csv` | **`nrcan_fb_major_projects_map`** | Map features for major projects |
| `glossary_data_sources.csv` | **`nrcan_fb_data_sources`** | Registry: logical sources, sections, `source_url`, flags |
| `glossary_run_history.csv` | **`nrcan_fb_run_history`** (top 20k rows) | Audit log of pipeline runs |
| `glossary_manifest.csv` | Generated | Lists every `glossary_*.csv` with English/French titles for the viewer |
| `data-gallery.html` | Copied from **`scripts/templates/data-gallery.html`** | Standalone browser viewer for the CSVs |

Legacy **`glossary_nrcan_fb_s*.csv`** and **`glossary_calc_*.csv`** files are purged on export — those calc tables were removed from the schema.

---

## Recommended workflow

From the **`scripts/`** directory:

```bash
python export_glossary_html.py
```

This will:

1. Purge stale legacy glossary CSVs (`glossary_calc_*`, `glossary_nrcan_fb_s*`).
2. Call **`DataRepository.prepare_export_data()`** unless you pass **`--skip-prepare-export`** (copies **`nrcan_efb_indicators`** into **`nrcan_fb_export`**).
3. Query the objects listed above and write CSVs under **`public/glossary/`**.
4. Export each non-empty EEDAS raw table and **`nrcan_efb_indicators`** as separate glossary CSVs.
5. Refresh **`glossary_manifest.csv`** and copy **`data-gallery.html`**.

**Typical order when refreshing everything:**

1. Run the full data pipeline (see [DATA_UPDATE_GUIDE.md](DATA_UPDATE_GUIDE.md)):

   ```bash
   python main.py eedas update --all
   python main.py efb transform --all
   python main.py export
   ```

2. Run **`python export_glossary_html.py`** so the glossary matches the current database.
3. Commit updated files under **`public/glossary/`** and deploy.

---

## Command-line options

| Option | Effect |
|--------|--------|
| `--out DIR` | Write CSVs and `data-gallery.html` to `DIR` instead of `public/glossary/`. |
| `--skip-prepare-export` | Do not run **`prepare_export_data()`** first. Use when **`nrcan_fb_export`** is already up to date. |
| `--seed-from-public` | **No database.** Copies `public/data/metadata.csv`, `data.csv`, and `major_projects_map.csv` into glossary CSVs with placeholder headers for registry tables. Use for offline demos only. |

---

## Website integration

- **`src/components/Glossary.jsx`** links to **`{BASE_URL}glossary/data-gallery.html`** unless **`VITE_GLOSSARY_HTML_URL`** is set (absolute URL override).
- Ensure **`public/glossary/`** is deployed with the rest of `public/` so the viewer and CSVs resolve under the same origin as the app.

---

## Troubleshooting

| Symptom | Likely cause | What to do |
|--------|----------------|------------|
| Empty or stale `glossary_series.csv` | **`nrcan_efb_indicators`** empty or export not run | Run EFB transform and `python main.py export`, then rerun glossary export |
| Raw EEDAS CSVs missing | Tables empty | Run `python main.py eedas update --all` first |
| Script errors connecting to SQL | `.env` / `config.yaml` | Run **`python main.py test-connection`** |
| Live site still shows old glossary | Static assets not redeployed | Regenerate glossary, commit `public/glossary/`, redeploy hosting |
| `--seed-from-public` missing raw/indicator CSVs | By design | Use database mode for full glossary parity |

---

## Related files

| File | Role |
|------|------|
| `scripts/export_glossary_html.py` | CLI entry point and SQL queries |
| `scripts/templates/data-gallery.html` | Viewer template copied to `public/glossary/` |
| `scripts/db/models.py` | **`prepare_export_data()`** — copies indicators to export staging |
| `scripts/db/eedas_registry.yaml` | Maps **`source_key`** → physical EEDAS table |
| `scripts/db/efb_indicators_registry.yaml` | Indicator keys and dependencies |

---

## Optional: custom viewer URL

Set in your Vite environment (for example `.env`):

`VITE_GLOSSARY_HTML_URL=https://example.org/path/to/data-gallery.html`

The Glossary page will use that URL instead of the default under `BASE_URL`.
