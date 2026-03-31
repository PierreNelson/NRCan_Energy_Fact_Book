# NRCan Energy Factbook - Data Update Guide

This guide walks you through all commands for updating the Energy Factbook data.

For **regenerating the glossary** (`public/glossary/`, `data-gallery.html`), see [GLOSSARY_UPDATE_GUIDE.md](GLOSSARY_UPDATE_GUIDE.md).

---

## Prerequisites

Before running any commands, ensure you have:

1. **SQL Server running** with the `NRCanEnergyFactbook` database created (empty is fine). The first **`python main.py refresh`** applies table/procedure DDL from `scripts/db/setup_database.sql` and seeds `nrcan_fb_data_sources` only if that table is empty. The registry table includes a required **`source_url`** for each logical source (data gallery); see [`scripts/db/README.md`](../scripts/db/README.md).
2. **Credentials configured** in `scripts/.env`
3. **Dependencies installed**: `pip install -r scripts/requirements.txt`
4. **Local Excel workbooks** used by the pipeline (CEA, IEA World Energy Balances, ECCC GHG Annex, `EE Improvement.xlsx`, `Primary Energy Use Demand.xlsx`, `SEU Final Demand.xlsx`, TSX listing export `tsx-and-amp-tsxv-listed-companies-2026-02-17-en.xlsx`) — place them in one folder on your machine and point `EXTERNAL_XLSX_DATA_DIR` in `scripts/.env` at that folder (see `scripts/.env.example`). If you omit it, the scripts still look for those filenames at the **repository root**.

**Test your connection first:**
```bash
cd scripts
python main.py test-connection
```

---

## Quick Reference

| Action | Command |
|--------|---------|
| Update everything | `python main.py refresh --all --export-after` |
| Update Section 1 only | `python main.py refresh --section section1_indicators` |
| Update Section 2 only | `python main.py refresh --section section2_investment` |
| Update Section 4 only | `python main.py refresh --section section4_indicators` |
| Update Section 5 only | `python main.py refresh --section section5_clean_power` |
| Export all data | `python main.py export` |
| Export by source | `python main.py export --source capital_expenditures` |
| Export by pattern | `python main.py export --vectors "capex_*"` |
| List all sources | `python main.py list` |
| Regenerate glossary from SQL (writes `public/glossary/`) | `python export_glossary_html.py` in `scripts/`, or `python scripts/export_glossary_html.py` from repo root |

---

## Update All Data

**Refresh all data sources and export CSV files:**
```bash
cd scripts
python main.py refresh --all --export-after
```

**Refresh all data sources (without auto-export):**
```bash
python main.py refresh --all
```

**Export CSV files only (from existing database data):**
```bash
python main.py export
```

---

## Update by Section

### Section 1: Key Indicators

Updates GDP, economic contributions, provincial data, and world energy rankings.

```bash
python main.py refresh --section section1_indicators
```

**Data sources in this section:**
- Economic contributions (GDP, jobs, income)
- Nominal GDP by industry
- Provincial GDP contributions
- World energy production rankings (IEA tool / pipeline logic)
- Canadian Energy Assets (CEA)
- GHG emissions (ECCC / pipeline handler)

---

### Section 2: Investment

Updates capital expenditures, infrastructure, FDI/CDIA, and environmental protection data.

```bash
python main.py refresh --section section2_investment
```

**Data sources in this section:**
- Capital expenditures by industry
- Infrastructure stock by category
- Investment by asset type
- International investment (FDI/CDIA)
- Foreign control of enterprises
- Environmental protection expenditures
- Major projects inventory
- Clean technology projects

---

### Section 4: Energy Efficiency

Updates energy use by sector (OEE NEUD + Primary Energy Use Demand). Extract → SQL → export (same flow as other sections).

```bash
python main.py refresh --section section4_indicators
```

**Data sources in this section:**
- Energy use (OEE NEUD: R,C,I,T,A; Primary Energy Use Demand: P,NPC,FK,EL), PJ
- **Page 49 (Secondary energy by fuel):** SEU by fuel (`seu_by_fuel`) – reads from Excel, writes to SQL via `store_raw_data('seu_by_fuel', ...)`, then export writes `seu_*` vectors to `data.csv`. Same pipeline as all other pages.
- **Page 50 (Energy in our daily lives):** Residential daily lives (`residential_daily_lives`) – reads from `EE Improvement.xlsx`, writes to SQL via `store_raw_data('residential_daily_lives', ...)`, then export writes `res_*` vectors to `data.csv`. Total residential energy (TEr) uses `oee_neud_R` from the energy_use source when available; optionally `res_ter` from the Residential sheet if present. Same pipeline as all other pages.

**For Page 48 (Primary and secondary energy use by sector):** Place `Primary Energy Use Demand.xlsx` at the project root with columns `YEAR`, `PRODUCT`, `VALUE` (products: Pipeline, Non-energy (feedstock), Noncovered producer consumption, Energy losses (conversion)). After refreshing Section 4, run **Export** so `data.csv` includes the Primary vectors; otherwise the pie chart will only show Secondary.

**For Page 50 (Energy in our daily lives)** – data instructions and sources:

1. **Total Energy Use (PJ) = TEr:** From Residential end use (OEE NEUD). Pipeline: `oee_neud_R` from energy_use (Section 4). Optional: add a **ter** or **Total Energy Use (PJ)** column to the **Residential** sheet in `EE Improvement.xlsx` to output `res_ter`; the frontend uses `oee_neud_R` first, then `res_ter` as fallback so the chart data table can show TEr for all years.
2. **Energy Efficiency Effect (PJ) = EEE:** From Energy Indicator Analysis (Change in Energy Use due to). In `EE Improvement.xlsx`, **Residential** sheet column **eee** (or “Energy efficiency effect”, “EEE”) → `res_eee`.
3. **Energy Use Excluding EE Effect = EUx:** Calculated as TEr − EEE (done in frontend from `oee_neud_R`/`res_ter` and `res_eee`).
4. **TEr% and EUx%:** Change in TEr and change in EUx from 2000 to selected year (e.g. 2022), expressed as percentage. Narratives: “Residential energy use increased [TEr%] since 2000, but would have increased by [EUx%] without energy efficiency improvements.”
5. **Total Space Heating (PJ):** Table 7 (OEE). In **Residential** sheet column **space_heating_pj** (or “Space Heating (PJ)”) → `res_space_heating_pj`.
6. **Total Water Heating (PJ):** Table 14 (OEE). In **Residential** sheet column **water_heating_pj** (or “Water Heating (PJ)”) → `res_water_heating_pj`.
7. **SWEU:** Space and water heating energy use = space_heating_pj + water_heating_pj (calculated in frontend).
8. **SWTE%:** Share of residential energy = SWEU / TEr × 100. Narrative: “[SWTE%] of residential energy consumption is used for space and water heating.”
9. **EE Improvement sheet:** In `EE Improvement.xlsx`, sheet **EE Improvement**, rows where **SECTOR = Residential**: **Improvement** (%) → `res_ee_improvement_pct`, **Energy Savings** (UOM = PJ) → `res_ee_savings_pj`, **Energy Savings** (UOM = $ billion) → `res_ee_savings_billion`. Narrative: “Residential energy efficiency improved by [%] between 2000 and [year], saving [PJ] of energy and $[B] billion in energy costs.” If the sheet does not provide `res_ee_savings_pj` for a year, the frontend may use `res_eee` (EEE) as the savings in PJ for that year.

**Residential sheet columns (EE Improvement.xlsx):** **year** (required); **space_heating_pj**, **water_heating_pj** (for SWTE%); **eee** (optional, for EEE and derived EUx); **ter** or **Total Energy Use (PJ)** (optional, for `res_ter` when `oee_neud_R` is missing). After refreshing Section 4 and exporting, the pipeline writes these vectors and the page narratives and chart data table populate.

**Page 51 (Residential energy use – pie charts):** Data comes from the **residential_pie_charts** source in Section 4. The pipeline scrapes:
- **Chart 1 (by end-use):** OEE “Residential Secondary Energy Use (Final Demand) by Energy Source and End Use” (HB tables, 3 pages) → `res_reu_total`, `res_reu_space_heating`, `res_reu_water_heating`, `res_appliances_pj`, `res_lighting_pj`, `res_space_cooling_pj`.
- **Chart 2 (water heating by source):** OEE Table 14 (2 pages) → `res_wh_total`, `res_wh_ele`, `res_wh_ng`, `res_wh_ho`, `res_wh_ot`, `res_wh_wd`.
- **Chart 3 (space heating by source):** OEE Table 7 (2 pages) → `res_sh_total`, `res_sh_ele`, `res_sh_ng`, `res_sh_ho`, `res_sh_ot`, `res_sh_wd`.

Run **Section 4** refresh and then **Export** so these vectors are written to `data.csv`. If they are missing, Page 51 will use fallbacks (`res_ter`, `res_space_heating_pj`, `res_water_heating_pj` from residential_daily_lives) for totals only; the three pie charts and data tables will only be fully populated after a successful Section 4 run and export.

---

### Section 5: Clean Power and Low Carbon Fuels

Environmental and clean technology indicators (StatCan tables, optional TSX listing XLSX).

```bash
python main.py refresh --section section5_clean_power
```

**Data sources in this section:**

- **environmental_clean_tech** — labour, GDP, jobs, exports (multiple StatCan feeds + optional local XLSX)

---

## Update Individual Data Sources

Use these commands to update a single data source without affecting others.

### Section 1: Key Indicators - Individual Sources

**Economic Contributions (GDP, Jobs, Income)**
- StatCan Table: 36-10-0610-01
```bash
python main.py refresh --source economic_contributions
```

**Nominal GDP**
- Source: Google Docs forecast + calculations
```bash
python main.py refresh --source nominal_gdp
```

**Provincial GDP**
- StatCan Table: 36-10-0624-01
```bash
python main.py refresh --source provincial_gdp
```

**World Energy Production**
- Source: External/manual data
```bash
python main.py refresh --source world_energy_production
```

**Canadian Energy Assets (CEA)**
- Source: `CEA_2023.xlsx` in `EXTERNAL_XLSX_DATA_DIR` (or repo root)
```bash
python main.py refresh --source canadian_energy_assets
```

---

### Section 2: Investment - Individual Sources

**Capital Expenditures**
- StatCan Table: 34-10-0036-01
```bash
python main.py refresh --source capital_expenditures
```

**Infrastructure Stock**
- StatCan Table: 36-10-0608-01
```bash
python main.py refresh --source infrastructure
```

**Investment by Asset Type**
- StatCan Table: 36-10-0608-01
```bash
python main.py refresh --source investment_by_asset
```

**International Investment (FDI/CDIA)**
- StatCan Table: 36-10-0009-01
```bash
python main.py refresh --source international_investment
```

**Foreign Control**
- StatCan Table: 33-10-0570-01
```bash
python main.py refresh --source foreign_control
```

**Environmental Protection Expenditures**
- StatCan Table: 38-10-0130-01
```bash
python main.py refresh --source environmental_protection
```

**Major Projects**
- Source: NRCan Major Projects Inventory
```bash
python main.py refresh --source major_projects
```

**Major Projects Map**
- Source: NRCan ArcGIS Feature Server
```bash
python main.py refresh --source major_projects_map
```

**Clean Technology**
- Source: Derived from major projects
```bash
python main.py refresh --source clean_tech
```

---

### Section 5: Clean Power - Individual Sources

**Environmental and clean technology**
- Source: StatCan + optional TSX cleantech XLSX (see `scripts/config.yaml` → `section5_clean_power`)
```bash
python main.py refresh --source environmental_clean_tech
```

---

### Section 4: Energy Efficiency - Individual Sources

**Energy use (OEE NEUD + Primary Energy Use Demand)**
- Sources: OEE NEUD (sector R,C,I,T,A in PJ) and Primary Energy Use Demand / SharePoint–Excel (P,NPC,FK,EL in PJ). Set `oee_neud_file_path` and `primary_demand_file_path` under `sections.section4_indicators.sources.energy_use` in config.
```bash
python main.py refresh --source energy_use
```

**Residential pie charts**
```bash
python main.py refresh --source residential_pie_charts
```

**Residential daily lives**
```bash
python main.py refresh --source residential_daily_lives
```

**Commercial / institutional**
```bash
python main.py refresh --source commercial_institutional
```

**SEU by fuel**
```bash
python main.py refresh --source seu_by_fuel
```

---

## After Updating Data

After refreshing data, you need to export the CSV files for the website:

```bash
python main.py export
```

Or use the `--export-after` flag with your refresh command:

```bash
python main.py refresh --source capital_expenditures --export-after
```

---

## Selective Export

You can export data for specific sources or vector patterns without regenerating the entire data.csv file. Selective exports merge changes with existing data.

### Export by Data Source

Export only vectors from a specific data source:

```bash
# Export only capital expenditures data
python main.py export --source capital_expenditures

# Export only infrastructure data
python main.py export --source infrastructure

# Export only CEA (Canadian Energy Assets) data
python main.py export --source canadian_energy_assets
```

### Export by Vector Pattern

Export vectors matching a glob pattern:

```bash
# Export all capital expenditure vectors
python main.py export --vectors "capex_*"

# Export all GDP-related vectors
python main.py export --vectors "*gdp*"

# Export all "total" vectors across categories
python main.py export --vectors "*_total"

# Export all clean technology vectors
python main.py export --vectors "cleantech_*"
```

### Combining Refresh and Selective Export

Update and export only specific data:

```bash
# Refresh and export only CEA data
python main.py refresh --source canadian_energy_assets
python main.py export --source canadian_energy_assets

# Refresh capital expenditures and export
python main.py refresh --source capital_expenditures
python main.py export --source capital_expenditures
```

---

## Typical Workflows

### Monthly Data Update (All Sections)
```bash
cd scripts
python main.py refresh --all --export-after
```

### Update Just Investment Data
```bash
cd scripts
python main.py refresh --section section2_investment --export-after
```

### Update Single Data Source (e.g., Capital Expenditures)
```bash
cd scripts
python main.py refresh --source capital_expenditures
python main.py export
```

### Check What's Available
```bash
python main.py list
```

---

## Troubleshooting

### Connection Failed
```bash
# Test your connection
python main.py test-connection

# Check your .env file has correct credentials
cat .env
```

### Source Not Found
```bash
# List all available sources
python main.py list
```

### Data Not Appearing on Website
Make sure you ran the export step:
```bash
python main.py export
```

### StatCan Timeout
Some StatCan queries take time. If you get timeouts, try running the source individually:
```bash
python main.py refresh --source capital_expenditures
```

---

## Command Summary

```bash
# === FULL UPDATES ===
python main.py refresh --all                    # Refresh all data
python main.py refresh --all --export-after     # Refresh all + export CSVs

# === SECTION UPDATES ===
python main.py refresh --section section1_indicators    # Key Indicators
python main.py refresh --section section2_investment    # Investment
python main.py refresh --section section4_indicators    # Energy Efficiency
python main.py refresh --section section5_clean_power  # Clean power / env–cleantech

# === INDIVIDUAL SOURCE UPDATES (Section 1) ===
python main.py refresh --source economic_contributions
python main.py refresh --source nominal_gdp
python main.py refresh --source provincial_gdp
python main.py refresh --source world_energy_production
python main.py refresh --source canadian_energy_assets
python main.py refresh --source ghg_emissions

# === INDIVIDUAL SOURCE UPDATES (Section 2) ===
python main.py refresh --source capital_expenditures
python main.py refresh --source infrastructure
python main.py refresh --source investment_by_asset
python main.py refresh --source international_investment
python main.py refresh --source foreign_control
python main.py refresh --source environmental_protection
python main.py refresh --source major_projects
python main.py refresh --source major_projects_map
python main.py refresh --source clean_tech

# === INDIVIDUAL SOURCE UPDATES (Section 4) ===
python main.py refresh --source energy_use
python main.py refresh --source residential_pie_charts
python main.py refresh --source residential_daily_lives
python main.py refresh --source commercial_institutional
python main.py refresh --source seu_by_fuel

# === INDIVIDUAL SOURCE UPDATES (Section 5) ===
python main.py refresh --source environmental_clean_tech

# === EXPORT ALL ===
python main.py export                           # Export all CSVs from database

# === SELECTIVE EXPORT (by source) ===
python main.py export --source capital_expenditures
python main.py export --source infrastructure
python main.py export --source canadian_energy_assets
python main.py export --source clean_tech
python main.py export --source energy_use

# === SELECTIVE EXPORT (by pattern) ===
python main.py export --vectors "capex_*"       # All capex vectors
python main.py export --vectors "oee_neud_*"    # Energy use (OEE NEUD) vectors
python main.py export --vectors "cea_*"         # All CEA vectors
python main.py export --vectors "*_total"       # All total vectors

# === UTILITIES ===
python main.py list                             # List all sections and sources
python main.py test-connection                  # Test database connection
```
