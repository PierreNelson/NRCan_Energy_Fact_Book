"""World proved reserves of crude oil (ogj_petroleum_world_proved_reserves)."""

from __future__ import annotations

from pathlib import Path
from typing import Dict, List, Optional, Tuple

import pandas as pd

from .constants import (
    WORLD_CRUDE_RES_COUNTRY_KEYS,
    WORLD_CRUDE_RES_COUNTRY_MAP,
    WORLD_CRUDE_RES_CRUDE_SHEET,
    WORLD_CRUDE_RES_CRUDE_SHEET_ALIASES,
    WORLD_CRUDE_RES_METADATA,
    WORLD_CRUDE_RES_METRICS_SHEET,
    WORLD_CRUDE_RES_METRICS_SHEET_ALIASES,
    WORLD_CRUDE_RES_METRIC_MAP,
    WORLD_CRUDE_RES_OIL_SANDS_METRIC,
    WORLD_CRUDE_RES_SEED_CRUDE_ROWS,
    WORLD_CRUDE_RES_SEED_METRICS_ROWS,
)
from .petroleum_reserves import _workbook_path, ensure_petroleum_reserves_seed_workbook

SOURCE_KEY = 'world_proved_crude_reserves'

REPORTING_YEAR_VECTOR = 'wr_crude_res_reporting_year'
TOTAL_BB_VECTOR = 'wr_crude_res_total_bb'
OIL_SANDS_SHARE_VECTOR = 'wr_crude_res_oil_sands_share_pct'


def _bb_vector(country: str) -> str:
    return f'wr_crude_res_{country}_bb'


def _pct_vector(country: str) -> str:
    return f'wr_crude_res_{country}_pct'


def _read_crude_sheet(path: Path) -> pd.DataFrame:
    xl = pd.ExcelFile(path)
    for sheet_name in WORLD_CRUDE_RES_CRUDE_SHEET_ALIASES:
        if sheet_name in xl.sheet_names:
            return pd.read_excel(path, sheet_name=sheet_name)
    raise ValueError(
        f'No world crude proved reserves sheet found in {path.name}; '
        f'expected one of: {", ".join(WORLD_CRUDE_RES_CRUDE_SHEET_ALIASES)}'
    )


def _read_metrics_sheet(path: Path) -> pd.DataFrame:
    xl = pd.ExcelFile(path)
    for sheet_name in WORLD_CRUDE_RES_METRICS_SHEET_ALIASES:
        if sheet_name in xl.sheet_names:
            return pd.read_excel(path, sheet_name=sheet_name)
    raise ValueError(
        f'No proved reserves metrics sheet found in {path.name}; '
        f'expected one of: {", ".join(WORLD_CRUDE_RES_METRICS_SHEET_ALIASES)}'
    )


def ensure_world_proved_crude_reserves_sheets(path: Optional[Path] = None) -> Path:
    """Ensure proved_reserves_crude_oil and proved_reserves_metrics exist in the petroleum workbook."""
    target = path or _workbook_path()
    if not target.is_file():
        target = ensure_petroleum_reserves_seed_workbook(target)

    needs_crude = True
    needs_metrics = True
    try:
        xl = pd.ExcelFile(target)
        needs_crude = not any(name in xl.sheet_names for name in WORLD_CRUDE_RES_CRUDE_SHEET_ALIASES)
        needs_metrics = not any(name in xl.sheet_names for name in WORLD_CRUDE_RES_METRICS_SHEET_ALIASES)
    except Exception:
        pass

    if not needs_crude and not needs_metrics:
        return target

    mode = 'a' if target.is_file() else 'w'
    with pd.ExcelWriter(target, engine='openpyxl', mode=mode, if_sheet_exists='replace') as writer:
        if needs_crude:
            pd.DataFrame(WORLD_CRUDE_RES_SEED_CRUDE_ROWS).to_excel(
                writer, sheet_name=WORLD_CRUDE_RES_CRUDE_SHEET, index=False
            )
        if needs_metrics:
            pd.DataFrame(WORLD_CRUDE_RES_SEED_METRICS_ROWS).to_excel(
                writer, sheet_name=WORLD_CRUDE_RES_METRICS_SHEET, index=False
            )
    print(f'    Added world proved crude reserves sheet(s) to workbook: {target}')
    return target


def _normalize_country(value: str) -> str:
    key = str(value).strip().lower()
    return WORLD_CRUDE_RES_COUNTRY_MAP.get(key, key.replace(' ', '_'))


def _normalize_metric(value: str) -> str:
    key = str(value).strip().lower().replace('-', '_').replace(' ', '_')
    return WORLD_CRUDE_RES_METRIC_MAP.get(key, key)


def _normalize_crude_sheet(df: pd.DataFrame) -> pd.DataFrame:
    cols = {str(c).strip().lower(): c for c in df.columns}
    rename = {}
    for key in ('reporting_year', 'country_category', 'value_bb'):
        if key in cols:
            rename[cols[key]] = key
    out = df.rename(columns=rename)
    required = ['reporting_year', 'country_category', 'value_bb']
    missing = [c for c in required if c not in out.columns]
    if missing:
        raise ValueError(f'{WORLD_CRUDE_RES_CRUDE_SHEET} missing columns: {missing}')

    out['reporting_year'] = pd.to_numeric(out['reporting_year'], errors='coerce').astype('Int64')
    out['value_bb'] = pd.to_numeric(out['value_bb'], errors='coerce')
    out['country_category'] = out['country_category'].map(_normalize_country)
    return out.dropna(subset=['reporting_year', 'value_bb']).sort_values(
        ['reporting_year', 'country_category']
    )


def _normalize_metrics_sheet(df: pd.DataFrame) -> pd.DataFrame:
    cols = {str(c).strip().lower(): c for c in df.columns}
    rename = {}
    for key in ('reporting_year', 'metric', 'value'):
        if key in cols:
            rename[cols[key]] = key
    out = df.rename(columns=rename)
    required = ['reporting_year', 'metric', 'value']
    missing = [c for c in required if c not in out.columns]
    if missing:
        raise ValueError(f'{WORLD_CRUDE_RES_METRICS_SHEET} missing columns: {missing}')

    out['reporting_year'] = pd.to_numeric(out['reporting_year'], errors='coerce').astype('Int64')
    out['value'] = pd.to_numeric(out['value'], errors='coerce')
    out['metric'] = out['metric'].map(_normalize_metric)
    return out.dropna(subset=['reporting_year', 'value']).sort_values(['reporting_year', 'metric'])


def _latest_year(crude_df: pd.DataFrame, metrics_df: pd.DataFrame) -> int:
    years = []
    if not crude_df.empty:
        years.append(int(crude_df['reporting_year'].max()))
    if not metrics_df.empty:
        years.append(int(metrics_df['reporting_year'].max()))
    if not years:
        raise ValueError('No reporting years found in world proved crude reserves sheets')
    return max(years)


def build_world_proved_crude_reserves_raw_rows(config=None) -> List[Tuple[str, str, float]]:
    path = ensure_world_proved_crude_reserves_sheets(_workbook_path(config))
    print(f'    Using workbook: {path}')
    crude_df = _normalize_crude_sheet(_read_crude_sheet(path))
    metrics_df = _normalize_metrics_sheet(_read_metrics_sheet(path))
    if crude_df.empty:
        return []

    year = _latest_year(crude_df, metrics_df)
    year_key = str(year)
    year_df = crude_df[crude_df['reporting_year'] == year]
    rows: List[Tuple[str, str, float]] = []

    country_values: Dict[str, float] = {}
    for _, row in year_df.iterrows():
        country = row['country_category']
        if country not in WORLD_CRUDE_RES_COUNTRY_KEYS:
            continue
        country_values[country] = float(row['value_bb'])

    total_bb = sum(country_values.values())
    if total_bb <= 0:
        return []

    rows.append((TOTAL_BB_VECTOR, year_key, total_bb))
    rows.append((REPORTING_YEAR_VECTOR, year_key, float(year)))

    for country in WORLD_CRUDE_RES_COUNTRY_KEYS:
        value_bb = country_values.get(country, 0.0)
        share_pct = round(value_bb / total_bb * 100, 1) if total_bb else 0.0
        rows.append((_bb_vector(country), year_key, value_bb))
        rows.append((_pct_vector(country), year_key, share_pct))

    metrics_year = metrics_df[metrics_df['reporting_year'] == year]
    oil_sands = metrics_year[metrics_year['metric'] == WORLD_CRUDE_RES_OIL_SANDS_METRIC]
    if not oil_sands.empty:
        rows.append((OIL_SANDS_SHARE_VECTOR, year_key, float(oil_sands.iloc[0]['value'])))

    return rows


def update_world_proved_crude_reserves(processor) -> int:
    print('  Loading world proved crude oil reserves...')
    rows = build_world_proved_crude_reserves_raw_rows(processor.config)
    if not rows:
        print('    WARNING: no world proved crude reserves rows produced')
        return 0
    print(f'    Prepared {len(rows)} world proved crude reserves data points')
    return processor.replace_raw_data(SOURCE_KEY, rows, list(WORLD_CRUDE_RES_METADATA))


def transform_world_proved_crude_reserves(processor) -> int:
    df = processor.get_raw_dataframe(SOURCE_KEY)
    if df.empty:
        print('    world_proved_crude_reserves transform: no raw rows found — re-run eedas update')
        return 0

    data_rows: List[Tuple[str, str, float]] = []
    for _, row in df.iterrows():
        vector = str(row['vector'])
        if not vector.startswith('wr_crude_res_'):
            continue
        try:
            value = float(row['value'])
        except (TypeError, ValueError):
            continue
        data_rows.append((vector, str(row['ref_date']), value))

    if not data_rows:
        print('    world_proved_crude_reserves transform: no indicator rows produced')
        return 0

    n = processor.store_indicators(SOURCE_KEY, data_rows, WORLD_CRUDE_RES_METADATA)
    print(f'    Stored {n} indicator rows for world_proved_crude_reserves')
    return n
