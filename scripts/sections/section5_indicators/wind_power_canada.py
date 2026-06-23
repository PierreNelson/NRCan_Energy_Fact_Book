"""Page 80 — Wind power capacity and generation in Canada (Manual Data workbook)."""

from __future__ import annotations

import re
from typing import Dict, List, Optional, Tuple

import pandas as pd

from utils.io_retry import ensure_workbook, read_excel_with_retry, run_with_retry

from .constants import (
    WIND_POWER_BASE_YEAR,
    WIND_POWER_CANADA_XLSX,
    WIND_POWER_CAP_SHEET,
    WIND_POWER_GEN_SHEET,
    WIND_POWER_METADATA,
)

SOURCE_KEY = 'wind_power_canada'
RAW_PREFIX = 'raw_win_pwr'


def _normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df.columns = [re.sub(r"^['\"]|['\"]$", '', str(c).strip()) for c in df.columns]
    return df


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


def _parse_year(value) -> Optional[int]:
    if pd.isna(value):
        return None
    try:
        year = int(float(value))
    except (TypeError, ValueError):
        return None
    return year if year >= 1900 else None


def _read_cap_rows(config=None) -> List[Tuple[int, Dict[str, float]]]:
    def _load() -> List[Tuple[int, Dict[str, float]]]:
        path = ensure_workbook(WIND_POWER_CANADA_XLSX, config=config)
        df = _normalize_columns(
            read_excel_with_retry(
                path,
                WIND_POWER_CAP_SHEET,
                config=config,
                label=f'{WIND_POWER_CANADA_XLSX} {WIND_POWER_CAP_SHEET!r}',
                header=0,
            )
        )
        col_map = {str(c).lower().strip(): c for c in df.columns}
        year_col = col_map.get('year')
        cum_mw_col = col_map.get('cumulative (mw)')
        add_mw_col = col_map.get('annual additions (mw)')
        cum_gw_col = col_map.get('cumulative (gw)')
        if not year_col or not cum_mw_col or not add_mw_col:
            raise ValueError(f'wind_power_canada: missing cap sheet columns in {path.name}')

        rows: List[Tuple[int, Dict[str, float]]] = []
        for _, record in df.iterrows():
            year = _parse_year(record[year_col])
            if year is None:
                continue
            cum_mw = _parse_numeric(record[cum_mw_col])
            add_mw = _parse_numeric(record[add_mw_col])
            cum_gw = _parse_numeric(record[cum_gw_col]) if cum_gw_col else None
            if cum_mw is None:
                continue
            payload: Dict[str, float] = {
                'cum_mw': round(cum_mw, 1),
                'add_mw': round(add_mw, 1) if add_mw is not None else 0.0,
            }
            if cum_gw is not None:
                payload['cum_gw'] = round(cum_gw, 3)
            rows.append((year, payload))
        if not rows:
            raise ValueError('wind_power_canada: no cap rows parsed')
        return sorted(rows, key=lambda item: item[0])

    return run_with_retry(
        _load,
        config=config,
        label=f'{WIND_POWER_CANADA_XLSX} cap sheet load',
    )


def _read_gen_rows(config=None) -> List[Tuple[int, float]]:
    def _load() -> List[Tuple[int, float]]:
        path = ensure_workbook(WIND_POWER_CANADA_XLSX, config=config)
        df = _normalize_columns(
            read_excel_with_retry(
                path,
                WIND_POWER_GEN_SHEET,
                config=config,
                label=f'{WIND_POWER_CANADA_XLSX} {WIND_POWER_GEN_SHEET!r}',
                header=0,
            )
        )
        col_map = {str(c).lower().strip(): c for c in df.columns}
        year_col = col_map.get('year')
        twh_col = col_map.get('generation (twh)')
        gwh_col = col_map.get('generation (gwh)')
        if not year_col or (not twh_col and not gwh_col):
            raise ValueError(f'wind_power_canada: missing gen sheet columns in {path.name}')

        rows: List[Tuple[int, float]] = []
        for _, record in df.iterrows():
            year = _parse_year(record[year_col])
            if year is None:
                continue
            twh = _parse_numeric(record[twh_col]) if twh_col else None
            if twh is None and gwh_col:
                gwh = _parse_numeric(record[gwh_col])
                twh = round(gwh / 1000, 3) if gwh is not None else None
            if twh is None:
                continue
            rows.append((year, round(twh, 3)))
        if not rows:
            raise ValueError('wind_power_canada: no gen rows parsed')
        return sorted(rows, key=lambda item: item[0])

    return run_with_retry(
        _load,
        config=config,
        label=f'{WIND_POWER_CANADA_XLSX} gen sheet load',
    )


def _build_raw_rows(config=None) -> List[Tuple[str, str, float]]:
    cap_rows = _read_cap_rows(config)
    gen_rows = _read_gen_rows(config)
    data_rows: List[Tuple[str, str, float]] = []

    for year, payload in cap_rows:
        year_key = str(year)
        data_rows.append((f'{RAW_PREFIX}_cap_cum_mw', year_key, payload['cum_mw']))
        data_rows.append((f'{RAW_PREFIX}_cap_add_mw', year_key, payload['add_mw']))
        if 'cum_gw' in payload:
            data_rows.append((f'{RAW_PREFIX}_cap_cum_gw', year_key, payload['cum_gw']))

    for year, twh in gen_rows:
        data_rows.append((f'{RAW_PREFIX}_gen_twh', str(year), twh))

    return data_rows


def _raw_lookup(raw_by_year: Dict[str, Dict[str, float]], year: str, key: str) -> Optional[float]:
    return raw_by_year.get(year, {}).get(f'{RAW_PREFIX}_{key}')


def _growth_tier(ratio: float) -> Tuple[int, str]:
    if ratio >= 3.5:
        return 4, 'quadrupled'
    if ratio >= 2.5:
        return 3, 'tripled'
    if ratio >= 1.75:
        return 2, 'doubled'
    return max(1, round(ratio)), 'increased'


def _transform_rows_from_raw(raw_by_year: Dict[str, Dict[str, float]]) -> List[Tuple[str, str, float]]:
    cap_years = sorted(
        year for year, values in raw_by_year.items()
        if f'{RAW_PREFIX}_cap_cum_mw' in values
    )
    gen_years = sorted(
        year for year, values in raw_by_year.items()
        if f'{RAW_PREFIX}_gen_twh' in values
    )
    if not cap_years:
        raise ValueError('wind_power_canada transform: no capacity raw rows')

    rows: List[Tuple[str, str, float]] = []
    for year_key in cap_years:
        cum_mw = _raw_lookup(raw_by_year, year_key, 'cap_cum_mw')
        add_mw = _raw_lookup(raw_by_year, year_key, 'cap_add_mw')
        if cum_mw is None:
            continue
        rows.append(('win_pwr_cap_cum_mw', year_key, round(cum_mw, 1)))
        if add_mw is not None:
            rows.append(('win_pwr_cap_add_mw', year_key, round(add_mw, 1)))
        cum_gw = _raw_lookup(raw_by_year, year_key, 'cap_cum_gw')
        if cum_gw is not None:
            rows.append(('win_pwr_cap_cum_gw', year_key, round(cum_gw, 1)))

    for year_key in gen_years:
        twh = _raw_lookup(raw_by_year, year_key, 'gen_twh')
        if twh is not None:
            rows.append(('win_pwr_gen_twh', year_key, round(twh, 1)))

    latest_cap_year = cap_years[-1]
    latest_cum_gw = _raw_lookup(raw_by_year, latest_cap_year, 'cap_cum_gw')
    if latest_cum_gw is None:
        latest_cum_mw = _raw_lookup(raw_by_year, latest_cap_year, 'cap_cum_mw') or 0.0
        latest_cum_gw = round(latest_cum_mw / 1000, 1)

    base_cap_gw = _raw_lookup(raw_by_year, str(WIND_POWER_BASE_YEAR), 'cap_cum_gw')
    if base_cap_gw is None:
        base_cap_mw = _raw_lookup(raw_by_year, str(WIND_POWER_BASE_YEAR), 'cap_cum_mw') or 0.0
        base_cap_gw = base_cap_mw / 1000 if base_cap_mw else 0.0

    cap_ratio = latest_cum_gw / base_cap_gw if base_cap_gw > 0 else 0.0
    cap_mult, _ = _growth_tier(cap_ratio)
    rows.append(('win_pwr_stat_cap_gw', latest_cap_year, round(latest_cum_gw, 1)))
    rows.append(('win_pwr_stat_cap_year', latest_cap_year, float(latest_cap_year)))
    rows.append(('win_pwr_stat_cap_ratio', latest_cap_year, round(cap_ratio, 4)))
    rows.append(('win_pwr_stat_cap_mult', latest_cap_year, float(cap_mult)))

    if gen_years:
        latest_gen_year = gen_years[-1]
        latest_twh = _raw_lookup(raw_by_year, latest_gen_year, 'gen_twh') or 0.0
        base_twh = _raw_lookup(raw_by_year, str(WIND_POWER_BASE_YEAR), 'gen_twh') or 0.0
        gen_ratio = latest_twh / base_twh if base_twh > 0 else 0.0
        gen_mult, _ = _growth_tier(gen_ratio)
        rows.append(('win_pwr_stat_gen_twh', latest_gen_year, round(latest_twh, 1)))
        rows.append(('win_pwr_stat_gen_year', latest_gen_year, float(latest_gen_year)))
        rows.append(('win_pwr_stat_gen_ratio', latest_gen_year, round(gen_ratio, 4)))
        rows.append(('win_pwr_stat_gen_mult', latest_gen_year, float(gen_mult)))

    return rows


def _raw_by_year_from_rows(raw_rows: List[Tuple[str, str, float]]) -> Dict[str, Dict[str, float]]:
    raw_by_year: Dict[str, Dict[str, float]] = {}
    for vector, year_key, value in raw_rows:
        raw_by_year.setdefault(year_key, {})[vector] = value
    return raw_by_year


def build_wind_power_canada_indicator_rows(
    config=None,
) -> Tuple[List[Tuple[str, str, float]], List[Tuple[str, str, str, str, str, str]]]:
    raw_rows = _build_raw_rows(config)
    raw_by_year = _raw_by_year_from_rows(raw_rows)
    return _transform_rows_from_raw(raw_by_year), list(WIND_POWER_METADATA)


def update_wind_power_canada(processor) -> int:
    """EEDAS ingest: Wind capacity and generation_Canada.xlsx cap/gen sheets."""
    print('  Fetching wind power capacity and generation (raw)...')
    data_rows = _build_raw_rows(processor.config)
    if not data_rows:
        raise RuntimeError('wind_power_canada: no source-native rows produced')
    metadata_rows = [
        (
            vector,
            f'Wind power raw — {vector.removeprefix(RAW_PREFIX + "_")}',
            'units',
            'units',
            'Natural Resources Canada',
            '',
        )
        for vector in sorted({row[0] for row in data_rows})
    ]
    n = processor.replace_raw_data(SOURCE_KEY, data_rows, metadata_rows)
    print(f'    Stored {n} source-native rows for {SOURCE_KEY}')
    return n


def transform_wind_power_canada(processor) -> int:
    """EFB transform: win_pwr_* vectors for Page 80."""
    df = processor.get_raw_dataframe(SOURCE_KEY)
    if df.empty:
        raise RuntimeError('wind_power_canada transform: no raw rows found — re-run eedas update')

    raw_by_year: Dict[str, Dict[str, float]] = {}
    for _, row in df.iterrows():
        vector = str(row['vector'])
        if not vector.startswith(f'{RAW_PREFIX}_'):
            continue
        year_key = str(row['ref_date'])
        try:
            value = float(row['value'])
        except (TypeError, ValueError):
            continue
        raw_by_year.setdefault(year_key, {})[vector] = value

    data_rows = _transform_rows_from_raw(raw_by_year)
    if not data_rows:
        raise RuntimeError('wind_power_canada transform: no indicator rows produced')

    n = processor.store_indicators(SOURCE_KEY, data_rows, WIND_POWER_METADATA)
    print(f'    Stored {n} indicator rows for {SOURCE_KEY}')
    return n
