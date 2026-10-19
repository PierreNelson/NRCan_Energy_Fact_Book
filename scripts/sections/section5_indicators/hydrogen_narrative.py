"""Hydrogen introduction, benefits, and Canada summary narrative."""

from __future__ import annotations

from typing import List, Tuple

import pandas as pd

from utils.io_retry import ensure_workbook, read_excel_with_retry

SOURCE_KEY = 'hydrogen_narrative'
WORKBOOK = 'iea_h2_narrative_summary_global_prod_and_demand.xlsx'
NARRATIVE_SHEET = 'h2_narrative'
SUMMARY_SHEET = 'h2_canada_summary'
SOURCE_URL = 'https://www.iea.org/search?q=global%20hydrogen'
SOURCE_ORG = 'International Energy Agency'
REF_DATE = '1'

Metadata = Tuple[str, str, str, str, str, str]
DataRow = Tuple[str, str, float]


def _text(value) -> str:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return ''
    return str(value).strip()


def _order(value) -> int:
    number = pd.to_numeric(value, errors='coerce')
    if pd.isna(number):
        raise ValueError(f'hydrogen narrative display_order is not numeric: {value!r}')
    return int(number)


def _read(processor, sheet: str) -> pd.DataFrame:
    path = ensure_workbook(WORKBOOK, config=processor.config)
    return read_excel_with_retry(path, sheet, config=processor.config, label=sheet)


def _rows(narrative: pd.DataFrame, summary: pd.DataFrame) -> tuple[List[DataRow], List[Metadata]]:
    for column in ('content_type', 'display_order', 'text'):
        if column not in narrative.columns:
            raise ValueError(f'{NARRATIVE_SHEET} is missing {column}')
    for column in ('language', 'display_order', 'summary_text'):
        if column not in summary.columns:
            raise ValueError(f'{SUMMARY_SHEET} is missing {column}')

    data_rows: List[DataRow] = []
    metadata: dict[str, Metadata] = {}

    def add(vector: str, order: int, title: str, uom: str):
        if not title:
            raise ValueError(f'{vector} has no text')
        data_rows.append((vector, REF_DATE, float(order)))
        metadata[vector] = (vector, title, uom, 'text', SOURCE_ORG, SOURCE_URL)

    grouped = {'introduction': [], 'benefit': [], 'fact': []}
    for _, row in narrative.iterrows():
        kind = _text(row['content_type']).casefold()
        if kind not in grouped:
            continue
        grouped[kind].append((_order(row['display_order']), _text(row['text'])))

    if not grouped['introduction'] or not grouped['benefit'] or not grouped['fact']:
        raise ValueError(f'{NARRATIVE_SHEET} is missing introduction, benefit, or fact rows')

    for order, text in sorted(grouped['introduction']):
        add(f'hnar_intro_{order}', order, text, 'introduction')
    for order, text in sorted(grouped['benefit']):
        add(f'hnar_benefit_{order}', order, text, 'benefit')
    for order, text in sorted(grouped['fact']):
        add('hnar_fact' if order == 1 else f'hnar_fact_{order}', order, text, 'fact')

    found = set()
    for _, row in summary.iterrows():
        language = _text(row['language']).casefold()
        if language not in {'en', 'fr'}:
            continue
        order = _order(row['display_order'])
        found.add(language)
        add(f'hnar_summary_{order}_{language}', order, _text(row['summary_text']), 'summary')
    if found != {'en', 'fr'}:
        raise ValueError(f'{SUMMARY_SHEET} must include EN and FR summary rows')

    return data_rows, list(metadata.values())


def update_hydrogen_narrative(processor) -> int:
    data_rows, metadata_rows = _rows(_read(processor, NARRATIVE_SHEET), _read(processor, SUMMARY_SHEET))
    n = processor.replace_raw_data(SOURCE_KEY, data_rows, metadata_rows)
    print(f'    Stored {n} source-native rows for {SOURCE_KEY}')
    return n


def transform_hydrogen_narrative(processor) -> int:
    data_rows, metadata_rows = _rows(_read(processor, NARRATIVE_SHEET), _read(processor, SUMMARY_SHEET))
    n = processor.store_indicators(SOURCE_KEY, data_rows, metadata_rows)
    print(f'    Stored {n} indicator rows for {SOURCE_KEY}')
    return n
