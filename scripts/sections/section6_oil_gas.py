"""
Section 6: Oil, natural gas and coal data processor.

Page 136 — supply and demand of refined petroleum products (RPPs):
- StatCan Table 25-10-0081-01 (supply, disposition, product shares)
- StatCan Table 25-10-0063-01 (refinery input)

Page 113 — oil sands capex and production share:
- CAPP historical capex (1958–2005)
- StatCan 34-10-0036-01 vector v95928097 (2006+)
- StatCan 25-10-0014-01 (2000–2015) + 25-10-0063-01 (2016+)
- CAPP Statistics Handbook 07-01 (upgrader capacity)
- CAPP Statistics Handbook 02-07/02-08/02-02 (proved reserves share)

Page 117 — WTI and WCS crude prices:
- U.S. EIA WTI spot (monthly)
- Sproule ERCE WCS (monthly)
- Bank of Canada USD/CAD (monthly)
"""

from pathlib import Path
import io
import json
import re
import statistics
import time
import zipfile
from collections import defaultdict
from datetime import datetime
from typing import Dict, List, Optional, Tuple

import pandas as pd
import requests
from bs4 import BeautifulSoup

from .base import SectionProcessor
from xlsx_paths import resolve_root_xlsx

# StatCan vector IDs (numeric, without leading v)
SUPPLY_VECTORS = {
    'net_production': 1251227423,
    'imports': 1251227447,
    'exports': 1251227496,
    'domestic_consumption': 1251227512,
}

PRODUCT_VECTORS = {
    'motor_gasoline': 1251227513,
    'distillate': 1251227517,
    'still_gas': 1251227521,
    'jet': 1251227515,
    'coke': 1251227519,
    'residual': 1251227518,
    'asphalt': 1251227520,
}

REFINERY_INPUT_VECTOR = 107757076

MM3_PER_M3 = 6.2898
STATCAN_SUPPLY_URL = 'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=2510008101'
STATCAN_REFINERY_URL = 'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=2510006301'

STATCAN_OS_CAPEX_VECTOR = 95928097
CAPP_UPGRADER_CAPACITY_URL = (
    'https://www.capp.ca/wp-content/uploads/2026/05/07-01-Refinery-and-Upgrader-Capacity-1.xlsx'
)
CAPP_OIL_SANDS_MINING_RESERVES_URL = (
    'https://www.capp.ca/wp-content/uploads/2025/12/02-07-Mining-and-Upgraded-Historical-Remaining.xlsx'
)
CAPP_OIL_SANDS_INSITU_RESERVES_URL = (
    'https://www.capp.ca/wp-content/uploads/2025/12/02-08-In-Situ-Historical-Remaining.xlsx'
)
CAPP_CONVENTIONAL_RESERVES_URL = (
    'https://www.capp.ca/wp-content/uploads/2025/12/02-02-Crude-Oil-by-Type-Remaining-Established.xlsx'
)
FETCH_UA = {'User-Agent': 'Mozilla/5.0 (compatible; NRCan-Energy-Factbook/1.0)'}
EIA_WTI_XLS = 'https://www.eia.gov/dnav/pet/xls/PET_PRI_SPT_S1_M.xls'
SPROULE_BASE = 'https://sproule-erce.com/wp-content/uploads'
BOC_VALET = 'https://www.bankofcanada.ca/valet/observations/{series}/json'

CRUDE_PRICES_METADATA = [
    ('crude_wti', 'West Texas Intermediate (WTI) spot price', 'US dollars per barrel', 'units'),
    ('crude_wcs_cad', 'Western Canadian Select (WCS) price', 'Canadian dollars per barrel', 'units'),
    ('crude_usd_cad', 'USD to CAD exchange rate', 'CAD per USD', 'units'),
    ('crude_wcs_usd', 'Western Canadian Select (WCS) USD equivalent', 'US dollars per barrel', 'units'),
    ('crude_differential', 'WTI minus WCS (USD) differential', 'US dollars per barrel', 'units'),
]

CAPP_OIL_SANDS_CAPEX: Dict[int, float] = {
    1958: 0.5, 1959: 1.2, 1960: 1.2, 1961: 1.7, 1962: 25.0, 1963: 40.5, 1964: 80.4,
    1965: 81.6, 1966: 131.5, 1967: 72.5, 1968: 38.8, 1969: 16.9, 1970: 24.8, 1971: 26.9,
    1972: 13.7, 1973: 27.5, 1974: 102.0, 1975: 442.5, 1976: 623.0, 1977: 550.3, 1978: 399.8,
    1979: 245.2, 1980: 430.5, 1981: 541.1, 1982: 386.1, 1983: 422.6, 1984: 510.3, 1985: 1131.5,
    1986: 612.8, 1987: 539.5, 1988: 863.6, 1989: 422.4, 1990: 730.7, 1991: 1090.5, 1992: 639.1,
    1993: 340.8, 1994: 272.6, 1995: 571.9, 1996: 1286.3, 1997: 1914.5, 1998: 1542.5, 1999: 2371.7,
    2000: 4222.6, 2001: 5907.3, 2002: 6750.8, 2003: 5048.2, 2004: 6183.1, 2005: 10437.2,
}

OIL_SANDS_METADATA = [
    ('os_capex_capp_m', 'Oil sands capital expenditures (CAPP)', 'millions of dollars', 'units'),
    ('os_capex_statcan_m', 'Oil sands capital expenditures (StatCan)', 'millions of dollars', 'units'),
    ('os_capex_cumulative_bn', 'Cumulative oil sands capital expenditures', 'billions of dollars', 'units'),
    ('os_oil_sands_thousand_m3', 'Oil sands production', 'thousand cubic metres', 'units'),
    ('os_conventional_thousand_m3', 'Conventional crude production', 'thousand cubic metres', 'units'),
    ('os_total_thousand_m3', 'Total crude oil and equivalent production', 'thousand cubic metres', 'units'),
    ('os_oil_sands_mmbd', 'Oil sands production', 'million barrels per day', 'units'),
    ('os_conventional_mmbd', 'Conventional crude production', 'million barrels per day', 'units'),
    ('os_total_mmbd', 'Total crude oil and equivalent production', 'million barrels per day', 'units'),
    ('os_share_pct', 'Oil sands share of Canadian oil production', 'percent', 'units'),
    ('os_proved_reserves_pct', 'Oil sands share of Canada\'s proved reserves', 'percent', 'units'),
    ('os_upgrading_pct', 'Raw bitumen sent for upgrading in Alberta', 'percent', 'units'),
    ('os_upgrading_capacity_mmbd', 'Total oil sands upgrader capacity in Canada', 'million barrels per day', 'units'),
]

CANADIAN_PRODUCTION_METADATA = [
    ('cp_oil_sands_thousand_m3', 'Oil sands production (Page 111)', 'thousand cubic metres', 'units'),
    ('cp_conventional_thousand_m3', 'Conventional crude production (Page 111)', 'thousand cubic metres', 'units'),
    ('cp_total_thousand_m3', 'Total crude oil production (Page 111)', 'thousand cubic metres', 'units'),
    ('cp_oil_sands_mmbd', 'Oil sands production (Page 111)', 'million barrels per day', 'units'),
    ('cp_conventional_mmbd', 'Conventional crude production (Page 111)', 'million barrels per day', 'units'),
    ('cp_total_mmbd', 'Total crude oil production (Page 111)', 'million barrels per day', 'units'),
    ('cp_share_pct', 'Oil sands share of Canadian oil production (Page 111)', 'percent', 'units'),
    ('cp_prov_canada_thousand_m3', 'Canadian crude oil production by province total', 'thousand cubic metres', 'units'),
    ('cp_prov_ab_thousand_m3', 'Alberta crude oil production', 'thousand cubic metres', 'units'),
    ('cp_prov_sk_thousand_m3', 'Saskatchewan crude oil production', 'thousand cubic metres', 'units'),
    ('cp_prov_nl_thousand_m3', 'Newfoundland and Labrador crude oil production', 'thousand cubic metres', 'units'),
    ('cp_prov_mb_thousand_m3', 'Manitoba crude oil production', 'thousand cubic metres', 'units'),
    ('cp_prov_bc_thousand_m3', 'British Columbia crude oil production', 'thousand cubic metres', 'units'),
    ('cp_prov_other_thousand_m3', 'Other provinces crude oil production', 'thousand cubic metres', 'units'),
]

CP_PROVINCE_GEOS = {
    'cp_prov_ab_thousand_m3': 'Alberta',
    'cp_prov_sk_thousand_m3': 'Saskatchewan',
    'cp_prov_nl_thousand_m3': 'Newfoundland and Labrador',
    'cp_prov_mb_thousand_m3': 'Manitoba',
    'cp_prov_bc_thousand_m3': 'British Columbia',
}


def _crude_month_key(dt: datetime) -> int:
    return dt.year * 100 + dt.month


def _fetch_crude_eia_wti_monthly() -> Dict[int, float]:
    response = requests.get(EIA_WTI_XLS, timeout=120, headers=FETCH_UA)
    response.raise_for_status()
    df = pd.read_excel(io.BytesIO(response.content), sheet_name='Data 1', header=None)
    out: Dict[int, float] = {}
    for _, row in df.iloc[3:].iterrows():
        raw_date = row.iloc[0]
        value = row.iloc[1]
        if pd.isna(raw_date) or pd.isna(value):
            continue
        dt = pd.to_datetime(raw_date, errors='coerce')
        if pd.isna(dt):
            continue
        out[_crude_month_key(dt.to_pydatetime())] = round(float(value), 4)
    return out


def _crude_sproule_urls() -> List[str]:
    now = datetime.now()
    candidates: List[str] = []
    y, m = now.year, now.month
    for _ in range(18):
        prev_m = m - 1 if m > 1 else 12
        prev_y = y if m > 1 else y - 1
        candidates.append(f'{SPROULE_BASE}/{y}/{m:02d}/{prev_y}-{prev_m:02d}-Escalated.xlsx')
        m = prev_m
        y = prev_y if m == 12 else y
    return candidates


def _find_crude_wcs_column(df: pd.DataFrame) -> Optional[int]:
    for col in range(df.shape[1]):
        block = ' '.join(str(df.iat[r, col]) for r in range(6, 10) if r < len(df))
        if 'WCS' in block and '20.5' in block:
            return col
    return None


def _fetch_crude_sproule_wcs_monthly() -> Dict[int, float]:
    last_error: Optional[Exception] = None
    for url in _crude_sproule_urls():
        try:
            response = requests.get(url, timeout=120, headers=FETCH_UA)
            if response.status_code != 200:
                continue
            xl = pd.ExcelFile(io.BytesIO(response.content), engine='openpyxl')
            history = next((s for s in xl.sheet_names if 'History' in s), None)
            if not history:
                continue
            df = pd.read_excel(xl, sheet_name=history, header=None)
            wcs_col = _find_crude_wcs_column(df)
            if wcs_col is None:
                continue
            out: Dict[int, float] = {}
            for _, row in df.iloc[11:].iterrows():
                raw_date = row.iloc[0]
                wcs_val = row.iloc[wcs_col]
                if pd.isna(raw_date) or pd.isna(wcs_val):
                    continue
                if isinstance(raw_date, str) and re.match(r'(?i)average', raw_date.strip()):
                    continue
                dt = pd.to_datetime(raw_date, errors='coerce')
                if pd.isna(dt):
                    continue
                out[_crude_month_key(dt.to_pydatetime())] = round(float(wcs_val), 4)
            if out:
                return out
        except Exception as exc:
            last_error = exc
            continue
    raise RuntimeError(f'Unable to fetch Sproule WCS data: {last_error}')


def _fetch_crude_boc_series(series: str, start: str, end: str) -> Dict[int, float]:
    url = BOC_VALET.format(series=series)
    response = requests.get(
        url,
        params={'start_date': start, 'end_date': end},
        timeout=120,
        headers=FETCH_UA,
    )
    response.raise_for_status()
    observations = response.json().get('observations', [])
    out: Dict[int, float] = {}
    for obs in observations:
        dt = pd.to_datetime(obs.get('d'), errors='coerce')
        if pd.isna(dt):
            continue
        payload = obs.get(series, {})
        val = payload.get('v') if isinstance(payload, dict) else None
        if val is None:
            continue
        out[_crude_month_key(dt.to_pydatetime())] = round(float(val), 6)
    return out


def _fetch_crude_usd_cad_monthly() -> Dict[int, float]:
    archived = _fetch_crude_boc_series('IEXM0101', '2009-01-01', '2016-12-31')
    current = _fetch_crude_boc_series('FXMUSDCAD', '2017-01-01', datetime.now().strftime('%Y-%m-%d'))
    return {**archived, **current}


def build_crude_price_rows() -> List[Tuple[str, str, float]]:
    wti = _fetch_crude_eia_wti_monthly()
    wcs_cad = _fetch_crude_sproule_wcs_monthly()
    fx = _fetch_crude_usd_cad_monthly()

    months = sorted(set(wti) & set(wcs_cad) & set(fx))
    months = [m for m in months if m >= 200501]

    data_rows: List[Tuple[str, str, float]] = []
    for month in months:
        wti_val = wti[month]
        wcs_val_cad = wcs_cad[month]
        fx_val = fx[month]
        if fx_val <= 0:
            continue
        wcs_usd = round(wcs_val_cad / fx_val, 4)
        differential = round(wti_val - wcs_usd, 4)
        ref = str(month)
        data_rows.append(('crude_wti', ref, wti_val))
        data_rows.append(('crude_wcs_cad', ref, wcs_val_cad))
        data_rows.append(('crude_usd_cad', ref, fx_val))
        data_rows.append(('crude_wcs_usd', ref, wcs_usd))
        data_rows.append(('crude_differential', ref, differential))

    return data_rows


def _fetch_os_statcan_capex_annual() -> Dict[int, float]:
    url = (
        'https://www150.statcan.gc.ca/t1/wds/rest/getDataFromVectorByReferencePeriodRange'
        f'?vectorIds={STATCAN_OS_CAPEX_VECTOR}&startRefPeriod=2006-01-01&endReferencePeriod=2030-12-31'
    )
    response = requests.get(url, timeout=120, headers=FETCH_UA)
    response.raise_for_status()
    points = response.json()[0]['object']['vectorDataPoint']
    by_year: Dict[int, float] = {}
    for point in points:
        value = point.get('value')
        if value is None:
            continue
        year = int(str(point['refPer'])[:4])
        by_year[year] = float(value)
    return by_year


def _download_os_statcan_csv(table_id: str) -> pd.DataFrame:
    url = f'https://www150.statcan.gc.ca/n1/tbl/csv/{table_id}-eng.zip'
    response = requests.get(url, timeout=180, headers=FETCH_UA)
    response.raise_for_status()
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


def _download_capp_xlsx(url: str) -> pd.DataFrame:
    response = requests.get(url, timeout=180, headers=FETCH_UA)
    response.raise_for_status()
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


def _build_os_upgrader_capacity_rows(max_year: int) -> List[Tuple[str, str, float]]:
    df = _download_capp_xlsx(CAPP_UPGRADER_CAPACITY_URL)
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


def _build_os_proved_reserves_rows(max_year: int) -> List[Tuple[str, str, float]]:
    mining = _download_capp_xlsx(CAPP_OIL_SANDS_MINING_RESERVES_URL)
    insitu = _download_capp_xlsx(CAPP_OIL_SANDS_INSITU_RESERVES_URL)
    conventional = _download_capp_xlsx(CAPP_CONVENTIONAL_RESERVES_URL)

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


def _build_os_capex_rows() -> List[Tuple[str, str, float]]:
    statcan_annual = _fetch_os_statcan_capex_annual()
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


def build_oil_sands_rows() -> List[Tuple[str, str, float]]:
    df_old = _download_os_statcan_csv('25100014')
    df_new = _download_os_statcan_csv('25100063')
    max_year = _os_max_complete_production_year(df_old, df_new)
    return (
        _build_os_capex_rows()
        + _build_os_production_rows(df_old, df_new, max_year)
        + _build_os_upgrading_rows(df_old, df_new, max_year)
        + _build_os_upgrader_capacity_rows(max_year)
        + _build_os_proved_reserves_rows(max_year)
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


# ---------------------------------------------------------------------------
# Page 138 — Kalibrate gasoline retail prices (charting.kalibrate.com Margins tool)
# ---------------------------------------------------------------------------

KALIBRATE_CHARTING_URL = 'https://charting.kalibrate.com/Charting/Margins'
KALIBRATE_RELOAD_URL = 'https://charting.kalibrate.com/Charting/MarginsReload'
KALIBRATE_SOURCE_URL = KALIBRATE_CHARTING_URL
SECTION6_XLSX = 'Section 6.xlsx'
KALIBRATE_SHEET = 'kalibrate_archive'

# Spec markets → Kalibrate Select Market IDs (Price View, Unleaded, Monthly)
KALIBRATE_WEB_MARKETS = {
    'canada': '0',       # Canada (Volume Weighted)
    'vancouver': '55',
    'calgary': '5',
    'toronto': '56',     # City of Toronto
    'montreal': '31',    # Montréal
    'halifax': '18',
}
KALIBRATE_UNLEADED_PRODUCT_ID = '1'
KALIBRATE_MONTHLY_FREQUENCY_ID = '3'
KALIBRATE_DEFAULT_START_YEAR = 2016

KALIBRATE_MARKET_ALIASES = {
    'canada': 'canada',
    'vancouver': 'vancouver',
    'calgary': 'calgary',
    'city of toronto': 'toronto',
    'toronto': 'toronto',
    'montreal': 'montreal',
    'montréal': 'montreal',
    'montr\u00e9al': 'montreal',
    'halifax': 'halifax',
}

KALIBRATE_COMPONENTS = ('crude', 'refining', 'marketing', 'taxes', 'price')

KALIBRATE_PRICE_SERIES_KEYS = (
    'Retail Price',
    'Retail Price Excluding Taxes',
    'Wholesale Price',
    'Crude Price',
)


def _kalibrate_web_session() -> requests.Session:
    session = requests.Session()
    session.headers.update({
        **FETCH_UA,
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': KALIBRATE_CHARTING_URL,
    })
    session.get(KALIBRATE_CHARTING_URL, timeout=120)
    return session


def _fetch_kalibrate_price_series(
    session: requests.Session,
    market_id: str,
    year: int,
) -> Optional[Dict[str, List[float]]]:
    """Fetch monthly Price View series for one market and calendar year."""
    params = {
        'marketIdIn': json.dumps([market_id]),
        'productIdIn': json.dumps([KALIBRATE_UNLEADED_PRODUCT_ID]),
        'frequencyIdIn': KALIBRATE_MONTHLY_FREQUENCY_ID,
        'startdateIn': json.dumps(f'{year}-01-01'),
        'enddateIn': json.dumps(f'{year}-12-31'),
        'marginTypeIn': json.dumps('Price'),
    }
    response = session.get(KALIBRATE_RELOAD_URL, params=params, timeout=120)
    response.raise_for_status()
    if not response.text.strip():
        return None
    payload = response.json()
    if payload.get('ChartError'):
        return None
    series = {
        item['Key']: [float(v) for v in item.get('Value', []) if v is not None]
        for item in payload.get('ChartData', [])
    }
    if not all(series.get(key) for key in KALIBRATE_PRICE_SERIES_KEYS):
        return None
    month_count = len(payload.get('Dates') or [])
    if month_count < 12:
        return None
    return series


def _annual_kalibrate_components(series: Dict[str, List[float]]) -> Dict[str, float]:
    """Average monthly inputs and derive margin components (Page 138 spec formulas)."""
    retail = statistics.mean(series['Retail Price'])
    retail_ex = statistics.mean(series['Retail Price Excluding Taxes'])
    wholesale = statistics.mean(series['Wholesale Price'])
    crude = statistics.mean(series['Crude Price'])
    return {
        'crude': crude,
        'refining': wholesale - crude,
        'marketing': retail_ex - wholesale,
        'taxes': retail - retail_ex,
        'price': retail,
    }


def _kalibrate_metadata_rows() -> List[Tuple]:
    return [
        (
            f'kal_{market}_{comp}',
            f'Gasoline {comp} ({market})',
            'cents per litre',
            'units',
            'Kalibrate',
            KALIBRATE_SOURCE_URL,
        )
        for market in sorted(set(KALIBRATE_WEB_MARKETS))
        for comp in KALIBRATE_COMPONENTS
    ]


def build_kalibrate_gas_price_rows_from_web(
    start_year: int = KALIBRATE_DEFAULT_START_YEAR,
    end_year: Optional[int] = None,
) -> Tuple[List[Tuple[str, str, float]], List[Tuple]]:
    """
    Fetch Kalibrate Margins (Price View) data from charting.kalibrate.com per Page 138 spec.
    For each market: Unleaded, monthly Jan–Dec, average to annual crude/refining/marketing/taxes/price.
    """
    if end_year is None:
        end_year = datetime.utcnow().year - 1

    session = _kalibrate_web_session()
    data_rows: List[Tuple[str, str, float]] = []

    for market, market_id in KALIBRATE_WEB_MARKETS.items():
        for year in range(start_year, end_year + 1):
            try:
                series = _fetch_kalibrate_price_series(session, market_id, year)
                if not series:
                    continue
                components = _annual_kalibrate_components(series)
                for comp, value in components.items():
                    data_rows.append((f'kal_{market}_{comp}', str(year), round(float(value), 2)))
            except Exception as exc:
                print(f'    Kalibrate web warning ({market} {year}): {exc}')
            time.sleep(0.25)

    if data_rows:
        print(f'    Kalibrate web: {len(data_rows)} annual price component rows ({start_year}–{end_year})')
        return data_rows, _kalibrate_metadata_rows()

    print('    Kalibrate web: no rows fetched from charting.kalibrate.com')
    return [], []


KALIBRATE_METADATA = [
    ('kal_{market}_crude', 'Gasoline crude cost', 'cents per litre', 'units'),
    ('kal_{market}_refining', 'Gasoline refining margin', 'cents per litre', 'units'),
    ('kal_{market}_marketing', 'Gasoline marketing margin', 'cents per litre', 'units'),
    ('kal_{market}_taxes', 'Gasoline taxes', 'cents per litre', 'units'),
    ('kal_{market}_price', 'Gasoline retail price', 'cents per litre', 'units'),
]


def _normalize_kalibrate_market(raw: str) -> Optional[str]:
    key = re.sub(r'\s+', ' ', str(raw or '').strip().lower())
    return KALIBRATE_MARKET_ALIASES.get(key)


def _pick_column(columns: List[str], *needles: str) -> Optional[str]:
    for col in columns:
        norm = re.sub(r'\s+', ' ', str(col).strip().lower())
        if all(n in norm for n in needles):
            return col
    return None


def _parse_kalibrate_monthly_archive(df: pd.DataFrame) -> List[Tuple[str, str, float]]:
    """Average monthly Kalibrate inputs to annual components per market (Page 138 spec)."""
    if df.empty:
        return []

    df = df.copy()
    df.columns = [str(c).strip() for c in df.columns]
    cols = list(df.columns)

    market_col = _pick_column(cols, 'market') or _pick_column(cols, 'city') or _pick_column(cols, 'location')
    date_col = _pick_column(cols, 'date') or _pick_column(cols, 'month') or _pick_column(cols, 'period')
    retail_col = _pick_column(cols, 'retail', 'price') if _pick_column(cols, 'retail price excluding') is None else _pick_column(cols, 'retail price')
    if retail_col and 'excluding' in retail_col.lower():
        retail_col = _pick_column(cols, 'retail price') or _pick_column(cols, 'price')
    retail_ex_col = _pick_column(cols, 'retail', 'excluding')
    wholesale_col = _pick_column(cols, 'wholesale')
    crude_col = _pick_column(cols, 'crude')

    pre_crude = _pick_column(cols, 'crude cost')
    pre_refining = _pick_column(cols, 'refining margin')
    pre_marketing = _pick_column(cols, 'marketing margin')
    pre_taxes = _pick_column(cols, 'taxes')
    pre_price = _pick_column(cols, 'price') if not retail_col else None

    if market_col and (pre_crude or (retail_col and wholesale_col and crude_col)):
        year_col = _pick_column(cols, 'year') or 'year'
        if year_col not in df.columns and date_col:
            df['year'] = pd.to_datetime(df[date_col], errors='coerce').dt.year
            year_col = 'year'
        elif year_col not in df.columns:
            return []
        rows: List[Tuple[str, str, float]] = []
        for (market_raw, year), grp in df.groupby([market_col, year_col], dropna=True):
            market = _normalize_kalibrate_market(market_raw)
            if not market or pd.isna(year):
                continue
            year_int = int(year)
            if pre_crude:
                crude = pd.to_numeric(grp[pre_crude], errors='coerce').mean()
                refining = pd.to_numeric(grp[pre_refining], errors='coerce').mean()
                marketing = pd.to_numeric(grp[pre_marketing], errors='coerce').mean()
                taxes = pd.to_numeric(grp[pre_taxes], errors='coerce').mean()
                price = pd.to_numeric(grp[pre_price or retail_col], errors='coerce').mean()
            else:
                retail = pd.to_numeric(grp[retail_col], errors='coerce').mean()
                retail_ex = pd.to_numeric(grp[retail_ex_col], errors='coerce').mean()
                wholesale = pd.to_numeric(grp[wholesale_col], errors='coerce').mean()
                crude = pd.to_numeric(grp[crude_col], errors='coerce').mean()
                if any(pd.isna(v) for v in (retail, retail_ex, wholesale, crude)):
                    continue
                price = retail
                taxes = retail - retail_ex
                refining = wholesale - crude
                marketing = retail_ex - wholesale
            for comp, val in (
                ('crude', crude),
                ('refining', refining),
                ('marketing', marketing),
                ('taxes', taxes),
                ('price', price),
            ):
                if pd.notna(val):
                    rows.append((f'kal_{market}_{comp}', str(year_int), round(float(val), 2)))
        return rows

    return []


def build_kalibrate_gas_price_rows(xlsx_path: Optional[Path] = None) -> Tuple[List[Tuple[str, str, float]], List[Tuple]]:
    """
    Page 138 Kalibrate gasoline margins.
    Primary: charting.kalibrate.com Margins tool (Price View, per spec).
    Fallback: Section 6.xlsx kalibrate_archive if web fetch returns no rows.
    """
    data_rows, metadata_rows = build_kalibrate_gas_price_rows_from_web()
    if data_rows:
        return data_rows, metadata_rows

    path = xlsx_path or resolve_root_xlsx(SECTION6_XLSX)
    if not path.is_file():
        print(f'    Kalibrate skipped: web fetch empty and {path} not found')
        return [], []

    try:
        df = pd.read_excel(path, sheet_name=KALIBRATE_SHEET, engine='openpyxl')
    except Exception as exc:
        print(f'    Kalibrate skipped: could not read {KALIBRATE_SHEET} from {path}: {exc}')
        return [], []

    data_rows = _parse_kalibrate_monthly_archive(df)
    if not data_rows:
        print(f'    Kalibrate skipped: no rows parsed from {KALIBRATE_SHEET}')
        return [], []

    metadata_rows = _kalibrate_metadata_rows()
    print(f'    Kalibrate archive: {len(data_rows)} annual price component rows')
    return data_rows, metadata_rows


# ---------------------------------------------------------------------------
# Page 139 — Oil Sands Magazine refinery capacity
# ---------------------------------------------------------------------------

OSM_REFINERY_URL = 'https://www.oilsandsmagazine.com/projects/canadian-refineries'
OSM_EXCLUDE_NAMES = ('braya renewable fuels',)
OSM_ASPHALT_NAMES = ('moose jaw refinery', 'lloydminster refinery')
OSM_LUBRICANT_NAMES = ('clarkson refinery',)
OSM_PROVINCE_KEYS = ('ab', 'bc', 'nb', 'on', 'qc', 'sk')
OSM_REFINERY_TYPES = ('petroleum', 'asphalt', 'lubricant', 'total')


def _osm_province_key(location: str) -> Optional[str]:
    loc = str(location or '').upper()
    if ', AB' in loc or ' ALBERTA' in loc:
        return 'ab'
    if ', BC' in loc or ' BRITISH COLUMBIA' in loc:
        return 'bc'
    if ', NB' in loc or ' NEW BRUNSWICK' in loc:
        return 'nb'
    if ', ON' in loc or ' ONTARIO' in loc:
        return 'on'
    if ', QC' in loc or ' QUEBEC' in loc or 'LÉVIS' in loc:
        return 'qc'
    if ', SK' in loc or ' SASKATCHEWAN' in loc:
        return 'sk'
    return None


def _osm_facility_type(name: str, operator: str) -> Optional[str]:
    label = f'{name} {operator}'.lower()
    if any(x in label for x in OSM_EXCLUDE_NAMES):
        return None
    if any(x in label for x in OSM_ASPHALT_NAMES):
        return 'asphalt'
    if any(x in label for x in OSM_LUBRICANT_NAMES):
        return 'lubricant'
    return 'petroleum'


def _osm_parse_capacity(raw: str) -> Optional[float]:
    text = str(raw or '').strip().upper()
    if not text or 'NOTE' in text:
        return None
    digits = re.sub(r'[^\d.]', '', text.replace(',', ''))
    if not digits:
        return None
    value = float(digits)
    # OSM table is bbl/day; page displays thousand bbl/day
    return round(value / 1000)


def build_refinery_capacity_rows(
    source_url: str = OSM_REFINERY_URL,
    vintage: Optional[str] = None,
) -> Tuple[List[Tuple[str, str, float]], List[Tuple]]:
    """Download Oil Sands Magazine refinery table and aggregate by province/type (Page 139 spec)."""
    vintage_key = vintage or datetime.utcnow().strftime('%Y-%m')
    response = requests.get(source_url, headers=FETCH_UA, timeout=120)
    response.raise_for_status()
    soup = BeautifulSoup(response.text, 'html.parser')
    table = soup.find('table')
    if table is None:
        raise RuntimeError('Oil Sands Magazine refinery table not found')

    aggregates: Dict[str, Dict[str, Dict[str, float]]] = {
        prov: {rtype: {'count': 0, 'capacity': 0.0} for rtype in OSM_REFINERY_TYPES}
        for prov in OSM_PROVINCE_KEYS
    }
    totals = {rtype: {'count': 0, 'capacity': 0.0} for rtype in OSM_REFINERY_TYPES}

    for tr in table.find_all('tr'):
        cells = [c.get_text(' ', strip=True) for c in tr.find_all(['td', 'th'])]
        if len(cells) < 5:
            continue
        name, operator, location, _startup, capacity_raw = cells[:5]
        if name.upper() in ('NAME', '') or location.upper().startswith('NEW '):
            continue
        facility_type = _osm_facility_type(name, operator)
        if facility_type is None:
            continue
        prov = _osm_province_key(location)
        if prov is None:
            continue
        capacity = _osm_parse_capacity(capacity_raw)
        if capacity is None:
            continue
        aggregates[prov][facility_type]['count'] += 1
        aggregates[prov][facility_type]['capacity'] += capacity
        aggregates[prov]['total']['count'] += 1
        aggregates[prov]['total']['capacity'] += capacity
        totals[facility_type]['count'] += 1
        totals[facility_type]['capacity'] += capacity
        totals['total']['count'] += 1
        totals['total']['capacity'] += capacity

    data_rows: List[Tuple[str, str, float]] = []
    for prov in OSM_PROVINCE_KEYS:
        for rtype in OSM_REFINERY_TYPES:
            bucket = aggregates[prov][rtype]
            if bucket['count'] > 0:
                data_rows.append((f'refcap_{prov}_{rtype}_count', vintage_key, float(bucket['count'])))
                data_rows.append((f'refcap_{prov}_{rtype}_capacity', vintage_key, round(bucket['capacity'], 0)))
    for rtype in OSM_REFINERY_TYPES:
        if totals[rtype]['count'] > 0:
            data_rows.append((f'refcap_total_{rtype}_count', vintage_key, float(totals[rtype]['count'])))
            data_rows.append((f'refcap_total_{rtype}_capacity', vintage_key, round(totals[rtype]['capacity'], 0)))

    metadata_rows = [
        (f'refcap_{prov}_{rtype}_count', f'Refinery count ({prov}, {rtype})', 'Number', 'units', 'Oil Sands Magazine', source_url)
        for prov in OSM_PROVINCE_KEYS
        for rtype in OSM_REFINERY_TYPES
    ] + [
        (f'refcap_{prov}_{rtype}_capacity', f'Refinery capacity ({prov}, {rtype})', 'Thousand bbl/day', 'units', 'Oil Sands Magazine', source_url)
        for prov in OSM_PROVINCE_KEYS
        for rtype in OSM_REFINERY_TYPES
    ] + [
        (f'refcap_total_{rtype}_count', f'Refinery count (Canada total, {rtype})', 'Number', 'units', 'Oil Sands Magazine', source_url)
        for rtype in OSM_REFINERY_TYPES
    ] + [
        (f'refcap_total_{rtype}_capacity', f'Refinery capacity (Canada total, {rtype})', 'Thousand bbl/day', 'units', 'Oil Sands Magazine', source_url)
        for rtype in OSM_REFINERY_TYPES
    ]
    print(f'    OSM refinery capacity: {len(data_rows)} rows (vintage {vintage_key})')
    return data_rows, metadata_rows


class Section6OilGas(SectionProcessor):
    """Processor for Section 6: Oil, Natural Gas and Coal."""

    SECTION_KEY = 'section6_oil_gas'
    SECTION_NAME = 'Oil, Natural Gas and Coal'
    SECTION_ID = 6

    def get_source_handlers(self) -> Dict[str, callable]:
        return {
            'rpp_supply_demand': self._process_rpp_supply_demand,
            'rpp_refinery_input': self._process_rpp_refinery_input,
            'crude_prices': self._process_crude_prices,
            'oil_sands': self._process_oil_sands,
            'canadian_production': self._process_canadian_production,
            'kal_gas_prices': self._process_kal_gas_prices,
            'osm_refin_cap': self._process_osm_refin_cap,
        }

    @staticmethod
    def _annual_totals(
        wds_points: List[Tuple[int, str, float]],
    ) -> Dict[int, Dict[int, float]]:
        """Aggregate monthly WDS points to annual sums per vector."""
        totals: Dict[int, Dict[int, float]] = defaultdict(lambda: defaultdict(float))
        for vid, ref_per, value in wds_points:
            year = int(str(ref_per)[:4]) if ref_per else None
            if year:
                totals[vid][year] += float(value)
        return totals

    @staticmethod
    def _to_mmbd(annual_m3: float) -> float:
        """Convert annual cubic metres (WDS sum) to million barrels per day."""
        thousand_m3 = annual_m3 / 1000
        return round(thousand_m3 * MM3_PER_M3 / 1000 / 365, 1)

    @staticmethod
    def _to_billion_l(annual_m3: float) -> float:
        """Convert annual cubic metres (WDS sum) to billion litres."""
        thousand_m3 = annual_m3 / 1000
        return round(thousand_m3 / 1000, 0)

    def _fetch_annual_by_vector(
        self,
        vector_ids: List[int],
        start_ref: str = '2000-01-01',
    ) -> Dict[int, Dict[int, float]]:
        wds = self.fetch_wds_vector_data(
            [str(v) for v in vector_ids],
            start_ref=start_ref,
        )
        return self._annual_totals(wds)

    def _process_rpp_supply_demand(self) -> int:
        """Fetch StatCan 25-10-0081-01 and export Page 136 supply + product-share vectors."""
        print('  Fetching RPP supply and disposition (StatCan 25-10-0081-01)...')

        all_vector_ids = list(SUPPLY_VECTORS.values()) + list(PRODUCT_VECTORS.values())
        annual = self._fetch_annual_by_vector(all_vector_ids)

        raw_rows: List[Tuple[str, str, float]] = []
        for vid, by_year in annual.items():
            for year, value in by_year.items():
                raw_rows.append((f'v{vid}', str(year), round(value, 4)))

        if raw_rows:
            self.repo.insert_raw_statcan_data('rpp_supply_demand_raw', raw_rows)
            print(f'    Stored {len(raw_rows)} raw StatCan data points')

        years = sorted(
            {
                year
                for by_year in annual.values()
                for year in by_year
            }
        )

        data_rows: List[Tuple[str, str, float]] = []
        for year in years:
            supply_m3 = {
                key: annual[vid].get(year, 0.0)
                for key, vid in SUPPLY_VECTORS.items()
            }
            product_m3 = {
                key: annual[vid].get(year, 0.0)
                for key, vid in PRODUCT_VECTORS.items()
            }

            domestic = supply_m3['domestic_consumption']
            if domestic <= 0:
                continue

            named_sum = sum(product_m3.values())
            product_m3['other'] = max(domestic - named_sum, 0.0)

            for key in ('net_production', 'imports', 'exports', 'domestic_consumption'):
                m3 = supply_m3[key]
                if m3 <= 0:
                    continue
                prefix = {
                    'net_production': 'rpp_net_prod',
                    'imports': 'rpp_imports',
                    'exports': 'rpp_exports',
                    'domestic_consumption': 'rpp_domestic',
                }[key]
                data_rows.append((f'{prefix}_mmbd', str(year), self._to_mmbd(m3)))
                data_rows.append((f'{prefix}_bl', str(year), self._to_billion_l(m3)))

            for key, m3 in product_m3.items():
                pct = round(m3 / domestic * 100, 1) if domestic > 0 else 0.0
                data_rows.append((f'rpp_{key}_pct', str(year), pct))

        metadata_rows = [
            ('rpp_net_prod_mmbd', 'RPP net production (MMb/d)', 'million barrels per day', 'units'),
            ('rpp_net_prod_bl', 'RPP net production (billion L)', 'billion litres', 'units'),
            ('rpp_imports_mmbd', 'RPP imports (MMb/d)', 'million barrels per day', 'units'),
            ('rpp_imports_bl', 'RPP imports (billion L)', 'billion litres', 'units'),
            ('rpp_exports_mmbd', 'RPP exports (MMb/d)', 'million barrels per day', 'units'),
            ('rpp_exports_bl', 'RPP exports (billion L)', 'billion litres', 'units'),
            ('rpp_domestic_mmbd', 'RPP domestic consumption (MMb/d)', 'million barrels per day', 'units'),
            ('rpp_domestic_bl', 'RPP domestic consumption (billion L)', 'billion litres', 'units'),
            ('rpp_motor_gasoline_pct', 'Motor gasoline share of domestic RPP consumption', 'percent', 'units'),
            ('rpp_distillate_pct', 'Distillate share of domestic RPP consumption', 'percent', 'units'),
            ('rpp_still_gas_pct', 'Still gas share of domestic RPP consumption', 'percent', 'units'),
            ('rpp_jet_pct', 'Jet fuel share of domestic RPP consumption', 'percent', 'units'),
            ('rpp_coke_pct', 'Coke share of domestic RPP consumption', 'percent', 'units'),
            ('rpp_residual_pct', 'Residual fuel share of domestic RPP consumption', 'percent', 'units'),
            ('rpp_asphalt_pct', 'Asphalt share of domestic RPP consumption', 'percent', 'units'),
            ('rpp_other_pct', 'Other petroleum products share of domestic RPP consumption', 'percent', 'units'),
        ]

        return self.store_raw_data('rpp_supply_demand', data_rows, metadata_rows)

    def _process_rpp_refinery_input(self) -> int:
        """Fetch StatCan 25-10-0063-01 refinery input for Page 136."""
        print('  Fetching refinery input (StatCan 25-10-0063-01)...')

        annual = self._fetch_annual_by_vector([REFINERY_INPUT_VECTOR])
        by_year = annual.get(REFINERY_INPUT_VECTOR, {})

        raw_rows = [
            (f'v{REFINERY_INPUT_VECTOR}', str(year), round(value, 4))
            for year, value in by_year.items()
        ]
        if raw_rows:
            self.repo.insert_raw_statcan_data('rpp_refinery_input_raw', raw_rows)
            print(f'    Stored {len(raw_rows)} raw StatCan data points')

        data_rows: List[Tuple[str, str, float]] = []
        for year, m3 in sorted(by_year.items()):
            if m3 <= 0:
                continue
            data_rows.append(('rpp_refinery_mmbd', str(year), self._to_mmbd(m3)))
            data_rows.append(('rpp_refinery_bl', str(year), self._to_billion_l(m3)))

        metadata_rows = [
            ('rpp_refinery_mmbd', 'Input to Canadian refineries (MMb/d)', 'million barrels per day', 'units'),
            ('rpp_refinery_bl', 'Input to Canadian refineries (billion L)', 'billion litres', 'units'),
        ]

        return self.store_raw_data('rpp_refinery_input', data_rows, metadata_rows)

    def _process_crude_prices(self) -> int:
        """Fetch EIA WTI, Sproule WCS, BoC FX and export crude price vectors."""
        print('  Fetching WTI, WCS and USD/CAD exchange rates...')
        data_rows = build_crude_price_rows()
        if not data_rows:
            print('    WARNING: no crude price rows produced')
            return 0
        print(f'    Prepared {len(data_rows)} monthly data points')
        return self.store_raw_data('crude_prices', data_rows, CRUDE_PRICES_METADATA)

    def _process_oil_sands(self) -> int:
        """Fetch CAPP + StatCan capex and crude production share for Page 113."""
        print('  Fetching oil sands capex and production share...')
        data_rows = build_oil_sands_rows()
        if not data_rows:
            print('    WARNING: no oil sands rows produced')
            return 0
        print(f'    Prepared {len(data_rows)} annual data points')
        return self.store_raw_data('oil_sands', data_rows, OIL_SANDS_METADATA)

    def _process_canadian_production(self) -> int:
        """Fetch StatCan crude production by type and province for Page 111."""
        print('  Fetching Canadian crude production (Page 111)...')
        data_rows = build_canadian_production_rows()
        if not data_rows:
            print('    WARNING: no Canadian production rows produced')
            return 0
        print(f'    Prepared {len(data_rows)} annual data points')
        return self.store_raw_data('canadian_production', data_rows, CANADIAN_PRODUCTION_METADATA)

    def _process_kal_gas_prices(self) -> int:
        """Fetch Kalibrate gasoline margins from charting.kalibrate.com (Page 138)."""
        print('  Fetching Kalibrate gasoline retail prices (Page 138)...')
        cfg = self.config.sections.get('section6_oil_gas', {}).get('sources', {}).get('kal_gas_prices', {})
        xlsx_name = cfg.get('section6_xlsx') or SECTION6_XLSX
        xlsx_path = resolve_root_xlsx(xlsx_name)
        data_rows, metadata_rows = build_kalibrate_gas_price_rows(xlsx_path)
        if not data_rows:
            return 0
        self.repo.clear_raw_data('kal_gas_prices')
        return self.store_raw_data('kal_gas_prices', data_rows, metadata_rows)

    def _process_osm_refin_cap(self) -> int:
        """Scrape Oil Sands Magazine refinery capacity table (Page 139)."""
        print('  Fetching Oil Sands Magazine refinery capacity (Page 139)...')
        source_url = (
            self.config.sections.get('section6_oil_gas', {})
            .get('sources', {})
            .get('osm_refin_cap', {})
            .get('source_url', OSM_REFINERY_URL)
        )
        data_rows, metadata_rows = build_refinery_capacity_rows(source_url=source_url)
        if not data_rows:
            return 0
        return self.store_raw_data('osm_refin_cap', data_rows, metadata_rows)
