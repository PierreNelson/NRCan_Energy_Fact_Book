"""
Resolve paths to pipeline Excel workbooks synced from SharePoint Manual Data.

Workbooks are downloaded to EXTERNAL_XLSX_DATA_DIR (see scripts/.env) before
handlers read them. Sync runs once per pipeline process via ensure_sharepoint_sync().
"""

from __future__ import annotations

import os
from pathlib import Path

ENV_KEY = "EXTERNAL_XLSX_DATA_DIR"


def _load_scripts_env() -> None:
    try:
        from dotenv import load_dotenv
    except ImportError:
        return
    env_path = Path(__file__).resolve().parent / ".env"
    if env_path.is_file():
        load_dotenv(env_path)


_load_scripts_env()


def repo_root() -> Path:
    return Path(__file__).resolve().parent.parent


def default_xlsx_base_dir() -> Path:
    """Local folder containing workbooks synced from SharePoint Manual Data."""
    from sharepoint.sync import ensure_sharepoint_sync

    return ensure_sharepoint_sync()


def resolve_root_xlsx(filename: str) -> Path:
    """Path to a workbook in the SharePoint sync cache."""
    return default_xlsx_base_dir() / filename
