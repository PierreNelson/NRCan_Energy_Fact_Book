"""
Retry helpers for local workbook reads and SharePoint cache recovery.
"""

from __future__ import annotations

import time
import zipfile
from pathlib import Path
from typing import Any, Callable, Optional, TypeVar

import pandas as pd

from config_loader import get_config
from utils.http_retry import resilience_from_config

T = TypeVar('T')

# Transient failures when Excel is open elsewhere or a sync is mid-write.
EXCEL_RETRY_EXCEPTIONS = (
    PermissionError,
    OSError,
    zipfile.BadZipFile,
    ValueError,
)


def run_with_retry(
    fn: Callable[[], T],
    *,
    config=None,
    label: str = 'operation',
    retryable: tuple = EXCEL_RETRY_EXCEPTIONS,
) -> T:
    """Run fn with configured retries on transient local I/O errors."""
    cfg = config or get_config()
    max_r, delay = resilience_from_config(cfg)
    last_error: Optional[Exception] = None

    for attempt in range(max_r):
        try:
            if attempt > 0:
                wait = delay * attempt
                print(f'  Retrying {label} (attempt {attempt + 1}/{max_r}, wait {wait}s)...')
                time.sleep(wait)
            return fn()
        except retryable as exc:
            last_error = exc
            if attempt >= max_r - 1:
                break

    raise RuntimeError(f'{label} failed after {max_r} attempts: {last_error}') from last_error


def ensure_workbook(filename: str, *, config=None) -> Path:
    """
    Resolve a SharePoint-synced workbook, forcing re-sync when missing.

    Raises:
        FileNotFoundError: Workbook still absent after retries.
    """
    from sharepoint.sync import ensure_sharepoint_sync
    from xlsx_paths import resolve_root_xlsx

    cfg = config or get_config()
    max_r, delay = resilience_from_config(cfg)
    last_error: Optional[Exception] = None

    for attempt in range(max_r):
        if attempt > 0:
            wait = delay * attempt
            print(
                f'  Retrying SharePoint sync for {filename} '
                f'(attempt {attempt + 1}/{max_r}, wait {wait}s)...'
            )
            time.sleep(wait)

        ensure_sharepoint_sync(force=attempt > 0)
        path = resolve_root_xlsx(filename)
        if path.is_file() and path.stat().st_size > 0:
            return path
        from utils.log_sanitize import format_path_for_log
        last_error = FileNotFoundError(
            f'workbook not found or empty at {format_path_for_log(path)}'
        )

    raise FileNotFoundError(
        f'Could not load {filename} after {max_r} attempts: {last_error}'
    ) from last_error


def read_excel_with_retry(
    path: Path,
    sheet_name: str | int,
    *,
    config=None,
    label: Optional[str] = None,
    **read_kwargs: Any,
) -> pd.DataFrame:
    """Read an Excel sheet with retries on transient file errors."""
    op_label = label or f'Excel read {path.name} ({sheet_name!r})'

    def _read() -> pd.DataFrame:
        df = pd.read_excel(path, sheet_name=sheet_name, **read_kwargs)
        if df is None or df.empty:
            raise ValueError(f'{op_label}: sheet is empty')
        return df

    return run_with_retry(_read, config=config, label=op_label)


def resolve_sheet_name(path: Path, desired: str, *, label: str) -> str:
    """
    Match a sheet name case-insensitively, ignoring leading/trailing spaces.

    Raises:
        ValueError: No matching sheet in the workbook.
    """
    xl = pd.ExcelFile(path)
    target = desired.strip().lower()
    for name in xl.sheet_names:
        if name.strip().lower() == target:
            return name
    available = ', '.join(repr(n) for n in xl.sheet_names)
    raise ValueError(f'{label}: sheet {desired!r} not found; available: {available}')
