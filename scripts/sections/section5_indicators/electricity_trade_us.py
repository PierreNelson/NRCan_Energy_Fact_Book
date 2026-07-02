"""Canada electricity trade with the U.S. (CER Electricity Trade Summary XLSM)."""

import io
from collections import defaultdict
from typing import Dict, List, Set, Tuple

import pandas as pd

from config_loader import get_config
from utils.http_retry import fetch_get, resilience_from_config
from utils.io_retry import run_with_retry

from .constants import (
    CER_ELECTRICITY_TRADE_METADATA,
    CER_ELECTRICITY_TRADE_MONTHLY_SHEET,
    CER_ELECTRICITY_TRADE_REQUIRED_MONTHS,
    CER_ELECTRICITY_TRADE_SHEET,
    CER_ELECTRICITY_TRADE_URL,
)

SOURCE_KEY = 'electricity_trade_us'
RAW_EXPORTS = 'exports_mwh'
RAW_IMPORTS = 'imports_mwh'
RAW_MONTHS = 'months_reported'


def _fetch_xlsm_bytes(config=None) -> bytes:
    cfg = config or get_config()
    max_r, delay = resilience_from_config(cfg)
    headers = {
        'User-Agent': (
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
            '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        ),
        'Accept': '*/*',
    }
    response = fetch_get(
        CER_ELECTRICITY_TRADE_URL,
        timeout=120,
        headers=headers,
        max_retries=max_r,
        retry_delay_seconds=delay,
        label='CER electricity trade XLSM',
    )
    if response.status_code != 200:
        raise RuntimeError(f'electricity_trade_us: HTTP {response.status_code} fetching XLSM')
    return response.content


def _parse_annual_trade_rows(xlsm_bytes: bytes) -> List[Tuple[int, float, float]]:
    xl = pd.ExcelFile(io.BytesIO(xlsm_bytes), engine='openpyxl')
    if CER_ELECTRICITY_TRADE_SHEET not in xl.sheet_names:
        raise RuntimeError(f'electricity_trade_us: sheet {CER_ELECTRICITY_TRADE_SHEET!r} not found')
    df = pd.read_excel(xl, sheet_name=CER_ELECTRICITY_TRADE_SHEET, header=0)
    export_col = 'Exports / Exportations (MW.h)'
    import_col = 'Imports / Importations (MW.h)'
    if export_col not in df.columns or import_col not in df.columns:
        raise RuntimeError('electricity_trade_us: expected export/import MWh columns missing')
    rows: List[Tuple[int, float, float]] = []
    for _, record in df.iterrows():
        raw_year = record.get('Date')
        if pd.isna(raw_year):
            continue
        try:
            year = int(raw_year)
        except (TypeError, ValueError):
            continue
        exports_mwh = record.get(export_col)
        imports_mwh = record.get(import_col)
        if pd.isna(exports_mwh) or pd.isna(imports_mwh):
            continue
        rows.append((year, float(exports_mwh), float(imports_mwh)))
    if not rows:
        raise RuntimeError('electricity_trade_us: no annual rows parsed from XLSM')
    return sorted(rows, key=lambda item: item[0])


def _parse_monthly_month_counts(xlsm_bytes: bytes) -> Dict[int, int]:
    """Count distinct months per year in the monthly trade sheet."""
    xl = pd.ExcelFile(io.BytesIO(xlsm_bytes), engine='openpyxl')
    if CER_ELECTRICITY_TRADE_MONTHLY_SHEET not in xl.sheet_names:
        raise RuntimeError(
            f'electricity_trade_us: sheet {CER_ELECTRICITY_TRADE_MONTHLY_SHEET!r} not found'
        )
    df = pd.read_excel(xl, sheet_name=CER_ELECTRICITY_TRADE_MONTHLY_SHEET, header=0)
    if 'Date' not in df.columns:
        raise RuntimeError('electricity_trade_us: monthly sheet missing Date column')
    months_by_year: Dict[int, Set[int]] = defaultdict(set)
    for _, record in df.iterrows():
        dt = pd.to_datetime(record.get('Date'), errors='coerce')
        if pd.isna(dt):
            continue
        months_by_year[int(dt.year)].add(int(dt.month))
    if not months_by_year:
        raise RuntimeError('electricity_trade_us: no monthly rows parsed from XLSM')
    return {year: len(months) for year, months in months_by_year.items()}


def _years_with_full_months(month_counts: Dict[int, int]) -> Set[int]:
    return {
        year
        for year, count in month_counts.items()
        if count >= CER_ELECTRICITY_TRADE_REQUIRED_MONTHS
    }


def _filter_publishable_annual(
    annual: List[Tuple[int, float, float]],
    month_counts: Dict[int, int],
) -> List[Tuple[int, float, float]]:
    """Only publish years with 12 monthly rows in Fig. 1(m), Fig. 3(m)."""
    complete_years = _years_with_full_months(month_counts)
    publishable = [(y, e, i) for y, e, i in annual if y in complete_years]
    if not publishable:
        raise RuntimeError('electricity_trade_us: no years with 12 monthly rows to publish')
    skipped = sorted({y for y, _, _ in annual if y not in complete_years})
    if skipped:
        detail = ', '.join(f'{y} ({month_counts.get(y, 0)} months)' for y in skipped)
        print(
            f'    Skipping year(s) without {CER_ELECTRICITY_TRADE_REQUIRED_MONTHS} monthly rows '
            f'in {CER_ELECTRICITY_TRADE_MONTHLY_SHEET}: {detail}'
        )
    return publishable


def _mwh_to_twh(mwh: float) -> float:
    """Convert MWh to TWh with one decimal place (matches Factbook display)."""
    return round(float(mwh) / 1_000_000, 1)


def _indicator_rows_from_annual(annual: List[Tuple[int, float, float]]) -> List[Tuple[str, str, float]]:
    """Convert annual sheet rows to elec_trade_* indicator vectors."""
    rows: List[Tuple[str, str, float]] = []
    for year, exports_mwh, imports_mwh in annual:
        exports_twh = _mwh_to_twh(exports_mwh)
        imports_twh = _mwh_to_twh(imports_mwh)
        net_twh = round(exports_twh - imports_twh, 1)
        rows.extend([
            ('elec_trade_exports', str(year), exports_twh),
            ('elec_trade_imports', str(year), imports_twh),
            ('elec_trade_net', str(year), net_twh),
        ])
    return rows


def update_electricity_trade_us(processor) -> int:
    """EEDAS ingest: annual exports/imports in MWh from CER XLSM."""
    print('  Fetching CER electricity trade summary XLSM...')
    xlsm_bytes = _fetch_xlsm_bytes(processor.config)

    def _load_rows():
        annual_rows = _parse_annual_trade_rows(xlsm_bytes)
        month_counts = _parse_monthly_month_counts(xlsm_bytes)
        return annual_rows, month_counts

    annual, month_counts = run_with_retry(
        _load_rows,
        config=processor.config,
        label='CER electricity trade XLSM parse',
    )
    data_rows: List[Tuple[str, str, float]] = []
    for year, exports_mwh, imports_mwh in annual:
        data_rows.append((RAW_EXPORTS, str(year), round(exports_mwh, 4)))
        data_rows.append((RAW_IMPORTS, str(year), round(imports_mwh, 4)))
        data_rows.append((RAW_MONTHS, str(year), float(month_counts.get(year, 0))))
    metadata_rows = [
        (RAW_EXPORTS, 'Electricity exports to the U.S. (MWh)', 'MW.h', 'megawatt hours', 'Canada Energy Regulator', CER_ELECTRICITY_TRADE_URL),
        (RAW_IMPORTS, 'Electricity imports from the U.S. (MWh)', 'MW.h', 'megawatt hours', 'Canada Energy Regulator', CER_ELECTRICITY_TRADE_URL),
        (RAW_MONTHS, 'Monthly rows reported for year (Fig. 1(m))', 'Count', 'months', 'Canada Energy Regulator', CER_ELECTRICITY_TRADE_URL),
    ]
    n = processor.replace_raw_data(SOURCE_KEY, data_rows, metadata_rows)
    print(f'    Stored {n} source-native rows for electricity_trade_us')
    return n


def transform_electricity_trade_us(processor) -> int:
    """EFB transform: MWh → TWh indicators for this indicator (full years only)."""
    df = processor.get_raw_dataframe(SOURCE_KEY)
    if df.empty:
        raise RuntimeError('electricity_trade_us transform: no raw rows found')

    exports_by_year: Dict[int, float] = {}
    imports_by_year: Dict[int, float] = {}
    months_by_year: Dict[int, int] = {}
    for _, row in df.iterrows():
        vector = str(row['vector'])
        try:
            year = int(str(row['ref_date'])[:4])
        except (TypeError, ValueError):
            continue
        value = float(row['value'])
        if vector == RAW_EXPORTS:
            exports_by_year[year] = value
        elif vector == RAW_IMPORTS:
            imports_by_year[year] = value
        elif vector == RAW_MONTHS:
            months_by_year[year] = int(value)

    if not months_by_year:
        raise RuntimeError(
            'electricity_trade_us transform: missing months_reported raw rows — re-run eedas update'
        )

    complete_years = _years_with_full_months(months_by_year)
    years = sorted(
        set(exports_by_year) & set(imports_by_year) & complete_years
    )
    skipped = sorted(
        set(exports_by_year) & set(imports_by_year) - complete_years
    )
    if skipped:
        detail = ', '.join(f'{y} ({months_by_year.get(y, 0)} months)' for y in skipped)
        print(
            f'    Skipping year(s) without {CER_ELECTRICITY_TRADE_REQUIRED_MONTHS} monthly rows: {detail}'
        )
    if not years:
        raise RuntimeError('electricity_trade_us transform: no years with 12 monthly rows to publish')

    annual = [(y, exports_by_year[y], imports_by_year[y]) for y in years]
    data_rows = _indicator_rows_from_annual(annual)

    n = processor.store_indicators(SOURCE_KEY, data_rows, CER_ELECTRICITY_TRADE_METADATA)
    print(f'    Stored {n} indicator rows for electricity_trade_us ({years[0]}–{years[-1]})')
    return n


def build_electricity_trade_us_rows(config=None) -> List[Tuple[str, str, float]]:
    """Build indicator rows without SQL (for tests / offline export)."""
    xlsm_bytes = _fetch_xlsm_bytes(config)
    annual = _parse_annual_trade_rows(xlsm_bytes)
    month_counts = _parse_monthly_month_counts(xlsm_bytes)
    publishable = _filter_publishable_annual(annual, month_counts)
    return _indicator_rows_from_annual(publishable)
