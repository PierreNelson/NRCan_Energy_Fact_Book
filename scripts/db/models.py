"""
Data models and repository for database operations.

Provides high-level methods for storing and retrieving data from SQL Server.
"""

from typing import List, Dict, Any, Tuple
from datetime import datetime
import numpy as np
import pandas as pd
from .connection import DatabaseConnection
from .eedas_registry import (
    get_source_table,
    unique_source_tables,
    TABLE_CALC_CAPITAL_EXPENDITURES,
    TABLE_CALC_CLEAN_TECH,
    TABLE_CALC_ECONOMIC_CONTRIBUTIONS,
    TABLE_CALC_ENERGY_USE,
    TABLE_CALC_ENVIRONMENTAL_PROTECTION,
    TABLE_CALC_INFRASTRUCTURE,
    TABLE_CALC_INTERNATIONAL_INVESTMENT,
    TABLE_CALC_PROVINCIAL_GDP,
    TABLE_DATA_SOURCES,
    TABLE_EXPORT,
    TABLE_MAJOR_PROJECTS_MAP,
    TABLE_RUN_HISTORY,
)


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
        query = f"""
            INSERT INTO [{TABLE_RUN_HISTORY}] (source_key, run_type, status)
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
        query = f"""
            UPDATE [{TABLE_RUN_HISTORY}]
            SET status = ?, rows_affected = ?, error_message = ?,
                completed_at = GETUTCDATE()
            WHERE run_id = ?
        """
        self.db.execute_non_query(query, (status, rows_affected, error_message, run_id))
    
    def update_source_last_refresh(self, source_key: str):
        """Update the last refresh timestamp for a data source."""
        query = f"""
            UPDATE [{TABLE_DATA_SOURCES}]
            SET last_refresh_at = GETUTCDATE(), updated_at = GETUTCDATE()
            WHERE source_key = ?
        """
        self.db.execute_non_query(query, (source_key,))
    
    # =========================================================================
    # RAW DATA OPERATIONS
    # =========================================================================
    
    def clear_raw_data(self, source_key: str):
        """
        Clear ingest rows for a specific source before refresh.
        """
        table = get_source_table(source_key)
        self.db.execute_non_query(
            f"DELETE FROM [{table}] WHERE source_key = ?",
            (source_key,),
        )

    def merge_source_ingest(
        self,
        source_key: str,
        data_rows: List[Tuple[str, str, float]],
        metadata_rows: List[Tuple],
    ) -> int:
        """
        Upsert (vector, ref_date, value) rows into the unified ingest table,
        joining metadata from metadata_rows (per vector).
        """
        if not data_rows:
            return 0
        table = get_source_table(source_key)
        meta_by_v: Dict[str, Tuple] = {}
        for row in metadata_rows or []:
            v = str(row[0])
            meta_by_v[v] = (
                row[1] if len(row) > 1 else None,
                row[2] if len(row) > 2 else None,
                row[3] if len(row) > 3 else None,
                row[4] if len(row) > 4 else None,
                row[5] if len(row) > 5 else None,
            )
        merge_sql = f"""
            MERGE INTO [{table}] AS t
            USING (SELECT ? AS vector, ? AS ref_date, ? AS value, ? AS title, ? AS uom,
                          ? AS scalar_factor, ? AS source_org, ? AS source_url, ? AS source_key) AS s
            ON t.vector = s.vector AND t.ref_date = s.ref_date
            WHEN MATCHED THEN
                UPDATE SET value = s.value,
                           title = COALESCE(s.title, t.title),
                           uom = COALESCE(s.uom, t.uom),
                           scalar_factor = COALESCE(s.scalar_factor, t.scalar_factor),
                           source_org = COALESCE(s.source_org, t.source_org),
                           source_url = COALESCE(s.source_url, t.source_url),
                           source_key = s.source_key,
                           fetched_at = GETUTCDATE()
            WHEN NOT MATCHED THEN
                INSERT (vector, ref_date, value, title, uom, scalar_factor, source_org, source_url, source_key)
                VALUES (s.vector, s.ref_date, s.value, s.title, s.uom, s.scalar_factor, s.source_org, s.source_url, s.source_key);
        """
        n = 0
        with self.db.get_connection() as conn:
            cur = conn.cursor()
            for vector, ref_date, value in data_rows:
                m = meta_by_v.get(str(vector), (None, None, None, None, None))
                cur.execute(
                    merge_sql,
                    (
                        str(vector),
                        str(ref_date),
                        to_python_type(value),
                        m[0],
                        m[1],
                        m[2],
                        m[3],
                        m[4],
                        source_key,
                    ),
                )
                n += 1
            conn.commit()
        return n

    def upsert_ingest_metadata_only(self, source_key: str, metadata: List[Tuple]) -> int:
        """
        Update or insert metadata anchor rows (ref_date N'') for vectors without touching series rows.
        """
        if not metadata:
            return 0
        table = get_source_table(source_key)
        merge_sql = f"""
            MERGE INTO [{table}] AS t
            USING (SELECT ? AS vector, N'' AS ref_date, CAST(NULL AS DECIMAL(18,4)) AS value,
                          ? AS title, ? AS uom, ? AS scalar_factor, ? AS source_org, ? AS source_url,
                          ? AS source_key) AS s
            ON t.vector = s.vector AND t.ref_date = s.ref_date
            WHEN MATCHED THEN
                UPDATE SET title = s.title, uom = s.uom, scalar_factor = s.scalar_factor,
                           source_org = s.source_org, source_url = s.source_url,
                           source_key = s.source_key, fetched_at = GETUTCDATE()
            WHEN NOT MATCHED THEN
                INSERT (vector, ref_date, value, title, uom, scalar_factor, source_org, source_url, source_key)
                VALUES (s.vector, s.ref_date, s.value, s.title, s.uom, s.scalar_factor, s.source_org, s.source_url, s.source_key);
        """
        n = 0
        with self.db.get_connection() as conn:
            cur = conn.cursor()
            for row in metadata:
                cur.execute(
                    merge_sql,
                    (
                        row[0],
                        row[1] if len(row) > 1 else None,
                        row[2] if len(row) > 2 else None,
                        row[3] if len(row) > 3 else None,
                        row[4] if len(row) > 4 else None,
                        row[5] if len(row) > 5 else None,
                        source_key,
                    ),
                )
                n += 1
            conn.commit()
        return n

    def insert_raw_statcan_data(self, source_key: str, data: List[Tuple[str, str, float]]):
        """Insert data points only (no metadata). Prefer merge_source_ingest when metadata is available."""
        return self.merge_source_ingest(source_key, data, [])

    def insert_raw_statcan_metadata(self, source_key: str, metadata: List[Tuple]):
        """Metadata-only upserts (anchor rows)."""
        return self.upsert_ingest_metadata_only(source_key, metadata)
    
    def insert_major_projects_map(self, rows: List[Dict[str, Any]]):
        """
        Insert major projects map data for CSV export.
        
        Args:
            rows: List of row dictionaries with map feature data
        """
        if not rows:
            return 0
        
        # Clear existing and insert fresh
        self.db.execute_non_query(f"DELETE FROM [{TABLE_MAJOR_PROJECTS_MAP}]")

        query = f"""
            INSERT INTO [{TABLE_MAJOR_PROJECTS_MAP}]
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
        return self.db.execute_query(f"""
            SELECT lang, feature_id as id, company, project_name, province, location,
                   capital_cost, capital_cost_range, status, clean_technology,
                   clean_technology_type, line_type, lat, lon, paths, feature_type as type
            FROM [{TABLE_MAJOR_PROJECTS_MAP}]
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
        
        query = f"""
            MERGE INTO [{TABLE_CALC_CAPITAL_EXPENDITURES}] AS target
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
        
        query = f"""
            MERGE INTO [{TABLE_CALC_INFRASTRUCTURE}] AS target
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
        
        query = f"""
            MERGE INTO [{TABLE_CALC_ECONOMIC_CONTRIBUTIONS}] AS target
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
        
        query = f"""
            MERGE INTO [{TABLE_CALC_INTERNATIONAL_INVESTMENT}] AS target
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
        
        query = f"""
            MERGE INTO [{TABLE_CALC_ENVIRONMENTAL_PROTECTION}] AS target
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
        
        query = f"""
            MERGE INTO [{TABLE_CALC_PROVINCIAL_GDP}] AS target
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
        
        query = f"""
            MERGE INTO [{TABLE_CALC_CLEAN_TECH}] AS target
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

    def upsert_energy_use(self, data: List[Dict[str, Any]]):
        """
        Insert or update energy use by sector (OEE NEUD + Primary Energy Use Demand).
        Args:
            data: List of dicts with year, R, C, I, T, A, P, NPC, FK, EL (PJ).
        """
        if not data:
            return 0
        query = f"""
            MERGE INTO [{TABLE_CALC_ENERGY_USE}] AS target
            USING (VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)) AS source
                  (ref_year, R, C, I, T, A, P, NPC, FK, EL)
            ON target.ref_year = source.ref_year
            WHEN MATCHED THEN
                UPDATE SET R = source.R, C = source.C, I = source.I, T = source.T,
                           A = source.A, P = source.P, NPC = source.NPC, FK = source.FK, EL = source.EL,
                           calculated_at = GETUTCDATE()
            WHEN NOT MATCHED THEN
                INSERT (ref_year, R, C, I, T, A, P, NPC, FK, EL)
                VALUES (source.ref_year, source.R, source.C, source.I, source.T,
                        source.A, source.P, source.NPC, source.FK, source.EL);
        """
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            for row in data:
                cursor.execute(query, (
                    row['year'],
                    row.get('R'), row.get('C'), row.get('I'), row.get('T'), row.get('A'),
                    row.get('P'), row.get('NPC'), row.get('FK'), row.get('EL')
                ))
            conn.commit()
            return len(data)
    
    def upsert_foreign_control(self, data: List[Dict[str, Any]]):
        """
        Insert or update foreign control data.
        Stores semantic vectors in the registry table for foreign_control.
        """
        if not data:
            return 0
        
        # Foreign control doesn't have a dedicated calc table;
        # store with semantic vectors in the registry table for foreign_control.
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
        Rebuild nrcan_fb_export from all unified ingest tables (wide copy).

        Website CSVs are built from nrcan_fb_export; calc tables are not unioned here.
        """
        self.db.execute_non_query(f"DELETE FROM [{TABLE_EXPORT}]")
        tables = unique_source_tables()
        if not tables:
            return
        parts = [
            f"SELECT vector, ref_date, CAST(value AS NVARCHAR(100)) AS value, "
            f"title, uom, scalar_factor, source_org, source_url FROM [{t}]"
            for t in tables
        ]
        union_sql = " UNION ALL ".join(parts)
        self.db.execute_non_query(
            f"INSERT INTO [{TABLE_EXPORT}] "
            f"(vector, ref_date, value, title, uom, scalar_factor, source_org, source_url) "
            f"{union_sql}"
        )
    
    def get_export_data(self) -> List[Tuple[str, str, str]]:
        """
        Get all data for export to CSV.
        
        Returns:
            List of (vector, ref_date, value) tuples
        """
        results = self.db.execute_query(
            f"SELECT vector, ref_date, value FROM [{TABLE_EXPORT}] "
            f"WHERE value IS NOT NULL AND ref_date <> N'' "
            f"ORDER BY vector, ref_date"
        )
        return [(r['vector'], r['ref_date'], r['value']) for r in results]
    
    def get_export_metadata(self) -> List[Tuple[str, str, str, str, str, str]]:
        """
        Get all metadata for export to CSV.
        
        Returns:
            List of (vector, title, uom, scalar_factor, source_org, source_url) tuples
        """
        results = self.db.execute_query(
            f"SELECT vector, "
            f"MAX(title) AS title, MAX(uom) AS uom, MAX(scalar_factor) AS scalar_factor, "
            f"MAX(source_org) AS source_org, MAX(source_url) AS source_url "
            f"FROM [{TABLE_EXPORT}] WHERE title IS NOT NULL "
            f"GROUP BY vector ORDER BY vector"
        )
        return [(r['vector'], r['title'], r['uom'], r['scalar_factor'], r.get('source_org') or '', r.get('source_url') or '') for r in results]
    
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
                f"SELECT * FROM [{TABLE_DATA_SOURCES}] WHERE is_enabled = 1 AND section_id = ? "
                f"ORDER BY source_key",
                (section_id,),
            )
        return self.db.execute_query(
            f"SELECT * FROM [{TABLE_DATA_SOURCES}] WHERE is_enabled = 1 ORDER BY section_id, source_key"
        )
