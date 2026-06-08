# EEDAS — standalone data ingest layer

EEDAS (Energy Data Access System) is **stage 1** of the Factbook pipeline. It fetches data from external sources and stores **source-native** time series in SQL — the same shape and naming the publisher uses, not yet aggregated for Factbook pages.

## What “source-native” means

- StatCan rows keep `v*` vector IDs from the CSV download.
- OEE and Excel sources keep publisher column labels as pipe-delimited dimension keys.
- No Factbook semantic prefixes (`capex_*`, `oee_neud_*`) are written at this stage — those are produced by **EFB transform**.

EEDAS tables (`stc_*`, `nrcan_*`, `iea_*`, …) are registered in [`../db/eedas_registry.yaml`](../db/eedas_registry.yaml).

## When to run

Run EEDAS update when source data has changed (new StatCan release, updated Excel workbook, etc.). After a successful update, run **EFB transform** then **export** — EEDAS alone does not update website CSVs.

On first run, `eedas update` also applies database schema from [`../db/setup_database.sql`](../db/setup_database.sql) unless you pass `--skip-ensure-schema`.

## Commands

```bash
cd scripts
python main.py eedas update --all
python main.py eedas update --section section2_indicators
python main.py eedas update --source capital_expenditures
```

| Flag | Effect |
|------|--------|
| `--all` | Update every enabled source in every enabled section |
| `--section` | Update all sources in one section |
| `--source` | Update one source by `source_key` from `config.yaml` |

## Layout

| Path | Role |
|------|------|
| [`runner.py`](runner.py) | CLI orchestration, logging, run history |
| [`../sections/*_indicators/`](../sections/) | Per-source `update_*` handlers (fetch + `replace_raw_data`) |
| [`../db/eedas_registry.yaml`](../db/eedas_registry.yaml) | `source_key` → physical table name |

Handlers live in section folders because they share section-specific helpers (`_statcan.py`, `_oee.py`, etc.), but EEDAS update is a **standalone product** — it can be run and audited independently of EFB transform.

## Next step

After EEDAS update, run **EFB transform** then **export**. See [`../efb/README.md`](../efb/README.md) and [`../../docs/DATA_UPDATE_GUIDE.md`](../../docs/DATA_UPDATE_GUIDE.md).
