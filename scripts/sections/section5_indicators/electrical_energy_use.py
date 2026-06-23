"""Page 68 — Electrical energy use by sector and province (OEE NEUD EEDAS tables)."""

from __future__ import annotations

from typing import Dict, List, Tuple

import pandas as pd

from .constants import (
    ELEC_EU_METADATA,
    ELEC_EU_PROVINCE_KEYS,
    ELEC_EU_RAW_PREFIX,
    ELEC_EU_SECTOR_KEYS,
    ELEC_EU_SOURCE_URL,
)

SOURCE_KEY = 'electrical_energy_use'


def _raw_by_year_from_dataframe(df: pd.DataFrame) -> Dict[str, Dict[str, float]]:
    raw_by_year: Dict[str, Dict[str, float]] = {}
    for _, row in df.iterrows():
        vector = str(row.get('vector', ''))
        if not vector.startswith(f'{ELEC_EU_RAW_PREFIX}_'):
            continue
        suffix = vector[len(f'{ELEC_EU_RAW_PREFIX}_'):]
        try:
            year_key = str(int(str(row['ref_date'])[:4]))
            value = float(row['value'])
        except (TypeError, ValueError):
            continue
        raw_by_year.setdefault(year_key, {})[suffix] = value
    return raw_by_year


def _transform_indicator_rows_from_raw(
    raw_by_year: Dict[str, Dict[str, float]],
) -> Tuple[List[Tuple[str, str, float]], List[Tuple[str, str, str, str, str, str]]]:
    data_rows: List[Tuple[str, str, float]] = []
    metadata_rows = list(ELEC_EU_METADATA)

    for year_key in sorted(raw_by_year, key=int):
        row = raw_by_year[year_key]
        sector_vals = {key: row.get(key) for key in ELEC_EU_SECTOR_KEYS}
        if all(val is not None for val in sector_vals.values()):
            total = sum(float(sector_vals[key]) for key in ELEC_EU_SECTOR_KEYS)
            data_rows.append(('elec_eu_total', year_key, round(total, 4)))
            for key, val in sector_vals.items():
                pj = float(val)
                data_rows.append((f'elec_eu_{key}', year_key, round(pj, 4)))
                data_rows.append((f'elec_eu_{key}_pct', year_key, round(pj / total * 100, 1)))

        prov_vals = {key: row.get(key) for key in ELEC_EU_PROVINCE_KEYS}
        if all(val is not None for val in prov_vals.values()):
            prov_total = sum(float(prov_vals[key]) for key in ELEC_EU_PROVINCE_KEYS)
            if prov_total > 0:
                for key, val in prov_vals.items():
                    pj = float(val)
                    data_rows.append((f'elec_eu_{key}', year_key, round(pj, 4)))
                    data_rows.append((f'elec_eu_{key}_pct', year_key, round(pj / prov_total * 100, 1)))

    return data_rows, metadata_rows


def _bootstrap_raw_by_year() -> Dict[str, Dict[str, float]]:
    """Factbook 2022–2023 values until live EEDAS neud_electrical_energy_use_* ingest is wired."""
    return {
        '2023': {
            'R': 636.8,
            'C': 536.0,
            'I': 753.7,
            'T': 4.5,
            'A': 38.6,
            'ATL': 130.0,
            'BC_TERR': 212.7,
            'ALTA': 212.7,
            'SASK': 78.8,
            'MAN': 72.9,
            'ONT': 504.2,
            'QUE': 758.3,
        },
        '2022': {
            'R': 654.8,
            'C': 551.2,
            'I': 775.1,
            'T': 4.6,
            'A': 39.7,
            'ATL': 133.7,
            'BC_TERR': 218.7,
            'ALTA': 218.7,
            'SASK': 81.0,
            'MAN': 75.0,
            'ONT': 518.5,
            'QUE': 779.8,
        },
    }


def update_electrical_energy_use(processor) -> int:
    """EEDAS ingest: OEE NEUD electrical energy use by sector and province (PJ)."""
    print('  Fetching OEE NEUD electrical energy use (sector + province)...')
    raw_by_year = _bootstrap_raw_by_year()

    data_rows: List[Tuple[str, str, float]] = []
    metadata_rows: List[Tuple[str, str, str, str, str, str]] = []
    source_org = 'Natural Resources Canada (OEE)'

    for year_key, row in sorted(raw_by_year.items(), key=lambda item: int(item[0])):
        for suffix, value in row.items():
            vector = f'{ELEC_EU_RAW_PREFIX}_{suffix}'
            data_rows.append((vector, year_key, round(float(value), 4)))
            metadata_rows.append((
                vector,
                f'Electrical energy use raw {suffix}, {year_key}',
                'PJ',
                'petajoules',
                source_org,
                ELEC_EU_SOURCE_URL,
            ))

    if not data_rows:
        raise ValueError('electrical_energy_use update: no raw rows produced')

    n = processor.replace_raw_data(SOURCE_KEY, data_rows, metadata_rows)
    print(f'    Stored {n} source-native rows for {SOURCE_KEY}')
    return n


def transform_electrical_energy_use(processor) -> int:
    """EFB transform: elec_eu_* vectors for Page 68 from stored raw rows."""
    df = processor.get_raw_dataframe(SOURCE_KEY)
    if df.empty:
        raise RuntimeError('electrical_energy_use transform: no raw rows found — re-run eedas update')

    raw_by_year = _raw_by_year_from_dataframe(df)
    data_rows, metadata_rows = _transform_indicator_rows_from_raw(raw_by_year)
    if not data_rows:
        raise RuntimeError('electrical_energy_use transform: no indicator rows produced from raw data')

    n = processor.store_indicators(SOURCE_KEY, data_rows, metadata_rows)
    print(f'    Stored {n} indicator rows for {SOURCE_KEY}')
    return n


def build_electrical_energy_use_indicator_rows() -> Tuple[
    List[Tuple[str, str, float]],
    List[Tuple[str, str, str, str, str, str]],
]:
    """Build indicator rows without SQL (offline export / tests)."""
    return _transform_indicator_rows_from_raw(_bootstrap_raw_by_year())
