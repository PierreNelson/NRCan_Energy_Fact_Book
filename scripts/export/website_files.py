"""
Website file exporter for NRCan Energy Factbook.

Generates data.csv, metadata.csv, and major_projects_map.csv from the
SQL Server database.

Supports selective export by:
- Data source (--source): Export only vectors from a specific source
- Vector pattern (--vectors): Export vectors matching a glob pattern
- Page (--page): Export only vectors used by a specific page
"""

import csv
import os
from pathlib import Path
from typing import Dict, Any, List, Optional

from db.connection import DatabaseConnection
from db.models import DataRepository
from config_loader import Config
from export.page_vectors import (
    get_vectors_for_source,
    get_vectors_for_page,
    match_vector_pattern,
    get_all_pages,
    get_all_sources,
)


class WebsiteExporter:
    """
    Exports data from SQL Server to CSV files for the website.
    
    Output files:
    - data.csv: Time series data (vector, ref_date, value)
    - metadata.csv: Vector metadata (vector, title, uom, scalar_factor)
    - major_projects_map.csv: Project data for map visualization
    
    Supports selective export filtering.
    """
    
    def __init__(self, config: Config, db: DatabaseConnection):
        """
        Initialize the exporter.
        
        Args:
            config: Configuration instance
            db: Database connection instance
        """
        self.config = config
        self.db = db
        self.repo = DataRepository(db)
        
        # Filter settings
        self._source_filter: Optional[str] = None
        self._vector_pattern: Optional[str] = None
        self._page_filter: Optional[str] = None
        self._vector_prefixes: List[str] = []
    
    def set_source_filter(self, source: str):
        """
        Set filter to export only vectors from a specific data source.
        
        Args:
            source: Data source name (e.g., 'capital_expenditures')
        """
        prefixes = get_vectors_for_source(source)
        if not prefixes:
            available = ', '.join(get_all_sources())
            raise ValueError(f"Unknown source '{source}'. Available: {available}")
        
        self._source_filter = source
        self._vector_prefixes = prefixes
        print(f"  Filter: source={source} (prefixes: {prefixes})")
    
    def set_vector_pattern(self, pattern: str):
        """
        Set filter to export vectors matching a glob pattern.
        
        Args:
            pattern: Glob pattern (e.g., 'capex_*', '*_total')
        """
        self._vector_pattern = pattern
        print(f"  Filter: vectors matching '{pattern}'")
    
    def set_page_filter(self, page: str):
        """
        Set filter to export only vectors used by a specific page.
        
        Args:
            page: Page name (e.g., 'Page24', 'page24')
        """
        prefixes = get_vectors_for_page(page)
        if not prefixes:
            available = ', '.join(get_all_pages())
            raise ValueError(f"Unknown page '{page}'. Available: {available}")
        
        self._page_filter = page
        self._vector_prefixes = prefixes
        print(f"  Filter: page={page} (prefixes: {prefixes})")
    
    def _should_include_vector(self, vector: str) -> bool:
        """
        Check if a vector should be included based on active filters.
        
        Args:
            vector: Vector name to check
            
        Returns:
            True if vector passes all filters
        """
        # Check prefix filter (from source or page)
        if self._vector_prefixes:
            if not any(vector.startswith(prefix) for prefix in self._vector_prefixes):
                return False
        
        # Check pattern filter
        if self._vector_pattern:
            if not match_vector_pattern(vector, self._vector_pattern):
                return False
        
        return True
    
    def _is_filtered_export(self) -> bool:
        """Check if any filters are active."""
        return bool(self._source_filter or self._vector_pattern or self._page_filter)
    
    def export_all(self) -> Dict[str, Any]:
        """
        Export all website files (with any active filters applied).
        
        Returns:
            Summary of export results
        """
        results = {}
        
        # First, prepare export tables from all raw data
        print("\nPreparing export data from database...")
        self.repo.prepare_export_data()
        
        # Export each file
        results['data_csv'] = self._export_data_csv()
        results['metadata_csv'] = self._export_metadata_csv()
        
        # Only export major_projects_map if no filters or if relevant filter
        if not self._is_filtered_export() or self._source_filter == 'major_projects_map':
            results['major_projects_csv'] = self._export_major_projects_csv()
        else:
            results['major_projects_csv'] = {'status': 'skipped', 'rows': 0, 'reason': 'filtered'}
        
        return results
    
    def _get_output_path(self, filename: str) -> Path:
        """Get full output path for a file."""
        return self.config.get_export_path(filename)
    
    def _export_data_csv(self) -> Dict[str, Any]:
        """
        Export data.csv file (with filtering if active).
        
        Returns:
            Export result with row count
        """
        filter_desc = ""
        if self._source_filter:
            filter_desc = f" (source: {self._source_filter})"
        elif self._page_filter:
            filter_desc = f" (page: {self._page_filter})"
        elif self._vector_pattern:
            filter_desc = f" (pattern: {self._vector_pattern})"
        
        print(f"\nExporting data.csv{filter_desc}...")
        
        output_path = self._get_output_path(
            self.config.export.get('files', {}).get('data_csv', 'data.csv')
        )
        
        # Ensure output directory exists
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Get data from database
        all_data = self.repo.get_export_data()
        
        # Apply filters if any
        if self._is_filtered_export():
            # For filtered exports, we need to merge with existing data
            # Read existing CSV first
            existing_data = {}
            if output_path.exists():
                with open(output_path, 'r', encoding='utf-8') as f:
                    reader = csv.reader(f)
                    next(reader)  # Skip header
                    for row in reader:
                        if len(row) >= 3:
                            key = (row[0], row[1])  # (vector, ref_date)
                            existing_data[key] = row[2]  # value
            
            # Filter new data
            filtered_data = [row for row in all_data if self._should_include_vector(row[0])]
            
            # Update existing data with filtered new data
            for row in filtered_data:
                key = (row[0], row[1])
                existing_data[key] = row[2]
            
            # Convert back to list format and sort
            data = [(k[0], k[1], v) for k, v in existing_data.items()]
            data.sort(key=lambda x: (x[0], str(x[1])))
            
            print(f"  Updated {len(filtered_data)} vectors, total {len(data)} rows")
        else:
            data = all_data
        
        # Write CSV
        with open(output_path, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow(['vector', 'ref_date', 'value'])
            
            for row in data:
                writer.writerow(row)
        
        print(f"  Wrote {len(data)} rows to {output_path}")
        return {'status': 'success', 'rows': len(data), 'path': str(output_path)}
    
    def _export_metadata_csv(self) -> Dict[str, Any]:
        """
        Export metadata.csv file (with filtering if active).
        
        Returns:
            Export result with row count
        """
        filter_desc = ""
        if self._source_filter:
            filter_desc = f" (source: {self._source_filter})"
        elif self._page_filter:
            filter_desc = f" (page: {self._page_filter})"
        elif self._vector_pattern:
            filter_desc = f" (pattern: {self._vector_pattern})"
        
        print(f"\nExporting metadata.csv{filter_desc}...")
        
        output_path = self._get_output_path(
            self.config.export.get('files', {}).get('metadata_csv', 'metadata.csv')
        )
        
        # Ensure output directory exists
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Get metadata from database
        all_metadata = self.repo.get_export_metadata()
        
        # Apply filters if any
        if self._is_filtered_export():
            # For filtered exports, merge with existing metadata
            existing_metadata = {}
            if output_path.exists():
                with open(output_path, 'r', encoding='utf-8') as f:
                    reader = csv.reader(f)
                    next(reader)  # Skip header
                    for row in reader:
                        if len(row) >= 4:
                            existing_metadata[row[0]] = (row[1], row[2], row[3])
            
            # Filter new metadata
            filtered_metadata = [row for row in all_metadata if self._should_include_vector(row[0])]
            
            # Update existing with filtered new
            for row in filtered_metadata:
                existing_metadata[row[0]] = (row[1], row[2], row[3])
            
            # Convert back to list and sort
            metadata = [(k, v[0], v[1], v[2]) for k, v in existing_metadata.items()]
            metadata.sort(key=lambda x: x[0])
            
            print(f"  Updated {len(filtered_metadata)} vectors, total {len(metadata)} rows")
        else:
            metadata = all_metadata
        
        # Write CSV
        with open(output_path, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow(['vector', 'title', 'uom', 'scalar_factor'])
            
            for row in metadata:
                writer.writerow(row)
        
        print(f"  Wrote {len(metadata)} rows to {output_path}")
        return {'status': 'success', 'rows': len(metadata), 'path': str(output_path)}
    
    def _export_major_projects_csv(self) -> Dict[str, Any]:
        """
        Export major_projects_map.csv file.
        
        Returns:
            Export result with row count
        """
        print("\nExporting major_projects_map.csv...")
        
        output_path = self._get_output_path(
            self.config.export.get('files', {}).get('major_projects_csv', 'major_projects_map.csv')
        )
        
        # Ensure output directory exists
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Get projects from database
        projects = self.repo.get_major_projects_for_export()
        
        if not projects:
            print("  No major projects data available")
            return {'status': 'skipped', 'rows': 0, 'path': str(output_path)}
        
        # Write CSV
        headers = [
            'project_name', 'company', 'location', 'province', 
            'project_type', 'sub_type', 'estimated_cost', 'status',
            'latitude', 'longitude'
        ]
        
        with open(output_path, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=headers, extrasaction='ignore')
            writer.writeheader()
            
            for project in projects:
                writer.writerow(project)
        
        print(f"  Wrote {len(projects)} rows to {output_path}")
        return {'status': 'success', 'rows': len(projects), 'path': str(output_path)}


def export_website_files(
    config: Config, 
    db: DatabaseConnection,
    source: Optional[str] = None,
    vectors: Optional[str] = None,
    page: Optional[str] = None
) -> Dict[str, Any]:
    """
    Export website files with optional filtering.
    
    Args:
        config: Configuration instance
        db: Database connection instance
        source: Filter by data source (e.g., 'capital_expenditures')
        vectors: Filter by vector pattern (e.g., 'capex_*')
        page: Filter by page (e.g., 'Page24')
        
    Returns:
        Export results summary
    """
    exporter = WebsiteExporter(config, db)
    
    # Apply filters
    if source:
        exporter.set_source_filter(source)
    if vectors:
        exporter.set_vector_pattern(vectors)
    if page:
        exporter.set_page_filter(page)
    
    return exporter.export_all()
