"""GHG spotlight: electricity (ECCC environmental indicators + gencap coal_elegen)."""

from __future__ import annotations

import io
import re
from typing import Dict, List, Optional, Tuple

import pandas as pd

from utils.http_retry import fetch_get, resilience_from_config
from utils.io_retry import ensure_workbook, read_excel_with_retry, resolve_sheet_name, run_with_retry

from .constants import (
    GHG_ELECTRICITY_COAL_ELEGEN_SHEET,
    GHG_ELECTRICITY_COAL_ELEGEN_XLSX,
    GHG_ELECTRICITY_CSV_DEFAULT,
    GHG_ELECTRICITY_INDICATORS_PAGE,
    GHG_ELECTRICITY_METADATA,
    GHG_ELECTRICITY_MIN_YEAR,
    GHG_ELECTRICITY_NARRATIVE_BASE_YEAR,
    GHG_ELECTRICITY_SOURCE_ORG,
    GHG_ELECTRICITY_SOURCE_URL,
    GHG_ELECTRICITY_STAT_METADATA,
)

SOURCE_KEY = 'ghg_electricity_spotlight'
RAW_PREFIX = 'elec_ghg_raw'

GHG_ELECTRICITY_CSV_PATTERN = re.compile(
    r'content/dam/eccc/documents/csv/cesindicators/ghg-emissions/\d+/ghg-emissions-electricity-en\.csv',
    re.I,
)


def _normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df.columns = [re.sub(r"^['\"]|['\"]$", '', str(c).strip()) for c in df.columns]
    return df


def _parse_mt(value) -> Optional[float]:
    if pd.isna(value):
        return None
    if isinstance(value, str):
        stripped = value.strip()
        if stripped in ('', '-', '–', '—', 'n/a', 'na'):
            return None
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None
    if parsed < 0:
        return None
    return parsed


def _discover_electricity_csv_url(config=None) -> str:
    max_retries, retry_delay = resilience_from_config(config)
    response = fetch_get(
        GHG_ELECTRICITY_INDICATORS_PAGE,
        timeout=60,
        max_retries=max_retries,
        retry_delay_seconds=retry_delay,
        label='GHG electricity indicators page',
    )
    matches = GHG_ELECTRICITY_CSV_PATTERN.findall(response.text)
    if not matches:
        raise ValueError(
            'ghg_electricity_spotlight: could not discover electricity CSV URL on indicators page'
        )
    return f'https://www.canada.ca/{matches[-1]}'


def _resolve_electricity_csv_url(config=None) -> str:
    if config is not None:
        try:
            sec = config.sections.get('section5_indicators', {})
            src = sec.get('sources', {}).get(SOURCE_KEY, {})
            configured = src.get('source_url') or src.get('csv_url')
            if configured:
                return configured
        except Exception:
            pass
    return GHG_ELECTRICITY_CSV_DEFAULT


def _fetch_electricity_csv(config=None) -> Tuple[bytes, str]:
    max_retries, retry_delay = resilience_from_config(config)
    urls = [_resolve_electricity_csv_url(config)]
    if urls[0] != GHG_ELECTRICITY_CSV_DEFAULT:
        urls.append(GHG_ELECTRICITY_CSV_DEFAULT)
    urls.append(None)  # discover from page

    last_error: Optional[Exception] = None
    for url in urls:
        try:
            resolved = _discover_electricity_csv_url(config) if url is None else url
            response = fetch_get(
                resolved,
                timeout=60,
                max_retries=max_retries,
                retry_delay_seconds=retry_delay,
                label='GHG electricity CSV',
            )
            content = response.content
            if not content or content[:15].lstrip().startswith(b'<!doctype'):
                raise ValueError('Response is HTML, not CSV')
            if b'Year' not in content[:800]:
                raise ValueError('Response does not look like electricity GHG CSV')
            print(f'    Downloaded electricity GHG CSV ({len(content):,} bytes) from {resolved}')
            return content, resolved
        except Exception as exc:
            last_error = exc
            print(f'    Warning: electricity GHG CSV fetch failed for {url or "discovered URL"}: {exc}')
    raise RuntimeError(f'ghg_electricity_spotlight: could not download electricity GHG CSV: {last_error}')


def _parse_electricity_csv(content: bytes) -> pd.DataFrame:
    raw = pd.read_csv(io.BytesIO(content), header=None)
    header_idx = None
    for idx, row in raw.iterrows():
        first = str(row.iloc[0]).strip().lower()
        if first == 'year':
            header_idx = idx
            break
    if header_idx is None:
        raise ValueError('ghg_electricity_spotlight: Year header row not found in electricity GHG CSV')

    df = pd.read_csv(io.BytesIO(content), header=header_idx)
    df = _normalize_columns(df)
    col_map = {str(c).lower(): c for c in df.columns}
    year_col = col_map.get('year')
    coal_col = next((c for k, c in col_map.items() if k.startswith('coal')), None)
    gas_col = next((c for k, c in col_map.items() if 'natural gas' in k), None)
    other_col = next((c for k, c in col_map.items() if k.startswith('other')), None)
    missing = [name for name, col in [('year', year_col), ('coal', coal_col), ('natural gas', gas_col), ('other', other_col)] if not col]
    if missing:
        raise ValueError(f'ghg_electricity_spotlight: missing columns {missing} in electricity GHG CSV')

    rows: List[Tuple[int, float, float, float]] = []
    for _, record in df.iterrows():
        try:
            year = int(float(record[year_col]))
        except (TypeError, ValueError):
            continue
        if year < GHG_ELECTRICITY_MIN_YEAR:
            continue
        coal = _parse_mt(record[coal_col])
        gas = _parse_mt(record[gas_col])
        other = _parse_mt(record[other_col])
        if coal is None or gas is None or other is None:
            continue
        rows.append((year, coal, gas, other))

    if not rows:
        raise ValueError('ghg_electricity_spotlight: no publishable year rows in electricity GHG CSV')

    return pd.DataFrame(rows, columns=['year', 'coal', 'natural_gas', 'other']).sort_values('year')


def _read_coal_generation_share(reference_year: int, config=None) -> float:
    def _load() -> float:
        path = ensure_workbook(GHG_ELECTRICITY_COAL_ELEGEN_XLSX, config=config)
        sheet = resolve_sheet_name(
            path,
            GHG_ELECTRICITY_COAL_ELEGEN_SHEET,
            label='ghg_electricity_spotlight coal_elegen',
        )
        df = _normalize_columns(
            read_excel_with_retry(
                path,
                sheet,
                config=config,
                label=f'{GHG_ELECTRICITY_COAL_ELEGEN_XLSX} {sheet!r}',
                header=0,
            )
        )
        col_map = {str(c).lower().strip(): c for c in df.columns}
        required = ['year', 'share']
        missing = [name for name in required if name not in col_map]
        if missing:
            raise ValueError(
                f'ghg_electricity_spotlight: missing columns {missing} in coal_elegen sheet'
            )
        year_col = col_map['year']
        share_col = col_map['share']
        match = df[pd.to_numeric(df[year_col], errors='coerce') == reference_year]
        if match.empty:
            raise ValueError(
                f'ghg_electricity_spotlight: no coal_elegen share row for reference year {reference_year}'
            )
        share = _parse_mt(match.iloc[0][share_col])
        if share is None:
            raise ValueError(
                f'ghg_electricity_spotlight: invalid coal_elegen share for reference year {reference_year}'
            )
        return share

    return run_with_retry(
        _load,
        config=config,
        label=f'{GHG_ELECTRICITY_COAL_ELEGEN_XLSX} coal generation share load',
    )


def _pct_change(base: float, end: float) -> int:
    return round((end - base) / base * 100)


def _raw_by_year_from_dataframe(df: pd.DataFrame) -> Tuple[Dict[str, Dict[str, float]], Optional[float]]:
    raw_by_year: Dict[str, Dict[str, float]] = {}
    coal_gen_share: Optional[float] = None
    for _, row in df.iterrows():
        vector = str(row['vector'])
        if not vector.startswith(f'{RAW_PREFIX}_'):
            continue
        suffix = vector[len(RAW_PREFIX) + 1:]
        year_key = str(row['ref_date'])
        try:
            value = float(row['value'])
        except (TypeError, ValueError):
            continue
        if suffix == 'coal_gen_share':
            coal_gen_share = value
            continue
        raw_by_year.setdefault(year_key, {})[suffix] = value
    return raw_by_year, coal_gen_share


def _transform_indicator_rows_from_raw(
    raw_by_year: Dict[str, Dict[str, float]],
    coal_gen_share: Optional[float],
    source_url: str = GHG_ELECTRICITY_SOURCE_URL,
) -> Tuple[List[Tuple[str, str, float]], List[Tuple[str, str, str, str, str, str]]]:
    if not raw_by_year:
        raise ValueError('ghg_electricity_spotlight transform: no emission raw rows found')
    if coal_gen_share is None:
        raise ValueError('ghg_electricity_spotlight transform: missing coal generation share raw row')

    reference_year = max(int(year) for year in raw_by_year.keys())
    base_key = str(GHG_ELECTRICITY_NARRATIVE_BASE_YEAR)
    ref_key = str(reference_year)
    if base_key not in raw_by_year:
        raise ValueError(
            f'ghg_electricity_spotlight transform: missing base year {GHG_ELECTRICITY_NARRATIVE_BASE_YEAR}'
        )
    if ref_key not in raw_by_year:
        raise ValueError(f'ghg_electricity_spotlight transform: missing reference year {reference_year}')

    data_rows: List[Tuple[str, str, float]] = []
    metadata_rows: List[Tuple[str, str, str, str, str, str]] = []

    for year_key in sorted(raw_by_year.keys(), key=int):
        raw = raw_by_year[year_key]
        coal = round(float(raw.get('coal', 0.0)), 1)
        gas = round(float(raw.get('natural_gas', 0.0)), 1)
        other = round(float(raw.get('other', 0.0)), 1)
        total = round(coal + gas + other, 1)
        for key, value in (
            ('coal', coal),
            ('natural_gas', gas),
            ('other', other),
            ('total', total),
        ):
            vector = f'elec_ghg_{key}'
            data_rows.append((vector, year_key, value))
            title = next(item[1] for item in GHG_ELECTRICITY_METADATA if item[0] == vector)
            metadata_rows.append((vector, title, 'Mt CO2 eq', 'megatonnes', GHG_ELECTRICITY_SOURCE_ORG, source_url))

    base_raw = raw_by_year[base_key]
    ref_raw = raw_by_year[ref_key]
    base_total = float(base_raw.get('coal', 0.0) + base_raw.get('natural_gas', 0.0) + base_raw.get('other', 0.0))
    ref_total = float(ref_raw.get('coal', 0.0) + ref_raw.get('natural_gas', 0.0) + ref_raw.get('other', 0.0))
    ref_coal = float(ref_raw.get('coal', 0.0))

    stat_values = {
        'elec_ghg_stat_base_year': float(GHG_ELECTRICITY_NARRATIVE_BASE_YEAR),
        'elec_ghg_stat_reference_year': float(reference_year),
        'elec_ghg_stat_total_pct_change': float(_pct_change(base_total, ref_total)),
        'elec_ghg_stat_coal_gen_share_pct': round(coal_gen_share * 100),
        'elec_ghg_stat_coal_ghg_share_pct': round(ref_coal / ref_total * 100),
    }
    for vector, value in stat_values.items():
        data_rows.append((vector, ref_key, value))
        title, uom, scalar = next(item[1:] for item in GHG_ELECTRICITY_STAT_METADATA if item[0] == vector)
        metadata_rows.append((vector, title, uom, scalar, GHG_ELECTRICITY_SOURCE_ORG, source_url))

    return data_rows, metadata_rows


def _build_indicator_rows(
    config=None,
) -> Tuple[List[Tuple[str, str, float]], List[Tuple[str, str, str, str, str, str]], str]:
    content, source_url = _fetch_electricity_csv(config)
    emissions = _parse_electricity_csv(content)
    reference_year = int(emissions['year'].max())
    coal_gen_share = _read_coal_generation_share(reference_year, config)

    raw_by_year: Dict[str, Dict[str, float]] = {}
    for _, row in emissions.iterrows():
        year_key = str(int(row['year']))
        raw_by_year[year_key] = {
            'coal': round(float(row['coal']), 4),
            'natural_gas': round(float(row['natural_gas']), 4),
            'other': round(float(row['other']), 4),
        }

    data_rows, metadata_rows = _transform_indicator_rows_from_raw(
        raw_by_year,
        coal_gen_share,
        source_url=source_url,
    )
    return data_rows, metadata_rows, source_url


def update_ghg_electricity_spotlight(processor) -> int:
    """EEDAS ingest: ECCC electricity GHG CSV + gencap coal_elegen share."""
    content, source_url = _fetch_electricity_csv(processor.config)
    emissions = _parse_electricity_csv(content)
    reference_year = int(emissions['year'].max())
    coal_gen_share = _read_coal_generation_share(reference_year, processor.config)

    data_rows: List[Tuple[str, str, float]] = []
    metadata_rows: List[Tuple[str, str, str, str, str, str]] = []

    for _, row in emissions.iterrows():
        year = int(row['year'])
        for key in ('coal', 'natural_gas', 'other'):
            vector = f'{RAW_PREFIX}_{key}'
            value = round(float(row[key]), 4)
            data_rows.append((vector, str(year), value))
            metadata_rows.append((
                vector,
                f'Electricity GHG raw {key}, {year}',
                'Mt CO2 eq',
                'megatonnes',
                GHG_ELECTRICITY_SOURCE_ORG,
                source_url,
            ))

    data_rows.append((f'{RAW_PREFIX}_coal_gen_share', str(reference_year), round(coal_gen_share, 6)))
    metadata_rows.append((
        f'{RAW_PREFIX}_coal_gen_share',
        f'Coal electricity generation share, {reference_year}',
        'Share',
        'share',
        'Natural Resources Canada',
        '',
    ))

    n = processor.replace_raw_data(SOURCE_KEY, data_rows, metadata_rows)
    print(f'    Stored {n} source-native rows for {SOURCE_KEY} ({reference_year})')
    return n


def transform_ghg_electricity_spotlight(processor) -> int:
    """EFB transform: elec_ghg_* vectors for this indicator from stored ECCC + gencap raw rows."""
    df = processor.get_raw_dataframe(SOURCE_KEY)
    if df.empty:
        raise RuntimeError('ghg_electricity_spotlight transform: no raw rows found — re-run eedas update')

    raw_by_year, coal_gen_share = _raw_by_year_from_dataframe(df)
    data_rows, metadata_rows = _transform_indicator_rows_from_raw(raw_by_year, coal_gen_share)
    n = processor.store_indicators(SOURCE_KEY, data_rows, metadata_rows)
    print(f'    Stored {n} indicator rows for {SOURCE_KEY}')
    return n


def build_ghg_electricity_spotlight_indicator_rows(
    config=None,
) -> Tuple[List[Tuple[str, str, float]], List[Tuple[str, str, str, str, str, str]]]:
    """Build indicator rows without SQL (offline export / tests)."""
    data_rows, metadata_rows, _ = _build_indicator_rows(config)
    return data_rows, metadata_rows
