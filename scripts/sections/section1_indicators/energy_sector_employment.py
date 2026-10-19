"""Employment in Canada's energy sector — page 9."""

from collections import defaultdict
from datetime import date
from decimal import Decimal, ROUND_HALF_UP

from ._statcan import get_gdp_emp_forecast_url
from .nominal_gdp import parse_gdp_emp_text

SOURCE_KEY = 'energy_sector_employment'
SOURCE_ORG = 'Statistics Canada'
FORECAST_ORG = 'Natural Resources Canada'
PT_URL = 'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=3610062401'
NRSA_URL = 'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=3810028501'
LFS_URL = 'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=1410028701'
FORECAST_URL = 'https://docs.google.com/document/d/11ad-aqY6WjcQwHRWuSrZgQKxMD_U6jKaXlR5q-p0CXI/'

ENERGY_PLUS = 'Energy Plus (includes coal, fuel wood and uranium)'
ELECTRICITY_SECTOR = 'Electricity (+ Services linked to electricity production)'

# Table 36-10-0624-01 employment. Canada is the share denominator only.
PT_VECTORS = {
    'ca': '1138544037',
    'nl': '1138544066',
    'pe': '1138544095',
    'ns': '1138544124',
    'nb': '1138544153',
    'qc': '1138544182',
    'on': '1138544211',
    'mb': '1138544240',
    'sk': '1138544269',
    'ab': '1138544298',
    'bc': '1138544327',
    'yt': '1138544356',
    'nt': '1138544385',
    'nu': '1138544414',
}
JURISDICTIONS = ('bc', 'ab', 'sk', 'mb', 'on', 'qc', 'nb', 'ns', 'pe', 'nl', 'yt', 'nt', 'nu')

# Table 38-10-0285-01, already in jobs.
NRSA_VECTORS = {
    'total': '1146163266',
    'electricity': '1146163272',
    'other_services': '1146163175',
    'oil_gas': '1146163268',
    'support': '1146163170',
    'exploration': '1146163171',
    'ng_distribution': '1146163172',
    'ng_pipeline': '1146163173',
    'crude_pipeline': '1146163174',
}
PETROLEUM_NRSA = (
    'oil_gas', 'support', 'exploration', 'ng_distribution', 'ng_pipeline', 'crude_pipeline',
)
LFS_VECTOR = '2363382'
INDIGENOUS_VECTOR = '1271976886'


def _round_half_up(value, digits):
    quant = Decimal('1') if digits == 0 else Decimal('0.' + ('0' * (digits - 1)) + '1')
    return float(Decimal(str(value)).quantize(quant, rounding=ROUND_HALF_UP))


def display_direct_jobs(value):
    """Nearest hundred jobs for the DIRECT callout."""
    return _round_half_up(float(value) / 100.0, 0) * 100.0


def _year_of(ref_date):
    text = str(ref_date).strip()
    if len(text) >= 4 and text[:4].isdigit():
        return int(text[:4])
    return None


def _annual_value(points):
    """
    Average a complete year.

    One point is an annual observation. Four points are quarters. Twelve points
    are months. Anything else is a partial year and is not used.
    """
    if len(points) not in (1, 4, 12):
        return None
    return sum(points) / len(points)


def _grouped(records):
    buckets = defaultdict(lambda: defaultdict(list))
    for vector, ref_date, value in records:
        year = _year_of(ref_date)
        if year is None:
            continue
        try:
            number = float(value)
        except (TypeError, ValueError):
            continue
        buckets[str(vector)][year].append(number)
    return buckets


def build_energy_employment_indicators(records):
    """
    National jobs, jurisdiction jobs, and shares.

    Source 4 is published in thousands of persons, so the share denominator is
    that average multiplied by 1,000. Direct NRSA values are already jobs.
    """
    grouped = _grouped(records)
    averages = {}
    for vector, years in grouped.items():
        for year, points in years.items():
            value = _annual_value(points)
            if value is not None:
                averages[(vector, year)] = value

    forecast_indirect = {}
    forecast_elec = {}
    for (vector, year), value in averages.items():
        if vector == 'forecast|indirect':
            forecast_indirect[year] = value * 1000.0
        elif vector == 'forecast|elec_direct':
            forecast_elec[year] = value * 1000.0

    rows = []
    for (vector, year), value in sorted(averages.items()):
        if vector == 'indigenous|jobs':
            rows.append(('emp_indigenous_jobs', str(year), _round_half_up(value, 0)))

    years = sorted(
        set(forecast_indirect)
        & set(forecast_elec)
        & {year for (vector, year) in averages if vector == 'lfs|total'}
        & {year for (vector, year) in averages if vector == 'nrsa|total'}
        & {year for (vector, year) in averages if vector == 'pt|ca'}
    )
    for year in years:
        if any(('nrsa|' + key, year) not in averages for key in NRSA_VECTORS):
            continue
        if any(('pt|' + code, year) not in averages for code in JURISDICTIONS):
            continue

        direct = averages[('nrsa|total', year)]
        indirect = forecast_indirect[year]
        electricity = forecast_elec[year]
        total_employment = averages[('lfs|total', year)] * 1000.0
        if total_employment == 0:
            continue

        elec_other = electricity - averages[('nrsa|electricity', year)]
        pet_other = averages[('nrsa|other_services', year)] - elec_other
        petroleum = sum(averages[('nrsa|' + key, year)] for key in PETROLEUM_NRSA) + pet_other
        other = direct - petroleum - electricity
        canada_pt = averages[('pt|ca', year)]
        if canada_pt == 0:
            continue

        def share(jobs):
            return _round_half_up((jobs / total_employment) * 100.0, 4)

        year_key = str(year)
        rows.extend([
            ('emp_direct_jobs', year_key, _round_half_up(direct, 4)),
            ('emp_indirect_jobs', year_key, _round_half_up(indirect, 4)),
            ('emp_total_jobs', year_key, _round_half_up(direct + indirect, 4)),
            ('emp_total_employment', year_key, _round_half_up(total_employment, 4)),
            ('emp_petroleum_jobs', year_key, _round_half_up(petroleum, 4)),
            ('emp_electricity_jobs', year_key, _round_half_up(electricity, 4)),
            ('emp_other_jobs', year_key, _round_half_up(other, 4)),
            ('emp_petroleum_share', year_key, share(petroleum)),
            ('emp_electricity_share', year_key, share(electricity)),
            ('emp_other_share', year_key, share(other)),
            ('emp_direct_share', year_key, share(direct)),
            ('emp_indirect_share', year_key, share(indirect)),
            ('emp_total_share', year_key, share(direct + indirect)),
        ])
        for code in JURISDICTIONS:
            jobs = (averages[('pt|' + code, year)] / canada_pt) * direct
            rows.append((f'emp_{code}_jobs', year_key, _round_half_up(jobs, 0)))
    return rows


def _forecast_rows(text):
    parsed = parse_gdp_emp_text(text)
    rows = []
    for (sector, year, indicator, typ), value in parsed.items():
        label = str(indicator).lower()
        if 'job' not in label or 'thousand' not in label:
            continue
        if sector == ENERGY_PLUS and typ == 'Indirect':
            rows.append(('forecast|indirect', str(year), float(value)))
        elif sector == ELECTRICITY_SECTOR and typ == 'Direct':
            rows.append(('forecast|elec_direct', str(year), float(value)))
    return rows


def _wds_rows(points, vector_name_for_id):
    rows = []
    for vector_id, ref_per, value in points:
        name = vector_name_for_id(vector_id)
        if not name:
            continue
        rows.append((name, str(ref_per), float(value)))
    return rows


def update_energy_sector_employment(processor) -> int:
    """EEDAS ingest: StatCan vectors plus the GDP and employment forecast."""
    print('  Fetching energy sector employment sources...')
    id_to_name = {}
    for code, vector_id in PT_VECTORS.items():
        id_to_name[int(vector_id)] = f'pt|{code}'
    for key, vector_id in NRSA_VECTORS.items():
        id_to_name[int(vector_id)] = f'nrsa|{key}'
    id_to_name[int(LFS_VECTOR)] = 'lfs|total'
    id_to_name[int(INDIGENOUS_VECTOR)] = 'indigenous|jobs'

    points = processor.fetch_wds_vector_data(
        list(id_to_name),
        start_ref='2007-01-01',
        end_ref=f'{date.today().year + 1}-12-31',
    )
    data_rows = _wds_rows(points, lambda vector_id: id_to_name.get(int(vector_id)))

    response = processor.fetch_url_with_retry(
        get_gdp_emp_forecast_url(), timeout=60, label='GDP and employment forecast',
    )
    data_rows.extend(_forecast_rows(response.text))

    metadata = []
    seen = set()
    for vector, _ref, _value in data_rows:
        if vector in seen:
            continue
        seen.add(vector)
        if vector.startswith('forecast|'):
            org, url = FORECAST_ORG, FORECAST_URL
        elif vector.startswith('pt|'):
            org, url = SOURCE_ORG, PT_URL
        elif vector.startswith('lfs|'):
            org, url = SOURCE_ORG, LFS_URL
        else:
            org, url = SOURCE_ORG, NRSA_URL
        metadata.append((vector, vector, 'jobs', 'units', org, url))

    if not data_rows:
        return 0
    n = processor.replace_raw_data(SOURCE_KEY, data_rows, metadata)
    print(f'    Stored {n} raw energy employment rows')
    return n


def transform_energy_sector_employment(processor) -> int:
    """EFB transform: jobs, jurisdiction counts, and shares of total employment."""
    raw_df = processor.repo.get_raw_dataframe(SOURCE_KEY)
    if raw_df is None or raw_df.empty:
        print('    energy_sector_employment transform: no raw rows found')
        return 0
    records = [
        (row['vector'], row['ref_date'], row['value'])
        for _, row in raw_df.iterrows()
    ]
    data_rows = build_energy_employment_indicators(records)
    if not data_rows:
        print('    energy_sector_employment transform: no indicator rows produced')
        return 0

    metadata = [
        ('emp_direct_jobs', 'Direct energy jobs', 'jobs', 'jobs', SOURCE_ORG, NRSA_URL),
        ('emp_indirect_jobs', 'Indirect energy jobs', 'jobs', 'jobs', FORECAST_ORG, FORECAST_URL),
        ('emp_total_jobs', 'Total energy jobs', 'jobs', 'jobs', SOURCE_ORG, NRSA_URL),
        ('emp_total_employment', 'Total employment, all industries', 'jobs', 'jobs', SOURCE_ORG, LFS_URL),
        ('emp_petroleum_jobs', 'Petroleum direct jobs', 'jobs', 'jobs', SOURCE_ORG, NRSA_URL),
        ('emp_electricity_jobs', 'Electricity direct jobs', 'jobs', 'jobs', FORECAST_ORG, FORECAST_URL),
        ('emp_other_jobs', 'Other direct energy jobs', 'jobs', 'jobs', SOURCE_ORG, NRSA_URL),
        ('emp_petroleum_share', 'Petroleum share of total employment', 'percent', 'percent', SOURCE_ORG, NRSA_URL),
        ('emp_electricity_share', 'Electricity share of total employment', 'percent', 'percent', SOURCE_ORG, NRSA_URL),
        ('emp_other_share', 'Other share of total employment', 'percent', 'percent', SOURCE_ORG, NRSA_URL),
        ('emp_direct_share', 'Energy direct share of total employment', 'percent', 'percent', SOURCE_ORG, NRSA_URL),
        ('emp_indirect_share', 'Energy indirect share of total employment', 'percent', 'percent', SOURCE_ORG, NRSA_URL),
        ('emp_total_share', 'Energy share of total employment', 'percent', 'percent', SOURCE_ORG, NRSA_URL),
        ('emp_indigenous_jobs', 'Indigenous people directly employed in energy', 'jobs', 'jobs', SOURCE_ORG, NRSA_URL),
    ]
    for code in JURISDICTIONS:
        metadata.append((
            f'emp_{code}_jobs',
            f'{code} direct energy jobs',
            'jobs',
            'jobs',
            SOURCE_ORG,
            PT_URL,
        ))
    n = processor.store_indicators(SOURCE_KEY, data_rows, metadata)
    print(f'    Stored {n} energy employment indicator rows')
    return n


def process_energy_sector_employment(processor) -> int:
    update_energy_sector_employment(processor)
    return transform_energy_sector_employment(processor)
