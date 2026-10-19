"""Energy and GHG emissions — page 18, and the indexed intensity chart on page 19."""

import io
from collections import defaultdict
from datetime import date

import pandas as pd

from utils.http_retry import fetch_get, resilience_from_config
from xlsx_paths import resolve_root_xlsx

SOURCE_KEY = 'energy_and_ghg_emissions'
BASE_YEAR = 2000

CLIMATE_WATCH_URL = 'https://www.climatewatchdata.org/api/v1/data/historical_emissions'
CLIMATE_WATCH_SOURCE_ID = 274
CLIMATE_WATCH_GAS_ID = 553  # All GHG
CLIMATE_WATCH_TOTAL_SECTOR_ID = 3208  # Total excluding LULUCF
CLIMATE_WATCH_ENERGY_SECTOR_ID = 3210  # Energy
CLIMATE_WATCH_WORLD = 'WORLD'

IPCC_CSV_PATH = (
    '/substances/monitor/canada-s-official-greenhouse-gas-inventory'
    '/A-IPCC-Sector/GHG_IPCC_Can_Prov_Terr.csv'
)
IPCC_URLS = [
    f'https://data-donnees.ec.gc.ca/api/file?path={IPCC_CSV_PATH.replace("/", "%2F")}',
    f'https://data-donnees.az.ec.gc.ca/api/file?path={IPCC_CSV_PATH.replace("/", "%2F")}',
]
IPCC_NATIONAL_SOURCES = ('Total', 'National Inventory Total')
ANNEX_XLSX = 'Annex 4 Table A4-1_NRCan_2026-04-01.xlsx'
ANNEX_SHEET = 'Annex Table A4-1'
ANNEX_ROW = 'Reference Approach (PJ)'

GDP_VECTOR = '65201756'
POPULATION_VECTOR = '466668'
GDP_URL = 'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=3610043401'
POPULATION_URL = 'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=1710000501'

REQUEST_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (compatible; NRCan-Energy-Factbook/1.0)',
    'Accept': 'application/json,text/csv,*/*',
}


def _year_of(ref_date):
    text = str(ref_date).strip()
    if len(text) >= 4 and text[:4].isdigit():
        return int(text[:4])
    return None


def _as_float(value):
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if number != number:
        return None
    return number


def parse_climate_watch_payload(payload):
    """World All GHG series, in Mt CO2e, from 2000 onward."""
    rows = []
    for row in payload.get('data') or []:
        if str(row.get('iso_code3') or '').upper() != CLIMATE_WATCH_WORLD:
            continue
        sector = str(row.get('sector') or '')
        if sector == 'Energy':
            vector = 'cw|energy'
        elif sector == 'Total excluding LULUCF':
            vector = 'cw|total'
        else:
            continue
        for point in row.get('emissions') or []:
            year = _year_of(point.get('year'))
            value = _as_float(point.get('value'))
            if year is None or year < BASE_YEAR or value is None:
                continue
            rows.append((vector, str(year), value))
    return rows


def parse_ipcc_frame(df):
    """Canada energy and national-total CO2eq, in kt, category blank and Total = y."""
    rows = []
    if df is None or df.empty:
        return rows
    region = df['Region'].astype(str).str.strip().eq('Canada')
    category = df['Category']
    blank_category = category.isna() | category.astype(str).str.strip().isin(('', 'nan', 'None'))
    total_flag = df['Total'].astype(str).str.strip().str.lower().eq('y')
    source = df['Source'].astype(str).str.strip()
    picked = df[region & blank_category & total_flag & source.isin(IPCC_NATIONAL_SOURCES + ('Energy',))]
    for _, row in picked.iterrows():
        year = _year_of(row.get('Year'))
        value = _as_float(row.get('CO2eq'))
        if year is None or year < BASE_YEAR or value is None:
            continue
        label = str(row.get('Source')).strip()
        vector = 'ipcc|energy' if label == 'Energy' else 'ipcc|total'
        rows.append((vector, str(year), value))
    return rows


def parse_annex_frame(df):
    """Reference Approach (PJ) from Annex Table A4-1. Years are the first row."""
    rows = []
    if df is None or df.empty:
        return rows
    label_col = 1 if df.shape[1] > 1 else 0
    match = df.index[df.iloc[:, label_col].astype(str).str.strip().eq(ANNEX_ROW)]
    if len(match) == 0:
        return rows
    value_row = df.loc[match[0]]
    year_row = df.iloc[0]
    for col in range(label_col + 1, df.shape[1]):
        year = _year_of(year_row.iloc[col])
        value = _as_float(value_row.iloc[col])
        if year is None or year < BASE_YEAR or value is None:
            continue
        rows.append(('enduse|pj', str(year), value))
    return rows


def _complete_average(points, expected):
    if len(points) != expected:
        return None
    return sum(points) / len(points)


def build_energy_and_ghg_indicators(records):
    """
    Shares, intensity ratios, and 2000=100 indexes.

    GDP is the average of a complete 12-month year. Population is the single
    annual estimate. Indexes are emitted only for years that have Canada's
    total emissions, GDP, population, and end-use energy, including 2000.
    """
    grouped = defaultdict(lambda: defaultdict(list))
    for vector, ref_date, value in records:
        year = _year_of(ref_date)
        number = _as_float(value)
        if year is None or number is None:
            continue
        grouped[str(vector)][year].append(number)

    def annual(vector, expected):
        out = {}
        for year, points in grouped.get(vector, {}).items():
            value = _complete_average(points, expected)
            if value is not None and year >= BASE_YEAR:
                out[year] = value
        return out

    global_total = annual('cw|total', 1)
    global_energy = annual('cw|energy', 1)
    canada_total = annual('ipcc|total', 1)
    canada_energy = annual('ipcc|energy', 1)
    population = annual(f'pop|{POPULATION_VECTOR}', 1)
    end_use = annual('enduse|pj', 1)
    gdp = annual(f'gdp|{GDP_VECTOR}', 12)

    rows = []

    def add(vector, year, value):
        rows.append((vector, str(year), float(value)))

    for year in sorted(set(global_total) & set(global_energy)):
        total = global_total[year]
        energy = global_energy[year]
        if total == 0:
            continue
        add('eghg_global_total_mt', year, total)
        add('eghg_global_energy_mt', year, energy)
        add('eghg_global_energy_share', year, energy / total * 100.0)

    for year in sorted(set(canada_total) & set(canada_energy)):
        total = canada_total[year]
        energy = canada_energy[year]
        if total == 0:
            continue
        add('eghg_canada_total_kt', year, total)
        add('eghg_canada_energy_kt', year, energy)
        add('eghg_canada_energy_share', year, energy / total * 100.0)

    for year, value in sorted(gdp.items()):
        add('eghg_gdp_million', year, value)
    for year, value in sorted(population.items()):
        add('eghg_population', year, value)
    for year, value in sorted(end_use.items()):
        add('eghg_end_use_pj', year, value)

    common = set(canada_total) & set(gdp) & set(population) & set(end_use)
    if BASE_YEAR not in common:
        return rows
    base_total = canada_total[BASE_YEAR]
    base_gdp = gdp[BASE_YEAR]
    base_pop = population[BASE_YEAR]
    base_energy = end_use[BASE_YEAR]
    if base_total == 0 or base_gdp == 0 or base_pop == 0 or base_energy == 0:
        return rows
    base_per_gdp = base_total / base_gdp
    base_per_capita = base_total / base_pop
    base_per_pj = base_total / base_energy

    for year in sorted(common):
        total = canada_total[year]
        per_gdp = total / gdp[year]
        per_capita = total / population[year]
        per_pj = total / end_use[year]
        add('eghg_per_gdp', year, per_gdp)
        add('eghg_per_capita', year, per_capita)
        add('eghg_per_pj', year, per_pj)
        add('eghg_index_gdp', year, per_gdp / base_per_gdp * 100.0)
        add('eghg_index_capita', year, per_capita / base_per_capita * 100.0)
        add('eghg_index_energy', year, per_pj / base_per_pj * 100.0)
    return rows


def _fetch_climate_watch(max_retries, retry_delay):
    response = fetch_get(
        CLIMATE_WATCH_URL,
        timeout=120,
        headers=REQUEST_HEADERS,
        params={
            'source_ids[]': CLIMATE_WATCH_SOURCE_ID,
            'gas_ids[]': CLIMATE_WATCH_GAS_ID,
            'sector_ids[]': [CLIMATE_WATCH_TOTAL_SECTOR_ID, CLIMATE_WATCH_ENERGY_SECTOR_ID],
            'start_year': BASE_YEAR,
            'per_page': 500,
        },
        max_retries=max_retries,
        retry_delay_seconds=retry_delay,
        label='Climate Watch',
    )
    rows = parse_climate_watch_payload(response.json())
    if not rows:
        raise RuntimeError('Climate Watch returned no World energy or total GHG rows')
    print(f'  Climate Watch World rows: {len(rows)}')
    return rows


def _fetch_ipcc(max_retries, retry_delay):
    last_error = None
    for url in IPCC_URLS:
        try:
            response = fetch_get(
                url,
                timeout=180,
                headers=REQUEST_HEADERS,
                max_retries=max_retries,
                retry_delay_seconds=retry_delay,
                label='IPCC GHG CSV',
            )
            content = response.content
            if not content or b'Year' not in content[:800]:
                raise ValueError('Response does not look like the IPCC GHG CSV')
            frame = pd.read_csv(io.BytesIO(content))
            rows = parse_ipcc_frame(frame)
            if not rows:
                raise RuntimeError('IPCC CSV has no Canada energy or national total rows')
            print(f'  IPCC Canada rows: {len(rows)}')
            return rows
        except Exception as exc:
            last_error = exc
            print(f'  Warning: IPCC CSV fetch failed for {url}: {exc}')
    raise RuntimeError(f'Could not download GHG_IPCC_Can_Prov_Terr.csv: {last_error}')


def _read_annex_rows():
    path = resolve_root_xlsx(ANNEX_XLSX)
    frame = pd.read_excel(path, sheet_name=ANNEX_SHEET, header=None)
    rows = parse_annex_frame(frame)
    if not rows:
        raise RuntimeError(f'{ANNEX_XLSX} has no {ANNEX_ROW} values')
    print(f'  Annex end-use rows: {len(rows)}')
    return rows


def update_energy_and_ghg_emissions(processor) -> int:
    """EEDAS ingest: Climate Watch, ECCC IPCC, StatCan GDP and population, Annex 4."""
    max_retries, retry_delay = resilience_from_config(processor.config)
    data_rows = []
    data_rows.extend(_fetch_climate_watch(max_retries, retry_delay))
    data_rows.extend(_fetch_ipcc(max_retries, retry_delay))
    data_rows.extend(_read_annex_rows())
    points = processor.fetch_wds_vector_data(
        [GDP_VECTOR, POPULATION_VECTOR],
        start_ref=f'{BASE_YEAR}-01-01',
        end_ref=f'{date.today().year + 1}-12-31',
    )
    for vector_id, ref_date, value in points:
        prefix = 'gdp' if str(vector_id) == GDP_VECTOR else 'pop'
        data_rows.append((f'{prefix}|{vector_id}', str(ref_date), float(value)))
    if not any(vector.startswith('gdp|') for vector, _ref, _value in data_rows):
        raise RuntimeError('StatCan returned no GDP rows for v65201756')
    if not any(vector.startswith('pop|') for vector, _ref, _value in data_rows):
        raise RuntimeError('StatCan returned no population rows for v466668')

    metadata = [
        ('cw|total', 'World total GHG excluding LULUCF', 'Mt CO2e', 'megatonnes', 'Climate Watch', CLIMATE_WATCH_URL),
        ('cw|energy', 'World energy GHG', 'Mt CO2e', 'megatonnes', 'Climate Watch', CLIMATE_WATCH_URL),
        ('ipcc|total', 'Canada national total GHG', 'kt CO2e', 'kilotonnes', 'Environment and Climate Change Canada', IPCC_URLS[0]),
        ('ipcc|energy', 'Canada energy GHG', 'kt CO2e', 'kilotonnes', 'Environment and Climate Change Canada', IPCC_URLS[0]),
        ('enduse|pj', 'Canada reference-approach end-use energy', 'PJ', 'petajoules', 'Natural Resources Canada', ANNEX_XLSX),
        (f'gdp|{GDP_VECTOR}', 'GDP at basic prices, monthly', 'million dollars', 'millions', 'Statistics Canada', GDP_URL),
        (f'pop|{POPULATION_VECTOR}', 'Population estimates', 'persons', 'persons', 'Statistics Canada', POPULATION_URL),
    ]
    n = processor.replace_raw_data(SOURCE_KEY, data_rows, metadata)
    print(f'    Stored {n} raw energy and GHG rows')
    return n


def transform_energy_and_ghg_emissions(processor) -> int:
    """EFB transform: shares, ratios, and indexed intensity series."""
    raw_df = processor.repo.get_raw_dataframe(SOURCE_KEY)
    if raw_df is None or raw_df.empty:
        print('    energy_and_ghg_emissions transform: no raw rows found')
        return 0
    records = [
        (row['vector'], row['ref_date'], row['value'])
        for _, row in raw_df.iterrows()
    ]
    data_rows = build_energy_and_ghg_indicators(records)
    if not data_rows:
        print('    energy_and_ghg_emissions transform: no indicator rows produced')
        return 0
    metadata = [
        ('eghg_global_total_mt', 'Global total GHG emissions', 'Mt CO2e', 'megatonnes', 'Climate Watch', CLIMATE_WATCH_URL),
        ('eghg_global_energy_mt', 'Global energy GHG emissions', 'Mt CO2e', 'megatonnes', 'Climate Watch', CLIMATE_WATCH_URL),
        ('eghg_global_energy_share', 'Global energy share of GHG emissions', 'percent', 'percent', 'Climate Watch', CLIMATE_WATCH_URL),
        ('eghg_canada_total_kt', 'Canada total GHG emissions', 'kt CO2e', 'kilotonnes', 'Environment and Climate Change Canada', IPCC_URLS[0]),
        ('eghg_canada_energy_kt', 'Canada energy GHG emissions', 'kt CO2e', 'kilotonnes', 'Environment and Climate Change Canada', IPCC_URLS[0]),
        ('eghg_canada_energy_share', 'Canada energy share of GHG emissions', 'percent', 'percent', 'Environment and Climate Change Canada', IPCC_URLS[0]),
        ('eghg_gdp_million', 'Canada GDP at basic prices', 'million dollars', 'millions', 'Statistics Canada', GDP_URL),
        ('eghg_population', 'Canada population', 'persons', 'persons', 'Statistics Canada', POPULATION_URL),
        ('eghg_end_use_pj', 'Canada end-use energy', 'PJ', 'petajoules', 'Natural Resources Canada', ANNEX_XLSX),
        ('eghg_per_gdp', 'GHG emissions per million dollars of GDP', 'kt per million dollars', 'ratio', 'Natural Resources Canada', IPCC_URLS[0]),
        ('eghg_per_capita', 'GHG emissions per person', 'kt per person', 'ratio', 'Natural Resources Canada', IPCC_URLS[0]),
        ('eghg_per_pj', 'GHG emissions per petajoule', 'kt per PJ', 'ratio', 'Natural Resources Canada', IPCC_URLS[0]),
        ('eghg_index_gdp', 'Indexed GHG emissions per dollar of GDP', 'index', '2000=100', 'Natural Resources Canada', IPCC_URLS[0]),
        ('eghg_index_capita', 'Indexed GHG emissions per capita', 'index', '2000=100', 'Natural Resources Canada', IPCC_URLS[0]),
        ('eghg_index_energy', 'Indexed GHG emissions per petajoule', 'index', '2000=100', 'Natural Resources Canada', IPCC_URLS[0]),
    ]
    n = processor.store_indicators(SOURCE_KEY, data_rows, metadata)
    print(f'    Stored {n} energy and GHG indicator rows')
    return n


def process_energy_and_ghg_emissions(processor) -> int:
    update_energy_and_ghg_emissions(processor)
    return transform_energy_and_ghg_emissions(processor)
