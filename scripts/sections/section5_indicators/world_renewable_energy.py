"""World renewable energy production ranking and renewable supply shares."""

from __future__ import annotations

import re
from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, List, Tuple

import pandas as pd

from utils.io_retry import ensure_workbook, read_excel_with_retry

SOURCE_KEY = 'world_renewable_energy'
IEA_XLSX = 'oecd_iea_data.xlsx'
PRODUCTION_SHEET = 'renewables_world_production'
SUPPLY_SHEET = 'total_energy_supply'
CONCORDANCE_ALIASES = ('metadata_iea_gac_geo_concordance', 'ref_iea_gac_geo_concordance')
RENEWABLE_PRODUCT = 'total of renewable energy sources'
TOTAL_PRODUCT = 'total'
TOP_N = 5
KTOE_TO_PJ = Decimal('0.04186728')
SOURCE_URL = 'https://www.iea.org/data-and-statistics'
SOURCE_ORG = 'International Energy Agency'
SKIP_CODES = {'WORLD', 'WLD', 'OECD', 'OECDTOT', 'IEATOT', 'TOTAL'}
# Spec geography labels, plus the IEA codes used in the COUNTRY column.
SHARE_GEO_ALIASES = {
    'world': 'world',
    'wld': 'world',
    'oecd': 'oecd',
    'oecd total': 'oecd',
    'oecd countries': 'oecd',
    'oecdtot': 'oecd',
    'canada': 'canada',
    'can': 'canada',
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


def _tenth(value: Decimal) -> Decimal:
    return value.quantize(Decimal('0.1'), rounding=ROUND_HALF_UP)


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


def _share_geo(*labels: str) -> str | None:
    for label in labels:
        key = label.casefold()
        if key in SHARE_GEO_ALIASES:
            return SHARE_GEO_ALIASES[key]
    return None


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


def _read_production(processor) -> Dict[int, Dict[str, dict]]:
    path = ensure_workbook(IEA_XLSX, config=processor.config)
    sheet = _sheet(path, (PRODUCTION_SHEET,), 'world renewable production')
    frame = read_excel_with_retry(path, sheet, config=processor.config, label=sheet)
    for column in ('TIME_PERIOD', 'OBS_VALUE', 'Product', 'COUNTRY'):
        if column not in frame.columns:
            raise ValueError(f'{sheet} is missing {column}')
    region_col = 'Country/Region' if 'Country/Region' in frame.columns else 'COUNTRY'
    products = frame['Product'].astype(str).str.strip().str.casefold()
    frame = frame[products.eq(RENEWABLE_PRODUCT)]
    if 'UNIT' in frame.columns:
        frame = frame[frame['UNIT'].astype(str).str.strip().str.upper().eq('KTOE')]
    if 'Flow' in frame.columns:
        flows = frame['Flow'].astype(str).str.strip().str.casefold()
        indigenous = frame[flows.str.contains('indigenous production', na=False)]
        if not indigenous.empty:
            frame = indigenous
    by_year: Dict[int, Dict[str, dict]] = {}
    for _, row in frame.iterrows():
        year_value = _decimal(row['TIME_PERIOD'])
        ktoe = _decimal(row['OBS_VALUE'])
        if year_value is None or ktoe is None:
            continue
        code = _text(row['COUNTRY']).upper()
        if not code:
            continue
        year = int(year_value)
        slot = by_year.setdefault(year, {})
        current = slot.get(code)
        if current is None:
            slot[code] = {
                'code': code,
                'ktoe': ktoe,
                'region': _text(row[region_col]),
            }
        else:
            current['ktoe'] += ktoe
    if not by_year:
        raise ValueError(f'{sheet} has no renewable production rows')
    return by_year


def _read_supply(processor) -> Dict[int, Dict[str, Decimal]]:
    path = ensure_workbook(IEA_XLSX, config=processor.config)
    sheet = _sheet(path, (SUPPLY_SHEET,), 'total energy supply')
    frame = read_excel_with_retry(path, sheet, config=processor.config, label=sheet)
    for column in ('TIME_PERIOD', 'OBS_VALUE', 'Product', 'Country/Region'):
        if column not in frame.columns:
            raise ValueError(f'{sheet} is missing {column}')
    products = frame['Product'].astype(str).str.strip().str.casefold()
    frame = frame[products.isin({TOTAL_PRODUCT, RENEWABLE_PRODUCT})]
    if 'Flow' in frame.columns:
        flows = frame['Flow'].astype(str).str.strip().str.casefold()
        supply = frame[flows.str.contains('total energy supply', na=False)]
        if not supply.empty:
            frame = supply
    code_column = 'COUNTRY' if 'COUNTRY' in frame.columns else None
    totals: Dict[Tuple[int, str], Dict[str, Decimal]] = {}
    for _, row in frame.iterrows():
        year_value = _decimal(row['TIME_PERIOD'])
        value = _decimal(row['OBS_VALUE'])
        if year_value is None or value is None:
            continue
        geo = _share_geo(
            _text(row['Country/Region']),
            _text(row[code_column]) if code_column else '',
        )
        if geo is None:
            continue
        product = _text(row['Product']).casefold()
        key = (int(year_value), geo)
        bucket = totals.setdefault(key, {})
        bucket[product] = bucket.get(product, Decimal(0)) + value

    by_year: Dict[int, Dict[str, Decimal]] = {}
    for (year, geo), bucket in totals.items():
        total = bucket.get(TOTAL_PRODUCT)
        renewable = bucket.get(RENEWABLE_PRODUCT)
        if total is None or renewable is None or total == 0:
            continue
        by_year.setdefault(year, {})[geo] = _tenth(renewable / total * Decimal(100))
    if not any('world' in rows and 'canada' in rows for rows in by_year.values()):
        raise ValueError(f'{sheet} has no World and Canada renewable supply shares')
    return by_year


def _ranking(by_year, concordance) -> tuple[int, Decimal, List[dict]]:
    latest = max(by_year)
    rows = by_year[latest]
    world = rows.get('WORLD') or rows.get('WLD')
    if world is None or world['ktoe'] == 0:
        raise ValueError(f'No WORLD renewable production for {latest}')
    countries = []
    for code, row in rows.items():
        if _is_aggregate(code, row['region']):
            continue
        record = concordance.get(code) or concordance.get(row['region'].upper())
        if record is None or not record[2]:
            continue
        english, french, _matched = record
        countries.append({
            'code': code,
            'ktoe': row['ktoe'],
            'en': english,
            'fr': french,
        })
    countries.sort(key=lambda row: (-row['ktoe'], row['en']))
    ranked = []
    for row in countries:
        higher = sum(1 for other in countries if other['ktoe'] > row['ktoe'])
        share = _whole(row['ktoe'] / world['ktoe'] * Decimal(100))
        ranked.append({**row, 'rank': higher + 1, 'share': share})
    shown = ranked[:TOP_N]
    if not any(row['code'] == 'CANADA' for row in shown):
        canada = next((row for row in ranked if row['code'] == 'CANADA'), None)
        if canada is None:
            raise ValueError(f'Canada is missing from the {latest} renewable production ranking')
        shown.append(canada)
    return latest, world['ktoe'], shown


def _rows(production, supply, concordance):
    latest, world_ktoe, shown = _ranking(production, concordance)
    raw_rows: List[DataRow] = []
    raw_meta: Dict[str, Metadata] = {}
    indicator_rows: List[DataRow] = []
    indicator_meta: Dict[str, Metadata] = {}

    def add_raw(vector: str, year: int, value: Decimal, title: str, uom: str):
        raw_rows.append((vector, str(year), float(value.quantize(Decimal('0.0001')))))
        raw_meta[vector] = (vector, title, uom, 'units', SOURCE_ORG, SOURCE_URL)

    def add(vector: str, year: int, value: Decimal, title: str, uom: str):
        indicator_rows.append((vector, str(year), float(value)))
        indicator_meta[vector] = (vector, title, uom, 'units', SOURCE_ORG, SOURCE_URL)

    for year, rows in production.items():
        for code, row in rows.items():
            safe = _vector_code(code)
            if safe:
                add_raw(f'wren_raw_prod_{safe}_ktoe', year, row['ktoe'], row['region'] or code, 'KTOE')

    add('wren_rank_total_pj', latest, _whole(world_ktoe * KTOE_TO_PJ), 'World renewable energy production', 'PJ')
    add('wren_rank_total_mtoe', latest, _whole(world_ktoe / Decimal(1000)), 'World renewable energy production', 'MTOE')
    add('wren_rank_count', latest, Decimal(len(shown)), 'Displayed renewable ranking rows', 'count')
    for index, row in enumerate(shown, start=1):
        add(f'wren_rank_r{index}_share', latest, row['share'], f'Rank {index} share', 'Percent')
        add(f'wren_rank_r{index}_rank', latest, Decimal(row['rank']), f'Rank {index}', 'rank')
        add(
            f'wren_rank_r{index}_canada',
            latest,
            Decimal(1 if row['code'] == 'CANADA' else 0),
            'Canada row' if row['code'] == 'CANADA' else 'Other country row',
            'flag',
        )
        add(f'wren_rank_r{index}_name_en', latest, Decimal(index), row['en'], 'name')
        add(f'wren_rank_r{index}_name_fr', latest, Decimal(index), row['fr'], 'name')
        add(f'wren_rank_r{index}_code', latest, Decimal(index), row['code'], 'code')

    share_titles = {
        'world': 'World',
        'oecd': 'OECD countries',
        'canada': 'Canada',
    }
    for year, rows in supply.items():
        for key, share in rows.items():
            add(f'wren_s_{key}', year, share, share_titles[key], 'Percent')
            add_raw(f'wren_raw_supply_{key}_pct', year, share, share_titles[key], 'Percent')
    return raw_rows, list(raw_meta.values()), indicator_rows, list(indicator_meta.values())


def update_world_renewable_energy(processor) -> int:
    concordance = _read_concordance(processor)
    production = _read_production(processor)
    supply = _read_supply(processor)
    data_rows, metadata_rows, _indicators, _indicator_meta = _rows(production, supply, concordance)
    n = processor.replace_raw_data(SOURCE_KEY, data_rows, metadata_rows)
    print(f'    Stored {n} source-native rows for {SOURCE_KEY}')
    return n


def transform_world_renewable_energy(processor) -> int:
    concordance = _read_concordance(processor)
    production = _read_production(processor)
    supply = _read_supply(processor)
    _raw_rows, _raw_meta, data_rows, metadata_rows = _rows(production, supply, concordance)
    latest = max(production)
    total_pj = next(row[2] for row in data_rows if row[0] == 'wren_rank_total_pj')
    total_mtoe = next(row[2] for row in data_rows if row[0] == 'wren_rank_total_mtoe')
    print(f'    World renewable energy {latest}: {int(total_pj)} PJ, {int(total_mtoe)} MTOE')
    n = processor.store_indicators(SOURCE_KEY, data_rows, metadata_rows)
    print(f'    Stored {n} indicator rows for {SOURCE_KEY}')
    return n
