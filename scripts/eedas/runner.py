"""
Orchestrate EEDAS update runs across section processors.
"""

from __future__ import annotations

from typing import Any, Dict

from config_loader import Config
from db.connection import DatabaseConnection
from sections import (
    Section1Indicators,
    Section2Investment,
    Section4Indicators,
    Section5CleanPower,
    Section6OilGas,
)

SECTION_PROCESSORS = {
    'section1_indicators': Section1Indicators,
    'section2_indicators': Section2Investment,
    'section4_indicators': Section4Indicators,
    'section5_indicators': Section5CleanPower,
    'section6_indicators': Section6OilGas,
}


def get_processors(config: Config, db: DatabaseConnection) -> dict:
    out = {}
    for key, cls in SECTION_PROCESSORS.items():
        if config.is_section_enabled(key):
            out[key] = cls(config, db)
    return out


def run_eedas_update(
    config: Config,
    db: DatabaseConnection,
    *,
    all_sections: bool = False,
    section_key: str | None = None,
    source_key: str | None = None,
) -> Dict[str, Any]:
    """Run EEDAS ingest handlers."""
    processors = get_processors(config, db)
    results: Dict[str, Any] = {}

    if all_sections:
        for sk, processor in processors.items():
            print(f"\n{'=' * 40}")
            print(f"Section: {processor.SECTION_NAME}")
            print(f"{'=' * 40}")
            results[sk] = processor.update_all()
    elif section_key:
        if section_key not in processors:
            raise ValueError(f"Section '{section_key}' not found or not enabled.")
        results[section_key] = processors[section_key].update_all()
    elif source_key:
        found = False
        for sk, processor in processors.items():
            if source_key in processor.get_update_handlers():
                if not config.is_source_enabled(sk, source_key):
                    raise ValueError(f"Source '{source_key}' is disabled in config.")
                print(f"\nEEDAS update: {source_key}")
                results[source_key] = processor.update_source(source_key)
                found = True
                break
        if not found:
            raise ValueError(f"Source '{source_key}' not found.")
    else:
        raise ValueError("Specify --all, --section, or --source")

    return results
