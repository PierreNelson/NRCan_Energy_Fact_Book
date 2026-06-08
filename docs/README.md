# Documentation index

Guides for the NRCan Energy Factbook repository. The project has two parts: a **static React website** (Vite) and an optional **Python/SQL data pipeline** that produces the CSVs the site reads.

**Master command list:** all npm, pipeline, glossary, and release commands are in the root **[`README.md`](../README.md#command-reference-master-list)**.

## Start here if…

| You want to… | Read |
|--------------|------|
| Run the website locally | [Root README](../README.md) — `npm ci` and `npm run dev` |
| Refresh Factbook data (StatCan, Excel, etc.) | [DATA_UPDATE_GUIDE.md](DATA_UPDATE_GUIDE.md) |
| Understand how data flows (EEDAS → EFB → export) | [DATA_PIPELINE_GUIDE.md](DATA_PIPELINE_GUIDE.md) |
| Add a new data source or indicator | [DATA_PIPELINE_GUIDE.md](DATA_PIPELINE_GUIDE.md) |
| Build a new page or chart | [PAGE_CREATION_GUIDE.md](PAGE_CREATION_GUIDE.md) |
| Deploy a release zip to a web server | [DEPLOYMENT.md](DEPLOYMENT.md) |
| Regenerate the glossary viewer | [GLOSSARY_UPDATE_GUIDE.md](GLOSSARY_UPDATE_GUIDE.md) |
| Work as a coding agent | [AGENTS.md](../AGENTS.md) |

## All guides

| Document | Description |
|----------|-------------|
| [DATA_UPDATE_GUIDE.md](DATA_UPDATE_GUIDE.md) | Operator runbook: prerequisites, three-stage workflow, partial updates, logs, troubleshooting |
| [DATA_PIPELINE_GUIDE.md](DATA_PIPELINE_GUIDE.md) | Developer reference: database layers, update/transform handlers, fetch patterns, frontend wiring |
| [PAGE_CREATION_GUIDE.md](PAGE_CREATION_GUIDE.md) | Step-by-step page patterns: routing, Plotly charts, downloads, translations |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Hosting static builds, release zips, Azure DevOps pipeline, data-only updates |
| [GLOSSARY_UPDATE_GUIDE.md](GLOSSARY_UPDATE_GUIDE.md) | Export glossary CSVs and `data-gallery.html` from SQL |
| [EFB_MODERNIZATION_REVIEW.md](EFB_MODERNIZATION_REVIEW.md) | Client Q&A handoff: DevOps, lint, page index |

## Pipeline scripts (in-repo)

| Document | Description |
|----------|-------------|
| [scripts/README.md](../scripts/README.md) | CLI entry point, folder layout, setup, all commands |
| [scripts/eedas/README.md](../scripts/eedas/README.md) | Stage 1 — raw source ingest |
| [scripts/efb/README.md](../scripts/efb/README.md) | Stage 2 — indicator transforms |
| [scripts/db/README.md](../scripts/db/README.md) | SQL schema, table names, registries |
| [scripts/sections/README.md](../scripts/sections/README.md) | How section processors and source files are organized |

## Three-stage pipeline (summary)

```bash
cd scripts
python main.py eedas update --all    # Load source-native data into EEDAS tables
python main.py efb transform --all   # Build Factbook indicators in nrcan_efb_indicators
python main.py export                # Write public/data/*.csv for the website
```

Export does **not** run automatically after update or transform — run all three stages for a full publish.
