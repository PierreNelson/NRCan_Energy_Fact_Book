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


def _build_os_proved_reserves_rows(max_year: int, config=None) -> List[Tuple[str, str, float]]:
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

    rows: List[Tuple[str, str, float]] = []
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


def build_oil_sands_rows(config=None) -> List[Tuple[str, str, float]]:
    df_old = _download_os_statcan_csv('25100014', config=config)
    df_new = _download_os_statcan_csv('25100063', config=config)
    max_year = _os_max_complete_production_year(df_old, df_new)
    return (
        _build_os_capex_rows(config=config)
        + _build_os_production_rows(df_old, df_new, max_year)
        + _build_os_upgrading_rows(df_old, df_new, max_year)
        + _build_os_upgrader_capacity_rows(max_year, config=config)
        + _build_os_proved_reserves_rows(max_year, config=config)
    )


SOURCE_KEY = 'oil_sands'


def update_oil_sands(processor) -> int:
    """EEDAS ingest: CAPP + StatCan capex/production/upgrader/reserves source-native rows."""
    print('  Fetching oil sands capex and production share (raw)...')
    rows = build_oil_sands_rows(config=processor.config)
    if not rows:
        raise RuntimeError('oil_sands: no source-native rows produced')
    data_rows = [(f'raw_{vec}', ref, val) for vec, ref, val in rows]
    metadata_rows = [
        (f'raw_{vec}', f'Oil sands raw — {vec}', 'units', 'units', 'Mixed sources', '')
        for vec in sorted({r[0] for r in rows})
    ]
    print(f'    Prepared {len(data_rows)} source-native data points')
    return processor.replace_raw_data(SOURCE_KEY, data_rows, metadata_rows)


def transform_oil_sands(processor) -> int:
    """EFB transform: map raw oil sands rows to os_* indicators."""
    df = processor.get_raw_dataframe(SOURCE_KEY)
    if df.empty:
        raise RuntimeError('oil_sands transform: no raw rows found')

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
        raise RuntimeError('oil_sands transform: no indicator rows produced')

    from .constants import OIL_SANDS_METADATA
    n = processor.store_indicators(SOURCE_KEY, data_rows, OIL_SANDS_METADATA)
    print(f'    Stored {n} indicator rows for oil_sands')
    return n
