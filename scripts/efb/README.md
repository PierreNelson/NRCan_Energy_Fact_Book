# EFB — Energy Fact Book indicator transform layer

EFB is **stage 2** of the Factbook pipeline. It reads **unaggregated vectors** from EEDAS series tables, applies Factbook-specific aggregation rules, and writes finished indicators to **`nrcan_efb_indicators`**.

## What indicators are

An indicator is a semantic time series the website understands — for example `capex_oil_gas`, `oee_neud_R`, `cea_total_assets`. Each indicator:

- Has a unique **vector** name used in `data.csv` and filtered by the React app.
- Carries inline metadata (title, unit, source URL) on each row.
- Is defined in [`../db/efb_indicators_registry.yaml`](../db/efb_indicators_registry.yaml) with optional **dependencies** on other indicators or raw sources.

EFB transform does **not** re-fetch from the web. Cross-source transforms (e.g. economic contributions using capex NAICS data) read from EEDAS tables populated in stage 1.

## When to run

Run EFB transform after EEDAS update whenever raw data changed, or when transform logic changed in code. Then run **export** to write website CSVs.

## Commands

```bash
cd scripts
python main.py efb transform --all
python main.py efb transform --section section2_indicators
python main.py efb transform --indicator capital_expenditures
```

| Flag | Effect |
|------|--------|
| `--all` | Transform all indicators in dependency order |
| `--section` | Transform all indicators owned by one section |
| `--indicator` | Transform one indicator by key (usually matches `source_key`) |

## Dependency order

When you run **`efb transform --all`**, the runner resolves dependencies from `efb_indicators_registry.yaml` so upstream raw tables and indicators are ready before downstream transforms (e.g. `clean_tech` after `major_projects`).

## Layout

| Path | Role |
|------|------|
| [`runner.py`](runner.py) | CLI orchestration, dependency ordering |
| [`../sections/*_indicators/`](../sections/) | Per-indicator `transform_*` handlers |
| [`../db/efb_indicators_registry.yaml`](../db/efb_indicators_registry.yaml) | Indicator keys, dependencies, vector prefixes |

## Operator sequence

```bash
cd scripts
python main.py eedas update --all    # 1. Load raw data
python main.py efb transform --all   # 2. Build indicators
python main.py export                # 3. Write website CSVs
```

See [`../../docs/DATA_UPDATE_GUIDE.md`](../../docs/DATA_UPDATE_GUIDE.md) for partial updates and troubleshooting.
