# NRCan Energy Factbook Data Pipeline

This directory contains the data pipeline for fetching, storing, and exporting energy data for the NRCan Energy Factbook website.

## Architecture Overview

```
scripts/
├── main.py              # CLI entry point
├── config.yaml          # Configuration file
├── config_loader.py     # Configuration management
├── requirements.txt     # Python dependencies
├── db/
│   ├── README.md             # Table naming and schema overview
│   ├── setup_database.sql    # SQL Server DDL (also applied on `main.py refresh`)
│   ├── eedas_registry.yaml   # source_key → physical source_table
│   ├── eedas_registry.py     # TABLE_* constants and registry helpers
│   ├── ensure_schema.py      # Runs setup batches against the connected DB
│   ├── connection.py         # Database connection management
│   └── models.py             # Data access layer
├── sections/
│   ├── base.py                    # Base processor class
│   ├── section1_indicators.py     # Key Indicators section
│   └── section2_investment.py     # Investment section
└── export/
    └── website_files.py    # CSV export for website
```

## Prerequisites

1. **Python 3.10+**
2. **SQL Server Developer Edition** (free)
   - Download from: https://www.microsoft.com/en-us/sql-server/sql-server-downloads
3. **ODBC Driver 17/18 for SQL Server**
   - Download from: https://docs.microsoft.com/en-us/sql/connect/odbc/download-odbc-driver-for-sql-server

## Setup Instructions

### 1. Install Python Dependencies

```bash
cd scripts
python -m pip install -r requirements.txt
```

### 2. Set Up SQL Server Database

1. Install SQL Server Developer Edition
2. Create an **empty** database named `NRCanEnergyFactbook` (or the name in your config)
3. Run **`python main.py refresh --section ...`** or **`python main.py refresh --all`** — refresh applies `db/setup_database.sql` (skips `CREATE DATABASE` and the destructive re-seed of `nrcan_fb_data_sources`; seeds default sources only if that table is empty).

Optional full manual install (creates the database and replaces source rows):

```sql
-- In SSMS or sqlcmd
:r setup_database.sql
```

```bash
sqlcmd -S localhost -i db/setup_database.sql
```

### 3. Configure Database Connection

Copy the `.env.example` file to `.env` and fill in your credentials:

```bash
cd scripts
cp .env.example .env
```

Then edit `.env` with your SQL Server credentials:

```bash
# .env (this file is gitignored - safe for credentials)
DB_SERVER=localhost
DB_DATABASE=NRCanEnergyFactbook
DB_USERNAME=your_username
DB_PASSWORD=your_password
```

**Important:** The `.env` file is automatically gitignored and will not be committed to version control. Never put credentials in `config.yaml`.

For Windows Authentication (no password needed), leave `DB_USERNAME` and `DB_PASSWORD` empty.

### 4. Test Connection

```bash
python main.py test-connection
```

## Usage

### List Available Sections and Sources

```bash
python main.py list
```

### Refresh All Data

```bash
python main.py refresh --all
```

### Refresh Specific Section

```bash
python main.py refresh --section section1_indicators
python main.py refresh --section section2_investment
```

### Refresh Specific Data Source

```bash
python main.py refresh --source capital_expenditures
python main.py refresh --source economic_contributions
```

### Refresh and Export in One Step

```bash
python main.py refresh --all --export-after
```

### Export Only (From Existing Database)

```bash
python main.py export
```

## Configuration

The `config.yaml` file controls which sections and data sources are enabled:

```yaml
sections:
  section1_indicators:
    enabled: true
    sources:
      economic_contributions:
        enabled: true
      nominal_gdp:
        enabled: true
      provincial_gdp:
        enabled: true
      
  section2_investment:
    enabled: true
    sources:
      capital_expenditures:
        enabled: true
      infrastructure:
        enabled: true
      # ...
```

Set `enabled: false` to skip a section or specific source during refresh.

## Data Flow

```
1. FETCH
   StatCan APIs / IEA / NRCan / other sources
           ↓
2. STORE
   SQL Server — per-source series tables (see db/eedas_registry.yaml)
           ↓
3. PROCESS
   Section-scoped calculated tables (nrcan_fb_s1_*, nrcan_fb_s2_*, …)
           ↓
4. EXPORT
   Staging: nrcan_fb_export → CSV files under public/data/, etc.
```

## Database tables

Authoritative list and naming rules: **[`db/README.md`](db/README.md)**.

Summary:

- **Registry:** `nrcan_fb_data_sources`, `nrcan_fb_run_history`, `nrcan_fb_major_projects_map`
- **Per-source staging:** physical names from `db/eedas_registry.yaml` (e.g. `stc_nrsa_3610061001`, `iea_web_rankings`, `nrcan_oee_neud`)
- **Calculated:** `nrcan_fb_s1_*`, `nrcan_fb_s2_*`, `nrcan_fb_s4_*`
- **Export:** single table `nrcan_fb_export`

## Troubleshooting

### Connection Issues

1. Ensure SQL Server is running
2. Check SQL Server authentication mode (Mixed mode for SQL auth)
3. Verify the ODBC driver is installed: `python -c "import pyodbc; print(pyodbc.drivers())"`

### Missing Data

1. Check if the source is enabled in `config.yaml`
2. Look at `nrcan_fb_run_history` for errors
3. Run with verbose output to see HTTP errors

### Export Problems

1. Ensure `nrcan_fb_export` is populated after a refresh
2. Check file permissions in `public/data/` directory

## Adding New Data Sources

1. Add source configuration to `config.yaml`
2. Create handler method in the appropriate section processor
3. Register handler in `get_source_handlers()` method
4. Add `source_table` (and DDL in `db/setup_database.sql` if needed) to `db/eedas_registry.yaml`, then refresh
