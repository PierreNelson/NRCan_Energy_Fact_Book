"""World electricity production and export rankings."""

from __future__ import annotations

import re
from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, List, Tuple

import pandas as pd

from utils.io_retry import ensure_workbook, read_excel_with_retry

SOURCE_KEY = 'electricity_world_production'
IEA_XLSX = 'oecd_iea_data.xlsx'
CONCORDANCE_ALIASES = ('metadata_iea_gac_geo_concordance', 'ref_iea_gac_geo_concordance')
PRODUCTION_SHEET = 'electricity_world_production'
EXPORTS_SHEET = 'electricity_world_exports'
SOURCE_URL = 'https://www.iea.org/data-and-statistics'
SOURCE_ORG = 'International Energy Agency'
TOP_N = 5
SKIP_CODES = {'WORLD', 'WLD', 'OECD', 'IEATOT', 'TOTAL'}
AGGREGATE_NAMES = {'world', 'monde', 'oecd', 'oecd total', 'total'}

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


def _display_names(english: str, french: str) -> Tuple[str, str]:
    if english.casefold() == 'lao':
        english = 'Laos'
    if french.casefold() == 'lao':
        french = 'Laos'
    return english, french


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
        english, french = _display_names(_text(row['gc_nm_ab_en']), _text(row['gc_nm_ab_fr']))
        iso = _text(row['gac_iso_alpha_3_cd']) if 'gac_iso_alpha_3_cd' in frame.columns else ''
        status = _text(row['match_status']).upper() if 'match_status' in frame.columns else 'MATCHED'
        country = bool(english) and bool(french) and status == 'MATCHED' and bool(iso)
        record = (english, french, country)
        for column in ('iea_code_value', 'iea_name_value', 'iea_name_value_clean'):
            if column not in frame.columns:
                continue
            key = _text(row[column]).upper()
            if key:
                lookup[key] = record
    if not lookup:
        raise ValueError(f'{sheet} has no geography rows')
    return lookup


def _geography_column(frame: pd.DataFrame) -> str:
    for name in ('COUNTRY', 'Country/Region', 'COUNTRY/REGION'):
        if name in frame.columns:
            return name
    for column in frame.columns:
        label = str(column).strip().lower()
        if label in {'country', 'country/region', 'geography'} or label == 'country':
            return column
    raise ValueError('electricity ranking sheet has no geography column')


def _read_ranking(processor, sheet_name: str, concordance, flow_tokens: Tuple[str, ...]) -> Dict[int, Dict[str, dict]]:
    path = ensure_workbook(IEA_XLSX, config=processor.config)
    sheet = _sheet(path, (sheet_name,), sheet_name)
    frame = read_excel_with_retry(path, sheet, config=processor.config, label=sheet)
    for column in ('TIME_PERIOD', 'OBS_VALUE'):
        if column not in frame.columns:
            raise ValueError(f'{sheet} is missing {column}')
    geo_col = _geography_column(frame)
    if 'UNIT' in frame.columns:
        units = frame['UNIT'].astype(str).str.strip().str.upper()
        frame = frame[units.eq('GWH')]
    if 'Product' in frame.columns:
        products = frame['Product'].astype(str).str.strip().str.casefold()
        electricity = frame[products.eq('electricity')]
        if not electricity.empty:
            frame = electricity
    if 'Flow' in frame.columns:
        flows = frame['Flow'].astype(str).str.strip().str.casefold()
        matched = frame[flows.apply(lambda value: any(token in value for token in flow_tokens))]
        if not matched.empty:
            frame = matched

    by_year: Dict[int, Dict[str, dict]] = {}
    unmatched = set()
    for _, row in frame.iterrows():
        year_value = _decimal(row['TIME_PERIOD'])
        gwh = _decimal(row['OBS_VALUE'])
        code = _text(row[geo_col]).upper()
        if year_value is None or gwh is None or not code:
            continue
        year = int(year_value)
        if code in {'WORLD', 'WLD'}:
            slot = by_year.setdefault(year, {})
            current = slot.get('__world__')
            if current is None:
                slot['__world__'] = {'gwh': gwh}
            else:
                current['gwh'] += gwh
            continue
        if code in SKIP_CODES:
            continue
        record = concordance.get(code)
        if record is None or not record[2] or record[0].casefold() in AGGREGATE_NAMES:
            if not code.startswith('OTH'):
                unmatched.add(code)
            continue
        english, french, _country = record
        slot = by_year.setdefault(year, {})
        current = slot.get(code)
        if current is None:
            slot[code] = {'code': code, 'gwh': gwh, 'en': english, 'fr': french}
        else:
            current['gwh'] += gwh
    if unmatched:
        raise ValueError(f'{sheet} has countries without an active GAC match: {", ".join(sorted(unmatched))}')
    return {year: rows for year, rows in by_year.items() if '__world__' in rows and rows['__world__']['gwh'] > 0}


def _ranking(countries: Dict[str, dict], world_gwh: Decimal, include_canada: bool) -> List[dict]:
    ordered = sorted(countries.values(), key=lambda row: (-row['gwh'], row['en']))
    ranked = []
    for row in ordered:
        ahead = sum(1 for other in ordered if other['gwh'] > row['gwh'])
        ranked.append({
            **row,
            'rank': ahead + 1,
            'share': _whole(row['gwh'] / world_gwh * Decimal(100)),
        })
    shown = ranked[:TOP_N]
    if include_canada and not any(row['code'] == 'CANADA' for row in shown):
        canada = next((row for row in ranked if row['code'] == 'CANADA'), None)
        if canada is None:
            raise ValueError('Canada is missing from world electricity production')
        shown.append(canada)
    return shown


def _rows(production, exports) -> tuple[List[DataRow], List[Metadata], List[DataRow], List[Metadata]]:
    years = sorted(set(production).intersection(exports))
    if not years:
        raise ValueError('No reporting year is present in both electricity ranking sheets')

    raw_rows: List[DataRow] = []
    raw_meta: Dict[str, Metadata] = {}
    indicator_rows: List[DataRow] = []
    indicator_meta: Dict[str, Metadata] = {}

    def add_raw(vector: str, year: int, value: Decimal, title: str):
        raw_rows.append((vector, str(year), float(value.quantize(Decimal('0.0001')))))
        raw_meta[vector] = (vector, title, 'GWh', 'units', SOURCE_ORG, SOURCE_URL)

    def add(vector: str, year: int, value: Decimal, title: str, uom: str):
        indicator_rows.append((vector, str(year), float(value)))
        indicator_meta[vector] = (vector, title, uom, 'units', SOURCE_ORG, SOURCE_URL)

    def store_series(prefix: str, by_year: Dict[int, Dict[str, dict]], include_canada: bool, label: str):
        for year in years:
            rows = by_year[year]
            world_gwh = rows['__world__']['gwh']
            countries = {code: row for code, row in rows.items() if code != '__world__'}
            add_raw(f'ewld_raw_{prefix}_world_gwh', year, world_gwh, f'World electricity {label}')
            for code, row in countries.items():
                safe = _vector_code(code)
                if not safe:
                    continue
                add_raw(f'ewld_raw_{prefix}_{safe}_gwh', year, row['gwh'], f'{row["en"]} electricity {label}')
            shown = _ranking(countries, world_gwh, include_canada)
            add(f'ewld_{prefix}_twh', year, _whole(world_gwh / Decimal(1000)), f'World electricity {label}', 'TWh')
            add(f'ewld_{prefix}_count', year, Decimal(len(shown)), f'Displayed electricity {label} rows', 'count')
            for index, row in enumerate(shown, start=1):
                add(f'ewld_{prefix}_r{index}_share', year, row['share'], f'{label} rank {index} share', 'Percent')
                add(f'ewld_{prefix}_r{index}_rank', year, Decimal(row['rank']), f'{label} rank {index}', 'rank')
                add(
                    f'ewld_{prefix}_r{index}_canada',
                    year,
                    Decimal(1 if row['code'] == 'CANADA' else 0),
                    'Canada row' if row['code'] == 'CANADA' else 'Other country row',
                    'flag',
                )
                add(f'ewld_{prefix}_{year}_r{index}_name_en', year, Decimal(index), row['en'], 'name')
                add(f'ewld_{prefix}_{year}_r{index}_name_fr', year, Decimal(index), row['fr'], 'name')
                add(f'ewld_{prefix}_{year}_r{index}_code', year, Decimal(index), row['code'], 'code')

    store_series('p', production, True, 'production')
    store_series('x', exports, False, 'exports')
    return raw_rows, list(raw_meta.values()), indicator_rows, list(indicator_meta.values())


def update_electricity_world_production(processor) -> int:
    concordance = _read_concordance(processor)
    production = _read_ranking(processor, PRODUCTION_SHEET, concordance, ('gross production',))
    exports = _read_ranking(processor, EXPORTS_SHEET, concordance, ('export',))
    data_rows, metadata_rows, _indicators, _indicator_meta = _rows(production, exports)
    n = processor.replace_raw_data(SOURCE_KEY, data_rows, metadata_rows)
    print(f'    Stored {n} source-native rows for {SOURCE_KEY}')
    return n


def transform_electricity_world_production(processor) -> int:
    concordance = _read_concordance(processor)
    production = _read_ranking(processor, PRODUCTION_SHEET, concordance, ('gross production',))
    exports = _read_ranking(processor, EXPORTS_SHEET, concordance, ('export',))
    _raw_rows, _raw_meta, data_rows, metadata_rows = _rows(production, exports)
    latest = max(set(production).intersection(exports))
    totals = {row[0]: row[2] for row in data_rows if int(row[1]) == latest}
    print(
        f'    Electricity world rankings {latest}: production {int(totals["ewld_p_twh"])} TWh, '
        f'exports {int(totals["ewld_x_twh"])} TWh'
    )
    n = processor.store_indicators(SOURCE_KEY, data_rows, metadata_rows)
    print(f'    Stored {n} indicator rows for {SOURCE_KEY}')
    return n
