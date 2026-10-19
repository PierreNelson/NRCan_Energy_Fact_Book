"""Energy poverty rates by geography — page 43."""

import re
from collections import defaultdict
from datetime import date

from utils.http_retry import fetch_get, resilience_from_config

SOURCE_KEY = 'energy_poverty_geography'
CENSUS_URL = 'https://www150.statcan.gc.ca/n1/pub/46-28-0001/2024001/article/00001-eng.htm'
SPENDING_URL = 'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=1110022201'
HOME_ENERGY_VECTORS = ('64469129', '64469130', '64469131')
INCOME_VECTOR = '54325509'

# Chart 1 row labels, in the order shown on the page.
RATE_LABELS = {
    'Can.': 'can',
    'N.L.': 'nl',
    'P.E.I.': 'pei',
    'N.S.': 'ns',
    'N.B.': 'nb',
    'Que.': 'que',
    'Ont.': 'ont',
    'Man.': 'man',
    'Sask.': 'sask',
    'Alta.': 'alta',
    'B.C.': 'bc',
    'Y.T.': 'yt',
    'N.W.T.': 'nwt',
    'Nvt.': 'nvt',
}


def _year_of(ref_date):
    text = str(ref_date).strip()
    if len(text) >= 4 and text[:4].isdigit():
        return int(text[:4])
    return None


def _plain(fragment):
    text = re.sub(r'<[^>]+>', '', fragment)
    text = text.replace('&nbsp;', ' ').replace('\xa0', ' ')
    return re.sub(r'\s+', ' ', text).strip()


def parse_geography_rates(html):
    """
    Chart 1 rates: non-farm households with after-tax income greater than zero.

    Returns (census_year, [(vector, year, rate_percent), ...]).
    """
    start = html.lower().find('data table for chart 1')
    if start < 0:
        start = html.lower().find('chart 1')
    if start < 0:
        raise ValueError('Census article has no Chart 1 data table')
    end = html.lower().find('</table>', start)
    table = html[start:end if end > start else start + 12000]
    year_match = re.search(r'Census of Population,\s*(\d{4})', html[start:start + 20000])
    census_year = year_match.group(1) if year_match else '2021'
    found = {}
    for stub, cell in re.findall(
        r'class="[^"]*row-stub[^"]*"[^>]*>(.*?)</th>\s*<td[^>]*>(.*?)</td>',
        table,
        flags=re.I | re.S,
    ):
        label = _plain(stub)
        value = _plain(cell).replace(',', '')
        if label in RATE_LABELS and re.fullmatch(r'[0-9]+(?:\.[0-9]+)?', value):
            found[label] = float(value)
    missing = [label for label in RATE_LABELS if label not in found]
    if missing:
        raise ValueError(f'Chart 1 is missing {", ".join(missing)}')
    rows = [(f'rate|{RATE_LABELS[label]}', census_year, found[label]) for label in RATE_LABELS]
    return census_year, rows


def build_energy_poverty_indicators(records):
    """Geography rates, plus in-home energy spending and its income share."""
    rates = {}
    spending = defaultdict(lambda: defaultdict(list))
    for vector, ref_date, value in records:
        vector = str(vector)
        try:
            number = float(value)
        except (TypeError, ValueError):
            continue
        if vector.startswith('rate|'):
            year = _year_of(ref_date)
            if year is None:
                continue
            rates[(vector.split('|', 1)[1], year)] = number
            continue
        if not vector.startswith('spend|'):
            continue
        year = _year_of(ref_date)
        if year is None:
            continue
        spending[vector.split('|', 1)[1]][year].append(number)

    def annual(vector_id):
        out = {}
        for year, points in spending.get(vector_id, {}).items():
            unique = {round(point, 6) for point in points}
            if len(unique) == 1:
                out[year] = points[0]
        return out

    parts = [annual(vector_id) for vector_id in HOME_ENERGY_VECTORS]
    income = annual(INCOME_VECTOR)
    common = set(income)
    for series in parts:
        common &= set(series)

    rows = []
    for code, year in sorted(rates):
        rows.append((f'epov_{code}', str(year), rates[(code, year)]))
    for year in sorted(common):
        if income[year] == 0:
            continue
        amount = sum(series[year] for series in parts)
        rows.append((f'epov_home_energy', str(year), amount))
        rows.append((f'epov_income_share', str(year), amount / income[year] * 100.0))
    return rows


def update_energy_poverty_geography(processor) -> int:
    """EEDAS ingest: census Chart 1 and StatCan household spending vectors."""
    max_retries, retry_delay = resilience_from_config(processor.config)
    response = fetch_get(
        CENSUS_URL,
        timeout=90,
        headers={'User-Agent': 'Mozilla/5.0 (compatible; NRCan-Energy-Factbook/1.0)'},
        max_retries=max_retries,
        retry_delay_seconds=retry_delay,
        label='Census energy poverty article',
    )
    census_year, rate_rows = parse_geography_rates(response.text)
    print(f'  Census {census_year} geography rates: {len(rate_rows)}')

    points = processor.fetch_wds_vector_data(
        list(HOME_ENERGY_VECTORS) + [INCOME_VECTOR],
        start_ref='2000-01-01',
        end_ref=f'{date.today().year + 1}-12-31',
    )
    data_rows = list(rate_rows)
    for vector_id, ref_date, value in points:
        data_rows.append((f'spend|{vector_id}', str(ref_date), float(value)))
    if not any(str(vector).startswith('spend|') for vector, _ref, _value in data_rows):
        raise RuntimeError('StatCan returned no household spending rows')

    metadata = [
        ('rate|can', 'Canada energy poverty rate', 'percent', 'percent', 'Statistics Canada', CENSUS_URL),
        (f'spend|{INCOME_VECTOR}', 'Average disposable income', 'dollars', 'dollars', 'Statistics Canada', SPENDING_URL),
    ]
    for vector_id in HOME_ENERGY_VECTORS:
        metadata.append((
            f'spend|{vector_id}',
            'In-home energy expenditure component',
            'dollars',
            'dollars',
            'Statistics Canada',
            SPENDING_URL,
        ))
    n = processor.replace_raw_data(SOURCE_KEY, data_rows, metadata)
    print(f'    Stored {n} raw energy poverty rows')
    return n


def transform_energy_poverty_geography(processor) -> int:
    """EFB transform: rates, in-home energy expenditure, and income share."""
    raw_df = processor.repo.get_raw_dataframe(SOURCE_KEY)
    if raw_df is None or raw_df.empty:
        print('    energy_poverty_geography transform: no raw rows found')
        return 0
    records = [
        (row['vector'], row['ref_date'], row['value'])
        for _, row in raw_df.iterrows()
    ]
    data_rows = build_energy_poverty_indicators(records)
    if not data_rows:
        print('    energy_poverty_geography transform: no indicator rows produced')
        return 0
    metadata = [
        ('epov_home_energy', 'Average in-home energy expenditure', 'dollars', 'dollars', 'Statistics Canada', SPENDING_URL),
        ('epov_income_share', 'In-home energy share of disposable income', 'percent', 'percent', 'Statistics Canada', SPENDING_URL),
    ]
    for code in RATE_LABELS.values():
        metadata.append((
            f'epov_{code}',
            f'{code} energy poverty rate',
            'percent',
            'percent',
            'Statistics Canada',
            CENSUS_URL,
        ))
    n = processor.store_indicators(SOURCE_KEY, data_rows, metadata)
    print(f'    Stored {n} energy poverty indicator rows')
    return n


def process_energy_poverty_geography(processor) -> int:
    update_energy_poverty_geography(processor)
    return transform_energy_poverty_geography(processor)
