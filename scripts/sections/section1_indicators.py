"""
Section 1: Key Indicators data processor.

Handles data for:
- Economic contributions (GDP, Jobs, Income)
- Nominal GDP contributions
- Provincial GDP
- World energy production rankings
- Canadian Energy Assets (CEA)
"""

import io
import pandas as pd
import requests
from typing import Dict, Any, List, Tuple
from datetime import datetime

from .base import SectionProcessor


class Section1Indicators(SectionProcessor):
    """
    Processor for Section 1: Key Indicators.
    
    Data sources:
    - economic_contributions: StatCan Table 36-10-0610-01
    - nominal_gdp: Google Docs + StatCan calculations
    - provincial_gdp: StatCan Table 36-10-0624-01
    - world_energy_production: External/manual
    - canadian_energy_assets: CEA Excel file
    """
    
    SECTION_KEY = "section1_indicators"
    SECTION_NAME = "Key Indicators"
    SECTION_ID = 1
    
    # Vector mappings from original data_retrieval.py
    ECON_VECTORS = {
        'jobs_direct': 'v1044855486',
        'jobs_indirect': 'v1044855495',
        'income_direct': 'v1044301086',
        'income_indirect': 'v1044301095',
        'gdp_direct': 'v1044578286',
        'gdp_indirect': 'v1044578295',
    }
    
    PROVINCE_VECTORS = {
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
    
    PROVINCE_NAMES = {
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
    
    def get_source_handlers(self) -> Dict[str, callable]:
        """Return mapping of source keys to handler functions."""
        return {
            'economic_contributions': self._process_economic_contributions,
            'nominal_gdp': self._process_nominal_gdp,
            'provincial_gdp': self._process_provincial_gdp,
            'world_energy_production': self._process_world_energy_production,
            'canadian_energy_assets': self._process_cea_data,
        }
    
    # =========================================================================
    # URL BUILDERS
    # =========================================================================
    
    def _get_future_end_date(self) -> str:
        """Get end date 5 years in future for StatCan queries."""
        return f"{datetime.now().year + 5}0101"
    
    def _get_economic_contributions_url(self) -> str:
        """Get URL for Table 36-10-0610-01 (Economic contributions)."""
        end_date = self._get_future_end_date()
        # Use exact URL from working data_retrieval.py
        return (
            f"https://www150.statcan.gc.ca/t1/tbl1/en/dtl!downloadDbLoadingData.action?"
            f"pid=3610061001&latestN=0&startDate=20070101&endDate={end_date}"
            f"&csvLocale=en&selectedMembers=%5B%5B%5D%2C%5B%5D%2C%5B%5D%2C%5B%5D%2C%5B39%2C48%2C54%2C55%2C57%5D%2C%5B%5D%5D"
            f"&checkedLevels=0D1%2C1D1%2C2D1%2C3D1%2C5D1"
        )
    
    def _get_capital_expenditures_url(self) -> str:
        """Get URL for capital expenditures (needed for econ contributions)."""
        end_date = self._get_future_end_date()
        # Use exact URL from working data_retrieval.py (note: -nonTraduit)
        return (
            f"https://www150.statcan.gc.ca/t1/tbl1/en/dtl!downloadDbLoadingData-nonTraduit.action?"
            f"pid=3410003601&latestN=0&startDate=20070101&endDate={end_date}"
            f"&csvLocale=en&selectedMembers=%5B%5B%5D%2C%5B1%5D%2C%5B8%2C9%2C11%2C34%2C36%2C37%2C50%2C91%5D%5D"
            f"&checkedLevels=0D1"
        )
    
    def _get_provincial_gdp_url(self) -> str:
        """Get URL for Table 36-10-0624-01 (Provincial NRSA GDP)."""
        end_date = self._get_future_end_date()
        return (
            f"https://www150.statcan.gc.ca/t1/tbl1/en/dtl!downloadDbLoadingData-nonTraduit.action?"
            f"pid=3610062401&latestN=0&startDate=20070101&endDate={end_date}"
            f"&csvLocale=en&selectedMembers=%5B%5B1%2C2%2C3%2C4%2C5%2C6%2C7%2C8%2C9%2C10%2C11%2C12%2C13%2C14%5D"
            f"%2C%5B2%5D%2C%5B2%5D%5D&checkedLevels="
        )
    
    def _get_gdp_emp_forecast_url(self) -> str:
        """Get URL for GDP&EMP forecast data from Google Docs."""
        return "https://docs.google.com/document/d/11ad-aqY6WjcQwHRWuSrZgQKxMD_U6jKaXlR5q-p0CXI/export?format=txt"
    
    # =========================================================================
    # DATA PROCESSORS
    # =========================================================================
    
    def _process_economic_contributions(self) -> int:
        """
        Process economic contributions data (GDP, Jobs, Income).
        
        Data flow:
        1. Fetch raw StatCan data → store in raw_statcan_data
        2. Calculate aggregates → store in calc_economic_contributions
        3. Export will pull from calc table with semantic vector names
        
        Returns:
            Number of data rows processed
        """
        print("  Fetching economic contributions data...")
        
        # Fetch main economic data
        df_econ = self.fetch_csv_from_url(self._get_economic_contributions_url())
        
        # Find columns case-insensitively
        vector_col = self.get_column(df_econ, 'VECTOR', 'Vector', 'vector')
        ref_date_col = self.get_column(df_econ, 'REF_DATE', 'Ref_date', 'ref_date')
        value_col = self.get_column(df_econ, 'VALUE', 'Value', 'value')
        
        if not vector_col:
            print(f"    Warning: No VECTOR column found. Columns: {df_econ.columns.tolist()[:10]}")
            return 0
        
        # STEP 1: Store raw StatCan data with original vector IDs
        raw_data_rows, raw_metadata = self.extract_data_and_metadata(df_econ, 'economic_contributions')
        if raw_data_rows:
            self.repo.insert_raw_statcan_data('economic_contributions_raw', raw_data_rows)
            print(f"    Stored {len(raw_data_rows)} raw StatCan data points")
        
        all_vectors = list(self.ECON_VECTORS.values())
        df_filtered = df_econ[df_econ[vector_col].isin(all_vectors)].copy()
        df_filtered['year'] = pd.to_numeric(df_filtered[ref_date_col], errors='coerce')
        
        # Also fetch capital expenditures for investment calculation
        df_capex = self.fetch_csv_from_url(self._get_capital_expenditures_url())
        
        # Find capex columns
        capex_type_col = self.get_column(df_capex, 'Capital and repair expenditures', 
                                          'Capital expenditures and repair construction')
        naics_col = self.get_column(df_capex, 'North American Industry Classification System (NAICS)',
                                     'NAICS', 'Industry')
        capex_ref_date = self.get_column(df_capex, 'REF_DATE', 'Ref_date')
        capex_value_col = self.get_column(df_capex, 'VALUE', 'Value')
        
        if capex_type_col and capex_type_col in df_capex.columns:
            df_capex = df_capex[df_capex[capex_type_col] == 'Capital expenditures'].copy()
        
        if capex_ref_date:
            df_capex['year'] = pd.to_numeric(df_capex[capex_ref_date], errors='coerce')
        
        years = sorted(df_filtered['year'].dropna().unique())
        calc_data = []  # For calc_economic_contributions table
        data_rows = []  # For semantic vector export (backwards compatibility)
        
        for year in years:
            year_df = df_filtered[df_filtered['year'] == year]
            
            def get_val(vector_key):
                vec = self.ECON_VECTORS.get(vector_key)
                row = year_df[year_df[vector_col] == vec]
                if not row.empty and value_col:
                    val = row[value_col].iloc[0]
                    return float(val) if pd.notna(val) else 0
                return 0
            
            jobs_direct = get_val('jobs_direct')
            jobs_indirect = get_val('jobs_indirect')
            jobs_total = (jobs_direct + jobs_indirect) * 1000
            
            income_direct = get_val('income_direct')
            income_indirect = get_val('income_indirect')
            income_total = income_direct + income_indirect
            
            gdp_direct = get_val('gdp_direct')
            gdp_indirect = get_val('gdp_indirect')
            gdp_total = gdp_direct + gdp_indirect
            
            # Calculate investment from capex
            investment_value = 0
            if naics_col and capex_value_col and 'year' in df_capex.columns:
                year_capex = df_capex[df_capex['year'] == year]
                investment_mask = year_capex[naics_col].str.contains(
                    r'\[211\]|\[2211\]|\[2212\]|\[486\]|\[324\]', regex=True, na=False
                )
                investment_value = year_capex.loc[investment_mask, capex_value_col].sum()
            
            if any([jobs_total, income_total, gdp_total]):
                year_int = int(year)
                
                # STEP 2: Add to calc table data
                calc_data.append({
                    'year': year_int,
                    'gdp_direct': round(float(gdp_direct), 1),
                    'gdp_indirect': round(float(gdp_indirect), 1),
                    'gdp_total': round(float(gdp_total), 1),
                    'jobs_direct': round(float(jobs_direct * 1000), 0),
                    'jobs_indirect': round(float(jobs_indirect * 1000), 0),
                    'jobs_total': round(float(jobs_total), 0),
                    'income_direct': round(float(income_direct), 1),
                    'income_indirect': round(float(income_indirect), 1),
                    'income_total': round(float(income_total), 1),
                })
                
                # Also store with semantic vectors for backwards compatibility
                data_rows.extend([
                    ('econ_jobs', str(year_int), round(float(jobs_total), 0)),
                    ('econ_employment_income', str(year_int), round(float(income_total), 1)),
                    ('econ_gdp', str(year_int), round(float(gdp_total), 1)),
                    ('econ_investment_value', str(year_int), round(float(investment_value), 1)),
                ])
                
                # Pre-calculated values for frontend (thousands for jobs, billions for monetary)
                data_rows.extend([
                    ('econ_jobs_thousands', str(year_int), round(float(jobs_total) / 1000, 1)),
                    ('econ_employment_income_billions', str(year_int), round(float(income_total) / 1000, 2)),
                    ('econ_gdp_billions', str(year_int), round(float(gdp_total) / 1000, 2)),
                    ('econ_investment_value_billions', str(year_int), round(float(investment_value) / 1000, 2)),
                ])
        
        metadata_rows = [
            ('econ_jobs', 'Economic contributions - Jobs (direct + indirect)', 'Number', 'units'),
            ('econ_employment_income', 'Economic contributions - Employment income', 'Millions of dollars', 'millions'),
            ('econ_gdp', 'Economic contributions - GDP', 'Millions of dollars', 'millions'),
            ('econ_investment_value', 'Annual investment - Fuel, energy and pipelines', 'Millions of dollars', 'millions'),
            ('econ_jobs_thousands', 'Economic contributions - Jobs (thousands)', 'Thousands', 'thousands'),
            ('econ_employment_income_billions', 'Economic contributions - Employment income (billions)', 'Billions of dollars', 'billions'),
            ('econ_gdp_billions', 'Economic contributions - GDP (billions)', 'Billions of dollars', 'billions'),
            ('econ_investment_value_billions', 'Annual investment (billions)', 'Billions of dollars', 'billions'),
        ]
        
        # STEP 2: Store calculated data in calc_economic_contributions table
        if calc_data:
            self.repo.upsert_economic_contributions(calc_data)
            print(f"    Stored {len(calc_data)} years in calc_economic_contributions")
        
        # Store semantic vectors for backwards compatibility
        return self.store_raw_data('economic_contributions', data_rows, metadata_rows)
    
    def _process_nominal_gdp(self) -> int:
        """
        Process nominal GDP contributions data.
        
        Fetches data from Google Docs GDP&EMP forecast.
        
        Returns:
            Number of data rows processed
        """
        print("  Fetching GDP&EMP forecast data...")
        
        try:
            response = requests.get(self._get_gdp_emp_forecast_url(), timeout=60)
            response.raise_for_status()
            gdp_emp_data = self._parse_gdp_emp_text(response.text)
        except Exception as e:
            print(f"    Warning: Could not fetch GDP forecast data: {e}")
            return 0
        
        data_rows = []
        years_processed = set()
        
        # Get years from the parsed data
        years = set()
        for key in gdp_emp_data.keys():
            if len(key) >= 2:
                years.add(key[1])
        
        for year in sorted(years):
            if year < 2009:
                continue
            
            years_processed.add(year)
            
            # Extract values from parsed data
            energy_plus_direct = gdp_emp_data.get(
                ('Energy Plus (includes coal, fuel wood and uranium)', year, 'Current GDP ($ millions)', 'Direct'), 0)
            energy_plus_indirect = gdp_emp_data.get(
                ('Energy Plus (includes coal, fuel wood and uranium)', year, 'Current GDP ($ millions)', 'Indirect'), 0)
            petroleum_direct = gdp_emp_data.get(
                ('Petroleum Sector (Energy less electricity and "other services")', year, 'Current GDP ($ millions)', 'Direct'), 0)
            electricity_direct = gdp_emp_data.get(
                ('Electricity (+ Services linked to electricity production)', year, 'Current GDP ($ millions)', 'Direct'), 0)
            
            other_direct = max(0, energy_plus_direct - petroleum_direct - electricity_direct)
            total_nominal_gdp = energy_plus_direct + energy_plus_indirect
            
            # Market GDP estimates
            nominal_gdp_market = {
                2024: 2879000,
                2023: 2765000,
                2022: 2773000,
            }.get(year, 2700000)
            
            if total_nominal_gdp > 0:
                total_pct = round((total_nominal_gdp / nominal_gdp_market) * 100, 1)
                direct_pct = round((energy_plus_direct / nominal_gdp_market) * 100, 1) if nominal_gdp_market > 0 else 0
                indirect_pct = round((energy_plus_indirect / nominal_gdp_market) * 100, 1) if nominal_gdp_market > 0 else 0
                petroleum_pct = round((petroleum_direct / nominal_gdp_market) * 100, 1) if nominal_gdp_market > 0 else 0
                electricity_pct = round((electricity_direct / nominal_gdp_market) * 100, 1) if nominal_gdp_market > 0 else 0
                other_pct = round((other_direct / nominal_gdp_market) * 100, 1) if nominal_gdp_market > 0 else 0
                
                data_rows.extend([
                    ('gdp_nominal_total', str(year), round(total_nominal_gdp, 0)),
                    ('gdp_nominal_direct', str(year), round(energy_plus_direct, 0)),
                    ('gdp_nominal_indirect', str(year), round(energy_plus_indirect, 0)),
                    ('gdp_nominal_petroleum', str(year), round(petroleum_direct, 0)),
                    ('gdp_nominal_electricity', str(year), round(electricity_direct, 0)),
                    ('gdp_nominal_other', str(year), round(other_direct, 0)),
                    ('gdp_nominal_market', str(year), nominal_gdp_market),
                    ('gdp_nominal_total_pct', str(year), total_pct),
                    ('gdp_nominal_direct_pct', str(year), direct_pct),
                    ('gdp_nominal_indirect_pct', str(year), indirect_pct),
                    ('gdp_nominal_petroleum_pct', str(year), petroleum_pct),
                    ('gdp_nominal_electricity_pct', str(year), electricity_pct),
                    ('gdp_nominal_other_pct', str(year), other_pct),
                ])
                
                # Pre-calculated billions values for frontend
                data_rows.extend([
                    ('gdp_nominal_total_billions', str(year), round(total_nominal_gdp / 1000, 0)),
                    ('gdp_nominal_direct_billions', str(year), round(energy_plus_direct / 1000, 0)),
                    ('gdp_nominal_indirect_billions', str(year), round(energy_plus_indirect / 1000, 0)),
                    ('gdp_nominal_petroleum_billions', str(year), round(petroleum_direct / 1000, 0)),
                    ('gdp_nominal_electricity_billions', str(year), round(electricity_direct / 1000, 0)),
                    ('gdp_nominal_other_billions', str(year), round(other_direct / 1000, 0)),
                    ('gdp_nominal_market_billions', str(year), round(nominal_gdp_market / 1000, 0)),
                ])
        
        metadata_rows = [
            ('gdp_nominal_total', "Energy's nominal GDP contribution - Total", 'Millions of dollars', 'millions'),
            ('gdp_nominal_direct', "Energy's nominal GDP contribution - Direct", 'Millions of dollars', 'millions'),
            ('gdp_nominal_indirect', "Energy's nominal GDP contribution - Indirect", 'Millions of dollars', 'millions'),
            ('gdp_nominal_petroleum', "Energy's nominal GDP contribution - Petroleum", 'Millions of dollars', 'millions'),
            ('gdp_nominal_electricity', "Energy's nominal GDP contribution - Electricity", 'Millions of dollars', 'millions'),
            ('gdp_nominal_other', "Energy's nominal GDP contribution - Other", 'Millions of dollars', 'millions'),
            ('gdp_nominal_market', "Nominal GDP at market prices", 'Millions of dollars', 'millions'),
            ('gdp_nominal_total_pct', "Energy's nominal GDP share - Total", 'Percent', 'percent'),
            ('gdp_nominal_direct_pct', "Energy's nominal GDP share - Direct", 'Percent', 'percent'),
            ('gdp_nominal_indirect_pct', "Energy's nominal GDP share - Indirect", 'Percent', 'percent'),
            ('gdp_nominal_petroleum_pct', "Energy's nominal GDP share - Petroleum", 'Percent', 'percent'),
            ('gdp_nominal_electricity_pct', "Energy's nominal GDP share - Electricity", 'Percent', 'percent'),
            ('gdp_nominal_other_pct', "Energy's nominal GDP share - Other", 'Percent', 'percent'),
            ('gdp_nominal_total_billions', "Energy's nominal GDP - Total (billions)", 'Billions of dollars', 'billions'),
            ('gdp_nominal_direct_billions', "Energy's nominal GDP - Direct (billions)", 'Billions of dollars', 'billions'),
            ('gdp_nominal_indirect_billions', "Energy's nominal GDP - Indirect (billions)", 'Billions of dollars', 'billions'),
            ('gdp_nominal_petroleum_billions', "Energy's nominal GDP - Petroleum (billions)", 'Billions of dollars', 'billions'),
            ('gdp_nominal_electricity_billions', "Energy's nominal GDP - Electricity (billions)", 'Billions of dollars', 'billions'),
            ('gdp_nominal_other_billions', "Energy's nominal GDP - Other (billions)", 'Billions of dollars', 'billions'),
            ('gdp_nominal_market_billions', "Nominal GDP at market prices (billions)", 'Billions of dollars', 'billions'),
        ]
        
        return self.store_raw_data('nominal_gdp', data_rows, metadata_rows)
    
    def _parse_gdp_emp_text(self, text: str) -> Dict:
        """Parse GDP&EMP forecast text from Google Docs."""
        data = {}
        lines = text.strip().split('\n')
        
        current_sector = None
        current_year = None
        current_indicator = None
        current_type = None
        
        i = 0
        while i < len(lines):
            line = lines[i].strip()
            
            if line in ['Energy', 'Energy Plus (includes coal, fuel wood and uranium)', 
                        'Petroleum Sector (Energy less electricity and "other services")',
                        'Electricity (+ Services linked to electricity production)']:
                current_sector = line
            elif line.isdigit() and len(line) == 4:
                current_year = int(line)
            elif 'GDP' in line or 'Jobs' in line:
                current_indicator = line
            elif line in ['Direct', 'Indirect', 'Induced']:
                current_type = line
            else:
                try:
                    value = float(line.replace(',', ''))
                    if current_sector and current_year and current_indicator and current_type:
                        key = (current_sector, current_year, current_indicator, current_type)
                        data[key] = value
                except ValueError:
                    pass
            
            i += 1
        
        return data
    
    def _process_provincial_gdp(self) -> int:
        """
        Process provincial GDP data.
        
        Returns:
            Number of data rows processed
        """
        print("  Fetching provincial GDP data...")
        
        df = self.fetch_csv_from_url(self._get_provincial_gdp_url())
        
        # Filter for Energy sub-sector GDP
        df = df[df['Sector'] == 'Energy sub-sector'].copy()
        df = df[df['Economic indicator'] == 'Gross domestic product'].copy()
        
        data_rows = []
        metadata_rows = []
        
        years = sorted([y for y in df['REF_DATE'].unique() if y >= 2009])
        year_data = {}
        
        for year in years:
            year_df = df[df['REF_DATE'] == year]
            year_data[year] = {}
            
            for _, row in year_df.iterrows():
                geo = row['GEO']
                value = row['VALUE']
                
                if geo in self.PROVINCE_VECTORS and pd.notna(value):
                    prov_code = self.PROVINCE_VECTORS[geo]['code']
                    vector = f'gdp_prov_{prov_code}'
                    data_rows.append((vector, str(int(year)), round(value)))
                    year_data[year][prov_code] = value
        
        # Estimate reference year using previous year shares
        if years:
            ry_minus_1 = max(years)
            ry = ry_minus_1 + 1
            
            if ry_minus_1 in year_data and 'national_total' in year_data[ry_minus_1]:
                canada_gdp = year_data[ry_minus_1]['national_total']
                energy_direct_gdp_ry = 231776  # Reference year estimate
                
                for geo_name, info in self.PROVINCE_VECTORS.items():
                    prov_code = info['code']
                    if prov_code != 'national_total' and prov_code in year_data[ry_minus_1]:
                        share = year_data[ry_minus_1][prov_code] / canada_gdp
                        estimated = round(energy_direct_gdp_ry * share)
                        data_rows.append((f'gdp_prov_{prov_code}', str(ry), estimated))
                
                data_rows.append(('gdp_prov_national_total', str(ry), energy_direct_gdp_ry))
        
        # Build metadata
        for prov_code, prov_name in self.PROVINCE_NAMES.items():
            metadata_rows.append((
                f'gdp_prov_{prov_code}',
                f'Energy sector direct nominal GDP - {prov_name}',
                'Millions of dollars',
                'millions'
            ))
        
        return self.store_raw_data('provincial_gdp', data_rows, metadata_rows)
    
    def _process_world_energy_production(self) -> int:
        """
        Process world energy production data from IEA World Energy Balances.
        
        Source: World Energy Balances Highlights 2025.xlsx (IEA data)
        
        Returns top energy producing countries by share of world production.
        Note: Russia and Saudi Arabia are not included in IEA data (non-members).
        
        Returns:
            Number of data rows processed
        """
        print("  Processing world energy production data...")
        
        import os
        from pathlib import Path
        
        # Path to IEA Excel file
        script_dir = Path(__file__).parent.parent.parent
        excel_path = script_dir / "World Energy Balances Highlights 2025.xlsx"
        
        if not excel_path.exists():
            print(f"    Warning: IEA Excel file not found at {excel_path}")
            return 0
        
        try:
            df = pd.read_excel(excel_path, sheet_name='TimeSeries_1971-2024', header=1)
            
            # Filter for production data
            production_df = df[(df['Flow'] == 'Production (PJ)') & (df['Product'] == 'Total')]
            
            # Exclude aggregate regions
            aggregates = [
                'World', 'Non-OECD Total', 'IEA Total', 'OECD Total', 
                'Non-OECD Asia (including China)', 'Middle East', 
                'Non-OECD Europe and Eurasia', 'Africa', 'Non-OECD Americas',
                'IEA and Accession/Association countries', 'OECD Europe', 
                'OECD Americas', 'OECD Asia Oceania',
                'European Union - 28 countries', 'European Union - 27 countries'
            ]
            
            countries_df = production_df[~production_df['Country'].isin(aggregates)]
            world_df = production_df[production_df['Country'] == 'World']
            
            # Country name to key mapping
            country_mapping = {
                "People's Republic of China": 'china',
                'United States': 'united_states',
                'India': 'india',
                'Canada': 'canada',
                'Indonesia': 'indonesia',
                'Australia': 'australia',
                'Brazil': 'brazil',
                'Norway': 'norway',
                'Mexico': 'mexico',
                'South Africa': 'south_africa',
                'Colombia': 'colombia',
                'United Kingdom': 'united_kingdom',
                'Egypt': 'egypt',
                'Argentina': 'argentina',
            }
            
            data_rows = []
            years = [str(y) for y in range(2007, 2025)]
            
            for year in years:
                if year not in df.columns:
                    continue
                
                year_int = int(year)
                world_total = world_df[year].values[0] if len(world_df) > 0 else None
                if world_total is None or world_total <= 0:
                    continue
                
                data_rows.append(('energy_prod_world_total', str(year_int), round(float(world_total), 2)))
                
                # Canada specific values
                canada_val = countries_df[countries_df['Country'] == 'Canada'][year].values
                if len(canada_val) > 0:
                    data_rows.append(('energy_prod_canada_pj', str(year_int), round(float(canada_val[0]), 2)))
                    data_rows.append(('energy_prod_canada_pct', str(year_int), round(float(canada_val[0]) / float(world_total) * 100, 1)))
                
                # All countries
                all_countries = {}
                
                for _, row in countries_df.iterrows():
                    country_name = row['Country']
                    country_key = country_mapping.get(country_name)
                    if country_key:
                        production_pj = row[year]
                        if pd.notna(production_pj) and production_pj > 0:
                            pct_of_world = float(production_pj) / float(world_total) * 100
                            all_countries[country_key] = {
                                'pj': round(float(production_pj), 2),
                                'pct': round(pct_of_world, 1)
                            }
                
                # Sort by percentage and add rankings
                sorted_countries = sorted(all_countries.items(), key=lambda x: x[1]['pct'], reverse=True)
                
                for rank, (country_key, values) in enumerate(sorted_countries[:10], 1):
                    data_rows.append((f'energy_prod_{country_key}_pj', str(year_int), values['pj']))
                    data_rows.append((f'energy_prod_{country_key}_pct', str(year_int), values['pct']))
                    data_rows.append((f'energy_prod_{country_key}_rank', str(year_int), rank))
            
            # Calculate growth since 2005
            canada_2005 = countries_df[countries_df['Country'] == 'Canada']['2005'].values
            world_2005 = world_df['2005'].values[0] if len(world_df) > 0 else None
            
            for year in years:
                if year not in df.columns:
                    continue
                year_int = int(year)
                canada_current = countries_df[countries_df['Country'] == 'Canada'][year].values
                world_current = world_df[year].values[0] if len(world_df) > 0 else None
                
                if len(canada_2005) > 0 and len(canada_current) > 0 and canada_2005[0] > 0:
                    canada_growth = (float(canada_current[0]) - float(canada_2005[0])) / float(canada_2005[0]) * 100
                    data_rows.append(('energy_prod_canada_growth_since_2005', str(year_int), round(canada_growth, 0)))
                
                if world_2005 and world_current and world_2005 > 0:
                    world_growth = (float(world_current) - float(world_2005)) / float(world_2005) * 100
                    data_rows.append(('energy_prod_world_growth_since_2005', str(year_int), round(world_growth, 0)))
            
            metadata_rows = [
                ('energy_prod_world_total', 'World Total Primary Energy Production', 'PJ', 'petajoules'),
                ('energy_prod_canada_pj', 'Canada Primary Energy Production', 'PJ', 'petajoules'),
                ('energy_prod_canada_pct', 'Canada Share of World Energy Production', '%', 'percent'),
                ('energy_prod_canada_growth_since_2005', 'Canada Energy Production Growth Since 2005', '%', 'percent'),
                ('energy_prod_world_growth_since_2005', 'World Energy Production Growth Since 2005', '%', 'percent'),
                ('energy_prod_china_pct', 'China Share of World Energy Production', '%', 'percent'),
                ('energy_prod_united_states_pct', 'United States Share of World Energy Production', '%', 'percent'),
                ('energy_prod_india_pct', 'India Share of World Energy Production', '%', 'percent'),
                ('energy_prod_indonesia_pct', 'Indonesia Share of World Energy Production', '%', 'percent'),
                ('energy_prod_australia_pct', 'Australia Share of World Energy Production', '%', 'percent'),
            ]
            
            print(f"    Processed {len(data_rows)} data rows")
            return self.store_raw_data('world_energy_production', data_rows, metadata_rows)
            
        except Exception as e:
            print(f"    Error processing world energy data: {e}")
            import traceback
            traceback.print_exc()
            return 0
    
    def _process_cea_data(self) -> int:
        """
        Process Canadian Energy Assets (CEA) data from Excel file.
        
        Per instructions:
        - A1 = aggregate Non-current assets (Grand Total row)
        - A3 = aggregate Non-current assets for Country=Canada (domestic)
        - A4 = A1 - A3 (abroad)
        - Regions = aggregate by Continent from Row Labels for map
        
        Returns:
            Number of data rows processed
        """
        print("  Processing CEA data from Excel...")
        
        import os
        from pathlib import Path
        
        script_dir = Path(__file__).parent.parent.parent
        cea_path = script_dir / "CEA_2023.xlsx"
        
        if not cea_path.exists():
            print(f"    Warning: CEA file not found at {cea_path}")
            return 0
        
        try:
            xl_file = pd.ExcelFile(cea_path)
            sheet_names = xl_file.sheet_names
            print(f"    Found {len(sheet_names)} sheet(s): {sheet_names}")
            
            data_rows = []
            year_data = {}
            
            # Look for detailed sheets by year and Evolution table
            detailed_sheets_by_year = {}
            summary_sheet = None
            
            for sheet_name in sheet_names:
                year_match = pd.Series([sheet_name]).str.extract(r'(\d{4})')[0]
                if not year_match.empty and not year_match.isna().all():
                    year = int(year_match.iloc[0])
                    if 'Canadian Energy Assets' in sheet_name and 2012 <= year <= 2023:
                        detailed_sheets_by_year[year] = sheet_name
                        print(f"    Found detailed sheet for {year}: '{sheet_name}'")
                
                if 'Evolution' in sheet_name or 'evolution' in sheet_name.lower():
                    summary_sheet = sheet_name
                    print(f"    Found Evolution table sheet: '{summary_sheet}'")
            
            if not summary_sheet and 'By region' in sheet_names:
                summary_sheet = 'By region'
                print(f"    Using 'By region' sheet for Evolution table")
            
            if not summary_sheet and len(detailed_sheets_by_year) == 0:
                print(f"    WARNING: No Evolution table or detailed sheets found")
                summary_sheet = sheet_names[0] if sheet_names else None
            
            # Process Evolution table if found
            if summary_sheet:
                print(f"\n    Processing Evolution table from sheet: '{summary_sheet}'")
                try:
                    df_raw = pd.read_excel(cea_path, sheet_name=summary_sheet, header=None)
                    
                    header_row = None
                    row_labels_col_idx = None
                    year_cols_info = {}
                    
                    # Find Evolution table start
                    evolution_start_row = None
                    for row_idx in range(min(100, len(df_raw))):
                        row_text = ' '.join([str(df_raw.iloc[row_idx, j]) for j in range(min(5, len(df_raw.columns))) if pd.notna(df_raw.iloc[row_idx, j])])
                        if 'evolution' in row_text.lower() and '2012' in row_text and '2023' in row_text:
                            evolution_start_row = row_idx
                            print(f"      Found Evolution table starting at row {row_idx}")
                            break
                    
                    # Search for Row Labels and year columns
                    search_start = evolution_start_row if evolution_start_row is not None else 0
                    search_end = min(search_start + 20, len(df_raw)) if evolution_start_row else min(100, len(df_raw))
                    
                    for row_idx in range(search_start, search_end):
                        for col_idx in range(min(15, len(df_raw.columns))):
                            cell_val = str(df_raw.iloc[row_idx, col_idx]).strip()
                            cell_lower = cell_val.lower()
                            
                            if 'row labels' in cell_lower and row_labels_col_idx is None:
                                row_labels_col_idx = col_idx
                                header_row = row_idx
                                print(f"      Found 'Row Labels' at row {row_idx}, col {col_idx}")
                            
                            if 'non-current' in cell_lower or 'noncurrent' in cell_lower or ('assets' in cell_lower and ('somme' in cell_lower or 'sum' in cell_lower)):
                                year_match = pd.Series([cell_val]).str.extract(r'(\d{4})')[0]
                                if not year_match.empty and not year_match.isna().all():
                                    year = int(year_match.iloc[0])
                                    if 2012 <= year <= 2023:
                                        if header_row is None:
                                            header_row = row_idx
                                        year_cols_info[year] = (row_idx, col_idx)
                                        print(f"      Found year {year} at row {row_idx}, col {col_idx}")
                    
                    # Parse with header row
                    if header_row is not None and len(year_cols_info) > 0:
                        df = pd.read_excel(cea_path, sheet_name=summary_sheet, header=header_row)
                        print(f"      Read with header at row {header_row}")
                        
                        row_labels_col = None
                        year_columns = {}
                        
                        for col in df.columns:
                            col_str = str(col).strip()
                            col_lower = col_str.lower()
                            
                            if 'row labels' in col_lower:
                                row_labels_col = col
                            
                            if 'non-current' in col_lower or 'noncurrent' in col_lower or 'assets' in col_lower:
                                year_match = pd.Series([col_str]).str.extract(r'(\d{4})')[0]
                                if not year_match.empty and not year_match.isna().all():
                                    year = int(year_match.iloc[0])
                                    if 2012 <= year <= 2023:
                                        year_columns[year] = col
                        
                        # Process each year
                        if row_labels_col and len(year_columns) > 0:
                            region_mapping = {
                                'Africa': 'africa',
                                'Asia': 'asia',
                                'Canada': 'canada',
                                'Europe': 'europe',
                                'Latin America and Caribbean': 'latin_america',
                                'North America (US and Mexico)': 'north_america',
                                'Oceania': 'oceania'
                            }
                            
                            for year, year_col in sorted(year_columns.items()):
                                print(f"\n      Processing year {year}...")
                                
                                df_year = df[[row_labels_col, year_col]].copy()
                                df_year[year_col] = pd.to_numeric(df_year[year_col], errors='coerce')
                                df_year = df_year.dropna(subset=[year_col])
                                
                                A1 = 0
                                A3 = 0
                                region_values = {}
                                
                                for _, row in df_year.iterrows():
                                    region_name = str(row[row_labels_col]).strip()
                                    value = row[year_col]
                                    
                                    if pd.isna(value) or value == 0:
                                        continue
                                    
                                    if 'Grand Total' in region_name:
                                        A1 = float(value)
                                        print(f"        A1 (Grand Total): ${A1:,.0f}M")
                                        continue
                                    
                                    if 'Total ABROAD' in region_name or 'Total Abroad' in region_name:
                                        continue
                                    
                                    for map_key, region_key in region_mapping.items():
                                        if map_key.lower() in region_name.lower():
                                            if region_key not in region_values:
                                                region_values[region_key] = 0
                                            region_values[region_key] += float(value)
                                            
                                            if region_key == 'canada' and A3 == 0:
                                                A3 = float(value)
                                                print(f"        A3 (Canada from Row Labels): ${A3:,.0f}M")
                                            break
                                
                                if A1 == 0:
                                    A1 = float(df_year[year_col].sum())
                                    print(f"        A1 (calculated from sum): ${A1:,.0f}M")
                                
                                A4 = A1 - A3
                                
                                year_data[year] = {
                                    'A1': A1,
                                    'A3': A3,
                                    'A4': A4,
                                    'regions': region_values
                                }
                                
                                print(f"        Year {year}: A1=${A1/1000:.1f}B, A3=${A3/1000:.1f}B, A4=${A4/1000:.1f}B")
                    else:
                        # Fallback: try reading without header detection
                        df = pd.read_excel(cea_path, sheet_name=summary_sheet)
                        print(f"      Shape: {df.shape}, Columns: {list(df.columns)[:10]}...")
                        
                except Exception as e:
                    print(f"      ERROR processing Evolution table: {e}")
                    import traceback
                    traceback.print_exc()
            
            # Process detailed sheets if Evolution table didn't work
            for year, sheet_name in detailed_sheets_by_year.items():
                if year in year_data:
                    continue  # Already have data for this year
                    
                print(f"\n    Processing detailed sheet for {year}: '{sheet_name}'")
                try:
                    df = pd.read_excel(cea_path, sheet_name=sheet_name)
                    
                    assets_col = None
                    country_col = None
                    continent_col = None
                    
                    for col in df.columns:
                        col_str = str(col).strip()
                        col_lower = col_str.lower()
                        
                        if assets_col is None and ('non-current' in col_lower or 'noncurrent' in col_lower) and str(year) in col_str:
                            assets_col = col
                        
                        if country_col is None and 'country' in col_lower:
                            country_col = col
                        
                        if continent_col is None and 'continent' in col_lower:
                            continent_col = col
                    
                    if assets_col:
                        df[assets_col] = pd.to_numeric(df[assets_col], errors='coerce')
                        df = df.dropna(subset=[assets_col])
                        
                        A1 = float(df[assets_col].sum())
                        
                        if country_col and country_col in df.columns:
                            A3 = float(df[df[country_col].str.contains('Canada', case=False, na=False)][assets_col].sum())
                        elif continent_col and continent_col in df.columns:
                            A3 = float(df[df[continent_col].str.contains('Canada', case=False, na=False)][assets_col].sum())
                        else:
                            A3 = 0
                        
                        A4 = A1 - A3
                        
                        year_data[year] = {'A1': A1, 'A3': A3, 'A4': A4, 'regions': {}}
                        
                        # Extract regions from continent column
                        if continent_col and continent_col in df.columns:
                            region_mapping = {
                                'Africa': 'africa',
                                'Asia': 'asia',
                                'Canada': 'canada',
                                'Europe': 'europe',
                                'Latin America and Caribbean': 'latin_america',
                                'North America (US and Mexico)': 'north_america',
                                'Oceania': 'oceania'
                            }
                            
                            region_agg = df.groupby(continent_col)[assets_col].sum().reset_index()
                            for _, row in region_agg.iterrows():
                                continent_name = str(row[continent_col]).strip()
                                value = row[assets_col]
                                
                                for map_key, region_key in region_mapping.items():
                                    if map_key.lower() in continent_name.lower():
                                        year_data[year]['regions'][region_key] = float(value)
                                        break
                        
                        print(f"      {year}: A1=${A1/1000:.1f}B, A3=${A3/1000:.1f}B, A4=${A4/1000:.1f}B")
                except Exception as e:
                    print(f"      ERROR: {e}")
            
            # Build data rows from year_data
            if len(year_data) == 0:
                print(f"\n    ERROR: No data extracted from any sheet")
                return 0
            
            for year in sorted(year_data.keys()):
                data = year_data[year]
                A1 = data['A1']
                A3 = data.get('A3', 0)
                A4 = data.get('A4', 0)
                
                if A3 == 0 and 'canada' in data['regions']:
                    A3 = data['regions']['canada']
                    A4 = A1 - A3
                
                if A4 == 0:
                    A4 = A1 - A3
                
                # Convert millions to billions for output
                data_rows.append(('cea_total', str(year), round(A1 / 1000, 1)))
                data_rows.append(('cea_domestic', str(year), round(A3 / 1000, 1)))
                data_rows.append(('cea_abroad', str(year), round(A4 / 1000, 1)))
                
                for region_key, region_value in data['regions'].items():
                    if region_value > 0:
                        data_rows.append((f'cea_{region_key}', str(year), round(float(region_value) / 1000, 1)))
            
            metadata_rows = [
                ('cea_total', 'Canadian Energy Assets - Total (A1)', 'Billions of dollars', 'billions'),
                ('cea_domestic', 'Canadian Energy Assets - Domestic (A3, Country=Canada)', 'Billions of dollars', 'billions'),
                ('cea_abroad', 'Canadian Energy Assets - Abroad (A4)', 'Billions of dollars', 'billions'),
                ('cea_canada', 'Canadian Energy Assets - Canada (by Continent)', 'Billions of dollars', 'billions'),
                ('cea_north_america', 'Canadian Energy Assets - North America (US and Mexico)', 'Billions of dollars', 'billions'),
                ('cea_latin_america', 'Canadian Energy Assets - Latin America and Caribbean', 'Billions of dollars', 'billions'),
                ('cea_europe', 'Canadian Energy Assets - Europe', 'Billions of dollars', 'billions'),
                ('cea_africa', 'Canadian Energy Assets - Africa', 'Billions of dollars', 'billions'),
                ('cea_asia', 'Canadian Energy Assets - Asia', 'Billions of dollars', 'billions'),
                ('cea_oceania', 'Canadian Energy Assets - Oceania', 'Billions of dollars', 'billions'),
            ]
            
            print(f"\n    CEA Processing Complete")
            print(f"    Years processed: {sorted(year_data.keys())}")
            print(f"    Total data rows: {len(data_rows)}")
            
            return self.store_raw_data('canadian_energy_assets', data_rows, metadata_rows)
            
        except Exception as e:
            print(f"    Error processing CEA file: {e}")
            import traceback
            traceback.print_exc()
            return 0
