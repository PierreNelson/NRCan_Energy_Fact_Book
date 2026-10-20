"""Western Canada oil and natural gas wells completed (count and average depth).

Pages 110 and 126 share the provincial sources in the combined indicator spec.
Oil totals are stored for page 110. Natural gas totals are stored for page 126.
"""

from __future__ import annotations

import io
import json
import re
import zipfile
from datetime import datetime, timezone
from html import unescape
from html.parser import HTMLParser
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from urllib.parse import urljoin

import pandas as pd

from config_loader import get_config
from utils.http_retry import fetch_get, resilience_from_config
from xlsx_paths import resolve_root_xlsx

from .constants import (
    AB_WELLS_HISTORICAL_CSV,
    AER_ST59_URL,
    BC_OIL_WELLS_COMPLETIONS_CSV,
    BC_WELL_DATA_CENTRE_URL,
    BROWSER_HEADERS,
    MANUAL_WELL_OVERRIDES_CSV,
    MB_WELL_STATS_URL,
    SK_OIL_WELLS_URL,
    WESTERN_CANADA_OIL_WELLS_METADATA,
)

SOURCE_KEY = 'western_canada_oil_wells'
MIN_YEAR = 2000
# The latest Western Canada year is published when at least this many provinces
# have both a count and a depth total. One lagging province does not drop the year.
MIN_PROVINCES_FOR_LATEST = 3

PRODUCTS = ('Oil', 'Natural Gas')
_BUILD_CACHE: Optional[dict] = None


def _http_get(url: str, *, timeout: int = 120, headers=None, config=None, label: str = 'HTTP'):
    cfg = config or get_config()
    max_r, delay = resilience_from_config(cfg)
    return fetch_get(
        url,
        timeout=timeout,
        headers=headers or BROWSER_HEADERS,
        max_retries=max_r,
        retry_delay_seconds=delay,
        label=label,
    )


def _product_name(value) -> Optional[str]:
    key = str(value or '').strip().casefold()
    if key in ('oil', 'crude oil'):
        return 'Oil'
    if key in ('gas', 'natural gas'):
        return 'Natural Gas'
    return None


def _parse_number(value) -> Optional[float]:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    text = str(value).strip().replace(',', '').replace('\xa0', '').replace(' ', '')
    if text.lower() in ('', '-', '—', 'n/a', 'na', 'nan'):
        return None
    try:
        return float(text)
    except ValueError:
        return None


def _row(province: str, year: int, product: str, count: float, metres: float) -> Dict[str, float]:
    return {
        'Province': province,
        'Year': int(year),
        'Product': product,
        'Count': float(count),
        'Metres': float(metres),
    }


class _HtmlTables(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tables: List[List[List[str]]] = []
        self._rows = None
        self._row = None
        self._buf = None

    def handle_starttag(self, tag, attrs):
        if tag == 'table':
            self._rows = []
        elif tag == 'tr' and self._rows is not None:
            self._row = []
        elif tag in ('td', 'th') and self._row is not None:
            self._buf = []

    def handle_endtag(self, tag):
        if tag in ('td', 'th') and self._buf is not None:
            text = re.sub(r'\s+', ' ', ''.join(self._buf)).strip()
            self._row.append(text)
            self._buf = None
        elif tag == 'tr' and self._row is not None:
            if any(self._row):
                self._rows.append(self._row)
            self._row = None
        elif tag == 'table' and self._rows is not None:
            if self._rows:
                self.tables.append(self._rows)
            self._rows = None

    def handle_data(self, data):
        if self._buf is not None:
            self._buf.append(data)


def _st59_total(raw: pd.DataFrame, header_label: str) -> Tuple[float, float]:
    header = raw.iloc[6].astype(str).tolist()
    column = next(i for i, cell in enumerate(header) if header_label in cell.upper())
    total_rows = raw[raw.iloc[:, 0].astype(str).str.strip().str.upper() == 'TOTAL']
    if total_rows.empty:
        raise ValueError(f'AB ST59: TOTAL row not found for {header_label}')
    total = total_rows.iloc[0]
    return float(total.iloc[column + 4]), float(total.iloc[column + 5])


def _fetch_ab_latest(config=None) -> Tuple[List[Dict[str, float]], dict]:
    """Latest ST59 year: crude oil plus crude bitumen, and natural gas. No coalbed methane."""
    check = {'source': 'AB ST59', 'status': 'PASS', 'records': 0, 'detail': ''}
    page = _http_get(AER_ST59_URL, config=config, label='AER ST59 index')
    links = []
    for href in re.findall(r'href="([^"]+)"', page.text):
        match = re.search(r'ST59[_-](\d{4})\.(xls|xlsx)', href, re.I)
        if match:
            links.append((int(match.group(1)), href))
    if not links:
        raise ValueError('AB ST59 index has no yearly workbook')
    year, href = max(links)
    full = href if href.startswith('http') else f'https://www.aer.ca{href}'
    response = _http_get(full, config=config, label=f'AB ST59 {year}')
    engine = 'xlrd' if full.lower().endswith('.xls') else 'openpyxl'
    raw = pd.read_excel(io.BytesIO(response.content), sheet_name='AB Drilling Activity', header=None, engine=engine)
    oil_wells, oil_metres = _st59_total(raw, 'CRUDE OIL')
    bitumen_wells, bitumen_metres = _st59_total(raw, 'CRUDE BITUMEN')
    gas_wells, gas_metres = _st59_total(raw, 'NATURAL GAS')
    rows = [
        _row('AB', year, 'Oil', oil_wells + bitumen_wells, oil_metres + bitumen_metres),
        _row('AB', year, 'Natural Gas', gas_wells, gas_metres),
    ]
    check.update({
        'records': 2,
        'year': year,
        'retrieved': datetime.now(timezone.utc).isoformat(),
        'detail': full,
    })
    return rows, check


def _load_ab_historical(latest_source_year: Optional[int]) -> Tuple[List[Dict[str, float]], dict]:
    path = resolve_root_xlsx(AB_WELLS_HISTORICAL_CSV)
    df = pd.read_csv(path, encoding='utf-8-sig')
    rows = []
    for _, record in df.iterrows():
        product = _product_name(record.get('Product'))
        year = _parse_number(record.get('Year'))
        count = _parse_number(record.get('Count'))
        metres = _parse_number(record.get('Metres'))
        if product is None or year is None or count is None or metres is None:
            continue
        year = int(year)
        if year < MIN_YEAR:
            continue
        if latest_source_year is not None and year == latest_source_year:
            continue
        rows.append(_row('AB', year, product, count, metres))
    return rows, {
        'source': 'AB historical CSV',
        'status': 'PASS' if rows else 'WARNING',
        'records': len(rows),
        'detail': AB_WELLS_HISTORICAL_CSV,
    }


def _fetch_sk(config=None) -> Tuple[List[Dict[str, float]], dict]:
    response = _http_get(SK_OIL_WELLS_URL, timeout=180, config=config, label='SK Petrinex wells')
    outer = zipfile.ZipFile(io.BytesIO(response.content))
    inner = zipfile.ZipFile(io.BytesIO(outer.read('Well Infrastructure-SK.csv.zip')))
    df = pd.read_csv(inner.open(inner.namelist()[0]), low_memory=False)
    extracted = len(df)
    df['Product'] = df['WellStatusFluid'].map(_product_name)
    df = df[df['Product'].notna()].copy()
    df['Year'] = pd.to_datetime(df['FinishedDrillDate'], errors='coerce').dt.year
    df['Metres'] = pd.to_numeric(df['FinalTotalDepth'], errors='coerce')
    df = df[df['Year'] >= MIN_YEAR]
    missing_depth = int(df['Metres'].isna().sum())
    df = df[df['Metres'].notna()]
    grouped = df.groupby(['Year', 'Product'], as_index=False).agg(
        Count=('Metres', 'size'),
        Metres=('Metres', 'sum'),
    )
    rows = [
        _row('SK', int(record.Year), record.Product, record.Count, record.Metres)
        for record in grouped.itertuples(index=False)
    ]
    return rows, {
        'source': 'SK Petrinex',
        'status': 'PASS' if rows else 'FAIL',
        'records': extracted,
        'loaded': len(rows),
        'missing_depth': missing_depth,
        'retrieved': datetime.now(timezone.utc).isoformat(),
    }


def _manitoba_from_page(html: str) -> Dict[int, Dict[str, Optional[float]]]:
    parser = _HtmlTables()
    parser.feed(html)
    by_year: Dict[int, Dict[str, Optional[float]]] = {}
    for table in parser.tables:
        header_index = None
        year_columns = {}
        for index, row in enumerate(table):
            years = {}
            for col, cell in enumerate(row):
                match = re.fullmatch(r'(19|20)\d{2}', cell.strip())
                if match:
                    years[col] = int(cell.strip())
            if years and any(cell.casefold().startswith('categor') for cell in row):
                header_index = index
                year_columns = years
                break
        if header_index is None:
            continue
        for row in table[header_index + 1:]:
            label = (row[0] if row else '').strip().casefold()
            field = None
            if label == 'new wells drilled':
                field = 'Count'
            elif label == 'metres drilled':
                field = 'Metres'
            if field is None:
                continue
            for col, year in year_columns.items():
                if col >= len(row):
                    continue
                value = _parse_number(row[col])
                if value is None:
                    continue
                bucket = by_year.setdefault(year, {'Count': None, 'Metres': None})
                bucket[field] = value
    return by_year


def _load_overrides() -> List[dict]:
    path = resolve_root_xlsx(MANUAL_WELL_OVERRIDES_CSV)
    if not path.is_file():
        return []
    df = pd.read_csv(path, encoding='utf-8-sig')
    overrides = []
    for _, record in df.iterrows():
        product = _product_name(record.get('Product'))
        year = _parse_number(record.get('Year'))
        value = _parse_number(record.get('Value'))
        variable = str(record.get('Variable') or '').strip().casefold()
        province = str(record.get('Province') or '').strip().upper()
        if product is None or year is None or value is None or province != 'MB':
            continue
        if variable not in ('count', 'metres'):
            continue
        overrides.append({
            'Year': int(year),
            'Product': product,
            'Variable': 'Count' if variable == 'count' else 'Metres',
            'Value': value,
        })
    return overrides


def _fetch_mb(config=None) -> Tuple[List[Dict[str, float]], dict]:
    response = _http_get(MB_WELL_STATS_URL, config=config, label='MB petroleum stats')
    by_year = _manitoba_from_page(response.text)
    # The statistics page publishes one wells-drilled series. The override file
    # labels that series as oil, and the page does not publish a gas split.
    oil = {
        year: {'Count': values.get('Count'), 'Metres': values.get('Metres')}
        for year, values in by_year.items()
        if year >= MIN_YEAR
    }
    overrides = _load_overrides()
    applied = 0
    for item in overrides:
        if item['Product'] != 'Oil':
            continue
        bucket = oil.setdefault(item['Year'], {'Count': None, 'Metres': None})
        bucket[item['Variable']] = item['Value']
        applied += 1
    rows = []
    incomplete = []
    for year, values in sorted(oil.items()):
        if values.get('Count') is None or values.get('Metres') is None:
            incomplete.append(year)
            continue
        rows.append(_row('MB', year, 'Oil', values['Count'], values['Metres']))
    status = 'PASS' if rows else 'WARNING'
    return rows, {
        'source': 'MB petroleum statistics',
        'status': status,
        'records': len(by_year),
        'loaded': len(rows),
        'overrides_applied': applied,
        'years_missing_count_or_metres': incomplete,
        'retrieved': datetime.now(timezone.utc).isoformat(),
        'detail': 'Page series is not split by product; published wells and metres are oil. Gas is unpublished.',
    }


def _bc_zip_url(page_url: str, html: str) -> str:
    for href in re.findall(r'href="([^"]+)"', html, flags=re.I):
        target = unescape(href)
        if target.endswith('drill_csv.zip') or 'drill_csv.zip' in target:
            return urljoin(page_url, target)
    raise ValueError('BC data centre page has no drill_csv.zip completion download')


def _fetch_bc(config=None) -> Tuple[List[Dict[str, float]], dict]:
    page = _http_get(BC_WELL_DATA_CENTRE_URL, timeout=180, config=config, label='BC ER data centre')
    if page.content[:2] == b'PK':
        content = page.content
        source_url = BC_WELL_DATA_CENTRE_URL
    else:
        source_url = _bc_zip_url(BC_WELL_DATA_CENTRE_URL, page.text)
        content = _http_get(source_url, timeout=180, config=config, label='BC completion zip').content
    archive = zipfile.ZipFile(io.BytesIO(content))
    names = archive.namelist()
    csv_name = next((name for name in names if name.lower().endswith(BC_OIL_WELLS_COMPLETIONS_CSV.lower())), None)
    if csv_name is None:
        raise ValueError(f'BC zip missing {BC_OIL_WELLS_COMPLETIONS_CSV}')
    df = pd.read_csv(archive.open(csv_name), header=1, low_memory=False)
    extracted = len(df)
    cols = {str(column).strip().lower(): column for column in df.columns}
    fluid_col = cols.get('flow_fluid_type')
    uwi_col = cols.get('uwi')
    date_col = cols.get('compltn_date')
    depth_col = cols.get('compltn_base_depth (m)') or cols.get('compltn_base_depth_m')
    if not all((fluid_col, uwi_col, date_col, depth_col)):
        raise ValueError('BC compl_wo.csv is missing a completion column')
    df = df.rename(columns={
        fluid_col: 'flow_fluid_type',
        uwi_col: 'uwi',
        date_col: 'compltn_date',
        depth_col: 'compltn_base_depth_m',
    })
    df['compltn_date'] = pd.to_datetime(df['compltn_date'].astype(str).str.strip(), format='%Y%m%d', errors='coerce')
    df['compltn_base_depth_m'] = pd.to_numeric(df['compltn_base_depth_m'], errors='coerce')
    before = len(df)
    df = df.sort_values(['uwi', 'compltn_date', 'compltn_base_depth_m'], ascending=[True, False, False])
    df = df.drop_duplicates(subset=['uwi'], keep='first')
    duplicates_removed = before - len(df)
    df['Product'] = df['flow_fluid_type'].map(_product_name)
    df = df[df['Product'].notna()].copy()
    df['Year'] = df['compltn_date'].dt.year
    df = df[df['Year'] >= MIN_YEAR]
    missing_depth = int(df['compltn_base_depth_m'].isna().sum())
    df = df[df['compltn_base_depth_m'].notna()]
    grouped = df.groupby(['Year', 'Product'], as_index=False).agg(
        Count=('uwi', 'size'),
        Metres=('compltn_base_depth_m', 'sum'),
    )
    rows = [
        _row('BC', int(record.Year), record.Product, record.Count, record.Metres)
        for record in grouped.itertuples(index=False)
    ]
    return rows, {
        'source': 'BC completion/workover',
        'status': 'PASS' if rows else 'FAIL',
        'records': extracted,
        'loaded': len(rows),
        'duplicates_removed': duplicates_removed,
        'missing_depth': missing_depth,
        'retrieved': datetime.now(timezone.utc).isoformat(),
        'detail': source_url,
    }


def _index_rows(rows: List[Dict[str, float]]) -> Dict[Tuple[str, int, str], Dict[str, float]]:
    indexed = {}
    for row in rows:
        if row['Count'] is None or row['Year'] < MIN_YEAR:
            continue
        indexed[(row['Province'], int(row['Year']), row['Product'])] = row
    return indexed


def _aggregate(rows: List[Dict[str, float]], product: str) -> Tuple[Dict[int, Dict[str, float]], Optional[int]]:
    by_year: Dict[int, Dict[str, float]] = {}
    for row in rows:
        if row['Product'] != product:
            continue
        year = int(row['Year'])
        bucket = by_year.setdefault(year, {'wells': 0.0, 'metres': 0.0, 'provinces': set()})
        bucket['wells'] += float(row['Count'])
        bucket['metres'] += float(row['Metres'])
        bucket['provinces'].add(row['Province'])
    dropped_years = []
    while by_year:
        latest = max(by_year)
        if len(by_year[latest]['provinces']) >= MIN_PROVINCES_FOR_LATEST:
            break
        dropped_years.append(latest)
        del by_year[latest]
    return by_year, dropped_years


def _raw_rows(product: str, provincial: List[Dict[str, float]], aggregated: Dict[int, Dict[str, float]]) -> List[Tuple[str, str, float]]:
    prefix = 'raw_wc_oil' if product == 'Oil' else 'raw_wc_gas'
    rows: List[Tuple[str, str, float]] = []
    for row in provincial:
        if row['Product'] != product:
            continue
        year_key = str(int(row['Year']))
        province = str(row['Province']).lower()
        rows.append((f'{prefix}_{province}_wells', year_key, float(row['Count'])))
        rows.append((f'{prefix}_{province}_metres', year_key, float(row['Metres'])))
    for year in sorted(aggregated):
        wells = aggregated[year]['wells']
        metres = aggregated[year]['metres']
        year_key = str(year)
        rows.append((f'{prefix}_wells_completed', year_key, wells))
        rows.append((f'{prefix}_total_metres', year_key, metres))
        rows.append((f'{prefix}_avg_depth_m', year_key, metres / wells if wells else 0.0))
    return rows


def _write_validation_log(payload: dict) -> None:
    log_dir = Path(__file__).resolve().parents[2] / 'logs'
    log_dir.mkdir(parents=True, exist_ok=True)
    path = log_dir / 'western_canada_wells_validation.json'
    path.write_text(json.dumps(payload, indent=2) + '\n', encoding='utf-8')


def build_western_canada_well_completions(config=None) -> dict:
    """Download every provincial source once and build oil and gas totals."""
    global _BUILD_CACHE
    if _BUILD_CACHE is not None:
        return _BUILD_CACHE

    checks = []
    ab_latest, ab_check = _fetch_ab_latest(config)
    checks.append(ab_check)
    latest_year = int(ab_latest[0]['Year']) if ab_latest else None
    ab_historical, historical_check = _load_ab_historical(latest_year)
    checks.append(historical_check)
    sk_rows, sk_check = _fetch_sk(config)
    checks.append(sk_check)
    mb_rows, mb_check = _fetch_mb(config)
    checks.append(mb_check)
    bc_rows, bc_check = _fetch_bc(config)
    checks.append(bc_check)

    indexed = _index_rows(ab_historical + ab_latest + sk_rows + mb_rows + bc_rows)
    provincial = list(indexed.values())
    result = {'checks': checks, 'provincial': provincial}
    for product, key in (('Oil', 'oil'), ('Natural Gas', 'gas')):
        aggregated, dropped = _aggregate(provincial, product)
        coverage = {
            str(year): sorted(bucket['provinces'])
            for year, bucket in sorted(aggregated.items())
        }
        if dropped:
            checks.append({
                'source': f'{product} latest year',
                'status': 'WARNING',
                'detail': (
                    f'{", ".join(str(year) for year in dropped)} '
                    f'{"was" if len(dropped) == 1 else "were"} not published because fewer than '
                    f'{MIN_PROVINCES_FOR_LATEST} provinces had both count and metres.'
                ),
            })
        result[f'{key}_raw'] = _raw_rows(product, provincial, aggregated)
        result[f'{key}_coverage'] = coverage
        result[f'{key}_years'] = sorted(aggregated)
    payload = {
        'executed_at': datetime.now(timezone.utc).isoformat(),
        'reporting_years': {
            'oil': result['oil_years'],
            'natural_gas': result['gas_years'],
        },
        'checks': checks,
        'province_coverage': {
            'oil': result['oil_coverage'],
            'natural_gas': result['gas_coverage'],
        },
        'provincial_records': len(provincial),
        'western_canada_oil_years': len(result['oil_years']),
        'western_canada_gas_years': len(result['gas_years']),
    }
    _write_validation_log(payload)
    result['log'] = payload
    _BUILD_CACHE = result
    return result


def _transform_from_raw(df: pd.DataFrame, *, wells_vector: str, metres_vector: str, out_prefix: str) -> List[Tuple[str, str, float]]:
    by_year: Dict[str, Dict[str, float]] = {}
    for _, row in df.iterrows():
        vector = str(row['vector'])
        year_key = str(row['ref_date'])
        try:
            value = float(row['value'])
        except (TypeError, ValueError):
            continue
        if vector == wells_vector:
            by_year.setdefault(year_key, {})['wells'] = value
        elif vector == metres_vector:
            by_year.setdefault(year_key, {})['metres'] = value
    data_rows = []
    for year_key in sorted(by_year, key=lambda year: int(year)):
        if int(year_key) < MIN_YEAR:
            continue
        bucket = by_year[year_key]
        wells = bucket.get('wells')
        metres = bucket.get('metres')
        if wells is None or metres is None or wells == 0:
            continue
        data_rows.append((f'{out_prefix}_wells_completed', year_key, wells))
        data_rows.append((f'{out_prefix}_total_metres', year_key, metres))
        data_rows.append((f'{out_prefix}_avg_depth_m', year_key, metres / wells))
    return data_rows


def build_western_canada_oil_wells_raw_rows(config=None):
    built = build_western_canada_well_completions(config)
    notes = [
        f"{check['source']}: {check['status']}"
        for check in built['checks']
        if check.get('status') != 'PASS'
    ]
    return built['oil_raw'], ('; '.join(notes) or None)


def update_western_canada_oil_wells(processor) -> int:
    print('  Fetching Western Canada oil and gas well completions (AB, SK, MB, BC)...')
    rows, source_note = build_western_canada_oil_wells_raw_rows(processor.config)
    if source_note:
        print(f'    NOTE: {source_note}')
    if not rows:
        print('    WARNING: no Western Canada oil wells rows produced')
        return 0
    print(f'    Prepared {len(rows)} Western Canada oil wells data points')
    return processor.replace_raw_data(SOURCE_KEY, rows, list(WESTERN_CANADA_OIL_WELLS_METADATA))


def transform_western_canada_oil_wells(processor) -> int:
    df = processor.get_raw_dataframe(SOURCE_KEY)
    if df.empty:
        print('    western_canada_oil_wells transform: no raw rows found — re-run eedas update')
        return 0
    data_rows = _transform_from_raw(
        df,
        wells_vector='raw_wc_oil_wells_completed',
        metres_vector='raw_wc_oil_total_metres',
        out_prefix='wc_oil',
    )
    if not data_rows:
        print('    western_canada_oil_wells transform: no indicator rows produced')
        return 0
    n = processor.store_indicators(SOURCE_KEY, data_rows, WESTERN_CANADA_OIL_WELLS_METADATA)
    print(f'    Stored {n} indicator rows for western_canada_oil_wells')
    return n
