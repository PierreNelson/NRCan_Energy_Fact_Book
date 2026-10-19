"""Energy sector demographics and wages — pages 40 and 41."""

import io
from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from urllib.parse import quote

import pandas as pd

from utils.http_retry import fetch_get, resilience_from_config
from xlsx_paths import resolve_root_xlsx

SOURCE_KEY = 'energy_sector_demographics'
SOURCE_ORG = 'Statistics Canada'
T4_WORKBOOK = 't4_NRSA_final.xlsx'
T1_WORKBOOK = 't1_NRSA_Final.xlsx'
T4_SHEET = 'Table 4 (Data)'
INCOME_SHEET = '1c_NR_sub-sector'
HOURLY_SHEET = '1d_NR_sub-sector'
SECTOR = 'Energy sub-sector'
CANADA_GEO = '99'
JOBS_INDICATOR = 'Number of jobs'
HOURLY_INDICATOR = 'Average hourly wages and salaries'
ANNUAL_WAGE_INDICATOR = 'Average annual wages and salaries'
INCOME_INDICATOR = 'Average annual wages and salaries or net income'
CENSUS_URL = 'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=9810058501'
SNA_URL = 'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=3610068901'
SNA_JOBS_VECTOR = '1567756783'
SNA_WAGES_VECTOR = '1567757497'
OFFICE_NOC = ('10', '11', '12', '13', '14')
TRADES_NOC = ('70', '72', '73')
ADMIN_NOC = ('12', '13', '14')
EDUCATION_GROUPS = (
    '1-SECONDARY (HIGH) SCHOOL DIPLOMA AND LESS',
    '2-TRADES CERTIFICATE',
    '3-COLLEGE DIPLOMA',
    '4-UNIVERSITY DEGREE AND HIGHER',
)

# Table 4 has no NOC_name "all" row. Job totals are the sum across occupations.
JOB_COMPONENTS = (
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
HOURLY_COMPONENTS = (
    ('hourly_trades_female', 'SEX', ('FEMALE',), TRADES_NOC),
    ('hourly_trades_male', 'SEX', ('MALE',), TRADES_NOC),
    ('hourly_admin_female', 'SEX', ('FEMALE',), ADMIN_NOC),
    ('hourly_admin_male', 'SEX', ('MALE',), ADMIN_NOC),
)


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


def _dollars(numerator, denominator):
    if denominator in (0, None):
        return None
    value = Decimal(str(numerator)) / Decimal(str(denominator))
    return float(value.quantize(Decimal('0.0001'), rounding=ROUND_HALF_UP))


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


def read_nrsa_components(t4_frame, income_frame, hourly_frame):
    """
    Component sums for the latest-year demographic and wage calculations.

    Returns [(vector, year, value), ...].
    """
    t4 = _prepare(t4_frame)
    income = _prepare(income_frame)
    hourly = _prepare(hourly_frame)
    jobs = t4[(t4['Sector'] == SECTOR) & (t4['Indicator'] == JOBS_INDICATOR)]
    occupation_wages = t4[(t4['Sector'] == SECTOR) & (t4['Indicator'] == HOURLY_INDICATOR)]
    rows = []
    for key, category, demographics, nocs in JOB_COMPONENTS:
        for year, value in _sum_by_year(jobs, category, demographics, nocs).items():
            rows.append((f'cmp|{key}', year, value))
    for key, category, demographics, nocs in HOURLY_COMPONENTS:
        for year, value in _sum_by_year(occupation_wages, category, demographics, nocs).items():
            rows.append((f'cmp|{key}', year, value))

    income_rows = income[
        (income['GEOVAL'] == CANADA_GEO)
        & (income['Sector'] == SECTOR)
        & (income['Class of worker'] == 'Employee jobs')
        & (income['Work activity'] == 'Total employee jobs')
        & (income['Indicator'] == INCOME_INDICATOR)
    ]
    for year, value in income_rows.groupby('YEAR')['Value'].sum(min_count=1).items():
        if pd.notna(value):
            rows.append(('cmp|income_energy', str(year), float(value)))

    sex_wages = hourly[
        (hourly['GEOVAL'] == CANADA_GEO)
        & (hourly['Sector'] == SECTOR)
        & (hourly['Demographic_Category'] == 'SEX')
        & (hourly['Indicator'] == HOURLY_INDICATOR)
    ]
    for demographic, key in (('FEMALE', 'hourly_female'), ('MALE', 'hourly_male')):
        matched = sex_wages[sex_wages['Demographic'] == demographic]
        for year, value in matched.groupby('YEAR')['Value'].sum(min_count=1).items():
            if pd.notna(value):
                rows.append((f'cmp|{key}', str(year), float(value)))

    # National university compensation is the Canada row. Table 4 stores this
    # indicator by occupation, so summing those averages is not the sector average.
    university = hourly[
        (hourly['GEOVAL'] == CANADA_GEO)
        & (hourly['Sector'] == SECTOR)
        & (hourly['Demographic_Category'] == 'Education_level')
        & (hourly['Demographic'] == '4-UNIVERSITY DEGREE AND HIGHER')
        & (hourly['Indicator'] == ANNUAL_WAGE_INDICATOR)
    ]
    for year, value in university.groupby('YEAR')['Value'].sum(min_count=1).items():
        if pd.notna(value):
            rows.append(('cmp|income_university', str(year), float(value)))
    if not any(vector == 'cmp|sex_female' for vector, _year, _value in rows):
        raise ValueError(f'{T4_SHEET} has no energy sub-sector job counts')
    if not any(vector == 'cmp|income_energy' for vector, _year, _value in rows):
        raise ValueError(f'{INCOME_SHEET} has no Canada energy-sector compensation')
    return rows


def census_immigrant_url():
    members = '[[1],[1],[1,3],[1],[1],[1],[1],[1],[1]]'
    end = f'{date.today().year + 1}1231'
    return (
        'https://www150.statcan.gc.ca/t1/tbl1/en/dtl!downloadDbLoadingData-nonTraduit.action?'
        f'pid=9810058501&latestN=0&startDate=20000101&endDate={end}&csvLocale=en'
        f'&selectedMembers={quote(members, safe="")}'
    )


def parse_immigrant_counts(csv_bytes):
    """
    Canada employment-income recipients: immigrants and the immigrant-status total.

    Other dimensions stay on their total category. Returns [(vector, year, count), ...].
    """
    frame = pd.read_csv(io.BytesIO(csv_bytes))
    status_col = next(
        (column for column in frame.columns if str(column).startswith('Immigrant status')),
        None,
    )
    if status_col is None or 'VALUE' not in frame.columns or 'REF_DATE' not in frame.columns:
        raise ValueError('Census immigrant table is missing status, year, or value columns')
    labels = {
        'Total - Immigrant status and period of immigration': 'cmp|census_total',
        'Immigrants': 'cmp|census_immigrants',
    }
    rows = []
    for label, vector in labels.items():
        matched = frame[frame[status_col] == label]
        if matched.empty:
            raise ValueError(f'Census immigrant table has no "{label}" row')
        for ref_date, value in zip(matched['REF_DATE'], matched['VALUE']):
            year = str(ref_date)[:4]
            number = pd.to_numeric(value, errors='coerce')
            if year.isdigit() and pd.notna(number):
                rows.append((vector, year, float(number)))
    if not rows:
        raise ValueError('Census immigrant table has no numeric counts')
    return rows


def _by_year(records):
    series = {}
    for vector, ref_date, value in records:
        key = str(vector).split('|', 1)[-1] if str(vector).startswith('cmp|') else None
        if key is None:
            continue
        year = str(ref_date)[:4]
        if not year.isdigit():
            continue
        try:
            number = float(value)
        except (TypeError, ValueError):
            continue
        series.setdefault(key, {})[year] = number
    return series


def _need(series, year, *keys):
    values = []
    for key in keys:
        value = series.get(key, {}).get(year)
        if value is None:
            return None
        values.append(value)
    return values


def build_energy_sector_demographics_indicators(records):
    """Whole-percent shares and dollar compensation for pages 40 and 41."""
    series = _by_year(records)
    rows = []
    years = set()
    for values in series.values():
        years.update(values)
    for year in sorted(years):
        sex = _need(series, year, 'sex_female', 'sex_male')
        if sex:
            share = _whole_percent(sex[0], sex[0] + sex[1])
            if share is not None:
                rows.append(('edem_women', year, share))
        indigenous = _need(series, year, 'indigenous', 'non_indigenous')
        if indigenous:
            share = _whole_percent(indigenous[0], indigenous[0] + indigenous[1])
            if share is not None:
                rows.append(('edem_indigenous', year, share))
        education = _need(
            series, year, 'edu_secondary', 'edu_trades', 'edu_college', 'edu_university',
        )
        if education:
            total = sum(education)
            more = sum(education[1:])
            credential = education[2] + education[3]
            more_share = _whole_percent(more, total)
            credential_share = _whole_percent(credential, total)
            if more_share is not None:
                rows.append(('edem_education_more', year, more_share))
            if credential_share is not None:
                rows.append(('edem_education_credential', year, credential_share))
        age = _need(
            series, year,
            'age_15_24', 'age_25_34', 'age_35_44', 'age_45_54', 'age_55_64', 'age_65_plus',
        )
        if age:
            share = _whole_percent(age[4] + age[5], sum(age))
            if share is not None:
                rows.append(('edem_age_55', year, share))
        minority = _need(series, year, 'visible_minority', 'not_visible_minority')
        if minority:
            share = _whole_percent(minority[0], minority[0] + minority[1])
            if share is not None:
                rows.append(('edem_visible_minority', year, share))
        immigrant = _need(series, year, 'immigrant', 'non_immigrant')
        if immigrant:
            share = _whole_percent(immigrant[0], immigrant[0] + immigrant[1])
            if share is not None:
                rows.append(('edem_immigrant_energy', year, share))
        office = _need(series, year, 'office_female', 'office_male')
        if office:
            share = _whole_percent(office[0], office[0] + office[1])
            if share is not None:
                rows.append(('ewag_women_office', year, share))
        trades = _need(series, year, 'trades_female', 'trades_male')
        if trades:
            share = _whole_percent(trades[1], trades[0] + trades[1])
            if share is not None:
                rows.append(('ewag_men_trades', year, share))
        trades_wage = _need(series, year, 'hourly_trades_female', 'hourly_trades_male')
        if trades_wage:
            share = _whole_percent(trades_wage[0], trades_wage[1])
            if share is not None:
                rows.append(('ewag_wage_trades', year, share))
        admin_wage = _need(series, year, 'hourly_admin_female', 'hourly_admin_male')
        if admin_wage:
            share = _whole_percent(admin_wage[0], admin_wage[1])
            if share is not None:
                rows.append(('ewag_wage_admin', year, share))
        income = series.get('income_energy', {}).get(year)
        if income is not None:
            rows.append(('ewag_income_energy', year, income))
        hourly = _need(series, year, 'hourly_female', 'hourly_male')
        if hourly:
            share = _whole_percent(hourly[0], hourly[1])
            if share is not None:
                rows.append(('ewag_gender_gap', year, share))
        university = series.get('income_university', {}).get(year)
        if university is not None:
            rows.append(('ewag_income_university', year, university))
        census = _need(series, year, 'census_immigrants', 'census_total')
        if census:
            share = _whole_percent(census[0], census[1])
            if share is not None:
                rows.append(('edem_immigrant_economy', year, share))
        sna = _need(series, year, 'sna_wages', 'sna_jobs')
        if sna:
            income = _dollars(Decimal(str(sna[0])) * Decimal(1000), sna[1])
            if income is not None:
                rows.append(('ewag_income_economy', year, income))
    return rows


def update_energy_sector_demographics(processor) -> int:
    """EEDAS ingest: NRSA workbooks, census immigrant counts, and SNA wage vectors."""
    t4 = pd.read_excel(resolve_root_xlsx(T4_WORKBOOK), sheet_name=T4_SHEET)
    income = pd.read_excel(resolve_root_xlsx(T1_WORKBOOK), sheet_name=INCOME_SHEET)
    hourly = pd.read_excel(resolve_root_xlsx(T1_WORKBOOK), sheet_name=HOURLY_SHEET)
    data_rows = read_nrsa_components(t4, income, hourly)
    print(f'  NRSA component rows: {len(data_rows)}')

    max_retries, retry_delay = resilience_from_config(processor.config)
    response = fetch_get(
        census_immigrant_url(),
        timeout=120,
        headers={'User-Agent': 'Mozilla/5.0 (compatible; NRCan-Energy-Factbook/1.0)'},
        max_retries=max_retries,
        retry_delay_seconds=retry_delay,
        label='Census immigrant employment income',
    )
    census_rows = parse_immigrant_counts(response.content)
    print(f'  Census immigrant rows: {len(census_rows)}')
    data_rows.extend(census_rows)

    points = processor.fetch_wds_vector_data(
        [SNA_JOBS_VECTOR, SNA_WAGES_VECTOR],
        start_ref='2009-01-01',
        end_ref=f'{date.today().year + 1}-12-31',
    )
    vector_keys = {
        int(SNA_JOBS_VECTOR): 'cmp|sna_jobs',
        int(SNA_WAGES_VECTOR): 'cmp|sna_wages',
    }
    sna_rows = 0
    for vector_id, ref_date, value in points:
        key = vector_keys.get(int(vector_id))
        year = str(ref_date)[:4]
        if key and year.isdigit():
            data_rows.append((key, year, float(value)))
            sna_rows += 1
    if sna_rows == 0:
        raise RuntimeError('StatCan returned no economy job or wage rows')
    print(f'  SNA wage rows: {sna_rows}')

    vectors = sorted({vector for vector, _year, _value in data_rows})
    metadata = [
        (vector, vector, 'value', 'value', SOURCE_ORG, CENSUS_URL if 'census' in vector else SNA_URL)
        for vector in vectors
    ]
    n = processor.replace_raw_data(SOURCE_KEY, data_rows, metadata)
    print(f'    Stored {n} raw energy sector demographics rows')
    return n


def transform_energy_sector_demographics(processor) -> int:
    """EFB transform: whole-percent demographic shares and wage comparisons."""
    raw_df = processor.repo.get_raw_dataframe(SOURCE_KEY)
    if raw_df is None or raw_df.empty:
        print('    energy_sector_demographics transform: no raw rows found')
        return 0
    records = [
        (row['vector'], row['ref_date'], row['value'])
        for _, row in raw_df.iterrows()
    ]
    data_rows = build_energy_sector_demographics_indicators(records)
    if not data_rows:
        print('    energy_sector_demographics transform: no indicator rows produced')
        return 0
    labels = {
        'edem_women': 'Women share of energy sector jobs',
        'edem_indigenous': 'Indigenous share of energy sector employees',
        'edem_education_more': 'Energy employees with more than high school',
        'edem_education_credential': 'Energy employees with a college diploma or university degree',
        'edem_age_55': 'Energy employees aged 55 and older',
        'edem_visible_minority': 'Visible minority share of the energy workforce',
        'edem_immigrant_energy': 'Immigrant share of energy sector employees',
        'edem_immigrant_economy': 'Immigrant share of economy-wide employment income recipients',
        'ewag_women_office': 'Women share of energy office occupations',
        'ewag_men_trades': 'Men share of energy trades occupations',
        'ewag_wage_trades': 'Women hourly wage as a share of men in the trades',
        'ewag_wage_admin': 'Women hourly wage as a share of men in administrative occupations',
        'ewag_income_energy': 'Average annual energy sector compensation',
        'ewag_gender_gap': 'Women hourly wage as a share of men in the energy sector',
        'ewag_income_university': 'Average compensation for university-degree energy jobs',
        'ewag_income_economy': 'Average annual compensation in the total economy',
    }
    metadata = []
    for vector in labels:
        unit = 'dollars' if 'income' in vector else 'percent'
        url = CENSUS_URL if vector == 'edem_immigrant_economy' else SNA_URL
        metadata.append((vector, labels[vector], unit, unit, SOURCE_ORG, url))
    n = processor.store_indicators(SOURCE_KEY, data_rows, metadata)
    print(f'    Stored {n} energy sector demographics indicator rows')
    return n


def process_energy_sector_demographics(processor) -> int:
    update_energy_sector_demographics(processor)
    return transform_energy_sector_demographics(processor)
