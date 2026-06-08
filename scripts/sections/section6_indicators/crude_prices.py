"""Page 117 — WTI and WCS crude prices."""

import io
import re
from datetime import datetime
from typing import Dict, List, Optional, Tuple

import pandas as pd

from config_loader import get_config
from utils.http_retry import fetch_get, resilience_from_config

from .constants import BOC_VALET, EIA_WTI_XLS, FETCH_UA, SPROULE_BASE


def _crude_month_key(dt: datetime) -> int:
    return dt.year * 100 + dt.month


def _http_get(url, *, timeout=120, headers=FETCH_UA, config=None, params=None, label="HTTP"):
    cfg = config or get_config()
    max_r, delay = resilience_from_config(cfg)
    return fetch_get(
        url, timeout=timeout, headers=headers, params=params,
        max_retries=max_r, retry_delay_seconds=delay, label=label,
    )


def _fetch_crude_eia_wti_monthly(config=None) -> Dict[int, float]:
    response = _http_get(EIA_WTI_XLS, timeout=120, headers=FETCH_UA, config=config, label="EIA WTI")
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


def _fetch_crude_sproule_wcs_monthly(config=None) -> Dict[int, float]:
    last_error: Optional[Exception] = None
    for url in _crude_sproule_urls():
        try:
            response = _http_get(url, timeout=120, headers=FETCH_UA, config=config, label="Sproule WCS")
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


def _fetch_crude_boc_series(series: str, start: str, end: str, config=None) -> Dict[int, float]:
    url = BOC_VALET.format(series=series)
    response = _http_get(
        url,
        params={'start_date': start, 'end_date': end},
        timeout=120,
        headers=FETCH_UA,
        config=config,
        label="Bank of Canada FX",
    )
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


def _fetch_crude_usd_cad_monthly(config=None) -> Dict[int, float]:
    archived = _fetch_crude_boc_series('IEXM0101', '2009-01-01', '2016-12-31', config=config)
    current = _fetch_crude_boc_series(
        'FXMUSDCAD', '2017-01-01', datetime.now().strftime('%Y-%m-%d'), config=config
    )
    return {**archived, **current}


def build_crude_price_rows(config=None) -> List[Tuple[str, str, float]]:
    wti = _fetch_crude_eia_wti_monthly(config=config)
    wcs_cad = _fetch_crude_sproule_wcs_monthly(config=config)
    fx = _fetch_crude_usd_cad_monthly(config=config)

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


SOURCE_KEY = 'crude_prices'


def update_crude_prices(processor) -> int:
    """EEDAS ingest: EIA WTI, Sproule WCS (CAD), BoC USD/CAD monthly series."""
    print('  Fetching WTI, WCS and USD/CAD exchange rates...')
    wti = _fetch_crude_eia_wti_monthly(config=processor.config)
    wcs_cad = _fetch_crude_sproule_wcs_monthly(config=processor.config)
    fx = _fetch_crude_usd_cad_monthly(config=processor.config)

    data_rows: List[Tuple[str, str, float]] = []
    for month, val in wti.items():
        data_rows.append(('raw_wti', str(month), val))
    for month, val in wcs_cad.items():
        data_rows.append(('raw_wcs_cad', str(month), val))
    for month, val in fx.items():
        data_rows.append(('raw_usd_cad', str(month), val))

    if not data_rows:
        raise RuntimeError('crude_prices: no source-native rows produced')
    print(f'    Prepared {len(data_rows)} raw monthly data points')
    metadata_rows = [
        ('raw_wti', 'EIA WTI spot (USD/bbl)', 'USD per barrel', 'units', 'U.S. EIA', EIA_WTI_XLS),
        ('raw_wcs_cad', 'Sproule WCS (CAD/bbl)', 'CAD per barrel', 'units', 'Sproule ERCE', SPROULE_BASE),
        ('raw_usd_cad', 'Bank of Canada USD/CAD', 'CAD per USD', 'units', 'Bank of Canada', BOC_VALET),
    ]
    return processor.replace_raw_data(SOURCE_KEY, data_rows, metadata_rows)


def _monthly_series(df, vector: str) -> Dict[int, float]:
    sub = df[df['vector'].astype(str) == vector]
    out: Dict[int, float] = {}
    for _, row in sub.iterrows():
        try:
            out[int(str(row['ref_date']))] = float(row['value'])
        except (TypeError, ValueError):
            continue
    return out


def transform_crude_prices(processor) -> int:
    """EFB transform: merge WTI/WCS/FX raw series into crude_* indicators."""
    df = processor.get_raw_dataframe(SOURCE_KEY)
    if df.empty:
        raise RuntimeError('crude_prices transform: no raw rows found')

    wti = _monthly_series(df, 'raw_wti')
    wcs_cad = _monthly_series(df, 'raw_wcs_cad')
    fx = _monthly_series(df, 'raw_usd_cad')

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

    if not data_rows:
        raise RuntimeError('crude_prices transform: no indicator rows produced')

    from .constants import CRUDE_PRICES_METADATA
    n = processor.store_indicators(SOURCE_KEY, data_rows, CRUDE_PRICES_METADATA)
    print(f'    Stored {n} indicator rows for crude_prices')
    return n
