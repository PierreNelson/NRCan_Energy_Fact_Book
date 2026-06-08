"""EV sales registration vectors (StatCan 20-10-0021-01 + 20-10-0025-01)."""

from collections import defaultdict
from typing import Dict, List, Optional, Tuple

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


def _fetch_wds_annual_totals(
    vector_ids: List[int], start_ref: str = '2010-01-01', config=None
) -> Dict[int, Dict[int, float]]:
    """Fetch StatCan WDS vectors and aggregate to annual totals per vector id."""
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
    totals: Dict[int, Dict[int, float]] = defaultdict(lambda: defaultdict(float))
    for item in items:
        if item.get('status') != 'SUCCESS':
            continue
        obj = item.get('object') or {}
        vid = obj.get('vectorId')
        if vid is None:
            continue
        for pt in obj.get('vectorDataPoint') or []:
            ref = pt.get('refPer') or pt.get('refPerRaw') or ''
            val = pt.get('value')
            if not ref or val is None:
                continue
            year = int(str(ref)[:4])
            totals[int(vid)][year] += float(val)
    return totals


def _wds_to_raw_rows(totals: Dict[int, Dict[int, float]]) -> List[Tuple[str, str, float]]:
    rows: List[Tuple[str, str, float]] = []
    for vid, by_year in totals.items():
        for year, value in by_year.items():
            rows.append((f'v{vid}', str(year), round(float(value), 4)))
    return rows


def update_ev_sales(processor) -> int:
    """EEDAS ingest: StatCan WDS v* vectors for EV registration tables."""
    print('  Fetching EV sales WDS vectors...')
    old = _fetch_wds_annual_totals(
        [EV_SALES_OLD_TOTAL, EV_SALES_OLD_BEV, EV_SALES_OLD_PHEV],
        start_ref='2010-01-01',
        config=processor.config,
    )
    new = _fetch_wds_annual_totals(
        [EV_SALES_NEW_TOTAL, EV_SALES_NEW_BEV, EV_SALES_NEW_PHEV],
        start_ref='2016-01-01',
        config=processor.config,
    )
    data_rows = _wds_to_raw_rows(old) + _wds_to_raw_rows(new)
    if not data_rows:
        raise RuntimeError('ev_sales: no WDS data rows produced')
    metadata_rows = [
        (f'v{vid}', f'StatCan WDS vector {vid}', 'Number', 'units', 'Statistics Canada', '')
        for vid in ALL_WDS_VECTORS
    ]
    n = processor.replace_raw_data(SOURCE_KEY, data_rows, metadata_rows)
    print(f'    Stored {n} source-native WDS rows for ev_sales')
    return n


def _annual_totals_from_raw(df, vector_id: int) -> Dict[int, float]:
    vec = f'v{vector_id}'
    sub = df[df['vector'].astype(str).str.lower() == vec.lower()]
    totals: Dict[int, float] = defaultdict(float)
    for _, row in sub.iterrows():
        try:
            year = int(str(row['ref_date'])[:4])
            totals[year] += float(row['value'])
        except (TypeError, ValueError):
            continue
    return dict(totals)


def transform_ev_sales(processor, max_year: Optional[int] = 2024) -> int:
    """EFB transform: amalgamate WDS vectors into ev_* indicators."""
    df = processor.get_raw_dataframe(SOURCE_KEY)
    if df.empty:
        raise RuntimeError('ev_sales transform: no raw rows found')

    old = {
        EV_SALES_OLD_TOTAL: _annual_totals_from_raw(df, EV_SALES_OLD_TOTAL),
        EV_SALES_OLD_BEV: _annual_totals_from_raw(df, EV_SALES_OLD_BEV),
        EV_SALES_OLD_PHEV: _annual_totals_from_raw(df, EV_SALES_OLD_PHEV),
    }
    new = {
        EV_SALES_NEW_TOTAL: _annual_totals_from_raw(df, EV_SALES_NEW_TOTAL),
        EV_SALES_NEW_BEV: _annual_totals_from_raw(df, EV_SALES_NEW_BEV),
        EV_SALES_NEW_PHEV: _annual_totals_from_raw(df, EV_SALES_NEW_PHEV),
    }

    data_rows: List[Tuple[str, str, float]] = []
    for year in range(2011, 2017):
        total = old[EV_SALES_OLD_TOTAL].get(year, 0.0)
        ev = old[EV_SALES_OLD_BEV].get(year, 0.0) + old[EV_SALES_OLD_PHEV].get(year, 0.0)
        if total <= 0 or ev <= 0:
            continue
        share = round((ev / total) * 100, 1)
        data_rows.extend([
            ('ev_total_regs', str(year), round(total, 0)),
            ('ev_new_regs', str(year), round(ev, 0)),
            ('ev_share_pct', str(year), share),
        ])

    quarterly_years = sorted(
        set(new[EV_SALES_NEW_TOTAL]) | set(new[EV_SALES_NEW_BEV]) | set(new[EV_SALES_NEW_PHEV])
    )
    for year in quarterly_years:
        if year < 2017:
            continue
        if max_year is not None and year > max_year:
            continue
        total = new[EV_SALES_NEW_TOTAL].get(year, 0.0)
        ev = new[EV_SALES_NEW_BEV].get(year, 0.0) + new[EV_SALES_NEW_PHEV].get(year, 0.0)
        if total <= 0 or ev <= 0:
            continue
        share = round((ev / total) * 100, 1)
        data_rows.extend([
            ('ev_total_regs', str(year), round(total, 0)),
            ('ev_new_regs', str(year), round(ev, 0)),
            ('ev_share_pct', str(year), share),
        ])

    if not data_rows:
        raise RuntimeError('ev_sales transform: no indicator rows produced')
    n = processor.store_indicators(SOURCE_KEY, data_rows, EV_SALES_METADATA)
    print(f'    Stored {n} indicator rows for ev_sales')
    return n


def build_ev_sales_rows(max_year: Optional[int] = None, config=None) -> List[Tuple[str, str, float]]:
    """Legacy helper: amalgamate WDS vectors (used when transform runs without DB)."""
    old = _fetch_wds_annual_totals(
        [EV_SALES_OLD_TOTAL, EV_SALES_OLD_BEV, EV_SALES_OLD_PHEV],
        start_ref='2010-01-01',
        config=config,
    )
    new = _fetch_wds_annual_totals(
        [EV_SALES_NEW_TOTAL, EV_SALES_NEW_BEV, EV_SALES_NEW_PHEV],
        start_ref='2016-01-01',
        config=config,
    )
    rows: List[Tuple[str, str, float]] = []
    for year in range(2011, 2017):
        total = old[EV_SALES_OLD_TOTAL].get(year, 0.0)
        ev = old[EV_SALES_OLD_BEV].get(year, 0.0) + old[EV_SALES_OLD_PHEV].get(year, 0.0)
        if total <= 0 or ev <= 0:
            continue
        share = round((ev / total) * 100, 1)
        rows.extend([
            ('ev_total_regs', str(year), round(total, 0)),
            ('ev_new_regs', str(year), round(ev, 0)),
            ('ev_share_pct', str(year), share),
        ])
    quarterly_years = sorted(set(new[EV_SALES_NEW_TOTAL]) | set(new[EV_SALES_NEW_BEV]) | set(new[EV_SALES_NEW_PHEV]))
    for year in quarterly_years:
        if year < 2017:
            continue
        if max_year is not None and year > max_year:
            continue
        total = new[EV_SALES_NEW_TOTAL].get(year, 0.0)
        ev = new[EV_SALES_NEW_BEV].get(year, 0.0) + new[EV_SALES_NEW_PHEV].get(year, 0.0)
        if total <= 0 or ev <= 0:
            continue
        share = round((ev / total) * 100, 1)
        rows.extend([
            ('ev_total_regs', str(year), round(total, 0)),
            ('ev_new_regs', str(year), round(ev, 0)),
            ('ev_share_pct', str(year), share),
        ])
    return rows
