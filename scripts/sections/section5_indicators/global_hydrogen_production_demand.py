"""Global hydrogen production and demand (IEA Global Hydrogen Review workbook)."""

from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, List, Tuple

import pandas as pd

from utils.io_retry import ensure_workbook, read_excel_with_retry

SOURCE_KEY = 'global_hydrogen_production_demand'
WORKBOOK = 'iea_h2_narrative_summary_global_prod_and_demand.xlsx'
SOURCE_URL = 'https://www.iea.org/search?q=global%20hydrogen'

PRODUCTION_SHEET = 'h2_global_production'
SOURCE_SHEET = 'h2_prod_source'
DEMAND_SHEET = 'h2_global_demand'
END_USE_SHEET = 'h2_demand_end_use'

SOURCE_SHARES = (
    ('natural_gas_without_ccus_pct', 'natural_gas'),
    ('coal_pct', 'coal'),
    ('fossil_fuels_with_ccus_pct', 'fossil_ccus'),
    ('oil_pct', 'oil'),
    ('electricity_pct', 'electricity'),
    ('by_product_pct', 'by_product'),
)
END_USE_SHARES = (
    ('refining_pct', 'refining'),
    ('ammonia_pct', 'ammonia'),
    ('methanol_pct', 'methanol'),
    ('steelmaking_pct', 'steelmaking'),
    ('transportation_other_pct', 'transport'),
)

Metadata = Tuple[str, str, str, str, str, str]
DataRow = Tuple[str, str, float]


def _decimal(value) -> Decimal:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        raise ValueError('missing hydrogen value')
    quantized = Decimal(str(value)).quantize(Decimal('0.000001'), rounding=ROUND_HALF_UP)
    text = format(quantized, 'f').rstrip('0').rstrip('.')
    if text in ('', '-0'):
        text = '0'
    return Decimal(text)


def _whole(value) -> int:
    return int(_decimal(value).quantize(Decimal('1'), rounding=ROUND_HALF_UP))


def _percent(value, *, whole: bool) -> Decimal:
    number = _decimal(value)
    if whole:
        return (number * 100).quantize(Decimal('1'), rounding=ROUND_HALF_UP)
    text = format(number, 'f')
    places = len(text.split('.')[1]) if '.' in text else 0
    percent_places = max(0, places - 2)
    quant = Decimal('1') if percent_places == 0 else Decimal('0.' + ('0' * (percent_places - 1)) + '1')
    return (number * 100).quantize(quant, rounding=ROUND_HALF_UP)


def _years(frame: pd.DataFrame, sheet: str) -> pd.DataFrame:
    if 'RY' not in frame.columns:
        raise ValueError(f'{sheet} has no RY column')
    out = frame.copy()
    out['RY'] = pd.to_numeric(out['RY'], errors='coerce')
    out = out.dropna(subset=['RY'])
    if out.empty:
        raise ValueError(f'{sheet} has no reporting years')
    out['RY'] = out['RY'].astype(int)
    return out


def _read_sources(processor):
    path = ensure_workbook(WORKBOOK, config=processor.config)

    def load(sheet: str) -> pd.DataFrame:
        frame = read_excel_with_retry(path, sheet, config=processor.config, label=sheet)
        return _years(frame, sheet)

    production = load(PRODUCTION_SHEET)
    source = load(SOURCE_SHEET)
    demand = load(DEMAND_SHEET)
    end_use = load(END_USE_SHEET)
    years = sorted(set(production['RY']) & set(source['RY']) & set(demand['RY']) & set(end_use['RY']))
    if not years:
        raise ValueError('hydrogen workbook has no year present on every sheet')
    return production, source, demand, end_use, years


def _row_for(frame: pd.DataFrame, year: int, sheet: str) -> pd.Series:
    match = frame[frame['RY'] == year]
    if match.empty:
        raise ValueError(f'{sheet} has no {year} row')
    return match.iloc[0]


def _stored_rows(production, source, demand, end_use, years, raw: bool):
    data_rows: List[DataRow] = []
    metadata_rows: List[Metadata] = []
    prefix = 'gh2_raw_' if raw else 'gh2_'

    def add(vector: str, year: int, value: Decimal, title: str, uom: str):
        data_rows.append((vector, str(year), float(value)))
        metadata_rows.append((vector, title, uom, 'units', 'International Energy Agency', SOURCE_URL))

    for year in years:
        prod = _row_for(production, year, PRODUCTION_SHEET)
        src = _row_for(source, year, SOURCE_SHEET)
        dem = _row_for(demand, year, DEMAND_SHEET)
        use = _row_for(end_use, year, END_USE_SHEET)
        if raw:
            add(f'{prefix}production_mt', year, _decimal(prod['hydrogen_production_mt']), 'Global hydrogen production', 'Mt')
            add(f'{prefix}deliberate_share', year, _decimal(prod['deliberate_pct']), 'Deliberate production share', 'share')
            add(f'{prefix}by_product_share', year, _decimal(prod['by_product_pct']), 'By-product production share', 'share')
            add(f'{prefix}source_total_mt', year, _decimal(src['total_production_mt']), 'Production by source total', 'Mt')
            for column, slug in SOURCE_SHARES:
                add(f'{prefix}source_{slug}', year, _decimal(src[column]), f'Production share {slug}', 'share')
            add(f'{prefix}demand_mt', year, _decimal(dem['global_demand_mt']), 'Global hydrogen demand', 'Mt')
            for column, slug in END_USE_SHARES:
                add(f'{prefix}{slug}', year, _decimal(use[column]), f'Demand share {slug}', 'share')
            continue

        add(f'{prefix}production_mt', year, Decimal(_whole(prod['hydrogen_production_mt'])), 'Global hydrogen production', 'Mt')
        add(f'{prefix}deliberate_pct', year, _percent(prod['deliberate_pct'], whole=True), 'Deliberate production', 'Percent')
        add(f'{prefix}by_product_pct', year, _percent(prod['by_product_pct'], whole=True), 'By-product production', 'Percent')
        add(f'{prefix}source_total_mt', year, Decimal(_whole(src['total_production_mt'])), 'Production by source total', 'Mt')
        for column, slug in SOURCE_SHARES:
            add(
                f'{prefix}source_{slug}',
                year,
                _percent(src[column], whole=False),
                f'Production share {slug}',
                'Percent',
            )
        add(f'{prefix}demand_mt', year, Decimal(_whole(dem['global_demand_mt'])), 'Global hydrogen demand', 'Mt')
        for column, slug in END_USE_SHARES:
            add(f'{prefix}{slug}', year, _percent(use[column], whole=True), f'Demand share {slug}', 'Percent')
    return data_rows, metadata_rows


def update_global_hydrogen_production_demand(processor) -> int:
    frames = _read_sources(processor)
    data_rows, metadata_rows = _stored_rows(*frames, raw=True)
    n = processor.replace_raw_data(SOURCE_KEY, data_rows, metadata_rows)
    print(f'    Stored {n} source-native rows for {SOURCE_KEY}')
    return n


def transform_global_hydrogen_production_demand(processor) -> int:
    production, source, demand, end_use, years = _read_sources(processor)
    data_rows, metadata_rows = _stored_rows(production, source, demand, end_use, years, raw=False)
    n = processor.store_indicators(SOURCE_KEY, data_rows, metadata_rows)
    latest = max(years)
    totals = {row[0]: row[2] for row in data_rows if int(row[1]) == latest}
    print(
        f'    Hydrogen {latest}: production {int(totals["gh2_production_mt"])} Mt, '
        f'demand {int(totals["gh2_demand_mt"])} Mt'
    )
    print(f'    Stored {n} indicator rows for {SOURCE_KEY}')
    return n
