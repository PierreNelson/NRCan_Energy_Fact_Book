"""Natural gas liquids energy use by sector and province (page 134)."""

from __future__ import annotations

from decimal import Decimal
from typing import Dict, List, Tuple

import pandas as pd

from utils.io_retry import ensure_workbook, read_excel_with_retry, resolve_sheet_name
from xlsx_paths import resolve_root_xlsx

SOURCE_KEY = 'natural_gas_liquids_energy_use'
PROVINCE_SOURCE_KEY = 'natural_gas_liquids_energy_use_province'
SPEC_WORKBOOK = 'oee_neud_energy_efficiency_customfile.xlsx'
SPEC_SHEET = 'NGL energy use'
FALLBACK_WORKBOOK = 'Energy Efficiency.xlsx'
FALLBACK_SHEET = 'NGL energy use'
SOURCE_URL = 'https://oee.nrcan.gc.ca/corporate/statistics/neud/dpa/data_e.html'
SOURCE_ORG = 'Natural Resources Canada (OEE)'

SECTORS = (
    ('residential', 'residential'),
    ('commercial', 'commercial'),
    ('industry', 'industry'),
    ('transportation', 'transportation'),
    ('agriculture', 'agriculture'),
)
SECTOR_ALIASES = {
    'residential': 'residential',
    'commercial': 'commercial',
    'commerical': 'commercial',
    'industry': 'industry',
    'transportation': 'transportation',
    'agriculture': 'agriculture',
}
PROVINCES = (
    ('atl', 'atl'),
    ('alta', 'alta'),
    ('bc_ter', 'bc_ter'),
    ('man', 'man'),
    ('ont', 'ont'),
    ('que', 'que'),
    ('sask', 'sask'),
)
PROVINCE_ALIASES = {
    'atl': 'atl',
    'alta': 'alta',
    'alta.': 'alta',
    'b.c. and terr': 'bc_ter',
    'bc and terr': 'bc_ter',
    'man': 'man',
    'man.': 'man',
    'ont': 'ont',
    'ont.': 'ont',
    'que': 'que',
    'que.': 'que',
    'sask': 'sask',
    'sask.': 'sask',
}
TITLES = {
    'residential': 'Residential',
    'commercial': 'Commercial',
    'industry': 'Industrial',
    'transportation': 'Transportation',
    'agriculture': 'Agriculture',
    'atl': 'Atlantic provinces',
    'alta': 'Alberta',
    'bc_ter': 'British Columbia and the territories',
    'man': 'Manitoba',
    'ont': 'Ontario',
    'que': 'Quebec',
    'sask': 'Saskatchewan',
}

Metadata = Tuple[str, str, str, str, str, str]
DataRow = Tuple[str, str, float]


def _decimal(value) -> Decimal | None:
    number = pd.to_numeric(value, errors='coerce')
    if pd.isna(number):
        return None
    return Decimal(str(number))


def _fold(value) -> str:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return ''
    return str(value).strip().casefold()


def _workbook(processor):
    spec_path = resolve_root_xlsx(SPEC_WORKBOOK)
    if spec_path.is_file() and spec_path.stat().st_size > 0:
        sheet = resolve_sheet_name(spec_path, SPEC_SHEET, label=SOURCE_KEY)
        return spec_path, sheet
    path = ensure_workbook(FALLBACK_WORKBOOK, config=processor.config)
    sheet = resolve_sheet_name(path, FALLBACK_SHEET, label=SOURCE_KEY)
    print(f'    {SPEC_WORKBOOK} is not in Manual Data; using {FALLBACK_WORKBOOK} sheet {sheet!r}')
    return path, sheet


def _as_percent(shares: Dict[str, Decimal]) -> Dict[str, Decimal]:
    total = sum(shares.values(), Decimal(0))
    if Decimal('0.5') <= total <= Decimal('1.5'):
        return {key: value * Decimal(100) for key, value in shares.items()}
    return shares


def _read_sheet(processor) -> Dict[int, Dict[str, Dict[str, Decimal]]]:
    path, sheet = _workbook(processor)
    frame = read_excel_with_retry(path, sheet, config=processor.config, label='natural gas liquids energy use')
    frame.columns = [str(column).strip() for column in frame.columns]
    required = ('year', 'user', 'type', 'value (petajoule)', 'share (%)')
    missing = [name for name in required if name not in frame.columns]
    if missing:
        raise ValueError(f'{sheet} is missing columns: {", ".join(missing)}')

    by_year: Dict[int, Dict[str, Dict[str, Decimal]]] = {}
    for _, row in frame.iterrows():
        year_number = pd.to_numeric(row['year'], errors='coerce')
        if pd.isna(year_number):
            continue
        year = int(year_number)
        kind = _fold(row['type'])
        user = _fold(row['user'])
        key = SECTOR_ALIASES.get(user) if kind == 'sector' else PROVINCE_ALIASES.get(user) if kind == 'province' else None
        if not key:
            continue
        pj = _decimal(row['value (petajoule)'])
        share = _decimal(row['share (%)'])
        if pj is None or share is None:
            continue
        bucket = by_year.setdefault(year, {'sector': {}, 'province': {}})
        bucket[kind][key] = {'pj': pj, 'share': share}
    if not by_year:
        raise ValueError(f'{sheet} has no natural gas liquids energy use rows')
    return by_year


def _ready_group(by_year, group: str, keys: List[str]) -> Dict[int, dict]:
    ready = {}
    for year, groups in sorted(by_year.items()):
        rows = groups.get(group) or {}
        if any(key not in rows for key in keys):
            continue
        shares = _as_percent({key: rows[key]['share'] for key in keys})
        ready[year] = {
            key: {'pj': rows[key]['pj'], 'share': shares[key]}
            for key in keys
        }
    return ready


def _stored(value: Decimal) -> float:
    return float(value.quantize(Decimal('0.0001')))


def _raw_rows(years: Dict[int, dict], members: tuple) -> tuple[List[DataRow], List[Metadata]]:
    data_rows: List[DataRow] = []
    metadata: List[Metadata] = []

    def add(vector: str, year: int, value: Decimal, title: str, uom: str):
        data_rows.append((vector, str(year), _stored(value)))
        metadata.append((vector, title, uom, 'units', SOURCE_ORG, SOURCE_URL))

    for year, rows in years.items():
        for key, _label in members:
            row = rows[key]
            add(f'ngleu_raw_{key}_pj', year, row['pj'], f'Natural gas liquids energy use, {key}', 'PJ')
            add(f'ngleu_raw_{key}_share', year, row['share'], f'Natural gas liquids energy use share, {key}', 'Percent')
    return data_rows, metadata


def _add_indicator(bucket, vector: str, year: int, value: Decimal, title: str, uom: str):
    data_rows, metadata = bucket
    data_rows.append((vector, str(year), _stored(value)))
    metadata[vector] = (vector, title, uom, 'units', SOURCE_ORG, SOURCE_URL)


def _sector_indicator_rows(years: Dict[int, dict]) -> tuple[List[DataRow], List[Metadata]]:
    bucket = ([], {})
    for year, rows in years.items():
        total_pj = sum((rows[key]['pj'] for key, _label in SECTORS), Decimal(0))
        for key, _label in SECTORS:
            row = rows[key]
            _add_indicator(bucket, f'ngleu_{key}_pj', year, row['pj'], f'{TITLES[key]} natural gas liquids energy use', 'PJ')
            _add_indicator(bucket, f'ngleu_{key}_share', year, row['share'], f'{TITLES[key]} share of natural gas liquids energy use', 'Percent')
        _add_indicator(bucket, 'ngleu_total_pj', year, total_pj, 'Total natural gas liquids energy use', 'PJ')
        print(f'    {year}: sector total {float(total_pj):.1f} PJ')
    data_rows, metadata = bucket
    return data_rows, list(metadata.values())


def _province_indicator_rows(years: Dict[int, dict]) -> tuple[List[DataRow], List[Metadata]]:
    bucket = ([], {})
    for year, rows in years.items():
        total_pj = sum((rows[key]['pj'] for key, _label in PROVINCES), Decimal(0))
        for key, _label in PROVINCES:
            row = rows[key]
            _add_indicator(bucket, f'ngleu_{key}_pj', year, row['pj'], f'{TITLES[key]} natural gas liquids energy use', 'PJ')
            _add_indicator(bucket, f'ngleu_{key}_share', year, row['share'], f'{TITLES[key]} share of natural gas liquids energy use', 'Percent')
        _add_indicator(bucket, 'ngleu_province_total_pj', year, total_pj, 'Total natural gas liquids energy use by province', 'PJ')
        print(f'    {year}: province total {float(total_pj):.1f} PJ')
    data_rows, metadata = bucket
    return data_rows, list(metadata.values())


def _years_from_raw(frame: pd.DataFrame, group: str, keys: List[str]) -> Dict[int, dict]:
    by_year: Dict[int, Dict[str, Dict[str, Decimal]]] = {}
    allowed = set(keys)
    for _, row in frame.iterrows():
        vector = str(row.get('vector') or '')
        if not vector.startswith('ngleu_raw_') or not vector.endswith(('_pj', '_share')):
            continue
        body = vector[len('ngleu_raw_'):]
        key, kind = body.rsplit('_', 1)
        if key not in allowed:
            continue
        year = int(str(row['ref_date'])[:4])
        by_year.setdefault(year, {group: {}})
        by_year[year][group].setdefault(key, {'pj': Decimal(0), 'share': Decimal(0)})
        by_year[year][group][key]['pj' if kind == 'pj' else 'share'] = Decimal(str(row['value']))
    return _ready_group(by_year, group, keys)


def update_natural_gas_liquids_energy_use(processor) -> int:
    years = _ready_group(_read_sheet(processor), 'sector', [key for key, _label in SECTORS])
    if not years:
        raise ValueError('natural gas liquids energy use has no year with every sector')
    data_rows, metadata_rows = _raw_rows(years, SECTORS)
    n = processor.replace_raw_data(SOURCE_KEY, data_rows, metadata_rows)
    print(f'    Stored {n} source-native rows for {SOURCE_KEY}')
    return n


def update_natural_gas_liquids_energy_use_province(processor) -> int:
    years = _ready_group(_read_sheet(processor), 'province', [key for key, _label in PROVINCES])
    if not years:
        raise ValueError('natural gas liquids energy use has no year with every province')
    data_rows, metadata_rows = _raw_rows(years, PROVINCES)
    n = processor.replace_raw_data(PROVINCE_SOURCE_KEY, data_rows, metadata_rows)
    print(f'    Stored {n} source-native rows for {PROVINCE_SOURCE_KEY}')
    return n


def transform_natural_gas_liquids_energy_use(processor) -> int:
    frame = processor.get_raw_dataframe(SOURCE_KEY)
    if frame.empty:
        raise RuntimeError('natural_gas_liquids_energy_use transform: no raw rows found — re-run eedas update')
    years = _years_from_raw(frame, 'sector', [key for key, _label in SECTORS])
    if not years:
        raise ValueError('natural gas liquids energy use has no year with every sector')
    data_rows, metadata_rows = _sector_indicator_rows(years)
    n = processor.store_indicators(SOURCE_KEY, data_rows, metadata_rows)
    print(f'    Stored {n} indicator rows for {SOURCE_KEY}')
    return n


def transform_natural_gas_liquids_energy_use_province(processor) -> int:
    frame = processor.get_raw_dataframe(PROVINCE_SOURCE_KEY)
    if frame.empty:
        raise RuntimeError('natural_gas_liquids_energy_use_province transform: no raw rows found — re-run eedas update')
    years = _years_from_raw(frame, 'province', [key for key, _label in PROVINCES])
    if not years:
        raise ValueError('natural gas liquids energy use has no year with every province')
    data_rows, metadata_rows = _province_indicator_rows(years)
    n = processor.store_indicators(PROVINCE_SOURCE_KEY, data_rows, metadata_rows)
    print(f'    Stored {n} indicator rows for {PROVINCE_SOURCE_KEY}')
    return n
