# NRCan Energy Factbook - Data Update Guide

This guide walks you through all commands for updating the Energy Factbook data.

---

## Prerequisites

Before running any commands, ensure you have:

1. **SQL Server running** with the `NRCanEnergyFactbook` database created
2. **Credentials configured** in `scripts/.env`
3. **Dependencies installed**: `pip install -r scripts/requirements.txt`

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
| Export all data | `python main.py export` |
| Export by source | `python main.py export --source capital_expenditures` |
| Export by page | `python main.py export --page Page24` |
| Export by pattern | `python main.py export --vectors "capex_*"` |
| List all sources | `python main.py list` |

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
- World energy production rankings
- Canadian Energy Assets (CEA)

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

## Update Individual Data Sources

Use these commands to update a single graph's data without affecting others.

### Section 1: Key Indicators - Individual Sources

**Economic Contributions (GDP, Jobs, Income)**
- Used by: Page 7 (Energy's Contribution to the Economy)
- StatCan Table: 36-10-0610-01
```bash
python main.py refresh --source economic_contributions
```

**Nominal GDP**
- Used by: Page 9 (Nominal GDP), Page 10 (GDP breakdown)
- Source: Google Docs forecast + calculations
```bash
python main.py refresh --source nominal_gdp
```

**Provincial GDP**
- Used by: Page 8 (Provincial GDP map)
- StatCan Table: 36-10-0624-01
```bash
python main.py refresh --source provincial_gdp
```

**World Energy Production**
- Used by: Page 2-3 (World rankings)
- Source: External/manual data
```bash
python main.py refresh --source world_energy_production
```

**Canadian Energy Assets (CEA)**
- Used by: Various pages
- Source: CEA_2023.xlsx file
```bash
python main.py refresh --source canadian_energy_assets
```

---

### Section 2: Investment - Individual Sources

**Capital Expenditures**
- Used by: Page 24 (Capital Expenditures chart)
- StatCan Table: 34-10-0036-01
```bash
python main.py refresh --source capital_expenditures
```

**Infrastructure Stock**
- Used by: Page 25 (Infrastructure pie chart)
- StatCan Table: 36-10-0608-01
```bash
python main.py refresh --source infrastructure
```

**Investment by Asset Type**
- Used by: Page 26 (Asset breakdown)
- StatCan Table: 36-10-0608-01
```bash
python main.py refresh --source investment_by_asset
```

**International Investment (FDI/CDIA)**
- Used by: Page 27, Page 29 (International investment charts)
- StatCan Table: 36-10-0009-01
```bash
python main.py refresh --source international_investment
```

**Foreign Control**
- Used by: Page 30 (Foreign control chart)
- StatCan Table: 33-10-0570-01
```bash
python main.py refresh --source foreign_control
```

**Environmental Protection Expenditures**
- Used by: Page 37 (Environmental protection chart)
- StatCan Table: 38-10-0130-01
```bash
python main.py refresh --source environmental_protection
```

**Major Projects**
- Used by: Page 28 (Major projects map)
- Source: NRCan Major Projects Inventory
```bash
python main.py refresh --source major_projects
```

**Clean Technology**
- Used by: Page 33 (Clean tech summary)
- Source: Derived from major projects
```bash
python main.py refresh --source clean_tech
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

You can export data for specific sources, pages, or vector patterns without regenerating the entire data.csv file. Selective exports merge changes with existing data.

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

### Export by Page

Export only vectors used by a specific page:

```bash
# Export data for Page 24 (Capital Expenditures chart)
python main.py export --page Page24

# Export data for Page 33 (Clean Technology)
python main.py export --page Page33

# Export data for Page 8 (Provincial GDP map)
python main.py export --page Page8
```

**Available pages:**
- `Page2`, `Page3`, `Page4` - World energy production rankings
- `Page7`, `Page9`, `Page10` - Nominal GDP charts
- `Page8` - Provincial GDP map
- `Page11` - Economic contributions
- `Page23`, `Page24` - Capital expenditures
- `Page25` - Infrastructure stock
- `Page26` - Investment by asset type
- `Page27`, `Page29`, `Page31` - International investment
- `Page28` - Major projects chart
- `Page30` - Foreign control
- `Page32`, `Page37` - Environmental protection
- `Page33` - Clean technology
- `Page39` - Canadian Energy Assets

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

# Refresh capital expenditures and export for Page 24
python main.py refresh --source capital_expenditures
python main.py export --page Page24
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

### Update Single Chart (e.g., Capital Expenditures)
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

# === INDIVIDUAL SOURCE UPDATES (Section 1) ===
python main.py refresh --source economic_contributions
python main.py refresh --source nominal_gdp
python main.py refresh --source provincial_gdp
python main.py refresh --source world_energy_production
python main.py refresh --source canadian_energy_assets

# === INDIVIDUAL SOURCE UPDATES (Section 2) ===
python main.py refresh --source capital_expenditures
python main.py refresh --source infrastructure
python main.py refresh --source investment_by_asset
python main.py refresh --source international_investment
python main.py refresh --source foreign_control
python main.py refresh --source environmental_protection
python main.py refresh --source major_projects
python main.py refresh --source clean_tech

# === EXPORT ALL ===
python main.py export                           # Export all CSVs from database

# === SELECTIVE EXPORT (by source) ===
python main.py export --source capital_expenditures
python main.py export --source infrastructure
python main.py export --source canadian_energy_assets
python main.py export --source clean_tech

# === SELECTIVE EXPORT (by page) ===
python main.py export --page Page24             # Capital Expenditures
python main.py export --page Page25             # Infrastructure
python main.py export --page Page33             # Clean Technology
python main.py export --page Page8              # Provincial GDP map

# === SELECTIVE EXPORT (by pattern) ===
python main.py export --vectors "capex_*"       # All capex vectors
python main.py export --vectors "cea_*"         # All CEA vectors
python main.py export --vectors "*_total"       # All total vectors

# === UTILITIES ===
python main.py list                             # List all sections/sources/pages
python main.py test-connection                  # Test database connection
```
