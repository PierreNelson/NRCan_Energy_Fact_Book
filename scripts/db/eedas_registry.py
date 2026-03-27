"""
EEDAS-style table name resolution for the NRCan Energy Factbook SQL layer.

Physical raw/ingest table names come from eedas_registry.yaml (source_key -> pair).
Calc, export, and system tables use fixed identifiers below.
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Dict, List, Set, Tuple

import yaml

_IDENTIFIER_RE = re.compile(r"^[a-z][a-z0-9_]*$", re.IGNORECASE)

# Calculated (section-scoped)
TABLE_CALC_ECONOMIC_CONTRIBUTIONS = "nrcan_fb_s1_economic_contributions"
TABLE_CALC_PROVINCIAL_GDP = "nrcan_fb_s1_provincial_gdp"
TABLE_CALC_WORLD_ENERGY_PRODUCTION = "nrcan_fb_s1_world_energy_production"
TABLE_CALC_CAPITAL_EXPENDITURES = "nrcan_fb_s2_capital_expenditures"
TABLE_CALC_INFRASTRUCTURE = "nrcan_fb_s2_infrastructure"
TABLE_CALC_INTERNATIONAL_INVESTMENT = "nrcan_fb_s2_international_investment"
TABLE_CALC_ENVIRONMENTAL_PROTECTION = "nrcan_fb_s2_environmental_protection"
TABLE_CALC_CLEAN_TECH = "nrcan_fb_s2_clean_tech"
TABLE_CALC_ENERGY_USE = "nrcan_fb_s4_energy_use"

# Export
TABLE_EXPORT_DATA = "nrcan_fb_export_data"
TABLE_EXPORT_METADATA = "nrcan_fb_export_metadata"

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
        for key, pair in st.items():
            if not isinstance(pair, dict):
                continue
            dt = pair.get("data_table")
            mt = pair.get("metadata_table")
            if not dt or not mt:
                continue
            validate_sql_identifier(dt)
            validate_sql_identifier(mt)
            _source_tables[str(key)] = {"data_table": dt, "metadata_table": mt}
    return _source_tables


def get_raw_tables(source_key: str) -> Tuple[str, str]:
    st = load_source_tables()
    if source_key not in st:
        raise KeyError(
            f"Unknown source_key for EEDAS registry: {source_key!r}. "
            f"Add it to scripts/db/eedas_registry.yaml."
        )
    pair = st[source_key]
    return validate_sql_identifier(pair["data_table"]), validate_sql_identifier(pair["metadata_table"])


def unique_raw_data_tables() -> List[str]:
    seen: Set[str] = set()
    out: List[str] = []
    for pair in load_source_tables().values():
        t = pair["data_table"]
        if t not in seen:
            seen.add(t)
            out.append(t)
    return sorted(out)


def unique_raw_metadata_tables() -> List[str]:
    seen: Set[str] = set()
    out: List[str] = []
    for pair in load_source_tables().values():
        t = pair["metadata_table"]
        if t not in seen:
            seen.add(t)
            out.append(t)
    return sorted(out)


def reset_cache() -> None:
    """Test hook: reload YAML on next access."""
    global _source_tables
    _source_tables = None
