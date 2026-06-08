# Section 2 — Investment source map

Section 2 covers **Investment** on the website: capital expenditures, infrastructure, major projects, international investment, foreign control, environmental protection, and related charts. Most sources are StatCan CSV downloads; some reuse Section 1 handlers (economic contributions, CEA).

This map lists **every page in Section 2** (`SectionTwo.jsx`). No local Excel workbooks are required for this section.

## How to use this map

1. Find your **page number** below.
2. Note the `source_key` and run all three pipeline stages for that source:

```bash
cd scripts
python main.py eedas update --source <source_key>
python main.py efb transform --indicator <source_key>
python main.py export
```


## Every page in Section 2

| Page | In pipeline? | Website getter | `source_key` | Handler function | Edit data here |
|------|--------------|----------------|--------------|------------------|----------------|
| **23** | Yes (3 sources) | `getCapitalExpendituresData()`, `getInfrastructureData()`, `getEconomicContributionsData()` | `capital_expenditures`, `infrastructure`, `economic_contributions`* | `capital_expenditures.py`, `infrastructure.py`, Section 1 `economic_contributions.py`* | See each source below |
| **24** | Yes | `getCapitalExpendituresData()` | `capital_expenditures` | `process_capital_expenditures()` · `capital_expenditures.py` | `_statcan.py` + NAICS grouping in handler |
| **25** | Yes | `getInfrastructureData()` | `infrastructure` | `process_infrastructure()` · `infrastructure.py` | `_statcan.py` + `constants.py` → `INFRA_VECTORS` |
| **26** | Yes | `getEconomicContributionsData()` | `economic_contributions`* | Section 1 `economic_contributions.py`* | Section 1 README |
| **27** | Yes | `getInvestmentByAssetData()` | `investment_by_asset` | `process_investment_by_asset()` · `investment_by_asset.py` | `_statcan.py` → `get_investment_by_asset_url()` |
| **28** | Yes | `getMajorProjectsData()` | `major_projects` | `process_major_projects()` · `major_projects.py` | `constants.py` URLs + `_shared.py` HTML parsers |
| **29** | Yes | `getCleanTechTrendsData()` | `clean_tech` | `process_clean_tech()` · `major_projects.py` | Derived from `major_projects` — same MPI source |
| **30** | Yes | *(reads CSV directly)* | `major_projects_map` | `process_major_projects_map()` · `major_projects_map.py` | ArcGIS URL in `config.yaml`; output `public/data/major_projects_map.csv` |
| **31** | Yes | `getInternationalInvestmentData()` | `international_investment` | `process_international_investment()` · `international_investment.py` | `_statcan.py` |
| **32** | Yes | `getForeignControlData()` | `foreign_control` | `process_foreign_control()` · `foreign_control.py` | `_statcan.py` |
| **33** | Yes | `getCEAData()` | `canadian_energy_assets`* | Section 1 `cea.py`* | Section 1 README |
| **34** | No | — | — | — | Static layout — `src/pages/Page34.jsx` |
| **35** | No | — | — | — | Hardcoded / static — `src/pages/Page35.jsx` |
| **36** | No | — | — | — | Hardcoded / static — `src/pages/Page36.jsx` |
| **37** | Yes | `getEnvironmentalProtectionData()` | `environmental_protection` | `process_environmental_protection()` · `environmental_protection.py` | `_statcan.py` → `get_environmental_protection_url()` |

\*Source owned by **Section 1** — run EEDAS update / EFB transform with `--source economic_contributions` or `--source canadian_energy_assets`.

---

## Pipeline sources (detail)

### `capital_expenditures` — Pages 23, 24

| Item | Location |
|------|----------|
| Handler | `process_capital_expenditures()` in `capital_expenditures.py` |
| StatCan URL | `_statcan.py` → `get_capital_expenditures_url()` |
| Page 24 NAICS buckets | Oil/gas `[211]`, electricity `[2211]`, other — logic in `capital_expenditures.py` (~line 81) |
| Vectors | `capex_*` |

### `infrastructure` — Pages 23, 25

| Item | Location |
|------|----------|
| Handler | `process_infrastructure()` in `infrastructure.py` |
| StatCan URL | `_statcan.py` → `get_infrastructure_url()` |
| Vector IDs | `constants.py` → `INFRA_VECTORS` |
| Vectors | `infra_*` |

### `investment_by_asset` — Page 27

| Item | Location |
|------|----------|
| Handler | `process_investment_by_asset()` in `investment_by_asset.py` |
| StatCan URL | `_statcan.py` → `get_investment_by_asset_url()` |
| Vectors | `asset_*` |

### `international_investment` — Page 31

| Item | Location |
|------|----------|
| Handler | `process_international_investment()` in `international_investment.py` |
| StatCan URL | `_statcan.py` → `get_international_investment_url()` |
| Vectors | `intl_*` |

### `foreign_control` — Page 32

| Item | Location |
|------|----------|
| Handler | `process_foreign_control()` in `foreign_control.py` |
| StatCan URL | `_statcan.py` → `get_foreign_control_url()` (multiple tables) |
| Vectors | `foreign_*` |

### `environmental_protection` — Page 37

| Item | Location |
|------|----------|
| Handler | `process_environmental_protection()` in `environmental_protection.py` |
| StatCan URL | `_statcan.py` → `get_environmental_protection_url()` |
| Vectors | `enviro_*` |

### `major_projects` — Page 28

| Item | Location |
|------|----------|
| Handler | `process_major_projects()` in `major_projects.py` |
| URLs | `constants.py` → `NRCAN_MPI_URL`, `NRCAN_MPI_SOURCE_URL` |
| HTML parsing | `_shared.py` (table cell parsers, year extraction) |
| Vectors | `projects_*` |

### `clean_tech` — Page 29

| Item | Location |
|------|----------|
| Handler | `process_clean_tech()` in `major_projects.py` |
| Source | Derived from major projects inventory (no separate fetch) |
| Vectors | `cleantech_*` |

### `major_projects_map` — Page 30

| Item | Location |
|------|----------|
| Handler | `process_major_projects_map()` in `major_projects_map.py` |
| API URL | `config.yaml` → `major_projects_map.source_url` (NRCan ArcGIS MapServer) |
| Website | Page 30 fetches `public/data/major_projects_map.csv` (not `dataLoader.js`) |
| If layer/fields change | `major_projects_map.py` |

---

## Shared files

| File | Purpose |
|------|---------|
| `_statcan.py` | All StatCan CSV download URL builders |
| `_shared.py` | Major Projects Inventory HTML parse helpers |
| `constants.py` | MPI URLs, infrastructure vector IDs |

---

## If something changes

| Change type | What to edit |
|-------------|--------------|
| **Source file** | Not used — Section 2 has no local Excel workbooks |
| **Download URL** changed (StatCan, MPI, ArcGIS) | `_statcan.py`, `constants.py` (MPI), or `config.yaml` (map `source_url`) |
| **Parsing rule** (NAICS groups, HTML table cells, map fields) | Handler for that source; MPI HTML in `_shared.py` + `major_projects.py` |
| Section 1 shared sources (pages 26, 33) | Section 1 README |

