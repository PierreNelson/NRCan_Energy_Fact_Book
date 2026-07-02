"""Petroleum sector employment by region (statcan_petroleum_sector_employment_summary)."""

from __future__ import annotations

from pathlib import Path
from typing import Dict, List, Optional, Tuple

import pandas as pd

from .constants import (
    PETROLEUM_EMPLOYMENT_METADATA,
    PETROLEUM_EMPLOYMENT_SEED_ROWS,
    PETROLEUM_EMPLOYMENT_SHEET,
    PETROLEUM_EMPLOYMENT_SHEET_ALIASES,
    PETROLEUM_EMP_REGION_KEYS,
    PETROLEUM_EMP_REGION_MAP,
)
from .petroleum_reserves import _workbook_path, ensure_petroleum_reserves_seed_workbook

SOURCE_KEY = 'petroleum_sector_employment'

REPORTING_YEAR_VECTOR = 'pet_emp_reporting_year'
DIRECT_TOTAL_VECTOR = 'pet_emp_direct_total'
INDIRECT_TOTAL_VECTOR = 'pet_emp_indirect_total'


def _share_vector(region: str, metric: str) -> str:
    return f'pet_emp_{region}_{metric}_pct'


def _read_employment_sheet(path: Path) -> pd.DataFrame:
    xl = pd.ExcelFile(path)
    for sheet_name in PETROLEUM_EMPLOYMENT_SHEET_ALIASES:
        if sheet_name in xl.sheet_names:
            return pd.read_excel(path, sheet_name=sheet_name)
    raise ValueError(
        f'No petroleum employment sheet found in {path.name}; '
        f'expected one of: {", ".join(PETROLEUM_EMPLOYMENT_SHEET_ALIASES)}'
    )


def ensure_petroleum_employment_sheet(path: Optional[Path] = None) -> Path:
    """Ensure petroleum_sector_employment exists in the petroleum workbook."""
    target = path or _workbook_path()
    if not target.is_file():
        target = ensure_petroleum_reserves_seed_workbook(target)

    try:
        xl = pd.ExcelFile(target)
        if any(name in xl.sheet_names for name in PETROLEUM_EMPLOYMENT_SHEET_ALIASES):
            return target
    except Exception:
        pass

    seed_df = pd.DataFrame(PETROLEUM_EMPLOYMENT_SEED_ROWS)
    with pd.ExcelWriter(target, engine='openpyxl', mode='a', if_sheet_exists='replace') as writer:
        seed_df.to_excel(writer, sheet_name=PETROLEUM_EMPLOYMENT_SHEET, index=False)
    print(f'    Added employment sheet to workbook: {target}')
    return target


def _normalize_metric(value: str) -> str:
    key = str(value).strip().lower().replace('-', '_').replace(' ', '_')
    aliases = {
        'direct_employment': 'direct',
        'indirect_employment': 'indirect',
        'direct_emp': 'direct',
        'indirect_emp': 'indirect',
        'direct_total_jobs': 'direct_total',
        'indirect_total_jobs': 'indirect_total',
    }
    return aliases.get(key, key)


def _normalize_region(value: str) -> str:
    key = str(value).strip().lower()
    return PETROLEUM_EMP_REGION_MAP.get(key, key)


def _normalize_employment_sheet(df: pd.DataFrame) -> pd.DataFrame:
    cols = {str(c).strip().lower(): c for c in df.columns}
    rename = {}
    for key in ('reporting_year', 'metric', 'province_territory', 'value'):
        if key in cols:
            rename[cols[key]] = key
    out = df.rename(columns=rename)
    required = ['reporting_year', 'metric', 'province_territory', 'value']
    missing = [c for c in required if c not in out.columns]
    if missing:
        raise ValueError(f'{PETROLEUM_EMPLOYMENT_SHEET} missing columns: {missing}')

    out['reporting_year'] = pd.to_numeric(out['reporting_year'], errors='coerce').astype('Int64')
    out['value'] = pd.to_numeric(out['value'], errors='coerce')
    out['metric'] = out['metric'].map(_normalize_metric)
    out['province_territory'] = out['province_territory'].map(_normalize_region)
    return out.dropna(subset=['reporting_year', 'value']).sort_values(
        ['reporting_year', 'metric', 'province_territory']
    )


def _latest_year(df: pd.DataFrame) -> int:
    return int(df['reporting_year'].max())


def build_petroleum_sector_employment_raw_rows(config=None) -> List[Tuple[str, str, float]]:
    path = ensure_petroleum_employment_sheet(_workbook_path(config))
    print(f'    Using workbook: {path}')
    df = _read_employment_sheet(path)
    df = _normalize_employment_sheet(df)
    if df.empty:
        return []

    year = _latest_year(df)
    year_df = df[df['reporting_year'] == year]
    year_key = str(year)
    rows: List[Tuple[str, str, float]] = []

    shares = year_df[year_df['metric'].isin(['direct', 'indirect'])]
    for _, row in shares.iterrows():
        region = row['province_territory']
        if region not in PETROLEUM_EMP_REGION_KEYS:
            continue
        metric = row['metric']
        rows.append((_share_vector(region, metric), year_key, float(row['value'])))

    totals = year_df[year_df['metric'].isin(['direct_total', 'indirect_total'])]
    for _, row in totals.iterrows():
        metric = row['metric']
        vector = DIRECT_TOTAL_VECTOR if metric == 'direct_total' else INDIRECT_TOTAL_VECTOR
        rows.append((vector, year_key, float(row['value'])))

    rows.append((REPORTING_YEAR_VECTOR, year_key, float(year)))
    return rows


def build_petroleum_sector_employment_indicator_rows(
    config=None,
) -> Tuple[List[Tuple[str, str, float]], List[Tuple[str, str, str, str, str, str]]]:
    raw_rows = build_petroleum_sector_employment_raw_rows(config)
    return raw_rows, list(PETROLEUM_EMPLOYMENT_METADATA)


def update_petroleum_sector_employment(processor) -> int:
    print('  Loading petroleum sector employment summary...')
    rows = build_petroleum_sector_employment_raw_rows(processor.config)
    if not rows:
        print('    WARNING: no petroleum sector employment rows produced')
        return 0
    print(f'    Prepared {len(rows)} petroleum sector employment data points')
    return processor.replace_raw_data(SOURCE_KEY, rows, list(PETROLEUM_EMPLOYMENT_METADATA))


def transform_petroleum_sector_employment(processor) -> int:
    df = processor.get_raw_dataframe(SOURCE_KEY)
    if df.empty:
        print('    petroleum_sector_employment transform: no raw rows found — re-run eedas update')
        return 0

    data_rows: List[Tuple[str, str, float]] = []
    for _, row in df.iterrows():
        vector = str(row['vector'])
        if not vector.startswith('pet_emp_'):
            continue
        try:
            value = float(row['value'])
        except (TypeError, ValueError):
            continue
        data_rows.append((vector, str(row['ref_date']), value))

    if not data_rows:
        print('    petroleum_sector_employment transform: no indicator rows produced')
        return 0

    n = processor.store_indicators(SOURCE_KEY, data_rows, PETROLEUM_EMPLOYMENT_METADATA)
    print(f'    Stored {n} indicator rows for petroleum_sector_employment')
    return n
