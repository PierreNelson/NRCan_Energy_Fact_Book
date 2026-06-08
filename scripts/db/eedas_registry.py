"""
EEDAS-style table name resolution for the NRCan Energy Factbook SQL layer.

Physical per-source table names come from eedas_registry.yaml (source_key -> source_table).
EFB indicators live in nrcan_efb_indicators; export staging uses nrcan_fb_export.
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Dict, List, Set

import yaml

_IDENTIFIER_RE = re.compile(r"^[a-z][a-z0-9_]*$", re.IGNORECASE)

# EFB indicator output (populated by efb transform)
TABLE_EFB_INDICATORS = "nrcan_efb_indicators"

# Export staging (single wide table: series + attribution columns)
TABLE_EXPORT = "nrcan_fb_export"
TABLE_EXPORT_DATA = TABLE_EXPORT
TABLE_EXPORT_METADATA = TABLE_EXPORT

# System / integration
TABLE_DATA_SOURCES = "nrcan_fb_data_sources"
TABLE_RUN_HISTORY = "nrcan_fb_run_history"
TABLE_MAJOR_PROJECTS_MAP = "nrcan_fb_major_projects_map"

_REGISTRY_PATH = Path(__file__).resolve().parent / "eedas_registry.yaml"
_source_tables: Dict[str, Dict[str, str]] | None = None


def validate_sql_identifier(name: str) -> str:
    if not name or not _IDENTIFIER_RE.match(name):
        raise ValueError(f"Invalid SQL identifier: {name!r}")
    return name


def _load_yaml() -> Dict[str, Dict[str, Dict[str, str]]]:
    if not _REGISTRY_PATH.is_file():
        raise FileNotFoundError(f"Missing registry file: {_REGISTRY_PATH}")
    with open(_REGISTRY_PATH, encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def load_source_tables() -> Dict[str, Dict[str, str]]:
    global _source_tables
    if _source_tables is None:
        doc = _load_yaml()
        st = doc.get("source_tables") or {}
        _source_tables = {}
        for key, row in st.items():
            if not isinstance(row, dict):
                continue
            tbl = row.get("source_table")
            if not tbl:
                continue
            validate_sql_identifier(str(tbl))
            _source_tables[str(key)] = {"source_table": str(tbl)}
    return _source_tables


def get_source_table(source_key: str) -> str:
    st = load_source_tables()
    if source_key not in st:
        raise KeyError(
            f"Unknown source_key for EEDAS registry: {source_key!r}. "
            f"Add it to scripts/db/eedas_registry.yaml."
        )
    return validate_sql_identifier(st[source_key]["source_table"])


def unique_source_tables() -> List[str]:
    seen: Set[str] = set()
    out: List[str] = []
    for row in load_source_tables().values():
        t = row["source_table"]
        if t not in seen:
            seen.add(t)
            out.append(t)
    return sorted(out)


# Backward-compatible aliases (older call sites / docs)
get_ingest_table = get_source_table
unique_ingest_tables = unique_source_tables


def reset_cache() -> None:
    """Test hook: reload YAML on next access."""
    global _source_tables
    _source_tables = None
