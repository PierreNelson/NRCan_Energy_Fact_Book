"""Page 111 — Canadian crude production by type and province (StatCan 25-10-0014-01 + 25-10-0063-01)."""

from __future__ import annotations

from datetime import datetime
from typing import Dict, List, Optional, Tuple

import pandas as pd

from .constants import (
    CANADIAN_PRODUCTION_METADATA,
    CP_OTHER_SUB_GEOS,
    CP_PROVINCE_GEOS,
    CP_PROVINCE_PCT_VECTORS,
)
from .oil_sands import (
    _download_os_statcan_csv,
    _os_annual_canada_totals,
    _os_to_mmbd,
)

SOURCE_KEY = 'canadian_production'

STATCAN_TABLE_14 = '25100014'
STATCAN_TABLE_63 = '25100063'

S14_CATEGORY_KEYS = {
    'Heavy crude oil': 's14_heavy_crude_m3',
    'Light and medium crude oil': 's14_light_medium_m3',
    'Synthetic crude oil': 's14_synthetic_crude_m3',
    'Crude bitumen': 's14_crude_bitumen_m3',
    'Condensate': 's14_condensate_m3',
    'Pentanes plus': 's14_pentanes_plus_m3',
}

S63_CANADA_CATEGORY_KEYS = {
    'Heavy crude oil': 's63_heavy_crude_m3',
    'Light and medium crude oil': 's63_light_medium_m3',
    'Non-upgraded production of crude bitumen': 's63_bitumen_m3',
    'Synthetic crude oil production': 's63_synthetic_crude_m3',
    'Condensate': 's63_condensate_m3',
    'Pentanes plus': 's63_pentanes_plus_m3',
    'Crude oil production': 's63_crude_oil_prod_m3',
    'Equivalent products production': 's63_equiv_products_m3',
}

S63_PROVINCE_RAW_KEYS = {
    vector: f's63_prov_{vector.removeprefix("cp_prov_").removesuffix("_thousand_m3")}_m3'
    for vector in {**CP_PROVINCE_GEOS, **CP_OTHER_SUB_GEOS}
}


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


def _share_pct(value_m3: float, canada_m3: float) -> float:
    return round((value_m3 / canada_m3) * 1000) / 10


def _build_raw_statcan_rows(
    df_old: pd.DataFrame,
    df_new: pd.DataFrame,
    max_prod_year: int,
    max_prov_year: int,
) -> List[Tuple[str, str, float]]:
    """EEDAS ingest rows — source-native annual cubic-metre totals from StatCan tables."""
    rows: List[Tuple[str, str, float]] = []

    for year in range(2000, min(max_prod_year, 2015) + 1):
        if _cp_year_month_count(df_old, year) < 12:
            continue
        values = _os_annual_canada_totals(df_old, year)
        if not values:
            continue
        year_key = str(year)
        for label, raw_key in S14_CATEGORY_KEYS.items():
            amount = values.get(label, 0.0)
            if amount > 0:
                rows.append((f'raw_cp_{raw_key}', year_key, float(amount * 1000)))

    for year in range(2016, max_prod_year + 1):
        if _cp_year_month_count(df_new, year) < 12:
            continue
        values = _os_annual_canada_totals(df_new, year)
        if not values:
            continue
        year_key = str(year)
        for label, raw_key in S63_CANADA_CATEGORY_KEYS.items():
            amount = values.get(label, 0.0)
            if amount > 0:
                rows.append((f'raw_cp_{raw_key}', year_key, float(amount)))

    for year in range(2016, max_prov_year + 1):
        if _cp_year_month_count(df_new, year) < 12:
            continue
        canada_m3 = _cp_annual_crude_m3(df_new, year, 'Canada')
        if canada_m3 <= 0:
            continue
        year_key = str(year)
        year_rows: List[Tuple[str, str, float]] = [
            ('raw_cp_s63_prov_canada_m3', year_key, canada_m3),
        ]
        province_sum = 0.0
        complete = True
        for thousand_vec, geo in CP_PROVINCE_GEOS.items():
            value = _cp_annual_crude_m3(df_new, year, geo)
            if value <= 0:
                complete = False
                break
            raw_key = S63_PROVINCE_RAW_KEYS[thousand_vec]
            year_rows.append((f'raw_cp_{raw_key}', year_key, value))
            province_sum += value
        if not complete:
            continue
        other_sub_sum = 0.0
        for thousand_vec, geo in CP_OTHER_SUB_GEOS.items():
            value = max(_cp_annual_crude_m3(df_new, year, geo), 0.0)
            raw_key = S63_PROVINCE_RAW_KEYS[thousand_vec]
            year_rows.append((f'raw_cp_{raw_key}', year_key, value))
            other_sub_sum += value
        year_rows.append(
            ('raw_cp_s63_prov_other_m3', year_key, max(canada_m3 - province_sum - other_sub_sum, 0.0)),
        )
        rows.extend(year_rows)

    return rows


def _raw_lookup(raw_by_year: Dict[str, Dict[str, float]], year: str, key: str) -> float:
    return raw_by_year.get(year, {}).get(f'raw_cp_{key}', 0.0)


def _transform_production_rows(raw_by_year: Dict[str, Dict[str, float]]) -> List[Tuple[str, str, float]]:
    rows: List[Tuple[str, str, float]] = []

    for year_key in sorted(raw_by_year.keys(), key=int):
        year = int(year_key)
        if year <= 2015:
            oil_sands_m3 = (
                _raw_lookup(raw_by_year, year_key, 's14_synthetic_crude_m3')
                + _raw_lookup(raw_by_year, year_key, 's14_crude_bitumen_m3')
            )
            conventional_m3 = (
                _raw_lookup(raw_by_year, year_key, 's14_heavy_crude_m3')
                + _raw_lookup(raw_by_year, year_key, 's14_light_medium_m3')
                + _raw_lookup(raw_by_year, year_key, 's14_condensate_m3')
                + _raw_lookup(raw_by_year, year_key, 's14_pentanes_plus_m3')
            )
            total_m3 = oil_sands_m3 + conventional_m3
        else:
            oil_sands_m3 = (
                _raw_lookup(raw_by_year, year_key, 's63_bitumen_m3')
                + _raw_lookup(raw_by_year, year_key, 's63_synthetic_crude_m3')
            )
            conventional_m3 = (
                _raw_lookup(raw_by_year, year_key, 's63_heavy_crude_m3')
                + _raw_lookup(raw_by_year, year_key, 's63_light_medium_m3')
                + _raw_lookup(raw_by_year, year_key, 's63_condensate_m3')
                + _raw_lookup(raw_by_year, year_key, 's63_pentanes_plus_m3')
            )
            total_m3 = (
                _raw_lookup(raw_by_year, year_key, 's63_crude_oil_prod_m3')
                + _raw_lookup(raw_by_year, year_key, 's63_equiv_products_m3')
            )

        if total_m3 <= 0 or oil_sands_m3 <= 0:
            continue

        oil_sands_thousand = oil_sands_m3 / 1000
        conventional_thousand = conventional_m3 / 1000
        total_thousand = total_m3 / 1000
        share_pct = round(oil_sands_m3 / total_m3 * 100)

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


def _transform_province_rows(raw_by_year: Dict[str, Dict[str, float]]) -> List[Tuple[str, str, float]]:
    rows: List[Tuple[str, str, float]] = []

    for year_key in sorted(raw_by_year.keys(), key=int):
        if int(year_key) < 2016:
            continue
        canada_m3 = _raw_lookup(raw_by_year, year_key, 's63_prov_canada_m3')
        if canada_m3 <= 0:
            continue

        province_m3: Dict[str, float] = {}
        complete = True
        for thousand_vec in CP_PROVINCE_GEOS:
            raw_key = S63_PROVINCE_RAW_KEYS[thousand_vec]
            value = _raw_lookup(raw_by_year, year_key, raw_key)
            if value <= 0:
                complete = False
                break
            province_m3[thousand_vec] = value
        if not complete:
            continue

        for thousand_vec in CP_OTHER_SUB_GEOS:
            raw_key = S63_PROVINCE_RAW_KEYS[thousand_vec]
            province_m3[thousand_vec] = max(_raw_lookup(raw_by_year, year_key, raw_key), 0.0)

        other_m3 = _raw_lookup(raw_by_year, year_key, 's63_prov_other_m3')
        rows.append(('cp_prov_canada_thousand_m3', year_key, round(canada_m3 / 1000, 1)))

        for thousand_vec, value_m3 in province_m3.items():
            rows.append((thousand_vec, year_key, round(value_m3 / 1000, 1)))
            pct_vec = CP_PROVINCE_PCT_VECTORS[thousand_vec]
            rows.append((pct_vec, year_key, _share_pct(value_m3, canada_m3)))

        rows.append(('cp_prov_other_thousand_m3', year_key, round(other_m3 / 1000, 1)))
        rows.append(('cp_prov_other_pct', year_key, _share_pct(other_m3, canada_m3)))

    return rows


def _raw_by_year_from_dataframe(df: pd.DataFrame) -> Dict[str, Dict[str, float]]:
    raw_by_year: Dict[str, Dict[str, float]] = {}
    for _, row in df.iterrows():
        vector = str(row['vector'])
        if not vector.startswith('raw_cp_'):
            continue
        year_key = str(row['ref_date'])
        try:
            value = float(row['value'])
        except (TypeError, ValueError):
            continue
        raw_by_year.setdefault(year_key, {})[vector] = value
    return raw_by_year


def _transform_rows_from_raw(raw_by_year: Dict[str, Dict[str, float]]) -> List[Tuple[str, str, float]]:
    return _transform_production_rows(raw_by_year) + _transform_province_rows(raw_by_year)


def _load_statcan_frames(config=None) -> Tuple[pd.DataFrame, pd.DataFrame, int, int]:
    df_old = _download_os_statcan_csv(STATCAN_TABLE_14, config=config)
    df_new = _download_os_statcan_csv(STATCAN_TABLE_63, config=config)
    max_prod_year = _cp_max_complete_production_year(df_old, df_new)
    max_prov_year = _cp_max_complete_province_year(df_new, max_prod_year)
    return df_old, df_new, max_prod_year, max_prov_year


def build_canadian_production_raw_rows(config=None) -> List[Tuple[str, str, float]]:
    df_old, df_new, max_prod_year, max_prov_year = _load_statcan_frames(config)
    return _build_raw_statcan_rows(df_old, df_new, max_prod_year, max_prov_year)


def build_canadian_production_indicator_rows(
    config=None,
) -> Tuple[List[Tuple[str, str, float]], List[Tuple[str, str, str, str, str, str]]]:
    """Build Page 111 indicator rows without SQL (offline export / tests)."""
    raw_rows = build_canadian_production_raw_rows(config)
    raw_by_year: Dict[str, Dict[str, float]] = {}
    for vector, year_key, value in raw_rows:
        raw_by_year.setdefault(year_key, {})[vector] = value
    return _transform_rows_from_raw(raw_by_year), list(CANADIAN_PRODUCTION_METADATA)


def build_canadian_production_rows(config=None) -> List[Tuple[str, str, float]]:
    """Backward-compatible alias — returns final cp_* indicator rows."""
    data_rows, _ = build_canadian_production_indicator_rows(config)
    return data_rows


def update_canadian_production(processor) -> int:
    """EEDAS ingest: StatCan 25-10-0014-01 and 25-10-0063-01 source-native rows."""
    print('  Fetching Canadian crude production (StatCan raw)...')
    rows = build_canadian_production_raw_rows(processor.config)
    if not rows:
        print('    WARNING: no Canadian production raw rows produced')
        return 0

    metadata_rows = [
        (
            vector,
            f'Canadian crude production raw — {vector.removeprefix("raw_cp_")}',
            'cubic metres',
            'cubic metres',
            'Statistics Canada',
            '',
        )
        for vector in sorted({row[0] for row in rows})
    ]
    print(f'    Prepared {len(rows)} source-native data points')
    return processor.replace_raw_data(SOURCE_KEY, rows, metadata_rows)


def transform_canadian_production(processor) -> int:
    """EFB transform: amalgamate StatCan raw rows into cp_* indicators for Page 111."""
    df = processor.get_raw_dataframe(SOURCE_KEY)
    if df.empty:
        print('    canadian_production transform: no raw rows found — re-run eedas update')
        return 0

    raw_by_year = _raw_by_year_from_dataframe(df)
    data_rows = _transform_rows_from_raw(raw_by_year)
    if not data_rows:
        print('    canadian_production transform: no indicator rows produced')
        return 0

    n = processor.store_indicators(SOURCE_KEY, data_rows, CANADIAN_PRODUCTION_METADATA)
    print(f'    Stored {n} indicator rows for canadian_production')
    return n
