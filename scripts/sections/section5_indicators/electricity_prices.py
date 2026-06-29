"""Page 69 — Average large industrial and residential electricity prices (HydroQ / ELE-Res&Ind)."""

from __future__ import annotations

import re
import unicodedata
from typing import Dict, List, Optional, Tuple

import pandas as pd

from config_loader import get_config
from utils.io_retry import ensure_workbook, read_excel_with_retry, resolve_sheet_name, run_with_retry

from .constants import (
    ELECTRICITY_PRICES_CITY_TITLES,
    ELECTRICITY_PRICES_IN_SCOPE_CITY_KEYS,
    ELECTRICITY_PRICES_SHEET,
    ELECTRICITY_PRICES_SOURCE_ORG,
    ELECTRICITY_PRICES_SOURCE_URL,
    ELECTRICITY_PRICES_XLSX,
)

SOURCE_KEY = 'electricity_prices'
RAW_PREFIX = 'raw_elec_price'

# Workbook Frequency is Annual (Year column only). ref_date is stored as YYYY.

_TYPE_TO_KEY = {
    'residential': 'residential',
    'large industrial': 'industrial',
}

_CITY_NAME_TO_KEY = {
    'montreal': 'montreal',
    'montréal': 'montreal',
    'montral': 'montreal',
    'calgary': 'calgary',
    'charlottetown': 'charlottetown',
    'edmonton': 'edmonton',
    'halifax': 'halifax',
    'moncton': 'moncton',
    'ottawa': 'ottawa',
    'regina': 'regina',
    "st. john's": 'st_johns',
    'st johns': 'st_johns',
    'toronto': 'toronto',
    'vancouver': 'vancouver',
    'winnipeg': 'winnipeg',
}


def _normalize_label(text: str) -> str:
    nfkd = unicodedata.normalize('NFKD', str(text))
    ascii_text = nfkd.encode('ascii', 'ignore').decode('ascii')
    return re.sub(r'\s+', ' ', ascii_text).strip().lower()


def _city_key_from_name(name: str) -> Optional[str]:
    norm = _normalize_label(name)
    key = _CITY_NAME_TO_KEY.get(norm)
    if key:
        return key
    if norm.startswith('montr'):
        return 'montreal'
    if norm.startswith('st. john') or norm.startswith('st john'):
        return 'st_johns'
    return None


def _parse_price(value) -> Optional[float]:
    if pd.isna(value):
        return None
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None
    if parsed < 0:
        return None
    return parsed


def _parse_year(value) -> Optional[int]:
    if pd.isna(value):
        return None
    try:
        year = int(float(value))
    except (TypeError, ValueError):
        return None
    if year < 1900 or year > 2100:
        return None
    return year


def _expected_suffixes() -> set[str]:
    return {
        f'{city}_{price_type}'
        for city in ELECTRICITY_PRICES_IN_SCOPE_CITY_KEYS
        for price_type in ('industrial', 'residential')
    }


def _read_electricity_prices_rows(config=None) -> Dict[str, Dict[str, float]]:
    def _load() -> Dict[str, Dict[str, float]]:
        path = ensure_workbook(ELECTRICITY_PRICES_XLSX, config=config)
        sheet = resolve_sheet_name(
            path,
            ELECTRICITY_PRICES_SHEET,
            label='electricity_prices',
        )
        df = read_excel_with_retry(
            path,
            sheet,
            config=config,
            label=f'{ELECTRICITY_PRICES_XLSX} {sheet!r}',
        )
        col_map = {str(c).strip().lower(): c for c in df.columns}
        required = ['year', 'city', 'type', 'value']
        missing = [name for name in required if name not in col_map]
        if missing:
            raise ValueError(
                f'electricity_prices: missing columns {missing} in {path.name}'
            )

        year_col = col_map['year']
        city_col = col_map['city']
        type_col = col_map['type']
        value_col = col_map['value']

        raw_by_ref: Dict[str, Dict[str, float]] = {}
        skipped: List[str] = []
        expected = _expected_suffixes()

        for _, record in df.iterrows():
            year = _parse_year(record[year_col])
            if year is None:
                continue

            city_name = record[city_col]
            city_key = _city_key_from_name(city_name)
            if city_key not in ELECTRICITY_PRICES_IN_SCOPE_CITY_KEYS:
                if pd.notna(city_name):
                    skipped.append(str(city_name))
                continue

            price_type = _TYPE_TO_KEY.get(_normalize_label(record[type_col]))
            if not price_type:
                continue

            price = _parse_price(record[value_col])
            if price is None:
                skipped.append(f'{year}/{city_key}/{price_type}')
                continue

            ref_date = str(year)
            raw_by_ref.setdefault(ref_date, {})[f'{city_key}_{price_type}'] = round(price, 4)

        if skipped:
            uniq = sorted(set(skipped))
            print(
                '    Warning: electricity_prices skipped unrecognized or invalid row(s): '
                + ', '.join(uniq[:12])
                + ('…' if len(uniq) > 12 else '')
            )

        complete: Dict[str, Dict[str, float]] = {}
        for ref_date, row in sorted(raw_by_ref.items(), key=lambda item: int(item[0])):
            if set(row.keys()) >= expected:
                complete[ref_date] = {key: row[key] for key in sorted(expected)}
            else:
                missing_keys = sorted(expected - set(row.keys()))
                print(
                    f'    Warning: electricity_prices skipped incomplete year {ref_date} '
                    f'(missing {", ".join(missing_keys[:6])}'
                    f'{"…" if len(missing_keys) > 6 else ""})'
                )

        if not complete:
            raise ValueError('electricity_prices: no complete annual rows found in workbook')

        latest = max(complete, key=int)
        print(f'    Latest electricity prices vintage: {latest} ({len(complete)} year(s) loaded)')
        return complete

    return run_with_retry(_load, config=config, label=f'{ELECTRICITY_PRICES_XLSX} load')


def _transform_indicator_rows(
    raw_by_ref: Dict[str, Dict[str, float]],
) -> Tuple[List[Tuple[str, str, float]], List[Tuple[str, str, str, str, str, str]]]:
    data_rows: List[Tuple[str, str, float]] = []
    metadata_rows: List[Tuple[str, str, str, str, str, str]] = []

    for ref_date in sorted(raw_by_ref, key=int):
        row = raw_by_ref[ref_date]
        for suffix, value in sorted(row.items()):
            if not suffix.endswith(('_industrial', '_residential')):
                continue
            city_key = suffix.rsplit('_', 1)[0]
            price_type = suffix.rsplit('_', 1)[1]
            city_title = ELECTRICITY_PRICES_CITY_TITLES.get(
                city_key,
                city_key.replace('_', ' ').title(),
            )
            vector = f'elec_price_{city_key}_{price_type}'
            data_rows.append((vector, ref_date, round(float(value), 2)))
            metadata_rows.append((
                vector,
                f'{city_title} — {price_type} electricity price, {ref_date}',
                'Cents per kilowatt hour',
                'cents per kilowatt hour',
                ELECTRICITY_PRICES_SOURCE_ORG,
                ELECTRICITY_PRICES_SOURCE_URL,
            ))

    return data_rows, metadata_rows


def _raw_by_ref_from_dataframe(df) -> Dict[str, Dict[str, float]]:
    raw_by_ref: Dict[str, Dict[str, float]] = {}
    for _, row in df.iterrows():
        vector = str(row.get('vector', ''))
        if not vector.startswith(f'{RAW_PREFIX}_'):
            continue
        suffix = vector[len(f'{RAW_PREFIX}_'):]
        ref_date = str(row['ref_date'])
        try:
            value = float(row['value'])
        except (TypeError, ValueError):
            continue
        raw_by_ref.setdefault(ref_date, {})[suffix] = value
    return raw_by_ref


def update_electricity_prices(processor) -> int:
    """EEDAS ingest: HydroQ average industrial and residential electricity prices by city."""
    print('  Loading electricity prices (HydroQ / ELE-Res&Ind)...')
    raw_by_ref = _read_electricity_prices_rows(get_config())

    data_rows: List[Tuple[str, str, float]] = []
    metadata_rows: List[Tuple[str, str, str, str, str, str]] = []

    for ref_date, row in sorted(raw_by_ref.items(), key=lambda item: int(item[0])):
        for suffix, value in sorted(row.items()):
            vector = f'{RAW_PREFIX}_{suffix}'
            data_rows.append((vector, ref_date, round(float(value), 4)))
            city_key = suffix.rsplit('_', 1)[0]
            price_type = suffix.rsplit('_', 1)[1]
            city_title = ELECTRICITY_PRICES_CITY_TITLES.get(city_key, city_key)
            metadata_rows.append((
                vector,
                f'Electricity price raw {city_title} {price_type}, {ref_date}',
                'Cents per kilowatt hour',
                'cents per kilowatt hour',
                ELECTRICITY_PRICES_SOURCE_ORG,
                ELECTRICITY_PRICES_SOURCE_URL,
            ))

    if not data_rows:
        raise ValueError('electricity_prices update: no raw rows produced')

    n = processor.replace_raw_data(SOURCE_KEY, data_rows, metadata_rows)
    print(f'    Stored {n} source-native rows for {SOURCE_KEY}')
    return n


def transform_electricity_prices(processor) -> int:
    """EFB transform: elec_price_* vectors for Page 69 from stored raw rows (latest year only)."""
    df = processor.get_raw_dataframe(SOURCE_KEY)
    if df.empty:
        raise RuntimeError('electricity_prices transform: no raw rows found — re-run eedas update')

    raw_by_ref = _raw_by_ref_from_dataframe(df)
    if not raw_by_ref:
        raise RuntimeError('electricity_prices transform: no indicator rows produced from raw data')

    latest_ref = max(raw_by_ref, key=int)
    latest_only = {latest_ref: raw_by_ref[latest_ref]}
    print(
        f'    EFB indicator vintage: {latest_ref} '
        f'({len(raw_by_ref)} year(s) retained in EEDAS)'
    )

    data_rows, metadata_rows = _transform_indicator_rows(latest_only)
    if not data_rows:
        raise RuntimeError('electricity_prices transform: no indicator rows produced from raw data')

    n = processor.store_indicators(SOURCE_KEY, data_rows, metadata_rows)
    print(f'    Stored {n} indicator rows for {SOURCE_KEY}')
    return n
