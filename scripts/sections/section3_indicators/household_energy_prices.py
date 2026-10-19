"""Household energy prices per unit — page 45."""

import pandas as pd

from xlsx_paths import resolve_root_xlsx

SOURCE_KEY = 'household_energy_prices'
WORKBOOK = 'oecd_iea_data.xlsx'
SHEET = 'HH_energy_prices_per_unit'
SOURCE_ORG = 'International Energy Agency'
SOURCE_URL = 'https://www.iea.org/data-and-statistics'

COUNTRIES = {
    'canada': 'canada',
    'france': 'france',
    'germany': 'germany',
    'italy': 'italy',
    'united kingdom': 'uk',
    'united states': 'usa',
}
PRODUCTS = {
    'mid-grade motor gasoline': 'gasoline',
    'electricity': 'electricity',
    'natural gas': 'natural_gas',
}
RESIDENTIAL = {'residential', 'resident'}
TRANSPORT = {'transport', 'tottrans'}


def _text(value):
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return ''
    try:
        if pd.isna(value):
            return ''
    except TypeError:
        pass
    return str(value).strip()


def _year(value):
    text = _text(value)
    if not text:
        return None
    try:
        number = float(text)
    except ValueError:
        return text[:4] if text[:4].isdigit() else None
    if pd.isna(number):
        return None
    return str(int(number))


def _number(value):
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if pd.isna(number):
        return None
    return number


def read_household_prices(frame):
    """
    Latest-year household prices for the six comparison countries.

    Gasoline is transport. Electricity and natural gas are residential.
    Returns [(vector, year, value), ...] with vector price|{country}|{product}.
    """
    rows = []
    for _, row in frame.iterrows():
        country = COUNTRIES.get(_text(row.get('Region/Country/Subdivision')).lower())
        product = PRODUCTS.get(_text(row.get('Energy Product')).lower())
        year = _year(row.get('TIME_PERIOD'))
        value = _number(row.get('OBS_VALUE'))
        if not country or not product or not year or value is None:
            continue
        price_label = _text(row.get('Price breakdown')).lower()
        price_code = _text(row.get('PRICE_FLOW')).lower()
        if price_label != 'total price' and price_code != 'price_total':
            continue
        sector = _text(row.get('Sector')).lower() or _text(row.get('SECTOR')).lower()
        if product == 'gasoline':
            if sector not in TRANSPORT:
                continue
        elif sector not in RESIDENTIAL:
            continue
        rows.append((f'price|{country}|{product}', year, value))
    if not rows:
        raise ValueError(f'{SHEET} has no household energy prices for the comparison countries')
    return rows


def build_household_price_indicators(records):
    """One indicator per country, product, and year."""
    rows = []
    seen = set()
    for vector, ref_date, value in records:
        text = str(vector)
        if not text.startswith('price|'):
            continue
        _prefix, country, product = text.split('|', 2)
        year = str(ref_date)[:4]
        if not year.isdigit():
            continue
        key = (country, product, year)
        if key in seen:
            continue
        seen.add(key)
        try:
            number = float(value)
        except (TypeError, ValueError):
            continue
        rows.append((f'hhep_{country}_{product}', year, number))
    return rows


def update_household_energy_prices(processor) -> int:
    """EEDAS ingest: household prices sheet from the IEA workbook."""
    frame = pd.read_excel(resolve_root_xlsx(WORKBOOK), sheet_name=SHEET)
    raw_rows = read_household_prices(frame)
    metadata = [
        (vector, vector, 'price', 'price', SOURCE_ORG, SOURCE_URL)
        for vector in sorted({vector for vector, _year, _value in raw_rows})
    ]
    n = processor.replace_raw_data(SOURCE_KEY, raw_rows, metadata)
    print(f'    Stored {n} raw household energy price rows')
    return n


def transform_household_energy_prices(processor) -> int:
    """EFB transform: country prices by gasoline, electricity, and natural gas."""
    raw_df = processor.repo.get_raw_dataframe(SOURCE_KEY)
    if raw_df is None or raw_df.empty:
        print('    household_energy_prices transform: no raw rows found')
        return 0
    records = [
        (row['vector'], row['ref_date'], row['value'])
        for _, row in raw_df.iterrows()
    ]
    data_rows = build_household_price_indicators(records)
    if not data_rows:
        print('    household_energy_prices transform: no indicator rows produced')
        return 0
    metadata = [
        (vector, vector, 'price', 'price', SOURCE_ORG, SOURCE_URL)
        for vector in sorted({vector for vector, _year, _value in data_rows})
    ]
    n = processor.store_indicators(SOURCE_KEY, data_rows, metadata)
    print(f'    Stored {n} household energy price indicator rows')
    return n


def process_household_energy_prices(processor) -> int:
    update_household_energy_prices(processor)
    return transform_household_energy_prices(processor)
