# Database layer (`scripts/db`)

SQL Server objects used by the Energy Factbook pipeline. DDL lives in [`setup_database.sql`](setup_database.sql); on `python main.py eedas update …`, [`ensure_schema.py`](ensure_schema.py) applies the batches that create or upgrade objects.

CLI overview: **[`../README.md`](../README.md)**. Architecture: **[`../../docs/DATA_PIPELINE_GUIDE.md`](../../docs/DATA_PIPELINE_GUIDE.md)**.

## Two-stage data model

| Layer | Tables | Populated by | Consumed by |
|--------|--------|--------------|-------------|
| **EEDAS raw** | `stc_*`, `nrcan_*`, `iea_*`, … (per [`eedas_registry.yaml`](eedas_registry.yaml)) | `python main.py eedas update` | Ad-hoc queries, EFB transform |
| **EFB indicators** | `nrcan_efb_indicators` | `python main.py efb transform` | `nrcan_fb_export` → website CSVs |
| **Export staging** | `nrcan_fb_export` | `prepare_export_data()` during export | `public/data/data.csv` |

Aggregation and Factbook semantic vectors (`capex_*`, `econ_*`, …) live **only** in `nrcan_efb_indicators`, not in EEDAS series tables.

## Registry files

| File | Role |
|------|------|
| [`eedas_registry.yaml`](eedas_registry.yaml) | `source_key` → physical raw table |
| [`efb_indicators_registry.yaml`](efb_indicators_registry.yaml) | `indicator_key` → dependencies, vector prefixes |
| [`eedas_registry.py`](eedas_registry.py) | Loader + `TABLE_*` constants |
| [`efb_registry.py`](efb_registry.py) | Indicator dependency order |

## System tables

| Table | Role |
|--------|------|
| `nrcan_fb_data_sources` | Enabled sources, section grouping, `source_url` |
| `nrcan_fb_run_history` | Audit log (`run_type`: `eedas_update`, `efb_transform`, `export`) |
| `nrcan_fb_major_projects_map` | Major-projects map export (non–time-series) |

## EEDAS series tables (raw ingest)

One physical table per distinct `source_table` in the YAML. Current tables include:

- `iea_web_rankings`
- `nrcan_cea_assets`, `nrcan_cleanenv_semantic`, `nrcan_cleantech_semantic`, `nrcan_ghg_semantic`, `nrcan_majorproj_semantic`
- `nrcan_oee_*` (NEUD, residential, commercial, industrial, SEU)
- `stc_*` (StatCan tables by product id)

Store **source-native** vectors only (`v*` for StatCan, publisher row keys for OEE/Excel/API).

## Removed / legacy

- Per-source `*_data` / `*_metadata` pairs
- Section calc tables `nrcan_fb_s1_*`, `nrcan_fb_s2_*`, `nrcan_fb_s4_*` (replaced by `nrcan_efb_indicators`)
- Monolithic `refresh` CLI (replaced by `eedas update` + `efb transform`)

## Glossary / data gallery

[`../export_glossary_html.py`](../export_glossary_html.py) exports raw EEDAS tables and `nrcan_efb_indicators` separately. See **[`../../docs/GLOSSARY_UPDATE_GUIDE.md`](../../docs/GLOSSARY_UPDATE_GUIDE.md)**.
