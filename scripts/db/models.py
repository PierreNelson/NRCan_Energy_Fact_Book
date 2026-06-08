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
    TABLE_EFB_INDICATORS,
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

    def get_recent_run_history(
        self, hours: int = 24, failed_only: bool = False
    ) -> List[Dict[str, Any]]:
        """Return recent run history rows within the given hour window."""
        query = f"""
            SELECT run_id, source_key, run_type, status, rows_affected,
                   error_message, started_at, completed_at
            FROM [{TABLE_RUN_HISTORY}]
            WHERE started_at >= DATEADD(hour, ?, GETUTCDATE())
        """
        params: List[Any] = [-hours]
        if failed_only:
            query += " AND status = 'failed'"
        query += " ORDER BY started_at DESC"
        return self.db.execute_query(query, tuple(params))

    def get_last_successful_refresh_per_source(self) -> List[Dict[str, Any]]:
        """Return the most recent successful EEDAS update per source_key."""
        query = f"""
            SELECT source_key, MAX(completed_at) AS last_success
            FROM [{TABLE_RUN_HISTORY}]
            WHERE status = 'success' AND run_type = 'eedas_update'
            GROUP BY source_key
            ORDER BY source_key
        """
        return self.db.execute_query(query)
    
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

    def replace_source_ingest(
        self,
        source_key: str,
        data_rows: List[Tuple[str, str, float]],
        metadata_rows: List[Tuple],
    ) -> int:
        """
        Clear and upsert ingest rows for a source in a single transaction.

        On failure, prior rows for the source are preserved (rollback).
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
        with self.db.transaction() as conn:
            cur = conn.cursor()
            cur.execute(f"DELETE FROM [{table}] WHERE source_key = ?", (source_key,))
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

    def get_raw_dataframe(self, source_key: str) -> pd.DataFrame:
        """Return ingest rows for a source as a DataFrame (vector, ref_date, value, …)."""
        table = get_source_table(source_key)
        rows = self.db.execute_query(
            f"SELECT vector, ref_date, value, title, uom, scalar_factor, source_org, source_url "
            f"FROM [{table}] WHERE source_key = ? AND ref_date <> N'' "
            f"ORDER BY vector, ref_date",
            (source_key,),
        )
        columns = [
            'vector', 'ref_date', 'value', 'title', 'uom',
            'scalar_factor', 'source_org', 'source_url',
        ]
        if not rows:
            return pd.DataFrame(columns=columns)
        df = pd.DataFrame(rows)
        df['value'] = pd.to_numeric(df['value'], errors='coerce')
        return df
    
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
    
    def count_raw_table_rows(self, physical_table: str) -> int:
        """Return row count for an EEDAS physical table."""
        validate = physical_table  # caller must pass validated name
        rows = self.db.execute_query(
            f"SELECT COUNT(*) AS n FROM [{validate}]"
        )
        return int(rows[0]["n"]) if rows else 0

    def replace_efb_indicators(
        self,
        indicator_key: str,
        data_rows: List[Tuple],
        metadata_rows: List[Tuple],
    ) -> int:
        """
        Atomically replace all indicator rows for indicator_key in nrcan_efb_indicators.
        """
        if not data_rows and not metadata_rows:
            return 0

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
            MERGE INTO [{TABLE_EFB_INDICATORS}] AS t
            USING (SELECT ? AS vector, ? AS ref_date, ? AS value, ? AS title, ? AS uom,
                          ? AS scalar_factor, ? AS source_org, ? AS source_url, ? AS indicator_key) AS s
            ON t.vector = s.vector AND t.ref_date = s.ref_date
            WHEN MATCHED THEN
                UPDATE SET value = s.value,
                           title = COALESCE(s.title, t.title),
                           uom = COALESCE(s.uom, t.uom),
                           scalar_factor = COALESCE(s.scalar_factor, t.scalar_factor),
                           source_org = COALESCE(s.source_org, t.source_org),
                           source_url = COALESCE(s.source_url, t.source_url),
                           indicator_key = s.indicator_key,
                           computed_at = GETUTCDATE()
            WHEN NOT MATCHED THEN
                INSERT (vector, ref_date, value, title, uom, scalar_factor,
                        source_org, source_url, indicator_key)
                VALUES (s.vector, s.ref_date, s.value, s.title, s.uom, s.scalar_factor,
                        s.source_org, s.source_url, s.indicator_key);
        """

        with self.db.get_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                f"DELETE FROM [{TABLE_EFB_INDICATORS}] WHERE indicator_key = ?",
                (indicator_key,),
            )
            n = 0
            for vector, ref_date, value in data_rows:
                meta = meta_by_v.get(str(vector), (None, None, None, None, None))
                cur.execute(
                    merge_sql,
                    (
                        vector,
                        ref_date,
                        to_python_type(value),
                        meta[0],
                        meta[1],
                        meta[2],
                        meta[3],
                        meta[4],
                        indicator_key,
                    ),
                )
                n += 1
            for row in metadata_rows or []:
                v = str(row[0])
                if any(str(r[0]) == v for r in data_rows):
                    continue
                cur.execute(
                    merge_sql,
                    (
                        v,
                        "",
                        None,
                        row[1] if len(row) > 1 else None,
                        row[2] if len(row) > 2 else None,
                        row[3] if len(row) > 3 else None,
                        row[4] if len(row) > 4 else None,
                        row[5] if len(row) > 5 else None,
                        indicator_key,
                    ),
                )
            conn.commit()
        return n

    # =========================================================================
    # EXPORT DATA OPERATIONS
    # =========================================================================
    
    def prepare_export_data(self):
        """
        Rebuild nrcan_fb_export from nrcan_efb_indicators (EFB semantic vectors).
        """
        self.db.execute_non_query(f"DELETE FROM [{TABLE_EXPORT}]")
        self.db.execute_non_query(
            f"INSERT INTO [{TABLE_EXPORT}] "
            f"(vector, ref_date, value, title, uom, scalar_factor, source_org, source_url) "
            f"SELECT vector, ref_date, CAST(value AS NVARCHAR(100)), "
            f"title, uom, scalar_factor, source_org, source_url "
            f"FROM [{TABLE_EFB_INDICATORS}]"
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
