"""Mining oil sands method (page 114): AER ST39 project production and StatCan mined share."""

import calendar
import io
import re
from typing import Dict, List, Tuple

import pandas as pd

from utils.http_retry import resilience_from_config

from .oil_sands_in_situ import (
    INSITU_VECTOR,
    MINED_VECTOR,
    _complete_annual_sums,
    _fetch_wds_points,
)
from .western_canada_oil_wells import _http_get

SOURCE_KEY = 'oil_sands_mining'
AER_ST39_URL = 'https://www.aer.ca/providing-information/data-and-reports/statistical-reports/st39'
SHEET_NAME = 'VAR0800-ST39Extracts_xls'
BBL_PER_M3 = 6.2898

# Source labels are matched inside the ST39 project heading. Exclusions keep
# CNRL Horizon from picking up the separate Horizon offgas plant.
SOURCE_PROJECTS = (
    ('horizon', 'cnrl horizon', ('liquid extraction', 'offgas')),
    ('mildred', 'syncrude mildred lake', ()),
    ('aurora', 'syncrude aurora', ()),
    ('kearl', 'kearl mine project', ()),
    ('suncor', 'suncor energy osg', ()),
    ('fort_hills', 'fort hills mine', ()),
    ('muskeg', 'muskeg river mine', ()),
    ('jackpine', 'jackpine mine', ()),
)

# Fixed narrative order. Syncrude is the sum of Mildred Lake and Aurora.
DISPLAY_PROJECTS = (
    ('horizon', 'CNRL Horizon Mine', ('horizon',)),
    ('syncrude', 'Syncrude Mining Project', ('mildred', 'aurora')),
    ('kearl', "Imperial's Kearl", ('kearl',)),
    ('suncor', 'Suncor Base Mine', ('suncor',)),
    ('fort_hills', 'Fort Hills Mine', ('fort_hills',)),
    ('muskeg', "CNRL's Muskeg Mine", ('muskeg',)),
    ('jackpine', 'Jackpine Mine', ('jackpine',)),
)

METADATA = [
    ('osmm_reporting_year', 'Mining reporting year', 'year', 'units'),
    ('osmm_project_count', 'Displayed mining projects', 'projects', 'units'),
    ('osmm_total_mbd', 'Total mining production', 'thousand barrels per day', 'units'),
    ('osmm_current_production_pct', 'Mining share of current oil sands production', 'percent', 'percent'),
    ('osmm_horizon', 'CNRL Horizon Mine', 'thousand barrels per day', 'units'),
    ('osmm_syncrude', 'Syncrude Mining Project', 'thousand barrels per day', 'units'),
    ('osmm_kearl', "Imperial's Kearl", 'thousand barrels per day', 'units'),
    ('osmm_suncor', 'Suncor Base Mine', 'thousand barrels per day', 'units'),
    ('osmm_fort_hills', 'Fort Hills Mine', 'thousand barrels per day', 'units'),
    ('osmm_muskeg', "CNRL's Muskeg Mine", 'thousand barrels per day', 'units'),
    ('osmm_jackpine', 'Jackpine Mine', 'thousand barrels per day', 'units'),
]


def _cell(value) -> str:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return ''
    text = str(value).replace('\xa0', ' ').strip()
    if re.fullmatch(r'\d+\.0+', text):
        return text.split('.')[0]
    return text


def _latest_st39(config) -> Tuple[int, bytes]:
    page = _http_get(AER_ST39_URL, config=config, label='AER ST39 index')
    links = []
    for href in re.findall(r'href="([^"]+)"', page.text):
        if not href.lower().endswith('.xls'):
            continue
        match = re.search(r'ST39[_-](\d{4})', href, re.I)
        if match:
            links.append((int(match.group(1)), href))
    if not links:
        raise RuntimeError('AER ST39 index has no yearly workbook')
    year, href = max(links)
    full = href if href.startswith('http') else f'https://www.aer.ca{href}'
    response = _http_get(full, config=config, label=f'AER ST39 {year}')
    print(f'  ST39 {year}: {full}')
    return year, response.content


def _match_project(label: str):
    folded = label.casefold()
    for key, needle, excluded in SOURCE_PROJECTS:
        if needle in folded and not any(item in folded for item in excluded):
            return key
    return None


def _year_column(block: pd.DataFrame, year: int) -> int:
    target = str(year)
    for _, row in block.iterrows():
        for index, value in enumerate(row.tolist()):
            if _cell(value) == target:
                return index
    raise RuntimeError(f'ST39 block has no {year} column')


def _crude_bitumen_production(block: pd.DataFrame, year: int) -> float:
    column = _year_column(block, year)
    rows = list(block.iterrows())
    for offset, (_, row) in enumerate(rows):
        if not _cell(row.iloc[0]).casefold().startswith('crude bitumen'):
            continue
        for _, next_row in rows[offset + 1:]:
            label = _cell(next_row.iloc[0]).casefold()
            if label == 'production':
                return float(next_row.iloc[column])
            if '(' in label:
                break
        break
    raise RuntimeError('ST39 project has no Crude Bitumen production row')


def _project_production(raw: pd.DataFrame, year: int) -> Dict[str, float]:
    headers = []
    for index, row in raw.iterrows():
        label = _cell(row.iloc[0])
        if ' - ' not in label:
            continue
        if any(_cell(row.iloc[column]) for column in range(1, len(row))):
            continue
        headers.append((index, label))
    if not headers:
        raise RuntimeError('ST39 sheet has no project headings')
    headers.append((len(raw), ''))
    found: Dict[str, float] = {}
    for (start, label), (end, _next) in zip(headers, headers[1:]):
        key = _match_project(label)
        if key is None or key in found:
            continue
        found[key] = _crude_bitumen_production(raw.iloc[start:end], year)
        print(f'    {key}: {found[key]:.1f} m3 ({label})')
    missing = [key for key, _needle, _excluded in SOURCE_PROJECTS if key not in found]
    if missing:
        raise RuntimeError(f'ST39 {year} is missing projects: {", ".join(missing)}')
    return found


def update_oil_sands_mining(processor) -> int:
    max_retries, retry_delay = resilience_from_config(processor.config)
    year, content = _latest_st39(processor.config)
    raw = pd.read_excel(io.BytesIO(content), sheet_name=SHEET_NAME, header=None, engine='xlrd')
    projects = _project_production(raw, year)
    data_rows: List[Tuple[str, str, float]] = []
    metadata = []
    for key, _needle, _excluded in SOURCE_PROJECTS:
        vector = f'st39|{key}'
        data_rows.append((vector, str(year), projects[key]))
        metadata.append((
            vector,
            key,
            'cubic metres',
            'units',
            'Alberta Energy Regulator',
            AER_ST39_URL,
        ))
    for vector_id in (INSITU_VECTOR, MINED_VECTOR):
        for ref_date, value in _fetch_wds_points(vector_id, max_retries, retry_delay):
            data_rows.append((f'v{vector_id}', ref_date, value))
    metadata.extend([
        ('v107757054', 'In-situ crude bitumen production', 'cubic metres', 'units', 'Statistics Canada', ''),
        ('v107757056', 'Mined crude bitumen production', 'cubic metres', 'units', 'Statistics Canada', ''),
    ])
    print(f'    Prepared {len(projects)} ST39 projects for {year}')
    return processor.replace_raw_data(SOURCE_KEY, data_rows, metadata)


def _thousand_barrels_per_day(cubic_metres: float, year: int) -> float:
    days = 366 if calendar.isleap(year) else 365
    return cubic_metres * BBL_PER_M3 / days / 1000.0


def build_oil_sands_mining_rows(raw_df: pd.DataFrame) -> List[Tuple[str, str, float, str]]:
    volumes: Dict[str, Dict[int, float]] = {}
    for _, row in raw_df.iterrows():
        vector = str(row['vector'])
        if not vector.startswith('st39|'):
            continue
        key = vector.split('|', 1)[1]
        try:
            year = int(str(row['ref_date'])[:4])
            volumes.setdefault(key, {})[year] = float(row['value'])
        except (TypeError, ValueError):
            continue
    years = sorted({year for values in volumes.values() for year in values})
    if not years:
        return []
    year = years[-1]
    annual = {key: values.get(year) for key, values in volumes.items()}
    if any(value is None for value in annual.values()):
        return []

    rows: List[Tuple[str, str, float, str]] = []
    total = 0.0
    for key, title, parts in DISPLAY_PROJECTS:
        cubic_metres = sum(annual[part] for part in parts)
        mbd = _thousand_barrels_per_day(cubic_metres, year)
        total += mbd
        rows.append((f'osmm_{key}', str(year), mbd, title))
        print(f'    {title}: {mbd:.2f} Mb/d')

    rows.extend([
        ('osmm_reporting_year', str(year), float(year), 'Mining reporting year'),
        ('osmm_project_count', str(year), float(len(DISPLAY_PROJECTS)), 'Displayed mining projects'),
        ('osmm_total_mbd', str(year), total, 'Total mining production'),
    ])
    print(f'    Total {year}: {total:.2f} Mb/d across {len(DISPLAY_PROJECTS)} projects')

    insitu = _complete_annual_sums(raw_df, f'v{INSITU_VECTOR}')
    mined = _complete_annual_sums(raw_df, f'v{MINED_VECTOR}')
    share_years = sorted(set(insitu) & set(mined))
    share_year = None
    for candidate in reversed(share_years):
        if candidate <= year:
            share_year = candidate
            break
    if share_year is None and share_years:
        share_year = share_years[-1]
    if share_year is not None:
        share = mined[share_year] / (insitu[share_year] + mined[share_year]) * 100.0
        rows.append((
            'osmm_current_production_pct',
            str(share_year),
            share,
            'Mining share of current oil sands production',
        ))
        print(f'    Mining share {share_year}: {share:.2f}%')
    return rows


def transform_oil_sands_mining(processor) -> int:
    raw_df = processor.get_raw_dataframe(SOURCE_KEY)
    if raw_df is None or raw_df.empty:
        print('    oil_sands_mining transform: no raw rows found — re-run eedas update')
        return 0
    built = build_oil_sands_mining_rows(raw_df)
    if not built:
        print('    oil_sands_mining transform: no indicator rows produced')
        return 0
    data_rows = [(vector, ref_date, value) for vector, ref_date, value, _title in built]
    metadata = []
    for vector, _ref_date, _value, title in built:
        existing = next((item for item in METADATA if item[0] == vector), None)
        if existing:
            metadata.append((vector, title if vector.startswith('osmm_') and vector not in (
                'osmm_reporting_year', 'osmm_project_count', 'osmm_total_mbd', 'osmm_current_production_pct',
            ) else existing[1], existing[2], existing[3]))
        else:
            metadata.append((vector, title, 'units', 'units'))
    n = processor.store_indicators(SOURCE_KEY, data_rows, metadata)
    print(f'    Stored {n} indicator rows for oil_sands_mining')
    return n
