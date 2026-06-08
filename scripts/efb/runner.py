"""
Orchestrate EFB transform runs across section processors.
"""

from __future__ import annotations

from typing import Any, Dict

from config_loader import Config
from db.connection import DatabaseConnection
from db.efb_registry import indicator_keys_ordered
from eedas.runner import SECTION_PROCESSORS, get_processors


def _processor_for_indicator(processors: dict, indicator_key: str):
    for processor in processors.values():
        if indicator_key in processor.get_transform_handlers():
            return processor
    return None


def run_efb_transform(
    config: Config,
    db: DatabaseConnection,
    *,
    all_indicators: bool = False,
    section_key: str | None = None,
    indicator_key: str | None = None,
) -> Dict[str, Any]:
    """Run EFB transform handlers."""
    processors = get_processors(config, db)
    results: Dict[str, Any] = {}

    if all_indicators:
        for ind in indicator_keys_ordered():
            processor = _processor_for_indicator(processors, ind)
            if processor is None:
                continue
            if not config.is_source_enabled(processor.SECTION_KEY, ind):
                continue
            print(f"\nEFB transform: {ind}")
            try:
                results[ind] = processor.transform_source(ind)
            except Exception as e:
                print(f"  ERROR: {e}")
                results[ind] = {'status': 'failed', 'error': str(e)}
    elif section_key:
        if section_key not in processors:
            raise ValueError(f"Section '{section_key}' not found or not enabled.")
        results[section_key] = processors[section_key].transform_all()
    elif indicator_key:
        processor = _processor_for_indicator(processors, indicator_key)
        if processor is None:
            raise ValueError(f"Indicator '{indicator_key}' not found.")
        if not config.is_source_enabled(processor.SECTION_KEY, indicator_key):
            raise ValueError(f"Indicator '{indicator_key}' is disabled in config.")
        print(f"\nEFB transform: {indicator_key}")
        results[indicator_key] = processor.transform_source(indicator_key)
    else:
        raise ValueError("Specify --all, --section, or --indicator")

    return results
