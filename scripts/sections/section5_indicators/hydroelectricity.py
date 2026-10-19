"""World hydroelectricity ranking and Canada's hydro share of generation."""

from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, List, Optional, Tuple

import pandas as pd

from utils.io_retry import ensure_workbook, read_excel_with_retry

SOURCE_KEY = 'hydroelectricity'
IEA_XLSX = 'oecd_iea_data.xlsx'
GENCAP_XLSX = 'secondary Master gencap file.xlsx'
WORLD_SHEET_ALIASES = ('hydroelectricity_world_generation', 'hydro_world_gen')
CONCORDANCE_ALIASES = ('metadata_iea_gac_geo_concordance', 'ref_iea_gac_geo_concordance')
CANADA_SHEET = 'src_elegen_can'
IEA_SOURCE_URL = 'https://www.iea.org/data-and-statistics'
NRCAN_SOURCE_URL = 'https://natural-resources.canada.ca/energy-sources/energy-facts'
TOP_N = 5
SKIP_CODES = {'WORLD', 'WLD', 'OECD', 'IEATOT', 'TOTAL'}
AGGREGATE_NAMES = {'world', 'monde', 'oecd', 'oecd total', 'total'}

Metadata = Tuple[str, str, str, str, str, str]
DataRow = Tuple[str, str, float]


def _decimal(value) -> Optional[Decimal]:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    text = str(value).strip().replace(',', '')
    if not text or text.lower() == 'nan':
        return None
    return Decimal(text)


def _whole(value: Decimal) -> Decimal:
    return value.quantize(Decimal('1'), rounding=ROUND_HALF_UP)


def _sheet(path, aliases: Tuple[str, ...], label: str) -> str:
    names = {name.strip().lower(): name for name in pd.ExcelFile(path).sheet_names}
    for alias in aliases:
        hit = names.get(alias.strip().lower())
        if hit:
            return hit
    raise ValueError(f'{label}: none of {aliases} found')


def _text(value) -> str:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return ''
    return str(value).strip()


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
        if label in {'country', 'country/region', 'geography'} or 'country' in label:
            return column
    raise ValueError('hydroelectricity world generation sheet has no geography column')


def _read_world(processor, concordance) -> Dict[int, Dict[str, dict]]:
    path = ensure_workbook(IEA_XLSX, config=processor.config)
    sheet = _sheet(path, WORLD_SHEET_ALIASES, 'world hydroelectricity generation')
    frame = read_excel_with_retry(path, sheet, config=processor.config, label='world hydroelectricity generation')
    for column in ('TIME_PERIOD', 'OBS_VALUE'):
        if column not in frame.columns:
            raise ValueError(f'{sheet} is missing {column}')
    geo_col = _geography_column(frame)
    if 'UNIT' in frame.columns:
        units = frame['UNIT'].astype(str).str.strip().str.upper()
        frame = frame[units.isin({'GWH', 'NAN', ''}) | frame['UNIT'].isna()]
    if 'Product' in frame.columns:
        products = frame['Product'].astype(str).str.strip().str.casefold()
        hydro = frame[products.eq('hydropower')]
        if not hydro.empty:
            frame = hydro

    by_year: Dict[int, Dict[str, dict]] = {}
    for _, row in frame.iterrows():
        year_value = _decimal(row['TIME_PERIOD'])
        gwh = _decimal(row['OBS_VALUE'])
        if year_value is None or gwh is None:
            continue
        code = _text(row[geo_col]).upper()
        if not code:
            continue
        record = concordance.get(code)
        if record is None:
            continue
        english, french, is_country = record
        if code in SKIP_CODES or english.casefold() in AGGREGATE_NAMES:
            continue
        if not is_country:
            continue
        year = int(year_value)
        slot = by_year.setdefault(year, {})
        current = slot.get(code)
        if current is None:
            slot[code] = {
                'code': code,
                'gwh': gwh,
                'en': english,
                'fr': french,
            }
        else:
            current['gwh'] += gwh

    world_by_year: Dict[int, Decimal] = {}
    raw = read_excel_with_retry(path, sheet, config=processor.config, label='world hydroelectricity total')
    for _, row in raw.iterrows():
        if _text(row[geo_col]).upper() != 'WORLD':
            continue
        year_value = _decimal(row['TIME_PERIOD'])
        gwh = _decimal(row['OBS_VALUE'])
        if year_value is None or gwh is None:
            continue
        world_by_year[int(year_value)] = world_by_year.get(int(year_value), Decimal(0)) + gwh

    for year, total in world_by_year.items():
        if year in by_year and total > 0:
            by_year[year]['__world__'] = {'gwh': total}
    return {year: rows for year, rows in by_year.items() if '__world__' in rows}


def _read_canada_share(processor) -> Dict[int, Decimal]:
    path = ensure_workbook(GENCAP_XLSX, config=processor.config)
    sheet = _sheet(path, (CANADA_SHEET,), 'Canada electricity generation')
    frame = read_excel_with_retry(path, sheet, config=processor.config, label='Canada electricity generation')
    columns = {str(column).strip().lower(): column for column in frame.columns}
    required = ('year', 'source', 'share (%)')
    missing = [name for name in required if name not in columns]
    if missing:
        raise ValueError(f'{sheet} is missing columns: {", ".join(missing)}')
    shares: Dict[int, Decimal] = {}
    for _, row in frame.iterrows():
        if _text(row[columns['source']]).casefold() != 'hydro':
            continue
        year_value = _decimal(row[columns['year']])
        share = _decimal(row[columns['share (%)']])
        if year_value is None or share is None:
            continue
        if share <= 1:
            share *= Decimal(100)
        shares[int(year_value)] = share
    if not shares:
        raise ValueError(f'{sheet} has no hydro share rows')
    return shares


def _ranking(countries: Dict[str, dict], world_gwh: Decimal) -> Tuple[List[dict], int]:
    ordered = sorted(countries.values(), key=lambda row: (-row['gwh'], row['en']))
    ranked = []
    for index, row in enumerate(ordered, start=1):
        ahead = sum(1 for other in ordered if other['gwh'] > row['gwh'])
        ranked.append({
            **row,
            'rank': ahead + 1,
            'share': _whole(row['gwh'] / world_gwh * Decimal(100)),
            'order': index,
        })
    canada_rank = next((row['rank'] for row in ranked if row['code'] == 'CANADA'), None)
    if canada_rank is None:
        raise ValueError('Canada is missing from the hydroelectricity ranking')
    shown = ranked[:TOP_N]
    if not any(row['code'] == 'CANADA' for row in shown):
        shown.append(next(row for row in ranked if row['code'] == 'CANADA'))
    return shown, canada_rank


def _rows(world, shares) -> tuple[List[DataRow], List[Metadata], List[DataRow], List[Metadata]]:
    years = sorted(set(world).intersection(shares))
    if not years:
        raise ValueError('No reporting year is present in both hydroelectricity sources')

    raw_rows: List[DataRow] = []
    raw_meta: Dict[str, Metadata] = {}
    indicator_rows: List[DataRow] = []
    indicator_meta: Dict[str, Metadata] = {}

    def add_raw(vector: str, year: int, value: Decimal, title: str, uom: str, org: str, url: str):
        raw_rows.append((vector, str(year), float(value.quantize(Decimal('0.0001')))))
        raw_meta[vector] = (vector, title, uom, 'units', org, url)

    def add(vector: str, year: int, value: Decimal, title: str, uom: str, org: str, url: str):
        indicator_rows.append((vector, str(year), float(value)))
        indicator_meta[vector] = (vector, title, uom, 'units', org, url)

    for year in years:
        rows = world[year]
        world_gwh = rows['__world__']['gwh']
        countries = {code: row for code, row in rows.items() if code != '__world__'}
        shown, canada_rank = _ranking(countries, world_gwh)
        add_raw('hyel_raw_world_gwh', year, world_gwh, 'World hydroelectricity generation', 'GWh', 'International Energy Agency', IEA_SOURCE_URL)
        for code, row in countries.items():
            add_raw(
                f'hyel_raw_{code.lower()}_gwh',
                year,
                row['gwh'],
                f'{row["en"]} hydroelectricity generation',
                'GWh',
                'International Energy Agency',
                IEA_SOURCE_URL,
            )
        add_raw(
            'hyel_raw_canada_elec_share',
            year,
            shares[year],
            'Hydro share of Canada electricity generation',
            'Percent',
            'Natural Resources Canada',
            NRCAN_SOURCE_URL,
        )

        add('hyel_world_twh', year, _whole(world_gwh / Decimal(1000)), 'World hydroelectricity generation', 'TWh', 'International Energy Agency', IEA_SOURCE_URL)
        add('hyel_canada_elec_share', year, _whole(shares[year]), 'Hydro share of Canada electricity generation', 'Percent', 'Natural Resources Canada', NRCAN_SOURCE_URL)
        add('hyel_canada_rank', year, Decimal(canada_rank), 'Canada world hydroelectricity rank', 'rank', 'International Energy Agency', IEA_SOURCE_URL)
        add('hyel_count', year, Decimal(len(shown)), 'Displayed hydroelectricity ranking rows', 'count', 'International Energy Agency', IEA_SOURCE_URL)
        for index, row in enumerate(shown, start=1):
            add(f'hyel_r{index}_share', year, row['share'], f'Rank {index} share', 'Percent', 'International Energy Agency', IEA_SOURCE_URL)
            add(f'hyel_r{index}_rank', year, Decimal(row['rank']), f'Rank {index}', 'rank', 'International Energy Agency', IEA_SOURCE_URL)
            add(
                f'hyel_r{index}_canada',
                year,
                Decimal(1 if row['code'] == 'CANADA' else 0),
                'Canada row' if row['code'] == 'CANADA' else 'Other country row',
                'flag',
                'International Energy Agency',
                IEA_SOURCE_URL,
            )
            add(f'hyel_r{index}_name_en', year, Decimal(index), row['en'], 'name', 'International Energy Agency', IEA_SOURCE_URL)
            add(f'hyel_r{index}_name_fr', year, Decimal(index), row['fr'], 'name', 'International Energy Agency', IEA_SOURCE_URL)

    return raw_rows, list(raw_meta.values()), indicator_rows, list(indicator_meta.values())


def update_hydroelectricity(processor) -> int:
    concordance = _read_concordance(processor)
    world = _read_world(processor, concordance)
    shares = _read_canada_share(processor)
    data_rows, metadata_rows, _indicators, _indicator_meta = _rows(world, shares)
    n = processor.replace_raw_data(SOURCE_KEY, data_rows, metadata_rows)
    print(f'    Stored {n} source-native rows for {SOURCE_KEY}')
    return n


def transform_hydroelectricity(processor) -> int:
    concordance = _read_concordance(processor)
    world = _read_world(processor, concordance)
    shares = _read_canada_share(processor)
    _raw_rows, _raw_meta, data_rows, metadata_rows = _rows(world, shares)
    n = processor.store_indicators(SOURCE_KEY, data_rows, metadata_rows)
    latest = max(set(world).intersection(shares))
    totals = {row[0]: row[2] for row in data_rows if int(row[1]) == latest}
    print(
        f'    Hydroelectricity {latest}: {int(totals["hyel_world_twh"])} TWh, '
        f'Canada share {int(totals["hyel_canada_elec_share"])}%, rank {int(totals["hyel_canada_rank"])}'
    )
    print(f'    Stored {n} indicator rows for {SOURCE_KEY}')
    return n
