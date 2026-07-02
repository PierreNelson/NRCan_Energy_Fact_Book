"""Uranium international context (world exports, production, recoverable resources)."""

from __future__ import annotations

import io
import re
from typing import Dict, List, Optional, Tuple

import pandas as pd

from config_loader import get_config
from utils.http_retry import fetch_get, resilience_from_config
from utils.io_retry import ensure_workbook, read_excel_with_retry, run_with_retry

from .constants import (
    REDBOOK_XLSX,
    URANIUM_COUNTRY_IDS,
    URANIUM_EXPORT_MULTIPLIERS,
    URANIUM_INTERNATIONAL_METADATA,
    URANIUM_REDBOOK_LOCATION_TO_KEY,
    URANIUM_WNA_NAME_TO_KEY,
    WNA_URANIUM_PRODUCTION_URL,
)

SOURCE_KEY = 'uranium_international'
RAW_PREFIX = 'raw_urani'


def _parse_numeric(value) -> Optional[float]:
    if pd.isna(value):
        return None
    if isinstance(value, str):
        stripped = value.strip().replace('%', '')
        if stripped in ('', '-', '–', '—'):
            return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _normalize_country_name(value) -> str:
    text = re.sub(r'\s*\(est\.\)\s*', '', str(value), flags=re.IGNORECASE).strip().lower()
    return re.sub(r'\s+', ' ', text)


def _country_key_from_name(name: str, mapping: Dict[str, str]) -> Optional[str]:
    normalized = _normalize_country_name(name)
    if not normalized or 'world' in normalized or '%' in normalized:
        return None
    return mapping.get(normalized)


def _country_id(country_key: str) -> float:
    country_id = URANIUM_COUNTRY_IDS.get(country_key)
    if country_id is None:
        raise ValueError(f'uranium_international: missing country id for {country_key!r}')
    return float(country_id)


def _fetch_wna_production_table(config=None) -> pd.DataFrame:
    cfg = config or get_config()
    max_r, delay = resilience_from_config(cfg)

    def _load() -> pd.DataFrame:
        headers = {
            'User-Agent': (
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
                '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            ),
            'Accept': '*/*',
        }
        response = fetch_get(
            WNA_URANIUM_PRODUCTION_URL,
            timeout=120,
            headers=headers,
            max_retries=max_r,
            retry_delay_seconds=delay,
            label='WNA uranium production',
        )
        if response.status_code != 200:
            raise RuntimeError(f'uranium_international: HTTP {response.status_code} fetching WNA table')
        tables = pd.read_html(io.StringIO(response.text))
        if not tables:
            raise RuntimeError('uranium_international: no HTML tables found on WNA page')
        return tables[0]

    return run_with_retry(_load, label='WNA uranium production table')


def _production_by_year(df: pd.DataFrame) -> Dict[int, Dict[str, float]]:
    year_cols = [col for col in df.columns if str(col).isdigit()]
    if not year_cols:
        raise ValueError('uranium_international: no year columns in WNA table')

    by_year: Dict[int, Dict[str, float]] = {}
    for year_col in year_cols:
        year = int(year_col)
        values: Dict[str, float] = {}
        for _, record in df.iterrows():
            country_key = _country_key_from_name(record.get('Country', ''), URANIUM_WNA_NAME_TO_KEY)
            if not country_key:
                continue
            tonnes = _parse_numeric(record.get(year_col))
            if tonnes is None or tonnes <= 0:
                continue
            values[country_key] = values.get(country_key, 0.0) + tonnes
        if values:
            by_year[year] = values
    if not by_year:
        raise ValueError('uranium_international: no production values parsed from WNA table')
    return by_year


def _rank_top_five(
    values: Dict[str, float],
    total: float,
) -> Tuple[List[Tuple[str, int, int]], Optional[int], Optional[int]]:
    ranked = sorted(values.items(), key=lambda item: item[1], reverse=True)
    top5: List[Tuple[str, int, int]] = []
    for rank_idx, (country_key, amount) in enumerate(ranked[:5], start=1):
        share_pct = round(100 * amount / total) if total > 0 else 0
        top5.append((country_key, share_pct, rank_idx))

    canada_rank = next((index + 1 for index, (key, _) in enumerate(ranked) if key == 'canada'), None)
    canada_share = round(100 * values.get('canada', 0.0) / total) if total > 0 and 'canada' in values else None
    return top5, canada_share, canada_rank


def _append_ranking_rows(
    data_rows: List[Tuple[str, str, float]],
    prefix: str,
    year_key: str,
    total_value: float,
    total_suffix: str,
    top5: List[Tuple[str, int, int]],
    canada_share: Optional[int],
    canada_rank: Optional[int],
) -> None:
    data_rows.append((f'{RAW_PREFIX}_{prefix}_total_{total_suffix}', year_key, total_value))
    for rank_idx, (country_key, share_pct, _) in enumerate(top5, start=1):
        data_rows.append((f'{RAW_PREFIX}_{prefix}_top{rank_idx}_share_pct', year_key, float(share_pct)))
        data_rows.append((f'{RAW_PREFIX}_{prefix}_top{rank_idx}_country_id', year_key, _country_id(country_key)))
    if canada_share is not None:
        data_rows.append((f'{RAW_PREFIX}_{prefix}_canada_share_pct', year_key, float(canada_share)))
    if canada_rank is not None:
        data_rows.append((f'{RAW_PREFIX}_{prefix}_canada_rank', year_key, float(canada_rank)))


def _build_production_rows(production_by_year: Dict[int, Dict[str, float]]) -> List[Tuple[str, str, float]]:
    data_rows: List[Tuple[str, str, float]] = []
    for year, values in sorted(production_by_year.items()):
        total_tu = sum(values.values())
        if total_tu <= 0:
            continue
        total_kt = round(total_tu / 1000, 1)
        top5, canada_share, canada_rank = _rank_top_five(values, total_tu)
        _append_ranking_rows(data_rows, 'prod', str(year), total_kt, 'kt', top5, canada_share, canada_rank)
    return data_rows


def _build_export_rows(production_by_year: Dict[int, Dict[str, float]]) -> List[Tuple[str, str, float]]:
    data_rows: List[Tuple[str, str, float]] = []
    for year, production in sorted(production_by_year.items()):
        export_values = {
            country_key: production.get(country_key, 0.0) * multiplier
            for country_key, multiplier in URANIUM_EXPORT_MULTIPLIERS.items()
        }
        total_tu = sum(export_values.values())
        if total_tu <= 0:
            continue
        total_kt = round(total_tu / 1000, 1)
        top5, canada_share, canada_rank = _rank_top_five(export_values, total_tu)
        _append_ranking_rows(data_rows, 'exp', str(year), total_kt, 'kt', top5, canada_share, canada_rank)
    return data_rows


def _read_redbook_resources_by_year(config=None) -> Dict[int, Dict[str, float]]:
    def _load() -> Dict[int, Dict[str, float]]:
        path = ensure_workbook(REDBOOK_XLSX, config=config)
        df = read_excel_with_retry(path, 'Sheet1', config=config, label=REDBOOK_XLSX, header=0)
        col_map = {str(col).lower().strip(): col for col in df.columns}
        year_col = col_map.get('year')
        loc_col = col_map.get('location')
        value_col = col_map.get('value')
        if not year_col or not loc_col or not value_col:
            raise ValueError(f'uranium_international: missing columns in {path.name}')

        by_year: Dict[int, Dict[str, float]] = {}
        for _, record in df.iterrows():
            year = _parse_numeric(record[year_col])
            if year is None:
                continue
            year_int = int(year)
            location = str(record[loc_col]).strip()
            if location.lower() == 'world':
                by_year.setdefault(year_int, {})['__world__'] = float(record[value_col])
                continue
            country_key = _country_key_from_name(location, URANIUM_REDBOOK_LOCATION_TO_KEY)
            if not country_key:
                continue
            value = _parse_numeric(record[value_col])
            if value is None or value <= 0:
                continue
            bucket = by_year.setdefault(year_int, {})
            bucket[country_key] = bucket.get(country_key, 0.0) + value
        if not by_year:
            raise ValueError('uranium_international: no Red Book resource rows parsed')
        return by_year

    return run_with_retry(_load, label='Red Book uranium resources')


def _build_resource_rows(resources_by_year: Dict[int, Dict[str, float]]) -> List[Tuple[str, str, float]]:
    data_rows: List[Tuple[str, str, float]] = []
    for year, values in sorted(resources_by_year.items()):
        world_total = values.get('__world__')
        country_values = {key: amount for key, amount in values.items() if key != '__world__'}
        if world_total is None or world_total <= 0:
            world_total = sum(country_values.values())
        if world_total <= 0:
            continue
        total_mt = round(world_total / 1_000_000, 1)
        top5, canada_share, canada_rank = _rank_top_five(country_values, world_total)
        _append_ranking_rows(data_rows, 'res', str(year), total_mt, 'mt', top5, canada_share, canada_rank)
    return data_rows


def _build_indicator_rows(config=None) -> Tuple[List[Tuple[str, str, float]], List[Tuple[str, str, str, str, str, str]]]:
    production_df = _fetch_wna_production_table(config)
    production_by_year = _production_by_year(production_df)
    resources_by_year = _read_redbook_resources_by_year(config)

    data_rows: List[Tuple[str, str, float]] = []
    data_rows.extend(_build_production_rows(production_by_year))
    data_rows.extend(_build_export_rows(production_by_year))
    data_rows.extend(_build_resource_rows(resources_by_year))

    if not data_rows:
        raise ValueError('uranium_international: no indicator rows produced')

    return data_rows, list(URANIUM_INTERNATIONAL_METADATA)


def update_uranium_international(processor) -> int:
    data_rows, metadata_rows = _build_indicator_rows(processor.config)
    raw_rows = [(vector, ref_date, value) for vector, ref_date, value in data_rows]
    n = processor.replace_raw_data(SOURCE_KEY, raw_rows, metadata_rows)
    print(f'    Stored {n} source-native rows for {SOURCE_KEY}')
    return n


def transform_uranium_international(processor) -> int:
    df = processor.get_raw_dataframe(SOURCE_KEY)
    if df.empty:
        raise ValueError(
            f'{SOURCE_KEY} transform: no raw rows found — re-run eedas update --source {SOURCE_KEY}'
        )

    data_rows: List[Tuple[str, str, float]] = []
    metadata_rows: List[Tuple[str, str, str, str, str, str]] = list(URANIUM_INTERNATIONAL_METADATA)

    for _, row in df.iterrows():
        vector = str(row['vector'])
        if not vector.startswith(f'{RAW_PREFIX}_'):
            continue
        out_vec = f"urani_{vector[len(RAW_PREFIX) + 1:]}"
        data_rows.append((out_vec, str(row['ref_date']), float(row['value'])))

    if not data_rows:
        raise ValueError(f'{SOURCE_KEY} transform: no indicator rows produced')

    n = processor.store_indicators(SOURCE_KEY, data_rows, metadata_rows)
    print(f'    Stored {n} indicator rows for {SOURCE_KEY}')
    return n
