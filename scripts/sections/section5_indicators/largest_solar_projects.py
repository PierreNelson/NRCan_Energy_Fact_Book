"""Largest solar projects (Manual Data Excel, solprojects sheet)."""

from __future__ import annotations

import re
from typing import List, Optional, Tuple

import pandas as pd

from utils.io_retry import ensure_workbook, read_excel_with_retry, resolve_sheet_name, run_with_retry

from .constants import (
    LARGEST_SOLAR_PROJECTS_SHEET,
    LARGEST_SOLAR_PROJECTS_XLSX,
    MIN_SOLAR_PROJECT_MW,
    SOLAR_PROJECT_PROV_TO_KEY,
)
from .wind_capacity import _read_province_capacity_rows

SOURCE_KEY = 'largest_solar_projects'
RAW_PROJ_PREFIX = 'solar_raw_proj'


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


def _read_largest_solar_projects(config=None) -> List[Tuple[str, str, float]]:
    def _load() -> List[Tuple[str, str, float]]:
        path = ensure_workbook(LARGEST_SOLAR_PROJECTS_XLSX, config=config)
        sheet = resolve_sheet_name(
            path,
            LARGEST_SOLAR_PROJECTS_SHEET,
            label='largest_solar_projects',
        )
        df = _normalize_columns(
            read_excel_with_retry(
                path,
                sheet,
                config=config,
                label=f'{LARGEST_SOLAR_PROJECTS_XLSX} {sheet!r}',
                header=0,
            )
        )
        prov_col = next((c for c in df.columns if str(c).lower().strip() == 'province'), None)
        facility_col = next((c for c in df.columns if str(c).lower().strip() == 'facility'), None)
        cap_col = next((c for c in df.columns if 'capacity' in str(c).lower()), None)
        if not prov_col or not facility_col or not cap_col:
            raise ValueError(
                f'largest_solar_projects: expected province, facility, and capacity columns '
                f'in {path.name} (found {df.columns.tolist()})'
            )

        rows: List[Tuple[str, str, float]] = []
        skipped_provinces: List[str] = []

        for _, record in df.iterrows():
            capacity = _parse_mw(record[cap_col])
            if capacity is None or capacity < MIN_SOLAR_PROJECT_MW:
                continue
            prov = str(record[prov_col]).strip().upper()
            if not prov or prov == 'NAN':
                continue
            prov_key = SOLAR_PROJECT_PROV_TO_KEY.get(prov)
            if not prov_key:
                if prov not in skipped_provinces:
                    skipped_provinces.append(prov)
                continue
            facility = str(record[facility_col]).strip()
            if not facility:
                continue
            rows.append((prov_key, facility, round(capacity, 1)))

        if skipped_provinces:
            print(
                '    Warning: largest_solar_projects ignored unknown province codes: '
                + ', '.join(skipped_provinces)
            )

        if not rows:
            raise ValueError(
                f'largest_solar_projects: no projects >= {MIN_SOLAR_PROJECT_MW} MW found in {path.name}'
            )

        rows.sort(key=lambda item: item[2], reverse=True)
        return rows

    return run_with_retry(
        _load,
        config=config,
        label=f'{LARGEST_SOLAR_PROJECTS_XLSX} projects load',
    )


def _prov_key_to_code(prov_key: str) -> int:
    try:
        return {'ab': 1, 'on': 2}[prov_key]
    except KeyError as exc:
        raise ValueError(f'largest_solar_projects: unknown province key {prov_key!r}') from exc


def update_largest_solar_projects(processor) -> int:
    """EEDAS ingest: largest solar projects from Manual Data workbook."""
    ref_year, _ = _read_province_capacity_rows(processor.config)
    projects = _read_largest_solar_projects(processor.config)
    data_rows: List[Tuple[str, str, float]] = []
    metadata_rows = []
    for index, (prov_key, facility, capacity) in enumerate(projects, start=1):
        idx = f'{index:02d}'
        data_rows.append((f'{RAW_PROJ_PREFIX}_{idx}_mw', str(ref_year), capacity))
        data_rows.append((f'{RAW_PROJ_PREFIX}_{idx}_prov', str(ref_year), float(_prov_key_to_code(prov_key))))
        metadata_rows.append((f'{RAW_PROJ_PREFIX}_{idx}_mw', facility, 'MW', 'megawatts', 'Natural Resources Canada', ''))
        metadata_rows.append((f'{RAW_PROJ_PREFIX}_{idx}_prov', f'{facility} province code', 'Code', 'code', 'Natural Resources Canada', ''))

    n = processor.replace_raw_data(SOURCE_KEY, data_rows, metadata_rows)
    print(f'    Stored {n} source-native rows for {SOURCE_KEY} ({ref_year})')
    return n


def transform_largest_solar_projects(processor) -> int:
    """EFB transform: solar_proj_* vectors for this indicator."""
    df = processor.get_raw_dataframe(SOURCE_KEY)
    if df.empty:
        raise ValueError(
            f'{SOURCE_KEY} transform: no raw rows found — re-run eedas update --source {SOURCE_KEY}'
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
        out_vector = f'solar_proj_{suffix}'
        data_rows.append((out_vector, ref_year, value))
        title = str(row.get('title') or out_vector)
        unit = 'MW' if suffix.endswith('_mw') else 'Code'
        scalar = 'megawatts' if suffix.endswith('_mw') else 'code'
        metadata_rows.append((out_vector, title, unit, scalar, 'Natural Resources Canada', ''))

    if not data_rows:
        raise ValueError(f'{SOURCE_KEY} transform: no indicator rows produced')

    n = processor.store_indicators(SOURCE_KEY, data_rows, metadata_rows)
    print(f'    Stored {n} indicator rows for {SOURCE_KEY}')
    return n
