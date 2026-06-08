"""Page 111 — Canadian crude production by type and province."""

from datetime import datetime
from typing import Dict, List, Tuple

import pandas as pd

from .constants import CP_PROVINCE_GEOS
from .oil_sands import (
    _download_os_statcan_csv,
    _os_annual_canada_totals,
    _os_to_mmbd,
)


def _cp_annual_crude_m3(df: pd.DataFrame, year: int, geo: str) -> float:
    year_df = df[
        (df['GEO'] == geo)
        & (df['UOM'] == 'Cubic metres')
        & (df['REF_DATE'].astype(str).str.startswith(str(year)))
    ]
    if year_df.empty:
        return 0.0
    grouped = year_df.groupby('Supply and disposition')['VALUE'].sum()
    return float(grouped.get('Crude oil production', 0.0))


def _cp_year_month_count(df: pd.DataFrame, year: int, geo: str = 'Canada') -> int:
    year_df = df[
        (df['GEO'] == geo)
        & (df['UOM'] == 'Cubic metres')
        & (df['REF_DATE'].astype(str).str.startswith(str(year)))
    ]
    if year_df.empty:
        return 0
    return year_df['REF_DATE'].astype(str).nunique()


def _cp_max_complete_production_year(df_old: pd.DataFrame, df_new: pd.DataFrame) -> int:
    max_year = 0
    for year in range(2000, datetime.now().year + 1):
        source = df_old if year <= 2015 else df_new
        if _cp_year_month_count(source, year) >= 12:
            max_year = year
    return max_year


def _cp_max_complete_province_year(df_new: pd.DataFrame, max_prod_year: int) -> int:
    max_year = 0
    geos = ['Canada', *CP_PROVINCE_GEOS.values()]
    for year in range(2016, max_prod_year + 1):
        if _cp_year_month_count(df_new, year) < 12:
            continue
        if all(_cp_annual_crude_m3(df_new, year, geo) > 0 for geo in geos):
            max_year = year
    return max_year


def _build_cp_production_rows(
    df_old: pd.DataFrame,
    df_new: pd.DataFrame,
    max_year: int,
) -> List[Tuple[str, str, float]]:
    rows: List[Tuple[str, str, float]] = []

    for year in range(2000, max_year + 1):
        if year <= 2015:
            values = _os_annual_canada_totals(df_old, year)
            if not values:
                continue
            oil_sands_thousand = values.get('Synthetic crude oil', 0.0) + values.get('Crude bitumen', 0.0)
            conventional_thousand = (
                values.get('Heavy crude oil', 0.0)
                + values.get('Light and medium crude oil', 0.0)
                + values.get('Condensate', 0.0)
                + values.get('Pentanes plus', 0.0)
            )
            total_thousand = values.get('Total crude production', 0.0)
            if total_thousand <= 0:
                total_thousand = oil_sands_thousand + conventional_thousand
            if total_thousand <= 0:
                continue
            oil_sands_m3 = oil_sands_thousand * 1000
            conventional_m3 = conventional_thousand * 1000
            total_m3 = total_thousand * 1000
        else:
            values = _os_annual_canada_totals(df_new, year)
            if not values:
                continue
            oil_sands_m3 = values.get('Synthetic crude oil production', 0.0) + values.get(
                'Non-upgraded production of crude bitumen', 0.0
            )
            conventional_m3 = (
                values.get('Heavy crude oil', 0.0)
                + values.get('Light and medium crude oil', 0.0)
                + values.get('Condensate', 0.0)
                + values.get('Pentanes plus', 0.0)
            )
            total_m3 = values.get('Crude oil production', 0.0) + values.get(
                'Equivalent products production', 0.0
            )
            if total_m3 <= 0 or oil_sands_m3 <= 0:
                continue
            oil_sands_thousand = oil_sands_m3 / 1000
            conventional_thousand = conventional_m3 / 1000
            total_thousand = total_m3 / 1000

        share_pct = round(oil_sands_m3 / total_m3 * 100)
        year_key = str(year)
        rows.extend([
            ('cp_oil_sands_thousand_m3', year_key, round(oil_sands_thousand, 1)),
            ('cp_conventional_thousand_m3', year_key, round(conventional_thousand, 1)),
            ('cp_total_thousand_m3', year_key, round(total_thousand, 1)),
            ('cp_oil_sands_mmbd', year_key, _os_to_mmbd(oil_sands_m3)),
            ('cp_conventional_mmbd', year_key, _os_to_mmbd(conventional_m3)),
            ('cp_total_mmbd', year_key, _os_to_mmbd(total_m3)),
            ('cp_share_pct', year_key, float(share_pct)),
        ])

    return rows


def _build_cp_province_rows(df_new: pd.DataFrame, max_year: int) -> List[Tuple[str, str, float]]:
    rows: List[Tuple[str, str, float]] = []
    for year in range(2016, max_year + 1):
        if _cp_year_month_count(df_new, year) < 12:
            continue
        canada_m3 = _cp_annual_crude_m3(df_new, year, 'Canada')
        if canada_m3 <= 0:
            continue
        province_m3: Dict[str, float] = {}
        province_sum = 0.0
        complete = True
        for vector, geo in CP_PROVINCE_GEOS.items():
            value = _cp_annual_crude_m3(df_new, year, geo)
            if value <= 0:
                complete = False
                break
            province_m3[vector] = value
            province_sum += value
        if not complete:
            continue
        other_m3 = max(canada_m3 - province_sum, 0.0)
        canada_thousand = canada_m3 / 1000
        year_key = str(year)
        rows.append(('cp_prov_canada_thousand_m3', year_key, round(canada_thousand, 1)))
        for vector, value in province_m3.items():
            rows.append((vector, year_key, round(value / 1000, 1)))
        rows.append(('cp_prov_other_thousand_m3', year_key, round(other_m3 / 1000, 1)))
    return rows


def build_canadian_production_rows() -> List[Tuple[str, str, float]]:
    df_old = _download_os_statcan_csv('25100014')
    df_new = _download_os_statcan_csv('25100063')
    max_prod_year = _cp_max_complete_production_year(df_old, df_new)
    max_prov_year = _cp_max_complete_province_year(df_new, max_prod_year)
    return (
        _build_cp_production_rows(df_old, df_new, max_prod_year)
        + _build_cp_province_rows(df_new, max_prov_year)
    )


SOURCE_KEY = 'canadian_production'


def update_canadian_production(processor) -> int:
    """EEDAS ingest: StatCan crude production by type/province (source-native)."""
    print('  Fetching Canadian crude production (raw)...')
    rows = build_canadian_production_rows()
    if not rows:
        print('    WARNING: no Canadian production raw rows produced')
        return 0
    data_rows = [(f'raw_{vec}', ref, val) for vec, ref, val in rows]
    metadata_rows = [
        (f'raw_{vec}', f'Canadian production raw — {vec}', 'units', 'units', 'Statistics Canada', '')
        for vec in sorted({r[0] for r in rows})
    ]
    print(f'    Prepared {len(data_rows)} source-native data points')
    return processor.replace_raw_data(SOURCE_KEY, data_rows, metadata_rows)


def transform_canadian_production(processor) -> int:
    """EFB transform: map raw production rows to cp_* indicators."""
    df = processor.get_raw_dataframe(SOURCE_KEY)
    if df.empty:
        print('    canadian_production transform: no raw rows found')
        return 0

    data_rows: List[Tuple[str, str, float]] = []
    for _, row in df.iterrows():
        vec = str(row['vector'])
        if not vec.startswith('raw_'):
            continue
        try:
            data_rows.append((vec[4:], str(row['ref_date']), float(row['value'])))
        except (TypeError, ValueError):
            continue

    if not data_rows:
        return 0

    from .constants import CANADIAN_PRODUCTION_METADATA
    n = processor.store_indicators(SOURCE_KEY, data_rows, CANADIAN_PRODUCTION_METADATA)
    print(f'    Stored {n} indicator rows for canadian_production')
    return n
