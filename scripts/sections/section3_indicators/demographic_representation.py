"""Representation of demographic groups — page 42."""

import io
from collections import defaultdict
from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from urllib.parse import quote

import pandas as pd

from utils.http_retry import fetch_get, resilience_from_config
from xlsx_paths import resolve_root_xlsx

SOURCE_KEY = 'demographic_representation'
SOURCE_ORG = 'Statistics Canada'
T4_WORKBOOK = 't4_NRSA_final.xlsx'
T4_SHEET = 'Table 4 (Data)'
SECTOR = 'Energy sub-sector'
CANADA_GEO = '99'
JOBS_INDICATOR = 'Number of jobs'
GENDER_URL = 'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=9810058501'
VISIBLE_URL = 'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=9810058601'
INDIGENOUS_URL = 'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=9810058701'

OFFICE_NOC = ('10', '11', '12', '13', '14')
TRADES_NOC = ('70', '72', '73')
EDUCATION_GROUPS = (
    '1-SECONDARY (HIGH) SCHOOL DIPLOMA AND LESS',
    '2-TRADES CERTIFICATE',
    '3-COLLEGE DIPLOMA',
    '4-UNIVERSITY DEGREE AND HIGHER',
)

# Table 4 has no NOC_name "all" row. Job totals are the sum across occupations.
ENERGY_COMPONENTS = (
    ('sex_female', 'SEX', ('FEMALE',), None),
    ('sex_male', 'SEX', ('MALE',), None),
    ('indigenous', 'Indigenous_id', ('INDIGENOUS',), None),
    ('non_indigenous', 'Indigenous_id', ('NON-INDIGENOUS',), None),
    ('edu_secondary', 'Education_level', (EDUCATION_GROUPS[0],), None),
    ('edu_trades', 'Education_level', (EDUCATION_GROUPS[1],), None),
    ('edu_college', 'Education_level', (EDUCATION_GROUPS[2],), None),
    ('edu_university', 'Education_level', (EDUCATION_GROUPS[3],), None),
    ('age_15_24', 'Age_group', ('15-24',), None),
    ('age_25_34', 'Age_group', ('25-34',), None),
    ('age_35_44', 'Age_group', ('35-44',), None),
    ('age_45_54', 'Age_group', ('45-54',), None),
    ('age_55_64', 'Age_group', ('55-64',), None),
    ('age_65_plus', 'Age_group', ('65+',), None),
    ('visible_minority', 'VISIBLE_MINORITY_STATUS', ('VISIBLE MINORITY',), None),
    ('not_visible_minority', 'VISIBLE_MINORITY_STATUS', ('NOT A VISIBLE MINORITY',), None),
    ('immigrant', 'Imm_status', ('IMMIGRANTS',), None),
    ('non_immigrant', 'Imm_status', ('NON-IMMIGRANTS',), None),
    ('office_female', 'SEX', ('FEMALE',), OFFICE_NOC),
    ('office_male', 'SEX', ('MALE',), OFFICE_NOC),
    ('trades_female', 'SEX', ('FEMALE',), TRADES_NOC),
    ('trades_male', 'SEX', ('MALE',), TRADES_NOC),
)

# Indigenous identity (9) is table 98-10-0587-01. Age (8A) is table 98-10-0585-01.
CENSUS_DOWNLOADS = (
    ('9810058501', '[[1],[1],[1],[1],[1],[1],[1,3],[1,8,206],[1]]', GENDER_URL),
    ('9810058501', '[[1],[1],[1,3],[1],[1],[1],[1],[1],[1]]', GENDER_URL),
    ('9810058501', '[[1],[1],[1],[1],[1],[1,7,8],[1],[1],[1]]', GENDER_URL),
    ('9810058601', '[[1],[1],[1],[1,4,5,6,7],[1],[1],[1],[1]]', VISIBLE_URL),
    ('9810058601', '[[1],[1],[1,2],[1],[1],[1],[1],[1]]', VISIBLE_URL),
    ('9810058701', '[[1],[1],[1,2],[1],[1],[1],[1],[1]]', INDIGENOUS_URL),
)
CENSUS_LABELS = {
    'Gender (3)': {
        'Total - Gender': 'census_gender_total',
        'Women+': 'census_women',
    },
    'Immigrant status': {
        'Total - Immigrant status and period of immigration': 'census_immigrant_total',
        'Immigrants': 'census_immigrants',
    },
    'Age (8A)': {
        'Total - Age': 'census_age_total',
        '55 to 64 years': 'census_age_55_64',
        '65 years and over': 'census_age_65_plus',
    },
    'Highest certificate': {
        'Total - Highest certificate, diploma or degree': 'census_education_total',
        'Apprenticeship or trades certificate or diploma': 'census_edu_trades',
        'College, CEGEP or other non-university certificate or diploma': 'census_edu_college',
        'University certificate or diploma below bachelor level': 'census_edu_below_bachelor',
        "Bachelor's degree or higher": 'census_edu_bachelor',
    },
    'Visible minority (15)': {
        'Total - Visible minority': 'census_visible_total',
        'Total visible minority population': 'census_visible_minority',
    },
    'Indigenous identity (9)': {
        'Total - Indigenous identity': 'census_indigenous_total',
        'Indigenous identity': 'census_indigenous',
    },
}


def _code(value):
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return ''
    try:
        if pd.isna(value):
            return ''
    except TypeError:
        pass
    if isinstance(value, (int, float)) and float(value).is_integer():
        return str(int(value))
    text = str(value).strip()
    if text.endswith('.0') and text[:-2].isdigit():
        return text[:-2]
    return text


def _prepare(frame):
    out = frame.copy()
    for column in out.columns:
        if column == 'Value':
            out[column] = pd.to_numeric(out[column], errors='coerce')
        else:
            out[column] = out[column].map(_code)
    return out


def _whole_percent(numerator, denominator):
    if denominator in (0, None):
        return None
    value = (Decimal(str(numerator)) / Decimal(str(denominator))) * Decimal(100)
    return int(value.quantize(Decimal('1'), rounding=ROUND_HALF_UP))


def _sum_by_year(frame, category, demographics, nocs):
    matched = frame[
        (frame['Demographic_Category'] == category)
        & (frame['Demographic'].isin(demographics))
    ]
    if nocs is not None:
        matched = matched[matched['NOC'].isin(nocs)]
    grouped = matched.groupby('YEAR')['Value'].sum(min_count=1)
    return {
        str(year): float(value)
        for year, value in grouped.items()
        if pd.notna(value)
    }


def _download_csv(processor, pid, members):
    end = f'{date.today().year + 1}1231'
    url = (
        'https://www150.statcan.gc.ca/t1/tbl1/en/dtl!downloadDbLoadingData-nonTraduit.action?'
        f'pid={pid}&latestN=0&startDate=20000101&endDate={end}&csvLocale=en'
        f'&selectedMembers={quote(members, safe="")}'
    )
    max_retries, retry_delay = resilience_from_config(processor.config)
    response = fetch_get(
        url,
        timeout=180,
        headers={'User-Agent': 'Mozilla/5.0 (compatible; NRCan-Energy-Factbook/1.0)'},
        max_retries=max_retries,
        retry_delay_seconds=retry_delay,
        label=f'StatCan table {pid}',
    )
    frame = pd.read_csv(io.BytesIO(response.content))
    if 'VALUE' not in frame.columns or 'GEO' not in frame.columns:
        raise ValueError(f'StatCan table {pid} did not return a data table')
    return frame


def _other_dimensions_are_totals(row, *target_columns):
    """True when every dimension except the requested ones is on its total member."""
    meta = {
        'REF_DATE', 'GEO', 'DGUID', 'UOM', 'UOM_ID', 'SCALAR_FACTOR', 'SCALAR_ID',
        'VECTOR', 'COORDINATE', 'VALUE', 'STATUS', 'SYMBOL', 'TERMINATED', 'DECIMALS',
    }
    targets = set(target_columns)
    for column, value in row.items():
        if column in meta or column in targets:
            continue
        text = str(value)
        if str(column).startswith('Statistics'):
            if text != 'Count':
                return False
            continue
        if not text.startswith('Total'):
            return False
    return True


def _census_rows(frame):
    rows = []
    canada = frame[frame['GEO'] == 'Canada'].copy()
    occupation_cols = [column for column in canada.columns if str(column).startswith('Occupation -')]
    if occupation_cols and canada[occupation_cols[0]].nunique(dropna=False) > 1:
        canada = canada[canada[occupation_cols[0]].astype(str).str.startswith('Total -')]
    for prefix, labels in CENSUS_LABELS.items():
        columns = [column for column in canada.columns if str(column).startswith(prefix)]
        if not columns:
            continue
        column = columns[0]
        for label, key in labels.items():
            matched = canada[canada[column] == label]
            for _, row in matched.iterrows():
                if not _other_dimensions_are_totals(row, column):
                    continue
                year = str(row['REF_DATE'])[:4]
                number = pd.to_numeric(row['VALUE'], errors='coerce')
                if year.isdigit() and pd.notna(number):
                    rows.append((f'cmp|{key}', year, float(number)))
    return rows


def _occupation_gender_rows(frame):
    """Women and gender totals inside the two occupation groups."""
    gender_col = next(column for column in frame.columns if str(column).startswith('Gender (3)'))
    occupation_col = next(column for column in frame.columns if str(column).startswith('Occupation - Minor group'))
    groups = {
        '1 Business, finance and administration occupations': 'office',
        '7 Trades, transport and equipment operators and related occupations': 'trades',
    }
    genders = {
        'Women+': 'women',
        'Total - Gender': 'total',
    }
    rows = []
    canada = frame[frame['GEO'] == 'Canada']
    for _, row in canada.iterrows():
        group = groups.get(row[occupation_col])
        gender = genders.get(row[gender_col])
        if not group or not gender:
            continue
        if not _other_dimensions_are_totals(row, gender_col, occupation_col):
            continue
        year = str(row['REF_DATE'])[:4]
        number = pd.to_numeric(row['VALUE'], errors='coerce')
        if year.isdigit() and pd.notna(number):
            rows.append((f'cmp|census_{group}_{gender}', year, float(number)))
    return rows


def read_energy_components(frame):
    t4 = _prepare(frame)
    jobs = t4[
        (t4['GEOVAL'] == CANADA_GEO)
        & (t4['Sector'] == SECTOR)
        & (t4['Indicator'] == JOBS_INDICATOR)
    ]
    rows = []
    for key, category, demographics, nocs in ENERGY_COMPONENTS:
        for year, value in _sum_by_year(jobs, category, demographics, nocs).items():
            rows.append((f'cmp|{key}', year, value))
    if not any(vector == 'cmp|sex_female' for vector, _year, _value in rows):
        raise ValueError(f'{T4_SHEET} has no energy sub-sector job counts')
    return rows


def _by_year(records):
    series = defaultdict(dict)
    for vector, ref_date, value in records:
        text = str(vector)
        if not text.startswith('cmp|'):
            continue
        year = str(ref_date)[:4]
        if not year.isdigit():
            continue
        try:
            number = float(value)
        except (TypeError, ValueError):
            continue
        series[text.split('|', 1)[1]][year] = number
    return series


def _need(series, year, *keys):
    values = []
    for key in keys:
        value = series.get(key, {}).get(year)
        if value is None:
            return None
        values.append(value)
    return values


def _share_row(rows, vector, year, numerator, denominator):
    share = _whole_percent(numerator, denominator)
    if share is not None:
        rows.append((vector, year, share))


def build_demographic_representation_indicators(records):
    """Whole-percent energy-sector and all-industries shares."""
    series = _by_year(records)
    rows = []
    years = set()
    for values in series.values():
        years.update(values)

    for year in sorted(years):
        sex = _need(series, year, 'sex_female', 'sex_male')
        if sex:
            _share_row(rows, 'drep_women_energy', year, sex[0], sex[0] + sex[1])
        trades = _need(series, year, 'trades_female', 'trades_male')
        if trades:
            _share_row(rows, 'drep_women_trades_energy', year, trades[0], trades[0] + trades[1])
        office = _need(series, year, 'office_female', 'office_male')
        if office:
            _share_row(rows, 'drep_women_office_energy', year, office[0], office[0] + office[1])
        immigrants = _need(series, year, 'immigrant', 'non_immigrant')
        if immigrants:
            _share_row(rows, 'drep_immigrants_energy', year, immigrants[0], immigrants[0] + immigrants[1])
        indigenous = _need(series, year, 'indigenous', 'non_indigenous')
        if indigenous:
            _share_row(rows, 'drep_indigenous_energy', year, indigenous[0], indigenous[0] + indigenous[1])
        visible = _need(series, year, 'visible_minority', 'not_visible_minority')
        if visible:
            _share_row(rows, 'drep_visible_minorities_energy', year, visible[0], visible[0] + visible[1])
        education = _need(series, year, 'edu_secondary', 'edu_trades', 'edu_college', 'edu_university')
        if education:
            total = sum(education)
            more = sum(education[1:])
            _share_row(rows, 'drep_high_school_plus_energy', year, more, total)
            _share_row(rows, 'drep_university_plus_energy', year, education[3], total)
        age = _need(series, year, 'age_15_24', 'age_25_34', 'age_35_44', 'age_45_54', 'age_55_64', 'age_65_plus')
        if age:
            _share_row(rows, 'drep_age_55_plus_energy', year, age[4] + age[5], sum(age))

        women = _need(series, year, 'census_women', 'census_gender_total')
        if women:
            _share_row(rows, 'drep_women_all', year, women[0], women[1])
        trades_all = _need(series, year, 'census_trades_women', 'census_trades_total')
        if trades_all:
            _share_row(rows, 'drep_women_trades_all', year, trades_all[0], trades_all[1])
        office_all = _need(series, year, 'census_office_women', 'census_office_total')
        if office_all:
            _share_row(rows, 'drep_women_office_all', year, office_all[0], office_all[1])
        immigrant_all = _need(series, year, 'census_immigrants', 'census_immigrant_total')
        if immigrant_all:
            _share_row(rows, 'drep_immigrants_all', year, immigrant_all[0], immigrant_all[1])
        indigenous_all = _need(series, year, 'census_indigenous', 'census_indigenous_total')
        if indigenous_all:
            _share_row(rows, 'drep_indigenous_all', year, indigenous_all[0], indigenous_all[1])
        visible_all = _need(series, year, 'census_visible_minority', 'census_visible_total')
        if visible_all:
            _share_row(rows, 'drep_visible_minorities_all', year, visible_all[0], visible_all[1])
        education_all = _need(
            series,
            year,
            'census_edu_trades',
            'census_edu_college',
            'census_edu_below_bachelor',
            'census_edu_bachelor',
            'census_education_total',
        )
        if education_all:
            more = sum(education_all[:4])
            _share_row(rows, 'drep_high_school_plus_all', year, more, education_all[4])
            _share_row(rows, 'drep_university_plus_all', year, education_all[3], education_all[4])
        age_all = _need(series, year, 'census_age_55_64', 'census_age_65_plus', 'census_age_total')
        if age_all:
            _share_row(rows, 'drep_age_55_plus_all', year, age_all[0] + age_all[1], age_all[2])
    return rows


def update_demographic_representation(processor) -> int:
    """EEDAS ingest: NRSA energy-sector jobs and census all-industries counts."""
    path = resolve_root_xlsx(T4_WORKBOOK)
    frame = pd.read_excel(path, sheet_name=T4_SHEET)
    data_rows = read_energy_components(frame)
    print(f'  Energy-sector component rows: {len(data_rows)}')

    for pid, members, _url in CENSUS_DOWNLOADS:
        census = _download_csv(processor, pid, members)
        extracted = _census_rows(census)
        if pid == '9810058501' and '1,8,206' in members:
            extracted.extend(_occupation_gender_rows(census))
        print(f'  Census {pid} rows: {len(extracted)}')
        data_rows.extend(extracted)
    unique = {}
    for vector, year, value in data_rows:
        unique[(str(vector), str(year))] = value
    data_rows = [(vector, year, value) for (vector, year), value in unique.items()]
    if not any(str(vector).startswith('cmp|census_women') for vector, _year, _value in data_rows):
        raise RuntimeError('StatCan returned no all-industries gender counts')

    metadata = [
        ('cmp|sex_female', 'Energy sector jobs, women', 'jobs', 'jobs', SOURCE_ORG, GENDER_URL),
        ('cmp|census_women', 'All industries employment income recipients, women', 'persons', 'persons', SOURCE_ORG, GENDER_URL),
        ('cmp|census_indigenous', 'All industries employment income recipients, Indigenous identity', 'persons', 'persons', SOURCE_ORG, INDIGENOUS_URL),
        ('cmp|census_visible_minority', 'All industries employment income recipients, visible minority', 'persons', 'persons', SOURCE_ORG, VISIBLE_URL),
    ]
    n = processor.replace_raw_data(SOURCE_KEY, data_rows, metadata)
    print(f'    Stored {n} raw demographic representation rows')
    return n


def transform_demographic_representation(processor) -> int:
    """EFB transform: energy-sector and all-industries representation shares."""
    raw_df = processor.repo.get_raw_dataframe(SOURCE_KEY)
    if raw_df is None or raw_df.empty:
        print('    demographic_representation transform: no raw rows found')
        return 0
    records = [
        (row['vector'], row['ref_date'], row['value'])
        for _, row in raw_df.iterrows()
    ]
    data_rows = build_demographic_representation_indicators(records)
    if not data_rows:
        print('    demographic_representation transform: no indicator rows produced')
        return 0
    groups = (
        'women',
        'women_trades',
        'women_office',
        'immigrants',
        'indigenous',
        'visible_minorities',
        'high_school_plus',
        'university_plus',
        'age_55_plus',
    )
    metadata = []
    for group in groups:
        metadata.append((f'drep_{group}_energy', f'{group} energy sector share', 'percent', 'percent', SOURCE_ORG, GENDER_URL))
        metadata.append((f'drep_{group}_all', f'{group} all industries share', 'percent', 'percent', SOURCE_ORG, GENDER_URL))
    n = processor.store_indicators(SOURCE_KEY, data_rows, metadata)
    print(f'    Stored {n} demographic representation indicator rows')
    return n


def process_demographic_representation(processor) -> int:
    update_demographic_representation(processor)
    return transform_demographic_representation(processor)
