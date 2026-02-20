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
- Source: CEA_2023.xlsx file
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
python main.py refresh --source major_projects_map
python main.py refresh --source clean_tech

# === EXPORT ALL ===
python main.py export                           # Export all CSVs from database

# === SELECTIVE EXPORT (by source) ===
python main.py export --source capital_expenditures
python main.py export --source infrastructure
python main.py export --source canadian_energy_assets
python main.py export --source clean_tech

# === SELECTIVE EXPORT (by pattern) ===
python main.py export --vectors "capex_*"       # All capex vectors
python main.py export --vectors "cea_*"         # All CEA vectors
python main.py export --vectors "*_total"       # All total vectors

# === UTILITIES ===
python main.py list                             # List all sections and sources
python main.py test-connection                  # Test database connection
```
