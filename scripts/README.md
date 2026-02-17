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
│   ├── setup_database.sql  # SQL Server database setup
│   ├── connection.py       # Database connection management
│   └── models.py           # Data access layer
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
pip install -r requirements.txt
```

### 2. Set Up SQL Server Database

1. Install SQL Server Developer Edition
2. Open SQL Server Management Studio (SSMS) or use sqlcmd
3. Run the setup script:

```sql
-- In SSMS or sqlcmd
:r setup_database.sql
```

Or via command line:
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
   StatCan APIs / External Sources
           ↓
2. STORE
   SQL Server Database
   (raw_statcan_data, raw_statcan_metadata, etc.)
           ↓
3. PROCESS
   Calculated/Aggregated Tables
   (calc_capital_expenditures, calc_infrastructure, etc.)
           ↓
4. EXPORT
   CSV Files for Website
   (public/data/data.csv, metadata.csv, etc.)
```

## Database Tables

### Configuration Tables
- `data_sources`: Registry of all data sources
- `run_history`: Audit log of refresh operations

### Raw Data Tables
- `raw_statcan_data`: Individual data points from StatCan
- `raw_statcan_metadata`: Vector metadata (titles, units)
- `raw_major_projects`: Major projects inventory

### Calculated Tables
- `calc_capital_expenditures`
- `calc_infrastructure`
- `calc_economic_contributions`
- `calc_environmental_protection`
- `calc_international_investment`
- `calc_provincial_gdp`
- `calc_world_energy_production`
- `calc_clean_tech`

### Export Tables
- `export_data`: Staging for data.csv
- `export_metadata`: Staging for metadata.csv

## Troubleshooting

### Connection Issues

1. Ensure SQL Server is running
2. Check SQL Server authentication mode (Mixed mode for SQL auth)
3. Verify the ODBC driver is installed: `python -c "import pyodbc; print(pyodbc.drivers())"`

### Missing Data

1. Check if the source is enabled in `config.yaml`
2. Look at `run_history` table for errors
3. Run with verbose output to see HTTP errors

### Export Problems

1. Ensure `export_data` and `export_metadata` tables are populated
2. Check file permissions in `public/data/` directory

## Adding New Data Sources

1. Add source configuration to `config.yaml`
2. Create handler method in the appropriate section processor
3. Register handler in `get_source_handlers()` method
4. Run database migrations if new tables are needed
