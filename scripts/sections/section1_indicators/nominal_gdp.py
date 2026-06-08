"""Nominal GDP contributions — Google Docs GDP&EMP forecast."""

from typing import Dict

from ._statcan import get_gdp_emp_forecast_url


def parse_gdp_emp_text(text: str) -> Dict:
    """Parse GDP&EMP forecast text from Google Docs."""
    data = {}
    lines = text.strip().split('\n')

    current_sector = None
    current_year = None
    current_indicator = None
    current_type = None

    i = 0
    while i < len(lines):
        line = lines[i].strip()

        if line in ['Energy', 'Energy Plus (includes coal, fuel wood and uranium)',
                    'Petroleum Sector (Energy less electricity and "other services")',
                    'Electricity (+ Services linked to electricity production)']:
            current_sector = line
        elif line.isdigit() and len(line) == 4:
            current_year = int(line)
        elif 'GDP' in line or 'Jobs' in line:
            current_indicator = line
        elif line in ['Direct', 'Indirect', 'Induced']:
            current_type = line
        else:
            try:
                value = float(line.replace(',', ''))
                if current_sector and current_year and current_indicator and current_type:
                    key = (current_sector, current_year, current_indicator, current_type)
                    data[key] = value
            except ValueError:
                pass

        i += 1

    return data


def _gdp_emp_key_vector(sector, indicator, typ) -> str:
    return f'{sector}|{indicator}|{typ}'


def _load_gdp_emp_dict(raw_df) -> Dict:
    out = {}
    if raw_df is None or raw_df.empty:
        return out
    for _, row in raw_df.iterrows():
        parts = str(row['vector']).split('|', 2)
        if len(parts) != 3:
            continue
        key = (parts[0], int(row['ref_date']), parts[1], parts[2])
        out[key] = float(row['value'])
    return out


def update_nominal_gdp(processor) -> int:
    """EEDAS ingest: fetch Google Docs GDP&EMP forecast and store publisher-native rows."""
    print("  Fetching GDP&EMP forecast data...")

    try:
        response = processor.fetch_url_with_retry(
            get_gdp_emp_forecast_url(), timeout=60, label="GDP forecast"
        )
        gdp_emp_data = parse_gdp_emp_text(response.text)
    except Exception as e:
        raise RuntimeError(f"Could not fetch GDP forecast data: {e}") from e

    data_rows = []
    metadata_rows = []
    seen = set()
    source_org = 'NRCan'
    source_url = 'https://docs.google.com/document/d/11ad-aqY6WjcQwHRWuSrZgQKxMD_U6jKaXlR5q-p0CXI/'

    for (sector, year, indicator, typ), value in gdp_emp_data.items():
        vector = _gdp_emp_key_vector(sector, indicator, typ)
        data_rows.append((vector, str(year), value))
        if vector not in seen:
            seen.add(vector)
            metadata_rows.append((vector, f'{sector} - {indicator} ({typ})', 'Millions of dollars', 'millions', source_org, source_url))

    if not data_rows:
        return 0
    return processor.replace_raw_data('nominal_gdp', data_rows, metadata_rows)


def transform_nominal_gdp(processor) -> int:
    """EFB transform: build gdp_nominal_* indicator vectors from raw GDP&EMP rows."""
    gdp_emp_data = _load_gdp_emp_dict(processor.repo.get_raw_dataframe('nominal_gdp'))
    if not gdp_emp_data:
        print("    Warning: No raw nominal GDP data in database")
        return 0

    data_rows = []
    years = sorted({key[1] for key in gdp_emp_data})

    for year in years:
        if year < 2009:
            continue

        energy_plus_direct = gdp_emp_data.get(
            ('Energy Plus (includes coal, fuel wood and uranium)', year, 'Current GDP ($ millions)', 'Direct'), 0)
        energy_plus_indirect = gdp_emp_data.get(
            ('Energy Plus (includes coal, fuel wood and uranium)', year, 'Current GDP ($ millions)', 'Indirect'), 0)
        petroleum_direct = gdp_emp_data.get(
            ('Petroleum Sector (Energy less electricity and "other services")', year, 'Current GDP ($ millions)', 'Direct'), 0)
        electricity_direct = gdp_emp_data.get(
            ('Electricity (+ Services linked to electricity production)', year, 'Current GDP ($ millions)', 'Direct'), 0)

        other_direct = max(0, energy_plus_direct - petroleum_direct - electricity_direct)
        total_nominal_gdp = energy_plus_direct + energy_plus_indirect
        nominal_gdp_market = {2024: 2879000, 2023: 2765000, 2022: 2773000}.get(year, 2700000)

        if total_nominal_gdp > 0:
            total_pct = round((total_nominal_gdp / nominal_gdp_market) * 100, 1)
            direct_pct = round((energy_plus_direct / nominal_gdp_market) * 100, 1) if nominal_gdp_market > 0 else 0
            indirect_pct = round((energy_plus_indirect / nominal_gdp_market) * 100, 1) if nominal_gdp_market > 0 else 0
            petroleum_pct = round((petroleum_direct / nominal_gdp_market) * 100, 1) if nominal_gdp_market > 0 else 0
            electricity_pct = round((electricity_direct / nominal_gdp_market) * 100, 1) if nominal_gdp_market > 0 else 0
            other_pct = round((other_direct / nominal_gdp_market) * 100, 1) if nominal_gdp_market > 0 else 0

            data_rows.extend([
                ('gdp_nominal_total', str(year), round(total_nominal_gdp, 0)),
                ('gdp_nominal_direct', str(year), round(energy_plus_direct, 0)),
                ('gdp_nominal_indirect', str(year), round(energy_plus_indirect, 0)),
                ('gdp_nominal_petroleum', str(year), round(petroleum_direct, 0)),
                ('gdp_nominal_electricity', str(year), round(electricity_direct, 0)),
                ('gdp_nominal_other', str(year), round(other_direct, 0)),
                ('gdp_nominal_market', str(year), nominal_gdp_market),
                ('gdp_nominal_total_pct', str(year), total_pct),
                ('gdp_nominal_direct_pct', str(year), direct_pct),
                ('gdp_nominal_indirect_pct', str(year), indirect_pct),
                ('gdp_nominal_petroleum_pct', str(year), petroleum_pct),
                ('gdp_nominal_electricity_pct', str(year), electricity_pct),
                ('gdp_nominal_other_pct', str(year), other_pct),
                ('gdp_nominal_total_billions', str(year), round(total_nominal_gdp / 1000, 0)),
                ('gdp_nominal_direct_billions', str(year), round(energy_plus_direct / 1000, 0)),
                ('gdp_nominal_indirect_billions', str(year), round(energy_plus_indirect / 1000, 0)),
                ('gdp_nominal_petroleum_billions', str(year), round(petroleum_direct / 1000, 0)),
                ('gdp_nominal_electricity_billions', str(year), round(electricity_direct / 1000, 0)),
                ('gdp_nominal_other_billions', str(year), round(other_direct / 1000, 0)),
                ('gdp_nominal_market_billions', str(year), round(nominal_gdp_market / 1000, 0)),
            ])

    source_org = 'NRCan'
    source_url = 'https://docs.google.com/document/d/11ad-aqY6WjcQwHRWuSrZgQKxMD_U6jKaXlR5q-p0CXI/'
    metadata_rows = [
        ('gdp_nominal_total', "Energy's nominal GDP contribution - Total", 'Millions of dollars', 'millions', source_org, source_url),
        ('gdp_nominal_direct', "Energy's nominal GDP contribution - Direct", 'Millions of dollars', 'millions', source_org, source_url),
        ('gdp_nominal_indirect', "Energy's nominal GDP contribution - Indirect", 'Millions of dollars', 'millions', source_org, source_url),
        ('gdp_nominal_petroleum', "Energy's nominal GDP contribution - Petroleum", 'Millions of dollars', 'millions', source_org, source_url),
        ('gdp_nominal_electricity', "Energy's nominal GDP contribution - Electricity", 'Millions of dollars', 'millions', source_org, source_url),
        ('gdp_nominal_other', "Energy's nominal GDP contribution - Other", 'Millions of dollars', 'millions', source_org, source_url),
        ('gdp_nominal_market', "Nominal GDP at market prices", 'Millions of dollars', 'millions', source_org, source_url),
        ('gdp_nominal_total_pct', "Energy's nominal GDP share - Total", 'Percent', 'percent', source_org, source_url),
        ('gdp_nominal_direct_pct', "Energy's nominal GDP share - Direct", 'Percent', 'percent', source_org, source_url),
        ('gdp_nominal_indirect_pct', "Energy's nominal GDP share - Indirect", 'Percent', 'percent', source_org, source_url),
        ('gdp_nominal_petroleum_pct', "Energy's nominal GDP share - Petroleum", 'Percent', 'percent', source_org, source_url),
        ('gdp_nominal_electricity_pct', "Energy's nominal GDP share - Electricity", 'Percent', 'percent', source_org, source_url),
        ('gdp_nominal_other_pct', "Energy's nominal GDP share - Other", 'Percent', 'percent', source_org, source_url),
        ('gdp_nominal_total_billions', "Energy's nominal GDP - Total (billions)", 'Billions of dollars', 'billions', source_org, source_url),
        ('gdp_nominal_direct_billions', "Energy's nominal GDP - Direct (billions)", 'Billions of dollars', 'billions', source_org, source_url),
        ('gdp_nominal_indirect_billions', "Energy's nominal GDP - Indirect (billions)", 'Billions of dollars', 'billions', source_org, source_url),
        ('gdp_nominal_petroleum_billions', "Energy's nominal GDP - Petroleum (billions)", 'Billions of dollars', 'billions', source_org, source_url),
        ('gdp_nominal_electricity_billions', "Energy's nominal GDP - Electricity (billions)", 'Billions of dollars', 'billions', source_org, source_url),
        ('gdp_nominal_other_billions', "Energy's nominal GDP - Other (billions)", 'Billions of dollars', 'billions', source_org, source_url),
        ('gdp_nominal_market_billions', "Nominal GDP at market prices (billions)", 'Billions of dollars', 'billions', source_org, source_url),
    ]

    if not data_rows:
        return 0
    return processor.store_indicators('nominal_gdp', data_rows, metadata_rows)


def process_nominal_gdp(processor) -> int:
    """Deprecated: run update then transform."""
    return update_nominal_gdp(processor) + transform_nominal_gdp(processor)
