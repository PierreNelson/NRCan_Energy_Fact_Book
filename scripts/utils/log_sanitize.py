"""Redact machine- and user-specific paths from log output."""

from __future__ import annotations

import re
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parent.parent.parent


def repo_root() -> Path:
    return _REPO_ROOT


def sanitize_log_text(text: str) -> str:
    if not text:
        return text
    # Windows user profile directories
    text = re.sub(r'[A-Za-z]:\\Users\\[^\\<>|:"/]+\\', r'<user-home>\\', text)
    # macOS / Linux home directories
    text = re.sub(r'/Users/[^/]+/', '/<user-home>/', text)
    text = re.sub(r'/home/[^/]+/', '/<user-home>/', text)
    # External SharePoint sync folder (any drive / parent path)
    text = re.sub(
        r'[^\\/\s]*NRCan_Energy_Factbook_data(?:[^\\/\s]*)?',
        '<EXTERNAL_XLSX_DATA_DIR>',
        text,
    )
    return text


def format_path_for_log(path: Path | str, *, base: Path | None = None) -> str:
    """Prefer repo-relative paths; external cache paths are redacted."""
    p = Path(path)
    root = base or repo_root()
    try:
        resolved = p.resolve()
        rel = resolved.relative_to(root.resolve())
        return sanitize_log_text(str(rel).replace('\\', '/'))
    except (OSError, ValueError):
        pass
    if p.suffix.lower() in {'.xlsx', '.xlsm', '.xls', '.csv'}:
        return sanitize_log_text(f'<EXTERNAL_XLSX_DATA_DIR>/{p.name}')
    return sanitize_log_text('<EXTERNAL_XLSX_DATA_DIR>')
