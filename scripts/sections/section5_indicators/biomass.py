"""Biomass share of renewable energy production (IEA) and approved narrative bullets."""

from __future__ import annotations

import re
from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, List, Tuple

import pandas as pd

from utils.io_retry import ensure_workbook, read_excel_with_retry

SOURCE_KEY = 'biomass'
IEA_XLSX = 'oecd_iea_data.xlsx'
NARRATIVE_XLSX = 'biomass_narrative.xlsx'
OECD_SHEET = 'renewables_oecd_production'
CANADA_SHEET = 'renewables_canada_production'
NARRATIVE_SHEET = 'biomass_narrative'
OECD_GEOGRAPHY = 'OECD Total'
TOTAL_PRODUCT = 'Total of renewable energy sources'
IEA_SOURCE_URL = 'https://www.iea.org/data-and-statistics'

OECD_BIOMASS_PRODUCTS = (
    'Bio Jet Kerosene',
    'Other liquid biofuels',
    'Primary solid biofuels',
    'Biogasoline',
    'Biodiesels',
    'Biogases',
    'Municipal waste, renewable',
)

CANADA_PRODUCTS = {
    'Hydropower': 'hydro',
    'Primary solid biofuels': 'solid',
    'Wind': 'wind',
    'Biogasoline': 'ethanol',
    'Municipal waste, renewable': 'municipal',
    'Biodiesels': 'biodiesel',
    'Solar Photovoltaics': 'solar_pv',
    'Solar thermal': 'solar_thermal',
}

Metadata = Tuple[str, str, str, str, str, str]
DataRow = Tuple[str, str, float]
FIGURES = re.compile(
    r'\d[\d,\s]*(?:\.\d+)?\s*MWth'
    r'|\d[\d,\s]*(?:\.\d+)?\s*Independent Power Providers \(IPP\)'
    r'|\d[\d,\s]*(?:\.\d+)?\s*fournisseurs indépendants d\'énergie \(FIE\)'
    r'|\d[\d,\s]*(?:\.\d+)?\s*unités de cogénération'
    r'|\d[\d,\s]*(?:\.\d+)?\s*systèmes de biothermie opérationnels'
    r'|\d[\d,]*(?:\.\d+)?\s*operational'
    r'|\d[\d,\s]*(?:\.\d+)?\s*MW'
    r'|\d[\d,\s]*(?:\.\d+)?\s*%'
)


def _whole_percent(part: Decimal, total: Decimal) -> int:
    if total == 0:
        raise ValueError('biomass share total is zero')
    return int((part / total * Decimal(100)).quantize(Decimal('1'), rounding=ROUND_HALF_UP))


def _decimal(value) -> Decimal:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return Decimal(0)
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


def _emphasize_figures(text: str) -> str:
    """Keep the page's bold figures when the approved narrative is plain text."""
    if not text or '<strong>' in text:
        return text
    return FIGURES.sub(lambda match: f'<strong>{match.group(0)}</strong>', text)


def _text(value) -> str:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return ''
    text = str(value).strip()
    return '' if text.lower() == 'nan' else text


def _ktoe_frame(frame: pd.DataFrame, sheet: str) -> pd.DataFrame:
    required = {'Product', 'TIME_PERIOD', 'OBS_VALUE'}
    missing = required.difference(frame.columns)
    if missing:
        raise ValueError(f'{sheet} is missing columns: {", ".join(sorted(missing))}')
    out = frame.copy()
    if 'Unit' in out.columns:
        out = out[out['Unit'].astype(str).str.strip().str.casefold().eq('ktoe')]
    out['year'] = pd.to_numeric(out['TIME_PERIOD'], errors='coerce')
    out = out.dropna(subset=['year'])
    out['year'] = out['year'].astype(int)
    out['OBS_VALUE'] = pd.to_numeric(out['OBS_VALUE'], errors='coerce').fillna(0)
    return out


def _values_by_year(frame: pd.DataFrame, products: tuple[str, ...]) -> Dict[int, Dict[str, Decimal]]:
    by_year: Dict[int, Dict[str, Decimal]] = {}
    for year, group in frame.groupby('year'):
        totals = group.groupby('Product')['OBS_VALUE'].sum()
        by_year[int(year)] = {name: _decimal(totals.get(name, 0)) for name in products}
    return by_year


def _read_sources(processor):
    config = processor.config
    iea_path = ensure_workbook(IEA_XLSX, config=config)
    narrative_path = ensure_workbook(NARRATIVE_XLSX, config=config)
    oecd = read_excel_with_retry(iea_path, OECD_SHEET, config=config, label='OECD renewable production')
    canada = read_excel_with_retry(iea_path, CANADA_SHEET, config=config, label='Canada renewable production')
    narrative = read_excel_with_retry(narrative_path, NARRATIVE_SHEET, config=config, label='Biomass narrative')
    if 'Country/Region' not in oecd.columns:
        raise ValueError(f'{OECD_SHEET} has no Country/Region column')
    oecd = oecd[oecd['Country/Region'].astype(str).str.strip().eq(OECD_GEOGRAPHY)]
    if oecd.empty:
        raise ValueError(f'{OECD_SHEET} has no {OECD_GEOGRAPHY} rows')
    oecd_values = _values_by_year(
        _ktoe_frame(oecd, OECD_SHEET),
        OECD_BIOMASS_PRODUCTS + (TOTAL_PRODUCT,),
    )
    canada_by_product = _values_by_year(
        _ktoe_frame(canada, CANADA_SHEET),
        tuple(CANADA_PRODUCTS),
    )
    canada_values = {
        year: {slug: amounts[name] for name, slug in CANADA_PRODUCTS.items()}
        for year, amounts in canada_by_product.items()
    }
    bullets = _narrative_bullets(narrative)
    return oecd_values, canada_values, bullets


def _narrative_bullets(frame: pd.DataFrame) -> List[tuple]:
    required = {'section', 'bullet_order', 'reporting_year', 'narrative_en', 'narrative_fr'}
    missing = required.difference(frame.columns)
    if missing:
        raise ValueError(f'{NARRATIVE_SHEET} is missing columns: {", ".join(sorted(missing))}')
    rows = frame[frame['section'].astype(str).str.strip().str.casefold().eq('biomass')].copy()
    if rows.empty:
        raise ValueError(f'{NARRATIVE_SHEET} has no biomass rows')
    rows['reporting_year'] = pd.to_numeric(rows['reporting_year'], errors='coerce')
    rows = rows.dropna(subset=['reporting_year'])
    if rows.empty:
        raise ValueError(f'{NARRATIVE_SHEET} biomass rows have no reporting year')
    latest = int(rows['reporting_year'].max())
    rows = rows[rows['reporting_year'] == latest].sort_values('bullet_order')
    bullets = []
    for _, row in rows.iterrows():
        order = int(row['bullet_order'])
        english = _emphasize_figures(_text(row.get('narrative_en')))
        french = _emphasize_figures(_text(row.get('narrative_fr')))
        if not english and not french:
            continue
        for label, text in (('en', english), ('fr', french)):
            if text and len(text) > 500:
                raise ValueError(f'biomass bullet {order} {label} exceeds 500 characters')
        bullets.append((latest, order, english, french))
    if not bullets:
        raise ValueError(f'{NARRATIVE_SHEET} biomass rows for {latest} have no narrative text')
    return bullets


def _canada_shares(values: Dict[str, Decimal]) -> Dict[str, int]:
    total = sum(values.values(), Decimal(0))
    solid = _whole_percent(values['solid'], total)
    other = _whole_percent(values['ethanol'] + values['municipal'] + values['biodiesel'], total)
    hydro = _whole_percent(values['hydro'], total)
    wind = _whole_percent(values['wind'] + values['solar_pv'] + values['solar_thermal'], total)
    return {
        'hydro': hydro,
        'solid_biofuels': solid,
        'wind_solar': wind,
        'other_biomass': other,
        'canada_share': solid + other,
    }


def _indicator_rows(oecd_values, canada_values, bullets) -> tuple[List[DataRow], List[Metadata]]:
    data_rows: List[DataRow] = []
    metadata_rows: List[Metadata] = []

    def add(vector: str, year: int, value: float, title: str, uom: str, org: str):
        data_rows.append((vector, str(year), float(value)))
        metadata_rows.append((vector, title, uom, 'units', org, IEA_SOURCE_URL))

    for year, values in sorted(oecd_values.items()):
        total = values[TOTAL_PRODUCT]
        if total == 0:
            continue
        biomass = sum((values[name] for name in OECD_BIOMASS_PRODUCTS), Decimal(0))
        add(
            'bmas_oecd_share',
            year,
            _whole_percent(biomass, total),
            'OECD biomass share of renewable energy production',
            'Percent',
            'International Energy Agency',
        )

    for year, values in sorted(canada_values.items()):
        if sum(values.values(), Decimal(0)) == 0:
            continue
        shares = _canada_shares(values)
        titles = {
            'hydro': 'Canada renewable production share, hydro',
            'solid_biofuels': 'Canada renewable production share, solid biofuels',
            'wind_solar': 'Canada renewable production share, wind and solar',
            'other_biomass': 'Canada renewable production share, other biomass',
            'canada_share': 'Canada biomass share of renewable energy production',
        }
        vectors = {
            'hydro': 'bmas_hydro',
            'solid_biofuels': 'bmas_solid_biofuels',
            'wind_solar': 'bmas_wind_solar',
            'other_biomass': 'bmas_other_biomass',
            'canada_share': 'bmas_canada_share',
        }
        for key, vector in vectors.items():
            add(vector, year, shares[key], titles[key], 'Percent', 'International Energy Agency')

    for year, order, english, french in bullets:
        for lang, text in (('en', english), ('fr', french)):
            if not text:
                continue
            add(
                f'bmas_bullet_{order}_{lang}',
                year,
                order,
                text,
                'Text',
                'Natural Resources Canada',
            )
    return data_rows, metadata_rows


def _raw_rows(oecd_values, canada_values, bullets) -> tuple[List[DataRow], List[Metadata]]:
    data_rows: List[DataRow] = []
    metadata_rows: List[Metadata] = []

    def add(vector: str, year: int, value: Decimal, title: str, uom: str):
        stored = float(value.quantize(Decimal('0.0001')))
        data_rows.append((vector, str(year), stored))
        metadata_rows.append((vector, title, uom, 'units', 'International Energy Agency', IEA_SOURCE_URL))

    for year, values in sorted(oecd_values.items()):
        for name in OECD_BIOMASS_PRODUCTS + (TOTAL_PRODUCT,):
            slug = name.lower().replace(' ', '_').replace(',', '')
            add(f'bmas_raw_oecd_{slug}', year, values[name], f'OECD {name}', 'ktoe')
    for year, values in sorted(canada_values.items()):
        for name, slug in CANADA_PRODUCTS.items():
            add(f'bmas_raw_can_{slug}', year, values[slug], f'Canada {name}', 'ktoe')
    for year, order, english, french in bullets:
        for lang, text in (('en', english), ('fr', french)):
            if not text:
                continue
            vector = f'bmas_raw_bullet_{order}_{lang}'
            data_rows.append((vector, str(year), float(order)))
            metadata_rows.append((vector, text, 'Text', 'units', 'Natural Resources Canada', IEA_SOURCE_URL))
    return data_rows, metadata_rows


def update_biomass(processor) -> int:
    oecd_values, canada_values, bullets = _read_sources(processor)
    data_rows, metadata_rows = _raw_rows(oecd_values, canada_values, bullets)
    n = processor.replace_raw_data(SOURCE_KEY, data_rows, metadata_rows)
    print(f'    Stored {n} source-native rows for {SOURCE_KEY}')
    return n


def transform_biomass(processor) -> int:
    oecd_values, canada_values, bullets = _read_sources(processor)
    data_rows, metadata_rows = _indicator_rows(oecd_values, canada_values, bullets)
    n = processor.store_indicators(SOURCE_KEY, data_rows, metadata_rows)
    oecd_years = [year for year, _value in ((int(row[1]), row[2]) for row in data_rows if row[0] == 'bmas_oecd_share')]
    canada_years = [int(row[1]) for row in data_rows if row[0] == 'bmas_canada_share']
    if oecd_years:
        latest = max(oecd_years)
        share = next(row[2] for row in data_rows if row[0] == 'bmas_oecd_share' and int(row[1]) == latest)
        print(f'    Biomass OECD {latest}: {int(share)} percent')
    if canada_years:
        latest = max(canada_years)
        shares = {
            row[0]: int(row[2])
            for row in data_rows
            if int(row[1]) == latest and row[0] in {
                'bmas_hydro', 'bmas_solid_biofuels', 'bmas_wind_solar', 'bmas_other_biomass', 'bmas_canada_share',
            }
        }
        print(
            '    Biomass Canada '
            f'{latest}: hydro {shares["bmas_hydro"]}, solid {shares["bmas_solid_biofuels"]}, '
            f'wind and solar {shares["bmas_wind_solar"]}, other {shares["bmas_other_biomass"]}, '
            f'biomass {shares["bmas_canada_share"]}'
        )
    print(f'    Stored {n} indicator rows for {SOURCE_KEY}')
    return n
