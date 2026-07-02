"""Canadian and provincial electricity generation by source (gencap workbook)."""

from __future__ import annotations

import re
from typing import Dict, List, Optional, Tuple

import pandas as pd

from utils.io_retry import ensure_workbook, read_excel_with_retry, resolve_sheet_name, run_with_retry

from .constants import (
    ELECTRICITY_GENERATION_CAN_SHEET,
    ELECTRICITY_GENERATION_CAN_SOURCE_TO_KEY,
    ELECTRICITY_GENERATION_GENCAP_XLSX,
    ELECTRICITY_GENERATION_LOCATION_TO_KEY,
    ELECTRICITY_GENERATION_METADATA,
    ELECTRICITY_GENERATION_PROV_SHEET,
    ELECTRICITY_GENERATION_PROV_SOURCE_TO_KEY,
    ELECTRICITY_GENERATION_SOURCE_ORG,
    ELECTRICITY_GENERATION_SOURCE_URL,
)

SOURCE_KEY = 'electricity_generation_by_source'
RAW_CAN_PREFIX = 'elegen_raw_can'
RAW_PROV_PREFIX = 'elegen_raw_prov'


def _normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df.columns = [re.sub(r"^['\"]|['\"]$", '', str(c).strip()) for c in df.columns]
    return df


def _parse_share(value) -> Optional[float]:
    if pd.isna(value):
        return None
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None
    if parsed < 0:
        return None
    return parsed


def _parse_twh(value) -> Optional[float]:
    if pd.isna(value):
        return None
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None
    if parsed <= 0:
        return None
    return round(parsed, 1)


def _share_to_pct(share: float) -> float:
    return round(share * 100, 1)


def _read_canada_rows(config=None) -> List[Tuple[int, str, float, Optional[float]]]:
    def _load() -> List[Tuple[int, str, float, Optional[float]]]:
        path = ensure_workbook(ELECTRICITY_GENERATION_GENCAP_XLSX, config=config)
        sheet = resolve_sheet_name(
            path,
            ELECTRICITY_GENERATION_CAN_SHEET,
            label='electricity_generation_by_source canada',
        )
        df = _normalize_columns(
            read_excel_with_retry(
                path,
                sheet,
                config=config,
                label=f'{ELECTRICITY_GENERATION_GENCAP_XLSX} {sheet!r}',
                header=0,
            )
        )
        col_map = {str(c).lower().strip(): c for c in df.columns}
        required = ['year', 'source', 'share (%)', 'value (twh)']
        missing = [name for name in required if name not in col_map]
        if missing:
            raise ValueError(
                f'electricity_generation_by_source: missing columns {missing} in {path.name} sheet {sheet!r}'
            )

        year_col = col_map['year']
        source_col = col_map['source']
        share_col = col_map['share (%)']
        twh_col = col_map['value (twh)']

        rows: List[Tuple[int, str, float, Optional[float]]] = []
        for _, record in df.iterrows():
            try:
                year = int(float(record[year_col]))
            except (TypeError, ValueError):
                continue
            source = str(record[source_col]).strip().lower()
            key = ELECTRICITY_GENERATION_CAN_SOURCE_TO_KEY.get(source)
            if not key:
                continue
            share = _parse_share(record[share_col])
            if share is None:
                continue
            twh = _parse_twh(record[twh_col]) if key == 'total' else None
            rows.append((year, key, share, twh))
        if not rows:
            raise ValueError('electricity_generation_by_source: no canada sheet rows found')
        return rows

    return run_with_retry(
        _load,
        config=config,
        label=f'{ELECTRICITY_GENERATION_GENCAP_XLSX} canada generation load',
    )


def _read_provincial_rows(config=None) -> List[Tuple[int, str, str, float]]:
    def _load() -> List[Tuple[int, str, str, float]]:
        path = ensure_workbook(ELECTRICITY_GENERATION_GENCAP_XLSX, config=config)
        sheet = resolve_sheet_name(
            path,
            ELECTRICITY_GENERATION_PROV_SHEET,
            label='electricity_generation_by_source provincial',
        )
        df = _normalize_columns(
            read_excel_with_retry(
                path,
                sheet,
                config=config,
                label=f'{ELECTRICITY_GENERATION_GENCAP_XLSX} {sheet!r}',
                header=0,
            )
        )
        col_map = {str(c).lower().strip(): c for c in df.columns}
        required = ['year', 'source', 'location', 'share (%)']
        missing = [name for name in required if name not in col_map]
        if missing:
            raise ValueError(
                f'electricity_generation_by_source: missing columns {missing} in {path.name} sheet {sheet!r}'
            )

        year_col = col_map['year']
        source_col = col_map['source']
        location_col = col_map['location']
        share_col = col_map['share (%)']

        rows: List[Tuple[int, str, str, float]] = []
        for _, record in df.iterrows():
            try:
                year = int(float(record[year_col]))
            except (TypeError, ValueError):
                continue
            source = str(record[source_col]).strip().lower()
            source_key = ELECTRICITY_GENERATION_PROV_SOURCE_TO_KEY.get(source)
            if not source_key:
                continue
            location = str(record[location_col]).strip()
            loc_key = ELECTRICITY_GENERATION_LOCATION_TO_KEY.get(location)
            if not loc_key:
                continue
            share = _parse_share(record[share_col])
            if share is None:
                continue
            rows.append((year, source_key, loc_key, share))
        if not rows:
            raise ValueError('electricity_generation_by_source: no provincial sheet rows found')
        return rows

    return run_with_retry(
        _load,
        config=config,
        label=f'{ELECTRICITY_GENERATION_GENCAP_XLSX} provincial generation load',
    )


def _indicator_vector(source_key: str, loc_key: str) -> str:
    return f'elegen_prov_{source_key}_{loc_key}_pct'


def _canada_indicator_vector(source_key: str) -> str:
    return f'elegen_can_{source_key}_pct'


def update_electricity_generation_by_source(processor) -> int:
    """EEDAS ingest: src_elegen_can and src_elegen_prov rows."""
    data_rows: List[Tuple[str, str, float]] = []
    metadata_rows: List[Tuple[str, str, str, str, str, str]] = []

    for year, source_key, share, twh in _read_canada_rows(processor.config):
        year_str = str(year)
        share_vec = f'{RAW_CAN_PREFIX}_{source_key}_share'
        data_rows.append((share_vec, year_str, share))
        metadata_rows.append((
            share_vec,
            f'Canada electricity generation share — {source_key} (raw)',
            'Share',
            'decimal',
            ELECTRICITY_GENERATION_SOURCE_ORG,
            ELECTRICITY_GENERATION_SOURCE_URL,
        ))
        if twh is not None:
            twh_vec = f'{RAW_CAN_PREFIX}_total_twh'
            data_rows.append((twh_vec, year_str, twh))
            metadata_rows.append((
                twh_vec,
                'Canada total electricity generation (raw TWh)',
                'TWh',
                'terawatt hours',
                ELECTRICITY_GENERATION_SOURCE_ORG,
                ELECTRICITY_GENERATION_SOURCE_URL,
            ))

    for year, source_key, loc_key, share in _read_provincial_rows(processor.config):
        raw_vec = f'{RAW_PROV_PREFIX}_{source_key}_{loc_key}_share'
        data_rows.append((raw_vec, str(year), share))
        metadata_rows.append((
            raw_vec,
            f'Provincial electricity generation share — {source_key}/{loc_key} (raw)',
            'Share',
            'decimal',
            ELECTRICITY_GENERATION_SOURCE_ORG,
            ELECTRICITY_GENERATION_SOURCE_URL,
        ))

    if not data_rows:
        print('    No electricity_generation_by_source raw rows produced')
        return 0

    n = processor.replace_raw_data(SOURCE_KEY, data_rows, metadata_rows)
    print(f'    Stored {n} source-native rows for {SOURCE_KEY}')
    return n


def transform_electricity_generation_by_source(processor) -> int:
    """EFB transform: elegen_can_* and elegen_prov_* vectors for Canadian and provincial generation."""
    df = processor.get_raw_dataframe(SOURCE_KEY)
    if df.empty:
        raise ValueError(
            f'{SOURCE_KEY} transform: no raw rows found — re-run eedas update --source {SOURCE_KEY}'
        )

    data_rows: List[Tuple[str, str, float]] = []
    metadata_rows: List[Tuple[str, str, str, str, str, str]] = list(ELECTRICITY_GENERATION_METADATA)

    for _, row in df.iterrows():
        vector = str(row['vector'])
        ref_year = str(row['ref_date'])
        try:
            value = float(row['value'])
        except (TypeError, ValueError):
            continue

        if vector.startswith(f'{RAW_CAN_PREFIX}_') and vector.endswith('_share'):
            source_key = vector[len(RAW_CAN_PREFIX) + 1:-len('_share')]
            if source_key == 'total':
                continue
            out_vec = _canada_indicator_vector(source_key)
            data_rows.append((out_vec, ref_year, _share_to_pct(value)))
        elif vector == f'{RAW_CAN_PREFIX}_total_twh':
            data_rows.append(('elegen_can_total_twh', ref_year, value))
        elif vector.startswith(f'{RAW_PROV_PREFIX}_') and vector.endswith('_share'):
            body = vector[len(RAW_PROV_PREFIX) + 1:-len('_share')]
            parts = body.rsplit('_', 1)
            if len(parts) != 2:
                continue
            source_key, loc_key = parts
            out_vec = _indicator_vector(source_key, loc_key)
            data_rows.append((out_vec, ref_year, _share_to_pct(value)))

    if not data_rows:
        raise ValueError(f'{SOURCE_KEY} transform: no indicator rows produced')

    n = processor.store_indicators(SOURCE_KEY, data_rows, metadata_rows)
    print(f'    Stored {n} indicator rows for {SOURCE_KEY}')
    return n


def build_electricity_generation_indicator_rows(
    config=None,
) -> Tuple[List[Tuple[str, str, float]], List[Tuple[str, str, str, str, str, str]]]:
    """Build indicator rows without SQL (offline export / tests)."""
    data_rows: List[Tuple[str, str, float]] = []

    for year, source_key, share, twh in _read_canada_rows(config):
        year_str = str(year)
        if source_key != 'total':
            data_rows.append((_canada_indicator_vector(source_key), year_str, _share_to_pct(share)))
        if twh is not None:
            data_rows.append(('elegen_can_total_twh', year_str, twh))

    for year, source_key, loc_key, share in _read_provincial_rows(config):
        data_rows.append((_indicator_vector(source_key, loc_key), str(year), _share_to_pct(share)))

    return data_rows, list(ELECTRICITY_GENERATION_METADATA)
