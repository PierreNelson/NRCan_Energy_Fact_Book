"""Infrastructure stock (StatCan Table 36-10-0608-01)."""

import pandas as pd

from .constants import INFRA_VECTORS
from ._statcan import get_infrastructure_url


def update_infrastructure(processor) -> int:
    """EEDAS ingest: fetch StatCan CSV and store v* vectors only."""
    print("  Fetching infrastructure stock data...")

    df = processor.fetch_csv_from_url(get_infrastructure_url())
    raw_data_rows, raw_metadata = processor.extract_data_and_metadata(df, 'infrastructure')
    if not raw_data_rows:
        print("    Warning: No raw StatCan data extracted")
        return 0

    n = processor.replace_raw_data('infrastructure', raw_data_rows, raw_metadata)
    print(f"    Stored {n} raw StatCan data points")
    return n


def transform_infrastructure(processor) -> int:
    """EFB transform: aggregate raw StatCan vectors into infra_* indicator vectors."""
    raw_df = processor.repo.get_raw_dataframe('infrastructure')
    if raw_df is None or raw_df.empty:
        print("    Warning: No raw infrastructure data in database")
        return 0

    df = raw_df.copy()
    df['vector_norm'] = df['vector'].astype(str).apply(
        lambda v: v if str(v).startswith('v') else f'v{v}'
    )
    df['year'] = pd.to_numeric(df['ref_date'], errors='coerce')
    value_col = 'value'

    all_vectors = set(INFRA_VECTORS.values())
    df_filtered = df[df['vector_norm'].isin(all_vectors)].copy()
    years = sorted(df_filtered['year'].dropna().unique())
    data_rows = []

    for year in years:
        year_df = df_filtered[df_filtered['year'] == year]

        def get_val(vector_key):
            vec = INFRA_VECTORS.get(vector_key)
            row = year_df[year_df['vector_norm'] == vec]
            return float(row[value_col].sum()) if not row.empty else 0

        fuel_energy = get_val('fuel_and_energy')
        transport_raw = get_val('transport')
        pipeline_transport = get_val('pipeline_transport')
        health = get_val('health')
        housing = get_val('housing')
        education = get_val('education')
        public_order = get_val('public_order')
        transit = get_val('transit')
        environmental = get_val('environmental')
        communication = get_val('communication')
        recreation = get_val('recreation')

        fuel_energy_pipelines = fuel_energy + pipeline_transport
        transport = transport_raw - pipeline_transport
        health_housing = health + housing
        public_safety = public_order + transit + communication + recreation
        total = fuel_energy_pipelines + transport + health_housing + education + public_safety + environmental

        if total > 0:
            year_int = int(year)
            fuel_energy_pipelines_pct = round((fuel_energy_pipelines / total) * 100, 1)
            transport_pct = round((transport / total) * 100, 1)
            health_housing_pct = round((health_housing / total) * 100, 1)
            education_pct = round((education / total) * 100, 1)
            public_safety_pct = round((public_safety / total) * 100, 1)
            environmental_pct = round((environmental / total) * 100, 1)
            total_billions = round(total / 1000, 2)
            fuel_energy_pipelines_billions = round(fuel_energy_pipelines / 1000, 2)
            transport_billions = round(transport / 1000, 2)
            health_housing_billions = round(health_housing / 1000, 2)
            education_billions = round(education / 1000, 2)
            public_safety_billions = round(public_safety / 1000, 2)
            environmental_billions = round(environmental / 1000, 2)

            data_rows.extend([
                ('infra_fuel_energy_pipelines', str(year_int), round(float(fuel_energy_pipelines), 1)),
                ('infra_transport', str(year_int), round(float(transport), 1)),
                ('infra_health_housing', str(year_int), round(float(health_housing), 1)),
                ('infra_education', str(year_int), round(float(education), 1)),
                ('infra_public_safety', str(year_int), round(float(public_safety), 1)),
                ('infra_environmental', str(year_int), round(float(environmental), 1)),
                ('infra_total', str(year_int), round(float(total), 1)),
                ('infra_fuel_energy_pipelines_pct', str(year_int), fuel_energy_pipelines_pct),
                ('infra_transport_pct', str(year_int), transport_pct),
                ('infra_health_housing_pct', str(year_int), health_housing_pct),
                ('infra_education_pct', str(year_int), education_pct),
                ('infra_public_safety_pct', str(year_int), public_safety_pct),
                ('infra_environmental_pct', str(year_int), environmental_pct),
                ('infra_fuel_energy_pipelines_billions', str(year_int), fuel_energy_pipelines_billions),
                ('infra_transport_billions', str(year_int), transport_billions),
                ('infra_health_housing_billions', str(year_int), health_housing_billions),
                ('infra_education_billions', str(year_int), education_billions),
                ('infra_public_safety_billions', str(year_int), public_safety_billions),
                ('infra_environmental_billions', str(year_int), environmental_billions),
                ('infra_total_billions', str(year_int), total_billions),
            ])

    source_org = 'Statistics Canada'
    source_url = 'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=3610060801'
    metadata_rows = [
        ('infra_fuel_energy_pipelines', 'Infrastructure - Fuel, energy and pipelines', 'Millions of dollars', 'millions', source_org, source_url),
        ('infra_transport', 'Infrastructure - Transport (less pipelines)', 'Millions of dollars', 'millions', source_org, source_url),
        ('infra_health_housing', 'Infrastructure - Health and housing', 'Millions of dollars', 'millions', source_org, source_url),
        ('infra_education', 'Infrastructure - Education', 'Millions of dollars', 'millions', source_org, source_url),
        ('infra_public_safety', 'Infrastructure - Public safety and other', 'Millions of dollars', 'millions', source_org, source_url),
        ('infra_environmental', 'Infrastructure - Environmental protection', 'Millions of dollars', 'millions', source_org, source_url),
        ('infra_total', 'Infrastructure - Total net stock', 'Millions of dollars', 'millions', source_org, source_url),
        ('infra_fuel_energy_pipelines_pct', 'Infrastructure - Fuel, energy and pipelines (% of total)', 'Percent', 'percent', source_org, source_url),
        ('infra_transport_pct', 'Infrastructure - Transport (% of total)', 'Percent', 'percent', source_org, source_url),
        ('infra_health_housing_pct', 'Infrastructure - Health and housing (% of total)', 'Percent', 'percent', source_org, source_url),
        ('infra_education_pct', 'Infrastructure - Education (% of total)', 'Percent', 'percent', source_org, source_url),
        ('infra_public_safety_pct', 'Infrastructure - Public safety (% of total)', 'Percent', 'percent', source_org, source_url),
        ('infra_environmental_pct', 'Infrastructure - Environmental protection (% of total)', 'Percent', 'percent', source_org, source_url),
        ('infra_fuel_energy_pipelines_billions', 'Infrastructure - Fuel, energy and pipelines', 'Billions of dollars', 'billions', source_org, source_url),
        ('infra_transport_billions', 'Infrastructure - Transport', 'Billions of dollars', 'billions', source_org, source_url),
        ('infra_health_housing_billions', 'Infrastructure - Health and housing', 'Billions of dollars', 'billions', source_org, source_url),
        ('infra_education_billions', 'Infrastructure - Education', 'Billions of dollars', 'billions', source_org, source_url),
        ('infra_public_safety_billions', 'Infrastructure - Public safety', 'Billions of dollars', 'billions', source_org, source_url),
        ('infra_environmental_billions', 'Infrastructure - Environmental protection', 'Billions of dollars', 'billions', source_org, source_url),
        ('infra_total_billions', 'Infrastructure - Total net stock', 'Billions of dollars', 'billions', source_org, source_url),
    ]

    if not data_rows:
        return 0
    return processor.store_indicators('infrastructure', data_rows, metadata_rows)


def process_infrastructure(processor) -> int:
    """Deprecated: run update then transform."""
    return update_infrastructure(processor) + transform_infrastructure(processor)
