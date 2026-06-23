"""Page 113 — oil sands capex and production share."""

import io
import zipfile
from collections import defaultdict
from datetime import datetime
from typing import Dict, List, Optional, Tuple

import pandas as pd

from config_loader import get_config
from utils.http_retry import fetch_get, resilience_from_config

from .constants import (
    CAPP_CONVENTIONAL_RESERVES_URL,
    CAPP_OIL_SANDS_CAPEX,
    CAPP_OIL_SANDS_INSITU_RESERVES_URL,
    CAPP_OIL_SANDS_MINING_RESERVES_URL,
    CAPP_UPGRADER_CAPACITY_URL,
    FETCH_UA,
    MM3_PER_M3,
    STATCAN_OS_CAPEX_VECTOR,
)

SOURCE_KEY = 'oil_sands'
OS_RAW_PREFIX = 'raw_os'

OS_S14_CATEGORY_KEYS = {
    'Heavy crude oil': 's14_heavy_crude_m3',
    'Light and medium crude oil': 's14_light_medium_m3',
    'Synthetic crude oil': 's14_synthetic_crude_m3',
    'Crude bitumen': 's14_crude_bitumen_m3',
    'Total crude production': 's14_total_crude_m3',
}

OS_S63_CATEGORY_KEYS = {
    'Heavy crude oil': 's63_heavy_crude_m3',
    'Light and medium crude oil': 's63_light_medium_m3',
    'Non-upgraded production of crude bitumen': 's63_bitumen_m3',
    'Synthetic crude oil production': 's63_synthetic_crude_m3',
    'Crude oil production': 's63_crude_oil_prod_m3',
    'Equivalent products production': 's63_equiv_products_m3',
}

OS_S63_ALBERTA_UPGRADING_KEYS = {
    'Crude bitumen sent for further processing': 'ab_bitumen_sent_m3',
    'In-Situ crude bitumen production': 'ab_insitu_m3',
    'Mined crude bitumen production': 'ab_mined_m3',
}

OS_S14_ALBERTA_UPGRADING_KEYS = {
    'Crude bitumen': 'ab_bitumen_m3',
    'Synthetic crude oil': 'ab_synthetic_m3',
}


def _http_get(url: str, *, timeout: int = 120, headers=FETCH_UA, config=None, label: str = "HTTP"):
    cfg = config or get_config()
    max_r, delay = resilience_from_config(cfg)
    return fetch_get(
        url, timeout=timeout, headers=headers,
        max_retries=max_r, retry_delay_seconds=delay, label=label,
    )


def _fetch_os_statcan_capex_annual(config=None) -> Dict[int, float]:
    url = (
        'https://www150.statcan.gc.ca/t1/wds/rest/getDataFromVectorByReferencePeriodRange'
        f'?vectorIds={STATCAN_OS_CAPEX_VECTOR}&startRefPeriod=2006-01-01&endReferencePeriod=2030-12-31'
    )
    response = _http_get(url, timeout=120, headers=FETCH_UA, config=config, label="Oil sands StatCan WDS")
    points = response.json()[0]['object']['vectorDataPoint']
    by_year: Dict[int, float] = {}
    for point in points:
        value = point.get('value')
        if value is None:
            continue
        year = int(str(point['refPer'])[:4])
        by_year[year] = float(value)
    return by_year


def _download_os_statcan_csv(table_id: str, config=None) -> pd.DataFrame:
    url = f'https://www150.statcan.gc.ca/n1/tbl/csv/{table_id}-eng.zip'
    response = _http_get(url, timeout=180, headers=FETCH_UA, config=config, label="Oil sands StatCan CSV")
    archive = zipfile.ZipFile(io.BytesIO(response.content))
    csv_name = next(name for name in archive.namelist() if name.endswith('.csv'))
    return pd.read_csv(archive.open(csv_name), low_memory=False)


def _os_annual_canada_totals(df: pd.DataFrame, year: int) -> Dict[str, float]:
    year_df = df[
        (df['GEO'] == 'Canada')
        & (df['UOM'] == 'Cubic metres')
        & (df['REF_DATE'].astype(str).str.startswith(str(year)))
    ]
    return year_df.groupby('Supply and disposition')['VALUE'].sum().to_dict()


def _os_annual_geo_totals(df: pd.DataFrame, year: int, geo: str) -> Dict[str, float]:
    year_df = df[
        (df['GEO'] == geo)
        & (df['UOM'] == 'Cubic metres')
        & (df['REF_DATE'].astype(str).str.startswith(str(year)))
    ]
    return year_df.groupby('Supply and disposition')['VALUE'].sum().to_dict()


def _os_upgrading_pct(values: Dict[str, float]) -> Optional[float]:
    sent = values.get('Crude bitumen sent for further processing', 0.0)
    raw = values.get('In-Situ crude bitumen production', 0.0) + values.get(
        'Mined crude bitumen production', 0.0
    )
    if raw <= 0 or sent <= 0:
        return None
    return float(round(sent / raw * 100))


def _download_capp_xlsx(url: str, config=None) -> pd.DataFrame:
    response = _http_get(url, timeout=180, headers=FETCH_UA, config=config, label="CAPP XLSX")
    archive = pd.ExcelFile(io.BytesIO(response.content))
    return pd.read_excel(archive, sheet_name=archive.sheet_names[0], header=None)


def _os_m3cd_to_mmbd(m3_per_calendar_day: float) -> float:
    return round(float(m3_per_calendar_day) * MM3_PER_M3 / 1_000_000, 1)


def _os_year_month_count(df: pd.DataFrame, year: int) -> int:
    year_df = df[
        (df['GEO'] == 'Canada')
        & (df['UOM'] == 'Cubic metres')
        & (df['REF_DATE'].astype(str).str.startswith(str(year)))
    ]
    if year_df.empty:
        return 0
    return year_df['REF_DATE'].astype(str).nunique()


def _os_max_complete_production_year(df_old: pd.DataFrame, df_new: pd.DataFrame) -> int:
    """Latest calendar year with 12 months of StatCan production data."""
    max_year = 0
    for year in range(2000, datetime.now().year + 1):
        source = df_old if year <= 2015 else df_new
        if _os_year_month_count(source, year) >= 12:
            max_year = year
    return max_year


def _os_upgrading_pct_legacy(df_old: pd.DataFrame, year: int) -> Optional[float]:
    """Pre-2016 proxy: Alberta synthetic crude share of total bitumen output."""
    values = _os_annual_geo_totals(df_old, year, 'Alberta')
    bitumen = values.get('Crude bitumen', 0.0)
    synthetic = values.get('Synthetic crude oil', 0.0)
    total = bitumen + synthetic
    if total <= 0:
        return None
    return float(round(synthetic / total * 100))


def _build_os_upgrading_rows(
    df_old: pd.DataFrame,
    df_new: pd.DataFrame,
    max_year: int,
) -> List[Tuple[str, str, float]]:
    rows: List[Tuple[str, str, float]] = []
    for year in range(2000, max_year + 1):
        if year <= 2015:
            pct = _os_upgrading_pct_legacy(df_old, year)
        else:
            values = _os_annual_geo_totals(df_new, year, 'Alberta')
            pct = _os_upgrading_pct(values) if values else None
        if pct is not None:
            rows.append(('os_upgrading_pct', str(year), pct))
    return rows


def _build_os_raw_upgrading_rows(
    df_old: pd.DataFrame,
    df_new: pd.DataFrame,
    max_year: int,
) -> List[Tuple[str, str, float]]:
    rows: List[Tuple[str, str, float]] = []
    for year in range(2000, max_year + 1):
        year_key = str(year)
        if year <= 2015:
            values = _os_annual_geo_totals(df_old, year, 'Alberta')
            if not values:
                continue
            for label, raw_key in OS_S14_ALBERTA_UPGRADING_KEYS.items():
                amount = values.get(label, 0.0)
                if amount > 0:
                    rows.append((f'{OS_RAW_PREFIX}_{raw_key}', year_key, float(amount * 1000)))
        else:
            values = _os_annual_geo_totals(df_new, year, 'Alberta')
            if not values:
                continue
            for label, raw_key in OS_S63_ALBERTA_UPGRADING_KEYS.items():
                amount = values.get(label, 0.0)
                if amount > 0:
                    rows.append((f'{OS_RAW_PREFIX}_{raw_key}', year_key, float(amount)))
    return rows


def _transform_os_upgrading_rows(raw_by_year: Dict[str, Dict[str, float]]) -> List[Tuple[str, str, float]]:
    rows: List[Tuple[str, str, float]] = []
    for year_key in sorted(raw_by_year.keys(), key=int):
        year = int(year_key)
        raw = raw_by_year[year_key]
        if year <= 2015:
            bitumen = raw.get(f'{OS_RAW_PREFIX}_ab_bitumen_m3', 0.0)
            synthetic = raw.get(f'{OS_RAW_PREFIX}_ab_synthetic_m3', 0.0)
            total = bitumen + synthetic
            if total <= 0:
                continue
            pct = float(round(synthetic / total * 100))
        else:
            sent = raw.get(f'{OS_RAW_PREFIX}_ab_bitumen_sent_m3', 0.0)
            insitu = raw.get(f'{OS_RAW_PREFIX}_ab_insitu_m3', 0.0)
            mined = raw.get(f'{OS_RAW_PREFIX}_ab_mined_m3', 0.0)
            denominator = insitu + mined
            if denominator <= 0 or sent <= 0:
                continue
            pct = float(round(sent / denominator * 100))
        rows.append(('os_upgrading_pct', year_key, pct))
    return rows


def _build_os_upgrader_capacity_rows(max_year: int, config=None) -> List[Tuple[str, str, float]]:
    df = _download_capp_xlsx(CAPP_UPGRADER_CAPACITY_URL, config=config)
    rows: List[Tuple[str, str, float]] = []
    for _, row in df.iterrows():
        year = row.iloc[0]
        if pd.isna(year) or not isinstance(year, (int, float)) or year < 2000 or year > max_year:
            continue
        capacity_m3cd = row.iloc[24]
        if pd.isna(capacity_m3cd):
            continue
        rows.append(('os_upgrading_capacity_mmbd', str(int(year)), _os_m3cd_to_mmbd(capacity_m3cd)))
    return rows


def _build_os_raw_upgrader_capacity_rows(max_year: int, config=None) -> List[Tuple[str, str, float]]:
    df = _download_capp_xlsx(CAPP_UPGRADER_CAPACITY_URL, config=config)
    rows: List[Tuple[str, str, float]] = []
    for _, row in df.iterrows():
        year = row.iloc[0]
        if pd.isna(year) or not isinstance(year, (int, float)) or year < 2000 or year > max_year:
            continue
        capacity_m3cd = row.iloc[24]
        if pd.isna(capacity_m3cd):
            continue
        rows.append((f'{OS_RAW_PREFIX}_upgrader_capacity_m3cd', str(int(year)), float(capacity_m3cd)))
    return rows


def _transform_os_upgrader_capacity_rows(raw_by_year: Dict[str, Dict[str, float]]) -> List[Tuple[str, str, float]]:
    rows: List[Tuple[str, str, float]] = []
    for year_key in sorted(raw_by_year.keys(), key=int):
        capacity_m3cd = raw_by_year[year_key].get(f'{OS_RAW_PREFIX}_upgrader_capacity_m3cd')
        if capacity_m3cd is None or capacity_m3cd <= 0:
            continue
        rows.append(('os_upgrading_capacity_mmbd', year_key, _os_m3cd_to_mmbd(capacity_m3cd)))
    return rows


def _build_os_proved_reserves_rows(max_year: int, config=None) -> List[Tuple[str, str, float]]:
    pct_by_year = _build_os_reserves_pct_by_year(max_year, config=config)
    rows: List[Tuple[str, str, float]] = []
    last_pct: Optional[float] = None
    for year in range(2000, max_year + 1):
        if year in pct_by_year:
            last_pct = pct_by_year[year]
        if last_pct is None:
            continue
        rows.append(('os_proved_reserves_pct', str(year), last_pct))
    return rows


def _build_os_raw_reserves_rows(max_year: int, config=None) -> List[Tuple[str, str, float]]:
    mining = _download_capp_xlsx(CAPP_OIL_SANDS_MINING_RESERVES_URL, config=config)
    insitu = _download_capp_xlsx(CAPP_OIL_SANDS_INSITU_RESERVES_URL, config=config)
    conventional = _download_capp_xlsx(CAPP_CONVENTIONAL_RESERVES_URL, config=config)
    rows: List[Tuple[str, str, float]] = []

    for df, suffix in ((mining, 'mining_end'), (insitu, 'insitu_end')):
        for _, row in df.iterrows():
            year = row.iloc[0]
            end_reserves = row.iloc[4]
            if pd.isna(year) or not isinstance(year, (int, float)) or pd.isna(end_reserves):
                continue
            year_int = int(year)
            if year_int < 2000 or year_int > max_year:
                continue
            rows.append((f'{OS_RAW_PREFIX}_reserves_{suffix}', str(year_int), float(end_reserves)))

    for _, row in conventional.iterrows():
        year = row.iloc[1]
        light = row.iloc[22]
        heavy = row.iloc[23]
        if pd.isna(year) or not isinstance(year, (int, float)):
            continue
        year_int = int(year)
        if year_int < 2000 or year_int > max_year:
            continue
        try:
            light_val = float(light)
            heavy_val = float(heavy)
        except (TypeError, ValueError):
            continue
        rows.append((f'{OS_RAW_PREFIX}_reserves_conventional_light', str(year_int), light_val))
        rows.append((f'{OS_RAW_PREFIX}_reserves_conventional_heavy', str(year_int), heavy_val))

    return rows


def _build_os_reserves_pct_by_year(max_year: int, config=None) -> Dict[int, float]:
    mining = _download_capp_xlsx(CAPP_OIL_SANDS_MINING_RESERVES_URL, config=config)
    insitu = _download_capp_xlsx(CAPP_OIL_SANDS_INSITU_RESERVES_URL, config=config)
    conventional = _download_capp_xlsx(CAPP_CONVENTIONAL_RESERVES_URL, config=config)

    oil_sands_by_year: Dict[int, float] = defaultdict(float)
    for df in (mining, insitu):
        for _, row in df.iterrows():
            year = row.iloc[0]
            end_reserves = row.iloc[4]
            if pd.isna(year) or not isinstance(year, (int, float)) or pd.isna(end_reserves):
                continue
            oil_sands_by_year[int(year)] += float(end_reserves)

    conventional_by_year: Dict[int, float] = {}
    for _, row in conventional.iterrows():
        year = row.iloc[1]
        light = row.iloc[22]
        heavy = row.iloc[23]
        if pd.isna(year) or not isinstance(year, (int, float)):
            continue
        try:
            light_val = float(light)
            heavy_val = float(heavy)
        except (TypeError, ValueError):
            continue
        conventional_by_year[int(year)] = light_val + heavy_val

    pct_by_year: Dict[int, float] = {}
    for year in sorted(set(oil_sands_by_year.keys()) & set(conventional_by_year.keys())):
        if year < 2000:
            continue
        oil_sands_bbbl = oil_sands_by_year[year] * 1000 * MM3_PER_M3 / 1_000_000_000
        conventional_bbbl = conventional_by_year[year] * 1000 * MM3_PER_M3 / 1_000_000_000
        total_bbbl = oil_sands_bbbl + conventional_bbbl
        if total_bbbl <= 0:
            continue
        pct_by_year[year] = float(round(oil_sands_bbbl / total_bbbl * 100))
    return pct_by_year


def _transform_os_proved_reserves_rows(raw_by_year: Dict[str, Dict[str, float]]) -> List[Tuple[str, str, float]]:
    pct_by_year: Dict[int, float] = {}
    for year_key in sorted(raw_by_year.keys(), key=int):
        raw = raw_by_year[year_key]
        mining = raw.get(f'{OS_RAW_PREFIX}_reserves_mining_end', 0.0)
        insitu = raw.get(f'{OS_RAW_PREFIX}_reserves_insitu_end', 0.0)
        light = raw.get(f'{OS_RAW_PREFIX}_reserves_conventional_light')
        heavy = raw.get(f'{OS_RAW_PREFIX}_reserves_conventional_heavy')
        if light is None or heavy is None:
            continue
        oil_sands_bbbl = (mining + insitu) * 1000 * MM3_PER_M3 / 1_000_000_000
        conventional_bbbl = (float(light) + float(heavy)) * 1000 * MM3_PER_M3 / 1_000_000_000
        total_bbbl = oil_sands_bbbl + conventional_bbbl
        if total_bbbl <= 0:
            continue
        pct_by_year[int(year_key)] = float(round(oil_sands_bbbl / total_bbbl * 100))

    rows: List[Tuple[str, str, float]] = []
    if not pct_by_year:
        return rows
    max_year = max(pct_by_year.keys())
    last_pct: Optional[float] = None
    for year in range(2000, max_year + 1):
        if year in pct_by_year:
            last_pct = pct_by_year[year]
        if last_pct is None:
            continue
        rows.append(('os_proved_reserves_pct', str(year), last_pct))
    return rows


def _os_to_mmbd(annual_m3: float) -> float:
    thousand_m3 = annual_m3 / 1000
    return round(thousand_m3 * MM3_PER_M3 / 1000 / 365, 1)


def _build_os_production_rows(
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
            oil_sands_thousand = values.get('Crude bitumen', 0.0) + values.get('Synthetic crude oil', 0.0)
            conventional_thousand = (
                values.get('Light and medium crude oil', 0.0) + values.get('Heavy crude oil', 0.0)
            )
            total_thousand = values.get('Total crude production', 0.0)
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
            conventional_m3 = values.get('Light and medium crude oil', 0.0) + values.get(
                'Heavy crude oil', 0.0
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
            ('os_oil_sands_thousand_m3', year_key, round(oil_sands_thousand, 1)),
            ('os_conventional_thousand_m3', year_key, round(conventional_thousand, 1)),
            ('os_total_thousand_m3', year_key, round(total_thousand, 1)),
            ('os_oil_sands_mmbd', year_key, _os_to_mmbd(oil_sands_m3)),
            ('os_conventional_mmbd', year_key, _os_to_mmbd(conventional_m3)),
            ('os_total_mmbd', year_key, _os_to_mmbd(total_m3)),
            ('os_share_pct', year_key, float(share_pct)),
        ])

    return rows


def _build_os_raw_statcan_rows(
    df_old: pd.DataFrame,
    df_new: pd.DataFrame,
    max_year: int,
) -> List[Tuple[str, str, float]]:
    rows: List[Tuple[str, str, float]] = []
    for year in range(2000, min(max_year, 2015) + 1):
        if _os_year_month_count(df_old, year) < 12:
            continue
        values = _os_annual_canada_totals(df_old, year)
        if not values:
            continue
        year_key = str(year)
        for label, raw_key in OS_S14_CATEGORY_KEYS.items():
            amount = values.get(label, 0.0)
            if amount > 0:
                rows.append((f'{OS_RAW_PREFIX}_{raw_key}', year_key, float(amount * 1000)))

    for year in range(2016, max_year + 1):
        if _os_year_month_count(df_new, year) < 12:
            continue
        values = _os_annual_canada_totals(df_new, year)
        if not values:
            continue
        year_key = str(year)
        for label, raw_key in OS_S63_CATEGORY_KEYS.items():
            amount = values.get(label, 0.0)
            if amount > 0:
                rows.append((f'{OS_RAW_PREFIX}_{raw_key}', year_key, float(amount)))
    return rows


def _raw_lookup(raw_by_year: Dict[str, Dict[str, float]], year: str, key: str) -> float:
    return raw_by_year.get(year, {}).get(f'{OS_RAW_PREFIX}_{key}', 0.0)


def _transform_os_production_rows(raw_by_year: Dict[str, Dict[str, float]]) -> List[Tuple[str, str, float]]:
    rows: List[Tuple[str, str, float]] = []
    for year_key in sorted(raw_by_year.keys(), key=int):
        year = int(year_key)
        if year <= 2015:
            oil_sands_m3 = (
                _raw_lookup(raw_by_year, year_key, 's14_crude_bitumen_m3')
                + _raw_lookup(raw_by_year, year_key, 's14_synthetic_crude_m3')
            )
            conventional_m3 = (
                _raw_lookup(raw_by_year, year_key, 's14_heavy_crude_m3')
                + _raw_lookup(raw_by_year, year_key, 's14_light_medium_m3')
            )
            total_m3 = _raw_lookup(raw_by_year, year_key, 's14_total_crude_m3')
            if total_m3 <= 0:
                continue
        else:
            oil_sands_m3 = (
                _raw_lookup(raw_by_year, year_key, 's63_bitumen_m3')
                + _raw_lookup(raw_by_year, year_key, 's63_synthetic_crude_m3')
            )
            conventional_m3 = (
                _raw_lookup(raw_by_year, year_key, 's63_heavy_crude_m3')
                + _raw_lookup(raw_by_year, year_key, 's63_light_medium_m3')
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
            ('os_oil_sands_thousand_m3', year_key, round(oil_sands_thousand, 1)),
            ('os_conventional_thousand_m3', year_key, round(conventional_thousand, 1)),
            ('os_total_thousand_m3', year_key, round(total_thousand, 1)),
            ('os_oil_sands_mmbd', year_key, _os_to_mmbd(oil_sands_m3)),
            ('os_conventional_mmbd', year_key, _os_to_mmbd(conventional_m3)),
            ('os_total_mmbd', year_key, _os_to_mmbd(total_m3)),
            ('os_share_pct', year_key, float(share_pct)),
        ])
    return rows


def _build_os_capex_rows(config=None) -> List[Tuple[str, str, float]]:
    statcan_annual = _fetch_os_statcan_capex_annual(config=config)
    rows: List[Tuple[str, str, float]] = []

    for year, millions in sorted(CAPP_OIL_SANDS_CAPEX.items()):
        rows.append(('os_capex_capp_m', str(year), round(millions, 1)))

    all_years = sorted(set(CAPP_OIL_SANDS_CAPEX.keys()) | set(statcan_annual.keys()))
    cumulative_m = 0.0
    for year in all_years:
        if year in CAPP_OIL_SANDS_CAPEX:
            cumulative_m += CAPP_OIL_SANDS_CAPEX[year]
        if year in statcan_annual:
            cumulative_m += statcan_annual[year]
            rows.append(('os_capex_statcan_m', str(year), round(statcan_annual[year], 1)))
        rows.append(('os_capex_cumulative_bn', str(year), round(cumulative_m / 1000, 1)))

    return rows


def _build_os_raw_capex_rows(config=None) -> List[Tuple[str, str, float]]:
    statcan_annual = _fetch_os_statcan_capex_annual(config=config)
    rows: List[Tuple[str, str, float]] = []
    for year, millions in sorted(CAPP_OIL_SANDS_CAPEX.items()):
        rows.append((f'{OS_RAW_PREFIX}_capp_capex_m', str(year), round(millions, 1)))
    for year, millions in sorted(statcan_annual.items()):
        rows.append((f'{OS_RAW_PREFIX}_statcan_capex_m', str(year), round(millions, 1)))
    return rows


def _transform_os_capex_rows(raw_by_year: Dict[str, Dict[str, float]]) -> List[Tuple[str, str, float]]:
    capex_years = sorted({
        int(year)
        for year, raw in raw_by_year.items()
        if f'{OS_RAW_PREFIX}_capp_capex_m' in raw or f'{OS_RAW_PREFIX}_statcan_capex_m' in raw
    })
    if not capex_years:
        return []

    rows: List[Tuple[str, str, float]] = []
    cumulative_m = 0.0
    for year in capex_years:
        year_key = str(year)
        raw = raw_by_year.get(year_key, {})
        if f'{OS_RAW_PREFIX}_capp_capex_m' in raw:
            capp_m = raw[f'{OS_RAW_PREFIX}_capp_capex_m']
            rows.append(('os_capex_capp_m', year_key, round(capp_m, 1)))
            cumulative_m += capp_m
        if f'{OS_RAW_PREFIX}_statcan_capex_m' in raw:
            statcan_m = raw[f'{OS_RAW_PREFIX}_statcan_capex_m']
            rows.append(('os_capex_statcan_m', year_key, round(statcan_m, 1)))
            cumulative_m += statcan_m
        rows.append(('os_capex_cumulative_bn', year_key, round(cumulative_m / 1000, 1)))
    return rows


def _raw_by_year_from_dataframe(df: pd.DataFrame) -> Dict[str, Dict[str, float]]:
    raw_by_year: Dict[str, Dict[str, float]] = {}
    for _, row in df.iterrows():
        vector = str(row['vector'])
        if not vector.startswith(f'{OS_RAW_PREFIX}_'):
            continue
        year_key = str(row['ref_date'])
        try:
            value = float(row['value'])
        except (TypeError, ValueError):
            continue
        raw_by_year.setdefault(year_key, {})[vector] = value
    return raw_by_year


def _transform_os_rows_from_raw(raw_by_year: Dict[str, Dict[str, float]]) -> List[Tuple[str, str, float]]:
    return (
        _transform_os_capex_rows(raw_by_year)
        + _transform_os_production_rows(raw_by_year)
        + _transform_os_upgrading_rows(raw_by_year)
        + _transform_os_upgrader_capacity_rows(raw_by_year)
        + _transform_os_proved_reserves_rows(raw_by_year)
    )


def build_oil_sands_raw_rows(config=None) -> List[Tuple[str, str, float]]:
    df_old = _download_os_statcan_csv('25100014', config=config)
    df_new = _download_os_statcan_csv('25100063', config=config)
    max_year = _os_max_complete_production_year(df_old, df_new)
    return (
        _build_os_raw_capex_rows(config=config)
        + _build_os_raw_statcan_rows(df_old, df_new, max_year)
        + _build_os_raw_upgrading_rows(df_old, df_new, max_year)
        + _build_os_raw_upgrader_capacity_rows(max_year, config=config)
        + _build_os_raw_reserves_rows(max_year, config=config)
    )


def build_oil_sands_indicator_rows(config=None) -> List[Tuple[str, str, float]]:
    """Build Page 113 indicator rows without SQL (offline export / tests)."""
    raw_rows = build_oil_sands_raw_rows(config)
    raw_by_year: Dict[str, Dict[str, float]] = {}
    for vector, year_key, value in raw_rows:
        raw_by_year.setdefault(year_key, {})[vector] = value
    return _transform_os_rows_from_raw(raw_by_year)


def build_oil_sands_rows(config=None) -> List[Tuple[str, str, float]]:
    """Backward-compatible alias — returns final os_* indicator rows."""
    return build_oil_sands_indicator_rows(config)


def update_oil_sands(processor) -> int:
    """EEDAS ingest: CAPP + StatCan capex/production/upgrader/reserves source-native rows."""
    print('  Fetching oil sands capex and production share (raw)...')
    rows = build_oil_sands_raw_rows(config=processor.config)
    if not rows:
        raise RuntimeError('oil_sands: no source-native rows produced')
    metadata_rows = [
        (
            vector,
            f'Oil sands raw — {vector.removeprefix(OS_RAW_PREFIX + "_")}',
            'units',
            'units',
            'Mixed sources',
            '',
        )
        for vector in sorted({row[0] for row in rows})
    ]
    print(f'    Prepared {len(rows)} source-native data points')
    return processor.replace_raw_data(SOURCE_KEY, rows, metadata_rows)


def transform_oil_sands(processor) -> int:
    """EFB transform: amalgamate oil sands raw rows into os_* indicators for Page 113."""
    df = processor.get_raw_dataframe(SOURCE_KEY)
    if df.empty:
        raise RuntimeError('oil_sands transform: no raw rows found — re-run eedas update')

    raw_by_year = _raw_by_year_from_dataframe(df)
    data_rows = _transform_os_rows_from_raw(raw_by_year)
    if not data_rows:
        raise RuntimeError('oil_sands transform: no indicator rows produced')

    from .constants import OIL_SANDS_METADATA
    n = processor.store_indicators(SOURCE_KEY, data_rows, OIL_SANDS_METADATA)
    print(f'    Stored {n} indicator rows for oil_sands')
    return n
