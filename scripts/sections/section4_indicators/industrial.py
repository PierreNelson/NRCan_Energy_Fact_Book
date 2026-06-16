"""Industrial sector handler."""

from typing import Dict, List, Tuple

import pandas as pd

from xlsx_paths import default_xlsx_base_dir
from utils.io_retry import ensure_workbook, resolve_sheet_name

from .constants import (
    EE_SHEET_IMPROVEMENT,
    ENERGY_EFFICIENCY_XLSX,
    OEE_INDUSTRIAL_CP_URL,
    REQUEST_TIMEOUT,
)

SOURCE_KEY = 'industrial_sector'


def _ee_improvement_path(processor):
    section_cfg = processor.config.sections.get(processor.SECTION_KEY, {})
    sources_cfg = section_cfg.get('sources', {})
    ind_cfg = sources_cfg.get('industrial_sector', {}) or {}
    res_cfg = sources_cfg.get('residential_daily_lives', {}) or {}
    base_dir = default_xlsx_base_dir()
    path_str = (ind_cfg.get('ee_improvement_file_path') or res_cfg.get('ee_improvement_file_path') or '').strip()
    if path_str:
        return processor._resolve_path(path_str, base_dir)
    return ensure_workbook(ENERGY_EFFICIENCY_XLSX, config=processor.config)


def _ee_improvement_sheet(processor, path) -> str | int:
    default_path = ensure_workbook(ENERGY_EFFICIENCY_XLSX, config=processor.config)
    if path.resolve() == default_path.resolve():
        return resolve_sheet_name(path, EE_SHEET_IMPROVEMENT, label='industrial_sector')
    return EE_SHEET_IMPROVEMENT


def update_industrial_sector(processor) -> int:
    """EEDAS ingest: OEE Industrial CP table + EE Improvement Excel rows."""
    data_rows: List[Tuple[str, str, float]] = []
    row_mappings = [
        ('total energy use (pj)', 'cp_teu', None),
        ('electricity', 'cp_ele', None),
        ('natural gas', 'cp_ng', None),
        ('diesel fuel oil, light fuel oil and kerosene', 'cp_dfox', None),
        ('heavy fuel oil', 'cp_hfo', None),
        ('still gas and petroleum coke', 'cp_sgpc', None),
        ('lpg and gas plant ngl', 'cp_lgp', None),
        ('coal', 'cp_cl', None),
        ('coke and coke oven gas', 'cp_ccog', None),
        ('wood waste and pulping liquor', 'cp_wwpl', None),
        ('other', 'cp_ot', None),
    ]
    try:
        r = processor.fetch_url_with_retry(
            OEE_INDUSTRIAL_CP_URL, timeout=REQUEST_TIMEOUT, label='OEE Industrial CP'
        )
        parsed = processor._parse_oee_html_table_generic(r.text, row_mappings)
        for year, row in parsed.items():
            for k, v in row.items():
                data_rows.append((k, str(year), v))
    except Exception as e:
        print(f'    Failed to fetch industrial CP page {OEE_INDUSTRIAL_CP_URL}: {e}')

    path = _ee_improvement_path(processor)
    if path.exists():
        try:
            df_ee = pd.read_excel(path, sheet_name=_ee_improvement_sheet(processor, path))
        except Exception as e:
            print(f'    Failed to read sheet EE Improvement: {e}')
            df_ee = pd.DataFrame()
        if not df_ee.empty:
            df_ee.columns = [str(c).strip() for c in df_ee.columns]
            sector_col = processor.get_column(df_ee, 'sector', 'SECTOR', 'Sector', 'sectors')
            metric_col = processor.get_column(df_ee, 'metric', 'METRIC', 'Metric', 'metric name', 'metric_name', 'indicator')
            uom_col = processor.get_column(df_ee, 'uom', 'UOM', 'Uom', 'unit', 'units')
            value_col = processor.get_column(df_ee, 'value', 'VALUE', 'Value', 'val', 'amount', 'data')
            year_col = processor.get_column(df_ee, 'year', 'YEAR', 'Year', 'end_year', 'ref_date', 'end year')
            if sector_col and metric_col and value_col:
                sectors = df_ee[sector_col].astype(str).str.strip().str.lower().str.replace(r'[\s-]+', '_', regex=True)
                ind = df_ee[sectors == 'industrial_excl_resource_extraction']
                for _, row in ind.iterrows():
                    metric = str(row.get(metric_col, '')).strip().lower()
                    uom = str(row.get(uom_col, '')).strip().lower() if uom_col else ''
                    try:
                        val = float(row[value_col])
                    except (TypeError, ValueError):
                        continue
                    ee_year = 2022
                    if year_col and pd.notna(row.get(year_col)):
                        try:
                            ee_year = int(float(row[year_col]))
                        except (TypeError, ValueError):
                            pass
                    ref = str(ee_year)
                    if 'improvement' in metric:
                        data_rows.append(('ee_improvement_pct', ref, round(val, 2)))
                    elif 'energy savings' in metric or 'savings' in metric:
                        if 'pj' in uom or uom == 'pj':
                            data_rows.append(('ee_savings_pj', ref, round(val, 2)))
                        elif 'billion' in uom or '$' in uom:
                            data_rows.append(('ee_savings_billion', ref, round(val, 2)))
    else:
        print(f'    EE Improvement file not found (optional for industrial): {path}')

    if not data_rows:
        print('    No industrial_sector raw rows produced')
        return 0

    source_org = 'Natural Resources Canada (OEE)'
    metadata_rows = [
        (vec, f'Industrial raw — {vec}', 'PJ', 'petajoules', source_org, OEE_INDUSTRIAL_CP_URL)
        for vec in sorted({r[0] for r in data_rows})
    ]
    n = processor.replace_raw_data(SOURCE_KEY, data_rows, metadata_rows)
    print(f'    Stored {n} source-native rows for industrial_sector')
    return n


_CP_RAW_TO_IND = {
    'cp_teu': 'ind_teu',
    'cp_ele': 'ind_ele',
    'cp_ng': 'ind_ng',
    'cp_dfox': 'ind_dfox',
    'cp_hfo': 'ind_hfo',
    'cp_sgpc': 'ind_sgpc',
    'cp_lgp': 'ind_lgp',
    'cp_cl': 'ind_cl',
    'cp_ccog': 'ind_ccog',
    'cp_wwpl': 'ind_wwpl',
    'cp_ot': 'ind_ot',
    'ee_improvement_pct': 'ind_ee_improvement_pct',
    'ee_savings_pj': 'ind_ee_savings_pj',
    'ee_savings_billion': 'ind_ee_savings_billion',
}


def transform_industrial_sector(processor) -> int:
    """EFB transform: map raw OEE/Excel rows to ind_* indicators."""
    df = processor.get_raw_dataframe(SOURCE_KEY)
    if df.empty:
        print('    industrial_sector transform: no raw rows found')
        return 0

    by_year: Dict[int, Dict[str, float]] = {}
    ee_rows: List[Tuple[str, str, float]] = []
    for _, row in df.iterrows():
        raw_vec = str(row['vector'])
        try:
            year = int(str(row['ref_date'])[:4])
            val = float(row['value'])
        except (TypeError, ValueError):
            continue
        if raw_vec.startswith('ee_'):
            ind = _CP_RAW_TO_IND.get(raw_vec)
            if ind:
                ee_rows.append((ind, str(row['ref_date']), val))
            continue
        ind = _CP_RAW_TO_IND.get(raw_vec)
        if ind:
            by_year.setdefault(year, {})[ind] = val

    data_rows: List[Tuple[str, str, float]] = []
    for year in sorted(by_year.keys()):
        d = by_year[year]
        year_str = str(year)
        if d.get('ind_teu') is not None:
            data_rows.append(('ind_teu', year_str, d['ind_teu']))
        for vec in ['ind_ele', 'ind_ng', 'ind_dfox', 'ind_hfo', 'ind_sgpc', 'ind_lgp', 'ind_cl', 'ind_ccog', 'ind_wwpl', 'ind_ot']:
            if d.get(vec) is not None:
                data_rows.append((vec, year_str, d[vec]))
        other_x = sum(float(d.get(vec) or 0) for vec in ['ind_hfo', 'ind_lgp', 'ind_cl', 'ind_ccog', 'ind_ot'])
        if other_x > 0:
            data_rows.append(('ind_other_x', year_str, round(other_x, 2)))

    data_rows.extend(ee_rows)

    if not data_rows:
        print('    No industrial_sector indicator rows produced')
        return 0

    source_org = 'Natural Resources Canada (OEE)'
    metadata_rows = [
        ('ind_teu', 'Industrial total energy use (PJ)', 'PJ', 'petajoules', source_org, OEE_INDUSTRIAL_CP_URL),
        ('ind_ele', 'Industrial electricity (PJ)', 'PJ', 'petajoules', source_org, OEE_INDUSTRIAL_CP_URL),
        ('ind_ng', 'Industrial natural gas (PJ)', 'PJ', 'petajoules', source_org, OEE_INDUSTRIAL_CP_URL),
        ('ind_dfox', 'Industrial diesel fuel oil, light fuel oil and kerosene (PJ)', 'PJ', 'petajoules', source_org, OEE_INDUSTRIAL_CP_URL),
        ('ind_hfo', 'Industrial heavy fuel oil (PJ)', 'PJ', 'petajoules', source_org, OEE_INDUSTRIAL_CP_URL),
        ('ind_sgpc', 'Industrial still gas and petroleum coke (PJ)', 'PJ', 'petajoules', source_org, OEE_INDUSTRIAL_CP_URL),
        ('ind_lgp', 'Industrial LPG and gas plant NGL (PJ)', 'PJ', 'petajoules', source_org, OEE_INDUSTRIAL_CP_URL),
        ('ind_cl', 'Industrial coal (PJ)', 'PJ', 'petajoules', source_org, OEE_INDUSTRIAL_CP_URL),
        ('ind_ccog', 'Industrial coke and coke oven gas (PJ)', 'PJ', 'petajoules', source_org, OEE_INDUSTRIAL_CP_URL),
        ('ind_wwpl', 'Industrial wood waste and pulping liquor (PJ)', 'PJ', 'petajoules', source_org, OEE_INDUSTRIAL_CP_URL),
        ('ind_ot', 'Industrial other (PJ)', 'PJ', 'petajoules', source_org, OEE_INDUSTRIAL_CP_URL),
        ('ind_other_x', 'Industrial other fuel group (PJ)', 'PJ', 'petajoules', source_org, OEE_INDUSTRIAL_CP_URL),
        ('ind_ee_improvement_pct', 'Industrial energy efficiency improvement excluding resource extraction (2000 to end year)', '%', 'percent', source_org, 'EE Improvement'),
        ('ind_ee_savings_pj', 'Industrial energy savings excluding resource extraction (PJ)', 'PJ', 'petajoules', source_org, 'EE Improvement'),
        ('ind_ee_savings_billion', 'Industrial energy cost savings excluding resource extraction (billion $)', 'billion $', 'billions', source_org, 'EE Improvement'),
    ]
    n = processor.store_indicators(SOURCE_KEY, data_rows, metadata_rows)
    print(f'    Stored {n} indicator rows for industrial_sector')
    return n
