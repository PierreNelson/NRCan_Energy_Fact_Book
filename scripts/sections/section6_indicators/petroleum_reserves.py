"""Canadian proved reserves of crude oil (petroleum_reserves_summary)."""

from __future__ import annotations

from pathlib import Path
from typing import Dict, List, Optional, Tuple

import pandas as pd

from xlsx_paths import resolve_root_xlsx

from .constants import (
    PETROLEUM_EMP_XLSX,
    PETROLEUM_EMPLOYMENT_SEED_ROWS,
    PETROLEUM_EMPLOYMENT_SHEET,
    PETROLEUM_RESERVES_METADATA,
    PETROLEUM_RESERVES_SEED_DIR,
    PETROLEUM_RESERVES_SUMMARY_SHEET,
)

SOURCE_KEY = 'petroleum_reserves'

RESERVE_COLUMNS = {
    'total_bb': 'cr_res_total_bb',
    'conventional_bb': 'cr_res_conventional_bb',
    'oil_sands_bb': 'cr_res_oil_sands_bb',
    'mining_bb': 'cr_res_mining_bb',
    'insitu_bb': 'cr_res_insitu_bb',
}

REPORTING_YEAR_VECTOR = 'cr_res_reporting_year'


def _workbook_path(config=None) -> Path:
    cached = resolve_root_xlsx(PETROLEUM_EMP_XLSX)
    if cached.is_file():
        return cached

    if config is not None:
        src = (
            config.sections.get('section6_indicators', {})
            .get('sources', {})
            .get(SOURCE_KEY, {})
        )
        rel = src.get('file_path')
        if rel:
            rel_path = Path(rel)
            if rel_path.is_file():
                return rel_path
            root = Path(__file__).resolve().parents[2]
            candidate = (root / rel).resolve()
            if candidate.is_file():
                return candidate
            sharepoint_candidate = resolve_root_xlsx(rel_path.name)
            if sharepoint_candidate.is_file():
                return sharepoint_candidate

    seed_path = PETROLEUM_RESERVES_SEED_DIR / PETROLEUM_EMP_XLSX
    if seed_path.is_file():
        return seed_path

    return cached


def ensure_petroleum_reserves_seed_workbook(path: Optional[Path] = None) -> Path:
    """Create seed workbook with petroleum_reserves_summary and mb_oil_wells_count_depth if missing."""
    target = path or (PETROLEUM_RESERVES_SEED_DIR / PETROLEUM_EMP_XLSX)
    if target.is_file():
        return target

    target.parent.mkdir(parents=True, exist_ok=True)

    reserves_df = pd.DataFrame([
        {
            'reporting_year': 2023,
            'total_bb': 170.0,
            'conventional_bb': 5.0,
            'oil_sands_bb': 165.0,
            'mining_bb': 33.0,
            'insitu_bb': 132.0,
        },
    ])

    mb_rows = []
    for year in range(2000, 2025):
        count = max(20, round(80 + (year - 2000) * 2.5))
        avg_depth = 800 + (year - 2000) * 45
        metres = count * avg_depth
        mb_rows.append({
            'Province': 'MB',
            'Year': year,
            'Product': 'Oil',
            'Welltype': 'Total',
            'Count': count,
            'Metres': metres,
            'AvgMetres': avg_depth,
        })
    mb_df = pd.DataFrame(mb_rows)

    employment_df = pd.DataFrame(EMPLOYMENT_SEED_ROWS)

    with pd.ExcelWriter(target, engine='openpyxl') as writer:
        reserves_df.to_excel(writer, sheet_name=PETROLEUM_RESERVES_SUMMARY_SHEET, index=False)
        mb_df.to_excel(writer, sheet_name='mb_oil_wells_count_depth', index=False)
        employment_df.to_excel(writer, sheet_name=PETROLEUM_EMPLOYMENT_SHEET, index=False)

    print(f'    Created seed workbook: {target}')
    return target


def _normalize_reserves_sheet(df: pd.DataFrame) -> pd.DataFrame:
    cols = {str(c).strip().lower(): c for c in df.columns}
    rename = {}
    for key in (
        'reporting_year', 'total_bb', 'conventional_bb', 'oil_sands_bb', 'mining_bb', 'insitu_bb',
    ):
        if key in cols:
            rename[cols[key]] = key
    out = df.rename(columns=rename)
    required = ['reporting_year', 'total_bb', 'conventional_bb', 'oil_sands_bb', 'mining_bb', 'insitu_bb']
    missing = [c for c in required if c not in out.columns]
    if missing:
        raise ValueError(f'petroleum_reserves_summary missing columns: {missing}')
    out['reporting_year'] = pd.to_numeric(out['reporting_year'], errors='coerce').astype('Int64')
    for col in required[1:]:
        out[col] = pd.to_numeric(out[col], errors='coerce')
    return out.dropna(subset=['reporting_year']).sort_values('reporting_year')


def build_petroleum_reserves_raw_rows(config=None) -> List[Tuple[str, str, float]]:
    path = _workbook_path(config)
    if not path.is_file():
        path = ensure_petroleum_reserves_seed_workbook(path)
    print(f'    Using workbook: {path}')
    df = pd.read_excel(path, sheet_name=PETROLEUM_RESERVES_SUMMARY_SHEET)
    df = _normalize_reserves_sheet(df)
    rows: List[Tuple[str, str, float]] = []
    for _, row in df.iterrows():
        year_key = str(int(row['reporting_year']))
        for col, vector in RESERVE_COLUMNS.items():
            value = row[col]
            if pd.notna(value):
                rows.append((vector, year_key, float(value)))
        rows.append((REPORTING_YEAR_VECTOR, year_key, float(row['reporting_year'])))
    return rows


def build_petroleum_reserves_indicator_rows(
    config=None,
) -> Tuple[List[Tuple[str, str, float]], List[Tuple[str, str, str, str, str, str]]]:
    raw_rows = build_petroleum_reserves_raw_rows(config)
    return raw_rows, list(PETROLEUM_RESERVES_METADATA)


def update_petroleum_reserves(processor) -> int:
    print('  Loading Canadian petroleum reserves summary...')
    rows = build_petroleum_reserves_raw_rows(processor.config)
    if not rows:
        print('    WARNING: no petroleum reserves rows produced')
        return 0
    print(f'    Prepared {len(rows)} petroleum reserves data points')
    return processor.replace_raw_data(SOURCE_KEY, rows, list(PETROLEUM_RESERVES_METADATA))


def transform_petroleum_reserves(processor) -> int:
    df = processor.get_raw_dataframe(SOURCE_KEY)
    if df.empty:
        print('    petroleum_reserves transform: no raw rows found — re-run eedas update')
        return 0

    data_rows: List[Tuple[str, str, float]] = []
    for _, row in df.iterrows():
        vector = str(row['vector'])
        if not vector.startswith('cr_res_'):
            continue
        try:
            value = float(row['value'])
        except (TypeError, ValueError):
            continue
        data_rows.append((vector, str(row['ref_date']), value))

    if not data_rows:
        print('    petroleum_reserves transform: no indicator rows produced')
        return 0

    n = processor.store_indicators(SOURCE_KEY, data_rows, PETROLEUM_RESERVES_METADATA)
    print(f'    Stored {n} indicator rows for petroleum_reserves')
    return n
