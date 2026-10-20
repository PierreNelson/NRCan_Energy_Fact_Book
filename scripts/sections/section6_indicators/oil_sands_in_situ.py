"""In situ oil sands method (page 115): AER ST53 project ranking and StatCan production share."""

import io
import re
from collections import defaultdict
from typing import Dict, List, Tuple

import pandas as pd

from utils.http_retry import fetch_get, resilience_from_config

from ..section1_indicators.ghg_emissions import GHG_REQUEST_HEADERS
from .constants import BROWSER_HEADERS
from .western_canada_oil_wells import _http_get

SOURCE_KEY = 'oil_sands_in_situ'
AER_ST53_URL = 'https://www.aer.ca/data-and-performance-reports/statistical-reports/st53'
BBL_PER_M3 = 6.289811
INSITU_VECTOR = 107757054
MINED_VECTOR = 107757056

SCHEME_DISPLAY = {
    'christina lake': 'Christina Lake',
    'foster creek': 'Foster Creek',
    'cold lake': 'Cold Lake',
}
OPERATOR_DISPLAY = (
    ('suncor energy', 'Suncor'),
    ('cenovus energy', 'Cenovus'),
    ('imperial oil', 'Imperial Oil'),
)

METADATA = [
    ('osi_reporting_year', 'In situ reporting year', 'year', 'units'),
    ('osi_project_count', 'In situ projects in the ST53 BITUMEN sheet', 'projects', 'units'),
    ('osi_current_production_pct', 'In situ share of current oil sands production', 'percent', 'percent'),
    ('osi_rank_1', 'Largest in situ project', 'thousand barrels per day', 'units'),
    ('osi_rank_2', 'Second-largest in situ project', 'thousand barrels per day', 'units'),
    ('osi_rank_3', 'Third-largest in situ project', 'thousand barrels per day', 'units'),
    ('osi_rank_4', 'Fourth-largest in situ project', 'thousand barrels per day', 'units'),
]


def _clean_name(value) -> str:
    text = str(value or '').replace('\xa0', ' ').replace('\ufffd', ' ')
    text = re.sub(r'\s*\([^)]*\)\s*$', '', text)
    text = re.sub(r'\s+', ' ', text).strip(' -')
    return text


def _operator_display(operator: str) -> str:
    key = operator.casefold()
    for prefix, label in OPERATOR_DISPLAY:
        if key.startswith(prefix):
            return label
    return operator


def _scheme_display(scheme: str) -> str:
    return SCHEME_DISPLAY.get(scheme.casefold(), scheme)


def _latest_st53(config) -> Tuple[int, bytes]:
    page = _http_get(AER_ST53_URL, config=config, label='AER ST53 index')
    links = []
    for href in re.findall(r'href="([^"]+)"', page.text):
        match = re.search(r'ST53[_-](\d{4})', href, re.I)
        if match:
            links.append((int(match.group(1)), href))
    if not links:
        raise RuntimeError('AER ST53 index has no yearly workbook')
    year, href = max(links)
    full = href if href.startswith('http') else f'https://www.aer.ca{href}'
    response = _http_get(full, config=config, label=f'AER ST53 {year}')
    print(f'  ST53 {year}: {full}')
    return year, response.content


def _bitumen_projects(content: bytes) -> Dict[Tuple[str, str], float]:
    """Monthly-average m3/d keyed by cleaned (scheme, operator)."""
    engine = 'xlrd'
    raw = pd.read_excel(io.BytesIO(content), sheet_name='BITUMEN', header=None, engine=engine)
    header_idx = None
    headers: List[str] = []
    for index, row in raw.iterrows():
        values = ['' if pd.isna(value) else str(value).strip() for value in row.tolist()]
        if 'Scheme Name' in values and 'Operator' in values and 'Monthly Average' in values:
            header_idx = index
            headers = values
            break
    if header_idx is None:
        raise RuntimeError('ST53 BITUMEN sheet has no Scheme Name / Monthly Average header')
    scheme_col = headers.index('Scheme Name')
    operator_col = headers.index('Operator')
    average_col = headers.index('Monthly Average')
    projects: Dict[Tuple[str, str], float] = defaultdict(float)
    for _, row in raw.iloc[header_idx + 1:].iterrows():
        scheme = _clean_name(row.iloc[scheme_col])
        operator = _clean_name(row.iloc[operator_col])
        if not scheme or not operator:
            continue
        if scheme.casefold() in ('scheme name', 'total', 'nan') or operator.casefold() in ('total', 'nan'):
            continue
        if 'total' in scheme.casefold() or 'total' in operator.casefold():
            continue
        try:
            average = float(row.iloc[average_col])
        except (TypeError, ValueError):
            continue
        if pd.isna(average):
            continue
        projects[(scheme, operator)] += average
    if not projects:
        raise RuntimeError('ST53 BITUMEN sheet has no project rows')
    return projects


def _fetch_wds_points(vector_id: int, max_retries: int, retry_delay: int) -> List[Tuple[str, float]]:
    url = (
        'https://www150.statcan.gc.ca/t1/wds/rest/getDataFromVectorByReferencePeriodRange'
        f'?vectorIds={vector_id}&startRefPeriod=2016-01-01&endReferencePeriod=2030-12-31'
    )
    response = fetch_get(
        url,
        timeout=120,
        headers=GHG_REQUEST_HEADERS,
        max_retries=max_retries,
        retry_delay_seconds=retry_delay,
        label=f'StatCan v{vector_id}',
    )
    item = response.json()[0]
    if item.get('status') != 'SUCCESS':
        raise RuntimeError(f'StatCan v{vector_id} request failed')
    points = []
    for point in (item.get('object') or {}).get('vectorDataPoint') or []:
        if point.get('value') is None:
            continue
        points.append((str(point['refPer']), float(point['value'])))
    return points


def update_oil_sands_in_situ(processor) -> int:
    max_retries, retry_delay = resilience_from_config(processor.config)
    year, content = _latest_st53(processor.config)
    projects = _bitumen_projects(content)
    data_rows: List[Tuple[str, str, float]] = []
    metadata = []
    for (scheme, operator), average in sorted(projects.items()):
        vector = f'st53|{operator}|{scheme}'
        data_rows.append((vector, str(year), average))
        metadata.append((
            vector,
            scheme,
            'cubic metres per day',
            'units',
            operator,
            AER_ST53_URL,
        ))
    for vector_id in (INSITU_VECTOR, MINED_VECTOR):
        for ref_date, value in _fetch_wds_points(vector_id, max_retries, retry_delay):
            data_rows.append((f'v{vector_id}', ref_date, value))
    metadata.extend([
        ('v107757054', 'In-situ crude bitumen production', 'cubic metres', 'units', 'Statistics Canada', ''),
        ('v107757056', 'Mined crude bitumen production', 'cubic metres', 'units', 'Statistics Canada', ''),
    ])
    print(f'    Prepared {len(projects)} ST53 projects for {year}')
    return processor.replace_raw_data(SOURCE_KEY, data_rows, metadata)


def _complete_annual_sums(raw_df: pd.DataFrame, vector: str) -> Dict[int, float]:
    grouped: Dict[int, List[float]] = defaultdict(list)
    for _, row in raw_df.iterrows():
        if str(row['vector']) != vector:
            continue
        try:
            year = int(str(row['ref_date'])[:4])
            grouped[year].append(float(row['value']))
        except (TypeError, ValueError):
            continue
    return {year: sum(values) for year, values in grouped.items() if len(values) >= 12}


def _rank_projects(raw_df: pd.DataFrame, year: int) -> Tuple[List[dict], int]:
    grouped: Dict[Tuple[str, str], float] = defaultdict(float)
    for _, row in raw_df.iterrows():
        vector = str(row['vector'])
        if not vector.startswith('st53|') or str(row['ref_date'])[:4] != str(year):
            continue
        _prefix, operator, scheme = vector.split('|', 2)
        if operator.casefold() in ('nan', 'total') or scheme.casefold() in ('nan', 'total'):
            continue
        if 'total' in operator.casefold() or 'total' in scheme.casefold():
            continue
        try:
            grouped[(scheme, operator)] += float(row['value'])
        except (TypeError, ValueError):
            continue

    suncor_pair = []
    projects = []
    for (scheme, operator), cubic_metres in grouped.items():
        thousand_bbl = cubic_metres * BBL_PER_M3 / 1000.0
        if (
            operator.casefold().startswith('suncor energy')
            and scheme.casefold() in ('firebag', 'mackay river')
        ):
            suncor_pair.append(thousand_bbl)
            continue
        projects.append({
            'label': f'{_scheme_display(scheme)} ({_operator_display(operator)})',
            'mbd': thousand_bbl,
        })
    if suncor_pair:
        projects.append({
            'label': 'Firebag and MacKay River (Suncor)',
            'mbd': sum(suncor_pair),
        })
    projects.sort(key=lambda item: item['mbd'], reverse=True)
    return projects, len(projects)


def build_oil_sands_in_situ_rows(raw_df: pd.DataFrame) -> List[Tuple[str, str, float, str]]:
    years = sorted({
        int(str(row['ref_date'])[:4])
        for _, row in raw_df.iterrows()
        if str(row['vector']).startswith('st53|')
    })
    if not years:
        return []
    year = years[-1]
    projects, project_count = _rank_projects(raw_df, year)
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

    rows: List[Tuple[str, str, float, str]] = [
        ('osi_reporting_year', str(year), float(year), 'In situ reporting year'),
        ('osi_project_count', str(year), float(project_count), 'In situ projects in the ST53 BITUMEN sheet'),
    ]
    if share_year is not None:
        share = insitu[share_year] / (insitu[share_year] + mined[share_year]) * 100.0
        rows.append((
            'osi_current_production_pct',
            str(share_year),
            share,
            'In situ share of current oil sands production',
        ))
        print(f'    In situ share {share_year}: {share:.2f}%')
    for index, project in enumerate(projects[:4], start=1):
        rows.append((f'osi_rank_{index}', str(year), project['mbd'], project['label']))
        print(f'    Rank {index}: {project["label"]} {project["mbd"]:.2f} Mb/d')
    print(f'    ST53 {year}: {project_count} projects')
    return rows


def transform_oil_sands_in_situ(processor) -> int:
    raw_df = processor.get_raw_dataframe(SOURCE_KEY)
    if raw_df is None or raw_df.empty:
        print('    oil_sands_in_situ transform: no raw rows found — re-run eedas update')
        return 0
    built = build_oil_sands_in_situ_rows(raw_df)
    if not built:
        print('    oil_sands_in_situ transform: no indicator rows produced')
        return 0
    data_rows = [(vector, ref_date, value) for vector, ref_date, value, _title in built]
    metadata = []
    for vector, _ref_date, _value, title in built:
        existing = next((item for item in METADATA if item[0] == vector), None)
        if existing:
            metadata.append((vector, title if vector.startswith('osi_rank_') else existing[1], existing[2], existing[3]))
        else:
            metadata.append((vector, title, 'units', 'units'))
    n = processor.store_indicators(SOURCE_KEY, data_rows, metadata)
    print(f'    Stored {n} indicator rows for oil_sands_in_situ')
    return n
