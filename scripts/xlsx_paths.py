"""
Resolve paths to local Excel workbooks (CEA, IEA, ECCC, OEE companions, TSX listing).

Set EXTERNAL_XLSX_DATA_DIR in scripts/.env to a folder containing those files.
If unset, paths fall back to the repository root (legacy).
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
    """Base directory for default-named workbooks: EXTERNAL_XLSX_DATA_DIR if set, else repo root."""
    raw = os.environ.get(ENV_KEY, "").strip()
    if not raw:
        return repo_root()
    p = Path(raw)
    if not p.is_absolute():
        p = (repo_root() / raw).resolve()
    return p


def resolve_root_xlsx(filename: str) -> Path:
    """Path to a workbook that used to live at repo root."""
    return default_xlsx_base_dir() / filename
