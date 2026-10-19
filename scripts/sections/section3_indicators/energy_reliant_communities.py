"""Energy reliant communities — page 46."""

import re

import pandas as pd

from xlsx_paths import resolve_root_xlsx

SOURCE_KEY = 'energy_reliant_communities'
WORKBOOK = 'EnergyRelianceResults_Updated.xlsx'
PROVINCE_SHEET = 'energy_reliance_by_province'
RURAL_SHEET = 'energy_reliance_rural_urban'
SOURCE_ORG = 'Natural Resources Canada'
SOURCE_URL = 'https://natural-resources.canada.ca/energy-sources/energy-facts'

PROVINCE_CODES = {
    'newfoundland and labrador': 'nl',
    'new brunswick': 'nb',
    'quebec': 'qc',
    'ontario': 'on',
    'manitoba': 'mb',
    'saskatchewan': 'sk',
    'alberta': 'ab',
    'british columbia': 'bc',
    'nova scotia': 'ns',
    'prince edward island': 'pe',
    'yukon': 'yt',
    'northwest territories': 'nt',
    'nunavut': 'nu',
}


def _clean(value):
    text = re.sub(r'\s+', ' ', str(value or '')).strip()
    if not text or text.lower() == 'nan':
        return ''
    return text


def _number(value):
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    try:
        if pd.isna(value):
            return None
    except TypeError:
        pass
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _census_year(frame):
    for column in frame.columns:
        for value in frame[column].tolist():
            match = re.search(r'Based on the\s+(\d{4})\s+Census', _clean(value), flags=re.I)
            if match:
                return match.group(1)
    return '2021'


def read_reliance_sheets(province_frame, rural_frame):
    """
    Province totals and rural/urban totals from the prepared sheets.

    Returns (census_year, [(vector, value), ...]).
    """
    year = _census_year(province_frame) or _census_year(rural_frame)
    rows = []
    for _, row in province_frame.iterrows():
        name = _clean(row.get('province')).lower()
        code = PROVINCE_CODES.get(name)
        total = _number(row.get('total'))
        if not code or total is None:
            continue
        rows.append((f'province|{code}', total))
    rural_total = None
    rural_sum = 0.0
    rural_rows = 0
    for _, row in rural_frame.iterrows():
        kind = _clean(row.get('community_type')).lower()
        total = _number(row.get('total'))
        if not kind or total is None:
            continue
        rows.append((f'type|{kind}', total))
        rural_sum += total
        rural_rows += 1
        if kind == 'rural':
            rural_total = total
    if not any(vector.startswith('province|') for vector, _value in rows):
        raise ValueError(f'{PROVINCE_SHEET} has no province totals')
    if rural_total is None or rural_rows == 0:
        raise ValueError(f'{RURAL_SHEET} has no rural total')
    rows.append(('type|all', rural_sum))
    return year, rows


def build_energy_reliant_indicators(records):
    """Province community counts, the national total, and the rural share."""
    provinces = {}
    types = {}
    year = None
    for vector, ref_date, value in records:
        text = str(ref_date).strip()
        if len(text) >= 4 and text[:4].isdigit():
            year = text[:4]
        try:
            number = float(value)
        except (TypeError, ValueError):
            continue
        vector = str(vector)
        if vector.startswith('province|'):
            provinces[vector.split('|', 1)[1]] = number
        elif vector.startswith('type|'):
            types[vector.split('|', 1)[1]] = number
    if not provinces or year is None:
        return []
    if 'rural' not in types or 'all' not in types or types['all'] == 0:
        return []
    rows = [(f'erel_{code}', year, provinces[code]) for code in sorted(provinces)]
    rows.append(('erel_total', year, sum(provinces.values())))
    rows.append(('erel_rural_share', year, types['rural'] / types['all'] * 100.0))
    return rows


def update_energy_reliant_communities(processor) -> int:
    """EEDAS ingest: province and rural/urban sheets from the reliance workbook."""
    path = resolve_root_xlsx(WORKBOOK)
    province_frame = pd.read_excel(path, sheet_name=PROVINCE_SHEET)
    rural_frame = pd.read_excel(path, sheet_name=RURAL_SHEET)
    year, raw_rows = read_reliance_sheets(province_frame, rural_frame)
    data_rows = [(vector, year, value) for vector, value in raw_rows]
    metadata = [
        (vector, vector, 'communities', 'communities', SOURCE_ORG, SOURCE_URL)
        for vector, _year, _value in data_rows
    ]
    n = processor.replace_raw_data(SOURCE_KEY, data_rows, metadata)
    print(f'    Stored {n} raw energy reliant community rows ({year})')
    return n


def transform_energy_reliant_communities(processor) -> int:
    """EFB transform: province counts, national total, and rural or remote share."""
    raw_df = processor.repo.get_raw_dataframe(SOURCE_KEY)
    if raw_df is None or raw_df.empty:
        print('    energy_reliant_communities transform: no raw rows found')
        return 0
    records = [
        (row['vector'], row['ref_date'], row['value'])
        for _, row in raw_df.iterrows()
    ]
    data_rows = build_energy_reliant_indicators(records)
    if not data_rows:
        print('    energy_reliant_communities transform: no indicator rows produced')
        return 0
    metadata = []
    for vector, _year, _value in data_rows:
        unit = 'percent' if vector == 'erel_rural_share' else 'communities'
        metadata.append((vector, vector, unit, unit, SOURCE_ORG, SOURCE_URL))
    n = processor.store_indicators(SOURCE_KEY, data_rows, metadata)
    print(f'    Stored {n} energy reliant community indicator rows')
    return n


def process_energy_reliant_communities(processor) -> int:
    update_energy_reliant_communities(processor)
    return transform_energy_reliant_communities(processor)
