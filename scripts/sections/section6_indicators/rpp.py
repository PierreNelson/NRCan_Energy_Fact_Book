"""RPP supply/demand and refinery input (StatCan WDS vectors)."""

from collections import defaultdict
from typing import Dict, List, Tuple

from .constants import (
    MM3_PER_M3,
    PRODUCT_VECTORS,
    REFINERY_INPUT_VECTOR,
    SUPPLY_VECTORS,
)

SUPPLY_SOURCE_KEY = 'rpp_supply_demand'
REFINERY_SOURCE_KEY = 'rpp_refinery_input'


def _annual_totals(
    wds_points: List[Tuple[int, str, float]],
) -> Dict[int, Dict[int, float]]:
    """Aggregate monthly WDS points to annual sums per vector."""
    totals: Dict[int, Dict[int, float]] = defaultdict(lambda: defaultdict(float))
    for vid, ref_per, value in wds_points:
        year = int(str(ref_per)[:4]) if ref_per else None
        if year:
            totals[vid][year] += float(value)
    return totals


def _to_mmbd(annual_m3: float) -> float:
    """Convert annual cubic metres (WDS sum) to million barrels per day."""
    thousand_m3 = annual_m3 / 1000
    return round(thousand_m3 * MM3_PER_M3 / 1000 / 365, 1)


def _to_billion_l(annual_m3: float) -> float:
    """Convert annual cubic metres (WDS sum) to billion litres."""
    thousand_m3 = annual_m3 / 1000
    return round(thousand_m3 / 1000, 0)


def _fetch_annual_by_vector(
    processor,
    vector_ids: List[int],
    start_ref: str = '2000-01-01',
) -> Dict[int, Dict[int, float]]:
    wds = processor.fetch_wds_vector_data(
        [str(v) for v in vector_ids],
        start_ref=start_ref,
    )
    return _annual_totals(wds)


def update_rpp_supply_demand(processor) -> int:
    """EEDAS ingest: StatCan 25-10-0081-01 WDS v* vectors (source-native)."""
    print('  Fetching RPP supply and disposition (StatCan 25-10-0081-01)...')
    all_vector_ids = list(SUPPLY_VECTORS.values()) + list(PRODUCT_VECTORS.values())
    annual = _fetch_annual_by_vector(processor, all_vector_ids)

    data_rows: List[Tuple[str, str, float]] = []
    for vid, by_year in annual.items():
        for year, value in by_year.items():
            data_rows.append((f'v{vid}', str(year), round(value, 4)))

    if not data_rows:
        return 0

    metadata_rows = [
        (f'v{vid}', f'StatCan WDS vector {vid}', 'Cubic metres', 'units', 'Statistics Canada', '')
        for vid in all_vector_ids
    ]
    n = processor.replace_raw_data(SUPPLY_SOURCE_KEY, data_rows, metadata_rows)
    print(f'    Stored {n} source-native WDS rows for rpp_supply_demand')
    return n


def _annual_from_raw(df, vector_id: int) -> Dict[int, float]:
    vec = f'v{vector_id}'
    sub = df[df['vector'].astype(str).str.lower() == vec.lower()]
    out: Dict[int, float] = {}
    for _, row in sub.iterrows():
        try:
            year = int(str(row['ref_date'])[:4])
            out[year] = float(row['value'])
        except (TypeError, ValueError):
            continue
    return out


def transform_rpp_supply_demand(processor) -> int:
    """EFB transform: aggregate WDS vectors into rpp_* indicators."""
    df = processor.get_raw_dataframe(SUPPLY_SOURCE_KEY)
    if df.empty:
        print('    rpp_supply_demand transform: no raw rows found')
        return 0

    annual: Dict[int, Dict[int, float]] = {}
    for vid in list(SUPPLY_VECTORS.values()) + list(PRODUCT_VECTORS.values()):
        annual[vid] = _annual_from_raw(df, vid)

    years = sorted({year for by_year in annual.values() for year in by_year})
    data_rows: List[Tuple[str, str, float]] = []
    for year in years:
        supply_m3 = {key: annual[vid].get(year, 0.0) for key, vid in SUPPLY_VECTORS.items()}
        product_m3 = {key: annual[vid].get(year, 0.0) for key, vid in PRODUCT_VECTORS.items()}
        domestic = supply_m3['domestic_consumption']
        if domestic <= 0:
            continue
        named_sum = sum(product_m3.values())
        product_m3['other'] = max(domestic - named_sum, 0.0)
        for key in ('net_production', 'imports', 'exports', 'domestic_consumption'):
            m3 = supply_m3[key]
            if m3 <= 0:
                continue
            prefix = {
                'net_production': 'rpp_net_prod',
                'imports': 'rpp_imports',
                'exports': 'rpp_exports',
                'domestic_consumption': 'rpp_domestic',
            }[key]
            data_rows.append((f'{prefix}_mmbd', str(year), _to_mmbd(m3)))
            data_rows.append((f'{prefix}_bl', str(year), _to_billion_l(m3)))
        for key, m3 in product_m3.items():
            pct = round(m3 / domestic * 100, 1) if domestic > 0 else 0.0
            data_rows.append((f'rpp_{key}_pct', str(year), pct))

    metadata_rows = [
        ('rpp_net_prod_mmbd', 'RPP net production (MMb/d)', 'million barrels per day', 'units'),
        ('rpp_net_prod_bl', 'RPP net production (billion L)', 'billion litres', 'units'),
        ('rpp_imports_mmbd', 'RPP imports (MMb/d)', 'million barrels per day', 'units'),
        ('rpp_imports_bl', 'RPP imports (billion L)', 'billion litres', 'units'),
        ('rpp_exports_mmbd', 'RPP exports (MMb/d)', 'million barrels per day', 'units'),
        ('rpp_exports_bl', 'RPP exports (billion L)', 'billion litres', 'units'),
        ('rpp_domestic_mmbd', 'RPP domestic consumption (MMb/d)', 'million barrels per day', 'units'),
        ('rpp_domestic_bl', 'RPP domestic consumption (billion L)', 'billion litres', 'units'),
        ('rpp_motor_gasoline_pct', 'Motor gasoline share of domestic RPP consumption', 'percent', 'units'),
        ('rpp_distillate_pct', 'Distillate share of domestic RPP consumption', 'percent', 'units'),
        ('rpp_still_gas_pct', 'Still gas share of domestic RPP consumption', 'percent', 'units'),
        ('rpp_jet_pct', 'Jet fuel share of domestic RPP consumption', 'percent', 'units'),
        ('rpp_coke_pct', 'Coke share of domestic RPP consumption', 'percent', 'units'),
        ('rpp_residual_pct', 'Residual fuel share of domestic RPP consumption', 'percent', 'units'),
        ('rpp_asphalt_pct', 'Asphalt share of domestic RPP consumption', 'percent', 'units'),
        ('rpp_other_pct', 'Other petroleum products share of domestic RPP consumption', 'percent', 'units'),
    ]
    n = processor.store_indicators(SUPPLY_SOURCE_KEY, data_rows, metadata_rows)
    print(f'    Stored {n} indicator rows for rpp_supply_demand')
    return n


def update_rpp_refinery_input(processor) -> int:
    """EEDAS ingest: StatCan 25-10-0063-01 refinery input WDS v* vector."""
    print('  Fetching refinery input (StatCan 25-10-0063-01)...')
    annual = _fetch_annual_by_vector(processor, [REFINERY_INPUT_VECTOR])
    by_year = annual.get(REFINERY_INPUT_VECTOR, {})

    data_rows = [
        (f'v{REFINERY_INPUT_VECTOR}', str(year), round(value, 4))
        for year, value in by_year.items()
    ]
    if not data_rows:
        return 0

    metadata_rows = [
        (f'v{REFINERY_INPUT_VECTOR}', f'StatCan WDS vector {REFINERY_INPUT_VECTOR}', 'Cubic metres', 'units', 'Statistics Canada', ''),
    ]
    n = processor.replace_raw_data(REFINERY_SOURCE_KEY, data_rows, metadata_rows)
    print(f'    Stored {n} source-native WDS rows for rpp_refinery_input')
    return n


def transform_rpp_refinery_input(processor) -> int:
    """EFB transform: refinery input WDS vector to rpp_refinery_* indicators."""
    df = processor.get_raw_dataframe(REFINERY_SOURCE_KEY)
    if df.empty:
        print('    rpp_refinery_input transform: no raw rows found')
        return 0

    by_year = _annual_from_raw(df, REFINERY_INPUT_VECTOR)
    data_rows: List[Tuple[str, str, float]] = []
    for year, m3 in sorted(by_year.items()):
        if m3 <= 0:
            continue
        data_rows.append(('rpp_refinery_mmbd', str(year), _to_mmbd(m3)))
        data_rows.append(('rpp_refinery_bl', str(year), _to_billion_l(m3)))

    metadata_rows = [
        ('rpp_refinery_mmbd', 'Input to Canadian refineries (MMb/d)', 'million barrels per day', 'units'),
        ('rpp_refinery_bl', 'Input to Canadian refineries (billion L)', 'billion litres', 'units'),
    ]
    n = processor.store_indicators(REFINERY_SOURCE_KEY, data_rows, metadata_rows)
    print(f'    Stored {n} indicator rows for rpp_refinery_input')
    return n


def process_rpp_supply_demand(processor) -> int:
    """Legacy combined handler."""
    return update_rpp_supply_demand(processor) + transform_rpp_supply_demand(processor)


def process_rpp_refinery_input(processor) -> int:
    """Legacy combined handler."""
    return update_rpp_refinery_input(processor) + transform_rpp_refinery_input(processor)
