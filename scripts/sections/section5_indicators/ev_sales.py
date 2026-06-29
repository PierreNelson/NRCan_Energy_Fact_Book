"""EV sales registration vectors (StatCan 20-10-0021-01 + 20-10-0025-01)."""

from collections import defaultdict
from typing import Dict, List, Optional, Set, Tuple

import pandas as pd

from config_loader import get_config
from utils.http_retry import fetch_get, resilience_from_config

from .constants import (
    EV_SALES_METADATA,
    EV_SALES_NEW_BEV,
    EV_SALES_NEW_PHEV,
    EV_SALES_NEW_TOTAL,
    EV_SALES_OLD_BEV,
    EV_SALES_OLD_PHEV,
    EV_SALES_OLD_TOTAL,
)

SOURCE_KEY = 'ev_sales'
ALL_WDS_VECTORS = [
    EV_SALES_OLD_TOTAL, EV_SALES_OLD_BEV, EV_SALES_OLD_PHEV,
    EV_SALES_NEW_TOTAL, EV_SALES_NEW_BEV, EV_SALES_NEW_PHEV,
]
EV_SALES_QUARTER_MONTHS = frozenset({1, 4, 7, 10})
EV_SALES_NEW_SERIES_START = 2017


def _normalize_ref_date(ref) -> str:
    text = str(ref or '').strip()
    if len(text) >= 10:
        return text[:10]
    if len(text) == 7 and text[4] == '-':
        return f'{text}-01'
    if len(text) == 4 and text.isdigit():
        return text
    return text


def _year_from_ref(ref: str) -> Optional[int]:
    try:
        return int(str(ref)[:4])
    except (TypeError, ValueError):
        return None


def _month_from_ref(ref: str) -> Optional[int]:
    text = str(ref).strip()
    if len(text) == 4 and text.isdigit():
        return None
    try:
        if len(text) >= 7 and text[4] == '-':
            return int(text[5:7])
    except (TypeError, ValueError):
        return None
    return None


def _fetch_wds_raw_rows(
    vector_ids: List[int], start_ref: str = '2010-01-01', config=None
) -> List[Tuple[str, str, float]]:
    """Fetch StatCan WDS vectors preserving reference period granularity."""
    ids = [str(v).lstrip('vV') for v in vector_ids]
    url = (
        'https://www150.statcan.gc.ca/t1/wds/rest/getDataFromVectorByReferencePeriodRange'
        f'?vectorIds={",".join(ids)}&startRefPeriod={start_ref}&endReferencePeriod=2030-12-31'
    )
    headers = {
        'Accept': '*/*',
        'Accept-Language': 'en-CA,en;q=0.9',
        'User-Agent': (
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
            '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        ),
        'Referer': 'https://www.statcan.gc.ca/',
    }
    cfg = config or get_config()
    max_r, delay = resilience_from_config(cfg)
    response = fetch_get(
        url, timeout=120, headers=headers,
        max_retries=max_r, retry_delay_seconds=delay, label='EV sales WDS',
    )
    raw = response.json()
    items = raw if isinstance(raw, list) else [raw]
    rows: List[Tuple[str, str, float]] = []
    for item in items:
        if item.get('status') != 'SUCCESS':
            continue
        obj = item.get('object') or {}
        vid = obj.get('vectorId')
        if vid is None:
            continue
        for pt in obj.get('vectorDataPoint') or []:
            ref = _normalize_ref_date(pt.get('refPer') or pt.get('refPerRaw') or '')
            val = pt.get('value')
            if not ref or val is None:
                continue
            rows.append((f'v{vid}', ref, round(float(val), 4)))
    return rows


def _quarter_months_by_year(df: pd.DataFrame, vector_id: int) -> Dict[int, Set[int]]:
    vec = f'v{vector_id}'
    sub = df[df['vector'].astype(str).str.lower() == vec.lower()]
    by_year: Dict[int, Set[int]] = defaultdict(set)
    for _, row in sub.iterrows():
        ref = str(row['ref_date']).strip()
        year = _year_from_ref(ref)
        if year is None:
            continue
        month = _month_from_ref(ref)
        if month in EV_SALES_QUARTER_MONTHS:
            by_year[year].add(month)
        elif len(ref) == 4 and ref.isdigit():
            by_year[year].add(0)
    return dict(by_year)


def _is_complete_new_year(df: pd.DataFrame, year: int) -> bool:
    months = _quarter_months_by_year(df, EV_SALES_NEW_TOTAL).get(year, set())
    if 0 in months:
        return True
    return EV_SALES_QUARTER_MONTHS.issubset(months)


def _annual_sum_from_raw(df: pd.DataFrame, vector_id: int, year: int) -> float:
    vec = f'v{vector_id}'
    sub = df[df['vector'].astype(str).str.lower() == vec.lower()]
    total = 0.0
    for _, row in sub.iterrows():
        if _year_from_ref(str(row['ref_date']).strip()) != year:
            continue
        try:
            total += float(row['value'])
        except (TypeError, ValueError):
            continue
    return total


def _build_indicator_rows(df: pd.DataFrame) -> List[Tuple[str, str, float]]:
    data_rows: List[Tuple[str, str, float]] = []

    for year in range(2011, EV_SALES_NEW_SERIES_START):
        total = _annual_sum_from_raw(df, EV_SALES_OLD_TOTAL, year)
        ev = (
            _annual_sum_from_raw(df, EV_SALES_OLD_BEV, year)
            + _annual_sum_from_raw(df, EV_SALES_OLD_PHEV, year)
        )
        if total <= 0 or ev <= 0:
            continue
        share = round((ev / total) * 100, 1)
        data_rows.extend([
            ('ev_total_regs', str(year), round(total, 0)),
            ('ev_new_regs', str(year), round(ev, 0)),
            ('ev_share_pct', str(year), share),
        ])

    quarterly_years = sorted(_quarter_months_by_year(df, EV_SALES_NEW_TOTAL))
    for year in quarterly_years:
        if year < EV_SALES_NEW_SERIES_START:
            continue
        if not _is_complete_new_year(df, year):
            continue
        total = _annual_sum_from_raw(df, EV_SALES_NEW_TOTAL, year)
        ev = (
            _annual_sum_from_raw(df, EV_SALES_NEW_BEV, year)
            + _annual_sum_from_raw(df, EV_SALES_NEW_PHEV, year)
        )
        if total <= 0 or ev <= 0:
            continue
        share = round((ev / total) * 100, 1)
        data_rows.extend([
            ('ev_total_regs', str(year), round(total, 0)),
            ('ev_new_regs', str(year), round(ev, 0)),
            ('ev_share_pct', str(year), share),
        ])

    return data_rows


def update_ev_sales(processor) -> int:
    """EEDAS ingest: StatCan WDS v* vectors for EV registration tables."""
    print('  Fetching EV sales WDS vectors...')
    old_rows = _fetch_wds_raw_rows(
        [EV_SALES_OLD_TOTAL, EV_SALES_OLD_BEV, EV_SALES_OLD_PHEV],
        start_ref='2010-01-01',
        config=processor.config,
    )
    new_rows = _fetch_wds_raw_rows(
        [EV_SALES_NEW_TOTAL, EV_SALES_NEW_BEV, EV_SALES_NEW_PHEV],
        start_ref='2016-01-01',
        config=processor.config,
    )
    data_rows = old_rows + new_rows
    if not data_rows:
        raise RuntimeError('ev_sales: no WDS data rows produced')
    metadata_rows = [
        (f'v{vid}', f'StatCan WDS vector {vid}', 'Number', 'units', 'Statistics Canada', '')
        for vid in ALL_WDS_VECTORS
    ]
    n = processor.replace_raw_data(SOURCE_KEY, data_rows, metadata_rows)
    print(f'    Stored {n} source-native WDS rows for ev_sales')
    return n


def transform_ev_sales(processor) -> int:
    """EFB transform: amalgamate WDS vectors into ev_* indicators."""
    df = processor.get_raw_dataframe(SOURCE_KEY)
    if df.empty:
        raise RuntimeError('ev_sales transform: no raw rows found')

    data_rows = _build_indicator_rows(df)
    if not data_rows:
        raise RuntimeError('ev_sales transform: no indicator rows produced')
    n = processor.store_indicators(SOURCE_KEY, data_rows, EV_SALES_METADATA)
    print(f'    Stored {n} indicator rows for ev_sales')
    return n


def build_ev_sales_rows(config=None) -> List[Tuple[str, str, float]]:
    """Legacy helper: amalgamate WDS vectors (used when transform runs without DB)."""
    old_rows = _fetch_wds_raw_rows(
        [EV_SALES_OLD_TOTAL, EV_SALES_OLD_BEV, EV_SALES_OLD_PHEV],
        start_ref='2010-01-01',
        config=config,
    )
    new_rows = _fetch_wds_raw_rows(
        [EV_SALES_NEW_TOTAL, EV_SALES_NEW_BEV, EV_SALES_NEW_PHEV],
        start_ref='2016-01-01',
        config=config,
    )
    df = pd.DataFrame(
        [(vector, ref_date, value) for vector, ref_date, value in old_rows + new_rows],
        columns=['vector', 'ref_date', 'value'],
    )
    return _build_indicator_rows(df)
