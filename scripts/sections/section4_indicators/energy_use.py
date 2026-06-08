"""Energy use handler: OEE NEUD sectors + Primary Energy Use Demand."""

from pathlib import Path
from typing import Any, Dict, List, Tuple

import pandas as pd

from xlsx_paths import default_xlsx_base_dir

from .constants import DEFAULT_PRIMARY_DEMAND_FILENAME

SOURCE_KEY = 'energy_use'
OEE_SECTORS = ['R', 'C', 'I', 'T', 'A']
PRIMARY_VECS = ['P', 'NPC', 'FK', 'EL']
OEE_NEUD_VECTORS = OEE_SECTORS + PRIMARY_VECS

PRIMARY_PRODUCT_TO_VEC = {
    'P': ['pipeline'],
    'NPC': ['non-energy (feedstock)', 'non-energy', 'non-energy use', 'nonenergy', 'feedstock'],
    'FK': ['noncovered producer consumption', 'non-covered producer consumption', 'non-covered', 'noncovered', 'producer consumption'],
    'EL': ['energy losses (conversion)', 'energy losses', 'losses', 'el'],
}


def _get_primary_demand_path(processor, energy_cfg: Dict[str, Any]) -> Path:
    primary_path = energy_cfg.get('primary_demand_file_path') or energy_cfg.get('primary_demand_path')
    xlsx_base = default_xlsx_base_dir()
    if primary_path and str(primary_path).strip():
        return processor._resolve_path(primary_path.strip(), xlsx_base)
    return xlsx_base / DEFAULT_PRIMARY_DEMAND_FILENAME


def _find_year_col(processor, df: pd.DataFrame) -> str:
    return processor.get_column(df, 'ref_date', 'REF_DATE', 'year', 'Year', 'YEAR')


def _load_primary_demand(processor, file_path: Path) -> Dict[int, Dict[str, float]]:
    by_year: Dict[int, Dict[str, float]] = {}
    df = pd.read_excel(file_path, sheet_name=0)
    df.columns = [str(c).strip() for c in df.columns]
    year_col = _find_year_col(processor, df)
    product_col = processor.get_column(df, 'product', 'PRODUCT', 'category', 'Category')
    value_col = processor.get_column(df, 'value', 'VALUE', 'amount', 'val')
    if not year_col or not product_col or not value_col:
        return by_year
    for _, row in df.iterrows():
        try:
            y = row[year_col]
            if pd.isna(y):
                continue
            year_int = int(float(y))
        except (ValueError, TypeError):
            continue
        prod = row.get(product_col)
        if pd.isna(prod):
            continue
        prod_str = str(prod).strip().lower()
        vec = None
        for v, keywords in PRIMARY_PRODUCT_TO_VEC.items():
            if any(kw in prod_str or prod_str in kw for kw in keywords):
                vec = v
                break
        if vec is None:
            continue
        try:
            val = float(row[value_col])
        except (ValueError, TypeError):
            continue
        if year_int not in by_year:
            by_year[year_int] = {}
        by_year[year_int][vec] = val
    return by_year


def _series_by_year(df: pd.DataFrame, vector: str) -> Dict[int, float]:
    if df.empty:
        return {}
    sub = df[df['vector'].astype(str) == vector]
    out: Dict[int, float] = {}
    for _, row in sub.iterrows():
        try:
            year = int(str(row['ref_date'])[:4])
            val = float(row['value'])
            out[year] = val
        except (ValueError, TypeError):
            continue
    return out


def update_energy_use(processor) -> int:
    """EEDAS ingest: OEE NEUD sector totals + Primary Excel rows (source-native)."""
    section_cfg = processor.config.sections.get(processor.SECTION_KEY, {})
    energy_cfg = section_cfg.get('sources', {}).get('energy_use', {}) or {}
    print('  Fetching OEE NEUD sector tables (R,C,I,T,A)...')
    oee_by_year = processor._fetch_oee_by_year()
    if not oee_by_year:
        print('    energy_use: could not load any OEE NEUD sector data from URLs')
        return 0

    data_rows: List[Tuple[str, str, float]] = []
    for year, sectors in sorted(oee_by_year.items()):
        year_str = str(year)
        for sector in OEE_SECTORS:
            if sector in sectors:
                data_rows.append((sector, year_str, round(float(sectors[sector]), 2)))

    path_primary = _get_primary_demand_path(processor, energy_cfg)
    if not path_primary.exists():
        print(f'    Primary file not found: {path_primary}')
        return 0
    primary_by_year = _load_primary_demand(processor, path_primary)
    if not primary_by_year:
        print('    Primary Energy Use Demand file is empty or has no recognized columns.')
        return 0
    for year, vecs in sorted(primary_by_year.items()):
        year_str = str(year)
        for vec, val in vecs.items():
            data_rows.append((vec, year_str, round(float(val), 2)))

    if not data_rows:
        return 0

    source_org = 'Natural Resources Canada (OEE)'
    source_url = 'https://oee.nrcan.gc.ca/corporate/statistics/neud/dpa/data_e.html'
    metadata_rows = [
        (s, f'OEE NEUD sector {s} total energy use', 'PJ', 'petajoules', source_org, source_url)
        for s in OEE_SECTORS
    ] + [
        (v, f'Primary energy use demand — {v}', 'PJ', 'petajoules', source_org, str(path_primary))
        for v in PRIMARY_VECS
    ]
    n = processor.replace_raw_data(SOURCE_KEY, data_rows, metadata_rows)
    print(f'    Stored {n} source-native rows for energy_use')
    return n


def transform_energy_use(processor) -> int:
    """EFB transform: merge OEE NEUD + Primary raw rows into oee_neud_* indicators."""
    df = processor.get_raw_dataframe(SOURCE_KEY)
    if df.empty:
        print('    energy_use transform: no raw rows found')
        return 0

    oee_by_year: Dict[int, Dict[str, float]] = {}
    for sector in OEE_SECTORS:
        for year, val in _series_by_year(df, sector).items():
            oee_by_year.setdefault(year, {})[sector] = val

    primary_by_year: Dict[int, Dict[str, float]] = {}
    for vec in PRIMARY_VECS:
        for year, val in _series_by_year(df, vec).items():
            primary_by_year.setdefault(year, {})[vec] = val

    if primary_by_year:
        all_years = sorted(set(oee_by_year) & set(primary_by_year))
    else:
        all_years = sorted(oee_by_year.keys())

    data_rows: List[Tuple[str, str, float]] = []
    for year in all_years:
        o = oee_by_year.get(year, {})
        p = primary_by_year.get(year, {})
        row = {**o, **p}
        for k in OEE_NEUD_VECTORS:
            if k not in row:
                row[k] = 0.0
        if not all(k in row for k in OEE_NEUD_VECTORS):
            continue
        year_str = str(year)
        for vec in OEE_NEUD_VECTORS:
            data_rows.append((f'oee_neud_{vec}', year_str, round(float(row[vec]), 2)))

    if not data_rows:
        print('    No complete year rows (need all 9 vectors per year)')
        return 0

    source_org = 'Natural Resources Canada (OEE)'
    source_url = 'https://oee.nrcan.gc.ca/corporate/statistics/neud/dpa/data_e.html'
    metadata_rows = [
        ('oee_neud_R', 'Energy use - Residential', 'PJ', 'petajoules', source_org, source_url),
        ('oee_neud_C', 'Energy use - Commercial', 'PJ', 'petajoules', source_org, source_url),
        ('oee_neud_I', 'Energy use - Industrial', 'PJ', 'petajoules', source_org, source_url),
        ('oee_neud_T', 'Energy use - Transportation', 'PJ', 'petajoules', source_org, source_url),
        ('oee_neud_A', 'Energy use - Agriculture', 'PJ', 'petajoules', source_org, source_url),
        ('oee_neud_P', 'Energy use - Pipeline', 'PJ', 'petajoules', source_org, source_url),
        ('oee_neud_NPC', 'Energy use - Non-energy (feedstock)', 'PJ', 'petajoules', source_org, source_url),
        ('oee_neud_FK', 'Energy use - Non-covered producer/consumption', 'PJ', 'petajoules', source_org, source_url),
        ('oee_neud_EL', 'Energy use - Energy losses', 'PJ', 'petajoules', source_org, source_url),
    ]
    n = processor.store_indicators(SOURCE_KEY, data_rows, metadata_rows)
    print(f'    Stored {n} indicator rows for energy_use ({len(all_years)} years)')
    return n
