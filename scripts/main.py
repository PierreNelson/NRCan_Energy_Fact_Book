#!/usr/bin/env python3
"""
NRCan Energy Factbook Data Pipeline CLI

Main entry point for refreshing data and generating website files.

Usage:
    # Refresh all data and export
    python main.py refresh --all
    
    # Refresh specific section
    python main.py refresh --section section1_indicators
    
    # Refresh specific data source
    python main.py refresh --source capital_expenditures
    
    # Export only (from existing database data)
    python main.py export
    
    # List available sections and sources
    python main.py list
    
    # Test database connection
    python main.py test-connection
"""

import argparse
import sys
import os
from pathlib import Path
from datetime import datetime

# Add scripts directory to path for imports
SCRIPT_DIR = Path(__file__).parent
sys.path.insert(0, str(SCRIPT_DIR))

from config_loader import get_config, Config
from db.connection import get_connection, DatabaseConnection
from db.models import DataRepository
from sections import Section1Indicators, Section2Investment
from export.website_files import export_website_files


# Section class registry
SECTION_PROCESSORS = {
    'section1_indicators': Section1Indicators,
    'section2_investment': Section2Investment,
}


def setup_logging(config: Config):
    """Configure logging based on config settings."""
    import logging
    
    log_config = config.logging
    level_name = log_config.get('level', 'INFO')
    level = getattr(logging, level_name, logging.INFO)
    
    logging.basicConfig(
        level=level,
        format=log_config.get('format', '%(asctime)s - %(levelname)s - %(message)s')
    )


def get_all_processors(config: Config, db: DatabaseConnection) -> dict:
    """Get instances of all enabled section processors."""
    processors = {}
    
    for section_key, processor_class in SECTION_PROCESSORS.items():
        if config.is_section_enabled(section_key):
            processors[section_key] = processor_class(config, db)
    
    return processors


def cmd_refresh(args, config: Config, db: DatabaseConnection):
    """Handle the refresh command."""
    print("=" * 60)
    print("NRCan Energy Factbook - Data Refresh")
    print(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)
    
    processors = get_all_processors(config, db)
    results = {}
    
    if args.all:
        # Refresh all enabled sections
        print("\nRefreshing all enabled sections...")
        for section_key, processor in processors.items():
            print(f"\n{'='*40}")
            print(f"Section: {processor.SECTION_NAME}")
            print(f"{'='*40}")
            results[section_key] = processor.refresh_all()
    
    elif args.section:
        # Refresh specific section
        section_key = args.section
        if section_key not in processors:
            print(f"Error: Section '{section_key}' not found or not enabled.")
            print(f"Available sections: {list(processors.keys())}")
            return 1
        
        print(f"\nRefreshing section: {section_key}")
        processor = processors[section_key]
        results[section_key] = processor.refresh_all()
    
    elif args.source:
        # Refresh specific source
        source_key = args.source
        found = False
        
        for section_key, processor in processors.items():
            handlers = processor.get_source_handlers()
            if source_key in handlers:
                if config.is_source_enabled(section_key, source_key):
                    print(f"\nRefreshing source: {source_key}")
                    result = processor.refresh_source(source_key)
                    results[source_key] = result
                    found = True
                    break
                else:
                    print(f"Error: Source '{source_key}' is disabled in config.")
                    return 1
        
        if not found:
            print(f"Error: Source '{source_key}' not found.")
            # List available sources
            print("\nAvailable sources:")
            for section_key, processor in processors.items():
                handlers = processor.get_source_handlers()
                for src in handlers.keys():
                    status = "enabled" if config.is_source_enabled(section_key, src) else "disabled"
                    print(f"  - {src} ({status})")
            return 1
    
    else:
        print("Error: Please specify --all, --section, or --source")
        return 1
    
    # Print summary
    print("\n" + "=" * 60)
    print("Refresh Summary")
    print("=" * 60)
    for key, result in results.items():
        if isinstance(result, dict):
            if 'status' in result:
                print(f"  {key}: {result.get('status')} ({result.get('rows', 0)} rows)")
            else:
                for sub_key, sub_result in result.items():
                    status = sub_result.get('status', 'unknown')
                    rows = sub_result.get('rows', 0)
                    print(f"  {sub_key}: {status} ({rows} rows)")
    
    # Auto-export if requested
    if args.export_after:
        print("\n" + "=" * 60)
        print("Exporting website files...")
        export_results = export_website_files(config, db)
        print("\nExport Summary:")
        for key, result in export_results.items():
            print(f"  {key}: {result.get('status')} ({result.get('rows', 0)} rows)")
    
    print(f"\nCompleted at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    return 0


def cmd_export(args, config: Config, db: DatabaseConnection):
    """Handle the export command."""
    print("=" * 60)
    print("NRCan Energy Factbook - Export Website Files")
    print(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)
    
    # Check for filter options
    source_filter = getattr(args, 'source', None)
    vectors_filter = getattr(args, 'vectors', None)
    page_filter = getattr(args, 'page', None)
    
    if source_filter or vectors_filter or page_filter:
        print("\nSelective export mode:")
    
    try:
        results = export_website_files(
            config, db,
            source=source_filter,
            vectors=vectors_filter,
            page=page_filter
        )
    except ValueError as e:
        print(f"\nError: {e}")
        return 1
    
    print("\n" + "=" * 60)
    print("Export Summary")
    print("=" * 60)
    for key, result in results.items():
        path = result.get('path', '')
        status = result.get('status', 'unknown')
        rows = result.get('rows', 0)
        reason = result.get('reason', '')
        
        if reason:
            print(f"  {key}: {status} ({reason})")
        else:
            print(f"  {key}: {status} ({rows} rows)")
        if path:
            print(f"    -> {path}")
    
    print(f"\nCompleted at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    return 0


def cmd_list(args, config: Config, db: DatabaseConnection):
    """Handle the list command."""
    from export.page_vectors import get_all_pages, get_vectors_for_page, SOURCE_VECTOR_PREFIXES
    
    print("=" * 60)
    print("NRCan Energy Factbook - Available Sections and Sources")
    print("=" * 60)
    
    for section_key, section_config in config.sections.items():
        enabled = section_config.get('enabled', False)
        name = section_config.get('name', section_key)
        status = "ENABLED" if enabled else "disabled"
        
        print(f"\n{name} ({section_key}) [{status}]")
        print("-" * 40)
        
        sources = section_config.get('sources', {})
        for source_key, source_config in sources.items():
            src_enabled = source_config.get('enabled', False)
            src_status = "ENABLED" if src_enabled else "disabled"
            description = source_config.get('description', '')
            prefixes = SOURCE_VECTOR_PREFIXES.get(source_key, [])
            
            print(f"  {source_key} [{src_status}]")
            if prefixes:
                print(f"    Vectors: {', '.join(prefixes)}*")
            if description:
                print(f"    {description}")
    
    # List pages
    print("\n" + "=" * 60)
    print("Available Pages for Export Filtering")
    print("=" * 60)
    
    pages = get_all_pages()
    for page in pages:
        prefixes = get_vectors_for_page(page)
        print(f"  {page}: {', '.join(prefixes)}*")
    
    return 0


def cmd_test_connection(args, config: Config, db: DatabaseConnection):
    """Handle the test-connection command."""
    print("=" * 60)
    print("NRCan Energy Factbook - Test Database Connection")
    print("=" * 60)
    
    print(f"\nServer: {db.server}")
    print(f"Database: {db.database}")
    print(f"Driver: {db.driver}")
    print(f"Using: {'SQL Server Authentication' if db.username else 'Windows Authentication'}")
    
    print("\nTesting connection...")
    
    if db.test_connection():
        print("SUCCESS: Database connection successful!")
        
        # Try to count data sources
        try:
            repo = DataRepository(db)
            sources = repo.get_enabled_sources()
            print(f"\nFound {len(sources)} enabled data sources in database.")
        except Exception as e:
            print(f"\nNote: Could not query data sources table: {e}")
            print("The database may need to be initialized with setup_database.sql")
        
        return 0
    else:
        print("FAILED: Could not connect to database.")
        print("\nTroubleshooting:")
        print("1. Ensure SQL Server is running")
        print("2. Check the config.yaml settings")
        print("3. Verify credentials (or use DB_USERNAME/DB_PASSWORD env vars)")
        print("4. Run setup_database.sql to create the database")
        return 1


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description='NRCan Energy Factbook Data Pipeline',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
Examples:
  python main.py refresh --all              Refresh all data sources
  python main.py refresh --section section2_investment  Refresh one section
  python main.py refresh --source capital_expenditures  Refresh one source
  python main.py refresh --all --export-after           Refresh and export
  
  python main.py export                     Export all website files
  python main.py export --source capex      Export only capital expenditures
  python main.py export --vectors "cea_*"   Export vectors matching pattern
  python main.py export --page Page24       Export only Page24 data
  
  python main.py list                       List available sections/sources
  python main.py test-connection            Test database connection
        '''
    )
    
    parser.add_argument(
        '--config', '-c',
        help='Path to config.yaml (default: scripts/config.yaml)'
    )
    
    subparsers = parser.add_subparsers(dest='command', help='Command to run')
    
    # Refresh command
    refresh_parser = subparsers.add_parser('refresh', help='Refresh data from sources')
    refresh_group = refresh_parser.add_mutually_exclusive_group()
    refresh_group.add_argument(
        '--all', '-a',
        action='store_true',
        help='Refresh all enabled sections'
    )
    refresh_group.add_argument(
        '--section', '-s',
        help='Refresh a specific section (e.g., section1_indicators)'
    )
    refresh_group.add_argument(
        '--source', '-r',
        help='Refresh a specific data source (e.g., capital_expenditures)'
    )
    refresh_parser.add_argument(
        '--export-after', '-e',
        action='store_true',
        help='Export website files after refresh'
    )
    
    # Export command
    export_parser = subparsers.add_parser('export', help='Export website files from database')
    export_parser.add_argument(
        '--source', '-s',
        help='Export only vectors from a specific data source (e.g., capital_expenditures)'
    )
    export_parser.add_argument(
        '--vectors', '-v',
        help='Export only vectors matching a pattern (e.g., "capex_*", "*_total")'
    )
    export_parser.add_argument(
        '--page', '-p',
        help='Export only vectors used by a specific page (e.g., Page24, page24)'
    )
    
    # List command
    list_parser = subparsers.add_parser('list', help='List available sections and sources')
    
    # Test connection command
    test_parser = subparsers.add_parser('test-connection', help='Test database connection')
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return 1
    
    # Load configuration
    try:
        config = get_config(args.config)
    except FileNotFoundError as e:
        print(f"Error: {e}")
        return 1
    
    # Setup logging
    setup_logging(config)
    
    # Initialize database connection
    try:
        db = get_connection(config.database)
    except Exception as e:
        print(f"Error initializing database connection: {e}")
        print("\nMake sure SQL Server is running and config.yaml is correct.")
        return 1
    
    # Route to command handler
    commands = {
        'refresh': cmd_refresh,
        'export': cmd_export,
        'list': cmd_list,
        'test-connection': cmd_test_connection,
    }
    
    handler = commands.get(args.command)
    if handler:
        return handler(args, config, db)
    else:
        parser.print_help()
        return 1


if __name__ == '__main__':
    sys.exit(main())
