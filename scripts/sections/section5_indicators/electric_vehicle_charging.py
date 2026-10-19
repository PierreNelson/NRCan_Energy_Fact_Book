"""Electric vehicle charging levels (page 98) from the approved narrative workbook."""

from __future__ import annotations

import re
from typing import Dict, List, Tuple

import pandas as pd

from utils.io_retry import ensure_workbook, read_excel_with_retry

SOURCE_KEY = 'electric_vehicle_charging'
NARRATIVE_XLSX = 'ev_charging_narrative.xlsx'
NARRATIVE_SHEET = 'ev_charging_narrative'
SOURCE_URL = 'https://natural-resources.canada.ca/energy-sources/energy-facts'
REF_DATE = '1'

FIELDS = ('charger', 'input', 'outlet', 'charging_time', 'range', 'uses')
HEADER_TO_FIELD = {
    'charger': 'charger',
    'charger_fr': 'charger_fr',
    'input': 'input',
    'input_fr': 'input_fr',
    'outlet_type': 'outlet',
    'outlet type': 'outlet',
    'outlet_type_fr': 'outlet_fr',
    'outlet type fr': 'outlet_fr',
    'estimated_charging_time*': 'charging_time',
    'estimated charging time*': 'charging_time',
    'estimated_charging_time_fr': 'charging_time_fr',
    'estimated charging time fr': 'charging_time_fr',
    'estimated_range_per_hour_of_charging*': 'range',
    'estimated range per hour of charging*': 'range',
    'estimated_range_per_hour_of_charging_fr': 'range_fr',
    'estimated range per hour of charging fr': 'range_fr',
    'typical_uses': 'uses',
    'typical uses': 'uses',
    'typical_issues': 'uses',
    'typical_uses_fr': 'uses_fr',
    'typical uses fr': 'uses_fr',
    'typical_issues_fr': 'uses_fr',
    'footnote_fr': 'footnote_fr',
}
FRENCH_FIELDS = ('charger_fr', 'input_fr', 'outlet_fr', 'charging_time_fr', 'range_fr', 'uses_fr')

Metadata = Tuple[str, str, str, str, str, str]
DataRow = Tuple[str, str, float]


def _cell(value) -> str:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return ''
    text = str(value).replace('\r\n', '\n').replace('\r', '\n')
    text = re.sub(r'[ \t]*\n[ \t]*', ' ', text)
    text = re.sub(r' {2,}', ' ', text).strip()
    return '' if text.lower() == 'nan' else text


def _read_sheet(processor) -> tuple[List[Dict[str, str]], str, str]:
    path = ensure_workbook(NARRATIVE_XLSX, config=processor.config)
    frame = read_excel_with_retry(path, NARRATIVE_SHEET, config=processor.config, label='EV charging narrative')
    columns = {}
    for name in frame.columns:
        key = HEADER_TO_FIELD.get(str(name).strip().casefold())
        if key:
            columns[key] = name
    required = (*FIELDS, *FRENCH_FIELDS, 'footnote_fr')
    missing = [field for field in required if field not in columns]
    if missing:
        raise ValueError(f'{NARRATIVE_SHEET} is missing columns: {", ".join(missing)}')

    rows: List[Dict[str, str]] = []
    footnote = ''
    footnote_fr = ''
    for _, record in frame.iterrows():
        values = {field: _cell(record[columns[field]]) for field in (*FIELDS, *FRENCH_FIELDS)}
        if not footnote_fr:
            footnote_fr = _cell(record[columns['footnote_fr']])
        charger = values['charger']
        if charger.startswith('*') and not any(values[field] for field in FIELDS if field != 'charger'):
            footnote = charger.lstrip('*').strip()
            continue
        if not any(values[field] for field in FIELDS):
            continue
        if not charger:
            continue
        rows.append(values)

    if not rows:
        raise ValueError(f'{NARRATIVE_SHEET} has no charging-level rows')
    if not footnote:
        raise ValueError(f'{NARRATIVE_SHEET} has no footnote')
    if not footnote_fr:
        raise ValueError(f'{NARRATIVE_SHEET} has no French footnote')
    for row in rows:
        for field in FRENCH_FIELDS:
            if not row[field]:
                raise ValueError(f'{NARRATIVE_SHEET} row "{row["charger"]}" has no {field}')
    for text in (
        *[row[field] for row in rows for field in (*FIELDS, *FRENCH_FIELDS)],
        footnote,
        footnote_fr,
    ):
        if len(text) > 500:
            raise ValueError('EV charging narrative text exceeds 500 characters')
    return rows, footnote, footnote_fr


def _stored_rows(rows: List[Dict[str, str]], footnote: str, footnote_fr: str, raw: bool) -> tuple[List[DataRow], List[Metadata]]:
    data_rows: List[DataRow] = []
    metadata_rows: List[Metadata] = []
    prefix = 'evch_raw_' if raw else 'evch_'

    def add(vector: str, value: float, title: str):
        data_rows.append((vector, REF_DATE, float(value)))
        metadata_rows.append((
            vector,
            title,
            'Text',
            'units',
            'Natural Resources Canada',
            SOURCE_URL,
        ))

    for index, row in enumerate(rows, start=1):
        for field in (*FIELDS, *FRENCH_FIELDS):
            add(f'{prefix}r{index}_{field}', index, row[field])
    add(f'{prefix}footnote', 0, footnote)
    add(f'{prefix}footnote_fr', 0, footnote_fr)
    return data_rows, metadata_rows


def update_electric_vehicle_charging(processor) -> int:
    rows, footnote, footnote_fr = _read_sheet(processor)
    data_rows, metadata_rows = _stored_rows(rows, footnote, footnote_fr, raw=True)
    n = processor.replace_raw_data(SOURCE_KEY, data_rows, metadata_rows)
    print(f'    Stored {n} source-native rows for {SOURCE_KEY}')
    return n


def transform_electric_vehicle_charging(processor) -> int:
    rows, footnote, footnote_fr = _read_sheet(processor)
    data_rows, metadata_rows = _stored_rows(rows, footnote, footnote_fr, raw=False)
    n = processor.store_indicators(SOURCE_KEY, data_rows, metadata_rows)
    print(f'    EV charging levels: {len(rows)} rows')
    print(f'    Stored {n} indicator rows for {SOURCE_KEY}')
    return n
