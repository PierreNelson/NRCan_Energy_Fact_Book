"""
Data models and repository for database operations.

Provides high-level methods for storing and retrieving data from SQL Server.
"""

from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime
import numpy as np
import pandas as pd
from .connection import DatabaseConnection


def to_python_type(value):
    """
    Convert numpy types to Python native types for database compatibility.
    
    Args:
        value: Value that might be a numpy type
        
    Returns:
        Python native type
    """
    if pd.isna(value):
        return None
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (np.floating,)):
        return float(value)
    if isinstance(value, np.ndarray):
        return value.tolist()
    return value


class DataRepository:
    """
    Repository for all database operations.
    
    Provides methods for:
    - Storing raw StatCan data
    - Storing calculated/aggregated data
    - Retrieving data for export
    - Managing run history
    """
    
    def __init__(self, db: DatabaseConnection):
        """
        Initialize the data repository.
        
        Args:
            db: DatabaseConnection instance
        """
        self.db = db
    
    # =========================================================================
    # RUN HISTORY / AUDIT LOGGING
    # =========================================================================
    
    def log_run_start(self, source_key: str, run_type: str) -> int:
        """
        Log the start of a data refresh run.
        
        Args:
            source_key: Identifier for the data source
            run_type: Type of run ('fetch', 'process', 'export')
            
        Returns:
            run_id for tracking completion
        """
        query = """
            INSERT INTO run_history (source_key, run_type, status)
            OUTPUT INSERTED.run_id
            VALUES (?, ?, 'started')
        """
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query, (source_key, run_type))
            row = cursor.fetchone()
            conn.commit()
            return row[0]
    
    def log_run_complete(self, run_id: int, status: str, 
                         rows_affected: int = None, error_message: str = None):
        """
        Log the completion of a data refresh run.
        
        Args:
            run_id: ID from log_run_start
            status: 'success' or 'failed'
            rows_affected: Number of rows processed
            error_message: Error details if failed
        """
        query = """
            UPDATE run_history
            SET status = ?, rows_affected = ?, error_message = ?, 
                completed_at = GETUTCDATE()
            WHERE run_id = ?
        """
        self.db.execute_non_query(query, (status, rows_affected, error_message, run_id))
    
    def update_source_last_refresh(self, source_key: str):
        """Update the last refresh timestamp for a data source."""
        query = """
            UPDATE data_sources
            SET last_refresh_at = GETUTCDATE(), updated_at = GETUTCDATE()
            WHERE source_key = ?
        """
        self.db.execute_non_query(query, (source_key,))
    
    # =========================================================================
    # RAW DATA OPERATIONS
    # =========================================================================
    
    def clear_raw_data(self, source_key: str):
        """
        Clear raw data for a specific source before refresh.
        
        Args:
            source_key: Identifier for the data source
        """
        self.db.execute_non_query(
            "DELETE FROM raw_statcan_data WHERE source_key = ?", 
            (source_key,)
        )
        self.db.execute_non_query(
            "DELETE FROM raw_statcan_metadata WHERE source_key = ?",
            (source_key,)
        )
    
    def insert_raw_statcan_data(self, source_key: str, 
                                 data: List[Tuple[str, str, float]]):
        """
        Insert raw StatCan data points.
        
        Args:
            source_key: Identifier for the data source
            data: List of (vector, ref_date, value) tuples
        """
        if not data:
            return 0
        
        # Use MERGE to handle duplicates (update existing, insert new)
        query = """
            MERGE INTO raw_statcan_data AS target
            USING (VALUES (?, ?, ?, ?)) AS source (vector, ref_date, value, source_key)
            ON target.vector = source.vector AND target.ref_date = source.ref_date
            WHEN MATCHED THEN
                UPDATE SET value = source.value, 
                           source_key = source.source_key,
                           fetched_at = GETUTCDATE()
            WHEN NOT MATCHED THEN
                INSERT (vector, ref_date, value, source_key)
                VALUES (source.vector, source.ref_date, source.value, source.source_key);
        """
        
        # Convert numpy types to Python native types
        params_list = [
            (str(row[0]), str(row[1]), to_python_type(row[2]), source_key) 
            for row in data
        ]
        
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            for params in params_list:
                cursor.execute(query, params)
            conn.commit()
            return len(params_list)
    
    def insert_raw_statcan_metadata(self, source_key: str,
                                     metadata: List[Tuple[str, str, str, str]]):
        """
        Insert raw StatCan metadata.
        
        Args:
            source_key: Identifier for the data source
            metadata: List of (vector, title, uom, scalar_factor) tuples
        """
        if not metadata:
            return 0
        
        query = """
            MERGE INTO raw_statcan_metadata AS target
            USING (VALUES (?, ?, ?, ?, ?)) AS source (vector, title, uom, scalar_factor, source_key)
            ON target.vector = source.vector
            WHEN MATCHED THEN
                UPDATE SET title = source.title,
                           uom = source.uom,
                           scalar_factor = source.scalar_factor,
                           source_key = source.source_key,
                           fetched_at = GETUTCDATE()
            WHEN NOT MATCHED THEN
                INSERT (vector, title, uom, scalar_factor, source_key)
                VALUES (source.vector, source.title, source.uom, source.scalar_factor, source.source_key);
        """
        
        params_list = [(row[0], row[1], row[2], row[3], source_key) for row in metadata]
        
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            for params in params_list:
                cursor.execute(query, params)
            conn.commit()
            return len(params_list)
    
    def insert_raw_major_projects(self, projects: List[Dict[str, Any]]):
        """
        Insert major projects data.
        
        Args:
            projects: List of project dictionaries
        """
        if not projects:
            return 0
        
        # Clear existing and insert fresh
        self.db.execute_non_query("DELETE FROM raw_major_projects")
        
        query = """
            INSERT INTO raw_major_projects 
            (project_name, company, location, province, project_type, sub_type,
             estimated_cost, status, latitude, longitude, source_url)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """
        
        params_list = [
            (
                p.get('project_name'),
                p.get('company'),
                p.get('location'),
                p.get('province'),
                p.get('project_type'),
                p.get('sub_type'),
                p.get('estimated_cost'),
                p.get('status'),
                p.get('latitude'),
                p.get('longitude'),
                p.get('source_url')
            )
            for p in projects
        ]
        
        return self.db.execute_many(query, params_list)
    
    def insert_major_projects_map(self, rows: List[Dict[str, Any]]):
        """
        Insert major projects map data for CSV export.
        
        Args:
            rows: List of row dictionaries with map feature data
        """
        if not rows:
            return 0
        
        # Clear existing and insert fresh
        self.db.execute_non_query("DELETE FROM raw_major_projects_map")
        
        query = """
            INSERT INTO raw_major_projects_map 
            (lang, feature_id, company, project_name, province, location, 
             capital_cost, capital_cost_range, status, clean_technology, 
             clean_technology_type, line_type, lat, lon, paths, feature_type)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """
        
        params_list = [
            (
                str(r.get('lang', '')),
                str(r.get('id', '')),
                str(r.get('company', '')),
                str(r.get('project_name', '')),
                str(r.get('province', '')),
                str(r.get('location', '')),
                str(r.get('capital_cost', '')),
                str(r.get('capital_cost_range', '')),
                str(r.get('status', '')),
                str(r.get('clean_technology', '')),
                str(r.get('clean_technology_type', '')),
                str(r.get('line_type', '')),
                str(r.get('lat', '')),
                str(r.get('lon', '')),
                str(r.get('paths', '')),
                str(r.get('type', ''))
            )
            for r in rows
        ]
        
        return self.db.execute_many(query, params_list)
    
    def get_major_projects_map_for_export(self) -> List[Dict[str, Any]]:
        """
        Get major projects map data for CSV export.
        
        Returns:
            List of row dictionaries
        """
        return self.db.execute_query("""
            SELECT lang, feature_id as id, company, project_name, province, location,
                   capital_cost, capital_cost_range, status, clean_technology,
                   clean_technology_type, line_type, lat, lon, paths, feature_type as type
            FROM raw_major_projects_map
            ORDER BY lang, feature_type, province, project_name
        """)
    
    # =========================================================================
    # CALCULATED DATA OPERATIONS
    # =========================================================================
    
    def upsert_capital_expenditures(self, data: List[Dict[str, Any]]):
        """
        Insert or update capital expenditures calculated data.
        
        Args:
            data: List of dicts with year, oil_gas, electricity, other_energy, total
        """
        if not data:
            return 0
        
        query = """
            MERGE INTO calc_capital_expenditures AS target
            USING (VALUES (?, ?, ?, ?, ?)) AS source 
                  (ref_year, oil_gas, electricity, other_energy, total)
            ON target.ref_year = source.ref_year
            WHEN MATCHED THEN
                UPDATE SET oil_gas = source.oil_gas,
                           electricity = source.electricity,
                           other_energy = source.other_energy,
                           total = source.total,
                           calculated_at = GETUTCDATE()
            WHEN NOT MATCHED THEN
                INSERT (ref_year, oil_gas, electricity, other_energy, total)
                VALUES (source.ref_year, source.oil_gas, source.electricity, 
                        source.other_energy, source.total);
        """
        
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            for row in data:
                cursor.execute(query, (
                    row['year'], row.get('oil_gas'), row.get('electricity'),
                    row.get('other_energy'), row.get('total')
                ))
            conn.commit()
            return len(data)
    
    def upsert_infrastructure(self, data: List[Dict[str, Any]]):
        """
        Insert or update infrastructure calculated data.
        
        Args:
            data: List of dicts with year and category values
        """
        if not data:
            return 0
        
        query = """
            MERGE INTO calc_infrastructure AS target
            USING (VALUES (?, ?, ?, ?, ?, ?, ?, ?)) AS source 
                  (ref_year, fuel_energy_pipelines, transport, education, 
                   health_housing, environmental, public_safety, total)
            ON target.ref_year = source.ref_year
            WHEN MATCHED THEN
                UPDATE SET fuel_energy_pipelines = source.fuel_energy_pipelines,
                           transport = source.transport,
                           education = source.education,
                           health_housing = source.health_housing,
                           environmental = source.environmental,
                           public_safety = source.public_safety,
                           total = source.total,
                           calculated_at = GETUTCDATE()
            WHEN NOT MATCHED THEN
                INSERT (ref_year, fuel_energy_pipelines, transport, education,
                        health_housing, environmental, public_safety, total)
                VALUES (source.ref_year, source.fuel_energy_pipelines, source.transport,
                        source.education, source.health_housing, source.environmental,
                        source.public_safety, source.total);
        """
        
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            for row in data:
                cursor.execute(query, (
                    row['year'], 
                    row.get('fuel_energy_pipelines'),
                    row.get('transport'),
                    row.get('education'),
                    row.get('health_housing'),
                    row.get('environmental'),
                    row.get('public_safety'),
                    row.get('total')
                ))
            conn.commit()
            return len(data)
    
    def upsert_economic_contributions(self, data: List[Dict[str, Any]]):
        """
        Insert or update economic contributions calculated data.
        """
        if not data:
            return 0
        
        query = """
            MERGE INTO calc_economic_contributions AS target
            USING (VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)) AS source 
                  (ref_year, gdp_direct, gdp_indirect, gdp_total,
                   jobs_direct, jobs_indirect, jobs_total,
                   income_direct, income_indirect, income_total)
            ON target.ref_year = source.ref_year
            WHEN MATCHED THEN
                UPDATE SET gdp_direct = source.gdp_direct,
                           gdp_indirect = source.gdp_indirect,
                           gdp_total = source.gdp_total,
                           jobs_direct = source.jobs_direct,
                           jobs_indirect = source.jobs_indirect,
                           jobs_total = source.jobs_total,
                           income_direct = source.income_direct,
                           income_indirect = source.income_indirect,
                           income_total = source.income_total,
                           calculated_at = GETUTCDATE()
            WHEN NOT MATCHED THEN
                INSERT (ref_year, gdp_direct, gdp_indirect, gdp_total,
                        jobs_direct, jobs_indirect, jobs_total,
                        income_direct, income_indirect, income_total)
                VALUES (source.ref_year, source.gdp_direct, source.gdp_indirect,
                        source.gdp_total, source.jobs_direct, source.jobs_indirect,
                        source.jobs_total, source.income_direct, source.income_indirect,
                        source.income_total);
        """
        
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            for row in data:
                cursor.execute(query, (
                    row['year'],
                    row.get('gdp_direct'), row.get('gdp_indirect'), row.get('gdp_total'),
                    row.get('jobs_direct'), row.get('jobs_indirect'), row.get('jobs_total'),
                    row.get('income_direct'), row.get('income_indirect'), row.get('income_total')
                ))
            conn.commit()
            return len(data)
    
    def upsert_international_investment(self, data: List[Dict[str, Any]]):
        """
        Insert or update international investment calculated data.
        """
        if not data:
            return 0
        
        query = """
            MERGE INTO calc_international_investment AS target
            USING (VALUES (?, ?, ?, ?)) AS source 
                  (ref_year, investment_type, industry_category, value)
            ON target.ref_year = source.ref_year 
               AND target.investment_type = source.investment_type
               AND target.industry_category = source.industry_category
            WHEN MATCHED THEN
                UPDATE SET value = source.value, calculated_at = GETUTCDATE()
            WHEN NOT MATCHED THEN
                INSERT (ref_year, investment_type, industry_category, value)
                VALUES (source.ref_year, source.investment_type, source.industry_category, source.value);
        """
        
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            for row in data:
                cursor.execute(query, (
                    row['year'],
                    row.get('investment_type', 'total'),
                    row.get('industry_category', 'energy'),
                    row.get('value')
                ))
            conn.commit()
            return len(data)
    
    def upsert_environmental_protection(self, data: List[Dict[str, Any]]):
        """
        Insert or update environmental protection calculated data.
        """
        if not data:
            return 0
        
        query = """
            MERGE INTO calc_environmental_protection AS target
            USING (VALUES (?, ?, ?, ?, ?, ?, ?, ?)) AS source 
                  (ref_year, industry_category, wastewater, soil_groundwater, 
                   air_pollution, solid_waste, other, total)
            ON target.ref_year = source.ref_year 
               AND target.industry_category = source.industry_category
            WHEN MATCHED THEN
                UPDATE SET wastewater = source.wastewater,
                           soil_groundwater = source.soil_groundwater,
                           air_pollution = source.air_pollution,
                           solid_waste = source.solid_waste,
                           other = source.other,
                           total = source.total,
                           calculated_at = GETUTCDATE()
            WHEN NOT MATCHED THEN
                INSERT (ref_year, industry_category, wastewater, soil_groundwater,
                        air_pollution, solid_waste, other, total)
                VALUES (source.ref_year, source.industry_category, source.wastewater,
                        source.soil_groundwater, source.air_pollution, source.solid_waste,
                        source.other, source.total);
        """
        
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            for row in data:
                cursor.execute(query, (
                    row['year'],
                    row.get('industry_category', 'oil_gas'),
                    row.get('wastewater'),
                    row.get('soil_groundwater'),
                    row.get('air_pollution'),
                    row.get('solid_waste'),
                    row.get('other'),
                    row.get('total')
                ))
            conn.commit()
            return len(data)
    
    def upsert_provincial_gdp(self, data: List[Dict[str, Any]]):
        """
        Insert or update provincial GDP calculated data.
        """
        if not data:
            return 0
        
        query = """
            MERGE INTO calc_provincial_gdp AS target
            USING (VALUES (?, ?, ?, ?, ?, ?)) AS source 
                  (ref_year, province_code, province_name, energy_gdp, total_gdp, energy_share_pct)
            ON target.ref_year = source.ref_year 
               AND target.province_code = source.province_code
            WHEN MATCHED THEN
                UPDATE SET province_name = source.province_name,
                           energy_gdp = source.energy_gdp,
                           total_gdp = source.total_gdp,
                           energy_share_pct = source.energy_share_pct,
                           calculated_at = GETUTCDATE()
            WHEN NOT MATCHED THEN
                INSERT (ref_year, province_code, province_name, energy_gdp, total_gdp, energy_share_pct)
                VALUES (source.ref_year, source.province_code, source.province_name,
                        source.energy_gdp, source.total_gdp, source.energy_share_pct);
        """
        
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            for row in data:
                cursor.execute(query, (
                    row['year'],
                    row.get('province_code'),
                    row.get('province_name'),
                    row.get('energy_gdp'),
                    row.get('total_gdp'),
                    row.get('energy_share_pct')
                ))
            conn.commit()
            return len(data)
    
    def upsert_clean_tech(self, data: List[Dict[str, Any]]):
        """
        Insert or update clean tech calculated data.
        """
        if not data:
            return 0
        
        query = """
            MERGE INTO calc_clean_tech AS target
            USING (VALUES (?, ?, ?, ?)) AS source 
                  (ref_year, category, project_count, total_investment)
            ON target.ref_year = source.ref_year AND target.category = source.category
            WHEN MATCHED THEN
                UPDATE SET project_count = source.project_count,
                           total_investment = source.total_investment,
                           calculated_at = GETUTCDATE()
            WHEN NOT MATCHED THEN
                INSERT (ref_year, category, project_count, total_investment)
                VALUES (source.ref_year, source.category, source.project_count, source.total_investment);
        """
        
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            for row in data:
                cursor.execute(query, (
                    row['year'],
                    row.get('category'),
                    row.get('project_count'),
                    row.get('total_investment')
                ))
            conn.commit()
            return len(data)
    
    def upsert_foreign_control(self, data: List[Dict[str, Any]]):
        """
        Insert or update foreign control data.
        Stores in raw_statcan_data with semantic vector names for simplicity.
        """
        if not data:
            return 0
        
        # Foreign control doesn't have a dedicated calc table, 
        # store with semantic vectors in raw_statcan_data
        rows = []
        for row in data:
            year = str(row['year'])
            for key, value in row.items():
                if key != 'year' and value is not None:
                    vector = f"foreign_{key}"
                    rows.append((vector, year, to_python_type(value)))
        
        return self.insert_raw_statcan_data('foreign_control', rows)
    
    # =========================================================================
    # EXPORT DATA OPERATIONS
    # =========================================================================
    
    def prepare_export_data(self):
        """
        Prepare export tables by aggregating all raw and calculated data.
        
        Data flow:
        - raw_statcan_data contains BOTH original StatCan vectors AND calculated 
          semantic vectors (capex_*, infra_*, econ_*, etc.)
        - calc_* tables contain normalized calculated data (for querying)
        - Export pulls from raw_statcan_data since it already has semantic vectors
        
        All data is converted to the export format: (vector, ref_date, value)
        """
        # Clear export tables
        self.db.execute_non_query("DELETE FROM export_data")
        self.db.execute_non_query("DELETE FROM export_metadata")
        
        # Copy raw StatCan data to export (already has semantic vector names)
        # This includes both original vectors (v123...) and calculated semantic vectors (capex_*, infra_*, etc.)
        # Note: calc_* tables store the same data in normalized form for querying,
        # but we don't need to insert from them since raw_statcan_data already has the semantic vectors
        self.db.execute_non_query("""
            INSERT INTO export_data (vector, ref_date, value)
            SELECT vector, ref_date, CAST(value AS NVARCHAR(100))
            FROM raw_statcan_data
        """)
        
        # Copy metadata
        self.db.execute_non_query("""
            INSERT INTO export_metadata (vector, title, uom, scalar_factor)
            SELECT vector, title, uom, scalar_factor
            FROM raw_statcan_metadata
        """)
    
    def get_export_data(self) -> List[Tuple[str, str, str]]:
        """
        Get all data for export to CSV.
        
        Returns:
            List of (vector, ref_date, value) tuples
        """
        results = self.db.execute_query(
            "SELECT vector, ref_date, value FROM export_data ORDER BY vector, ref_date"
        )
        return [(r['vector'], r['ref_date'], r['value']) for r in results]
    
    def get_export_metadata(self) -> List[Tuple[str, str, str, str]]:
        """
        Get all metadata for export to CSV.
        
        Returns:
            List of (vector, title, uom, scalar_factor) tuples
        """
        results = self.db.execute_query(
            "SELECT vector, title, uom, scalar_factor FROM export_metadata ORDER BY vector"
        )
        return [(r['vector'], r['title'], r['uom'], r['scalar_factor']) for r in results]
    
    def get_major_projects_for_export(self) -> List[Dict[str, Any]]:
        """
        Get major projects data for map CSV export.
        
        Returns:
            List of project dictionaries
        """
        return self.db.execute_query("""
            SELECT project_name, company, location, province, project_type,
                   sub_type, estimated_cost, status, latitude, longitude
            FROM raw_major_projects
            ORDER BY province, project_name
        """)
    
    # =========================================================================
    # DATA SOURCE QUERIES
    # =========================================================================
    
    def get_enabled_sources(self, section_id: int = None) -> List[Dict[str, Any]]:
        """
        Get list of enabled data sources.
        
        Args:
            section_id: Optional filter by section
            
        Returns:
            List of data source records
        """
        if section_id:
            return self.db.execute_query(
                "SELECT * FROM data_sources WHERE is_enabled = 1 AND section_id = ? ORDER BY source_key",
                (section_id,)
            )
        return self.db.execute_query(
            "SELECT * FROM data_sources WHERE is_enabled = 1 ORDER BY section_id, source_key"
        )
    
    def get_source_by_key(self, source_key: str) -> Optional[Dict[str, Any]]:
        """Get a single data source by its key."""
        results = self.db.execute_query(
            "SELECT * FROM data_sources WHERE source_key = ?",
            (source_key,)
        )
        return results[0] if results else None
    
    def get_last_run_info(self, source_key: str) -> Optional[Dict[str, Any]]:
        """Get information about the last run for a data source."""
        results = self.db.execute_query("""
            SELECT TOP 1 * FROM run_history 
            WHERE source_key = ? AND status = 'success'
            ORDER BY completed_at DESC
        """, (source_key,))
        return results[0] if results else None
