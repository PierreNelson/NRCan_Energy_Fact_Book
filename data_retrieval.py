"""
Data Retrieval Module for NRCAN Energy Factbook
Downloads and processes Statistics Canada data for all pages.

All data is stored in unified CSV files:
- data.csv: Contains pre-calculated values (vector, ref_date, value)
- metadata.csv: Contains descriptions (vector, title, uom, scalar_factor)

Data sources:
- Page 24: Table 34-10-0036-01 (Capital Expenditures)
- Page 25: Table 36-10-0608-01 (Infrastructure Stock)
- Page 26: Table 36-10-0610-01 (Economic Contributions of Infrastructure)

The data is pre-calculated and stored with virtual vectors like:
- page24_oil_gas, page24_electricity, page24_other, page24_total
- page25_fuel_energy_pipelines, page25_transport, etc.
- page26_jobs, page26_employment_income, page26_gdp, page26_investment_value
"""

import requests
import pandas as pd
import io
import os

# Data directory
DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "statcan_data")

# =============================================================================
# STATCAN URLS
# =============================================================================
# Note: StatCan URLs use future end dates (e.g., 2030) to ensure all available
# data is returned. The API returns whatever data exists up to the current date,
# regardless of the end date specified. This approach ensures new data is
# automatically included when StatCan publishes it.

def get_capital_expenditures_url():
    """Get capital expenditures URL (Table 34-10-0036-01)."""
    return "https://www150.statcan.gc.ca/t1/tbl1/en/dtl!downloadDbLoadingData.action?pid=3410003601&latestN=0&startDate=20070101&endDate=20301231&csvLocale=en&selectedMembers=%5B%5B%5D%2C%5B1%5D%2C%5B8%2C9%2C11%2C34%2C36%2C37%2C50%2C91%5D%5D&checkedLevels=0D1"

def get_infrastructure_url():
    """Get infrastructure URL (Table 36-10-0608-01)."""
    return "https://www150.statcan.gc.ca/t1/tbl1/en/dtl!downloadDbLoadingData.action?pid=3610060801&latestN=0&startDate=20070101&endDate=20301231&csvLocale=en&selectedMembers=%5B%5B%5D%2C%5B3%5D%2C%5B1%5D%2C%5B%5D%2C%5B48%5D%2C%5B%5D%5D&checkedLevels=0D1%2C3D1%2C4D1%2C5D1%2C5D2"

def get_economic_contributions_url():
    """Get economic contributions URL (Table 36-10-0610-01)."""
    return "https://www150.statcan.gc.ca/t1/tbl1/en/dtl!downloadDbLoadingData.action?pid=3610061001&latestN=0&startDate=20070101&endDate=20301231&csvLocale=en&selectedMembers=%5B%5B%5D%2C%5B%5D%2C%5B%5D%2C%5B%5D%2C%5B39%2C48%2C54%2C55%2C57%5D%2C%5B%5D%5D&checkedLevels=0D1%2C1D1%2C2D1%2C3D1%2C5D1"

# =============================================================================
# VECTOR MAPPINGS
# =============================================================================

# Infrastructure vectors (Table 36-10-0608-01)
INFRA_VECTORS = {
    'fuel_and_energy': 'v1043878336',
    'transport': 'v1043880016',
    'health': 'v1043876656',
    'housing': 'v1043879176',
    'education': 'v1043877496',
    'public_order': 'v1043884216',
    'transit': 'v1043880856',
    'environmental': 'v1043881696',
    'communication': 'v1043882536',
    'recreation': 'v1043883376',
    'pipeline_transport': 'v1043880063',
}

# Economic contribution vectors (Table 36-10-0610-01)
ECON_VECTORS = {
    'jobs_direct': 'v1044855486',
    'jobs_indirect': 'v1044855495',
    'income_direct': 'v1044301086',
    'income_indirect': 'v1044301095',
    'gdp_direct': 'v1044578286',
    'gdp_indirect': 'v1044578295',
}

# =============================================================================
# UTILITY FUNCTIONS
# =============================================================================

def get_data_dir():
    """Ensure data directory exists and return path."""
    os.makedirs(DATA_DIR, exist_ok=True)
    return DATA_DIR


def get_data_paths():
    """Get paths to data and metadata CSV files."""
    data_dir = get_data_dir()
    return (
        os.path.join(data_dir, "data.csv"),
        os.path.join(data_dir, "metadata.csv")
    )


def fetch_csv_from_url(url, timeout=120):
    """Fetch CSV data from a URL and return as DataFrame."""
    print(f"Fetching data from StatCan...")
    response = requests.get(url, timeout=timeout)
    response.raise_for_status()
    return pd.read_csv(io.StringIO(response.text))


# =============================================================================
# PAGE 24: CAPITAL EXPENDITURES
# =============================================================================

def process_page24_data():
    """
    Fetch capital expenditures data from StatCan and process for Page 24.
    
    Returns list of tuples: (vector, year, value) for data.csv
    and list of tuples: (vector, title, uom, scalar_factor) for metadata.csv
    """
    print("Processing Page 24: Capital Expenditures...")
    
    df = fetch_csv_from_url(get_capital_expenditures_url())
    
    # Filter for capital expenditures only
    df = df[df['Capital and repair expenditures'] == 'Capital expenditures'].copy()
    df['year'] = pd.to_numeric(df['REF_DATE'], errors='coerce')
    
    years = sorted(df['year'].dropna().unique())
    naics_col = 'North American Industry Classification System (NAICS)'
    
    data_rows = []
    
    for year in years:
        year_df = df[df['year'] == year]
        
        # Oil and gas extraction [211]
        oil_gas_mask = year_df[naics_col].str.match(r'^Oil and gas extraction \[211\]$', na=False)
        oil_gas = year_df.loc[oil_gas_mask, 'VALUE'].sum()
        
        # Electric power generation, transmission and distribution [2211]
        elec_mask = year_df[naics_col].str.contains(r'\[2211\]', regex=True, na=False)
        electricity = year_df.loc[elec_mask, 'VALUE'].sum()
        
        # Other: [213], [2212], [324], [486]
        other_mask = year_df[naics_col].str.contains(r'\[213\]|\[2212\]|\[324\]|\[486\]', regex=True, na=False)
        other = year_df.loc[other_mask, 'VALUE'].sum()
        
        total = oil_gas + electricity + other
        
        if total > 0:
            year_int = int(year)
            data_rows.extend([
                ('page24_oil_gas', year_int, round(oil_gas, 1)),
                ('page24_electricity', year_int, round(electricity, 1)),
                ('page24_other', year_int, round(other, 1)),
                ('page24_total', year_int, round(total, 1)),
            ])
    
    # Metadata
    metadata_rows = [
        ('page24_oil_gas', 'Capital expenditures - Oil and gas extraction', 'Millions of dollars', 'millions'),
        ('page24_electricity', 'Capital expenditures - Electric power', 'Millions of dollars', 'millions'),
        ('page24_other', 'Capital expenditures - Other energy', 'Millions of dollars', 'millions'),
        ('page24_total', 'Capital expenditures - Total energy sector', 'Millions of dollars', 'millions'),
    ]
    
    print(f"  Page 24: {len(data_rows)} data rows")
    return data_rows, metadata_rows


# =============================================================================
# PAGE 25: INFRASTRUCTURE STOCK
# =============================================================================

def process_page25_data():
    """
    Fetch infrastructure stock data from StatCan and process for Page 25.
    
    Returns list of tuples for data.csv and metadata.csv
    """
    print("Processing Page 25: Infrastructure Stock...")
    
    df = fetch_csv_from_url(get_infrastructure_url())
    
    # Build vector to value mapping by year
    all_vectors = list(INFRA_VECTORS.values())
    
    # Filter for our vectors
    df_filtered = df[df['VECTOR'].isin(all_vectors)].copy()
    df_filtered['year'] = pd.to_numeric(df_filtered['REF_DATE'], errors='coerce')
    
    years = sorted(df_filtered['year'].dropna().unique())
    data_rows = []
    
    for year in years:
        year_df = df_filtered[df_filtered['year'] == year]
        
        # Get values for each vector
        def get_val(vector_key):
            vec = INFRA_VECTORS.get(vector_key)
            row = year_df[year_df['VECTOR'] == vec]
            return row['VALUE'].sum() if not row.empty else 0
        
        # Get raw values
        fuel_energy = get_val('fuel_and_energy')
        transport_raw = get_val('transport')
        pipeline_transport = get_val('pipeline_transport')
        health = get_val('health')
        housing = get_val('housing')
        education = get_val('education')
        public_order = get_val('public_order')
        transit = get_val('transit')
        environmental = get_val('environmental')
        communication = get_val('communication')
        recreation = get_val('recreation')
        
        # Calculate combined categories per NRCAN Factbook
        fuel_energy_pipelines = fuel_energy + pipeline_transport
        transport = transport_raw - pipeline_transport  # Transport less pipelines
        health_housing = health + housing
        public_safety = public_order + transit + communication + recreation
        
        total = fuel_energy_pipelines + transport + health_housing + education + public_safety + environmental
        
        if total > 0:
            year_int = int(year)
            data_rows.extend([
                ('page25_fuel_energy_pipelines', year_int, round(fuel_energy_pipelines, 1)),
                ('page25_transport', year_int, round(transport, 1)),
                ('page25_health_housing', year_int, round(health_housing, 1)),
                ('page25_education', year_int, round(education, 1)),
                ('page25_public_safety', year_int, round(public_safety, 1)),
                ('page25_environmental', year_int, round(environmental, 1)),
                ('page25_total', year_int, round(total, 1)),
            ])
    
    # Metadata
    metadata_rows = [
        ('page25_fuel_energy_pipelines', 'Infrastructure - Fuel, energy and pipelines', 'Millions of dollars', 'millions'),
        ('page25_transport', 'Infrastructure - Transport (less pipelines)', 'Millions of dollars', 'millions'),
        ('page25_health_housing', 'Infrastructure - Health and housing', 'Millions of dollars', 'millions'),
        ('page25_education', 'Infrastructure - Education', 'Millions of dollars', 'millions'),
        ('page25_public_safety', 'Infrastructure - Public safety and other', 'Millions of dollars', 'millions'),
        ('page25_environmental', 'Infrastructure - Environmental protection', 'Millions of dollars', 'millions'),
        ('page25_total', 'Infrastructure - Total net stock', 'Millions of dollars', 'millions'),
    ]
    
    print(f"  Page 25: {len(data_rows)} data rows")
    return data_rows, metadata_rows


# =============================================================================
# PAGE 27: INVESTMENT BY ASSET TYPE (Fuel, Energy and Pipeline Infrastructure)
# =============================================================================

def get_investment_by_asset_url():
    """Get investment by asset type URL (Table 36-10-0608-01) with detailed asset breakdown."""
    # This URL fetches investment data with detailed asset type breakdown
    # Asset indices: 40=Wind/Solar, 41=Steam, 42=Nuclear, 43=Hydraulic, 44=Other electric, 
    # 45=Transmission lines, 46=Distribution lines, 48=Pipelines, 57=Transformers
    return "https://www150.statcan.gc.ca/t1/tbl1/en/dtl!downloadDbLoadingData.action?pid=3610060801&latestN=0&startDate=20070101&endDate=20301231&csvLocale=en&selectedMembers=%5B%5B%5D%2C%5B1%5D%2C%5B2%5D%2C%5B%5D%2C%5B40%2C41%2C42%2C43%2C44%2C45%2C46%2C48%2C57%5D%2C%5B%5D%5D&checkedLevels=0D1%2C3D1%2C5D1"


def process_page27_data():
    """
    Fetch investment by asset type data from StatCan and process for Page 27.
    This breaks down fuel, energy and pipeline infrastructure by specific asset types.
    
    Returns list of tuples for data.csv and metadata.csv
    """
    print("Processing Page 27: Investment by Asset Type...")
    
    df = fetch_csv_from_url(get_investment_by_asset_url())
    
    # Get the asset column name
    asset_col = 'Asset'
    
    # Filter data and convert year
    df['year'] = pd.to_numeric(df['REF_DATE'], errors='coerce')
    
    # Filter for years 2009 onwards
    df = df[df['year'] >= 2009].copy()
    
    years = sorted(df['year'].dropna().unique())
    data_rows = []
    
    # Exact asset names from StatCan Table 36-10-0608-01
    # Based on the actual data structure
    asset_exact_names = {
        'wind_solar': 'Wind and solar power plants',
        'steam_thermal': 'Steam production plants',
        'nuclear': 'Nuclear production plants',
        'hydraulic': 'Hydraulic production plants',
        'other_electric': 'Other electric power construction',
        'transmission_networks': 'Power transmission networks',
        'distribution_networks': 'Power distribution networks',
        'pipelines': 'Pipelines',
        'transformers': 'Power and distribution transformers',
    }
    
    for year in years:
        year_df = df[df['year'] == year]
        year_int = int(year)
        
        values = {}
        for key, exact_name in asset_exact_names.items():
            mask = year_df[asset_col] == exact_name
            values[key] = year_df.loc[mask, 'VALUE'].sum()
        
        # Combine transmission networks + distribution networks + transformers into one category
        transmission_distribution = values.get('transmission_networks', 0) + values.get('distribution_networks', 0) + values.get('transformers', 0)
        
        # Calculate total
        total = (transmission_distribution + values.get('pipelines', 0) + values.get('nuclear', 0) + 
                 values.get('other_electric', 0) + values.get('hydraulic', 0) + 
                 values.get('wind_solar', 0) + values.get('steam_thermal', 0))
        
        if total > 0:
            data_rows.extend([
                ('page27_transmission_distribution', year_int, round(transmission_distribution, 1)),
                ('page27_pipelines', year_int, round(values.get('pipelines', 0), 1)),
                ('page27_nuclear', year_int, round(values.get('nuclear', 0), 1)),
                ('page27_other_electric', year_int, round(values.get('other_electric', 0), 1)),
                ('page27_hydraulic', year_int, round(values.get('hydraulic', 0), 1)),
                ('page27_wind_solar', year_int, round(values.get('wind_solar', 0), 1)),
                ('page27_steam_thermal', year_int, round(values.get('steam_thermal', 0), 1)),
                ('page27_total', year_int, round(total, 1)),
            ])
    
    # Metadata
    metadata_rows = [
        ('page27_transmission_distribution', 'Investment - Transmission, distribution and transformers', 'Millions of dollars', 'millions'),
        ('page27_pipelines', 'Investment - Pipelines', 'Millions of dollars', 'millions'),
        ('page27_nuclear', 'Investment - Nuclear production plants', 'Millions of dollars', 'millions'),
        ('page27_other_electric', 'Investment - Other electric power construction', 'Millions of dollars', 'millions'),
        ('page27_hydraulic', 'Investment - Hydraulic production plants', 'Millions of dollars', 'millions'),
        ('page27_wind_solar', 'Investment - Wind and solar power plants', 'Millions of dollars', 'millions'),
        ('page27_steam_thermal', 'Investment - Steam production plants', 'Millions of dollars', 'millions'),
        ('page27_total', 'Investment - Total fuel, energy and pipeline', 'Millions of dollars', 'millions'),
    ]
    
    print(f"  Page 27: {len(data_rows)} data rows")
    return data_rows, metadata_rows


# =============================================================================
# PAGE 26: ECONOMIC CONTRIBUTIONS
# =============================================================================

def process_page26_data():
    """
    Fetch economic contributions data from StatCan and process for Page 26.
    
    Returns list of tuples for data.csv and metadata.csv
    """
    print("Processing Page 26: Economic Contributions...")
    
    # Fetch economic contributions data
    df_econ = fetch_csv_from_url(get_economic_contributions_url())
    
    # Filter for our vectors
    all_vectors = list(ECON_VECTORS.values())
    df_filtered = df_econ[df_econ['VECTOR'].isin(all_vectors)].copy()
    df_filtered['year'] = pd.to_numeric(df_filtered['REF_DATE'], errors='coerce')
    
    # Also fetch capital expenditures for investment values
    df_capex = fetch_csv_from_url(get_capital_expenditures_url())
    df_capex = df_capex[df_capex['Capital and repair expenditures'] == 'Capital expenditures'].copy()
    df_capex['year'] = pd.to_numeric(df_capex['REF_DATE'], errors='coerce')
    naics_col = 'North American Industry Classification System (NAICS)'
    
    years = sorted(df_filtered['year'].dropna().unique())
    data_rows = []
    
    for year in years:
        year_df = df_filtered[df_filtered['year'] == year]
        
        # Get values for each vector
        def get_val(vector_key):
            vec = ECON_VECTORS.get(vector_key)
            row = year_df[year_df['VECTOR'] == vec]
            return row['VALUE'].iloc[0] if not row.empty and pd.notna(row['VALUE'].iloc[0]) else 0
        
        # Jobs: Direct + Indirect (in thousands from StatCan, convert to actual)
        jobs_direct = get_val('jobs_direct')
        jobs_indirect = get_val('jobs_indirect')
        jobs = (jobs_direct + jobs_indirect) * 1000  # Convert thousands to actual
        
        # Employment income: Direct + Indirect (in millions)
        income_direct = get_val('income_direct')
        income_indirect = get_val('income_indirect')
        employment_income = income_direct + income_indirect
        
        # GDP: Direct + Indirect (in millions)
        gdp_direct = get_val('gdp_direct')
        gdp_indirect = get_val('gdp_indirect')
        gdp = gdp_direct + gdp_indirect
        
        # Investment value: Sum of fuel/energy/pipeline related capital expenditures
        year_capex = df_capex[df_capex['year'] == year]
        investment_mask = year_capex[naics_col].str.contains(
            r'\[211\]|\[2211\]|\[2212\]|\[486\]|\[324\]', regex=True, na=False
        )
        investment_value = year_capex.loc[investment_mask, 'VALUE'].sum()
        
        if any([jobs, employment_income, gdp]):
            year_int = int(year)
            data_rows.extend([
                ('page26_jobs', year_int, round(jobs, 0)),
                ('page26_employment_income', year_int, round(employment_income, 1)),
                ('page26_gdp', year_int, round(gdp, 1)),
                ('page26_investment_value', year_int, round(investment_value, 1)),
            ])
    
    # Metadata
    metadata_rows = [
        ('page26_jobs', 'Economic contributions - Jobs (direct + indirect)', 'Number', 'units'),
        ('page26_employment_income', 'Economic contributions - Employment income', 'Millions of dollars', 'millions'),
        ('page26_gdp', 'Economic contributions - GDP', 'Millions of dollars', 'millions'),
        ('page26_investment_value', 'Annual investment - Fuel, energy and pipelines', 'Millions of dollars', 'millions'),
    ]
    
    print(f"  Page 26: {len(data_rows)} data rows")
    return data_rows, metadata_rows


# =============================================================================
# MAIN FUNCTION
# =============================================================================

def refresh_all_data():
    """Fetch, process and save all page data from StatCan to data.csv and metadata.csv."""
    print("=" * 60)
    print("Refreshing all data from Statistics Canada...")
    print("=" * 60)
    
    all_data = []
    all_metadata = []
    
    # Process each page
    data24, meta24 = process_page24_data()
    all_data.extend(data24)
    all_metadata.extend(meta24)
    
    data25, meta25 = process_page25_data()
    all_data.extend(data25)
    all_metadata.extend(meta25)
    
    data26, meta26 = process_page26_data()
    all_data.extend(data26)
    all_metadata.extend(meta26)
    
    data27, meta27 = process_page27_data()
    all_data.extend(data27)
    all_metadata.extend(meta27)
    
    # Create DataFrames
    data_df = pd.DataFrame(all_data, columns=['vector', 'ref_date', 'value'])
    metadata_df = pd.DataFrame(all_metadata, columns=['vector', 'title', 'uom', 'scalar_factor'])
    
    # Remove duplicates
    data_df = data_df.drop_duplicates(subset=['vector', 'ref_date'], keep='first')
    metadata_df = metadata_df.drop_duplicates(subset=['vector'], keep='first')
    
    # Save to CSV
    data_path, metadata_path = get_data_paths()
    data_df.to_csv(data_path, index=False)
    metadata_df.to_csv(metadata_path, index=False)
    
    print("=" * 60)
    print(f"Saved {len(data_df)} rows to {data_path}")
    print(f"Saved {len(metadata_df)} rows to {metadata_path}")
    print("All data refreshed successfully!")
    print("=" * 60)
    
    return data_df, metadata_df


if __name__ == "__main__":
    refresh_all_data()
