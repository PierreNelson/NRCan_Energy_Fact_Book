"""Page 79 — World wind power capacity ranking and Canada wind generation share."""

from __future__ import annotations

import re
from typing import Dict, List, Optional, Tuple

import pandas as pd

from utils.io_retry import ensure_workbook, read_excel_with_retry, resolve_sheet_name, run_with_retry

from .constants import (
    GENCAP_REN_ELEGEN_SHEET,
    GENCAP_REN_ELEGEN_XLSX,
    WORLD_WIND_COUNTRY_IDS,
    WORLD_WIND_LOCATION_TO_KEY,
    WORLD_WIND_METADATA,
    WORLD_WIND_SHEET,
    WORLD_WIND_SKIP_LOCATIONS,
    WORLD_WIND_XLSX,
)

SOURCE_KEY = 'world_wind_power'
RAW_PREFIX = 'raw_win_world'


def _normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df.columns = [re.sub(r"^['\"]|['\"]$", '', str(c).strip()) for c in df.columns]
    return df


def _parse_numeric(value) -> Optional[float]:
    if pd.isna(value):
        return None
    if isinstance(value, str):
        stripped = value.strip()
        if stripped in ('', '-', '–', '—'):
            return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _parse_year(value) -> Optional[int]:
    if pd.isna(value):
        return None
    try:
        year = int(float(value))
    except (TypeError, ValueError):
        return None
    return year if year >= 1900 else None


def _normalize_location(location: str) -> str:
    return str(location).strip().lower()


def _location_key(location: str) -> Optional[str]:
    loc = _normalize_location(location)
    if not loc or loc in WORLD_WIND_SKIP_LOCATIONS:
        return None
    mapped = WORLD_WIND_LOCATION_TO_KEY.get(loc)
    if mapped:
        return mapped
    slug = re.sub(r'[^a-z0-9]+', '_', loc).strip('_')
    return slug or None


def _read_world_capacity_by_year(config=None) -> Dict[int, Dict[str, float]]:
    def _load() -> Dict[int, Dict[str, float]]:
        path = ensure_workbook(WORLD_WIND_XLSX, config=config)
        sheet = resolve_sheet_name(path, WORLD_WIND_SHEET, label='world_wind_power')
        df = _normalize_columns(
            read_excel_with_retry(
                path,
                sheet,
                config=config,
                label=f'{WORLD_WIND_XLSX} {sheet!r}',
                header=0,
            )
        )
        col_map = {str(c).lower().strip(): c for c in df.columns}
        loc_col = col_map.get('location')
        cap_col = col_map.get('total capacity (mw)')
        year_col = col_map.get('year')
        if not loc_col or not cap_col or not year_col:
            raise ValueError(f'world_wind_power: missing columns in {path.name} sheet {sheet!r}')

        by_year: Dict[int, Dict[str, float]] = {}
        for _, record in df.iterrows():
            year = _parse_year(record[year_col])
            if year is None:
                continue
            location = str(record[loc_col]).strip()
            capacity = _parse_numeric(record[cap_col])
            if capacity is None or capacity <= 0:
                continue
            key = _location_key(location)
            if key is None:
                continue
            existing = by_year.setdefault(year, {}).get(key)
            if existing is None or capacity > existing:
                by_year.setdefault(year, {})[key] = round(capacity, 1)

        if not by_year:
            raise ValueError('world_wind_power: no capacity rows parsed from worldcap_wind')
        return by_year

    return run_with_retry(
        _load,
        config=config,
        label=f'{WORLD_WIND_XLSX} world capacity load',
    )


def _read_canada_wind_share_by_year(config=None) -> Dict[int, float]:
    def _load() -> Dict[int, float]:
        path = ensure_workbook(GENCAP_REN_ELEGEN_XLSX, config=config)
        sheet = resolve_sheet_name(
            path,
            GENCAP_REN_ELEGEN_SHEET,
            label='world_wind_power ren_elegen',
        )
        df = _normalize_columns(
            read_excel_with_retry(
                path,
                sheet,
                config=config,
                label=f'{GENCAP_REN_ELEGEN_XLSX} {sheet!r}',
                header=0,
            )
        )
        col_map = {str(c).lower().strip(): c for c in df.columns}
        year_col = col_map.get('year')
        source_col = col_map.get('source')
        share_col = col_map.get('shares (%)')
        if not year_col or not source_col or not share_col:
            raise ValueError(f'world_wind_power: missing ren_elegen columns in {path.name}')

        by_year: Dict[int, float] = {}
        for _, record in df.iterrows():
            year = _parse_year(record[year_col])
            if year is None:
                continue
            if str(record[source_col]).strip().lower() != 'wind':
                continue
            share = _parse_numeric(record[share_col])
            if share is None:
                continue
            by_year[year] = round(share * 100, 1)

        if not by_year:
            raise ValueError('world_wind_power: no wind share rows in ren_elegen')
        return by_year

    return run_with_retry(
        _load,
        config=config,
        label=f'{GENCAP_REN_ELEGEN_XLSX} wind share load',
    )


def _country_id(country_key: str) -> int:
    country_id = WORLD_WIND_COUNTRY_IDS.get(country_key)
    if country_id is None:
        raise ValueError(f'world_wind_power: missing country id for {country_key!r}')
    return country_id


def _build_indicator_rows(config=None) -> Tuple[List[Tuple[str, str, float]], List[Tuple[str, str, str, str, str, str]]]:
    capacity_by_year = _read_world_capacity_by_year(config)
    wind_share_by_year = _read_canada_wind_share_by_year(config)
    data_rows: List[Tuple[str, str, float]] = []
    metadata_rows: List[Tuple[str, str, str, str, str, str]] = []
    meta_by_vector = {row[0]: row for row in WORLD_WIND_METADATA}

    for year in sorted(capacity_by_year):
        year_key = str(year)
        values = capacity_by_year[year]
        world_mw = values.get('world')
        if world_mw is None or world_mw <= 0:
            continue

        total_gw = round(world_mw / 1000)
        data_rows.append(('win_world_total_gw', year_key, float(total_gw)))

        ranked = sorted(
            ((key, mw) for key, mw in values.items() if key != 'world'),
            key=lambda item: item[1],
            reverse=True,
        )

        for rank_idx, (country_key, mw) in enumerate(ranked[:5], start=1):
            share_pct = round(100 * mw / world_mw)
            data_rows.append((f'win_world_top{rank_idx}_share_pct', year_key, float(share_pct)))
            data_rows.append((
                f'win_world_top{rank_idx}_country_id',
                year_key,
                float(_country_id(country_key)),
            ))

        canada_mw = values.get('canada')
        if canada_mw is not None:
            data_rows.append((
                'win_world_canada_share_pct',
                year_key,
                float(round(100 * canada_mw / world_mw)),
            ))

        canada_rank = next((index + 1 for index, (key, _) in enumerate(ranked) if key == 'canada'), None)
        if canada_rank:
            data_rows.append(('win_world_canada_rank', year_key, float(canada_rank)))

    for year, share_pct in sorted(wind_share_by_year.items()):
        data_rows.append(('win_can_wind_elec_share_pct', str(year), share_pct))

    seen_vectors = set()
    for vector, _, _ in data_rows:
        if vector in seen_vectors:
            continue
        seen_vectors.add(vector)
        meta = meta_by_vector.get(vector)
        if meta:
            metadata_rows.append(meta)

    if not data_rows:
        raise ValueError('world_wind_power: no indicator rows produced')

    return data_rows, metadata_rows


def build_world_wind_power_indicator_rows(
    config=None,
) -> Tuple[List[Tuple[str, str, float]], List[Tuple[str, str, str, str, str, str]]]:
    return _build_indicator_rows(config)


def update_world_wind_power(processor) -> int:
    capacity_by_year = _read_world_capacity_by_year(processor.config)
    wind_share_by_year = _read_canada_wind_share_by_year(processor.config)
    data_rows: List[Tuple[str, str, float]] = []
    metadata_rows: List[Tuple[str, str, str, str, str, str]] = []

    for year, values in sorted(capacity_by_year.items()):
        year_key = str(year)
        for key, mw in values.items():
            vector = f'{RAW_PREFIX}_cap_{key}_mw'
            data_rows.append((vector, year_key, mw))
            title = f'World wind capacity {key} (raw), {year}'
            metadata_rows.append((vector, title, 'MW', 'megawatts', 'Global Wind Energy Council', ''))

    for year, share in sorted(wind_share_by_year.items()):
        vector = f'{RAW_PREFIX}_can_wind_share_pct'
        data_rows.append((vector, str(year), share))
        metadata_rows.append((
            vector,
            f'Canada wind electricity share (raw), {year}',
            '%',
            'percent',
            'Natural Resources Canada',
            '',
        ))

    n = processor.replace_raw_data(SOURCE_KEY, data_rows, metadata_rows)
    print(f'    Stored {n} source-native rows for {SOURCE_KEY}')
    return n


def transform_world_wind_power(processor) -> int:
    data_rows, metadata_rows = _build_indicator_rows(processor.config)
    n = processor.store_indicators(SOURCE_KEY, data_rows, metadata_rows)
    print(f'    Stored {n} indicator rows for {SOURCE_KEY}')
    return n
