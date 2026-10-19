"""Household expenditures on energy — page 44."""

import csv
import io
import zipfile
from collections import defaultdict
from datetime import date

from utils.http_retry import fetch_get, resilience_from_config

SOURCE_KEY = 'household_energy_expenditures'
CPI_URL = 'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=1810000401'
CPI_ZIP_URL = 'https://www150.statcan.gc.ca/n1/tbl/csv/18100004-eng.zip'
SPENDING_URL = 'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=1110022201'

# Table 18-10-0004-01, Canada, 2002=100. Monthly values are stored raw.
CPI_VECTORS = {
    '41691239': 'energy',
    '41690973': 'total',
    '41691238': 'excluding',
}
# Table 11-10-0222-01. Residential energy is the first three; vehicle fuel is the fourth.
RESIDENTIAL_VECTORS = ('64469129', '64469130', '64469131')
VEHICLE_VECTOR = '64469236'
INCOME_VECTOR = '54325509'
SPENDING_VECTORS = RESIDENTIAL_VECTORS + (VEHICLE_VECTOR, INCOME_VECTOR)
CPI_START = '2002-01-01'


def _year_of(ref_date):
    text = str(ref_date).strip()
    if len(text) >= 4 and text[:4].isdigit():
        return int(text[:4])
    return None


def _month_ref(ref_date):
    text = str(ref_date).strip()
    if len(text) >= 7 and text[4] == '-' and text[5:7].isdigit():
        return f'{text[:7]}-01'
    return text


def _annual_points(spending, vector_id):
    out = {}
    for year, points in spending.get(vector_id, {}).items():
        unique = {round(point, 6) for point in points}
        if len(unique) == 1:
            out[year] = points[0]
    return out


def _cpi_rows_from_points(points):
    rows = []
    for vector_id, ref_date, value in points:
        code = CPI_VECTORS.get(str(vector_id).lstrip('vV'))
        if not code:
            continue
        ref = _month_ref(ref_date)
        if ref < CPI_START:
            continue
        try:
            number = float(value)
        except (TypeError, ValueError):
            continue
        rows.append((f'cpi|{code}', ref, number))
    return rows


def _cpi_rows_from_zip(content):
    """Canada monthly rows from the published table 18-10-0004-01 CSV."""
    with zipfile.ZipFile(io.BytesIO(content)) as archive:
        name = next(entry for entry in archive.namelist() if entry.endswith('.csv') and 'Meta' not in entry)
        with archive.open(name) as handle:
            reader = csv.DictReader(io.TextIOWrapper(handle, encoding='utf-8-sig', newline=''))
            points = []
            for row in reader:
                vector = str(row.get('VECTOR') or '').lstrip('vV')
                if vector not in CPI_VECTORS:
                    continue
                if row.get('GEO') != 'Canada':
                    continue
                raw_value = row.get('VALUE')
                if raw_value in (None, ''):
                    continue
                points.append((vector, row.get('REF_DATE'), raw_value))
    return _cpi_rows_from_points(points)


def build_household_expenditure_indicators(records):
    """Annual CPI averages, plus the latest-capable expenditure narrative series."""
    monthly = defaultdict(lambda: defaultdict(list))
    spending = defaultdict(lambda: defaultdict(list))
    for vector, ref_date, value in records:
        vector = str(vector)
        try:
            number = float(value)
        except (TypeError, ValueError):
            continue
        if vector.startswith('cpi|'):
            year = _year_of(ref_date)
            ref = _month_ref(ref_date)
            if year is None or ref < CPI_START:
                continue
            monthly[vector.split('|', 1)[1]][year].append(number)
            continue
        if not vector.startswith('spend|'):
            continue
        year = _year_of(ref_date)
        if year is None:
            continue
        spending[vector.split('|', 1)[1]][year].append(number)

    rows = []
    for code in CPI_VECTORS.values():
        for year, points in sorted(monthly.get(code, {}).items()):
            if not points:
                continue
            rows.append((f'hexp_cpi_{code}', str(year), sum(points) / len(points)))

    residential = [_annual_points(spending, vector_id) for vector_id in RESIDENTIAL_VECTORS]
    vehicle = _annual_points(spending, VEHICLE_VECTOR)
    income = _annual_points(spending, INCOME_VECTOR)
    common = set(vehicle) & set(income)
    for series in residential:
        common &= set(series)
    for year in sorted(common):
        if income[year] == 0:
            continue
        home = sum(series[year] for series in residential)
        total = home + vehicle[year]
        rows.append(('hexp_amount_residential', str(year), home))
        rows.append(('hexp_amount_vehicle', str(year), vehicle[year]))
        rows.append(('hexp_amount_total', str(year), total))
        rows.append(('hexp_income_share', str(year), total / income[year] * 100.0))
    return rows


def update_household_energy_expenditures(processor) -> int:
    """EEDAS ingest: monthly CPI and household spending vectors."""
    end_ref = f'{date.today().year + 1}-12-31'
    points = processor.fetch_wds_vector_data(
        list(CPI_VECTORS),
        start_ref=CPI_START,
        end_ref=end_ref,
    )
    cpi_rows = _cpi_rows_from_points(points)
    if not cpi_rows:
        print('  CPI vector service returned no rows; reading the published table file')
        max_retries, retry_delay = resilience_from_config(processor.config)
        response = fetch_get(
            CPI_ZIP_URL,
            timeout=180,
            headers={'User-Agent': 'Mozilla/5.0 (compatible; NRCan-Energy-Factbook/1.0)'},
            max_retries=max_retries,
            retry_delay_seconds=retry_delay,
            label='CPI table 18-10-0004-01',
        )
        cpi_rows = _cpi_rows_from_zip(response.content)
    if not cpi_rows:
        raise RuntimeError('StatCan returned no consumer price index rows')
    print(f'  CPI monthly rows: {len(cpi_rows)}')

    spend_points = processor.fetch_wds_vector_data(
        list(SPENDING_VECTORS),
        start_ref='1997-01-01',
        end_ref=end_ref,
    )
    data_rows = list(cpi_rows)
    for vector_id, ref_date, value in spend_points:
        data_rows.append((f'spend|{vector_id}', str(ref_date), float(value)))
    if not any(str(vector).startswith('spend|') for vector, _ref, _value in data_rows):
        raise RuntimeError('StatCan returned no household spending rows')

    metadata = [
        ('cpi|energy', 'Energy consumer price index', 'index', '2002=100', 'Statistics Canada', CPI_URL),
        ('cpi|total', 'All-items consumer price index', 'index', '2002=100', 'Statistics Canada', CPI_URL),
        ('cpi|excluding', 'Consumer price index excluding energy', 'index', '2002=100', 'Statistics Canada', CPI_URL),
        (f'spend|{INCOME_VECTOR}', 'Average disposable income', 'dollars', 'dollars', 'Statistics Canada', SPENDING_URL),
        (f'spend|{VEHICLE_VECTOR}', 'Vehicle and tools fuel expenditure', 'dollars', 'dollars', 'Statistics Canada', SPENDING_URL),
    ]
    for vector_id in RESIDENTIAL_VECTORS:
        metadata.append((
            f'spend|{vector_id}',
            'Residential energy expenditure component',
            'dollars',
            'dollars',
            'Statistics Canada',
            SPENDING_URL,
        ))
    n = processor.replace_raw_data(SOURCE_KEY, data_rows, metadata)
    print(f'    Stored {n} raw household expenditure rows')
    return n


def transform_household_energy_expenditures(processor) -> int:
    """EFB transform: annual CPI averages and household energy expenditure narrative."""
    raw_df = processor.repo.get_raw_dataframe(SOURCE_KEY)
    if raw_df is None or raw_df.empty:
        print('    household_energy_expenditures transform: no raw rows found')
        return 0
    records = [
        (row['vector'], row['ref_date'], row['value'])
        for _, row in raw_df.iterrows()
    ]
    data_rows = build_household_expenditure_indicators(records)
    if not data_rows:
        print('    household_energy_expenditures transform: no indicator rows produced')
        return 0
    metadata = [
        ('hexp_cpi_energy', 'Energy CPI annual average', 'index', '2002=100', 'Statistics Canada', CPI_URL),
        ('hexp_cpi_total', 'Total CPI annual average', 'index', '2002=100', 'Statistics Canada', CPI_URL),
        ('hexp_cpi_excluding', 'CPI excluding energy annual average', 'index', '2002=100', 'Statistics Canada', CPI_URL),
        ('hexp_amount_total', 'Average household energy expenditure', 'dollars', 'dollars', 'Statistics Canada', SPENDING_URL),
        ('hexp_amount_residential', 'Average residential energy expenditure', 'dollars', 'dollars', 'Statistics Canada', SPENDING_URL),
        ('hexp_amount_vehicle', 'Average vehicle and tools fuel expenditure', 'dollars', 'dollars', 'Statistics Canada', SPENDING_URL),
        ('hexp_income_share', 'Energy share of household spending', 'percent', 'percent', 'Statistics Canada', SPENDING_URL),
    ]
    n = processor.store_indicators(SOURCE_KEY, data_rows, metadata)
    print(f'    Stored {n} household expenditure indicator rows')
    return n


def process_household_energy_expenditures(processor) -> int:
    update_household_energy_expenditures(processor)
    return transform_household_energy_expenditures(processor)
