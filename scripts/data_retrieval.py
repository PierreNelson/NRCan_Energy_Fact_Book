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
from datetime import datetime, timedelta

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "public", "data")

def get_future_end_date(years_ahead=2):
    """
    Generate a future end date for StatCan API requests.
    
    StatCan URLs use future end dates to ensure all available data is returned.
    The API returns whatever data exists up to the current date, regardless of 
    the end date specified. Using a dynamic future date (today + N years) ensures:
    - New data is automatically included when StatCan publishes it
    - The script doesn't stop working after a hardcoded date passes
    
    Args:
        years_ahead: Number of years into the future (default: 2)
    
    Returns:
        Date string in YYYYMMDD format (e.g., "20280125" for 2 years from Jan 25, 2026)
    """
    future_date = datetime.now() + timedelta(days=365 * years_ahead)
    return future_date.strftime("%Y%m%d")


def get_capital_expenditures_url():
    """Get capital expenditures URL (Table 34-10-0036-01)."""
    end_date = get_future_end_date()
    return f"https://www150.statcan.gc.ca/t1/tbl1/en/dtl!downloadDbLoadingData-nonTraduit.action?pid=3410003601&latestN=0&startDate=20070101&endDate={end_date}&csvLocale=en&selectedMembers=%5B%5B%5D%2C%5B1%5D%2C%5B8%2C9%2C11%2C34%2C36%2C37%2C50%2C91%5D%5D&checkedLevels=0D1"

def get_infrastructure_url():
    """Get infrastructure URL (Table 36-10-0608-01)."""
    end_date = get_future_end_date()
    return f"https://www150.statcan.gc.ca/t1/tbl1/en/dtl!downloadDbLoadingData.action?pid=3610060801&latestN=0&startDate=20070101&endDate={end_date}&csvLocale=en&selectedMembers=%5B%5B%5D%2C%5B3%5D%2C%5B1%5D%2C%5B%5D%2C%5B48%5D%2C%5B%5D%5D&checkedLevels=0D1%2C3D1%2C4D1%2C5D1%2C5D2"

def get_economic_contributions_url():
    """Get economic contributions URL (Table 36-10-0610-01)."""
    end_date = get_future_end_date()
    return f"https://www150.statcan.gc.ca/t1/tbl1/en/dtl!downloadDbLoadingData.action?pid=3610061001&latestN=0&startDate=20070101&endDate={end_date}&csvLocale=en&selectedMembers=%5B%5B%5D%2C%5B%5D%2C%5B%5D%2C%5B%5D%2C%5B39%2C48%2C54%2C55%2C57%5D%2C%5B%5D%5D&checkedLevels=0D1%2C1D1%2C2D1%2C3D1%2C5D1"

def get_international_investment_url():
    """Get international investment URL (Table 36-10-0009-01).
    
    Returns FDI (Foreign Direct Investment) and CDIA (Canadian Direct Investment Abroad)
    for energy-related industries.
    """
    end_date = get_future_end_date()
    return f"https://www150.statcan.gc.ca/t1/tbl1/en/dtl!downloadDbLoadingData.action?pid=3610000901&latestN=0&startDate=20070101&endDate={end_date}&csvLocale=en&selectedMembers=%5B%5B%5D%2C%5B1%2C16%2C18%2C19%2C30%5D%2C%5B%5D%2C%5B%5D%5D&checkedLevels=0D1%2C2D1%2C3D1"


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

ECON_VECTORS = {
    'jobs_direct': 'v1044855486',
    'jobs_indirect': 'v1044855495',
    'income_direct': 'v1044301086',
    'income_indirect': 'v1044301095',
    'gdp_direct': 'v1044578286',
    'gdp_indirect': 'v1044578295',
}


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
    
    try:
        response = requests.get(url, timeout=timeout)
        response.raise_for_status()
        
        text = response.text
        if 'Failed to get' in text or '<html' in text.lower():
            raise ValueError(f"StatCan returned error: {text[:200]}")
        
        df = pd.read_csv(io.StringIO(text))
        
        if len(df.columns) < 3:
            raise ValueError(f"Invalid data format, columns: {df.columns.tolist()}")
            
        return df
        
    except Exception as e:
        alt_url = url.replace('downloadDbLoadingData.action', 'downloadDbLoadingData-nonTraduit.action')
        if alt_url != url:
            print(f"  Primary URL failed, trying alternative...")
            try:
                response = requests.get(alt_url, timeout=timeout)
                response.raise_for_status()
                text = response.text
                if 'Failed to get' in text or '<html' in text.lower():
                    raise ValueError(f"StatCan returned error")
                return pd.read_csv(io.StringIO(text))
            except:
                pass
        
        raise Exception(f"Failed to fetch data from StatCan: {e}")


def process_capital_expenditure_data():
    """
    Fetch capital expenditures data from StatCan.
    
    Returns list of tuples: (vector, year, value) for data.csv
    and list of tuples: (vector, title, uom, scalar_factor) for metadata.csv
    """
    print("Processing Capital Expenditures data...")
    
    df = fetch_csv_from_url(get_capital_expenditures_url())
    
    print(f"  Columns in data: {df.columns.tolist()}")
    
    capex_col = None
    for col in df.columns:
        if 'capital' in col.lower() and 'repair' in col.lower():
            capex_col = col
            break
    
    if capex_col and capex_col in df.columns:
        df = df[df[capex_col] == 'Capital expenditures'].copy()
    
    df['year'] = pd.to_numeric(df['REF_DATE'], errors='coerce')
    
    years = sorted(df['year'].dropna().unique())
    
    naics_col = None
    for col in df.columns:
        if 'naics' in col.lower() or 'industry' in col.lower():
            naics_col = col
            break
    
    if not naics_col:
        naics_col = 'North American Industry Classification System (NAICS)'
    
    data_rows = []
    
    for year in years:
        year_df = df[df['year'] == year]
        
        oil_gas_mask = year_df[naics_col].str.match(r'^Oil and gas extraction \[211\]$', na=False)
        oil_gas = year_df.loc[oil_gas_mask, 'VALUE'].sum()
        
        elec_mask = year_df[naics_col].str.contains(r'\[2211\]', regex=True, na=False)
        electricity = year_df.loc[elec_mask, 'VALUE'].sum()
        
        other_mask = year_df[naics_col].str.contains(r'\[213\]|\[2212\]|\[324\]|\[486\]', regex=True, na=False)
        other = year_df.loc[other_mask, 'VALUE'].sum()
        
        total = oil_gas + electricity + other
        
        if total > 0:
            year_int = int(year)
            data_rows.extend([
                ('capex_oil_gas', year_int, round(oil_gas, 1)),
                ('capex_electricity', year_int, round(electricity, 1)),
                ('capex_other', year_int, round(other, 1)),
                ('capex_total', year_int, round(total, 1)),
            ])
    
    metadata_rows = [
        ('capex_oil_gas', 'Capital expenditures - Oil and gas extraction', 'Millions of dollars', 'millions'),
        ('capex_electricity', 'Capital expenditures - Electric power', 'Millions of dollars', 'millions'),
        ('capex_other', 'Capital expenditures - Other energy', 'Millions of dollars', 'millions'),
        ('capex_total', 'Capital expenditures - Total energy sector', 'Millions of dollars', 'millions'),
    ]
    
    print(f"  Capital Expenditures: {len(data_rows)} data rows")
    return data_rows, metadata_rows


def process_infrastructure_data():
    """
    Fetch infrastructure stock data from StatCan.
    
    Returns list of tuples for data.csv and metadata.csv
    """
    print("Processing Infrastructure Stock data...")
    
    df = fetch_csv_from_url(get_infrastructure_url())
    
    all_vectors = list(INFRA_VECTORS.values())
    
    df_filtered = df[df['VECTOR'].isin(all_vectors)].copy()
    df_filtered['year'] = pd.to_numeric(df_filtered['REF_DATE'], errors='coerce')
    
    years = sorted(df_filtered['year'].dropna().unique())
    data_rows = []
    
    for year in years:
        year_df = df_filtered[df_filtered['year'] == year]
        
        def get_val(vector_key):
            vec = INFRA_VECTORS.get(vector_key)
            row = year_df[year_df['VECTOR'] == vec]
            return row['VALUE'].sum() if not row.empty else 0
        
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
        
        fuel_energy_pipelines = fuel_energy + pipeline_transport
        transport = transport_raw - pipeline_transport
        health_housing = health + housing
        public_safety = public_order + transit + communication + recreation
        
        total = fuel_energy_pipelines + transport + health_housing + education + public_safety + environmental
        
        if total > 0:
            year_int = int(year)
            data_rows.extend([
                ('infra_fuel_energy_pipelines', year_int, round(fuel_energy_pipelines, 1)),
                ('infra_transport', year_int, round(transport, 1)),
                ('infra_health_housing', year_int, round(health_housing, 1)),
                ('infra_education', year_int, round(education, 1)),
                ('infra_public_safety', year_int, round(public_safety, 1)),
                ('infra_environmental', year_int, round(environmental, 1)),
                ('infra_total', year_int, round(total, 1)),
            ])
    
    metadata_rows = [
        ('infra_fuel_energy_pipelines', 'Infrastructure - Fuel, energy and pipelines', 'Millions of dollars', 'millions'),
        ('infra_transport', 'Infrastructure - Transport (less pipelines)', 'Millions of dollars', 'millions'),
        ('infra_health_housing', 'Infrastructure - Health and housing', 'Millions of dollars', 'millions'),
        ('infra_education', 'Infrastructure - Education', 'Millions of dollars', 'millions'),
        ('infra_public_safety', 'Infrastructure - Public safety and other', 'Millions of dollars', 'millions'),
        ('infra_environmental', 'Infrastructure - Environmental protection', 'Millions of dollars', 'millions'),
        ('infra_total', 'Infrastructure - Total net stock', 'Millions of dollars', 'millions'),
    ]
    
    print(f"  Infrastructure: {len(data_rows)} data rows")
    return data_rows, metadata_rows


def get_investment_by_asset_url():
    """Get investment by asset type URL (Table 36-10-0608-01) with detailed asset breakdown."""
    end_date = get_future_end_date()
    return f"https://www150.statcan.gc.ca/t1/tbl1/en/dtl!downloadDbLoadingData.action?pid=3610060801&latestN=0&startDate=20070101&endDate={end_date}&csvLocale=en&selectedMembers=%5B%5B%5D%2C%5B1%5D%2C%5B2%5D%2C%5B%5D%2C%5B40%2C41%2C42%2C43%2C44%2C45%2C46%2C48%2C57%5D%2C%5B%5D%5D&checkedLevels=0D1%2C3D1%2C5D1"


def process_investment_by_asset_data():
    """
    Fetch investment by asset type data from StatCan.
    This breaks down fuel, energy and pipeline infrastructure by specific asset types.
    
    Returns list of tuples for data.csv and metadata.csv
    """
    print("Processing Investment by Asset Type data...")
    
    df = fetch_csv_from_url(get_investment_by_asset_url())
    
    asset_col = 'Asset'
    
    df['year'] = pd.to_numeric(df['REF_DATE'], errors='coerce')
    
    df = df[df['year'] >= 2009].copy()
    
    years = sorted(df['year'].dropna().unique())
    data_rows = []
    
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
        
        transmission_distribution = values.get('transmission_networks', 0) + values.get('distribution_networks', 0) + values.get('transformers', 0)
        
        total = (transmission_distribution + values.get('pipelines', 0) + values.get('nuclear', 0) + 
                 values.get('other_electric', 0) + values.get('hydraulic', 0) + 
                 values.get('wind_solar', 0) + values.get('steam_thermal', 0))
        
        if total > 0:
            data_rows.extend([
                ('asset_transmission_distribution', year_int, round(transmission_distribution, 1)),
                ('asset_pipelines', year_int, round(values.get('pipelines', 0), 1)),
                ('asset_nuclear', year_int, round(values.get('nuclear', 0), 1)),
                ('asset_other_electric', year_int, round(values.get('other_electric', 0), 1)),
                ('asset_hydraulic', year_int, round(values.get('hydraulic', 0), 1)),
                ('asset_wind_solar', year_int, round(values.get('wind_solar', 0), 1)),
                ('asset_steam_thermal', year_int, round(values.get('steam_thermal', 0), 1)),
                ('asset_total', year_int, round(total, 1)),
            ])
    
    metadata_rows = [
        ('asset_transmission_distribution', 'Investment - Transmission, distribution and transformers', 'Millions of dollars', 'millions'),
        ('asset_pipelines', 'Investment - Pipelines', 'Millions of dollars', 'millions'),
        ('asset_nuclear', 'Investment - Nuclear production plants', 'Millions of dollars', 'millions'),
        ('asset_other_electric', 'Investment - Other electric power construction', 'Millions of dollars', 'millions'),
        ('asset_hydraulic', 'Investment - Hydraulic production plants', 'Millions of dollars', 'millions'),
        ('asset_wind_solar', 'Investment - Wind and solar power plants', 'Millions of dollars', 'millions'),
        ('asset_steam_thermal', 'Investment - Steam production plants', 'Millions of dollars', 'millions'),
        ('asset_total', 'Investment - Total fuel, energy and pipeline', 'Millions of dollars', 'millions'),
    ]
    
    print(f"  Investment by Asset: {len(data_rows)} data rows")
    return data_rows, metadata_rows


def process_economic_contributions_data():
    """
    Fetch economic contributions data from StatCan.
    
    Returns list of tuples for data.csv and metadata.csv
    """
    print("Processing Economic Contributions data...")
    
    df_econ = fetch_csv_from_url(get_economic_contributions_url())
    
    all_vectors = list(ECON_VECTORS.values())
    df_filtered = df_econ[df_econ['VECTOR'].isin(all_vectors)].copy()
    df_filtered['year'] = pd.to_numeric(df_filtered['REF_DATE'], errors='coerce')
    
    df_capex = fetch_csv_from_url(get_capital_expenditures_url())
    df_capex = df_capex[df_capex['Capital and repair expenditures'] == 'Capital expenditures'].copy()
    df_capex['year'] = pd.to_numeric(df_capex['REF_DATE'], errors='coerce')
    naics_col = 'North American Industry Classification System (NAICS)'
    
    years = sorted(df_filtered['year'].dropna().unique())
    data_rows = []
    
    for year in years:
        year_df = df_filtered[df_filtered['year'] == year]
        
        def get_val(vector_key):
            vec = ECON_VECTORS.get(vector_key)
            row = year_df[year_df['VECTOR'] == vec]
            return row['VALUE'].iloc[0] if not row.empty and pd.notna(row['VALUE'].iloc[0]) else 0
        
        jobs_direct = get_val('jobs_direct')
        jobs_indirect = get_val('jobs_indirect')
        jobs = (jobs_direct + jobs_indirect) * 1000
        
        income_direct = get_val('income_direct')
        income_indirect = get_val('income_indirect')
        employment_income = income_direct + income_indirect
        
        gdp_direct = get_val('gdp_direct')
        gdp_indirect = get_val('gdp_indirect')
        gdp = gdp_direct + gdp_indirect
        
        year_capex = df_capex[df_capex['year'] == year]
        investment_mask = year_capex[naics_col].str.contains(
            r'\[211\]|\[2211\]|\[2212\]|\[486\]|\[324\]', regex=True, na=False
        )
        investment_value = year_capex.loc[investment_mask, 'VALUE'].sum()
        
        if any([jobs, employment_income, gdp]):
            year_int = int(year)
            data_rows.extend([
                ('econ_jobs', year_int, round(jobs, 0)),
                ('econ_employment_income', year_int, round(employment_income, 1)),
                ('econ_gdp', year_int, round(gdp, 1)),
                ('econ_investment_value', year_int, round(investment_value, 1)),
            ])
    
    metadata_rows = [
        ('econ_jobs', 'Economic contributions - Jobs (direct + indirect)', 'Number', 'units'),
        ('econ_employment_income', 'Economic contributions - Employment income', 'Millions of dollars', 'millions'),
        ('econ_gdp', 'Economic contributions - GDP', 'Millions of dollars', 'millions'),
        ('econ_investment_value', 'Annual investment - Fuel, energy and pipelines', 'Millions of dollars', 'millions'),
    ]
    
    print(f"  Economic Contributions: {len(data_rows)} data rows")
    return data_rows, metadata_rows


def process_international_investment_data():
    """
    Fetch international investment data from StatCan.
    
    FDI = Foreign Direct Investment in Canada
    CDIA = Canadian Direct Investment Abroad
    
    Energy industries include:
    - Mining and oil and gas extraction [21]
    - Utilities [22]
    - Pipeline transportation [486]
    - Petroleum and coal products manufacturing [324]
    
    Returns list of tuples for data.csv and metadata.csv
    """
    print("Processing International Investment data...")
    
    df = fetch_csv_from_url(get_international_investment_url())
    
    print(f"  Total rows fetched: {len(df)}")
    print(f"  Columns: {df.columns.tolist()}")
    
    naics_col = 'North American Industry Classification System (NAICS)'
    investment_col = 'Canadian and foreign direct investment'
    
    if naics_col not in df.columns:
        print(f"  WARNING: Column '{naics_col}' not found!")
        print(f"  Available columns: {df.columns.tolist()}")
        return [], []
    
    unique_industries = df[naics_col].unique().tolist()
    print(f"  Found {len(unique_industries)} unique industries:")
    for ind in unique_industries:
        print(f"    - {ind}")
    
    energy_industries = [
        'Oil and gas extraction [211]',
        'Support activities for mining and oil and gas extraction [213]',
        'Utilities [22]',
        'Petroleum and coal products manufacturing [324]'
    ]
    
    found_industries = [ind for ind in unique_industries if ind in energy_industries]
    for ind in found_industries:
        print(f"    Using: {ind}")
    
    df['year'] = pd.to_numeric(df['REF_DATE'], errors='coerce')
    
    df = df[df['year'] >= 2007].copy()
    
    years = sorted(df['year'].dropna().unique())
    data_rows = []
    
    for year in years:
        year_df = df[df['year'] == year]
        year_int = int(year)
        
        year_energy = year_df[year_df[naics_col].isin(found_industries)]
        
        cdia_mask = year_energy[investment_col].str.contains('Canadian direct investment abroad', case=False, na=False)
        cdia_total = year_energy.loc[cdia_mask, 'VALUE'].sum()
        
        fdi_mask = year_energy[investment_col].str.contains('Foreign direct investment in Canada', case=False, na=False)
        fdi_total = year_energy.loc[fdi_mask, 'VALUE'].sum()
        
        if cdia_total > 0 or fdi_total > 0:
            data_rows.extend([
                ('intl_cdia', year_int, round(cdia_total, 1)),
                ('intl_fdi', year_int, round(fdi_total, 1)),
            ])
            if year_int == 2007 or year_int == max(years):
                print(f"    {year_int}: CDIA={cdia_total}M, FDI={fdi_total}M")
    
    metadata_rows = [
        ('intl_cdia', 'Canadian direct investment abroad (CDIA) - Energy industry', 'Millions of dollars', 'millions'),
        ('intl_fdi', 'Foreign direct investment in Canada (FDI) - Energy industry', 'Millions of dollars', 'millions'),
    ]
    
    print(f"  International Investment: {len(data_rows)} data rows")
    return data_rows, metadata_rows


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
    end_date = get_future_end_date()
    return f"https://www150.statcan.gc.ca/t1/tbl1/en/dtl!downloadDbLoadingData.action?pid=3810013001&latestN=0&startDate=20070101&endDate={end_date}&csvLocale=en&selectedMembers=%5B%5B%5D%2C%5B%5D%2C%5B3%2C5%2C6%2C11%5D%2C%5B12%2C13%2C14%2C15%5D%5D&checkedLevels=0D1%2C1D1%2C2D1%2C3D1%2C3D2"

def get_foreign_control_url():
    """Get foreign control URL (Table 33-10-0570-01).
    
    Returns percentage of total assets under foreign control for:
    - Total non-financial industries
    - Oil and gas extraction and support activities [211, 213]
    - Utilities [22]
    """
    end_date = get_future_end_date()
    return f"https://www150.statcan.gc.ca/t1/tbl1/en/dtl!downloadDbLoadingData.action?pid=3310057001&latestN=0&startDate=20100101&endDate={end_date}&csvLocale=en&selectedMembers=%5B%5B%5D%2C%5B3%2C9%2C11%5D%2C%5B2%5D%2C%5B2%5D%5D&checkedLevels=0D1"


def process_foreign_control_data():
    """
    Fetch foreign control data from StatCan.
    
    Returns percentage of total assets under foreign control for different industries.
    
    Returns list of tuples for data.csv and metadata.csv
    """
    print("Processing Foreign Control data...")
    
    df = fetch_csv_from_url(get_foreign_control_url())
    
    print(f"  Total rows fetched: {len(df)}")
    
    naics_col = 'North American Industry Classification System (NAICS)'
    
    unique_industries = df[naics_col].unique().tolist()
    print(f"  Found {len(unique_industries)} unique industries:")
    for ind in unique_industries:
        print(f"    - {ind}")
    
    industry_mapping = {
        'Total non-financial industries (excluding management of companies and enterprises)': 'all_non_financial',
        'Oil and gas extraction and support activities [211, 213]': 'oil_gas',
        'Utilities [22]': 'utilities'
    }
    
    df['year'] = pd.to_numeric(df['REF_DATE'], errors='coerce')
    
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
                    data_rows.append((f'foreign_{key}', year_int, round(value, 1)))
        
        if year_int == 2010 or year_int == max(years):
            print(f"    {year_int}: Data processed")
    
    metadata_rows = [
        ('foreign_utilities', 'Utilities - Percentage of total assets under foreign control', 'Percent', 'units'),
        ('foreign_oil_gas', 'Oil and gas extraction and support activities - Percentage of total assets under foreign control', 'Percent', 'units'),
        ('foreign_all_non_financial', 'Total non-financial industries - Percentage of total assets under foreign control', 'Percent', 'units'),
    ]
    
    print(f"  Foreign Control: {len(data_rows)} data rows")
    return data_rows, metadata_rows


def process_environmental_protection_data():
    """Process environmental protection expenditures data (Table 38-10-0130-01).
    
    Creates virtual vectors:
    - enviro_oil_gas_total: Oil and gas extraction total expenditures
    - enviro_oil_gas_wastewater: Oil and gas - Wastewater management
    - enviro_oil_gas_soil: Oil and gas - Protection and remediation of soil, groundwater and surface water
    - enviro_oil_gas_air: Oil and gas - Air pollution management
    - enviro_oil_gas_solid_waste: Oil and gas - Solid waste management
    - enviro_oil_gas_other: Oil and gas - Other environmental protection activities
    - enviro_electric_total: Electric power generation total expenditures
    - enviro_petroleum_total: Petroleum and coal product manufacturing total expenditures
    - enviro_all_industries_total: Total industries total expenditures
    """
    print("\nProcessing Environmental Protection data...")
    
    url = get_environmental_protection_url()
    response = requests.get(url)
    response.raise_for_status()
    
    df = pd.read_csv(io.StringIO(response.text))
    print(f"  Downloaded {len(df)} rows from StatCan")
    
    df = df[df['Expenditures'] == 'Total, expenditures'].copy()
    
    df['year'] = df['REF_DATE'].astype(int)
    
    main_activities = {
        'wastewater': 'Wastewater management',
        'soil': 'Protection and remediation of soil, groundwater and surface water',
        'air': 'Air pollution management',
        'solid_waste': 'Solid waste management',
        'total': 'Total, environmental protection activities'
    }
    
    other_activities = [
        'Protection of biodiversity and habitat',
        'Environmental charges',
        'Other environmental protection activities'
    ]
    
    industries = {
        'oil_gas': 'Oil and gas extraction [211]',
        'electric': 'Electric power generation, transmission and distribution [2211]',
        'natural_gas': 'Natural gas distribution [2212]',
        'petroleum': 'Petroleum and coal product manufacturing [324]',
        'all_industries': 'Total, industries'
    }
    
    data_rows = []
    
    for year in df['year'].unique():
        year_df = df[df['year'] == year]
        
        for act_key, act_name in main_activities.items():
            oil_gas_df = year_df[(year_df['Industries'] == industries['oil_gas']) & 
                                  (year_df['Environmental protection activities'] == act_name)]
            if len(oil_gas_df) > 0:
                value = oil_gas_df['VALUE'].values[0]
                if pd.notna(value):
                    data_rows.append((f'enviro_oil_gas_{act_key}', year, float(value)))
        
        other_sum = 0
        for other_act in other_activities:
            oil_gas_other_df = year_df[(year_df['Industries'] == industries['oil_gas']) & 
                                        (year_df['Environmental protection activities'] == other_act)]
            if len(oil_gas_other_df) > 0:
                value = oil_gas_other_df['VALUE'].values[0]
                if pd.notna(value):
                    other_sum += float(value)
        if other_sum > 0:
            data_rows.append(('enviro_oil_gas_other', year, other_sum))
        
        electric_df = year_df[(year_df['Industries'] == industries['electric']) & 
                               (year_df['Environmental protection activities'] == main_activities['total'])]
        if len(electric_df) > 0:
            value = electric_df['VALUE'].values[0]
            if pd.notna(value):
                data_rows.append(('enviro_electric_total', year, float(value)))
        
        natural_gas_df = year_df[(year_df['Industries'] == industries['natural_gas']) & 
                                  (year_df['Environmental protection activities'] == main_activities['total'])]
        if len(natural_gas_df) > 0:
            value = natural_gas_df['VALUE'].values[0]
            if pd.notna(value):
                data_rows.append(('enviro_natural_gas_total', year, float(value)))
        
        petroleum_df = year_df[(year_df['Industries'] == industries['petroleum']) & 
                                (year_df['Environmental protection activities'] == main_activities['total'])]
        if len(petroleum_df) > 0:
            value = petroleum_df['VALUE'].values[0]
            if pd.notna(value):
                data_rows.append(('enviro_petroleum_total', year, float(value)))
        
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
            data_rows.append(('enviro_petroleum_pollution', year, pollution_sum))
        
        all_ind_df = year_df[(year_df['Industries'] == industries['all_industries']) & 
                              (year_df['Environmental protection activities'] == main_activities['total'])]
        if len(all_ind_df) > 0:
            value = all_ind_df['VALUE'].values[0]
            if pd.notna(value):
                data_rows.append(('enviro_all_industries_total', year, float(value)))
    
    metadata_rows = [
        ('enviro_oil_gas_total', 'Oil and gas extraction - Total environmental protection expenditures', 'Millions of dollars', 'millions'),
        ('enviro_oil_gas_wastewater', 'Oil and gas extraction - Wastewater management', 'Millions of dollars', 'millions'),
        ('enviro_oil_gas_soil', 'Oil and gas extraction - Protection and remediation of soil, groundwater and surface water', 'Millions of dollars', 'millions'),
        ('enviro_oil_gas_air', 'Oil and gas extraction - Air pollution management', 'Millions of dollars', 'millions'),
        ('enviro_oil_gas_solid_waste', 'Oil and gas extraction - Solid waste management', 'Millions of dollars', 'millions'),
        ('enviro_oil_gas_other', 'Oil and gas extraction - Other environmental protection activities', 'Millions of dollars', 'millions'),
        ('enviro_electric_total', 'Electric power generation - Total environmental protection expenditures', 'Millions of dollars', 'millions'),
        ('enviro_natural_gas_total', 'Natural gas distribution - Total environmental protection expenditures', 'Millions of dollars', 'millions'),
        ('enviro_petroleum_total', 'Petroleum and coal product manufacturing - Total environmental protection expenditures', 'Millions of dollars', 'millions'),
        ('enviro_petroleum_pollution', 'Petroleum and coal product manufacturing - Pollution abatement and control', 'Millions of dollars', 'millions'),
        ('enviro_all_industries_total', 'Total industries - Total environmental protection expenditures', 'Millions of dollars', 'millions'),
    ]
    
    print(f"  Environmental Protection: {len(data_rows)} data rows")
    return data_rows, metadata_rows


def get_provincial_nrsa_gdp_url():
    """
    Get URL for Table 36-10-0624-01: Provincial and territorial natural resource indicators.
    
    This fetches GDP data by province/territory for the Energy sub-sector.
    Uses specific vector IDs as per NRCan methodology:
    - Canada: v1138541601
    - Newfoundland and Labrador: v1138541630
    - Prince Edward Island: v1138541659
    - Nova Scotia: v1138541688
    - New Brunswick: v1138541717
    - Quebec: v1138541746
    - Ontario: v1138541775
    - Manitoba: v1138541804
    - Saskatchewan: v1138541833
    - Alberta: v1138541862
    - British Columbia: v1138541891
    - Yukon: v1138541920
    - Northwest Territories: v1138541949
    - Nunavut: v1138541978
    """
    end_date = get_future_end_date()
    return f"https://www150.statcan.gc.ca/t1/tbl1/en/dtl!downloadDbLoadingData-nonTraduit.action?pid=3610062401&latestN=0&startDate=20070101&endDate={end_date}&csvLocale=en&selectedMembers=%5B%5B1%2C2%2C3%2C4%2C5%2C6%2C7%2C8%2C9%2C10%2C11%2C12%2C13%2C14%5D%2C%5B2%5D%2C%5B2%5D%5D&checkedLevels="


def get_energy_direct_gdp_for_ry():
    """
    Get the Energy Direct GDP for the reference year (RY).
    This is Indicator 7 in the NRCan methodology.
    
    For 2024, this value comes from the NRCan Energy Factbook calculation.
    The value is the national total energy sector GDP.
    
    Returns the estimated total for the reference year.
    """
    return 231776


def process_provincial_gdp_data():
    """
    Process energy GDP by province/territory.
    
    Data source: Table 36-10-0624-01 - Provincial and territorial natural resource indicators
    (Natural resources sector - main indicators)
    
    Methodology:
    1. Import GDP values for Canada and each province from Table 36-10-0624-01
       Using vector IDs: Canada (v1138541601), NL (v1138541630), etc.
    
    2. For years with actual provincial data (up to RY-1):
       - Use the actual values from the table
       - Calculate GDP share = GDP of province / GDP of Canada
    
    3. For reference year (RY) where provincial data is not available:
       - Use RY-1 provincial GDP distribution (shares)
       - Get Energy Direct GDP of RY (Indicator 7)
       - Compute RY provincial values = share × Energy Direct GDP of RY
    
    Returns list of tuples for data.csv and metadata.csv
    """
    print("Processing Provincial GDP data...")
    print("  Source: Table 36-10-0624-01 (Provincial and territorial natural resource indicators)")
    
    province_vectors = {
        'Canada': {'code': 'national_total', 'vector': 'v1138541601'},
        'Newfoundland and Labrador': {'code': 'nl', 'vector': 'v1138541630'},
        'Prince Edward Island': {'code': 'pe', 'vector': 'v1138541659'},
        'Nova Scotia': {'code': 'ns', 'vector': 'v1138541688'},
        'New Brunswick': {'code': 'nb', 'vector': 'v1138541717'},
        'Quebec': {'code': 'qc', 'vector': 'v1138541746'},
        'Ontario': {'code': 'on', 'vector': 'v1138541775'},
        'Manitoba': {'code': 'mb', 'vector': 'v1138541804'},
        'Saskatchewan': {'code': 'sk', 'vector': 'v1138541833'},
        'Alberta': {'code': 'ab', 'vector': 'v1138541862'},
        'British Columbia': {'code': 'bc', 'vector': 'v1138541891'},
        'Yukon': {'code': 'yt', 'vector': 'v1138541920'},
        'Northwest Territories': {'code': 'nt', 'vector': 'v1138541949'},
        'Nunavut': {'code': 'nu', 'vector': 'v1138541978'},
    }
    
    province_names = {
        'nl': 'Newfoundland and Labrador',
        'pe': 'Prince Edward Island',
        'ns': 'Nova Scotia',
        'nb': 'New Brunswick',
        'qc': 'Quebec',
        'on': 'Ontario',
        'mb': 'Manitoba',
        'sk': 'Saskatchewan',
        'ab': 'Alberta',
        'bc': 'British Columbia',
        'yt': 'Yukon',
        'nt': 'Northwest Territories',
        'nu': 'Nunavut',
        'national_total': 'Canada total'
    }
    
    try:
        df = fetch_csv_from_url(get_provincial_nrsa_gdp_url())
        
        df = df[df['Sector'] == 'Energy sub-sector'].copy()
        df = df[df['Economic indicator'] == 'Gross domestic product'].copy()
        
        print(f"  Fetched {len(df)} rows from StatCan Table 36-10-0624-01")
        
        data_rows = []
        metadata_rows = []
        
        years = sorted([y for y in df['REF_DATE'].unique() if y >= 2009])
        print(f"  Years available from provincial data (excluding 2007-2008): {years}")
        
        year_data = {}
        
        for year in years:
            year_df = df[df['REF_DATE'] == year]
            year_data[year] = {}
            
            for _, row in year_df.iterrows():
                geo = row['GEO']
                value = row['VALUE']
                
                if geo in province_vectors and pd.notna(value):
                    prov_code = province_vectors[geo]['code']
                    vector = f'gdp_prov_{prov_code}'
                    data_rows.append((vector, int(year), round(value)))
                    year_data[year][prov_code] = value
        
        ry_minus_1 = max(years)
        ry = ry_minus_1 + 1  # Reference year
        print(f"  Latest year with provincial data (RY-1): {ry_minus_1}")
        print(f"  Reference year to estimate (RY): {ry}")
        
        if ry_minus_1 in year_data and 'national_total' in year_data[ry_minus_1]:
            canada_gdp_ry_minus_1 = year_data[ry_minus_1]['national_total']
            provincial_shares = {}
            
            print(f"\n  Step 2: Calculating provincial GDP shares from {ry_minus_1}:")
            print(f"    Canada total GDP: ${canada_gdp_ry_minus_1:,.0f}M")
            
            for geo_name, info in province_vectors.items():
                prov_code = info['code']
                if prov_code != 'national_total' and prov_code in year_data[ry_minus_1]:
                    prov_gdp = year_data[ry_minus_1][prov_code]
                    share = prov_gdp / canada_gdp_ry_minus_1
                    provincial_shares[prov_code] = share
                    print(f"    {geo_name}: ${prov_gdp:,.0f}M / ${canada_gdp_ry_minus_1:,.0f}M = {share:.4%}")
            
            energy_direct_gdp_ry = get_energy_direct_gdp_for_ry()
            print(f"\n  Step 3: Energy Direct GDP for {ry} (Indicator 7): ${energy_direct_gdp_ry:,}M")
            
            print(f"\n  Step 4: Estimating {ry} provincial values:")
            print(f"    Formula: Provincial value = Share × Energy Direct GDP of {ry}")
            
            data_rows.append(('page8_national_total', ry, energy_direct_gdp_ry))
            print(f"    Canada (national_total): ${energy_direct_gdp_ry:,}M")
            
            for prov_code, share in provincial_shares.items():
                estimated_value = round(energy_direct_gdp_ry * share)
                data_rows.append((f'page8_{prov_code}', ry, estimated_value))
                print(f"    {province_names[prov_code]}: {share:.4%} × ${energy_direct_gdp_ry:,}M = ${estimated_value:,}M")
            
            print(f"\n  Note: {ry} values are estimates based on {ry_minus_1} provincial distribution")
        
        for prov_code, prov_name in province_names.items():
            metadata_rows.append((
                f'gdp_prov_{prov_code}',
                f'Energy sector direct nominal GDP - {prov_name}',
                'Millions of dollars',
                'millions'
            ))
        
        print(f"\n  Provincial GDP: {len(data_rows)} data rows total")
        return data_rows, metadata_rows
        
    except Exception as e:
        print(f"  ERROR fetching Page 8 data: {e}")
        import traceback
        traceback.print_exc()
        print("  Returning empty data")
        return [], []


def process_major_projects_data():
    """
    Process major energy projects data.
    
    Data source: NRCan Major Projects Inventory (Table 1)
    https://natural-resources.canada.ca/science-data/data-analysis/natural-resources-major-projects-planned-under-construction-2024-2034
    
    This data is from annual NRCan reports and is hardcoded since it's not available
    as a direct StatCan CSV download.
    
    Returns list of tuples for data.csv and metadata.csv
    """
    print("Processing Major Projects data...")
    print("  Source: NRCan Major Projects Inventory (Table 1)")
    
    major_projects_data = {
        2021: {'oil_gas_value': 339, 'oil_gas_projects': 106, 'electricity_value': 102, 'electricity_projects': 176, 'other_value': 8.9, 'other_projects': 23},
        2022: {'oil_gas_value': 294, 'oil_gas_projects': 96, 'electricity_value': 106, 'electricity_projects': 179, 'other_value': 26.6, 'other_projects': 45},
        2023: {'oil_gas_value': 318.6, 'oil_gas_projects': 87, 'electricity_value': 97.4, 'electricity_projects': 182, 'other_value': 56.2, 'other_projects': 74},
        2024: {'oil_gas_value': 296.2, 'oil_gas_projects': 67, 'electricity_value': 118.9, 'electricity_projects': 188, 'other_value': 94.9, 'other_projects': 85},
    }
    
    summary_2024 = {
        'planned_projects': 231,
        'planned_value': 351,
        'construction_projects': 109,
        'construction_value': 159,
        'clean_tech_projects': 215,
        'clean_tech_value': 194,
    }
    
    data_rows = []
    
    for year, values in major_projects_data.items():
        data_rows.append(('projects_oil_gas_value', year, values['oil_gas_value']))
        data_rows.append(('projects_oil_gas_count', year, values['oil_gas_projects']))
        data_rows.append(('projects_electricity_value', year, values['electricity_value']))
        data_rows.append(('projects_electricity_count', year, values['electricity_projects']))
        data_rows.append(('projects_other_value', year, values['other_value']))
        data_rows.append(('projects_other_count', year, values['other_projects']))
        total_value = values['oil_gas_value'] + values['electricity_value'] + values['other_value']
        total_projects = values['oil_gas_projects'] + values['electricity_projects'] + values['other_projects']
        data_rows.append(('projects_total_value', year, round(total_value, 1)))
        data_rows.append(('projects_total_count', year, total_projects))
    
    data_rows.append(('projects_planned_count', 2024, summary_2024['planned_projects']))
    data_rows.append(('projects_planned_value', 2024, summary_2024['planned_value']))
    data_rows.append(('projects_construction_count', 2024, summary_2024['construction_projects']))
    data_rows.append(('projects_construction_value', 2024, summary_2024['construction_value']))
    data_rows.append(('projects_cleantech_count', 2024, summary_2024['clean_tech_projects']))
    data_rows.append(('projects_cleantech_value', 2024, summary_2024['clean_tech_value']))
    
    metadata_rows = [
        ('projects_oil_gas_value', 'Oil and gas - Project value', 'Billions of dollars', 'billions'),
        ('projects_oil_gas_count', 'Oil and gas - Number of projects', 'Number', 'units'),
        ('projects_electricity_value', 'Electricity - Project value', 'Billions of dollars', 'billions'),
        ('projects_electricity_count', 'Electricity - Number of projects', 'Number', 'units'),
        ('projects_other_value', 'Other - Project value', 'Billions of dollars', 'billions'),
        ('projects_other_count', 'Other - Number of projects', 'Number', 'units'),
        ('projects_total_value', 'Total - Project value', 'Billions of dollars', 'billions'),
        ('projects_total_count', 'Total - Number of projects', 'Number', 'units'),
        ('projects_planned_count', 'Planned projects (announced, under review, approved)', 'Number', 'units'),
        ('projects_planned_value', 'Planned projects value', 'Billions of dollars', 'billions'),
        ('projects_construction_count', 'Projects under construction', 'Number', 'units'),
        ('projects_construction_value', 'Construction projects value', 'Billions of dollars', 'billions'),
        ('projects_cleantech_count', 'Clean technology projects', 'Number', 'units'),
        ('projects_cleantech_value', 'Clean technology projects value', 'Billions of dollars', 'billions'),
    ]
    
    print(f"  Major Projects: {len(data_rows)} data rows")
    return data_rows, metadata_rows


def process_clean_tech_data():
    """
    Process clean technology project trends data.
    
    Data source: NRCan Major Projects Inventory (Table 4)
    https://natural-resources.canada.ca/science-data/data-analysis/natural-resources-major-projects-planned-under-construction-2024-2034
    
    This data is from annual NRCan reports and is hardcoded since it's not available
    as a direct StatCan CSV download.
    
    Returns list of tuples for data.csv and metadata.csv
    """
    print("Processing Clean Tech Trends data...")
    print("  Source: NRCan Major Projects Inventory (Table 4)")
    
    clean_tech_data = {
        2021: {
            'total_projects': 178, 'total_value': 104,
            'hydro_projects': 58, 'hydro_value': 39.2,
            'wind_projects': 41, 'wind_value': 14.6,
            'biomass_projects': 31, 'biomass_value': 8.0,
            'solar_projects': 22, 'solar_value': 2.2,
            'nuclear_projects': 4, 'nuclear_value': 27.4,
            'ccs_projects': 2, 'ccs_value': 11.3,
            'geothermal_projects': 5, 'geothermal_value': 0.4,
            'tidal_projects': 6, 'tidal_value': 0.3,
            'multiple_projects': 1, 'multiple_value': 0.03,
            'other_projects': 8, 'other_value': 0.5,
        },
        2022: {
            'total_projects': 197, 'total_value': 118,
            'hydro_projects': 63, 'hydro_value': 44.8,
            'wind_projects': 35, 'wind_value': 13.4,
            'biomass_projects': 35, 'biomass_value': 9.4,
            'solar_projects': 30, 'solar_value': 3.0,
            'nuclear_projects': 3, 'nuclear_value': 26.1,
            'ccs_projects': 6, 'ccs_value': 15.5,
            'geothermal_projects': 4, 'geothermal_value': 0.4,
            'tidal_projects': 7, 'tidal_value': 0.4,
            'multiple_projects': 1, 'multiple_value': 0.03,
            'other_projects': 13, 'other_value': 5.3,
        },
        2023: {
            'total_projects': 233, 'total_value': 157.4,
            'hydro_projects': 78, 'hydro_value': 37.4,
            'wind_projects': 32, 'wind_value': 12.4,
            'biomass_projects': 47, 'biomass_value': 14.3,
            'solar_projects': 31, 'solar_value': 6.2,
            'nuclear_projects': 2, 'nuclear_value': 25.8,
            'ccs_projects': 9, 'ccs_value': 38.3,
            'geothermal_projects': 4, 'geothermal_value': 0.4,
            'tidal_projects': 7, 'tidal_value': 0.4,
            'multiple_projects': 1, 'multiple_value': 0.03,
            'other_projects': 22, 'other_value': 22.1,
        },
        2024: {
            'total_projects': 215, 'total_value': 194.2,
            'hydro_projects': 58, 'hydro_value': 30.4,
            'wind_projects': 33, 'wind_value': 26.8,
            'biomass_projects': 41, 'biomass_value': 12.6,
            'solar_projects': 36, 'solar_value': 8.8,
            'nuclear_projects': 3, 'nuclear_value': 51.8,
            'ccs_projects': 8, 'ccs_value': 38.3,
            'geothermal_projects': 4, 'geothermal_value': 0.4,
            'tidal_projects': 4, 'tidal_value': 0.2,
            'multiple_projects': 1, 'multiple_value': 0.03,
            'other_projects': 25, 'other_value': 23.8,
        },
    }
    
    data_rows = []
    categories = ['total', 'hydro', 'wind', 'biomass', 'solar', 'nuclear', 'ccs', 'geothermal', 'tidal', 'multiple', 'other']
    
    for year, values in clean_tech_data.items():
        for cat in categories:
            data_rows.append((f'cleantech_{cat}_count', year, values[f'{cat}_projects']))
            data_rows.append((f'cleantech_{cat}_value', year, values[f'{cat}_value']))
    
    metadata_rows = [
        ('cleantech_total_count', 'Total clean technology - Number of projects', 'Number', 'units'),
        ('cleantech_total_value', 'Total clean technology - Project value', 'Billions of dollars', 'billions'),
        ('cleantech_hydro_count', 'Hydro - Number of projects', 'Number', 'units'),
        ('cleantech_hydro_value', 'Hydro - Project value', 'Billions of dollars', 'billions'),
        ('cleantech_wind_count', 'Wind - Number of projects', 'Number', 'units'),
        ('cleantech_wind_value', 'Wind - Project value', 'Billions of dollars', 'billions'),
        ('cleantech_biomass_count', 'Biomass/Biofuels - Number of projects', 'Number', 'units'),
        ('cleantech_biomass_value', 'Biomass/Biofuels - Project value', 'Billions of dollars', 'billions'),
        ('cleantech_solar_count', 'Solar - Number of projects', 'Number', 'units'),
        ('cleantech_solar_value', 'Solar - Project value', 'Billions of dollars', 'billions'),
        ('cleantech_nuclear_count', 'Nuclear - Number of projects', 'Number', 'units'),
        ('cleantech_nuclear_value', 'Nuclear - Project value', 'Billions of dollars', 'billions'),
        ('cleantech_ccs_count', 'Carbon Capture and Storage - Number of projects', 'Number', 'units'),
        ('cleantech_ccs_value', 'Carbon Capture and Storage - Project value', 'Billions of dollars', 'billions'),
        ('cleantech_geothermal_count', 'Geothermal - Number of projects', 'Number', 'units'),
        ('cleantech_geothermal_value', 'Geothermal - Project value', 'Billions of dollars', 'billions'),
        ('cleantech_tidal_count', 'Tidal - Number of projects', 'Number', 'units'),
        ('cleantech_tidal_value', 'Tidal - Project value', 'Billions of dollars', 'billions'),
        ('cleantech_multiple_count', 'Multiple - Number of projects', 'Number', 'units'),
        ('cleantech_multiple_value', 'Multiple - Project value', 'Billions of dollars', 'billions'),
        ('cleantech_other_count', 'Other - Number of projects', 'Number', 'units'),
        ('cleantech_other_value', 'Other - Project value', 'Billions of dollars', 'billions'),
    ]
    
    print(f"  Clean Tech Trends: {len(data_rows)} data rows")
    return data_rows, metadata_rows


def refresh_all_data():
    """Fetch, process and save all data from StatCan to data.csv and metadata.csv."""
    print("=" * 60)
    print("Refreshing all data from Statistics Canada...")
    print("=" * 60)
    
    all_data = []
    all_metadata = []
    
    capex_data, capex_meta = process_capital_expenditure_data()
    all_data.extend(capex_data)
    all_metadata.extend(capex_meta)
    
    infra_data, infra_meta = process_infrastructure_data()
    all_data.extend(infra_data)
    all_metadata.extend(infra_meta)
    
    econ_data, econ_meta = process_economic_contributions_data()
    all_data.extend(econ_data)
    all_metadata.extend(econ_meta)
    
    asset_data, asset_meta = process_investment_by_asset_data()
    all_data.extend(asset_data)
    all_metadata.extend(asset_meta)
    
    intl_data, intl_meta = process_international_investment_data()
    all_data.extend(intl_data)
    all_metadata.extend(intl_meta)
    
    foreign_data, foreign_meta = process_foreign_control_data()
    all_data.extend(foreign_data)
    all_metadata.extend(foreign_meta)
    
    enviro_data, enviro_meta = process_environmental_protection_data()
    all_data.extend(enviro_data)
    all_metadata.extend(enviro_meta)
    
    gdp_data, gdp_meta = process_provincial_gdp_data()
    all_data.extend(gdp_data)
    all_metadata.extend(gdp_meta)
    
    projects_data, projects_meta = process_major_projects_data()
    all_data.extend(projects_data)
    all_metadata.extend(projects_meta)
    
    cleantech_data, cleantech_meta = process_clean_tech_data()
    all_data.extend(cleantech_data)
    all_metadata.extend(cleantech_meta)
    
    data_df = pd.DataFrame(all_data, columns=['vector', 'ref_date', 'value'])
    metadata_df = pd.DataFrame(all_metadata, columns=['vector', 'title', 'uom', 'scalar_factor'])
    
    data_df = data_df.drop_duplicates(subset=['vector', 'ref_date'], keep='first')
    metadata_df = metadata_df.drop_duplicates(subset=['vector'], keep='first')
    
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
