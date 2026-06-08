"""Major projects and clean technology (NRCan Major Projects Inventory)."""

from .constants import NRCAN_MPI_SOURCE_URL, NRCAN_MPI_URL
from ._shared import (
    extract_cleantech_data_from_text,
    extract_energy_data_from_text,
    fetch_nrcan_mpi_tables,
    parse_cleantech_table,
    parse_energy_table,
)

_RAW_MAJOR_PROJECT_FIELDS = (
    'oil_gas_value', 'oil_gas_projects',
    'electricity_value', 'electricity_projects',
    'other_value', 'other_projects',
)
_RAW_CLEANTECH_CATEGORIES = (
    'total', 'hydro', 'wind', 'biomass', 'solar', 'nuclear', 'ccs',
    'geothermal', 'tidal', 'storage', 'multiple', 'other',
)


def _store_publisher_dict(processor, source_key, year_values, fields, source_org, source_url):
    data_rows = []
    metadata_rows = []
    seen = set()
    for year, values in year_values.items():
        for field in fields:
            if field not in values:
                continue
            vector = f'raw|{field}'
            ref_date = str(year)
            data_rows.append((vector, ref_date, values[field]))
            if vector not in seen:
                seen.add(vector)
                metadata_rows.append((vector, field.replace('_', ' ').title(), '', '', source_org, source_url))
    if not data_rows:
        return 0
    return processor.replace_raw_data(source_key, data_rows, metadata_rows)


def _load_publisher_dict(raw_df, fields):
    out = {}
    if raw_df is None or raw_df.empty:
        return out
    for _, row in raw_df.iterrows():
        vector = str(row['vector'])
        if not vector.startswith('raw|'):
            continue
        field = vector.split('|', 1)[1]
        if field not in fields:
            continue
        year = int(row['ref_date'])
        out.setdefault(year, {})[field] = row['value']
    return out


def update_major_projects(processor) -> int:
    """EEDAS ingest: scrape NRCan MPI Table 1 and store publisher-native rows."""
    print("  Fetching major projects data...")
    print(f"    Source: NRCan Major Projects Inventory (Table 1)")
    print(f"    URL: {NRCAN_MPI_URL}")

    energy_table, _cleantech_table, soup = fetch_nrcan_mpi_tables(processor)
    major_projects_data = parse_energy_table(energy_table)
    if not major_projects_data:
        print("    WARNING: Could not parse energy table, using fallback extraction...")
        major_projects_data = extract_energy_data_from_text(soup)
    if not major_projects_data:
        raise RuntimeError("Could not retrieve energy projects data from NRCan MPI")

    print(f"    Parsed energy data for years: {sorted(major_projects_data.keys())}")
    return _store_publisher_dict(
        processor,
        'major_projects',
        major_projects_data,
        _RAW_MAJOR_PROJECT_FIELDS,
        'NRCan',
        NRCAN_MPI_SOURCE_URL,
    )


def transform_major_projects(processor) -> int:
    """EFB transform: build projects_* indicator vectors from raw MPI rows."""
    major_projects_data = _load_publisher_dict(
        processor.repo.get_raw_dataframe('major_projects'),
        _RAW_MAJOR_PROJECT_FIELDS,
    )
    if not major_projects_data:
        print("    Warning: No raw major projects data in database")
        return 0

    data_rows = []
    for year, values in major_projects_data.items():
        if 'oil_gas_value' in values:
            data_rows.append(('projects_oil_gas_value', str(year), values['oil_gas_value']))
        if 'oil_gas_projects' in values:
            data_rows.append(('projects_oil_gas_count', str(year), values['oil_gas_projects']))
        if 'electricity_value' in values:
            data_rows.append(('projects_electricity_value', str(year), values['electricity_value']))
        if 'electricity_projects' in values:
            data_rows.append(('projects_electricity_count', str(year), values['electricity_projects']))
        if 'other_value' in values:
            data_rows.append(('projects_other_value', str(year), values['other_value']))
        if 'other_projects' in values:
            data_rows.append(('projects_other_count', str(year), values['other_projects']))

        if all(k in values for k in ['oil_gas_value', 'electricity_value', 'other_value']):
            total_value = values['oil_gas_value'] + values['electricity_value'] + values['other_value']
            data_rows.append(('projects_total_value', str(year), round(total_value, 1)))
        if all(k in values for k in ['oil_gas_projects', 'electricity_projects', 'other_projects']):
            total_projects = values['oil_gas_projects'] + values['electricity_projects'] + values['other_projects']
            data_rows.append(('projects_total_count', str(year), total_projects))

    source_org = 'NRCan'
    source_url = NRCAN_MPI_SOURCE_URL
    metadata_rows = [
        ('projects_oil_gas_value', 'Oil and gas - Project value', 'Billions of dollars', 'billions', source_org, source_url),
        ('projects_oil_gas_count', 'Oil and gas - Number of projects', 'Number', 'units', source_org, source_url),
        ('projects_electricity_value', 'Electricity - Project value', 'Billions of dollars', 'billions', source_org, source_url),
        ('projects_electricity_count', 'Electricity - Number of projects', 'Number', 'units', source_org, source_url),
        ('projects_other_value', 'Other - Project value', 'Billions of dollars', 'billions', source_org, source_url),
        ('projects_other_count', 'Other - Number of projects', 'Number', 'units', source_org, source_url),
        ('projects_total_value', 'Total - Project value', 'Billions of dollars', 'billions', source_org, source_url),
        ('projects_total_count', 'Total - Number of projects', 'Number', 'units', source_org, source_url),
    ]

    if not data_rows:
        return 0
    print(f"    Major Projects: {len(data_rows)} indicator rows")
    return processor.store_indicators('major_projects', data_rows, metadata_rows)


def update_clean_tech(processor) -> int:
    """EEDAS ingest: scrape NRCan MPI Table 4 and store publisher-native rows."""
    print("  Fetching clean tech data...")
    print(f"    Source: NRCan Major Projects Inventory (Table 4)")
    print(f"    URL: {NRCAN_MPI_URL}")

    _energy_table, cleantech_table, soup = fetch_nrcan_mpi_tables(processor)
    clean_tech_data = parse_cleantech_table(cleantech_table)
    if not clean_tech_data:
        print("    WARNING: Could not parse clean tech table, using fallback extraction...")
        clean_tech_data = extract_cleantech_data_from_text(soup)
    if not clean_tech_data:
        raise RuntimeError("Could not retrieve clean tech data from NRCan MPI")

    raw_fields = []
    for cat in _RAW_CLEANTECH_CATEGORIES:
        raw_fields.extend([f'{cat}_projects', f'{cat}_value'])

    print(f"    Parsed clean tech data for years: {sorted(clean_tech_data.keys())}")
    return _store_publisher_dict(
        processor,
        'clean_tech',
        clean_tech_data,
        raw_fields,
        'NRCan',
        NRCAN_MPI_SOURCE_URL,
    )


def transform_clean_tech(processor) -> int:
    """EFB transform: build cleantech_* indicator vectors from raw MPI rows."""
    raw_fields = []
    for cat in _RAW_CLEANTECH_CATEGORIES:
        raw_fields.extend([f'{cat}_projects', f'{cat}_value'])

    clean_tech_data = _load_publisher_dict(
        processor.repo.get_raw_dataframe('clean_tech'),
        raw_fields,
    )
    if not clean_tech_data:
        print("    Warning: No raw clean tech data in database")
        return 0

    data_rows = []
    for year, values in clean_tech_data.items():
        for cat in _RAW_CLEANTECH_CATEGORIES:
            if f'{cat}_projects' in values:
                data_rows.append((f'cleantech_{cat}_count', str(year), values[f'{cat}_projects']))
            if f'{cat}_value' in values:
                data_rows.append((f'cleantech_{cat}_value', str(year), values[f'{cat}_value']))

    source_org = 'NRCan'
    source_url = NRCAN_MPI_SOURCE_URL
    metadata_rows = [
        ('cleantech_total_count', 'Total clean technology - Number of projects', 'Number', 'units', source_org, source_url),
        ('cleantech_total_value', 'Total clean technology - Project value', 'Billions of dollars', 'billions', source_org, source_url),
        ('cleantech_hydro_count', 'Hydro - Number of projects', 'Number', 'units', source_org, source_url),
        ('cleantech_hydro_value', 'Hydro - Project value', 'Billions of dollars', 'billions', source_org, source_url),
        ('cleantech_wind_count', 'Wind - Number of projects', 'Number', 'units', source_org, source_url),
        ('cleantech_wind_value', 'Wind - Project value', 'Billions of dollars', 'billions', source_org, source_url),
        ('cleantech_biomass_count', 'Biomass/Biofuels - Number of projects', 'Number', 'units', source_org, source_url),
        ('cleantech_biomass_value', 'Biomass/Biofuels - Project value', 'Billions of dollars', 'billions', source_org, source_url),
        ('cleantech_solar_count', 'Solar - Number of projects', 'Number', 'units', source_org, source_url),
        ('cleantech_solar_value', 'Solar - Project value', 'Billions of dollars', 'billions', source_org, source_url),
        ('cleantech_nuclear_count', 'Nuclear - Number of projects', 'Number', 'units', source_org, source_url),
        ('cleantech_nuclear_value', 'Nuclear - Project value', 'Billions of dollars', 'billions', source_org, source_url),
        ('cleantech_ccs_count', 'Carbon Capture and Storage - Number of projects', 'Number', 'units', source_org, source_url),
        ('cleantech_ccs_value', 'Carbon Capture and Storage - Project value', 'Billions of dollars', 'billions', source_org, source_url),
        ('cleantech_geothermal_count', 'Geothermal - Number of projects', 'Number', 'units', source_org, source_url),
        ('cleantech_geothermal_value', 'Geothermal - Project value', 'Billions of dollars', 'billions', source_org, source_url),
        ('cleantech_tidal_count', 'Tidal - Number of projects', 'Number', 'units', source_org, source_url),
        ('cleantech_tidal_value', 'Tidal - Project value', 'Billions of dollars', 'billions', source_org, source_url),
        ('cleantech_storage_count', 'Energy Storage - Number of projects', 'Number', 'units', source_org, source_url),
        ('cleantech_storage_value', 'Energy Storage - Project value', 'Billions of dollars', 'billions', source_org, source_url),
        ('cleantech_multiple_count', 'Multiple - Number of projects', 'Number', 'units', source_org, source_url),
        ('cleantech_multiple_value', 'Multiple - Project value', 'Billions of dollars', 'billions', source_org, source_url),
        ('cleantech_other_count', 'Other - Number of projects', 'Number', 'units', source_org, source_url),
        ('cleantech_other_value', 'Other - Project value', 'Billions of dollars', 'billions', source_org, source_url),
    ]

    if not data_rows:
        return 0
    print(f"    Clean Tech Trends: {len(data_rows)} indicator rows")
    return processor.store_indicators('clean_tech', data_rows, metadata_rows)


def process_major_projects(processor) -> int:
    """Deprecated: run update then transform."""
    return update_major_projects(processor) + transform_major_projects(processor)


def process_clean_tech(processor) -> int:
    """Deprecated: run update then transform."""
    return update_clean_tech(processor) + transform_clean_tech(processor)
