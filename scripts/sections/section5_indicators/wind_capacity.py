"""Wind capacity by province and largest wind projects (Manual Data Excel)."""

from __future__ import annotations

import re
from typing import List, Optional, Tuple

import pandas as pd

from utils.io_retry import ensure_workbook, read_excel_with_retry, resolve_sheet_name, run_with_retry

from .constants import (
    LARGEST_WIND_PROJECTS_SHEET,
    LARGEST_WIND_PROJECTS_XLSX,
    MIN_WIND_PROJECT_MW,
    WIND_CAPACITY_BY_PROV_METADATA,
    WIND_CAPACITY_GENCAP_SHEET,
    WIND_CAPACITY_GENCAP_XLSX,
    WIND_LOCATION_TO_KEY,
    WIND_PROJECT_PROV_TO_KEY,
)

SOURCE_KEY_PROV = 'wind_capacity_by_province'
SOURCE_KEY_PROJECTS = 'largest_wind_projects'

RAW_PROV_PREFIX = 'prov_cap'
RAW_PROJ_PREFIX = 'proj_cap'


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


def _read_province_capacity_rows(config=None) -> Tuple[int, List[Tuple[str, float]]]:
    def _load() -> Tuple[int, List[Tuple[str, float]]]:
        path = ensure_workbook(WIND_CAPACITY_GENCAP_XLSX, config=config)
        sheet = resolve_sheet_name(
            path,
            WIND_CAPACITY_GENCAP_SHEET,
            label='wind_capacity_by_province',
        )
        df = _normalize_columns(
            read_excel_with_retry(
                path,
                sheet,
                config=config,
                label=f'{WIND_CAPACITY_GENCAP_XLSX} {sheet!r}',
                header=0,
            )
        )
        col_map = {str(c).lower().strip(): c for c in df.columns}
        required = ['year', 'source', 'location', 'value (mw)']
        missing = [name for name in required if name not in col_map]
        if missing:
            raise ValueError(
                f'wind_capacity_by_province: missing columns {missing} in {path.name}'
            )

        year_col = col_map['year']
        source_col = col_map['source']
        location_col = col_map['location']
        value_col = col_map['value (mw)']

        wind = df[df[source_col].astype(str).str.lower().str.strip() == 'wind'].copy()
        wind = wind[wind[location_col].astype(str).str.strip() != 'Canada']
        if wind.empty:
            raise ValueError('wind_capacity_by_province: no wind rows found in gencap sheet')

        ref_year = int(wind[year_col].max())
        latest = wind[wind[year_col] == ref_year].copy()
        rows: List[Tuple[str, float]] = []
        unknown_locations: List[str] = []

        for _, record in latest.iterrows():
            location = str(record[location_col]).strip()
            key = WIND_LOCATION_TO_KEY.get(location)
            if not key:
                if location and location not in unknown_locations:
                    unknown_locations.append(location)
                continue
            capacity = _parse_mw(record[value_col])
            if capacity is None or capacity <= 0:
                continue
            rows.append((key, round(capacity, 1)))

        if unknown_locations:
            print(
                '    Warning: wind_capacity_by_province ignored unknown locations: '
                + ', '.join(unknown_locations)
            )

        if not rows:
            raise ValueError(
                f'wind_capacity_by_province: no publishable province rows for {ref_year}'
            )

        rows.sort(key=lambda item: item[1], reverse=True)
        return ref_year, rows

    return run_with_retry(
        _load,
        config=config,
        label=f'{WIND_CAPACITY_GENCAP_XLSX} province capacity load',
    )


def _read_largest_wind_projects(config=None) -> List[Tuple[str, str, float]]:
    def _load() -> List[Tuple[str, str, float]]:
        path = ensure_workbook(LARGEST_WIND_PROJECTS_XLSX, config=config)
        sheet = resolve_sheet_name(
            path,
            LARGEST_WIND_PROJECTS_SHEET,
            label='largest_wind_projects',
        )
        df = _normalize_columns(
            read_excel_with_retry(
                path,
                sheet,
                config=config,
                label=f'{LARGEST_WIND_PROJECTS_XLSX} {sheet!r}',
                header=0,
            )
        )
        prov_col = next((c for c in df.columns if str(c).lower().strip() == 'province'), None)
        facility_col = next((c for c in df.columns if str(c).lower().strip() == 'facility'), None)
        cap_col = next((c for c in df.columns if 'capacity' in str(c).lower()), None)
        if not prov_col or not facility_col or not cap_col:
            raise ValueError(
                f'largest_wind_projects: expected province, facility, and capacity columns '
                f'in {path.name} (found {df.columns.tolist()})'
            )

        rows: List[Tuple[str, str, float]] = []
        skipped_provinces: List[str] = []

        for _, record in df.iterrows():
            capacity = _parse_mw(record[cap_col])
            if capacity is None or capacity < MIN_WIND_PROJECT_MW:
                continue
            prov = str(record[prov_col]).strip().upper()
            prov_key = WIND_PROJECT_PROV_TO_KEY.get(prov)
            if not prov_key:
                if prov and prov not in skipped_provinces:
                    skipped_provinces.append(prov)
                continue
            facility = str(record[facility_col]).strip()
            if not facility:
                continue
            rows.append((prov_key, facility, round(capacity, 1)))

        if skipped_provinces:
            print(
                '    Warning: largest_wind_projects ignored unknown province codes: '
                + ', '.join(skipped_provinces)
            )

        if not rows:
            raise ValueError(
                f'largest_wind_projects: no projects >= {MIN_WIND_PROJECT_MW} MW found in {path.name}'
            )

        rows.sort(key=lambda item: item[2], reverse=True)
        return rows

    return run_with_retry(
        _load,
        config=config,
        label=f'{LARGEST_WIND_PROJECTS_XLSX} projects load',
    )


def update_wind_capacity_by_province(processor) -> int:
    """EEDAS ingest: wind capacity by province from gencap workbook."""
    ref_year, provinces = _read_province_capacity_rows(processor.config)
    data_rows = [(f'{RAW_PROV_PREFIX}_{key}', str(ref_year), capacity) for key, capacity in provinces]
    metadata_rows = [
        (f'{RAW_PROV_PREFIX}_{key}', f'Wind capacity, {label}', 'MW', 'megawatts', 'Natural Resources Canada', '')
        for key, label in WIND_CAPACITY_BY_PROV_METADATA
        if any(row_key == key for row_key, _ in provinces)
    ]
    n = processor.replace_raw_data(SOURCE_KEY_PROV, data_rows, metadata_rows)
    print(f'    Stored {n} source-native rows for {SOURCE_KEY_PROV} ({ref_year})')
    return n


def transform_wind_capacity_by_province(processor) -> int:
    """EFB transform: wind_cap_* province capacity vectors."""
    df = processor.get_raw_dataframe(SOURCE_KEY_PROV)
    if df.empty:
        raise ValueError(
            f'{SOURCE_KEY_PROV} transform: no raw rows found — re-run eedas update --source {SOURCE_KEY_PROV}'
        )

    data_rows: List[Tuple[str, str, float]] = []
    metadata_rows = []
    for _, row in df.iterrows():
        vector = str(row['vector'])
        if not vector.startswith(f'{RAW_PROV_PREFIX}_'):
            continue
        key = vector[len(f'{RAW_PROV_PREFIX}_'):]
        ref_year = str(row['ref_date'])
        value = float(row['value'])
        out_vector = f'wind_cap_{key}'
        data_rows.append((out_vector, ref_year, value))
        label = next((lbl for k, lbl in WIND_CAPACITY_BY_PROV_METADATA if k == key), key)
        metadata_rows.append((out_vector, f'Wind capacity, {label}', 'MW', 'megawatts', 'Natural Resources Canada', ''))

    if not data_rows:
        raise ValueError(f'{SOURCE_KEY_PROV} transform: no indicator rows produced')

    n = processor.store_indicators(SOURCE_KEY_PROV, data_rows, metadata_rows)
    print(f'    Stored {n} indicator rows for {SOURCE_KEY_PROV}')
    return n


def update_largest_wind_projects(processor) -> int:
    """EEDAS ingest: largest wind projects from Manual Data workbook."""
    ref_year, _ = _read_province_capacity_rows(processor.config)
    projects = _read_largest_wind_projects(processor.config)
    data_rows: List[Tuple[str, str, float]] = []
    metadata_rows = []
    for index, (prov_key, facility, capacity) in enumerate(projects, start=1):
        idx = f'{index:02d}'
        data_rows.append((f'{RAW_PROJ_PREFIX}_{idx}_mw', str(ref_year), capacity))
        data_rows.append((f'{RAW_PROJ_PREFIX}_{idx}_prov', str(ref_year), float(_prov_key_to_code(prov_key))))
        metadata_rows.append((f'{RAW_PROJ_PREFIX}_{idx}_mw', facility, 'MW', 'megawatts', 'Natural Resources Canada', ''))
        metadata_rows.append((f'{RAW_PROJ_PREFIX}_{idx}_prov', f'{facility} province code', 'Code', 'code', 'Natural Resources Canada', ''))

    n = processor.replace_raw_data(SOURCE_KEY_PROJECTS, data_rows, metadata_rows)
    print(f'    Stored {n} source-native rows for {SOURCE_KEY_PROJECTS} ({ref_year})')
    return n


def _prov_key_to_code(prov_key: str) -> int:
    try:
        return {'ab': 1, 'qc': 2, 'on': 3, 'sk': 4}[prov_key]
    except KeyError as exc:
        raise ValueError(f'largest_wind_projects: unknown province key {prov_key!r}') from exc


def transform_largest_wind_projects(processor) -> int:
    """EFB transform: wind_proj_* vectors for this indicator projects chart."""
    df = processor.get_raw_dataframe(SOURCE_KEY_PROJECTS)
    if df.empty:
        raise ValueError(
            f'{SOURCE_KEY_PROJECTS} transform: no raw rows found — re-run eedas update --source {SOURCE_KEY_PROJECTS}'
        )

    data_rows: List[Tuple[str, str, float]] = []
    metadata_rows = []
    for _, row in df.iterrows():
        vector = str(row['vector'])
        if not vector.startswith(f'{RAW_PROJ_PREFIX}_'):
            continue
        suffix = vector[len(f'{RAW_PROJ_PREFIX}_'):]
        ref_year = str(row['ref_date'])
        value = float(row['value'])
        out_vector = f'wind_proj_{suffix}'
        data_rows.append((out_vector, ref_year, value))
        title = str(row.get('title') or out_vector)
        unit = 'MW' if suffix.endswith('_mw') else 'Code'
        scalar = 'megawatts' if suffix.endswith('_mw') else 'code'
        metadata_rows.append((out_vector, title, unit, scalar, 'Natural Resources Canada', ''))

    if not data_rows:
        raise ValueError(f'{SOURCE_KEY_PROJECTS} transform: no indicator rows produced')

    n = processor.store_indicators(SOURCE_KEY_PROJECTS, data_rows, metadata_rows)
    print(f'    Stored {n} indicator rows for {SOURCE_KEY_PROJECTS}')
    return n


def build_wind_page81_indicator_rows(
    config=None,
) -> Tuple[List[Tuple[str, str, float]], List[Tuple[str, str, str, str, str, str]]]:
    """Build indicator rows without SQL (offline export / tests)."""
    ref_year, provinces = _read_province_capacity_rows(config)
    projects = _read_largest_wind_projects(config)

    data_rows: List[Tuple[str, str, float]] = []
    metadata_rows: List[Tuple[str, str, str, str, str, str]] = []

    for key, capacity in provinces:
        vector = f'wind_cap_{key}'
        data_rows.append((vector, str(ref_year), capacity))
        label = next((lbl for k, lbl in WIND_CAPACITY_BY_PROV_METADATA if k == key), key)
        metadata_rows.append((vector, f'Wind capacity, {label}', 'MW', 'megawatts', 'Natural Resources Canada', ''))

    for index, (prov_key, facility, capacity) in enumerate(projects, start=1):
        idx = f'{index:02d}'
        mw_vector = f'wind_proj_{idx}_mw'
        prov_vector = f'wind_proj_{idx}_prov'
        data_rows.append((mw_vector, str(ref_year), capacity))
        data_rows.append((prov_vector, str(ref_year), float(_prov_key_to_code(prov_key))))
        metadata_rows.append((mw_vector, facility, 'MW', 'megawatts', 'Natural Resources Canada', ''))
        metadata_rows.append((prov_vector, f'{facility} province code', 'Code', 'code', 'Natural Resources Canada', ''))

    return data_rows, metadata_rows
