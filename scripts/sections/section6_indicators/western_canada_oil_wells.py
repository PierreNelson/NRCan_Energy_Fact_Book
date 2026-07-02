"""Western Canada oil wells completed (count and average depth)."""

from __future__ import annotations

import io
import re
import zipfile
from typing import Dict, List, Optional, Tuple

import pandas as pd

from config_loader import get_config
from utils.http_retry import fetch_get, resilience_from_config

from .constants import (
    AER_ST59_URL,
    BC_OIL_WELLS_COMPLETIONS_CSV,
    BC_OIL_WELLS_URL,
    BROWSER_HEADERS,
    MB_OIL_WELLS_SHEET,
    PETROLEUM_EMP_XLSX,
    PETROLEUM_RESERVES_SEED_DIR,
    SK_OIL_WELLS_URL,
    WESTERN_CANADA_OIL_WELLS_METADATA,
)
from .petroleum_reserves import ensure_petroleum_reserves_seed_workbook, _workbook_path as reserves_workbook_path

SOURCE_KEY = 'western_canada_oil_wells'

PROVINCE_RAW_PREFIX = {
    'AB': 'raw_wc_oil_ab',
    'SK': 'raw_wc_oil_sk',
    'MB': 'raw_wc_oil_mb',
    'BC': 'raw_wc_oil_bc',
}

MIN_YEAR = 2000


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


def _parse_ab_crude_oil_totals(content: bytes, filename: str) -> Tuple[int, float, float]:
    engine = 'xlrd' if filename.lower().endswith('.xls') else 'openpyxl'
    raw = pd.read_excel(io.BytesIO(content), sheet_name='AB Drilling Activity', header=None, engine=engine)
    year_match = re.search(r'(\d{4})', filename)
    if year_match:
        year = int(year_match.group(1))
    else:
        year_text = str(raw.iloc[1, 0])
        year_match = re.search(r'(\d{4})', year_text)
        if not year_match:
            raise ValueError('Could not determine AB ST59 year')
        year = int(year_match.group(1))

    header_row = raw.iloc[6].astype(str).tolist()
    crude_col = next(i for i, cell in enumerate(header_row) if 'CRUDE OIL' in cell.upper())
    total_rows = raw[raw.iloc[:, 0].astype(str).str.strip().str.upper() == 'TOTAL']
    if total_rows.empty:
        raise ValueError(f'AB ST59 {year}: TOTAL row not found')
    total = total_rows.iloc[0]
    wells = float(total.iloc[crude_col + 4])
    metres = float(total.iloc[crude_col + 5])
    return year, wells, metres


def _fetch_ab_provincial_rows(config=None) -> Tuple[List[Dict[str, float]], Optional[str]]:
    page = _http_get(AER_ST59_URL, config=config, label='AER ST59 index')
    hrefs = re.findall(r'href="([^"]+)"', page.text)
    seen_years = set()
    rows: List[Dict[str, float]] = []
    note = None

    yearly_links = []
    for href in hrefs:
        match = re.search(r'ST59[_-](\d{4})\.(xls|xlsx)', href, re.I)
        if match:
            year = int(match.group(1))
            if year >= MIN_YEAR:
                yearly_links.append((year, href))

    yearly_links.sort(key=lambda item: item[0], reverse=True)
    for year, href in yearly_links:
        if year in seen_years:
            continue
        full = href if href.startswith('http') else f'https://www.aer.ca{href}'
        try:
            response = _http_get(full, config=config, label=f'AB ST59 {year}')
            parsed_year, wells, metres = _parse_ab_crude_oil_totals(response.content, full)
            if parsed_year < MIN_YEAR:
                continue
            seen_years.add(parsed_year)
            rows.append({
                'Province': 'AB',
                'Year': parsed_year,
                'Count': wells,
                'Metres': metres,
            })
        except Exception as exc:
            note = f'AB ST59 {year} skipped: {exc}'

    rows.sort(key=lambda r: r['Year'])
    return rows, note


def _fetch_sk_provincial_rows(config=None) -> List[Dict[str, float]]:
    response = _http_get(SK_OIL_WELLS_URL, timeout=180, config=config, label='SK Petrinex wells')
    z1 = zipfile.ZipFile(io.BytesIO(response.content))
    inner = z1.read('Well Infrastructure-SK.csv.zip')
    z2 = zipfile.ZipFile(io.BytesIO(inner))
    df = pd.read_csv(z2.open(z2.namelist()[0]), low_memory=False)
    oil = df[df['WellStatusFluid'].astype(str).str.upper() == 'OIL'].copy()
    oil['Year'] = pd.to_datetime(oil['FinishedDrillDate'], errors='coerce').dt.year
    oil = oil[oil['Year'] >= MIN_YEAR]
    grouped = oil.groupby('Year').agg(
        Count=('FinalTotalDepth', 'size'),
        Metres=('FinalTotalDepth', 'sum'),
    )
    rows = []
    for year, row in grouped.iterrows():
        if pd.isna(year):
            continue
        rows.append({
            'Province': 'SK',
            'Year': int(year),
            'Count': float(row['Count']),
            'Metres': float(row['Metres']),
        })
    rows.sort(key=lambda r: r['Year'])
    return rows


def _load_mb_provincial_rows(config=None) -> List[Dict[str, float]]:
    path = reserves_workbook_path(config)
    if not path.is_file():
        path = ensure_petroleum_reserves_seed_workbook(path)
    print(f'    Manitoba wells workbook: {path}')
    df = pd.read_excel(path, sheet_name=MB_OIL_WELLS_SHEET)
    cols = {str(c).strip().lower(): c for c in df.columns}
    province_col = cols.get('province', 'Province')
    year_col = cols.get('year', 'Year')
    product_col = cols.get('product', 'Product')
    welltype_col = cols.get('welltype', 'Welltype')
    count_col = cols.get('count', 'Count')
    metres_col = cols.get('metres', 'Metres')

    filtered = df[
        (df[province_col].astype(str).str.upper() == 'MB')
        & (df[product_col].astype(str).str.upper() == 'OIL')
        & (df[welltype_col].astype(str).str.upper() == 'TOTAL')
    ].copy()
    filtered['Year'] = pd.to_numeric(filtered[year_col], errors='coerce')
    filtered = filtered[filtered['Year'] >= MIN_YEAR]

    rows = []
    for _, row in filtered.iterrows():
        count = float(row[count_col])
        metres = float(row[metres_col])
        rows.append({
            'Province': 'MB',
            'Year': int(row['Year']),
            'Count': count,
            'Metres': metres,
        })
    rows.sort(key=lambda r: r['Year'])
    return rows


def _parse_bc_completion_csv(content: bytes) -> pd.DataFrame:
    """Parse BC IRIS compl_wo.csv (completion/workover records)."""
    z = zipfile.ZipFile(io.BytesIO(content))
    if BC_OIL_WELLS_COMPLETIONS_CSV not in z.namelist():
        matches = [n for n in z.namelist() if n.lower() == BC_OIL_WELLS_COMPLETIONS_CSV.lower()]
        if not matches:
            raise ValueError(f'BC zip missing {BC_OIL_WELLS_COMPLETIONS_CSV}')
        csv_name = matches[0]
    else:
        csv_name = BC_OIL_WELLS_COMPLETIONS_CSV

    df = pd.read_csv(z.open(csv_name), header=1, low_memory=False)
    cols = {str(c).strip().lower(): c for c in df.columns}
    fluid_col = cols.get('flow_fluid_type')
    uwi_col = cols.get('uwi')
    date_col = cols.get('compltn_date')
    depth_col = cols.get('compltn_base_depth (m)') or cols.get('compltn_base_depth_m')
    missing = [
        name for name, col in (
            ('flow_fluid_type', fluid_col),
            ('uwi', uwi_col),
            ('compltn_date', date_col),
            ('compltn_base_depth', depth_col),
        )
        if not col
    ]
    if missing:
        raise ValueError(f'BC compl_wo.csv missing columns: {missing}')
    return df.rename(columns={
        fluid_col: 'flow_fluid_type',
        uwi_col: 'uwi',
        date_col: 'compltn_date',
        depth_col: 'compltn_base_depth_m',
    })


def _fetch_bc_provincial_rows(config=None) -> Tuple[List[Dict[str, float]], Optional[str]]:
    try:
        response = _http_get(BC_OIL_WELLS_URL, timeout=180, config=config, label='BC IRIS drill_csv')
    except Exception as exc:
        return [], f'BC fetch failed: {exc}'

    if response.content[:2] != b'PK':
        return [], f'BC IRIS returned non-zip response (status {response.status_code})'

    try:
        df = _parse_bc_completion_csv(response.content)
    except Exception as exc:
        return [], f'BC parse failed: {exc}'

    oil = df[df['flow_fluid_type'].astype(str).str.upper() == 'OIL'].copy()
    oil['compltn_date'] = pd.to_datetime(
        oil['compltn_date'].astype(str).str.strip(),
        format='%Y%m%d',
        errors='coerce',
    )
    oil['Year'] = oil['compltn_date'].dt.year
    oil = oil[oil['Year'] >= MIN_YEAR]
    oil = oil.sort_values(
        ['uwi', 'compltn_date', 'compltn_base_depth_m'],
        ascending=[True, False, False],
    )
    oil = oil.drop_duplicates(subset=['uwi'], keep='first')

    grouped = oil.groupby('Year').agg(
        Count=('compltn_base_depth_m', 'size'),
        Metres=('compltn_base_depth_m', 'sum'),
    )
    rows = []
    for year, row in grouped.iterrows():
        if pd.isna(year):
            continue
        rows.append({
            'Province': 'BC',
            'Year': int(year),
            'Count': float(row['Count']),
            'Metres': float(row['Metres']),
        })
    rows.sort(key=lambda r: r['Year'])
    return rows, None


def _aggregate_western_canada(provincial_rows: List[Dict[str, float]]) -> Dict[int, Dict[str, float]]:
    by_year: Dict[int, Dict[str, float]] = {}
    for row in provincial_rows:
        year = int(row['Year'])
        bucket = by_year.setdefault(year, {'wells': 0.0, 'metres': 0.0})
        bucket['wells'] += float(row['Count'])
        bucket['metres'] += float(row['Metres'])
    return by_year


def build_western_canada_oil_wells_raw_rows(config=None) -> Tuple[List[Tuple[str, str, float]], Optional[str]]:
    notes: List[str] = []

    ab_rows, ab_note = _fetch_ab_provincial_rows(config)
    if ab_note:
        notes.append(ab_note)
    sk_rows = _fetch_sk_provincial_rows(config)
    mb_rows = _load_mb_provincial_rows(config)
    bc_rows, bc_note = _fetch_bc_provincial_rows(config)
    if bc_note:
        notes.append(bc_note)

    provincial = ab_rows + sk_rows + mb_rows + bc_rows
    rows: List[Tuple[str, str, float]] = []
    for prov_row in provincial:
        prov = prov_row['Province']
        prefix = PROVINCE_RAW_PREFIX[prov]
        year_key = str(int(prov_row['Year']))
        rows.append((f'{prefix}_wells', year_key, float(prov_row['Count'])))
        rows.append((f'{prefix}_metres', year_key, float(prov_row['Metres'])))

    aggregated = _aggregate_western_canada(provincial)
    for year in sorted(aggregated):
        if year < MIN_YEAR:
            continue
        wells = aggregated[year]['wells']
        metres = aggregated[year]['metres']
        rows.append(('raw_wc_oil_wells_completed', str(year), wells))
        rows.append(('raw_wc_oil_total_metres', str(year), metres))
        rows.append(('raw_wc_oil_avg_depth_m', str(year), metres / wells if wells else 0.0))

    source_note = '; '.join(notes) if notes else None
    return rows, source_note


def _transform_from_raw(df: pd.DataFrame) -> List[Tuple[str, str, float]]:
    by_year: Dict[str, Dict[str, float]] = {}
    for _, row in df.iterrows():
        vector = str(row['vector'])
        year_key = str(row['ref_date'])
        try:
            value = float(row['value'])
        except (TypeError, ValueError):
            continue
        if vector == 'raw_wc_oil_wells_completed':
            by_year.setdefault(year_key, {})['wells'] = value
        elif vector == 'raw_wc_oil_total_metres':
            by_year.setdefault(year_key, {})['metres'] = value

    data_rows: List[Tuple[str, str, float]] = []
    for year_key in sorted(by_year, key=lambda y: int(y)):
        if int(year_key) < MIN_YEAR:
            continue
        bucket = by_year[year_key]
        wells = bucket.get('wells')
        metres = bucket.get('metres')
        if wells is None or metres is None:
            continue
        data_rows.append(('wc_oil_wells_completed', year_key, wells))
        data_rows.append(('wc_oil_total_metres', year_key, metres))
        data_rows.append(('wc_oil_avg_depth_m', year_key, metres / wells if wells else 0.0))
    return data_rows


def update_western_canada_oil_wells(processor) -> int:
    print('  Fetching Western Canada oil wells (AB, SK, MB, BC)...')
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

    data_rows = _transform_from_raw(df)
    if not data_rows:
        print('    western_canada_oil_wells transform: no indicator rows produced')
        return 0

    n = processor.store_indicators(SOURCE_KEY, data_rows, WESTERN_CANADA_OIL_WELLS_METADATA)
    print(f'    Stored {n} indicator rows for western_canada_oil_wells')
    return n
