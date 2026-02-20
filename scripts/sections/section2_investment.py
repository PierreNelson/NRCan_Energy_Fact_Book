"""
Section 2: Investment data processor.

Handles data for:
- Capital expenditures
- Infrastructure stock
- Investment by asset type
- International investment (FDI/CDIA)
- Foreign control
- Environmental protection expenditures
- Major projects
- Clean technology
"""

import io
import pandas as pd
import requests
from typing import Dict, Any, List, Tuple
from datetime import datetime

from .base import SectionProcessor


class Section2Investment(SectionProcessor):
    """
    Processor for Section 2: Investment.
    
    Data sources:
    - capital_expenditures: StatCan Table 34-10-0036-01
    - infrastructure: StatCan Table 36-10-0608-01
    - investment_by_asset: StatCan Table 36-10-0608-01
    - international_investment: StatCan Table 36-10-0009-01
    - foreign_control: StatCan Table 33-10-0570-01
    - environmental_protection: StatCan Table 38-10-0130-01
    - major_projects: NRCan Major Projects Inventory
    - clean_tech: Derived data
    """
    
    SECTION_KEY = "section2_investment"
    SECTION_NAME = "Investment"
    SECTION_ID = 2
    
    # Infrastructure vectors from original data_retrieval.py
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
    
    def get_source_handlers(self) -> Dict[str, callable]:
        """Return mapping of source keys to handler functions."""
        return {
            'capital_expenditures': self._process_capital_expenditures,
            'infrastructure': self._process_infrastructure,
            'investment_by_asset': self._process_investment_by_asset,
            'international_investment': self._process_international_investment,
            'foreign_control': self._process_foreign_control,
            'environmental_protection': self._process_environmental_protection,
            'major_projects': self._process_major_projects,
            'clean_tech': self._process_clean_tech,
            'major_projects_map': self._process_major_projects_map,
        }
    
    # =========================================================================
    # URL BUILDERS
    # =========================================================================
    
    def _get_future_end_date(self) -> str:
        """Get end date 5 years in future for StatCan queries."""
        return f"{datetime.now().year + 5}0101"
    
    def _get_capital_expenditures_url(self) -> str:
        """Get URL for Table 34-10-0036-01 (Capital expenditures)."""
        end_date = self._get_future_end_date()
        # Use exact URL from working data_retrieval.py (note: -nonTraduit)
        return (
            f"https://www150.statcan.gc.ca/t1/tbl1/en/dtl!downloadDbLoadingData-nonTraduit.action?"
            f"pid=3410003601&latestN=0&startDate=20070101&endDate={end_date}"
            f"&csvLocale=en&selectedMembers=%5B%5B%5D%2C%5B1%5D%2C%5B8%2C9%2C11%2C34%2C36%2C37%2C50%2C91%5D%5D"
            f"&checkedLevels=0D1"
        )
    
    def _get_infrastructure_url(self) -> str:
        """Get URL for Table 36-10-0608-01 (Infrastructure stock)."""
        end_date = self._get_future_end_date()
        # Use exact URL from working data_retrieval.py
        return (
            f"https://www150.statcan.gc.ca/t1/tbl1/en/dtl!downloadDbLoadingData.action?"
            f"pid=3610060801&latestN=0&startDate=20070101&endDate={end_date}"
            f"&csvLocale=en&selectedMembers=%5B%5B%5D%2C%5B3%5D%2C%5B1%5D%2C%5B%5D%2C%5B48%5D%2C%5B%5D%5D"
            f"&checkedLevels=0D1%2C3D1%2C4D1%2C5D1%2C5D2"
        )
    
    def _get_investment_by_asset_url(self) -> str:
        """Get URL for investment by asset type (Table 36-10-0608-01)."""
        end_date = self._get_future_end_date()
        return (
            f"https://www150.statcan.gc.ca/t1/tbl1/en/dtl!downloadDbLoadingData.action?"
            f"pid=3610060801&latestN=0&startDate=20070101&endDate={end_date}"
            f"&csvLocale=en&selectedMembers=%5B%5B%5D%2C%5B1%5D%2C%5B2%5D%2C%5B%5D%2C%5B40%2C41%2C42%2C43%2C44%2C45%2C46%2C48%2C57%5D%2C%5B%5D%5D"
            f"&checkedLevels=0D1%2C3D1%2C5D1"
        )
    
    def _get_international_investment_url(self) -> str:
        """Get URL for Table 36-10-0009-01 (International investment)."""
        end_date = self._get_future_end_date()
        # Use exact URL from working data_retrieval.py
        return (
            f"https://www150.statcan.gc.ca/t1/tbl1/en/dtl!downloadDbLoadingData.action?"
            f"pid=3610000901&latestN=0&startDate=20070101&endDate={end_date}"
            f"&csvLocale=en&selectedMembers=%5B%5B%5D%2C%5B1%2C16%2C18%2C19%2C30%5D%2C%5B%5D%2C%5B%5D%5D"
            f"&checkedLevels=0D1%2C2D1%2C3D1"
        )
    
    def _get_foreign_control_url(self) -> str:
        """Get URL for Table 33-10-0570-01 (Foreign control)."""
        end_date = self._get_future_end_date()
        return (
            f"https://www150.statcan.gc.ca/t1/tbl1/en/dtl!downloadDbLoadingData.action?"
            f"pid=3310057001&latestN=0&startDate=20100101&endDate={end_date}"
            f"&csvLocale=en&selectedMembers=%5B%5B%5D%2C%5B3%2C9%2C11%5D%2C%5B2%5D%2C%5B2%5D%5D"
            f"&checkedLevels=0D1"
        )
    
    def _get_environmental_protection_url(self) -> str:
        """Get URL for Table 38-10-0130-01 (Environmental protection)."""
        end_date = self._get_future_end_date()
        return (
            f"https://www150.statcan.gc.ca/t1/tbl1/en/dtl!downloadDbLoadingData.action?"
            f"pid=3810013001&latestN=0&startDate=20070101&endDate={end_date}"
            f"&csvLocale=en&selectedMembers=%5B%5B%5D%2C%5B%5D%2C%5B3%2C5%2C6%2C11%5D%2C%5B12%2C13%2C14%2C15%5D%5D"
            f"&checkedLevels=0D1%2C1D1%2C2D1%2C3D1%2C3D2"
        )
    
    # =========================================================================
    # DATA PROCESSORS
    # =========================================================================
    
    def _process_capital_expenditures(self) -> int:
        """
        Process capital expenditures data.
        
        Data flow:
        1. Fetch raw StatCan data → store in raw_statcan_data
        2. Calculate aggregates → store in calc_capital_expenditures
        3. Export will pull from calc table with semantic vector names
        
        Returns:
            Number of data rows processed
        """
        print("  Fetching capital expenditures data...")
        
        try:
            df = self.fetch_csv_from_url(self._get_capital_expenditures_url())
        except Exception as e:
            print(f"    Warning: Failed to fetch data: {e}")
            return 0
        
        # STEP 1: Store raw StatCan data with original format
        raw_data_rows, raw_metadata = self.extract_data_and_metadata(df, 'capital_expenditures')
        if raw_data_rows:
            self.repo.insert_raw_statcan_data('capital_expenditures_raw', raw_data_rows)
            print(f"    Stored {len(raw_data_rows)} raw StatCan data points")
        
        # Find columns case-insensitively
        ref_date_col = self.get_column(df, 'REF_DATE', 'Ref_date', 'ref_date')
        value_col = self.get_column(df, 'VALUE', 'Value', 'value')
        
        # Find the capital/repair column
        capex_col = None
        for col in df.columns:
            if 'capital' in col.lower() and 'repair' in col.lower():
                capex_col = col
                break
        
        if capex_col and capex_col in df.columns:
            df = df[df[capex_col] == 'Capital expenditures'].copy()
        
        if ref_date_col:
            df['year'] = pd.to_numeric(df[ref_date_col], errors='coerce')
        else:
            print(f"    Warning: No REF_DATE column found. Columns: {df.columns.tolist()[:10]}")
            return 0
        
        years = sorted(df['year'].dropna().unique())
        
        # Find NAICS column
        naics_col = None
        for col in df.columns:
            if 'naics' in col.lower() or 'industry' in col.lower():
                naics_col = col
                break
        if not naics_col:
            print(f"    Warning: No NAICS/Industry column found. Columns: {df.columns.tolist()[:10]}")
            return 0
        
        calc_data = []  # For calc_capital_expenditures table
        data_rows = []  # For semantic vector export (backwards compatibility)
        
        for year in years:
            year_df = df[df['year'] == year]
            
            # Extract by industry
            oil_gas_mask = year_df[naics_col].str.match(r'^Oil and gas extraction \[211\]$', na=False)
            oil_gas = float(year_df.loc[oil_gas_mask, value_col].sum()) if value_col else 0
            
            elec_mask = year_df[naics_col].str.contains(r'\[2211\]', regex=True, na=False)
            electricity = float(year_df.loc[elec_mask, value_col].sum()) if value_col else 0
            
            other_mask = year_df[naics_col].str.contains(r'\[213\]|\[2212\]|\[324\]|\[486\]', regex=True, na=False)
            other = float(year_df.loc[other_mask, value_col].sum()) if value_col else 0
            
            total = oil_gas + electricity + other
            
            if total > 0:
                year_int = int(year)
                
                # Calculate percentages (pre-calculated for frontend)
                oil_gas_pct = round((oil_gas / total) * 100, 1)
                electricity_pct = round((electricity / total) * 100, 1)
                other_pct = round((other / total) * 100, 1)
                
                # Convert to billions for display (values are in millions)
                total_billions = round(total / 1000, 2)
                oil_gas_billions = round(oil_gas / 1000, 2)
                electricity_billions = round(electricity / 1000, 2)
                other_billions = round(other / 1000, 2)
                
                # STEP 2: Add to calc table data
                calc_data.append({
                    'year': year_int,
                    'oil_gas': round(oil_gas, 1),
                    'electricity': round(electricity, 1),
                    'other_energy': round(other, 1),
                    'total': round(total, 1),
                })
                
                # Store with semantic vectors - raw values (millions)
                data_rows.extend([
                    ('capex_oil_gas', str(year_int), round(oil_gas, 1)),
                    ('capex_electricity', str(year_int), round(electricity, 1)),
                    ('capex_other', str(year_int), round(other, 1)),
                    ('capex_total', str(year_int), round(total, 1)),
                ])
                
                # Store pre-calculated percentages
                data_rows.extend([
                    ('capex_oil_gas_pct', str(year_int), oil_gas_pct),
                    ('capex_electricity_pct', str(year_int), electricity_pct),
                    ('capex_other_pct', str(year_int), other_pct),
                ])
                
                # Store pre-calculated billions values
                data_rows.extend([
                    ('capex_oil_gas_billions', str(year_int), oil_gas_billions),
                    ('capex_electricity_billions', str(year_int), electricity_billions),
                    ('capex_other_billions', str(year_int), other_billions),
                    ('capex_total_billions', str(year_int), total_billions),
                ])
        
        metadata_rows = [
            # Raw values in millions
            ('capex_oil_gas', 'Capital expenditures - Oil and gas extraction', 'Millions of dollars', 'millions'),
            ('capex_electricity', 'Capital expenditures - Electric power', 'Millions of dollars', 'millions'),
            ('capex_other', 'Capital expenditures - Other energy', 'Millions of dollars', 'millions'),
            ('capex_total', 'Capital expenditures - Total energy sector', 'Millions of dollars', 'millions'),
            # Pre-calculated percentages
            ('capex_oil_gas_pct', 'Capital expenditures - Oil and gas (% of total)', 'Percent', 'percent'),
            ('capex_electricity_pct', 'Capital expenditures - Electric power (% of total)', 'Percent', 'percent'),
            ('capex_other_pct', 'Capital expenditures - Other energy (% of total)', 'Percent', 'percent'),
            # Pre-calculated billions values
            ('capex_oil_gas_billions', 'Capital expenditures - Oil and gas extraction', 'Billions of dollars', 'billions'),
            ('capex_electricity_billions', 'Capital expenditures - Electric power', 'Billions of dollars', 'billions'),
            ('capex_other_billions', 'Capital expenditures - Other energy', 'Billions of dollars', 'billions'),
            ('capex_total_billions', 'Capital expenditures - Total energy sector', 'Billions of dollars', 'billions'),
        ]
        
        # STEP 2: Store calculated data in calc_capital_expenditures table
        if calc_data:
            self.repo.upsert_capital_expenditures(calc_data)
            print(f"    Stored {len(calc_data)} years in calc_capital_expenditures")
        
        # Store semantic vectors for backwards compatibility
        return self.store_raw_data('capital_expenditures', data_rows, metadata_rows)
    
    def _process_infrastructure(self) -> int:
        """
        Process infrastructure stock data.
        
        Data flow:
        1. Fetch raw StatCan data → store in raw_statcan_data
        2. Calculate aggregates → store in calc_infrastructure
        3. Export will pull from calc table with semantic vector names
        
        Returns:
            Number of data rows processed
        """
        print("  Fetching infrastructure stock data...")
        
        df = self.fetch_csv_from_url(self._get_infrastructure_url())
        
        # STEP 1: Store raw StatCan data with original format
        raw_data_rows, raw_metadata = self.extract_data_and_metadata(df, 'infrastructure')
        if raw_data_rows:
            self.repo.insert_raw_statcan_data('infrastructure_raw', raw_data_rows)
            print(f"    Stored {len(raw_data_rows)} raw StatCan data points")
        
        # Find columns case-insensitively
        vector_col = self.get_column(df, 'VECTOR', 'Vector', 'vector')
        ref_date_col = self.get_column(df, 'REF_DATE', 'Ref_date', 'ref_date')
        value_col = self.get_column(df, 'VALUE', 'Value', 'value')
        
        if not vector_col:
            print(f"    Warning: No VECTOR column found. Columns: {df.columns.tolist()[:10]}")
            return 0
        
        all_vectors = list(self.INFRA_VECTORS.values())
        df_filtered = df[df[vector_col].isin(all_vectors)].copy()
        df_filtered['year'] = pd.to_numeric(df_filtered[ref_date_col], errors='coerce') if ref_date_col else None
        
        years = sorted(df_filtered['year'].dropna().unique())
        calc_data = []  # For calc_infrastructure table
        data_rows = []  # For semantic vector export (backwards compatibility)
        
        for year in years:
            year_df = df_filtered[df_filtered['year'] == year]
            
            def get_val(vector_key):
                vec = self.INFRA_VECTORS.get(vector_key)
                row = year_df[year_df[vector_col] == vec]
                return float(row[value_col].sum()) if not row.empty and value_col else 0
            
            # Calculate aggregated categories
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
            
            # Combined categories
            fuel_energy_pipelines = fuel_energy + pipeline_transport
            transport = transport_raw - pipeline_transport
            health_housing = health + housing
            public_safety = public_order + transit + communication + recreation
            
            total = fuel_energy_pipelines + transport + health_housing + education + public_safety + environmental
            
            if total > 0:
                year_int = int(year)
                
                # Calculate percentages (pre-calculated for frontend)
                fuel_energy_pipelines_pct = round((fuel_energy_pipelines / total) * 100, 1)
                transport_pct = round((transport / total) * 100, 1)
                health_housing_pct = round((health_housing / total) * 100, 1)
                education_pct = round((education / total) * 100, 1)
                public_safety_pct = round((public_safety / total) * 100, 1)
                environmental_pct = round((environmental / total) * 100, 1)
                
                # Convert to billions for display (values are in millions)
                total_billions = round(total / 1000, 2)
                fuel_energy_pipelines_billions = round(fuel_energy_pipelines / 1000, 2)
                transport_billions = round(transport / 1000, 2)
                health_housing_billions = round(health_housing / 1000, 2)
                education_billions = round(education / 1000, 2)
                public_safety_billions = round(public_safety / 1000, 2)
                environmental_billions = round(environmental / 1000, 2)
                
                # STEP 2: Add to calc table data
                calc_data.append({
                    'year': year_int,
                    'fuel_energy_pipelines': round(float(fuel_energy_pipelines), 1),
                    'transport': round(float(transport), 1),
                    'health_housing': round(float(health_housing), 1),
                    'education': round(float(education), 1),
                    'public_safety': round(float(public_safety), 1),
                    'environmental': round(float(environmental), 1),
                    'total': round(float(total), 1),
                })
                
                # Store with semantic vectors - raw values (millions)
                data_rows.extend([
                    ('infra_fuel_energy_pipelines', str(year_int), round(float(fuel_energy_pipelines), 1)),
                    ('infra_transport', str(year_int), round(float(transport), 1)),
                    ('infra_health_housing', str(year_int), round(float(health_housing), 1)),
                    ('infra_education', str(year_int), round(float(education), 1)),
                    ('infra_public_safety', str(year_int), round(float(public_safety), 1)),
                    ('infra_environmental', str(year_int), round(float(environmental), 1)),
                    ('infra_total', str(year_int), round(float(total), 1)),
                ])
                
                # Store pre-calculated percentages
                data_rows.extend([
                    ('infra_fuel_energy_pipelines_pct', str(year_int), fuel_energy_pipelines_pct),
                    ('infra_transport_pct', str(year_int), transport_pct),
                    ('infra_health_housing_pct', str(year_int), health_housing_pct),
                    ('infra_education_pct', str(year_int), education_pct),
                    ('infra_public_safety_pct', str(year_int), public_safety_pct),
                    ('infra_environmental_pct', str(year_int), environmental_pct),
                ])
                
                # Store pre-calculated billions values
                data_rows.extend([
                    ('infra_fuel_energy_pipelines_billions', str(year_int), fuel_energy_pipelines_billions),
                    ('infra_transport_billions', str(year_int), transport_billions),
                    ('infra_health_housing_billions', str(year_int), health_housing_billions),
                    ('infra_education_billions', str(year_int), education_billions),
                    ('infra_public_safety_billions', str(year_int), public_safety_billions),
                    ('infra_environmental_billions', str(year_int), environmental_billions),
                    ('infra_total_billions', str(year_int), total_billions),
                ])
        
        metadata_rows = [
            # Raw values in millions
            ('infra_fuel_energy_pipelines', 'Infrastructure - Fuel, energy and pipelines', 'Millions of dollars', 'millions'),
            ('infra_transport', 'Infrastructure - Transport (less pipelines)', 'Millions of dollars', 'millions'),
            ('infra_health_housing', 'Infrastructure - Health and housing', 'Millions of dollars', 'millions'),
            ('infra_education', 'Infrastructure - Education', 'Millions of dollars', 'millions'),
            ('infra_public_safety', 'Infrastructure - Public safety and other', 'Millions of dollars', 'millions'),
            ('infra_environmental', 'Infrastructure - Environmental protection', 'Millions of dollars', 'millions'),
            ('infra_total', 'Infrastructure - Total net stock', 'Millions of dollars', 'millions'),
            # Pre-calculated percentages
            ('infra_fuel_energy_pipelines_pct', 'Infrastructure - Fuel, energy and pipelines (% of total)', 'Percent', 'percent'),
            ('infra_transport_pct', 'Infrastructure - Transport (% of total)', 'Percent', 'percent'),
            ('infra_health_housing_pct', 'Infrastructure - Health and housing (% of total)', 'Percent', 'percent'),
            ('infra_education_pct', 'Infrastructure - Education (% of total)', 'Percent', 'percent'),
            ('infra_public_safety_pct', 'Infrastructure - Public safety (% of total)', 'Percent', 'percent'),
            ('infra_environmental_pct', 'Infrastructure - Environmental protection (% of total)', 'Percent', 'percent'),
            # Pre-calculated billions values
            ('infra_fuel_energy_pipelines_billions', 'Infrastructure - Fuel, energy and pipelines', 'Billions of dollars', 'billions'),
            ('infra_transport_billions', 'Infrastructure - Transport', 'Billions of dollars', 'billions'),
            ('infra_health_housing_billions', 'Infrastructure - Health and housing', 'Billions of dollars', 'billions'),
            ('infra_education_billions', 'Infrastructure - Education', 'Billions of dollars', 'billions'),
            ('infra_public_safety_billions', 'Infrastructure - Public safety', 'Billions of dollars', 'billions'),
            ('infra_environmental_billions', 'Infrastructure - Environmental protection', 'Billions of dollars', 'billions'),
            ('infra_total_billions', 'Infrastructure - Total net stock', 'Billions of dollars', 'billions'),
        ]
        
        # STEP 2: Store calculated data in calc_infrastructure table
        if calc_data:
            self.repo.upsert_infrastructure(calc_data)
            print(f"    Stored {len(calc_data)} years in calc_infrastructure")
        
        return self.store_raw_data('infrastructure', data_rows, metadata_rows)
    
    def _process_investment_by_asset(self) -> int:
        """
        Process investment by asset type data.
        
        Returns:
            Number of data rows processed
        """
        print("  Fetching investment by asset type data...")
        
        df = self.fetch_csv_from_url(self._get_investment_by_asset_url())
        
        # Find columns case-insensitively
        asset_col = self.get_column(df, 'Asset', 'ASSET', 'asset')
        ref_date_col = self.get_column(df, 'REF_DATE', 'Ref_date', 'ref_date')
        value_col = self.get_column(df, 'VALUE', 'Value', 'value')
        
        if not asset_col:
            print(f"    Warning: No Asset column found. Columns: {df.columns.tolist()[:10]}")
            return 0
        
        if ref_date_col:
            df['year'] = pd.to_numeric(df[ref_date_col], errors='coerce')
        else:
            print(f"    Warning: No REF_DATE column found.")
            return 0
        
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
                val = year_df.loc[mask, value_col].sum() if value_col else 0
                values[key] = float(val)
            
            # Calculate aggregates
            transmission_distribution = (
                values.get('transmission_networks', 0) + 
                values.get('distribution_networks', 0) + 
                values.get('transformers', 0)
            )
            
            total = (
                transmission_distribution + 
                values.get('pipelines', 0) + 
                values.get('nuclear', 0) +
                values.get('wind_solar', 0) +
                values.get('hydraulic', 0) +
                values.get('steam_thermal', 0) +
                values.get('other_electric', 0)
            )
            
            if total > 0:
                # Raw values in millions
                data_rows.extend([
                    ('asset_wind_solar', str(year_int), round(float(values['wind_solar']), 1)),
                    ('asset_transmission_distribution', str(year_int), round(float(transmission_distribution), 1)),
                    ('asset_pipelines', str(year_int), round(float(values['pipelines']), 1)),
                    ('asset_nuclear', str(year_int), round(float(values['nuclear']), 1)),
                    ('asset_hydraulic', str(year_int), round(float(values['hydraulic']), 1)),
                    ('asset_steam_thermal', str(year_int), round(float(values['steam_thermal']), 1)),
                    ('asset_other_electric', str(year_int), round(float(values['other_electric']), 1)),
                    ('asset_total', str(year_int), round(float(total), 1)),
                ])
                
                # Pre-calculated billions values (millions / 1000)
                data_rows.extend([
                    ('asset_wind_solar_billions', str(year_int), round(float(values['wind_solar']) / 1000, 2)),
                    ('asset_transmission_distribution_billions', str(year_int), round(float(transmission_distribution) / 1000, 2)),
                    ('asset_pipelines_billions', str(year_int), round(float(values['pipelines']) / 1000, 2)),
                    ('asset_nuclear_billions', str(year_int), round(float(values['nuclear']) / 1000, 2)),
                    ('asset_hydraulic_billions', str(year_int), round(float(values['hydraulic']) / 1000, 2)),
                    ('asset_steam_thermal_billions', str(year_int), round(float(values['steam_thermal']) / 1000, 2)),
                    ('asset_other_electric_billions', str(year_int), round(float(values['other_electric']) / 1000, 2)),
                    ('asset_total_billions', str(year_int), round(float(total) / 1000, 2)),
                ])
        
        metadata_rows = [
            ('asset_wind_solar', 'Investment by asset - Wind and solar', 'Millions of dollars', 'millions'),
            ('asset_transmission_distribution', 'Investment by asset - Transmission and distribution', 'Millions of dollars', 'millions'),
            ('asset_pipelines', 'Investment by asset - Pipelines', 'Millions of dollars', 'millions'),
            ('asset_nuclear', 'Investment by asset - Nuclear', 'Millions of dollars', 'millions'),
            ('asset_hydraulic', 'Investment by asset - Hydraulic', 'Millions of dollars', 'millions'),
            ('asset_steam_thermal', 'Investment by asset - Steam/thermal', 'Millions of dollars', 'millions'),
            ('asset_other_electric', 'Investment by asset - Other electric', 'Millions of dollars', 'millions'),
            ('asset_total', 'Investment - Total fuel, energy and pipeline', 'Millions of dollars', 'millions'),
            ('asset_wind_solar_billions', 'Investment by asset - Wind and solar (billions)', 'Billions of dollars', 'billions'),
            ('asset_transmission_distribution_billions', 'Investment by asset - Transmission and distribution (billions)', 'Billions of dollars', 'billions'),
            ('asset_pipelines_billions', 'Investment by asset - Pipelines (billions)', 'Billions of dollars', 'billions'),
            ('asset_nuclear_billions', 'Investment by asset - Nuclear (billions)', 'Billions of dollars', 'billions'),
            ('asset_hydraulic_billions', 'Investment by asset - Hydraulic (billions)', 'Billions of dollars', 'billions'),
            ('asset_steam_thermal_billions', 'Investment by asset - Steam/thermal (billions)', 'Billions of dollars', 'billions'),
            ('asset_other_electric_billions', 'Investment by asset - Other electric (billions)', 'Billions of dollars', 'billions'),
            ('asset_total_billions', 'Investment - Total fuel, energy and pipeline (billions)', 'Billions of dollars', 'billions'),
        ]
        
        return self.store_raw_data('investment_by_asset', data_rows, metadata_rows)
    
    def _process_international_investment(self) -> int:
        """
        Process international investment data (FDI and CDIA).
        
        Returns:
            Number of data rows processed
        """
        print("  Fetching international investment data...")
        
        df = self.fetch_csv_from_url(self._get_international_investment_url())
        
        # Find columns case-insensitively
        ref_date_col = self.get_column(df, 'REF_DATE', 'Ref_date', 'ref_date')
        value_col = self.get_column(df, 'VALUE', 'Value', 'value')
        naics_col = self.get_column(df, 'North American Industry Classification System (NAICS)',
                                     'NAICS', 'Industry')
        investment_col = self.get_column(df, 'Canadian and foreign direct investment',
                                          'Investment type', 'Type')
        
        if not naics_col:
            print(f"    Warning: No NAICS column found. Columns: {df.columns.tolist()[:10]}")
            return 0
        
        if not investment_col:
            print(f"    Warning: No investment type column found. Columns: {df.columns.tolist()[:10]}")
            return 0
        
        energy_industries = [
            'Oil and gas extraction [211]',
            'Support activities for mining and oil and gas extraction [213]',
            'Utilities [22]',
            'Petroleum and coal products manufacturing [324]'
        ]
        
        if ref_date_col:
            df['year'] = pd.to_numeric(df[ref_date_col], errors='coerce')
        else:
            return 0
        
        df = df[df['year'] >= 2007].copy()
        
        years = sorted(df['year'].dropna().unique())
        data_rows = []
        
        for year in years:
            year_df = df[df['year'] == year]
            year_int = int(year)
            
            # Filter to energy industries
            year_energy = year_df[year_df[naics_col].isin(energy_industries)]
            
            # Calculate CDIA and FDI totals
            cdia_mask = year_energy[investment_col].str.contains('Canadian direct investment abroad', case=False, na=False)
            cdia_total = float(year_energy.loc[cdia_mask, value_col].sum()) if value_col else 0
            
            fdi_mask = year_energy[investment_col].str.contains('Foreign direct investment in Canada', case=False, na=False)
            fdi_total = float(year_energy.loc[fdi_mask, value_col].sum()) if value_col else 0
            
            if cdia_total > 0 or fdi_total > 0:
                data_rows.extend([
                    ('intl_cdia', str(year_int), round(float(cdia_total), 1)),
                    ('intl_fdi', str(year_int), round(float(fdi_total), 1)),
                ])
                # Pre-calculated billions for frontend
                data_rows.extend([
                    ('intl_cdia_billions', str(year_int), round(float(cdia_total) / 1000, 1)),
                    ('intl_fdi_billions', str(year_int), round(float(fdi_total) / 1000, 1)),
                ])
        
        metadata_rows = [
            ('intl_cdia', 'Canadian direct investment abroad (CDIA) - Energy industry', 'Millions of dollars', 'millions'),
            ('intl_fdi', 'Foreign direct investment in Canada (FDI) - Energy industry', 'Millions of dollars', 'millions'),
            ('intl_cdia_billions', 'CDIA - Energy industry (billions)', 'Billions of dollars', 'billions'),
            ('intl_fdi_billions', 'FDI - Energy industry (billions)', 'Billions of dollars', 'billions'),
        ]
        
        return self.store_raw_data('international_investment', data_rows, metadata_rows)
    
    def _process_foreign_control(self) -> int:
        """
        Process foreign control data.
        
        Returns:
            Number of data rows processed
        """
        print("  Fetching foreign control data...")
        
        df = self.fetch_csv_from_url(self._get_foreign_control_url())
        
        # Find columns case-insensitively
        ref_date_col = self.get_column(df, 'REF_DATE', 'Ref_date', 'ref_date')
        value_col = self.get_column(df, 'VALUE', 'Value', 'value')
        naics_col = self.get_column(df, 'North American Industry Classification System (NAICS)',
                                     'NAICS', 'Industry')
        
        if not naics_col:
            print(f"    Warning: No NAICS column found. Columns: {df.columns.tolist()[:10]}")
            return 0
        
        if ref_date_col:
            df['year'] = pd.to_numeric(df[ref_date_col], errors='coerce')
        else:
            return 0
        
        years = sorted(df['year'].dropna().unique())
        data_rows = []
        
        # Use exact industry names from StatCan data
        industry_mapping = {
            'Total non-financial industries (excluding management of companies and enterprises)': 'foreign_all_non_financial',
            'Oil and gas extraction and support activities [211, 213]': 'foreign_oil_gas',
            'Utilities [22]': 'foreign_utilities'
        }
        
        for year in years:
            year_df = df[df['year'] == year]
            year_int = int(year)
            
            for industry_name, vector_key in industry_mapping.items():
                # Use exact match like the original data_retrieval.py
                industry_row = year_df[year_df[naics_col] == industry_name]
                if not industry_row.empty and value_col:
                    value = industry_row[value_col].values[0]
                    if pd.notna(value):
                        data_rows.append((vector_key, str(year_int), round(float(value), 1)))
        
        metadata_rows = [
            ('foreign_all_non_financial', 'Foreign control - Total non-financial industries', 'Percent', 'percent'),
            ('foreign_oil_gas', 'Foreign control - Oil and gas extraction', 'Percent', 'percent'),
            ('foreign_utilities', 'Foreign control - Utilities', 'Percent', 'percent'),
        ]
        
        return self.store_raw_data('foreign_control', data_rows, metadata_rows)
    
    def _process_environmental_protection(self) -> int:
        """
        Process environmental protection expenditures data.
        
        Returns:
            Number of data rows processed
        """
        print("  Fetching environmental protection data...")
        
        url = self._get_environmental_protection_url()
        response = requests.get(url, timeout=self.REQUEST_TIMEOUT)
        response.raise_for_status()
        
        df = pd.read_csv(io.StringIO(response.text))
        df = df[df['Expenditures'] == 'Total, expenditures'].copy()
        df['year'] = df['REF_DATE'].astype(int)
        
        industries = {
            'oil_gas': 'Oil and gas extraction [211]',
            'electric': 'Electric power generation, transmission and distribution [2211]',
            'natural_gas': 'Natural gas distribution [2212]',
            'petroleum': 'Petroleum and coal product manufacturing [324]',
            'all_industries': 'Total, industries'
        }
        
        main_activities = {
            'wastewater': 'Wastewater management',
            'soil': 'Protection and remediation of soil, groundwater and surface water',
            'air': 'Air pollution management',
            'solid_waste': 'Solid waste management',
            'total': 'Total, environmental protection activities'
        }
        
        # Define other environmental protection activities to sum into "other"
        other_activities = [
            'Protection of biodiversity and habitat',
            'Environmental charges',
            'Other environmental protection activities'
        ]
        
        data_rows = []
        
        for year in df['year'].unique():
            year_df = df[df['year'] == year]
            
            # Process oil and gas by main activity
            for act_key, act_name in main_activities.items():
                oil_gas_df = year_df[
                    (year_df['Industries'] == industries['oil_gas']) & 
                    (year_df['Environmental protection activities'] == act_name)
                ]
                if len(oil_gas_df) > 0:
                    value = oil_gas_df['VALUE'].values[0]
                    if pd.notna(value):
                        data_rows.append((f'enviro_oil_gas_{act_key}', str(year), float(value)))
            
            # Calculate oil_gas_other as sum of other activities
            other_sum = 0
            for other_act in other_activities:
                oil_gas_other_df = year_df[
                    (year_df['Industries'] == industries['oil_gas']) & 
                    (year_df['Environmental protection activities'] == other_act)
                ]
                if len(oil_gas_other_df) > 0:
                    value = oil_gas_other_df['VALUE'].values[0]
                    if pd.notna(value):
                        other_sum += float(value)
            if other_sum > 0:
                data_rows.append(('enviro_oil_gas_other', str(year), other_sum))
            
            # Electric power total
            electric_df = year_df[
                (year_df['Industries'] == industries['electric']) & 
                (year_df['Environmental protection activities'] == main_activities['total'])
            ]
            if len(electric_df) > 0:
                value = electric_df['VALUE'].values[0]
                if pd.notna(value):
                    data_rows.append(('enviro_electric_total', str(year), float(value)))
            
            # Natural gas distribution total
            natural_gas_df = year_df[
                (year_df['Industries'] == industries['natural_gas']) & 
                (year_df['Environmental protection activities'] == main_activities['total'])
            ]
            if len(natural_gas_df) > 0:
                value = natural_gas_df['VALUE'].values[0]
                if pd.notna(value):
                    data_rows.append(('enviro_natural_gas_total', str(year), float(value)))
            
            # Petroleum and coal product manufacturing total
            petroleum_df = year_df[
                (year_df['Industries'] == industries['petroleum']) & 
                (year_df['Environmental protection activities'] == main_activities['total'])
            ]
            if len(petroleum_df) > 0:
                value = petroleum_df['VALUE'].values[0]
                if pd.notna(value):
                    data_rows.append(('enviro_petroleum_total', str(year), float(value)))
            
            # Petroleum pollution abatement (sum of air, wastewater, solid_waste, soil)
            pollution_categories = ['air', 'wastewater', 'solid_waste', 'soil']
            pollution_sum = 0
            for cat in pollution_categories:
                petroleum_cat_df = year_df[
                    (year_df['Industries'] == industries['petroleum']) & 
                    (year_df['Environmental protection activities'] == main_activities[cat])
                ]
                if len(petroleum_cat_df) > 0:
                    value = petroleum_cat_df['VALUE'].values[0]
                    if pd.notna(value):
                        pollution_sum += float(value)
            if pollution_sum > 0:
                data_rows.append(('enviro_petroleum_pollution', str(year), pollution_sum))
            
            # All industries total
            all_ind_df = year_df[
                (year_df['Industries'] == industries['all_industries']) & 
                (year_df['Environmental protection activities'] == main_activities['total'])
            ]
            if len(all_ind_df) > 0:
                value = all_ind_df['VALUE'].values[0]
                if pd.notna(value):
                    data_rows.append(('enviro_all_industries_total', str(year), float(value)))
        
        # Add pre-calculated billions for key totals (values are in millions)
        billions_fields = ['oil_gas_total', 'electric_total', 'natural_gas_total', 'petroleum_total', 'all_industries_total']
        for vector, ref_date, value in list(data_rows):
            field = vector.replace('enviro_', '')
            if field in billions_fields:
                data_rows.append((f'{vector}_billions', ref_date, round(float(value) / 1000, 2)))
        
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
            ('enviro_oil_gas_total_billions', 'Oil and gas - Total (billions)', 'Billions of dollars', 'billions'),
            ('enviro_electric_total_billions', 'Electric power - Total (billions)', 'Billions of dollars', 'billions'),
            ('enviro_all_industries_total_billions', 'All industries - Total (billions)', 'Billions of dollars', 'billions'),
        ]
        
        # Add pre-calculated billions for total fields
        billions_rows = []
        for vector, ref_date, value in data_rows:
            if vector.endswith('_total'):
                billions_rows.append((f'{vector}_billions', ref_date, round(float(value) / 1000, 2)))
        data_rows.extend(billions_rows)
        
        return self.store_raw_data('environmental_protection', data_rows, metadata_rows)
    
    def _get_nrcan_mpi_url(self) -> str:
        """Get URL for NRCan Major Projects Inventory."""
        return "https://natural-resources.canada.ca/science-data/data-analysis/natural-resources-major-projects-planned-under-construction-2024-2034"
    
    def _parse_table_cell(self, cell_text: str):
        """Parse a table cell to extract count and value in billions."""
        import re
        cell_text = cell_text.strip()
        count_match = re.search(r'^(\d+)', cell_text)
        value_match = re.search(r'\$?([\d.]+)([BM])\)?', cell_text)
        
        count = int(count_match.group(1)) if count_match else None
        value = None
        if value_match:
            value = float(value_match.group(1))
            if value_match.group(2) == 'M':
                value = value / 1000  # Convert millions to billions
        
        return count, value
    
    def _extract_years_from_table(self, table) -> list:
        """Extract years from table headers."""
        import re
        
        if table is None:
            return []
        
        years = []
        rows = table.find_all('tr')
        
        for row in rows[:3]:
            cells = row.find_all(['th', 'td'])
            for cell in cells:
                cell_text = cell.get_text().strip()
                year_matches = re.findall(r'\b(20\d{2})\b', cell_text)
                for year_str in year_matches:
                    year = int(year_str)
                    if 2015 <= year <= 2050 and year not in years:
                        years.append(year)
        
        if not years:
            table_text = table.get_text()
            year_matches = re.findall(r'\b(20\d{2})\b', table_text)
            seen = set()
            for year_str in year_matches:
                year = int(year_str)
                if 2015 <= year <= 2050 and year not in seen:
                    years.append(year)
                    seen.add(year)
                    if len(years) >= 10:
                        break
        
        years.sort()
        return years
    
    def _fetch_nrcan_mpi_tables(self):
        """Fetch and parse tables from NRCan Major Projects Inventory."""
        from bs4 import BeautifulSoup
        
        print("    Fetching NRCan Major Projects Inventory...")
        url = self._get_nrcan_mpi_url()
        
        try:
            response = requests.get(url, timeout=60)
            response.raise_for_status()
            soup = BeautifulSoup(response.content, 'html.parser')
            
            tables = soup.find_all('table')
            print(f"    Found {len(tables)} tables in NRCan MPI")
            
            energy_table = None
            cleantech_table = None
            
            for table in tables:
                header_text = ""
                thead = table.find('thead')
                if thead:
                    header_text = thead.get_text()
                first_row = table.find('tr')
                if first_row:
                    header_text += first_row.get_text()
                
                if 'Total Energy Projects' in table.get_text() or 'Oil and Gas' in table.get_text():
                    if energy_table is None:
                        energy_table = table
                        print("    Found Energy Projects table (Table 1)")
                
                if 'Total Clean Technology' in table.get_text() or 'Hydro' in table.get_text():
                    if 'Carbon Capture' in table.get_text() and cleantech_table is None:
                        cleantech_table = table
                        print("    Found Clean Technology table (Table 4)")
            
            return energy_table, cleantech_table, soup
            
        except Exception as e:
            print(f"    ERROR fetching NRCan MPI: {e}")
            return None, None, None
    
    def _parse_energy_table(self, table) -> dict:
        """Parse the energy projects table."""
        if table is None:
            return None
        
        years = self._extract_years_from_table(table)
        if not years:
            print("    WARNING: Could not extract years from energy table")
            return None
        
        print(f"    Detected years in energy table: {years}")
        
        rows = table.find_all('tr')
        data = {}
        
        # Find header row with years
        header_row_idx = -1
        for idx, row in enumerate(rows):
            row_text = row.get_text()
            year_count = sum(1 for y in years if str(y) in row_text)
            if year_count >= len(years) - 1:
                header_row_idx = idx
                break
        
        # Map column positions to years
        year_positions = []
        if header_row_idx >= 0:
            header_cells = rows[header_row_idx].find_all(['th', 'td'])
            for i, cell in enumerate(header_cells):
                cell_text = cell.get_text().strip()
                for year in years:
                    if str(year) in cell_text and year not in [yp[1] for yp in year_positions]:
                        year_positions.append((i, year))
                        break
        
        if not year_positions:
            year_positions = [(i + 1, year) for i, year in enumerate(years)]
        
        # Parse data rows
        for row in rows:
            cells = row.find_all(['th', 'td'])
            if len(cells) >= 2:
                row_label = cells[0].get_text().strip().lower()
                
                category = None
                if 'total energy' in row_label:
                    category = 'total'
                elif 'oil and gas' in row_label:
                    category = 'oil_gas'
                elif 'electricity' in row_label:
                    category = 'electricity'
                elif 'other' in row_label:
                    category = 'other'
                
                if category:
                    for col_idx, year in year_positions:
                        if col_idx < len(cells):
                            count, value = self._parse_table_cell(cells[col_idx].get_text())
                            if year not in data:
                                data[year] = {}
                            if count is not None:
                                data[year][f'{category}_projects'] = count
                            if value is not None:
                                data[year][f'{category}_value'] = value
        
        return data
    
    def _parse_cleantech_table(self, table) -> dict:
        """Parse the clean technology table."""
        if table is None:
            return None
        
        years = self._extract_years_from_table(table)
        if not years:
            print("    WARNING: Could not extract years from clean tech table")
            return None
        
        print(f"    Detected years in clean tech table: {years}")
        
        rows = table.find_all('tr')
        data = {}
        
        category_map = {
            'total clean technology': 'total',
            'hydro': 'hydro',
            'bioenergy': 'biomass',
            'biomass': 'biomass',
            'solar': 'solar',
            'wind': 'wind',
            'carbon capture': 'ccs',
            'tidal': 'tidal',
            'geothermal': 'geothermal',
            'nuclear': 'nuclear',
            'energy storage': 'storage',
            'multiple': 'multiple',
            'other': 'other',
        }
        
        # Find header row with years
        header_row_idx = -1
        for idx, row in enumerate(rows):
            row_text = row.get_text()
            year_count = sum(1 for y in years if str(y) in row_text)
            if year_count >= len(years) - 1:
                header_row_idx = idx
                break
        
        # Map column positions to years
        year_positions = []
        if header_row_idx >= 0:
            header_cells = rows[header_row_idx].find_all(['th', 'td'])
            for i, cell in enumerate(header_cells):
                cell_text = cell.get_text().strip()
                for year in years:
                    if str(year) in cell_text and year not in [yp[1] for yp in year_positions]:
                        year_positions.append((i, year))
                        break
        
        if not year_positions:
            year_positions = [(i + 1, year) for i, year in enumerate(years)]
        
        # Parse data rows
        for row in rows:
            cells = row.find_all(['th', 'td'])
            if len(cells) >= 2:
                row_label = cells[0].get_text().strip().lower()
                
                category = None
                for key, cat in category_map.items():
                    if key in row_label:
                        category = cat
                        break
                
                if category:
                    for col_idx, year in year_positions:
                        if col_idx < len(cells):
                            count, value = self._parse_table_cell(cells[col_idx].get_text())
                            if year not in data:
                                data[year] = {}
                            if count is not None:
                                data[year][f'{category}_projects'] = count
                            if value is not None:
                                data[year][f'{category}_value'] = value
        
        return data
    
    def _extract_energy_data_from_text(self, soup) -> dict:
        """Fallback extraction if table parsing fails."""
        import re
        
        if soup is None:
            return {}
        
        text = soup.get_text()
        data = {}
        
        # Extract years
        year_matches = re.findall(r'\b(20\d{2})\b', text)
        years = []
        seen = set()
        for year_str in year_matches:
            year = int(year_str)
            if 2015 <= year <= 2050 and year not in seen:
                years.append(year)
                seen.add(year)
                if len(years) >= 10:
                    break
        years.sort()
        
        if not years:
            print("    WARNING: Could not detect years in fallback extraction")
            return {}
        
        print(f"    Fallback extraction detected years: {years}")
        
        cell_pattern = r'(\d+)\s*\(\$?([\d.]+)B\)'
        
        categories = {
            'total': r'Total Energy Projects[^\n]*',
            'oil_gas': r'Oil and Gas[^\n]*',
            'electricity': r'Electricity Generation[^\n]*',
            'other': r'Other[^\n]*\$[\d.]+B',
        }
        
        for category, pattern in categories.items():
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                line = match.group(0)
                cells = re.findall(cell_pattern, line)
                for i, (count, value) in enumerate(cells):
                    if i < len(years):
                        year = years[i]
                        if year not in data:
                            data[year] = {}
                        data[year][f'{category}_projects'] = int(count)
                        data[year][f'{category}_value'] = float(value)
        
        return data
    
    def _extract_cleantech_data_from_text(self, soup) -> dict:
        """Fallback extraction for clean tech data."""
        import re
        
        if soup is None:
            return {}
        
        text = soup.get_text()
        data = {}
        
        # Extract years
        year_matches = re.findall(r'\b(20\d{2})\b', text)
        years = []
        seen = set()
        for year_str in year_matches:
            year = int(year_str)
            if 2015 <= year <= 2050 and year not in seen:
                years.append(year)
                seen.add(year)
                if len(years) >= 10:
                    break
        years.sort()
        
        if not years:
            print("    WARNING: Could not detect years in cleantech fallback extraction")
            return {}
        
        print(f"    Cleantech fallback extraction detected years: {years}")
        
        cell_pattern = r'(\d+)\s*\(\$?([\d.]+)B\)'
        
        categories = {
            'total': r'Total Clean Technology[^\n]*',
            'hydro': r'\bHydro[^\n]*\$[\d.]+B',
            'wind': r'\bWind[^\n]*\$[\d.]+B',
            'solar': r'\bSolar[^\n]*\$[\d.]+B',
            'nuclear': r'\bNuclear[^\n]*\$[\d.]+B',
            'ccs': r'Carbon Capture[^\n]*\$[\d.]+B',
            'biomass': r'\bBioenergy[^\n]*\$[\d.]+B',
            'tidal': r'\bTidal[^\n]*\$[\d.]+B',
            'geothermal': r'\bGeothermal[^\n]*\$[\d.]+B',
            'storage': r'Energy Storage[^\n]*\$[\d.]+B',
            'multiple': r'\bMultiple[^\n]*\$[\d.]+B',
            'other': r'\bOther1?[^\n]*\$[\d.]+B',
        }
        
        for category, pattern in categories.items():
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                line = match.group(0)
                cells = re.findall(cell_pattern, line)
                for i, (count, value) in enumerate(cells):
                    if i < len(years):
                        year = years[i]
                        if year not in data:
                            data[year] = {}
                        data[year][f'{category}_projects'] = int(count)
                        data[year][f'{category}_value'] = float(value)
        
        return data
    
    def _process_major_projects(self) -> int:
        """
        Process major projects data from NRCan Major Projects Inventory.
        
        Scrapes Table 1 (Energy Projects by category) from the NRCan MPI.
        
        Returns:
            Number of data rows processed
        """
        print("  Processing major projects data...")
        print(f"    Source: NRCan Major Projects Inventory (Table 1)")
        print(f"    URL: {self._get_nrcan_mpi_url()}")
        
        energy_table, cleantech_table, soup = self._fetch_nrcan_mpi_tables()
        
        major_projects_data = self._parse_energy_table(energy_table)
        
        if not major_projects_data or len(major_projects_data) == 0:
            print("    WARNING: Could not parse energy table, using fallback extraction...")
            major_projects_data = self._extract_energy_data_from_text(soup)
        
        if not major_projects_data or len(major_projects_data) == 0:
            print("    ERROR: Could not retrieve energy projects data")
            return 0
        
        print(f"    Parsed energy data for years: {sorted(major_projects_data.keys())}")
        for year, values in sorted(major_projects_data.items()):
            print(f"      {year}: {values}")
        
        data_rows = []
        
        for year, values in major_projects_data.items():
            if 'oil_gas_value' in values:
                data_rows.append(('projects_oil_gas_value', str(year), values['oil_gas_value']))
            if 'oil_gas_projects' in values:
                data_rows.append(('projects_oil_gas_count', str(year), values['oil_gas_projects']))
            if 'electricity_value' in values:
                data_rows.append(('projects_electricity_value', str(year), values['electricity_value']))
            if 'electricity_projects' in values:
                data_rows.append(('projects_electricity_count', str(year), values['electricity_projects']))
            if 'other_value' in values:
                data_rows.append(('projects_other_value', str(year), values['other_value']))
            if 'other_projects' in values:
                data_rows.append(('projects_other_count', str(year), values['other_projects']))
            
            if 'total_value' in values:
                data_rows.append(('projects_total_value', str(year), values['total_value']))
            elif all(k in values for k in ['oil_gas_value', 'electricity_value', 'other_value']):
                total_value = values['oil_gas_value'] + values['electricity_value'] + values['other_value']
                data_rows.append(('projects_total_value', str(year), round(total_value, 1)))
            
            if 'total_projects' in values:
                data_rows.append(('projects_total_count', str(year), values['total_projects']))
            elif all(k in values for k in ['oil_gas_projects', 'electricity_projects', 'other_projects']):
                total_projects = values['oil_gas_projects'] + values['electricity_projects'] + values['other_projects']
                data_rows.append(('projects_total_count', str(year), total_projects))
        
        metadata_rows = [
            ('projects_oil_gas_value', 'Oil and gas - Project value', 'Billions of dollars', 'billions'),
            ('projects_oil_gas_count', 'Oil and gas - Number of projects', 'Number', 'units'),
            ('projects_electricity_value', 'Electricity - Project value', 'Billions of dollars', 'billions'),
            ('projects_electricity_count', 'Electricity - Number of projects', 'Number', 'units'),
            ('projects_other_value', 'Other - Project value', 'Billions of dollars', 'billions'),
            ('projects_other_count', 'Other - Number of projects', 'Number', 'units'),
            ('projects_total_value', 'Total - Project value', 'Billions of dollars', 'billions'),
            ('projects_total_count', 'Total - Number of projects', 'Number', 'units'),
        ]
        
        print(f"    Major Projects: {len(data_rows)} data rows")
        return self.store_raw_data('major_projects', data_rows, metadata_rows)
    
    def _process_clean_tech(self) -> int:
        """
        Process clean technology data from NRCan Major Projects Inventory.
        
        Scrapes Table 4 (Clean Technology breakdown) from the NRCan MPI.
        
        Returns:
            Number of data rows processed
        """
        print("  Processing clean tech data...")
        print(f"    Source: NRCan Major Projects Inventory (Table 4)")
        print(f"    URL: {self._get_nrcan_mpi_url()}")
        
        energy_table, cleantech_table, soup = self._fetch_nrcan_mpi_tables()
        
        clean_tech_data = self._parse_cleantech_table(cleantech_table)
        
        if not clean_tech_data or len(clean_tech_data) == 0:
            print("    WARNING: Could not parse clean tech table, using fallback extraction...")
            clean_tech_data = self._extract_cleantech_data_from_text(soup)
        
        if not clean_tech_data or len(clean_tech_data) == 0:
            print("    ERROR: Could not retrieve clean tech data")
            return 0
        
        print(f"    Parsed clean tech data for years: {sorted(clean_tech_data.keys())}")
        for year, values in sorted(clean_tech_data.items()):
            print(f"      {year}: {values}")
        
        data_rows = []
        categories = ['total', 'hydro', 'wind', 'biomass', 'solar', 'nuclear', 'ccs', 
                      'geothermal', 'tidal', 'storage', 'multiple', 'other']
        
        for year, values in clean_tech_data.items():
            for cat in categories:
                if f'{cat}_projects' in values:
                    data_rows.append((f'cleantech_{cat}_count', str(year), values[f'{cat}_projects']))
                if f'{cat}_value' in values:
                    data_rows.append((f'cleantech_{cat}_value', str(year), values[f'{cat}_value']))
        
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
            ('cleantech_storage_count', 'Energy Storage - Number of projects', 'Number', 'units'),
            ('cleantech_storage_value', 'Energy Storage - Project value', 'Billions of dollars', 'billions'),
            ('cleantech_multiple_count', 'Multiple - Number of projects', 'Number', 'units'),
            ('cleantech_multiple_value', 'Multiple - Project value', 'Billions of dollars', 'billions'),
            ('cleantech_other_count', 'Other - Number of projects', 'Number', 'units'),
            ('cleantech_other_value', 'Other - Project value', 'Billions of dollars', 'billions'),
        ]
        
        print(f"    Clean Tech Trends: {len(data_rows)} data rows")
        return self.store_raw_data('clean_tech', data_rows, metadata_rows)
    
    def _process_major_projects_map(self) -> int:
        """
        Process major projects map data from NRCan ArcGIS Feature Server.
        
        Fetches both English and French versions:
        - Point features (projects): energy projects with lat/lon coordinates
        - Line features (transmission lines/pipelines): with polyline geometries
        
        Returns:
            Number of rows fetched (combined EN + FR)
        """
        import json
        from pathlib import Path
        
        print("  Fetching Major Projects Map data from NRCan ArcGIS...")
        
        base_url_en = "https://maps-cartes.services.geo.ca/server_serveur/rest/services/NRCan/major_projects_inventory_en/MapServer"
        base_url_fr = "https://maps-cartes.services.geo.ca/server_serveur/rest/services/NRCan/major_projects_inventory_fr/MapServer"
        
        def fetch_data(base_url, lang, sector_filter):
            """Fetch point and line data for a specific language."""
            point_url = f"{base_url}/0/query"
            line_url = f"{base_url}/1/query"
            
            # Parameters matching data_retrieval.py exactly
            params = {
                "where": f"sector='{sector_filter}'",
                "outFields": "*",
                "f": "json",
                "returnGeometry": "true",
                "outSR": "4326",
                "resultRecordCount": "2000"
            }
            
            # Alternative params for fallback (no server-side filter)
            params_fallback = {
                "where": "1=1",
                "outFields": "*",
                "f": "json",
                "returnGeometry": "true",
                "outSR": "4326"
            }
            
            points = []
            lines = []
            
            # Try with server-side filter first, then fallback to client-side
            try:
                print(f"    Fetching {lang} point features...")
                response = requests.get(point_url, params=params, timeout=60)
                response.raise_for_status()
                point_data = response.json()
                
                if "features" in point_data and len(point_data["features"]) > 0:
                    for feature in point_data["features"]:
                        attrs = feature.get("attributes", {})
                        geom = feature.get("geometry", {})
                        
                        project = {
                            "id": attrs.get("id"),
                            "company": attrs.get("company"),
                            "project_name": attrs.get("project_name"),
                            "province": attrs.get("province"),
                            "location": attrs.get("location"),
                            "capital_cost": attrs.get("capital_cost"),
                            "capital_cost_range": attrs.get("capital_cost_range"),
                            "status": attrs.get("status"),
                            "clean_technology": attrs.get("clean_technology"),
                            "clean_technology_type": attrs.get("clean_technology_type"),
                            "lat": geom.get("y"),
                            "lon": geom.get("x"),
                            "type": "point"
                        }
                        points.append(project)
                    print(f"      Found {len(points)} {lang} point features")
                elif "error" in point_data:
                    # Try fallback with client-side filtering
                    print(f"      Server filter failed, trying fallback...")
                    response = requests.get(point_url, params=params_fallback, timeout=60)
                    response.raise_for_status()
                    point_data = response.json()
                    
                    if "features" in point_data:
                        for feature in point_data["features"]:
                            attrs = feature.get("attributes", {})
                            geom = feature.get("geometry", {})
                            
                            # Filter by sector client-side
                            if attrs.get("sector") != sector_filter:
                                continue
                            
                            project = {
                                "id": attrs.get("id"),
                                "company": attrs.get("company"),
                                "project_name": attrs.get("project_name"),
                                "province": attrs.get("province"),
                                "location": attrs.get("location"),
                                "capital_cost": attrs.get("capital_cost"),
                                "capital_cost_range": attrs.get("capital_cost_range"),
                                "status": attrs.get("status"),
                                "clean_technology": attrs.get("clean_technology"),
                                "clean_technology_type": attrs.get("clean_technology_type"),
                                "lat": geom.get("y"),
                                "lon": geom.get("x"),
                                "type": "point"
                            }
                            points.append(project)
                        print(f"      Found {len(points)} {lang} point features (fallback)")
                else:
                    print(f"      Warning: No {lang} point features found")
            
            except Exception as e:
                print(f"      Error fetching {lang} point features: {e}")
            
            # Fetch line features
            try:
                print(f"    Fetching {lang} line features...")
                response = requests.get(line_url, params=params, timeout=60)
                response.raise_for_status()
                line_data = response.json()
                
                if "features" in line_data and len(line_data["features"]) > 0:
                    for feature in line_data["features"]:
                        attrs = feature.get("attributes", {})
                        geom = feature.get("geometry", {})
                        
                        paths = geom.get("paths", [])
                        coordinates = []
                        for path in paths:
                            path_coords = []
                            for coord in path:
                                if len(coord) >= 2:
                                    path_coords.append({"lon": coord[0], "lat": coord[1]})
                            if path_coords:
                                coordinates.append(path_coords)
                        
                        line_project = {
                            "id": attrs.get("id"),
                            "company": attrs.get("company"),
                            "project_name": attrs.get("project_name"),
                            "province": attrs.get("province"),
                            "location": attrs.get("location"),
                            "capital_cost": attrs.get("capital_cost"),
                            "capital_cost_range": attrs.get("capital_cost_range"),
                            "status": attrs.get("status"),
                            "clean_technology": attrs.get("clean_technology"),
                            "clean_technology_type": attrs.get("clean_technology_type"),
                            "line_type": attrs.get("type"),
                            "paths": coordinates,
                            "type": "line"
                        }
                        lines.append(line_project)
                    print(f"      Found {len(lines)} {lang} line features")
                elif "error" in line_data:
                    # Try fallback with client-side filtering
                    print(f"      Server filter failed for lines, trying fallback...")
                    response = requests.get(line_url, params=params_fallback, timeout=60)
                    response.raise_for_status()
                    line_data = response.json()
                    
                    if "features" in line_data:
                        for feature in line_data["features"]:
                            attrs = feature.get("attributes", {})
                            geom = feature.get("geometry", {})
                            
                            # Filter by sector client-side (use flexible match for encoding issues)
                            sector = attrs.get("sector", "")
                            # Match "Energy" or "Énergie" (handles encoding issues)
                            if "nerg" not in sector.lower():
                                continue
                            
                            paths = geom.get("paths", [])
                            coordinates = []
                            for path in paths:
                                path_coords = []
                                for coord in path:
                                    if len(coord) >= 2:
                                        path_coords.append({"lon": coord[0], "lat": coord[1]})
                                if path_coords:
                                    coordinates.append(path_coords)
                            
                            line_project = {
                                "id": attrs.get("id"),
                                "company": attrs.get("company"),
                                "project_name": attrs.get("project_name"),
                                "province": attrs.get("province"),
                                "location": attrs.get("location"),
                                "capital_cost": attrs.get("capital_cost"),
                                "capital_cost_range": attrs.get("capital_cost_range"),
                                "status": attrs.get("status"),
                                "clean_technology": attrs.get("clean_technology"),
                                "clean_technology_type": attrs.get("clean_technology_type"),
                                "line_type": attrs.get("type"),
                                "paths": coordinates,
                                "type": "line"
                            }
                            lines.append(line_project)
                        print(f"      Found {len(lines)} {lang} line features (fallback)")
                else:
                    print(f"      Warning: No {lang} line features found")
            
            except Exception as e:
                print(f"      Error fetching {lang} line features: {e}")
            
            return points, lines
        
        en_points, en_lines = fetch_data(base_url_en, "English", "Energy")
        fr_points, fr_lines = fetch_data(base_url_fr, "French", "Énergie")
        
        # Build CSV rows
        csv_rows = []
        for lang_code, points, lines in [('en', en_points, en_lines), ('fr', fr_points, fr_lines)]:
            for point in points:
                row = {
                    'lang': lang_code,
                    'id': point.get('id', ''),
                    'company': point.get('company', ''),
                    'project_name': point.get('project_name', ''),
                    'province': point.get('province', ''),
                    'location': point.get('location', ''),
                    'capital_cost': point.get('capital_cost', ''),
                    'capital_cost_range': point.get('capital_cost_range', ''),
                    'status': point.get('status', ''),
                    'clean_technology': point.get('clean_technology', ''),
                    'clean_technology_type': point.get('clean_technology_type', ''),
                    'line_type': '',
                    'lat': point.get('lat', ''),
                    'lon': point.get('lon', ''),
                    'paths': '',
                    'type': 'point'
                }
                csv_rows.append(row)
            
            for line in lines:
                row = {
                    'lang': lang_code,
                    'id': line.get('id', ''),
                    'company': line.get('company', ''),
                    'project_name': line.get('project_name', ''),
                    'province': line.get('province', ''),
                    'location': line.get('location', ''),
                    'capital_cost': line.get('capital_cost', ''),
                    'capital_cost_range': line.get('capital_cost_range', ''),
                    'status': line.get('status', ''),
                    'clean_technology': line.get('clean_technology', ''),
                    'clean_technology_type': line.get('clean_technology_type', ''),
                    'line_type': line.get('line_type', ''),
                    'lat': '',
                    'lon': '',
                    'paths': json.dumps(line.get('paths', [])),
                    'type': 'line'
                }
                csv_rows.append(row)
        
        # Store in database for export
        if csv_rows:
            self.repo.insert_major_projects_map(csv_rows)
            print(f"    Major Projects Map: stored EN({len(en_points)} points, {len(en_lines)} lines) FR({len(fr_points)} points, {len(fr_lines)} lines)")
            print(f"    Major Projects Map: {len(csv_rows)} rows saved to database")
        
        return len(csv_rows)
