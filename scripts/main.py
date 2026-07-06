#!/usr/bin/env python3
"""
NRCan Energy Factbook Data Pipeline CLI

Three-stage workflow:
  1. python main.py eedas update --all     Load source-native data into EEDAS
  2. python main.py efb transform --all    Build Factbook indicators
  3. python main.py export                   Write website CSV files

Usage:
    python main.py eedas update --all
    python main.py eedas update --source capital_expenditures
    python main.py efb transform --all
    python main.py efb transform --indicator capital_expenditures
    python main.py export
    python main.py status
    python main.py list
    python main.py test-connection
"""

import argparse
import json
import sys
from pathlib import Path
from datetime import datetime

SCRIPT_DIR = Path(__file__).parent
sys.path.insert(0, str(SCRIPT_DIR))

from config_loader import get_config, Config
from db.connection import get_connection, DatabaseConnection
from db.models import DataRepository
from db.ensure_schema import ensure_database_schema
from eedas.runner import run_eedas_update
from efb.runner import run_efb_transform
from export.website_files import export_website_files
from export.safe_io import restore_latest_backups, list_backups

_log_file_handle = None
_original_stdout = None
_original_stderr = None


class _Tee:
    def __init__(self, stream, log_file):
        self._stream = stream
        self._log_file = log_file

    def write(self, data):
        from utils.log_sanitize import sanitize_log_text

        sanitized = sanitize_log_text(data)
        self._stream.write(sanitized)
        self._log_file.write(sanitized)

    def flush(self):
        self._stream.flush()
        self._log_file.flush()

    def fileno(self):
        return self._stream.fileno()

    def isatty(self):
        return getattr(self._stream, 'isatty', lambda: False)()


def setup_logging(config: Config, command: str | None = None) -> Path | None:
    import logging

    global _log_file_handle, _original_stdout, _original_stderr

    log_config = config.logging
    level_name = log_config.get('level', 'INFO')
    level = getattr(logging, level_name, logging.INFO)
    fmt = log_config.get('format', '%(asctime)s - %(levelname)s - %(message)s')

    file_cfg = log_config.get('file', {})
    if not file_cfg.get('enabled', True):
        logging.basicConfig(level=level, format=fmt, force=True)
        return None

    log_dir = SCRIPT_DIR / file_cfg.get('directory', 'logs')
    log_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    cmd_label = (command or 'pipeline').replace('-', '_').replace(' ', '_')
    log_path = log_dir / f"{cmd_label}_{timestamp}.log"

    _log_file_handle = open(log_path, 'w', encoding='utf-8')
    _original_stdout = sys.stdout
    _original_stderr = sys.stderr
    sys.stdout = _Tee(_original_stdout, _log_file_handle)
    sys.stderr = _Tee(_original_stderr, _log_file_handle)

    logging.basicConfig(level=level, format=fmt, force=True)

    from utils.log_sanitize import sanitize_log_text

    class _SanitizeLogFilter(logging.Filter):
        def filter(self, record: logging.LogRecord) -> bool:
            record.msg = sanitize_log_text(str(record.getMessage()))
            record.args = ()
            return True

    logging.getLogger().addFilter(_SanitizeLogFilter())

    try:
        log_display = log_path.relative_to(SCRIPT_DIR.parent).as_posix()
    except ValueError:
        from utils.log_sanitize import format_path_for_log
        log_display = format_path_for_log(log_path)
    print(f"Log file: {log_display}")
    return log_path


def teardown_logging() -> None:
    global _log_file_handle, _original_stdout, _original_stderr

    if _original_stdout is not None:
        sys.stdout = _original_stdout
        _original_stdout = None
    if _original_stderr is not None:
        sys.stderr = _original_stderr
        _original_stderr = None
    if _log_file_handle is not None:
        _log_file_handle.close()
        _log_file_handle = None


def flatten_results(results: dict) -> list[tuple[str, dict]]:
    flat = []
    for _key, result in results.items():
        if not isinstance(result, dict):
            continue
        if 'status' in result:
            flat.append((_key, result))
        else:
            for sub_key, sub_result in result.items():
                if isinstance(sub_result, dict):
                    flat.append((sub_key, sub_result))
    return flat


def get_failures(results: dict) -> list[tuple[str, dict]]:
    return [
        (key, result)
        for key, result in flatten_results(results)
        if result.get('status') == 'failed'
    ]


def print_failure_summary(failures: list[tuple[str, dict]]) -> None:
    print("\n" + "=" * 60)
    print("Failure Summary")
    print("=" * 60)
    for key, result in failures:
        print(f"  {key}: FAILED")
        print(f"    {result.get('error', 'unknown error')}")
    print("\nReview details: python main.py status --failed-only")


def write_run_summary(config: Config, command: str, results: dict, failures: list, exit_code: int) -> Path:
    log_dir = SCRIPT_DIR / config.logging.get('file', {}).get('directory', 'logs')
    log_dir.mkdir(parents=True, exist_ok=True)
    summary_path = log_dir / 'last_refresh_summary.json'

    payload = {
        'command': command,
        'completed_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        'exit_code': exit_code,
        'failed_count': len(failures),
        'failed_sources': [
            {'source_key': k, 'error': r.get('error', '')} for k, r in failures
        ],
        'results': results,
    }
    with open(summary_path, 'w', encoding='utf-8') as f:
        json.dump(payload, f, indent=2, default=str)
    print(f"\nRun summary written to: {summary_path.relative_to(SCRIPT_DIR.parent).as_posix()}")
    return summary_path


def print_result_summary(results: dict) -> None:
    for key, result in results.items():
        if isinstance(result, dict):
            if 'status' in result:
                print(f"  {key}: {result.get('status')} ({result.get('rows', 0)} rows)")
            else:
                for sub_key, sub_result in result.items():
                    print(
                        f"  {sub_key}: {sub_result.get('status', 'unknown')} "
                        f"({sub_result.get('rows', 0)} rows)"
                    )


def cmd_sharepoint_sync(args, config: Config):
    from sharepoint.sync import sync_manual_data_folder, cache_dir

    print("=" * 60)
    print("SharePoint sync — Manual Data workbooks")
    print(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    try:
        result = sync_manual_data_folder(force=args.force)
    except Exception as exc:
        print(f"\nSharePoint sync failed: {exc}")
        return 1

    print(f"\nStatus: {result.get('status')}")
    from utils.log_sanitize import format_path_for_log
    print(f"Cache: {format_path_for_log(result.get('cache_dir', cache_dir()))}")
    downloaded = result.get("downloaded") or []
    if downloaded:
        print(f"Downloaded ({len(downloaded)}):")
        for name in downloaded:
            print(f"  - {name}")
    else:
        print("No new downloads (cache up to date).")

    cache = Path(result.get("cache_dir", cache_dir()))
    files = sorted(p.name for p in cache.iterdir() if p.is_file())
    if files:
        print(f"\nFiles in cache ({len(files)}):")
        for name in files:
            print(f"  - {name}")
    return 0


def cmd_eedas_update(args, config: Config, db: DatabaseConnection):
    print("=" * 60)
    print("EEDAS Update — load source-native data")
    print(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    try:
        from sharepoint.sync import ensure_sharepoint_sync

        print("Syncing SharePoint Manual Data workbooks...")
        ensure_sharepoint_sync()
        print()
    except Exception as exc:
        print(f"\nError: SharePoint sync failed: {exc}")
        return 1

    if not args.skip_ensure_schema:
        try:
            ensure_database_schema(db)
        except RuntimeError as e:
            print(f"\nError: {e}")
            return 1

    try:
        results = run_eedas_update(
            config,
            db,
            all_sections=args.all,
            section_key=args.section,
            source_key=args.source,
        )
    except ValueError as e:
        print(f"\nError: {e}")
        return 1

    print("\n" + "=" * 60)
    print("EEDAS Update Summary")
    print("=" * 60)
    print_result_summary(results)

    failures = get_failures(results)
    exit_code = 1 if failures else 0
    if failures:
        print_failure_summary(failures)
    write_run_summary(config, 'eedas update', results, failures, exit_code)
    print(f"\nCompleted at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    return exit_code


def cmd_efb_transform(args, config: Config, db: DatabaseConnection):
    print("=" * 60)
    print("EFB Transform — build Factbook indicators")
    print(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    if not args.skip_ensure_schema:
        try:
            ensure_database_schema(db)
        except RuntimeError as e:
            print(f"\nError: {e}")
            return 1

    try:
        results = run_efb_transform(
            config,
            db,
            all_indicators=args.all,
            section_key=args.section,
            indicator_key=args.indicator,
        )
    except ValueError as e:
        print(f"\nError: {e}")
        return 1

    print("\n" + "=" * 60)
    print("EFB Transform Summary")
    print("=" * 60)
    print_result_summary(results)

    failures = get_failures(results)
    exit_code = 1 if failures else 0
    if failures:
        print_failure_summary(failures)
    write_run_summary(config, 'efb transform', results, failures, exit_code)
    print(f"\nCompleted at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    return exit_code


def cmd_export(args, config: Config, db: DatabaseConnection):
    print("=" * 60)
    print("NRCan Energy Factbook - Export Website Files")
    print(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    if getattr(args, 'list_backups', False):
        backups = list_backups(config)
        print("\nAvailable export backups:")
        if not any(backups.values()):
            print("  (no backups found)")
        else:
            for key, entries in backups.items():
                print(f"\n  {key}:")
                for entry in entries:
                    print(f"    {entry['modified']}  {entry['name']}  ({entry['size_bytes']} bytes)")
        return 0

    if getattr(args, 'restore_latest', False):
        results = restore_latest_backups(config)
        if 'error' in results:
            print(f"\nError: {results['error'].get('reason', 'restore failed')}")
            return 1
        for key, result in results.items():
            status = result.get('status', 'unknown')
            if status == 'restored':
                print(f"  {key}: restored -> {result.get('path')}")
            else:
                print(f"  {key}: {status} ({result.get('reason', '')})")
        return 0

    source_filter = getattr(args, 'source', None)
    vectors_filter = getattr(args, 'vectors', None)

    try:
        results = export_website_files(config, db, source=source_filter, vectors=vectors_filter)
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


def cmd_status(args, config: Config, db: DatabaseConnection):
    hours = getattr(args, 'hours', 24)
    failed_only = getattr(args, 'failed_only', False)

    print("=" * 60)
    print("NRCan Energy Factbook - Pipeline Status")
    print(f"Window: last {hours} hour(s)")
    print("=" * 60)

    repo = DataRepository(db)
    try:
        rows = repo.get_recent_run_history(hours=hours, failed_only=failed_only)
    except Exception as e:
        print(f"\nError querying run history: {e}")
        return 1

    if not rows:
        label = "failed runs" if failed_only else "runs"
        print(f"\nNo {label} in the last {hours} hour(s).")
    else:
        for row in rows:
            error = row.get('error_message') or ''
            if error and len(error) > 120:
                error = error[:117] + '...'
            print(
                f"  {row.get('source_key', '')} [{row.get('run_type', '')}] "
                f"{row.get('status', '')} @ {row.get('started_at', '')} "
                f"({row.get('rows_affected', '')} rows)"
            )
            if error:
                print(f"    {error}")

    if not failed_only:
        try:
            last_success = repo.get_last_successful_refresh_per_source()
            if last_success:
                print("\nLast successful EEDAS update per source:")
                for row in last_success:
                    print(f"  {row.get('source_key', '')}: {row.get('last_success', '')}")
        except Exception as e:
            print(f"\nNote: Could not query last successful update: {e}")

    return 0


def cmd_list(args, config: Config):
    from export.source_vectors import SOURCE_VECTOR_PREFIXES

    print("=" * 60)
    print("NRCan Energy Factbook - Sections and Sources")
    print("=" * 60)
    print("\nWorkflow: eedas update -> efb transform -> export\n")

    for section_key, section_config in config.sections.items():
        enabled = section_config.get('enabled', False)
        name = section_config.get('name', section_key)
        status = "ENABLED" if enabled else "disabled"
        print(f"\n{name} ({section_key}) [{status}]")
        print("-" * 40)
        for source_key, source_config in section_config.get('sources', {}).items():
            src_enabled = source_config.get('enabled', False)
            src_status = "ENABLED" if src_enabled else "disabled"
            prefixes = SOURCE_VECTOR_PREFIXES.get(source_key, [])
            print(f"  {source_key} [{src_status}]")
            if prefixes:
                print(f"    Vectors: {', '.join(prefixes)}*")
    return 0


def cmd_test_connection(args, config: Config, db: DatabaseConnection):
    print("=" * 60)
    print("NRCan Energy Factbook - Test Database Connection")
    print("=" * 60)
    print(f"\nServer: {db.server}")
    print(f"Database: {db.database}")

    if db.test_connection():
        print("\nSUCCESS: Database connection successful!")
        try:
            repo = DataRepository(db)
            sources = repo.get_enabled_sources()
            print(f"Found {len(sources)} enabled data sources in database.")
        except Exception as e:
            print(f"Note: Could not query data sources: {e}")
        print("\nNext steps:")
        print("  python main.py eedas update --all")
        print("  python main.py efb transform --all")
        print("  python main.py export")
        return 0
    print("FAILED: Could not connect to database.")
    return 1


def main():
    parser = argparse.ArgumentParser(
        description='NRCan Energy Factbook Data Pipeline',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python main.py eedas update --all
  python main.py eedas update --source capital_expenditures
  python main.py efb transform --all
  python main.py efb transform --indicator capital_expenditures
  python main.py export
  python main.py sharepoint sync
  python main.py status --failed-only
  python main.py list
  python main.py inventory
        """,
    )
    parser.add_argument('--config', '-c', help='Path to config.yaml')
    subparsers = parser.add_subparsers(dest='command', help='Command to run')

    eedas_parser = subparsers.add_parser('eedas', help='EEDAS standalone data ingest')
    eedas_sub = eedas_parser.add_subparsers(dest='eedas_command')
    eedas_update = eedas_sub.add_parser('update', help='Download and load raw source data')
    eedas_group = eedas_update.add_mutually_exclusive_group(required=True)
    eedas_group.add_argument('--all', '-a', action='store_true', help='Update all enabled sources')
    eedas_group.add_argument('--section', '-s', help='Update one section')
    eedas_group.add_argument('--source', '-r', help='Update one source')
    eedas_update.add_argument('--skip-ensure-schema', action='store_true')

    sharepoint_parser = subparsers.add_parser('sharepoint', help='SharePoint manual-data sync')
    sharepoint_sub = sharepoint_parser.add_subparsers(dest='sharepoint_command')
    sp_sync = sharepoint_sub.add_parser('sync', help='Download Manual Data Excel files from SharePoint')
    sp_sync.add_argument('--force', action='store_true', help='Re-download all files')

    efb_parser = subparsers.add_parser('efb', help='EFB indicator transform')
    efb_sub = efb_parser.add_subparsers(dest='efb_command')
    efb_transform = efb_sub.add_parser('transform', help='Build indicators from EEDAS raw data')
    efb_group = efb_transform.add_mutually_exclusive_group(required=True)
    efb_group.add_argument('--all', '-a', action='store_true', help='Transform all indicators')
    efb_group.add_argument('--section', '-s', help='Transform one section')
    efb_group.add_argument('--indicator', '-i', help='Transform one indicator')
    efb_transform.add_argument('--skip-ensure-schema', action='store_true')

    export_parser = subparsers.add_parser('export', help='Export website files from database')
    export_parser.add_argument('--source', '-s', help='Export vectors from one indicator/source')
    export_parser.add_argument('--vectors', '-v', help='Export vectors matching pattern')
    export_parser.add_argument('--restore-latest', action='store_true')
    export_parser.add_argument('--list-backups', action='store_true')

    status_parser = subparsers.add_parser('status', help='Recent run history')
    status_parser.add_argument('--hours', type=int, default=24)
    status_parser.add_argument('--failed-only', action='store_true')

    subparsers.add_parser('list', help='List sections and sources')
    subparsers.add_parser('test-connection', help='Test database connection')

    inventory_parser = subparsers.add_parser('inventory', help='Generate page coverage inventory (CSV + Markdown)')
    inventory_parser.add_argument('--csv', help='Output CSV path (default: docs/page_inventory.csv)')
    inventory_parser.add_argument('--md', help='Output Markdown path (default: docs/page_inventory.md)')
    inventory_parser.add_argument('--audit', action='store_true', help='Also write docs/page_inventory_audit.md')

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return 1

    try:
        config = get_config(args.config)
    except FileNotFoundError as e:
        print(f"Error: {e}")
        return 1

    setup_logging(config, command=args.command)

    try:
        if args.command == 'list':
            return cmd_list(args, config)

        if args.command == 'inventory':
            from page_inventory import main as inventory_main
            inv_argv = []
            if getattr(args, 'csv', None):
                inv_argv.extend(['--csv', args.csv])
            if getattr(args, 'md', None):
                inv_argv.extend(['--md', args.md])
            code = inventory_main(inv_argv)
            if getattr(args, 'audit', False):
                from page_inventory_audit import main as audit_main
                audit_code = audit_main([])
                return code or audit_code
            return code

        if args.command == 'sharepoint':
            if args.sharepoint_command != 'sync':
                print("Usage: python main.py sharepoint sync [--force]")
                return 1
            return cmd_sharepoint_sync(args, config)

        try:
            db = get_connection(config.database)
        except Exception as e:
            print(f"Error initializing database connection: {e}")
            return 1

        if args.command == 'eedas':
            if args.eedas_command != 'update':
                print("Usage: python main.py eedas update --all|--section|--source")
                return 1
            return cmd_eedas_update(args, config, db)

        if args.command == 'efb':
            if args.efb_command != 'transform':
                print("Usage: python main.py efb transform --all|--section|--indicator")
                return 1
            return cmd_efb_transform(args, config, db)

        handlers = {
            'export': cmd_export,
            'status': cmd_status,
            'test-connection': cmd_test_connection,
        }
        handler = handlers.get(args.command)
        if handler:
            return handler(args, config, db)

        parser.print_help()
        return 1
    finally:
        teardown_logging()


if __name__ == '__main__':
    sys.exit(main())
