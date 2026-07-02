"""Wind and solar net electricity generation growth in Canada."""

from __future__ import annotations

import re
from typing import Dict, List, Optional, Tuple

import pandas as pd

from utils.io_retry import ensure_workbook, read_excel_with_retry, run_with_retry

from .constants import (
    WIND_SOLAR_ELEC_BASE_YEAR,
    WIND_SOLAR_ELEC_GEN_DIST_XLSX,
    WIND_SOLAR_ELEC_GEN_2011_XLSX,
    WIND_SOLAR_ELEC_GEN_2011_SHEET,
    WIND_SOLAR_ELEC_METADATA,
    WIND_SOLAR_ELEC_NON_EMITTING_RANK,
    WIND_SOLAR_ELEC_RANKING_YEAR,
)

SOURCE_KEY = 'wind_solar_electricity_growth'
RAW_PREFIX = 'raw_ws_elec'

_GEN_2011_COLS = {
    'biomass': 4,
    'hydro': 6,
    'wind': 8,
    'solar': 9,
    'tidal': 10,
}

_DIST_GEN_COLS = {
    'biomass_geothermal': 4,
    'hydro': 6,
    'wind': 8,
    'solar': 9,
}

_DIST_SHARE_COLS = {
    'biomass_geothermal': 4,
    'hydro': 6,
    'nuclear': 7,
    'wind': 8,
    'solar': 9,
}


def _parse_numeric(value) -> Optional[float]:
    if pd.isna(value):
        return None
    if isinstance(value, str):
        stripped = value.strip()
        if stripped in ('', '-', '–', '—'):
            return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _normalize_label(value) -> str:
    if pd.isna(value):
        return ''
    return re.sub(r'\s+', ' ', str(value).strip().lower())


def _read_2011_canada_row(path) -> Dict[str, float]:
    df = read_excel_with_retry(path, WIND_SOLAR_ELEC_GEN_2011_SHEET, header=None)
    for _, record in df.iterrows():
        if _normalize_label(record.iloc[0]) != 'canada':
            continue
        row: Dict[str, float] = {}
        for key, col_idx in _GEN_2011_COLS.items():
            val = _parse_numeric(record.iloc[col_idx])
            if val is not None:
                row[key] = val
        if not row:
            raise ValueError('wind_solar_electricity_growth: empty 2011 Canada row')
        return row
    raise ValueError('wind_solar_electricity_growth: Canada row not found in 2011 workbook')


def _find_section_start(df: pd.DataFrame, needle: str) -> Optional[int]:
    target = needle.lower()
    for idx in range(len(df)):
        label = _normalize_label(df.iloc[idx, 0])
        if target in label:
            return idx
    return None


def _read_dist_canada_generation(path, sheet: str) -> Dict[str, float]:
    df = read_excel_with_retry(path, sheet, header=None)
    start = _find_section_start(df, 'electricity generation, by province')
    if start is None:
        raise ValueError(f'wind_solar_electricity_growth: generation section missing in {sheet!r}')

    row: Dict[str, float] = {}
    for _, record in df.iloc[start + 2:].iterrows():
        label = _normalize_label(record.iloc[0])
        if not label:
            continue
        if 'electricity generation shares' in label:
            break
        if label != 'canada':
            continue
        for key, col_idx in _DIST_GEN_COLS.items():
            val = _parse_numeric(record.iloc[col_idx])
            if val is not None:
                row[key] = val
        break

    if not row:
        raise ValueError(f'wind_solar_electricity_growth: Canada generation row missing in {sheet!r}')
    return row


def _read_dist_canada_shares(path, sheet: str, year: int) -> Dict[str, int]:
    df = read_excel_with_retry(path, sheet, header=None)
    start = _find_section_start(df, 'electricity generation shares')
    if start is None:
        raise ValueError(f'wind_solar_electricity_growth: shares section missing in {sheet!r}')

    for _, record in df.iloc[start + 2:].iterrows():
        label = _normalize_label(record.iloc[0])
        if not label:
            continue
        if 'electricity capacity' in label or label.startswith('1.') or label.startswith('2.'):
            break
        if label != 'canada':
            continue

        shares: Dict[str, float] = {}
        for key, col_idx in _DIST_SHARE_COLS.items():
            val = _parse_numeric(record.iloc[col_idx])
            if val is not None:
                shares[key] = val

        hydro = round(shares.get('hydro', 0) * 100)
        nuclear = round(shares.get('nuclear', 0) * 100)
        other = round(
            (shares.get('biomass_geothermal', 0) + shares.get('wind', 0) + shares.get('solar', 0)) * 100
        )
        non_ghg = round(hydro + nuclear + other)
        return {
            'non_ghg_pct': non_ghg,
            'hydro_pct': hydro,
            'nuclear_pct': nuclear,
            'other_renewables_pct': other,
        }

    raise ValueError(f'wind_solar_electricity_growth: Canada shares row missing for {year}')


def _read_canada_generation_by_year(config=None) -> Dict[int, Dict[str, float]]:
    def _load() -> Dict[int, Dict[str, float]]:
        by_year: Dict[int, Dict[str, float]] = {}

        path_2011 = ensure_workbook(WIND_SOLAR_ELEC_GEN_2011_XLSX, config=config)
        by_year[WIND_SOLAR_ELEC_BASE_YEAR] = _read_2011_canada_row(path_2011)

        path_dist = ensure_workbook(WIND_SOLAR_ELEC_GEN_DIST_XLSX, config=config)
        xl = pd.ExcelFile(path_dist)
        for sheet in xl.sheet_names:
            match = re.match(r'^(\d{4})\s+Generation and Capacity$', sheet.strip())
            if not match:
                continue
            year = int(match.group(1))
            by_year[year] = _read_dist_canada_generation(path_dist, sheet)

        if WIND_SOLAR_ELEC_BASE_YEAR not in by_year:
            raise ValueError('wind_solar_electricity_growth: missing 2011 Canada generation row')
        return dict(sorted(by_year.items()))

    return run_with_retry(
        _load,
        config=config,
        label='wind_solar_electricity_growth generation load',
    )


def _renewable_total_2011(row: Dict[str, float]) -> float:
    return (
        (row.get('biomass') or 0.0)
        + (row.get('hydro') or 0.0)
        + (row.get('wind') or 0.0)
        + (row.get('solar') or 0.0)
        + (row.get('tidal') or 0.0)
    )


def _renewable_total_latest(row: Dict[str, float]) -> float:
    return (
        (row.get('biomass_geothermal') or 0.0)
        + (row.get('hydro') or 0.0)
        + (row.get('wind') or 0.0)
        + (row.get('solar') or 0.0)
    )


def _pct_change(start: float, end: float) -> int:
    if start <= 0:
        return 0
    return round((end - start) / start * 100)


def _read_latest_shares(latest_year: int, config=None) -> Dict[str, int]:
    path_dist = ensure_workbook(WIND_SOLAR_ELEC_GEN_DIST_XLSX, config=config)
    sheet = f'{latest_year} Generation and Capacity'
    return _read_dist_canada_shares(path_dist, sheet, latest_year)


def _build_indicator_rows(config=None) -> Tuple[List[Tuple[str, str, float]], List[Tuple[str, str, str, str, str, str]]]:
    by_year = _read_canada_generation_by_year(config)
    latest_year = max(by_year)
    start_row = by_year[WIND_SOLAR_ELEC_BASE_YEAR]
    end_row = by_year[latest_year]

    t_start = _renewable_total_2011(start_row)
    t_end = _renewable_total_latest(end_row)
    pct_change = _pct_change(t_start, t_end)
    shares = _read_latest_shares(latest_year, config)

    data_rows: List[Tuple[str, str, float]] = []
    metadata_rows: List[Tuple[str, str, str, str, str, str]] = list(WIND_SOLAR_ELEC_METADATA)

    for year, row in by_year.items():
        year_str = str(year)
        if row.get('wind') is not None:
            data_rows.append((f'{RAW_PREFIX}_wind_gwh', year_str, round(row['wind'])))
        if row.get('solar') is not None:
            data_rows.append((f'{RAW_PREFIX}_solar_gwh', year_str, round(row['solar'])))

    data_rows.extend([
        (f'{RAW_PREFIX}_renewable_pct_change', str(latest_year), pct_change),
        (f'{RAW_PREFIX}_non_ghg_pct', str(latest_year), shares['non_ghg_pct']),
        (f'{RAW_PREFIX}_hydro_pct', str(latest_year), shares['hydro_pct']),
        (f'{RAW_PREFIX}_nuclear_pct', str(latest_year), shares['nuclear_pct']),
        (f'{RAW_PREFIX}_other_renewables_pct', str(latest_year), shares['other_renewables_pct']),
        (f'{RAW_PREFIX}_start_year', str(latest_year), WIND_SOLAR_ELEC_BASE_YEAR),
        (f'{RAW_PREFIX}_end_year', str(latest_year), latest_year),
        (f'{RAW_PREFIX}_ranking_year', str(WIND_SOLAR_ELEC_RANKING_YEAR), WIND_SOLAR_ELEC_RANKING_YEAR),
    ])

    for country_key, rank, pct in WIND_SOLAR_ELEC_NON_EMITTING_RANK:
        data_rows.append((f'{RAW_PREFIX}_rank_{country_key}_pct', str(WIND_SOLAR_ELEC_RANKING_YEAR), pct))
        data_rows.append((f'{RAW_PREFIX}_rank_{country_key}_order', str(WIND_SOLAR_ELEC_RANKING_YEAR), rank))

    return data_rows, metadata_rows


def update_wind_solar_electricity_growth(processor) -> int:
    data_rows, metadata_rows = _build_indicator_rows(processor.config)
    raw_rows = [(vector, ref_date, value) for vector, ref_date, value in data_rows]
    n = processor.replace_raw_data(SOURCE_KEY, raw_rows, metadata_rows)
    print(f'    Stored {n} source-native rows for {SOURCE_KEY}')
    return n


def transform_wind_solar_electricity_growth(processor) -> int:
    df = processor.get_raw_dataframe(SOURCE_KEY)
    if df.empty:
        raise ValueError(
            f'{SOURCE_KEY} transform: no raw rows found — re-run eedas update --source {SOURCE_KEY}'
        )

    data_rows: List[Tuple[str, str, float]] = []
    metadata_rows: List[Tuple[str, str, str, str, str, str]] = list(WIND_SOLAR_ELEC_METADATA)

    for _, row in df.iterrows():
        vector = str(row['vector'])
        if not vector.startswith(f'{RAW_PREFIX}_'):
            continue
        suffix = vector[len(RAW_PREFIX) + 1:]
        out_vec = f'ws_elec_{suffix}'
        data_rows.append((out_vec, str(row['ref_date']), float(row['value'])))

    if not data_rows:
        raise ValueError(f'{SOURCE_KEY} transform: no indicator rows produced')

    n = processor.store_indicators(SOURCE_KEY, data_rows, metadata_rows)
    print(f'    Stored {n} indicator rows for {SOURCE_KEY}')
    return n
