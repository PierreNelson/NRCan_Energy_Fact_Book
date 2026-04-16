# Database layer (`scripts/db`)

SQL Server objects used by the Energy Factbook pipeline. DDL lives in [`setup_database.sql`](setup_database.sql); on `python main.py refresh ...`, [`ensure_schema.py`](ensure_schema.py) applies the batches that create or upgrade objects (without re-running `CREATE DATABASE` or clobbering existing source rows).

CLI overview: **[`../README.md`](../README.md)**. Architecture: **[`../../docs/DATA_PIPELINE_GUIDE.md`](../../docs/DATA_PIPELINE_GUIDE.md)**.

### Runtime vs one-off scripts

| File | Role |
|------|------|
| [`ensure_schema.py`](ensure_schema.py) | **Used on every refresh** (`main.py` imports `ensure_database_schema`). Applies `setup_database.sql` batches to the connected database and seeds `nrcan_fb_data_sources` when empty. |
| [`patch_setup_unified.py`](patch_setup_unified.py) | **Not part of the pipeline.** Optional developer tool to regenerate or migrate chunks of `setup_database.sql` (e.g. unified ingest DDL from `eedas_registry.yaml`). Run manually only when changing physical table layout; do not confuse with `ensure_schema.py`. |
| [`models.py`](models.py) | **Active code:** defines [`DataRepository`](models.py) (merge/upsert/export helpers). The filename is legacy; this module is the data-access layer, not unused scaffolding. |
| [`connection.py`](connection.py) | `DatabaseConnection` / `get_connection` — pyodbc pool helper used by `main.py` and repositories. |
| [`eedas_registry.py`](eedas_registry.py) | Loads [`eedas_registry.yaml`](eedas_registry.yaml); exposes `TABLE_*` constants, `get_source_table`, `unique_source_tables`. |
| [`__init__.py`](__init__.py) | Re-exports `get_connection`, `DatabaseConnection`, `DataRepository` for `from db import …`. |

## Naming

- **Registry and system tables** use the `nrcan_fb_*` prefix.
- **Per-source “series” tables** hold raw/staging rows (vector, ref_date, value, attribution). Names are **not** tied to a single publisher: StatCan, IEA, NRCan, etc. share the same column shape. Physical table names come from [`eedas_registry.yaml`](eedas_registry.yaml) (`source_key` → `source_table`), validated in Python via [`eedas_registry.py`](eedas_registry.py).
- **Calculated tables** are section-scoped: `nrcan_fb_s1_*`, `nrcan_fb_s2_*`, `nrcan_fb_s4_*`.
- **Export** uses a **single** wide table, `nrcan_fb_export` (the old split `export_data` / `export_metadata` layout is removed in favour of one staging table).

## Configuration and system tables

| Table | Role |
|--------|------|
| `nrcan_fb_data_sources` | Enabled sources, section grouping, **`source_url` (NOT NULL)** for the data gallery, refresh timestamps. Pipeline registry in code (`TABLE_DATA_SOURCES`). |
| `nrcan_fb_run_history` | Audit log of refresh runs (status, errors, row counts). |
| `nrcan_fb_major_projects_map` | Points/lines metadata for the major-projects map export. |

Legacy databases may still have a table named `dbo.data_sources`. The setup script drops `statcan_table_id` if present and ensures **`source_url` is NOT NULL** (same canonical URLs as `nrcan_fb_data_sources`); new installs should rely on `nrcan_fb_data_sources`.

## Per-source series tables

One physical table per distinct `source_table` value in the YAML (multiple `source_key` entries can share the same table).

Current physical tables:

- `iea_web_rankings`
- `nrcan_cea_assets`, `nrcan_cleanenv_semantic`, `nrcan_cleantech_semantic`, `nrcan_ghg_semantic`, `nrcan_majorproj_semantic`
- `nrcan_oee_commercial`, `nrcan_oee_neud`, `nrcan_oee_res_daily`, `nrcan_oee_res_pie`, `nrcan_oee_seu`
- `stc_capex_3410003601`, `stc_epes_3810013001`, `stc_fdi_3610000901`, `stc_foreignctrl_misc`, `stc_gdpnom_3610010301`, `stc_infra_3610060801`, `stc_invasset_3410003601`, `stc_nrsa_3610061001`, `stc_nrsa_3810028501`

The `stc_*` prefix marks StatCan-sourced feeds; other prefixes are used for other agencies. Adding a source: update `eedas_registry.yaml`, add a matching `CREATE TABLE` block in `setup_database.sql` if the physical name is new, then refresh.

Older schemas used a `*_ingest` suffix on these physical names. `setup_database.sql` drops those legacy objects when upgrading.

## Calculated tables (staging before export)

These **`nrcan_fb_s*`** tables are populated when you run the matching section refresh (e.g. `upsert_capital_expenditures` fills **`nrcan_fb_s2_capital_expenditures`**). They can be **empty** until the first successful refresh for that pipeline; that is normal—the objects still exist so MERGE has a target. The **data gallery** only lists a calculated-table CSV when the table has **at least one row** (see `export_glossary_html.py`). **Website `data.csv`** is driven by per-source **series** tables and **`nrcan_fb_export`**, not by these calc tables.

| Table | Section |
|--------|---------|
| `nrcan_fb_s1_economic_contributions` | Section 1 |
| `nrcan_fb_s1_provincial_gdp` | Section 1 |
| `nrcan_fb_s1_world_energy_production` | Section 1 |
| `nrcan_fb_s2_capital_expenditures` | Section 2 |
| `nrcan_fb_s2_infrastructure` | Section 2 |
| `nrcan_fb_s2_international_investment` | Section 2 |
| `nrcan_fb_s2_environmental_protection` | Section 2 |
| `nrcan_fb_s2_clean_tech` | Section 2 |
| `nrcan_fb_s4_energy_use` | Section 4 |

Legacy `calc_*` tables are dropped by `setup_database.sql` when present.

## Export

- **`nrcan_fb_export`**: consolidated staging consumed by the website CSV export. Python constants `TABLE_EXPORT_DATA` / `TABLE_EXPORT_METADATA` in `eedas_registry.py` both refer to this single table for backward compatibility.

## Removed / legacy objects

The setup script drops former monolithic `raw_statcan_data` / `raw_statcan_metadata`, old per-source `*_data` / `*_metadata` pairs, and deprecated `nrcan_fb_export_data` / `nrcan_fb_export_metadata` when present. See the `DROP` section at the top of `setup_database.sql` for the full list.

## Glossary and data gallery

HTML exports that list per-table CSVs (when rows exist) are produced by **`scripts/export_glossary_html.py`**; see **[`../../docs/GLOSSARY_UPDATE_GUIDE.md`](../../docs/GLOSSARY_UPDATE_GUIDE.md)**. That flow uses calculated tables and metadata separately from the main website **`data.csv`** export.
