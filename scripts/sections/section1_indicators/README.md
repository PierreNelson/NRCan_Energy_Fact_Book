# Section 1 — Key Indicators source map

Section 1 covers **Key Indicators** on the website: GDP, economic contributions, provincial data, world energy rankings, Canadian Energy Assets, and GHG emissions. Several sources here also feed Section 2 (Investment) pages.

This map lists **every page in Section 1** (`SectionOne.jsx`). Local Excel is used for page 2; page 33 (Section 2) also uses the CEA workbook from this section.

## How to use this map

1. Find your **page number** below.
2. Note the `source_key` and run all three pipeline stages for that source:

```bash
cd scripts
python main.py eedas update --source <source_key>
python main.py efb transform --indicator <source_key>
python main.py export
```


## Every page in Section 1

| Page | In pipeline? | Website getter | `source_key` | Handler function | Edit data here |
|------|--------------|----------------|--------------|------------------|----------------|
| **1** | No | — | — | — | Cover page — `src/pages/EnergyOverview.jsx` |
| **2** | Yes | `getWorldEnergyProductionData()` | `world_energy_production` | `process_world_energy_production()` · `world_energy_production.py` | Excel + maps in `constants.py` |
| **3** | No | — | — | — | Static content — `src/pages/CanadianEnergyProduction.jsx` |
| **4** | No | — | — | — | Hardcoded chart data — `src/pages/PrimaryEnergyProduction.jsx` |
| **5** | No | — | — | — | Hardcoded regional data — `src/pages/PrimaryEnergyByRegion.jsx` |
| **6** | Yes | `getCanadaEnergySupplyData()` | `canada_energy_supply` | `process_canada_energy_supply()` · `canada_energy_supply.py` | SharePoint `oecd_iea_data.xlsx` sheet `total_energy_supply` |
| **7** | Yes | `getNominalGDPData()` | `nominal_gdp` | `process_nominal_gdp()` · `nominal_gdp.py` | `_statcan.py` → `get_gdp_emp_forecast_url()`; parse in `nominal_gdp.py` |
| **8** | Yes | `getProvincialGdpData()` | `provincial_gdp` | `process_provincial_gdp()` · `provincial_gdp.py` | `_statcan.py` + `constants.py` → `PROVINCE_VECTORS` |
| **9** | Yes | `getEnergySectorEmploymentData()` | `energy_sector_employment` | `process_energy_sector_employment()` · `energy_sector_employment.py` | StatCan tables 36-10-0624-01, 38-10-0285-01, and 14-10-0287-01, plus the GDP and employment forecast |
| **10** | No | — | — | — | Hardcoded employment data — `src/pages/EmploymentChart.jsx` |
| **11** | No | — | — | — | Hardcoded GDP data — `src/pages/GdpChart.jsx` |
| **14** | Yes | `getUsStateEnergyExportsData()` | `us_state_energy_exports` | `process_us_state_energy_exports()` · `us_state_energy_exports.py` | SharePoint `2025 Energy Exports by US State.xlsx` sheet `Energy trade by state (RY)` |
| **15** | Yes | `getCanadaGlobalEnergyTradeData()` | `global_energy_trade` | `process_global_energy_trade()` · `global_energy_trade.py` | SharePoint `Canada_s Global Energy Trade.xlsx` sheet `Final Result` |
| **16** | No | — | — | — | Hardcoded government revenues — `src/pages/GovernmentRevenues.jsx` |
| **17** | No | — | — | — | Hardcoded corporate taxes — `src/pages/CorporateIncomeTaxes.jsx` |
| **18** | Yes | `getEnergyAndGhgEmissionsData()` | `energy_and_ghg_emissions` | `process_energy_and_ghg_emissions()` · `energy_and_ghg_emissions.py` | Climate Watch, ECCC `GHG_IPCC_Can_Prov_Terr.csv`, StatCan `v65201756` and `v466668`, SharePoint `Annex 4 Table A4-1_NRCan_2026-04-01.xlsx` |
| **19** | Yes | `getEnergyAndGhgEmissionsData()` | `energy_and_ghg_emissions` | `process_energy_and_ghg_emissions()` · `energy_and_ghg_emissions.py` | Same source as page 18; indexed series `eghg_index_*` |
| **20** | Yes | `getGHGEmissionsData()`, `getGhgNarrativeStats()` | `ghg_emissions`* | `process_ghg_emissions()` · `ghg_emissions.py` | `config.yaml` → `ghg_emissions.source_url`; parsing in `ghg_emissions.py` |
| **21** | No | — | — | — | Static reference content — `src/pages/EnergyInformationLandscape.jsx` |

\*Also feeds Page **132** (Section 6). Sources `economic_contributions` and `canadian_energy_assets` feed Section 2 pages — see pipeline detail below.

---

## Pipeline sources (detail)

### `economic_contributions` — Pages 23, 26 (Section 2)

| Item | Location |
|------|----------|
| Handler | `process_economic_contributions()` in `economic_contributions.py` |
| StatCan URL | `_statcan.py` → `get_economic_contributions_url()` |
| Vector IDs | `constants.py` → `ECON_VECTORS` |
| Vectors | `econ_*` |

### `nominal_gdp` — Page 7

| Item | Location |
|------|----------|
| Handler | `process_nominal_gdp()` in `nominal_gdp.py` |
| Data source | Google Docs text export — `_statcan.py` → `get_gdp_emp_forecast_url()` |
| Parsing | `parse_gdp_emp_text()` in `nominal_gdp.py` |
| Vectors | `gdp_nominal_*` |

### `provincial_gdp` — Page 8

| Item | Location |
|------|----------|
| Handler | `process_provincial_gdp()` in `provincial_gdp.py` |
| StatCan URL | `_statcan.py` → `get_provincial_gdp_url()` |
| Province map | `constants.py` → `PROVINCE_VECTORS`, `PROVINCE_NAMES` |
| Vectors | `gdp_prov_*` |

### `energy_sector_employment` — Page 9

| Item | Location |
|------|----------|
| Handler | `process_energy_sector_employment()` in `energy_sector_employment.py` |
| Sources | StatCan 36-10-0624-01, 38-10-0285-01, 14-10-0287-01 (`v2363382`), Indigenous employment vector, and the GDP and employment forecast |
| Vectors | `emp_*` |

### `energy_and_ghg_emissions` — Pages 18 and 19

| Item | Location |
|------|----------|
| Handler | `process_energy_and_ghg_emissions()` in `energy_and_ghg_emissions.py` |
| Global GHG | Climate Watch, World, All GHG, Total excluding LULUCF and Energy |
| Canada GHG | ECCC `GHG_IPCC_Can_Prov_Terr.csv`, Canada, category blank, Total = y |
| GDP and population | StatCan `v65201756` (monthly average) and `v466668` |
| End-use energy | SharePoint `Annex 4 Table A4-1_NRCan_2026-04-01.xlsx`, row `Reference Approach (PJ)` |
| Vectors | `eghg_*` |

### `world_energy_production` — Page 2

| Item | Location |
|------|----------|
| Handler | `process_world_energy_production()` in `world_energy_production.py` |
| Excel file | `constants.py` → `WORLD_ENERGY_XLSX` (`World Energy Balances Highlights 2025.xlsx`; `EXTERNAL_XLSX_DATA_DIR` or repo root) |
| Country / region maps | `constants.py` → `WORLD_ENERGY_COUNTRY_MAPPING`, `WORLD_ENERGY_AGGREGATES` |
| Vectors | `energy_prod_*` |

### `canada_energy_supply` — Page 6

| Item | Location |
|------|----------|
| Handler | `process_canada_energy_supply()` in `canada_energy_supply.py` |
| Excel file | `constants.py` → `CANADA_ENERGY_SUPPLY_XLSX` (`oecd_iea_data.xlsx` in SharePoint Manual Data) |
| Sheet | `total_energy_supply` |
| Vectors | `tes_*` |

### `us_state_energy_exports` — Page 14

| Item | Location |
|------|----------|
| Handler | `process_us_state_energy_exports()` in `us_state_energy_exports.py` |
| Excel file | `constants.py` → `US_STATE_ENERGY_EXPORTS_XLSX` (`2025 Energy Exports by US State.xlsx` in SharePoint Manual Data) |
| Sheet | `Energy trade by state (YYYY)` |
| Vectors | `usx_*` |

### `global_energy_trade` — Page 15

| Item | Location |
|------|----------|
| Handler | `process_global_energy_trade()` in `global_energy_trade.py` |
| Excel file | `constants.py` → `GLOBAL_ENERGY_TRADE_XLSX` (`Canada_s Global Energy Trade.xlsx` in SharePoint Manual Data) |
| Sheet | `Final Result` |
| Vectors | `gtrade_*` |

### `canadian_energy_assets` — Page 33 (Section 2)

| Item | Location |
|------|----------|
| Handler | `process_cea_data()` in `cea.py` |
| Excel file | `constants.py` → `CEA_XLSX` or `config.yaml` → `canadian_energy_assets.file_path` |
| Sheets | Per-year `Canadian Energy Assets YYYY`; optional `Evolution` summary — see `cea.py` |
| Region map | `constants.py` → `CEA_REGION_MAPPING` |
| Vectors | `cea_*` |

### `ghg_emissions` — Pages 20, 132

| Item | Location |
|------|----------|
| Handler | `process_ghg_emissions()` in `ghg_emissions.py` |
| CSV URL | `config.yaml` → `ghg_emissions.source_url` (ECCC `GHG_Econ_Can_Prov_Terr.csv`) |
| Page 20 chart | Sector columns in `ghg_emissions.py` |
| Page 132 spotlight | `build_oil_gas_spotlight_rows()` in `ghg_emissions.py` |
| Narrative stats | `build_ghg_narrative_stats()` in `ghg_emissions.py` |
| Vectors | `ghg_*` |

---

## Shared files

| File | Purpose |
|------|---------|
| `_statcan.py` | StatCan and Google Docs URL builders |
| `constants.py` | Vector IDs, province/country/region maps, default Excel names |

---

## If something changes

| Change type | What to edit |
|-------------|--------------|
| **Source file** (new path or filename) | `constants.py` → `CEA_XLSX` / `WORLD_ENERGY_XLSX`; or `config.yaml` → `canadian_energy_assets.file_path` |
| **Workbook sheet** renamed | `cea.py` (per-year sheet pattern) or `world_energy_production.py` |
| **Expected column** renamed or added | Same handler as sheet |
| **Download URL** changed (StatCan, ECCC, Google Docs) | `_statcan.py` or `config.yaml` → `ghg_emissions.source_url` |
| **Parsing rule** (vector IDs, province/country maps, GHG sectors) | `constants.py` for maps/IDs; filter logic in handler |
