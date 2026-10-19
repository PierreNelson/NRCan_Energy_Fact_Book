"""Canada's global energy trade — Final Result workbook."""

import re
from decimal import Decimal, ROUND_HALF_UP

import pandas as pd

from xlsx_paths import resolve_root_xlsx

from .constants import GLOBAL_ENERGY_TRADE_XLSX

SOURCE_ORG = 'Natural Resources Canada'
SOURCE_URL = 'https://natural-resources.canada.ca/energy-sources/energy-facts'
SHEET_NAME = 'Final Result'

PRODUCT_KEYS = {
    'coal & coal products': 'coal',
    'coal and coal products': 'coal',
    'crude oil': 'crude',
    'rpps': 'rpp',
    'refined petroleum products': 'rpp',
    'natural gas': 'gas',
    'ngls': 'ngl',
    'natural gas liquids': 'ngl',
    'uranium & thorium': 'uranium',
    'uranium and thorium': 'uranium',
    'electricity': 'electricity',
    'biofuels': 'biofuels',
    'other energy products': 'other',
}

IMPORT_PREFIX = 'imports of '


def _round_half_up(value, digits):
    quant = Decimal('1') if digits == 0 else Decimal('0.' + ('0' * (digits - 1)) + '1')
    return float(Decimal(str(value)).quantize(quant, rounding=ROUND_HALF_UP))


def _clean(value):
    text = re.sub(r'\s+', ' ', str(value or '')).strip()
    if not text or text.lower() == 'nan':
        return ''
    return text


def _number(value):
    if value is None or (isinstance(value, float) and pd.isna(value)) or pd.isna(value):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _year_key(value):
    number = _number(value)
    if number is not None:
        year = int(number)
        if 1990 <= year <= 2100 and abs(number - year) < 1e-6:
            return str(year)
    text = _clean(value)
    if re.fullmatch(r'\d{4}', text):
        return text
    return ''


def _product_key(label):
    name = _clean(label).lower()
    if name.startswith(IMPORT_PREFIX):
        name = name[len(IMPORT_PREFIX):]
    return PRODUCT_KEYS.get(name)


def read_global_energy_trade_records(df):
    """
    Product rows from the billions block of Final Result.

    Returns (year, flow, product_key, signed_value). Imports stay negative.
    The Export/Import total rows and the later dollar-unit block are not ingested.
    """
    header_idx = None
    years = []
    for index, row in df.iterrows():
        parsed = [_year_key(value) for value in row.tolist()]
        found = [year for year in parsed if year]
        if '2017' in found and len(found) >= 2:
            header_idx = index
            years = parsed
            break
    if header_idx is None:
        return []

    records = []
    flow = None
    started = False
    for index in range(header_idx + 1, len(df)):
        row = df.iloc[index]
        flow_label = _clean(row.iloc[0]).lower()
        product_label = _clean(row.iloc[1]) if len(row) > 1 else ''
        if flow_label == 'exports' and not product_label and _year_key(row.iloc[2] if len(row) > 2 else None):
            break
        if flow_label in {'exports', 'imports'}:
            flow = 'exp' if flow_label == 'exports' else 'imp'
        if flow_label == 'zero line' or product_label.lower() in {'export', 'import', 'grand total'}:
            continue
        product = _product_key(product_label)
        if not product or flow not in {'exp', 'imp'}:
            if started and product_label:
                break
            continue
        started = True
        for col, year in enumerate(years):
            if not year or col >= len(row):
                continue
            value = _number(row.iloc[col])
            if value is None:
                continue
            if abs(value) > 10000:
                return records
            signed = value if flow == 'exp' else -abs(value)
            records.append((year, flow, product, signed))
    return records


def build_global_energy_trade_indicators(records):
    """
    Product values stay signed. Annual totals are calculated here:
    exports are the sum of export products, imports are the absolute value of
    the import sum. Cumulative 2017-to-reporting-year totals are stored on the
    latest year.
    """
    products = {}
    for year, flow, product, value in records:
        year_key = str(year).strip()
        if year_key.endswith('.0'):
            year_key = year_key[:-2]
        number = _number(value)
        if not year_key or number is None or flow not in {'exp', 'imp'} or product not in PRODUCT_KEYS.values():
            continue
        products[(year_key, flow, product)] = float(number)

    if not products:
        return []

    rows = []
    totals = {}
    for (year, flow, product), value in sorted(products.items()):
        rows.append((f'gtrade_{flow}_{product}', year, _round_half_up(value, 4)))
        bucket = totals.setdefault(year, {'exp': 0.0, 'imp': 0.0})
        bucket[flow] += value

    for year, bucket in sorted(totals.items()):
        rows.append(('gtrade_exp_total', year, _round_half_up(bucket['exp'], 4)))
        rows.append(('gtrade_imp_total', year, _round_half_up(abs(bucket['imp']), 4)))

    years = sorted(totals)
    end_year = years[-1]
    cum_exp = sum(totals[year]['exp'] for year in years)
    cum_imp = sum(abs(totals[year]['imp']) for year in years)
    rows.append(('gtrade_cum_exp_billion', end_year, _round_half_up(cum_exp, 4)))
    rows.append(('gtrade_cum_imp_billion', end_year, _round_half_up(cum_imp, 4)))
    return rows


def narrative_display(exp_billion, imp_billion):
    """Rounded narrative amounts and nearly/over qualifiers."""
    exp_trillion = float(exp_billion) / 1000.0
    exp_shown = _round_half_up(exp_trillion, 1)
    imp_shown = _round_half_up(float(imp_billion), 0)

    def qualifier(shown, underlying):
        if shown > underlying:
            return 'nearly'
        if shown < underlying:
            return 'over'
        return ''

    return exp_shown, qualifier(exp_shown, exp_trillion), imp_shown, qualifier(imp_shown, float(imp_billion))


def _indicator_metadata():
    rows = []
    for key in sorted(set(PRODUCT_KEYS.values())):
        rows.append((f'gtrade_exp_{key}', f'{key} exports', 'billions of real 2025 CAD', 'billions of dollars', SOURCE_ORG, SOURCE_URL))
        rows.append((f'gtrade_imp_{key}', f'{key} imports', 'billions of real 2025 CAD', 'billions of dollars', SOURCE_ORG, SOURCE_URL))
    rows.append(('gtrade_exp_total', 'Total exports', 'billions of real 2025 CAD', 'billions of dollars', SOURCE_ORG, SOURCE_URL))
    rows.append(('gtrade_imp_total', 'Total imports', 'billions of real 2025 CAD', 'billions of dollars', SOURCE_ORG, SOURCE_URL))
    rows.append(('gtrade_cum_exp_billion', 'Cumulative exports', 'billions of real 2025 CAD', 'billions of dollars', SOURCE_ORG, SOURCE_URL))
    rows.append(('gtrade_cum_imp_billion', 'Cumulative imports', 'billions of real 2025 CAD', 'billions of dollars', SOURCE_ORG, SOURCE_URL))
    return rows


def update_global_energy_trade(processor) -> int:
    """EEDAS ingest: signed product values from Final Result. Totals are not stored raw."""
    excel_path = resolve_root_xlsx(GLOBAL_ENERGY_TRADE_XLSX)
    df = pd.read_excel(excel_path, sheet_name=SHEET_NAME, header=None)
    records = read_global_energy_trade_records(df)
    data_rows = []
    metadata = {}
    for year, flow, product, value in records:
        vector = f'{flow}|{product}'
        data_rows.append((vector, year, round(float(value), 8)))
        metadata.setdefault(vector, (
            vector,
            f'{flow} {product}',
            'billions of real 2025 CAD',
            'billions of dollars',
            SOURCE_ORG,
            SOURCE_URL,
        ))
    if not data_rows:
        return 0
    n = processor.replace_raw_data('global_energy_trade', data_rows, list(metadata.values()))
    print(f'    Stored {n} raw global energy trade rows')
    return n


def transform_global_energy_trade(processor) -> int:
    """EFB transform: product series plus calculated annual and cumulative totals."""
    raw_df = processor.repo.get_raw_dataframe('global_energy_trade')
    if raw_df is None or raw_df.empty:
        print('    Warning: No raw global energy trade data in database')
        return 0

    records = []
    for _, row in raw_df.iterrows():
        vector = str(row['vector'])
        if '|' not in vector:
            continue
        flow, product = vector.split('|', 1)
        records.append((str(row['ref_date']), flow, product, row['value']))

    data_rows = build_global_energy_trade_indicators(records)
    if not data_rows:
        return 0
    print(f'    Processed {len(data_rows)} indicator rows')
    return processor.store_indicators('global_energy_trade', data_rows, _indicator_metadata())


def process_global_energy_trade(processor) -> int:
    """Run ingest then transform."""
    update_global_energy_trade(processor)
    return transform_global_energy_trade(processor)
