"""
Base class for section data processors.

Provides common functionality for fetching data from StatCan and storing
in the SQL Server database.
"""

import io
import time
import pandas as pd
import requests
from abc import ABC, abstractmethod
from typing import Dict, Any, List, Tuple, Optional
from datetime import datetime

from db.connection import DatabaseConnection
from db.models import DataRepository
from config_loader import Config


class SectionProcessor(ABC):
    """
    Abstract base class for section data processors.
    
    Each section (Key Indicators, Investment, etc.) should have a processor
    that inherits from this class and implements the required methods.
    """
    
    # Section identifier - override in subclasses
    SECTION_KEY = "base"
    SECTION_NAME = "Base Section"
    SECTION_ID = 0
    
    # Timeout for HTTP requests
    REQUEST_TIMEOUT = 120

    # StatCan occasionally resets long CSV connections; headers + retries match WDS fetch behavior.
    STATCAN_CSV_HEADERS = {
        "Accept": "text/csv,text/plain,*/*;q=0.8",
        "Accept-Language": "en-CA,en;q=0.9",
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        ),
        "Referer": "https://www.statcan.gc.ca/",
    }
    
    def __init__(self, config: Config, db: DatabaseConnection):
        """
        Initialize the section processor.
        
        Args:
            config: Configuration instance
            db: Database connection instance
        """
        self.config = config
        self.db = db
        self.repo = DataRepository(db)
    
    @abstractmethod
    def get_source_handlers(self) -> Dict[str, callable]:
        """
        Return a mapping of source_key -> handler function.
        
        Each handler function should:
        - Fetch data from the source
        - Process and normalize the data
        - Store in the database using the repository
        
        Returns:
            Dict mapping source keys to handler methods
        """
        pass
    
    def refresh_all(self) -> Dict[str, Any]:
        """
        Refresh all enabled data sources in this section.
        
        Returns:
            Summary of results for each source
        """
        results = {}
        handlers = self.get_source_handlers()
        
        for source_key, handler in handlers.items():
            if self.config.is_source_enabled(self.SECTION_KEY, source_key):
                print(f"\n[{self.SECTION_NAME}] Processing: {source_key}")
                try:
                    result = self.refresh_source(source_key, handler)
                    results[source_key] = result
                except Exception as e:
                    print(f"  ERROR: {e}")
                    results[source_key] = {'status': 'failed', 'error': str(e)}
        
        return results
    
    def refresh_source(self, source_key: str, handler: callable = None) -> Dict[str, Any]:
        """
        Refresh a single data source.
        
        Args:
            source_key: Identifier for the data source
            handler: Optional handler function (looks up if not provided)
            
        Returns:
            Result dictionary with status and row counts
        """
        if handler is None:
            handlers = self.get_source_handlers()
            handler = handlers.get(source_key)
            if handler is None:
                raise ValueError(f"No handler found for source: {source_key}")
        
        # Log run start
        run_id = self.repo.log_run_start(source_key, 'fetch')
        
        try:
            # Execute the handler
            rows_affected = handler()
            
            # Update metadata
            self.repo.update_source_last_refresh(source_key)
            self.repo.log_run_complete(run_id, 'success', rows_affected)
            
            print(f"  Completed: {rows_affected} rows")
            return {'status': 'success', 'rows': rows_affected}
            
        except Exception as e:
            self.repo.log_run_complete(run_id, 'failed', error_message=str(e))
            raise
    
    # =========================================================================
    # COMMON DATA FETCHING METHODS
    # =========================================================================
    
    def build_statcan_url(self, vectors: List[str], 
                          start_date: str = "2000-01-01") -> str:
        """
        Build a StatCan download URL for given vectors.
        
        Args:
            vectors: List of StatCan vector IDs
            start_date: Start date for data range
            
        Returns:
            URL string for StatCan download API
        """
        vector_str = ",".join(vectors)
        return (
            f"https://www150.statcan.gc.ca/t1/wds/rest/getDataFromVectorByReferencePeriodRange"
            f"?vectorIds={vector_str}&startRefPeriod={start_date}&endRefPeriod=2030-12-31"
        )
    
    def build_statcan_bulk_url(self, table_id: str, vectors: List[str]) -> str:
        """
        Build a StatCan bulk download URL.
        
        Args:
            table_id: StatCan table ID
            vectors: List of vector IDs
            
        Returns:
            URL for bulk CSV download
        """
        vector_str = ','.join(vectors)
        return (
            f"https://www150.statcan.gc.ca/t1/tbl1/en/dtl!downloadDbLoadingData.action?"
            f"pid={table_id.replace('-', '')}&latestN=0&startDate=2000-01-01"
            f"&endDate=2030-01-01&csvLocale=en&selectedMembers={vector_str}"
        )
    
    def fetch_csv_from_url(self, url: str) -> pd.DataFrame:
        """
        Fetch CSV data from a URL and return as DataFrame.
        
        Retries transient connection failures and HTTP 502/503/504, then tries the
        -nonTraduit StatCan URL when the primary download endpoint returns an error page.
        
        Args:
            url: URL to fetch data from
            
        Returns:
            pandas DataFrame with the data
            
        Raises:
            Exception: If fetch fails
        """
        print(f"  Fetching data from StatCan...")

        alt_url = url.replace(
            "downloadDbLoadingData.action",
            "downloadDbLoadingData-nonTraduit.action",
        )
        urls_to_try = [url]
        if alt_url != url:
            urls_to_try.append(alt_url)

        last_error: Optional[Exception] = None

        for u in urls_to_try:
            if u != urls_to_try[0]:
                print(f"  Trying alternative StatCan URL...")

            for attempt in range(3):
                try:
                    if attempt > 0:
                        delay = 2 * attempt
                        print(
                            f"  Retrying StatCan fetch "
                            f"(attempt {attempt + 1}/3, wait {delay}s)..."
                        )
                        time.sleep(delay)

                    response = requests.get(
                        u,
                        timeout=self.REQUEST_TIMEOUT,
                        headers=self.STATCAN_CSV_HEADERS,
                    )
                    response.raise_for_status()
                    text = response.text
                    if "Failed to get" in text or "<html" in text.lower():
                        raise ValueError(f"StatCan returned error: {text[:200]}")

                    df = pd.read_csv(io.StringIO(text))
                    if len(df.columns) < 3:
                        raise ValueError(
                            f"Invalid data format, columns: {df.columns.tolist()}"
                        )
                    return df

                except ValueError as e:
                    last_error = e
                    break

                except requests.exceptions.HTTPError as e:
                    last_error = e
                    code = e.response.status_code if e.response is not None else None
                    if code in (502, 503, 504):
                        if attempt < 2:
                            continue
                        break
                    raise Exception(f"Failed to fetch data from StatCan: {e}") from e

                except (
                    requests.exceptions.ConnectionError,
                    requests.exceptions.Timeout,
                    ConnectionResetError,
                    OSError,
                ) as e:
                    last_error = e
                    if attempt < 2:
                        continue
                    break

        raise Exception(f"Failed to fetch data from StatCan: {last_error}") from last_error
    
    def fetch_wds_vector_data(self, vector_ids: List[str], start_ref: str = "2007-01-01", end_ref: str = "2030-12-31") -> List[Tuple[int, str, float]]:
        """
        Fetch data from StatCan WDS getDataFromVectorByReferencePeriodRange (JSON).
        Returns list of (vector_id, ref_per, value). ref_per is YYYY or YYYY-MM-DD.
        vector_ids: list of numeric strings, e.g. ['2363382'] or ['v2363382'] (V stripped).
        """
        ids = [str(v).strip().lstrip('vV') for v in vector_ids]
        vector_str = ','.join(ids)
        url = (
            f"https://www150.statcan.gc.ca/t1/wds/rest/getDataFromVectorByReferencePeriodRange"
            f"?vectorIds={vector_str}&startRefPeriod={start_ref}&endReferencePeriod={end_ref}"
        )
        headers = {
            "Accept": "*/*",
            "Accept-Language": "en-CA,en;q=0.9",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Referer": "https://www.statcan.gc.ca/",
        }
        last_error = None
        for attempt in range(3):
            try:
                if attempt > 0:
                    time.sleep(4)
                response = requests.get(url, timeout=self.REQUEST_TIMEOUT, headers=headers)
                response.raise_for_status()
                raw = response.json()
                last_error = None
                break
            except (requests.exceptions.ConnectionError, requests.exceptions.Timeout, ConnectionResetError) as e:
                last_error = e
                continue
            except requests.exceptions.HTTPError as e:
                if e.response is not None and e.response.status_code in (502, 503, 504):
                    last_error = e
                    continue
                raise Exception(f"WDS request failed: {e}")
            except Exception as e:
                raise Exception(f"WDS request failed: {e}")
        if last_error is not None:
            raise Exception(f"WDS request failed after 3 attempts: {last_error}")
        out = []
        if isinstance(raw, list):
            for item in raw:
                if item.get("status") != "SUCCESS":
                    continue
                obj = item.get("object") or {}
                vid = obj.get("vectorId")
                if vid is None:
                    continue
                points = obj.get("vectorDataPoint") or []
                for pt in points:
                    ref = (pt.get("refPer") or pt.get("refPerRaw") or "")
                    val = pt.get("value")
                    if ref and val is not None and (isinstance(val, (int, float)) or (isinstance(val, str) and val.replace(".", "").replace("-", "").isdigit())):
                        try:
                            vfloat = float(val) if not isinstance(val, (int, float)) else val
                            out.append((int(vid), ref, vfloat))
                        except (TypeError, ValueError):
                            pass
        elif isinstance(raw, dict) and raw.get("status") == "SUCCESS":
            obj = raw.get("object") or {}
            vid = obj.get("vectorId")
            if vid is not None:
                points = obj.get("vectorDataPoint") or []
                for pt in points:
                    ref = (pt.get("refPer") or pt.get("refPerRaw") or "")
                    val = pt.get("value")
                    if ref and val is not None:
                        try:
                            vfloat = float(val) if not isinstance(val, (int, float)) else val
                            out.append((int(vid), ref, vfloat))
                        except (TypeError, ValueError):
                            pass
        return out
    
    def get_column(self, df: pd.DataFrame, *possible_names, default=None):
        """
        Find a column by trying multiple possible names (case-insensitive).
        
        Args:
            df: DataFrame to search
            *possible_names: Possible column names to try
            default: Default value if no column found
            
        Returns:
            The actual column name found, or default
        """
        df_cols_lower = {col.lower(): col for col in df.columns}
        
        for name in possible_names:
            if name.lower() in df_cols_lower:
                return df_cols_lower[name.lower()]
        
        return default
    
    def to_python_type(self, value):
        """
        Convert numpy types to Python native types for database compatibility.
        
        Args:
            value: Value that might be a numpy type
            
        Returns:
            Python native type
        """
        import numpy as np
        
        if pd.isna(value):
            return None
        if isinstance(value, (np.integer, np.int64, np.int32)):
            return int(value)
        if isinstance(value, (np.floating, np.float64, np.float32)):
            return float(value)
        if isinstance(value, np.ndarray):
            return value.tolist()
        return value
    
    def extract_data_and_metadata(self, df: pd.DataFrame, 
                                   source_key: str) -> Tuple[List[Tuple], List[Tuple]]:
        """
        Extract data and metadata from a StatCan DataFrame.
        
        Args:
            df: DataFrame from StatCan CSV
            source_key: Source identifier for storage
            
        Returns:
            Tuple of (data_rows, metadata_rows)
            - data_rows: List of (vector, ref_date, value) tuples
            - metadata_rows: List of (vector, title, uom, scalar_factor) tuples
        """
        data_rows = []
        metadata_rows = []
        seen_vectors = set()
        
        # Find columns case-insensitively
        vector_col = self.get_column(df, 'VECTOR', 'Vector', 'vector')
        ref_date_col = self.get_column(df, 'REF_DATE', 'Ref_date', 'ref_date')
        value_col = self.get_column(df, 'VALUE', 'Value', 'value')
        coord_col = self.get_column(df, 'Coordinate', 'COORDINATE', 'coordinate')
        uom_col = self.get_column(df, 'UOM', 'UNIT_MEASURE', 'uom', 'Unit of measure')
        scalar_col = self.get_column(df, 'SCALAR_FACTOR', 'Scalar_factor', 'scalar_factor')
        
        # If no VECTOR column, we can't extract in this format
        if not vector_col:
            print(f"    Warning: No VECTOR column found. Columns: {df.columns.tolist()[:10]}")
            return data_rows, metadata_rows
        
        for _, row in df.iterrows():
            vector = str(row.get(vector_col, '')) if vector_col else ''
            if not vector or vector == 'nan':
                continue
            
            # Clean vector ID
            vector = vector.strip()
            if not vector.startswith('v'):
                vector = f"v{vector}"
            
            # Extract data point
            ref_date = str(row.get(ref_date_col, '')) if ref_date_col else ''
            value = row.get(value_col) if value_col else None
            
            if pd.notna(value):
                try:
                    value = float(value)
                    data_rows.append((vector, ref_date, value))
                except (ValueError, TypeError):
                    pass
            
            # Extract metadata (once per vector)
            if vector not in seen_vectors:
                seen_vectors.add(vector)
                title = str(row.get(coord_col, '')) if coord_col else ''
                uom = str(row.get(uom_col, '')) if uom_col else ''
                scalar = str(row.get(scalar_col, '')) if scalar_col else ''
                
                if title and title != 'nan':
                    metadata_rows.append((vector, title, uom, scalar))
        
        return data_rows, metadata_rows
    
    def store_raw_data(self, source_key: str, 
                       data_rows: List[Tuple], 
                       metadata_rows: List[Tuple]) -> int:
        """
        Store raw data and metadata in the database.
        
        Args:
            source_key: Source identifier
            data_rows: List of (vector, ref_date, value) tuples
            metadata_rows: List of (vector, title, uom, scalar_factor) tuples
            
        Returns:
            Number of data rows stored
        """
        self.repo.merge_source_ingest(source_key, data_rows, metadata_rows)
        if metadata_rows:
            data_vectors = {str(r[0]) for r in data_rows}
            meta_only = [r for r in metadata_rows if str(r[0]) not in data_vectors]
            if meta_only:
                self.repo.upsert_ingest_metadata_only(source_key, meta_only)
        return len(data_rows)
    
    def store_calculated_data(self, source_key: str,
                              calc_type: str,
                              data: List[Dict[str, Any]],
                              metadata_rows: List[Tuple] = None) -> int:
        """
        Store calculated/derived data in the appropriate calc_* table.
        
        This stores aggregated or computed values that are derived from
        raw StatCan data. The data is also exported with semantic vector names.
        
        Args:
            source_key: Source identifier (e.g., 'capital_expenditures')
            calc_type: Type of calculated data ('capex', 'infra', 'econ', etc.)
            data: List of dicts with year and calculated values
            metadata_rows: Optional list of (vector, title, uom, scalar_factor) tuples
            
        Returns:
            Number of data rows stored
        """
        if not data:
            return 0
        
        # Store in the appropriate calc_* table based on type
        if calc_type == 'capital_expenditures':
            self.repo.upsert_capital_expenditures(data)
        elif calc_type == 'infrastructure':
            self.repo.upsert_infrastructure(data)
        elif calc_type == 'economic_contributions':
            self.repo.upsert_economic_contributions(data)
        elif calc_type == 'international_investment':
            self.repo.upsert_international_investment(data)
        elif calc_type == 'environmental_protection':
            self.repo.upsert_environmental_protection(data)
        elif calc_type == 'provincial_gdp':
            self.repo.upsert_provincial_gdp(data)
        elif calc_type == 'clean_tech':
            self.repo.upsert_clean_tech(data)
        elif calc_type == 'foreign_control':
            self.repo.upsert_foreign_control(data)
        
        # Also store metadata if provided
        if metadata_rows:
            self.repo.insert_raw_statcan_metadata(source_key, metadata_rows)
        
        return len(data)
    
    # =========================================================================
    # UTILITY METHODS
    # =========================================================================
    
    def get_latest_year(self, df: pd.DataFrame) -> Optional[int]:
        """
        Get the latest year from a DataFrame.
        
        Args:
            df: DataFrame with REF_DATE column
            
        Returns:
            Latest year as integer, or None
        """
        try:
            ref_dates = df['REF_DATE'].dropna()
            years = ref_dates.str[:4].astype(int)
            return years.max()
        except:
            return None
    
    def filter_by_year(self, df: pd.DataFrame, year: int) -> pd.DataFrame:
        """
        Filter DataFrame to a specific year.
        
        Args:
            df: DataFrame with REF_DATE column
            year: Year to filter to
            
        Returns:
            Filtered DataFrame
        """
        return df[df['REF_DATE'].str.startswith(str(year))]
