"""Page 74 — Canadian renewable electricity generating capacity (Manual Data gencap workbook)."""

from __future__ import annotations

import re
from typing import Dict, List, Optional, Tuple

import pandas as pd

from utils.io_retry import ensure_workbook, read_excel_with_retry, resolve_sheet_name, run_with_retry

from .constants import (
    RENEWABLE_ELECAP_GENCAP_SHEET,
    RENEWABLE_ELECAP_GENCAP_XLSX,
    RENEWABLE_ELECAP_METADATA,
    RENEWABLE_ELECAP_MIN_YEAR,
    RENEWABLE_ELECAP_SOURCE_TO_KEY,
)

SOURCE_KEY = 'renewable_electricity_capacity'
RAW_PREFIX = 'renele_raw'


def _normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df.columns = [re.sub(r"^['\"]|['\"]$", '', str(c).strip()) for c in df.columns]
    return df


def _parse_mw(value) -> Optional[float]:
    if pd.isna(value):
        return None
    if isinstance(value, str):
        stripped = value.strip()
        if stripped in ('', '-', '–', '—'):
            return None
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None
    if parsed < 0:
        return None
    return parsed


def _read_renewable_capacity_rows(config=None) -> List[Tuple[int, Dict[str, float]]]:
    def _load() -> List[Tuple[int, Dict[str, float]]]:
        path = ensure_workbook(RENEWABLE_ELECAP_GENCAP_XLSX, config=config)
        sheet = resolve_sheet_name(
            path,
            RENEWABLE_ELECAP_GENCAP_SHEET,
            label='renewable_electricity_capacity',
        )
        df = _normalize_columns(
            read_excel_with_retry(
                path,
                sheet,
                config=config,
                label=f'{RENEWABLE_ELECAP_GENCAP_XLSX} {sheet!r}',
                header=0,
            )
        )
        col_map = {str(c).lower().strip(): c for c in df.columns}
        required = ['year', 'source', 'value (mw)']
        missing = [name for name in required if name not in col_map]
        if missing:
            raise ValueError(
                f'renewable_electricity_capacity: missing columns {missing} in {path.name}'
            )

        year_col = col_map['year']
        source_col = col_map['source']
        value_col = col_map['value (mw)']

        by_year: Dict[int, Dict[str, float]] = {}
        skipped_rows: List[str] = []

        for _, record in df.iterrows():
            year_raw = record[year_col]
            try:
                year = int(float(year_raw))
            except (TypeError, ValueError):
                continue
            if year < RENEWABLE_ELECAP_MIN_YEAR:
                continue

            source = str(record[source_col]).strip().lower()
            key = RENEWABLE_ELECAP_SOURCE_TO_KEY.get(source)
            if not key:
                continue

            capacity = _parse_mw(record[value_col])
            if capacity is None:
                skipped_rows.append(f'{year}/{source}')
                continue

            by_year.setdefault(year, {})[key] = round(capacity, 1)

        expected_keys = set(RENEWABLE_ELECAP_SOURCE_TO_KEY.values())
        complete_rows: List[Tuple[int, Dict[str, float]]] = []
        incomplete_years: List[str] = []

        for year in sorted(by_year):
            values = by_year[year]
            if set(values.keys()) != expected_keys:
                missing_sources = sorted(expected_keys - set(values.keys()))
                incomplete_years.append(f'{year} (missing {", ".join(missing_sources)})')
                continue
            complete_rows.append((year, values))

        if skipped_rows:
            print(
                '    Warning: renewable_electricity_capacity skipped rows with invalid MW: '
                + ', '.join(skipped_rows[:12])
                + ('…' if len(skipped_rows) > 12 else '')
            )
        if incomplete_years:
            print(
                '    Warning: renewable_electricity_capacity skipped incomplete year(s): '
                + ', '.join(incomplete_years)
            )

        if not complete_rows:
            raise ValueError(
                'renewable_electricity_capacity: no publishable year rows found in ren_elecap sheet'
            )

        return complete_rows

    return run_with_retry(
        _load,
        config=config,
        label=f'{RENEWABLE_ELECAP_GENCAP_XLSX} renewable capacity load',
    )


def _raw_vector_for(key: str) -> str:
    return f'{RAW_PREFIX}_{key}'


def _indicator_vector_for(key: str) -> str:
    return f'ren_cap_{key}'


def _metadata_for(key: str) -> Tuple[str, str, str, str, str, str]:
    return next(row for row in RENEWABLE_ELECAP_METADATA if row[0] == _indicator_vector_for(key))


def update_renewable_electricity_capacity(processor) -> int:
    """EEDAS ingest: renewable capacity by source from gencap ren_elecap sheet."""
    rows = _read_renewable_capacity_rows(processor.config)
    data_rows: List[Tuple[str, str, float]] = []
    metadata_rows: List[Tuple[str, str, str, str, str, str]] = []

    for year, values in rows:
        for key, capacity in values.items():
            vector = _raw_vector_for(key)
            data_rows.append((vector, str(year), capacity))
            title, uom, scalar, org, url = _metadata_for(key)[1:]
            metadata_rows.append((vector, f'{title} (raw), {year}', uom, scalar, org, url))

    n = processor.replace_raw_data(SOURCE_KEY, data_rows, metadata_rows)
    print(f'    Stored {n} source-native rows for {SOURCE_KEY}')
    return n


def transform_renewable_electricity_capacity(processor) -> int:
    """EFB transform: ren_cap_* vectors for Page 74 stacked area chart."""
    df = processor.get_raw_dataframe(SOURCE_KEY)
    if df.empty:
        raise ValueError(
            f'{SOURCE_KEY} transform: no raw rows found — re-run eedas update --source {SOURCE_KEY}'
        )

    data_rows: List[Tuple[str, str, float]] = []
    metadata_rows: List[Tuple[str, str, str, str, str, str]] = []

    for _, row in df.iterrows():
        vector = str(row['vector'])
        if not vector.startswith(f'{RAW_PREFIX}_'):
            continue
        key = vector[len(f'{RAW_PREFIX}_'):]
        out_vector = _indicator_vector_for(key)
        ref_year = str(row['ref_date'])
        value = float(row['value'])
        data_rows.append((out_vector, ref_year, round(value, 1)))
        metadata_rows.append(_metadata_for(key))

    if not data_rows:
        raise ValueError(f'{SOURCE_KEY} transform: no indicator rows produced')

    n = processor.store_indicators(SOURCE_KEY, data_rows, metadata_rows)
    print(f'    Stored {n} indicator rows for {SOURCE_KEY}')
    return n


def build_renewable_electricity_capacity_indicator_rows(
    config=None,
) -> Tuple[List[Tuple[str, str, float]], List[Tuple[str, str, str, str, str, str]]]:
    """Build indicator rows without SQL (offline export / tests)."""
    rows = _read_renewable_capacity_rows(config)
    data_rows: List[Tuple[str, str, float]] = []
    metadata_rows: List[Tuple[str, str, str, str, str, str]] = []

    for year, values in rows:
        for key, capacity in values.items():
            vector = _indicator_vector_for(key)
            data_rows.append((vector, str(year), capacity))
            metadata_rows.append(_metadata_for(key))

    return data_rows, metadata_rows
