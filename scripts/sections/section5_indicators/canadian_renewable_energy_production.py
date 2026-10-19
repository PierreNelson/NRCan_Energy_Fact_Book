"""Canadian renewable energy production shares and headline total (IEA)."""

from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, List, Tuple

import pandas as pd

from utils.io_retry import ensure_workbook, read_excel_with_retry

SOURCE_KEY = 'canadian_renewable_energy_production'
IEA_XLSX = 'oecd_iea_data.xlsx'
CANADA_SHEET = 'renewables_canada_production'
TOTAL_PRODUCT = 'Total of renewable energy sources'
IEA_SOURCE_URL = 'https://www.iea.org/data-and-statistics'
KTOE_TO_PJ = Decimal('0.04186728')

CATEGORIES = (
    ('hydro', ('Hydropower',)),
    ('solid_biomass', ('Primary solid biofuels',)),
    ('wind', ('Wind',)),
    ('ethanol', ('Biogasoline',)),
    ('municipal_waste', ('Municipal waste, renewable', 'Biogases')),
    ('biodiesel', ('Biodiesels',)),
    ('solar_pv', ('Solar Photovoltaics',)),
    ('solar_thermal', ('Solar thermal',)),
)

Metadata = Tuple[str, str, str, str, str, str]
DataRow = Tuple[str, str, float]


def _decimal(value) -> Decimal:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return Decimal(0)
    return Decimal(str(value))


def _places(value: Decimal, places: int) -> Decimal:
    quantum = Decimal('1') if places == 0 else Decimal('0.1')
    return value.quantize(quantum, rounding=ROUND_HALF_UP)


def _ktoe_frame(frame: pd.DataFrame) -> pd.DataFrame:
    required = {'Product', 'TIME_PERIOD', 'OBS_VALUE'}
    missing = required.difference(frame.columns)
    if missing:
        raise ValueError(f'{CANADA_SHEET} is missing columns: {", ".join(sorted(missing))}')
    out = frame.copy()
    if 'Country/Region' in out.columns:
        out = out[out['Country/Region'].astype(str).str.strip().eq('Canada')]
    if 'Unit' in out.columns:
        out = out[out['Unit'].astype(str).str.strip().str.casefold().eq('ktoe')]
    out['year'] = pd.to_numeric(out['TIME_PERIOD'], errors='coerce')
    out = out.dropna(subset=['year'])
    out['year'] = out['year'].astype(int)
    out['OBS_VALUE'] = pd.to_numeric(out['OBS_VALUE'], errors='coerce').fillna(0)
    if out.empty:
        raise ValueError(f'{CANADA_SHEET} has no Canada ktoe rows')
    return out


def _read_canada(processor) -> Dict[int, Dict[str, Decimal]]:
    path = ensure_workbook(IEA_XLSX, config=processor.config)
    frame = _ktoe_frame(read_excel_with_retry(
        path, CANADA_SHEET, config=processor.config, label='Canada renewable production',
    ))
    products = tuple(dict.fromkeys(
        [name for _key, names in CATEGORIES for name in names] + [TOTAL_PRODUCT]
    ))
    by_year: Dict[int, Dict[str, Decimal]] = {}
    for year, group in frame.groupby('year'):
        totals = group.groupby('Product')['OBS_VALUE'].sum()
        by_year[int(year)] = {name: _decimal(totals.get(name, 0)) for name in products}
    return by_year


def _year_rows(values: Dict[str, Decimal]) -> tuple[Decimal, Dict[str, Decimal], Decimal]:
    headline = values[TOTAL_PRODUCT]
    categories = {
        key: sum((values[name] for name in names), Decimal(0))
        for key, names in CATEGORIES
    }
    chart_total = sum(categories.values(), Decimal(0))
    return headline, categories, chart_total


def _raw_rows(by_year) -> tuple[List[DataRow], List[Metadata]]:
    data_rows: List[DataRow] = []
    metadata_rows: List[Metadata] = []
    for year, values in sorted(by_year.items()):
        for name, ktoe in values.items():
            slug = name.lower().replace(' ', '_').replace(',', '')
            vector = f'crep_raw_{slug}'
            data_rows.append((vector, str(year), float(ktoe.quantize(Decimal('0.0001')))))
            metadata_rows.append((
                vector, f'Canada {name}', 'ktoe', 'units', 'International Energy Agency', IEA_SOURCE_URL,
            ))
    return data_rows, metadata_rows


def _indicator_rows(by_year) -> tuple[List[DataRow], List[Metadata]]:
    data_rows: List[DataRow] = []
    metadata_rows: List[Metadata] = []

    def add(vector: str, year: int, value: Decimal, title: str, uom: str):
        data_rows.append((vector, str(year), float(value)))
        metadata_rows.append((
            vector, title, uom, 'units', 'International Energy Agency', IEA_SOURCE_URL,
        ))

    for year, values in sorted(by_year.items()):
        headline, categories, chart_total = _year_rows(values)
        if headline == 0 or chart_total == 0:
            continue
        add('crep_total_pj', year, _places(headline * KTOE_TO_PJ, 0), 'Canada total renewable energy', 'PJ')
        add('crep_total_mtoe', year, _places(headline / Decimal(1000), 1), 'Canada total renewable energy', 'MTOE')
        for key, _names in CATEGORIES:
            share = _places(categories[key] / chart_total * Decimal(100), 1)
            add(f'crep_{key}', year, share, f'Canada renewable production share, {key}', 'Percent')
    return data_rows, metadata_rows


def update_canadian_renewable_energy_production(processor) -> int:
    data_rows, metadata_rows = _raw_rows(_read_canada(processor))
    n = processor.replace_raw_data(SOURCE_KEY, data_rows, metadata_rows)
    print(f'    Stored {n} source-native rows for {SOURCE_KEY}')
    return n


def transform_canadian_renewable_energy_production(processor) -> int:
    by_year = _read_canada(processor)
    data_rows, metadata_rows = _indicator_rows(by_year)
    n = processor.store_indicators(SOURCE_KEY, data_rows, metadata_rows)
    years = [int(row[1]) for row in data_rows if row[0] == 'crep_total_pj']
    if years:
        latest = max(years)
        values = {row[0]: row[2] for row in data_rows if int(row[1]) == latest}
        shares = ', '.join(
            f'{key} {values[f"crep_{key}"]}' for key, _names in CATEGORIES
        )
        print(
            f'    Canada renewable {latest}: {int(values["crep_total_pj"])} PJ, '
            f'{values["crep_total_mtoe"]} MTOE; {shares}'
        )
    print(f'    Stored {n} indicator rows for {SOURCE_KEY}')
    return n
