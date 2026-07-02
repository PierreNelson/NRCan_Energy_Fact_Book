"""Major hydro facilities in Canada (Manual Data Excel, hydrofac sheet)."""

from __future__ import annotations

import re
from typing import List, Optional, Tuple

import pandas as pd

from utils.io_retry import ensure_workbook, read_excel_with_retry, resolve_sheet_name, run_with_retry

from .constants import (
    GENCAP_REN_ELEGEN_SHEET,
    GENCAP_REN_ELEGEN_XLSX,
    HYDRO_FAC_PROV_TO_CODE,
    HYDRO_FAC_PROV_TO_KEY,
    LARGEST_HYDRO_FACILITIES_SHEET,
    LARGEST_HYDRO_FACILITIES_XLSX,
    MIN_HYDRO_FAC_MW,
    RENEWABLE_ELECAP_GENCAP_SHEET,
    RENEWABLE_ELECAP_GENCAP_XLSX,
)

SOURCE_KEY = 'major_hydro_facilities'
RAW_PREFIX = 'hydro_raw_fac'


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


def _read_hydro_reference_year(config=None) -> int:
    def _load() -> int:
        path = ensure_workbook(RENEWABLE_ELECAP_GENCAP_XLSX, config=config)
        sheet = resolve_sheet_name(
            path,
            RENEWABLE_ELECAP_GENCAP_SHEET,
            label='major_hydro_facilities ren_elecap',
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
        year_col = col_map.get('year')
        source_col = col_map.get('source')
        if not year_col or not source_col:
            raise ValueError(f'major_hydro_facilities: missing ren_elecap columns in {path.name}')

        hydro = df[df[source_col].astype(str).str.strip().str.lower() == 'hydro']
        if hydro.empty:
            raise ValueError('major_hydro_facilities: no hydro rows in ren_elecap')
        return int(hydro[year_col].max())

    return run_with_retry(
        _load,
        config=config,
        label=f'{RENEWABLE_ELECAP_GENCAP_XLSX} hydro reference year',
    )


def _read_major_hydro_facilities(config=None) -> List[Tuple[str, str, float]]:
    def _load() -> List[Tuple[str, str, float]]:
        path = ensure_workbook(LARGEST_HYDRO_FACILITIES_XLSX, config=config)
        sheet = resolve_sheet_name(
            path,
            LARGEST_HYDRO_FACILITIES_SHEET,
            label='major_hydro_facilities',
        )
        df = _normalize_columns(
            read_excel_with_retry(
                path,
                sheet,
                config=config,
                label=f'{LARGEST_HYDRO_FACILITIES_XLSX} {sheet!r}',
                header=0,
            )
        )
        prov_col = next((c for c in df.columns if str(c).lower().strip() == 'province'), None)
        facility_col = next((c for c in df.columns if str(c).lower().strip() == 'power plant'), None)
        cap_col = next((c for c in df.columns if 'capacity' in str(c).lower()), None)
        if not prov_col or not facility_col or not cap_col:
            raise ValueError(
                f'major_hydro_facilities: expected province, power plant, and capacity columns '
                f'in {path.name} (found {df.columns.tolist()})'
            )

        rows: List[Tuple[str, str, float]] = []
        skipped_provinces: List[str] = []

        for _, record in df.iterrows():
            capacity = _parse_mw(record[cap_col])
            if capacity is None or capacity < MIN_HYDRO_FAC_MW:
                continue
            prov = str(record[prov_col]).strip().upper()
            if not prov or prov == 'NAN':
                continue
            prov_key = HYDRO_FAC_PROV_TO_KEY.get(prov)
            if not prov_key:
                if prov not in skipped_provinces:
                    skipped_provinces.append(prov)
                continue
            facility = str(record[facility_col]).strip()
            if not facility or facility.lower() == 'nan':
                continue
            rows.append((prov_key, facility, round(capacity, 1)))

        if skipped_provinces:
            print(
                '    Warning: major_hydro_facilities ignored unknown provinces: '
                + ', '.join(skipped_provinces)
            )

        if not rows:
            raise ValueError(
                f'major_hydro_facilities: no facilities >= {MIN_HYDRO_FAC_MW} MW found in {path.name}'
            )

        rows.sort(key=lambda item: item[2], reverse=True)
        return rows

    return run_with_retry(
        _load,
        config=config,
        label=f'{LARGEST_HYDRO_FACILITIES_XLSX} hydro facilities load',
    )


def _prov_code(prov_key: str) -> int:
    code = HYDRO_FAC_PROV_TO_CODE.get(prov_key)
    if code is None:
        raise ValueError(f'major_hydro_facilities: unknown province key {prov_key!r}')
    return code


def update_major_hydro_facilities(processor) -> int:
    ref_year = _read_hydro_reference_year(processor.config)
    facilities = _read_major_hydro_facilities(processor.config)
    data_rows: List[Tuple[str, str, float]] = []
    metadata_rows = []

    for index, (prov_key, facility, capacity) in enumerate(facilities, start=1):
        idx = f'{index:02d}'
        data_rows.append((f'{RAW_PREFIX}_{idx}_mw', str(ref_year), capacity))
        data_rows.append((f'{RAW_PREFIX}_{idx}_prov', str(ref_year), float(_prov_code(prov_key))))
        metadata_rows.append((f'{RAW_PREFIX}_{idx}_mw', facility, 'MW', 'megawatts', 'Natural Resources Canada', ''))
        metadata_rows.append((f'{RAW_PREFIX}_{idx}_prov', f'{facility} province code', 'Code', 'code', 'Natural Resources Canada', ''))

    n = processor.replace_raw_data(SOURCE_KEY, data_rows, metadata_rows)
    print(f'    Stored {n} source-native rows for {SOURCE_KEY} ({ref_year})')
    return n


def transform_major_hydro_facilities(processor) -> int:
    df = processor.get_raw_dataframe(SOURCE_KEY)
    if df.empty:
        raise ValueError(
            f'{SOURCE_KEY} transform: no raw rows found — re-run eedas update --source {SOURCE_KEY}'
        )

    data_rows: List[Tuple[str, str, float]] = []
    metadata_rows = []
    for _, row in df.iterrows():
        vector = str(row['vector'])
        if not vector.startswith(f'{RAW_PREFIX}_'):
            continue
        suffix = vector[len(f'{RAW_PREFIX}_'):]
        ref_year = str(row['ref_date'])
        value = float(row['value'])
        out_vector = f'hydro_fac_{suffix}'
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
