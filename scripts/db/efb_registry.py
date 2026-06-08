"""
EFB indicator registry: transform dependencies and export vector prefixes.
"""

from __future__ import annotations

from pathlib import Path
from typing import Dict, List, Set

import yaml

from .eedas_registry import get_source_table, validate_sql_identifier

_REGISTRY_PATH = Path(__file__).resolve().parent / "efb_indicators_registry.yaml"
_indicators: Dict[str, Dict] | None = None


def _load_yaml() -> dict:
    if not _REGISTRY_PATH.is_file():
        raise FileNotFoundError(f"Missing registry file: {_REGISTRY_PATH}")
    with open(_REGISTRY_PATH, encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def load_indicators() -> Dict[str, Dict]:
    global _indicators
    if _indicators is None:
        doc = _load_yaml()
        raw = doc.get("indicators") or {}
        _indicators = {}
        for key, row in raw.items():
            if not isinstance(row, dict):
                continue
            depends = row.get("depends_on") or []
            for tbl in depends:
                validate_sql_identifier(str(tbl))
            _indicators[str(key)] = {
                "section_id": int(row.get("section_id", 0)),
                "depends_on": [str(t) for t in depends],
                "vector_prefixes": [str(p) for p in (row.get("vector_prefixes") or [])],
            }
    return _indicators


def get_indicator_config(indicator_key: str) -> Dict:
    indicators = load_indicators()
    if indicator_key not in indicators:
        raise KeyError(
            f"Unknown indicator_key: {indicator_key!r}. "
            f"Add it to scripts/db/efb_indicators_registry.yaml."
        )
    return indicators[indicator_key]


def indicator_keys_ordered() -> List[str]:
    """Return indicator keys sorted by section, with cross-table deps respected."""
    indicators = load_indicators()
    keys = list(indicators.keys())
    deps: Dict[str, Set[str]] = {k: set(indicators[k]["depends_on"]) for k in keys}

    # Map physical table -> source_key(s) that populate it via EEDAS update
    from .eedas_registry import load_source_tables

    table_sources: Dict[str, List[str]] = {}
    for source_key, row in load_source_tables().items():
        tbl = row["source_table"]
        table_sources.setdefault(tbl, []).append(source_key)

    # Indicator A runs after B if A needs a table whose primary source is B and B is also an indicator
    after: Dict[str, Set[str]] = {k: set() for k in keys}
    for ind_a in keys:
        for tbl in deps[ind_a]:
            for src in table_sources.get(tbl, []):
                if src in keys and src != ind_a:
                    after[ind_a].add(src)

    ordered: List[str] = []
    remaining = set(keys)
    while remaining:
        ready = sorted(k for k in remaining if not (after[k] - set(ordered)))
        if not ready:
            ordered.extend(sorted(remaining))
            break
        ordered.extend(ready)
        remaining -= set(ready)
    return ordered


def reset_cache() -> None:
    global _indicators
    _indicators = None
