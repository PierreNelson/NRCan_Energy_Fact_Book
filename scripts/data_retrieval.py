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

# Data directory - outputs directly to public/data/ where the app reads from
DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "public", "data")

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

def get_international_investment_url():
    """Get international investment URL (Table 36-10-0009-01).
    
    Returns FDI (Foreign Direct Investment) and CDIA (Canadian Direct Investment Abroad)
    for energy-related industries.
    """
    return "https://www150.statcan.gc.ca/t1/tbl1/en/dtl!downloadDbLoadingData.action?pid=3610000901&latestN=0&startDate=20070101&endDate=20301212&csvLocale=en&selectedMembers=%5B%5B%5D%2C%5B1%2C16%2C18%2C19%2C30%5D%2C%5B%5D%2C%5B%5D%5D&checkedLevels=0D1%2C2D1%2C3D1"

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
# PAGE 31: INTERNATIONAL INVESTMENTS (FDI and CDIA)
# =============================================================================

def process_page31_data():
    """
    Fetch international investment data from StatCan and process for Page 31.
    
    FDI = Foreign Direct Investment in Canada
    CDIA = Canadian Direct Investment Abroad
    
    Energy industries include:
    - Mining and oil and gas extraction [21]
    - Utilities [22]
    - Pipeline transportation [486]
    - Petroleum and coal products manufacturing [324]
    
    Returns list of tuples for data.csv and metadata.csv
    """
    print("Processing Page 31: International Investments...")
    
    df = fetch_csv_from_url(get_international_investment_url())
    
    print(f"  Total rows fetched: {len(df)}")
    print(f"  Columns: {df.columns.tolist()}")
    
    # Column names
    naics_col = 'North American Industry Classification System (NAICS)'
    investment_col = 'Canadian and foreign direct investment'
    
    # Check if columns exist
    if naics_col not in df.columns:
        print(f"  WARNING: Column '{naics_col}' not found!")
        print(f"  Available columns: {df.columns.tolist()}")
        return [], []
    
    # Print unique industry names for debugging
    unique_industries = df[naics_col].unique().tolist()
    print(f"  Found {len(unique_industries)} unique industries:")
    for ind in unique_industries:
        print(f"    - {ind}")
    
    # Energy industries to sum for FDI/CDIA totals
    # The URL returns child categories [211], [213] instead of parent [21]
    energy_industries = [
        'Oil and gas extraction [211]',
        'Support activities for mining and oil and gas extraction [213]',
        'Utilities [22]',
        'Petroleum and coal products manufacturing [324]'
    ]
    
    # Find which energy industries are in the data
    found_industries = [ind for ind in unique_industries if ind in energy_industries]
    for ind in found_industries:
        print(f"    Using: {ind}")
    
    # Convert year
    df['year'] = pd.to_numeric(df['REF_DATE'], errors='coerce')
    
    # Filter for years 2007 onwards (matching factbook chart)
    df = df[df['year'] >= 2007].copy()
    
    years = sorted(df['year'].dropna().unique())
    data_rows = []
    
    for year in years:
        year_df = df[df['year'] == year]
        year_int = int(year)
        
        # Filter for energy industries
        year_energy = year_df[year_df[naics_col].isin(found_industries)]
        
        # Sum CDIA for all energy industries
        cdia_mask = year_energy[investment_col].str.contains('Canadian direct investment abroad', case=False, na=False)
        cdia_total = year_energy.loc[cdia_mask, 'VALUE'].sum()
        
        # Sum FDI for all energy industries
        fdi_mask = year_energy[investment_col].str.contains('Foreign direct investment in Canada', case=False, na=False)
        fdi_total = year_energy.loc[fdi_mask, 'VALUE'].sum()
        
        if cdia_total > 0 or fdi_total > 0:
            # Values are in millions
            data_rows.extend([
                ('page31_cdia', year_int, round(cdia_total, 1)),
                ('page31_fdi', year_int, round(fdi_total, 1)),
            ])
            # Debug print for first and last years
            if year_int == 2007 or year_int == max(years):
                print(f"    {year_int}: CDIA={cdia_total}M, FDI={fdi_total}M")
    
    # Metadata
    metadata_rows = [
        ('page31_cdia', 'Canadian direct investment abroad (CDIA) - Energy industry', 'Millions of dollars', 'millions'),
        ('page31_fdi', 'Foreign direct investment in Canada (FDI) - Energy industry', 'Millions of dollars', 'millions'),
    ]
    
    print(f"  Page 31: {len(data_rows)} data rows")
    return data_rows, metadata_rows


# =============================================================================
# PAGE 32: FOREIGN CONTROL OF CANADIAN ASSETS (Table 33-10-0570-01)
# =============================================================================

def get_environmental_protection_url():
    """Get environmental protection expenditures URL (Table 38-10-0130-01).
    
    Returns data for:
    - Oil and gas extraction [211]
    - Electric power generation [2211]
    - Petroleum and coal product manufacturing [324]
    - Total industries
    
    Environmental activities:
    - Total, environmental protection activities
    - Solid waste management
    - Wastewater management
    - Air pollution management
    - Protection and remediation of soil, groundwater and surface water
    - Other environmental protection activities
    """
    return "https://www150.statcan.gc.ca/t1/tbl1/en/dtl!downloadDbLoadingData.action?pid=3810013001&latestN=0&startDate=20070101&endDate=20301212&csvLocale=en&selectedMembers=%5B%5B%5D%2C%5B%5D%2C%5B3%2C5%2C6%2C11%5D%2C%5B12%2C13%2C14%2C15%5D%5D&checkedLevels=0D1%2C1D1%2C2D1%2C3D1%2C3D2"

def get_foreign_control_url():
    """Get foreign control URL (Table 33-10-0570-01).
    
    Returns percentage of total assets under foreign control for:
    - Total non-financial industries
    - Oil and gas extraction and support activities [211, 213]
    - Utilities [22]
    """
    return "https://www150.statcan.gc.ca/t1/tbl1/en/dtl!downloadDbLoadingData.action?pid=3310057001&latestN=0&startDate=20100101&endDate=20301212&csvLocale=en&selectedMembers=%5B%5B%5D%2C%5B3%2C9%2C11%5D%2C%5B2%5D%2C%5B2%5D%5D&checkedLevels=0D1"


def process_page32_data():
    """
    Fetch foreign control data from StatCan and process for Page 32.
    
    Returns percentage of total assets under foreign control for different industries.
    
    Returns list of tuples for data.csv and metadata.csv
    """
    print("Processing Page 32: Foreign Control of Canadian Assets...")
    
    df = fetch_csv_from_url(get_foreign_control_url())
    
    print(f"  Total rows fetched: {len(df)}")
    
    # Column names
    naics_col = 'North American Industry Classification System (NAICS)'
    
    # Print unique industry names for debugging
    unique_industries = df[naics_col].unique().tolist()
    print(f"  Found {len(unique_industries)} unique industries:")
    for ind in unique_industries:
        print(f"    - {ind}")
    
    # Map industries to keys
    industry_mapping = {
        'Total non-financial industries (excluding management of companies and enterprises)': 'all_non_financial',
        'Oil and gas extraction and support activities [211, 213]': 'oil_gas',
        'Utilities [22]': 'utilities'
    }
    
    # Convert year
    df['year'] = pd.to_numeric(df['REF_DATE'], errors='coerce')
    
    # Filter for years 2010 onwards
    df = df[df['year'] >= 2010].copy()
    
    years = sorted(df['year'].dropna().unique())
    data_rows = []
    
    for year in years:
        year_df = df[df['year'] == year]
        year_int = int(year)
        
        for industry_name, key in industry_mapping.items():
            industry_row = year_df[year_df[naics_col] == industry_name]
            if not industry_row.empty:
                value = industry_row['VALUE'].values[0]
                if pd.notna(value):
                    data_rows.append((f'page32_{key}', year_int, round(value, 1)))
        
        # Debug print for first and last years
        if year_int == 2010 or year_int == max(years):
            print(f"    {year_int}: Data processed")
    
    # Metadata
    metadata_rows = [
        ('page32_utilities', 'Utilities - Percentage of total assets under foreign control', 'Percent', 'units'),
        ('page32_oil_gas', 'Oil and gas extraction and support activities - Percentage of total assets under foreign control', 'Percent', 'units'),
        ('page32_all_non_financial', 'Total non-financial industries - Percentage of total assets under foreign control', 'Percent', 'units'),
    ]
    
    print(f"  Page 32: {len(data_rows)} data rows")
    return data_rows, metadata_rows


# =============================================================================
# PAGE 37: ENVIRONMENTAL PROTECTION EXPENDITURES
# =============================================================================

def process_page37_data():
    """Process environmental protection expenditures data (Table 38-10-0130-01).
    
    Creates virtual vectors:
    - page37_oil_gas_total: Oil and gas extraction total expenditures
    - page37_oil_gas_wastewater: Oil and gas - Wastewater management
    - page37_oil_gas_soil: Oil and gas - Protection and remediation of soil, groundwater and surface water
    - page37_oil_gas_air: Oil and gas - Air pollution management
    - page37_oil_gas_solid_waste: Oil and gas - Solid waste management
    - page37_oil_gas_other: Oil and gas - Other environmental protection activities
    - page37_electric_total: Electric power generation total expenditures
    - page37_petroleum_total: Petroleum and coal product manufacturing total expenditures
    - page37_all_industries_total: Total industries total expenditures
    """
    print("\nProcessing Page 37 data (Environmental Protection Expenditures)...")
    
    url = get_environmental_protection_url()
    response = requests.get(url)
    response.raise_for_status()
    
    df = pd.read_csv(io.StringIO(response.text))
    print(f"  Downloaded {len(df)} rows from StatCan")
    
    # Filter for Total expenditures only
    df = df[df['Expenditures'] == 'Total, expenditures'].copy()
    
    # Extract year from REF_DATE (format is just "2018", "2019", etc.)
    df['year'] = df['REF_DATE'].astype(int)
    
    # Define main activity categories (shown individually in the pie chart)
    main_activities = {
        'wastewater': 'Wastewater management',
        'soil': 'Protection and remediation of soil, groundwater and surface water',
        'air': 'Air pollution management',
        'solid_waste': 'Solid waste management',
        'total': 'Total, environmental protection activities'
    }
    
    # Categories to sum into "Other" (as per the factbook)
    # Excludes: Noise and vibration abatement, Protection against radiation, Clean vehicles and transportation technologies
    other_activities = [
        'Protection of biodiversity and habitat',
        'Environmental charges',
        'Other environmental protection activities'
    ]
    
    # Define industries
    industries = {
        'oil_gas': 'Oil and gas extraction [211]',
        'electric': 'Electric power generation, transmission and distribution [2211]',
        'natural_gas': 'Natural gas distribution [2212]',
        'petroleum': 'Petroleum and coal product manufacturing [324]',
        'all_industries': 'Total, industries'
    }
    
    data_rows = []
    
    # Process each year
    for year in df['year'].unique():
        year_df = df[df['year'] == year]
        
        # Oil and gas extraction - main activities
        for act_key, act_name in main_activities.items():
            oil_gas_df = year_df[(year_df['Industries'] == industries['oil_gas']) & 
                                  (year_df['Environmental protection activities'] == act_name)]
            if len(oil_gas_df) > 0:
                value = oil_gas_df['VALUE'].values[0]
                if pd.notna(value):
                    data_rows.append((f'page37_oil_gas_{act_key}', year, float(value)))
        
        # Oil and gas extraction - sum "other" categories
        other_sum = 0
        for other_act in other_activities:
            oil_gas_other_df = year_df[(year_df['Industries'] == industries['oil_gas']) & 
                                        (year_df['Environmental protection activities'] == other_act)]
            if len(oil_gas_other_df) > 0:
                value = oil_gas_other_df['VALUE'].values[0]
                if pd.notna(value):
                    other_sum += float(value)
        if other_sum > 0:
            data_rows.append(('page37_oil_gas_other', year, other_sum))
        
        # Electric power generation - total only
        electric_df = year_df[(year_df['Industries'] == industries['electric']) & 
                               (year_df['Environmental protection activities'] == main_activities['total'])]
        if len(electric_df) > 0:
            value = electric_df['VALUE'].values[0]
            if pd.notna(value):
                data_rows.append(('page37_electric_total', year, float(value)))
        
        # Natural gas distribution - total only
        natural_gas_df = year_df[(year_df['Industries'] == industries['natural_gas']) & 
                                  (year_df['Environmental protection activities'] == main_activities['total'])]
        if len(natural_gas_df) > 0:
            value = natural_gas_df['VALUE'].values[0]
            if pd.notna(value):
                data_rows.append(('page37_natural_gas_total', year, float(value)))
        
        # Petroleum and coal products - total only
        petroleum_df = year_df[(year_df['Industries'] == industries['petroleum']) & 
                                (year_df['Environmental protection activities'] == main_activities['total'])]
        if len(petroleum_df) > 0:
            value = petroleum_df['VALUE'].values[0]
            if pd.notna(value):
                data_rows.append(('page37_petroleum_total', year, float(value)))
        
        # Petroleum and coal products - pollution abatement categories (air + wastewater + solid waste + soil)
        # These sum to the "pollution abatement and control" percentage in the factbook
        pollution_categories = ['air', 'wastewater', 'solid_waste', 'soil']
        pollution_sum = 0
        for cat in pollution_categories:
            petroleum_cat_df = year_df[(year_df['Industries'] == industries['petroleum']) & 
                                        (year_df['Environmental protection activities'] == main_activities[cat])]
            if len(petroleum_cat_df) > 0:
                value = petroleum_cat_df['VALUE'].values[0]
                if pd.notna(value):
                    pollution_sum += float(value)
        if pollution_sum > 0:
            data_rows.append(('page37_petroleum_pollution', year, pollution_sum))
        
        # All industries - total only
        all_ind_df = year_df[(year_df['Industries'] == industries['all_industries']) & 
                              (year_df['Environmental protection activities'] == main_activities['total'])]
        if len(all_ind_df) > 0:
            value = all_ind_df['VALUE'].values[0]
            if pd.notna(value):
                data_rows.append(('page37_all_industries_total', year, float(value)))
    
    # Create metadata rows
    metadata_rows = [
        ('page37_oil_gas_total', 'Oil and gas extraction - Total environmental protection expenditures', 'Millions of dollars', 'millions'),
        ('page37_oil_gas_wastewater', 'Oil and gas extraction - Wastewater management', 'Millions of dollars', 'millions'),
        ('page37_oil_gas_soil', 'Oil and gas extraction - Protection and remediation of soil, groundwater and surface water', 'Millions of dollars', 'millions'),
        ('page37_oil_gas_air', 'Oil and gas extraction - Air pollution management', 'Millions of dollars', 'millions'),
        ('page37_oil_gas_solid_waste', 'Oil and gas extraction - Solid waste management', 'Millions of dollars', 'millions'),
        ('page37_oil_gas_other', 'Oil and gas extraction - Other environmental protection activities', 'Millions of dollars', 'millions'),
        ('page37_electric_total', 'Electric power generation - Total environmental protection expenditures', 'Millions of dollars', 'millions'),
        ('page37_natural_gas_total', 'Natural gas distribution - Total environmental protection expenditures', 'Millions of dollars', 'millions'),
        ('page37_petroleum_total', 'Petroleum and coal product manufacturing - Total environmental protection expenditures', 'Millions of dollars', 'millions'),
        ('page37_petroleum_pollution', 'Petroleum and coal product manufacturing - Pollution abatement and control', 'Millions of dollars', 'millions'),
        ('page37_all_industries_total', 'Total industries - Total environmental protection expenditures', 'Millions of dollars', 'millions'),
    ]
    
    print(f"  Page 37: {len(data_rows)} data rows")
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
    
    data31, meta31 = process_page31_data()
    all_data.extend(data31)
    all_metadata.extend(meta31)
    
    data32, meta32 = process_page32_data()
    all_data.extend(data32)
    all_metadata.extend(meta32)
    
    data37, meta37 = process_page37_data()
    all_data.extend(data37)
    all_metadata.extend(meta37)
    
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
