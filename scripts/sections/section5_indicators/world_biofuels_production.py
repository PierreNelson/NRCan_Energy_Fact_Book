"""World biofuels production ranking and regional trend."""

from __future__ import annotations

import re
from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, List, Tuple

import pandas as pd

from utils.io_retry import ensure_workbook, read_excel_with_retry

SOURCE_KEY = 'world_biofuels_production'
IEA_XLSX = 'oecd_iea_data.xlsx'
SHEET_ALIASES = ('biofuels_world_prod', 'biofuels_world_production')
CONCORDANCE_ALIASES = ('metadata_iea_gac_geo_concordance', 'ref_iea_gac_geo_concordance')
PRODUCTS = {'biogasoline', 'biodiesels', 'other liquid biofuels', 'bio jet kerosene'}
TREND_START = 2011
TOP_N = 5
SOURCE_URL = 'https://www.iea.org/data-and-statistics'
SOURCE_ORG = 'International Energy Agency'
SKIP_CODES = {'WORLD', 'WLD', 'OECD', 'IEATOT', 'TOTAL'}
TREND_KEYS = {
    'china': ('chinareg', 'china region (p.r. of china and hong kong, china)'),
    'european_union': ('eu27', 'european union (27)'),
    'united_states': ('usa', 'united states'),
    'brazil': ('brazil',),
    'canada': ('canada',),
    'world': ('world', 'wld'),
}

Metadata = Tuple[str, str, str, str, str, str]
DataRow = Tuple[str, str, float]


def _decimal(value) -> Decimal | None:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    text = str(value).strip().replace(',', '')
    if not text or text.lower() == 'nan':
        return None
    return Decimal(text)


def _whole(value: Decimal) -> Decimal:
    return value.quantize(Decimal('1'), rounding=ROUND_HALF_UP)


def _text(value) -> str:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return ''
    return str(value).strip()


def _sheet(path, aliases: Tuple[str, ...], label: str) -> str:
    names = {name.strip().lower(): name for name in pd.ExcelFile(path).sheet_names}
    for alias in aliases:
        hit = names.get(alias.strip().lower())
        if hit:
            return hit
    raise ValueError(f'{label}: none of {aliases} found')


def _vector_code(code: str) -> str:
    return re.sub(r'[^a-z0-9_]+', '_', code.lower()).strip('_')


def _is_aggregate(code: str, region: str) -> bool:
    label = region.casefold()
    return (
        code in SKIP_CODES
        or code.startswith('OTH')
        or 'region' in label
        or 'european union' in label
        or 'oecd' in label
        or label in {'world', 'monde', 'total'}
    )


def _read_concordance(processor) -> Dict[str, Tuple[str, str, bool]]:
    path = ensure_workbook(IEA_XLSX, config=processor.config)
    sheet = _sheet(path, CONCORDANCE_ALIASES, 'IEA geography concordance')
    frame = read_excel_with_retry(path, sheet, config=processor.config, label='IEA geography concordance')
    required = {'iea_code_value', 'gc_nm_ab_en', 'gc_nm_ab_fr'}
    missing = required.difference(frame.columns)
    if missing:
        raise ValueError(f'{sheet} is missing columns: {", ".join(sorted(missing))}')
    lookup: Dict[str, Tuple[str, str, bool]] = {}
    for _, row in frame.iterrows():
        english = _text(row['gc_nm_ab_en'])
        french = _text(row['gc_nm_ab_fr'])
        iso = _text(row['gac_iso_alpha_3_cd']) if 'gac_iso_alpha_3_cd' in frame.columns else ''
        status = _text(row['match_status']).upper() if 'match_status' in frame.columns else 'MATCHED'
        record = (english, french, bool(english and french and iso and status == 'MATCHED'))
        for column in ('iea_code_value', 'iea_name_value', 'iea_name_value_clean'):
            if column not in frame.columns:
                continue
            key = _text(row[column]).upper()
            if key:
                lookup[key] = record
    if not lookup:
        raise ValueError(f'{sheet} has no geography rows')
    return lookup


def _read_totals(processor) -> Dict[int, Dict[str, dict]]:
    path = ensure_workbook(IEA_XLSX, config=processor.config)
    sheet = _sheet(path, SHEET_ALIASES, 'world biofuels production')
    frame = read_excel_with_retry(path, sheet, config=processor.config, label=sheet)
    for column in ('TIME_PERIOD', 'OBS_VALUE', 'Product'):
        if column not in frame.columns:
            raise ValueError(f'{sheet} is missing {column}')
    geo_col = 'COUNTRY' if 'COUNTRY' in frame.columns else None
    if geo_col is None:
        raise ValueError(f'{sheet} has no geography column')
    region_col = 'Country/Region' if 'Country/Region' in frame.columns else geo_col
    products = frame['Product'].astype(str).str.strip().str.casefold()
    frame = frame[products.isin(PRODUCTS)]
    if 'UNIT' in frame.columns:
        frame = frame[frame['UNIT'].astype(str).str.strip().str.upper().eq('TJ')]

    by_year: Dict[int, Dict[str, dict]] = {}
    for _, row in frame.iterrows():
        year_value = _decimal(row['TIME_PERIOD'])
        tj = _decimal(row['OBS_VALUE'])
        code = _text(row[geo_col]).upper()
        if year_value is None or tj is None or not code:
            continue
        year = int(year_value)
        slot = by_year.setdefault(year, {})
        current = slot.get(code)
        region = _text(row[region_col])
        if current is None:
            slot[code] = {'code': code, 'tj': tj, 'region': region}
        else:
            current['tj'] += tj
    if not by_year:
        raise ValueError(f'{sheet} has no liquid biofuels rows')
    return by_year


def _ranking(by_year, concordance) -> Tuple[int, Decimal, List[dict]]:
    latest = max(by_year)
    rows = by_year[latest]
    if 'WORLD' not in rows or rows['WORLD']['tj'] <= 0:
        raise ValueError(f'World biofuels total is missing for {latest}')
    world_tj = rows['WORLD']['tj']
    countries = []
    unmatched = []
    for code, row in rows.items():
        if code in {'WORLD', 'WLD'} or _is_aggregate(code, row['region']):
            continue
        record = concordance.get(code)
        if record is None or not record[2]:
            unmatched.append(code)
            continue
        countries.append({**row, 'en': record[0], 'fr': record[1]})
    if unmatched:
        raise ValueError(f'Biofuels ranking has countries without an active GAC match: {", ".join(sorted(unmatched))}')
    ordered = sorted(countries, key=lambda row: (-row['tj'], row['en']))
    ranked = []
    for row in ordered:
        ahead = sum(1 for other in ordered if other['tj'] > row['tj'])
        ranked.append({
            **row,
            'rank': ahead + 1,
            'share': _whole(row['tj'] / world_tj * Decimal(100)),
        })
    shown = ranked[:TOP_N]
    if not any(row['code'] == 'CANADA' for row in shown):
        canada = next((row for row in ranked if row['code'] == 'CANADA'), None)
        if canada is None:
            raise ValueError('Canada is missing from the biofuels ranking')
        shown.append(canada)
    return latest, world_tj, shown


def _trend_code(rows: Dict[str, dict], aliases: Tuple[str, ...]) -> str:
    by_code = {code: code for code in rows}
    by_region = {row['region'].casefold(): code for code, row in rows.items() if row['region']}
    for alias in aliases:
        if alias.upper() in by_code:
            return alias.upper()
        if alias.casefold() in by_region:
            return by_region[alias.casefold()]
    raise ValueError(f'Biofuels trend geography not found: {aliases[0]}')


def _trend(by_year) -> List[dict]:
    years = sorted(year for year in by_year if year >= TREND_START)
    if not years:
        raise ValueError(f'No biofuels trend years from {TREND_START}')
    series = []
    for year in years:
        rows = by_year[year]
        codes = {key: _trend_code(rows, aliases) for key, aliases in TREND_KEYS.items()}
        values = {key: _whole(rows[code]['tj'] / Decimal(1000)) for key, code in codes.items()}
        rest = values['world'] - (
            values['china'] + values['european_union'] + values['united_states'] + values['brazil'] + values['canada']
        )
        series.append({
            'year': year,
            'canada': values['canada'],
            'brazil': values['brazil'],
            'united_states': values['united_states'],
            'european_union': values['european_union'],
            'china': values['china'],
            'rest_of_world': rest,
        })
    return series


def _rows(by_year, concordance) -> tuple[List[DataRow], List[Metadata], List[DataRow], List[Metadata]]:
    latest, world_tj, shown = _ranking(by_year, concordance)
    trend = _trend(by_year)
    raw_rows: List[DataRow] = []
    raw_meta: Dict[str, Metadata] = {}
    indicator_rows: List[DataRow] = []
    indicator_meta: Dict[str, Metadata] = {}

    def add_raw(vector: str, year: int, value: Decimal, title: str):
        raw_rows.append((vector, str(year), float(value.quantize(Decimal('0.0001')))))
        raw_meta[vector] = (vector, title, 'TJ', 'units', SOURCE_ORG, SOURCE_URL)

    def add(vector: str, year: int, value: Decimal, title: str, uom: str):
        indicator_rows.append((vector, str(year), float(value)))
        indicator_meta[vector] = (vector, title, uom, 'units', SOURCE_ORG, SOURCE_URL)

    for year, rows in by_year.items():
        for code, row in rows.items():
            safe = _vector_code(code)
            if safe:
                add_raw(f'wbfl_raw_{safe}_tj', year, row['tj'], row['region'] or code)

    add('wbfl_rank_total_pj', latest, _whole(world_tj / Decimal(1000)), 'World liquid biofuels production', 'PJ')
    add('wbfl_rank_count', latest, Decimal(len(shown)), 'Displayed biofuels ranking rows', 'count')
    for index, row in enumerate(shown, start=1):
        add(f'wbfl_rank_r{index}_share', latest, row['share'], f'Rank {index} share', 'Percent')
        add(f'wbfl_rank_r{index}_rank', latest, Decimal(row['rank']), f'Rank {index}', 'rank')
        add(
            f'wbfl_rank_r{index}_canada',
            latest,
            Decimal(1 if row['code'] == 'CANADA' else 0),
            'Canada row' if row['code'] == 'CANADA' else 'Other country row',
            'flag',
        )
        add(f'wbfl_rank_r{index}_name_en', latest, Decimal(index), row['en'], 'name')
        add(f'wbfl_rank_r{index}_name_fr', latest, Decimal(index), row['fr'], 'name')
        add(f'wbfl_rank_r{index}_code', latest, Decimal(index), row['code'], 'code')

    labels = {
        'canada': 'Canada',
        'brazil': 'Brazil',
        'united_states': 'United States',
        'european_union': 'European Union',
        'china': 'China',
        'rest_of_world': 'Rest of the world',
    }
    for row in trend:
        for key, label in labels.items():
            add(f'wbfl_t_{key}', row['year'], row[key], label, 'PJ')
    return raw_rows, list(raw_meta.values()), indicator_rows, list(indicator_meta.values())


def update_world_biofuels_production(processor) -> int:
    concordance = _read_concordance(processor)
    totals = _read_totals(processor)
    data_rows, metadata_rows, _indicators, _indicator_meta = _rows(totals, concordance)
    n = processor.replace_raw_data(SOURCE_KEY, data_rows, metadata_rows)
    print(f'    Stored {n} source-native rows for {SOURCE_KEY}')
    return n


def transform_world_biofuels_production(processor) -> int:
    concordance = _read_concordance(processor)
    totals = _read_totals(processor)
    _raw_rows, _raw_meta, data_rows, metadata_rows = _rows(totals, concordance)
    latest = max(totals)
    total = next(row[2] for row in data_rows if row[0] == 'wbfl_rank_total_pj')
    print(f'    World biofuels {latest}: {int(total)} PJ')
    n = processor.store_indicators(SOURCE_KEY, data_rows, metadata_rows)
    print(f'    Stored {n} indicator rows for {SOURCE_KEY}')
    return n
