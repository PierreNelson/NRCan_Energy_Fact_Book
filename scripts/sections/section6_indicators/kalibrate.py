"""Page 138 — Kalibrate gasoline retail prices (charting.kalibrate.com Margins tool)."""

import json
import re
import statistics
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import pandas as pd
import requests

from xlsx_paths import resolve_root_xlsx

from .constants import FETCH_UA

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

KALIBRATE_METADATA = [
    ('kal_{market}_crude', 'Gasoline crude cost', 'cents per litre', 'units'),
    ('kal_{market}_refining', 'Gasoline refining margin', 'cents per litre', 'units'),
    ('kal_{market}_marketing', 'Gasoline marketing margin', 'cents per litre', 'units'),
    ('kal_{market}_taxes', 'Gasoline taxes', 'cents per litre', 'units'),
    ('kal_{market}_price', 'Gasoline retail price', 'cents per litre', 'units'),
]


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


SOURCE_KEY = 'kal_gas_prices'


def update_kal_gas_prices(processor, xlsx_path: Optional[Path] = None) -> int:
    """EEDAS ingest: Kalibrate gasoline margin components (source-native)."""
    from xlsx_paths import resolve_root_xlsx
    print('  Fetching Kalibrate gasoline retail prices (raw)...')
    cfg = processor.config.sections.get('section6_indicators', {}).get('sources', {}).get('kal_gas_prices', {})
    xlsx_name = cfg.get('section6_xlsx') or SECTION6_XLSX
    path = xlsx_path or resolve_root_xlsx(xlsx_name)
    data_rows, metadata_rows = build_kalibrate_gas_price_rows(path)
    if not data_rows:
        raise RuntimeError('kal_gas_prices: no source-native rows produced')
    raw_rows = [(f'raw_{vec}', ref, val) for vec, ref, val in data_rows]
    raw_meta = [
        (f'raw_{row[0]}', row[1], row[2], row[3], row[4], row[5])
        if len(row) >= 6 else (f'raw_{row[0]}', row[1], row[2], row[3])
        for row in metadata_rows
    ]
    return processor.replace_raw_data(SOURCE_KEY, raw_rows, raw_meta)


def transform_kal_gas_prices(processor) -> int:
    """EFB transform: map raw Kalibrate rows to kal_* indicators."""
    df = processor.get_raw_dataframe(SOURCE_KEY)
    if df.empty:
        raise RuntimeError('kal_gas_prices transform: no raw rows found')

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
        raise RuntimeError('kal_gas_prices transform: no indicator rows produced')

    metadata_rows = _kalibrate_metadata_rows()
    n = processor.store_indicators(SOURCE_KEY, data_rows, metadata_rows)
    print(f'    Stored {n} indicator rows for kal_gas_prices')
    return n
