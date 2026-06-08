"""Investment by asset type (StatCan Table 36-10-0608-01)."""

import pandas as pd

from ._shared import raw_to_dimension_df, store_publisher_rows
from ._statcan import get_investment_by_asset_url


def update_investment_by_asset(processor) -> int:
    """EEDAS ingest: fetch StatCan CSV and store publisher-native rows."""
    print("  Fetching investment by asset type data...")

    df = processor.fetch_csv_from_url(get_investment_by_asset_url())
    asset_col = processor.get_column(df, 'Asset', 'ASSET', 'asset')
    ref_date_col = processor.get_column(df, 'REF_DATE', 'Ref_date', 'ref_date')
    value_col = processor.get_column(df, 'VALUE', 'Value', 'value')

    if not asset_col or not ref_date_col or not value_col:
        print(f"    Warning: Missing required columns. Columns: {df.columns.tolist()[:10]}")
        return 0

    source_org = 'Statistics Canada'
    source_url = 'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=3410035801'
    return store_publisher_rows(
        processor,
        'investment_by_asset',
        df,
        ref_date_col,
        value_col,
        [asset_col],
        source_org,
        source_url,
    )


def transform_investment_by_asset(processor) -> int:
    """EFB transform: aggregate raw rows into asset_* indicator vectors."""
    raw_df = processor.repo.get_raw_dataframe('investment_by_asset')
    if raw_df is None or raw_df.empty:
        print("    Warning: No raw investment by asset data in database")
        return 0

    df = raw_to_dimension_df(raw_df, ['Asset'])
    df['year'] = pd.to_numeric(df['ref_date'], errors='coerce')
    df = df[df['year'] >= 2009].copy()

    asset_col = 'Asset'
    value_col = 'value'
    years = sorted(df['year'].dropna().unique())
    data_rows = []

    asset_exact_names = {
        'wind_solar': 'Wind and solar power plants',
        'steam_thermal': 'Steam production plants',
        'nuclear': 'Nuclear production plants',
        'hydraulic': 'Hydraulic production plants',
        'other_electric': 'Other electric power construction',
        'transmission_networks': 'Power transmission networks',
        'distribution_networks': 'Power distribution networks',
        'pipelines': 'Pipelines',
        'transformers': 'Power and distribution transformers',
    }

    for year in years:
        year_df = df[df['year'] == year]
        year_int = int(year)
        values = {}
        for key, exact_name in asset_exact_names.items():
            mask = year_df[asset_col] == exact_name
            values[key] = float(year_df.loc[mask, value_col].sum())

        transmission_distribution = (
            values.get('transmission_networks', 0)
            + values.get('distribution_networks', 0)
            + values.get('transformers', 0)
        )
        total = (
            transmission_distribution
            + values.get('pipelines', 0)
            + values.get('nuclear', 0)
            + values.get('wind_solar', 0)
            + values.get('hydraulic', 0)
            + values.get('steam_thermal', 0)
            + values.get('other_electric', 0)
        )

        if total > 0:
            data_rows.extend([
                ('asset_wind_solar', str(year_int), round(float(values['wind_solar']), 1)),
                ('asset_transmission_distribution', str(year_int), round(float(transmission_distribution), 1)),
                ('asset_pipelines', str(year_int), round(float(values['pipelines']), 1)),
                ('asset_nuclear', str(year_int), round(float(values['nuclear']), 1)),
                ('asset_hydraulic', str(year_int), round(float(values['hydraulic']), 1)),
                ('asset_steam_thermal', str(year_int), round(float(values['steam_thermal']), 1)),
                ('asset_other_electric', str(year_int), round(float(values['other_electric']), 1)),
                ('asset_total', str(year_int), round(float(total), 1)),
                ('asset_wind_solar_billions', str(year_int), round(float(values['wind_solar']) / 1000, 2)),
                ('asset_transmission_distribution_billions', str(year_int), round(float(transmission_distribution) / 1000, 2)),
                ('asset_pipelines_billions', str(year_int), round(float(values['pipelines']) / 1000, 2)),
                ('asset_nuclear_billions', str(year_int), round(float(values['nuclear']) / 1000, 2)),
                ('asset_hydraulic_billions', str(year_int), round(float(values['hydraulic']) / 1000, 2)),
                ('asset_steam_thermal_billions', str(year_int), round(float(values['steam_thermal']) / 1000, 2)),
                ('asset_other_electric_billions', str(year_int), round(float(values['other_electric']) / 1000, 2)),
                ('asset_total_billions', str(year_int), round(float(total) / 1000, 2)),
            ])

    source_org = 'Statistics Canada'
    source_url = 'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=3410035801'
    metadata_rows = [
        ('asset_wind_solar', 'Investment by asset - Wind and solar', 'Millions of dollars', 'millions', source_org, source_url),
        ('asset_transmission_distribution', 'Investment by asset - Transmission and distribution', 'Millions of dollars', 'millions', source_org, source_url),
        ('asset_pipelines', 'Investment by asset - Pipelines', 'Millions of dollars', 'millions', source_org, source_url),
        ('asset_nuclear', 'Investment by asset - Nuclear', 'Millions of dollars', 'millions', source_org, source_url),
        ('asset_hydraulic', 'Investment by asset - Hydraulic', 'Millions of dollars', 'millions', source_org, source_url),
        ('asset_steam_thermal', 'Investment by asset - Steam/thermal', 'Millions of dollars', 'millions', source_org, source_url),
        ('asset_other_electric', 'Investment by asset - Other electric', 'Millions of dollars', 'millions', source_org, source_url),
        ('asset_total', 'Investment - Total fuel, energy and pipeline', 'Millions of dollars', 'millions', source_org, source_url),
        ('asset_wind_solar_billions', 'Investment by asset - Wind and solar (billions)', 'Billions of dollars', 'billions', source_org, source_url),
        ('asset_transmission_distribution_billions', 'Investment by asset - Transmission and distribution (billions)', 'Billions of dollars', 'billions', source_org, source_url),
        ('asset_pipelines_billions', 'Investment by asset - Pipelines (billions)', 'Billions of dollars', 'billions', source_org, source_url),
        ('asset_nuclear_billions', 'Investment by asset - Nuclear (billions)', 'Billions of dollars', 'billions', source_org, source_url),
        ('asset_hydraulic_billions', 'Investment by asset - Hydraulic (billions)', 'Billions of dollars', 'billions', source_org, source_url),
        ('asset_steam_thermal_billions', 'Investment by asset - Steam/thermal (billions)', 'Billions of dollars', 'billions', source_org, source_url),
        ('asset_other_electric_billions', 'Investment by asset - Other electric (billions)', 'Billions of dollars', 'billions', source_org, source_url),
        ('asset_total_billions', 'Investment - Total fuel, energy and pipeline (billions)', 'Billions of dollars', 'billions', source_org, source_url),
    ]

    if not data_rows:
        return 0
    return processor.store_indicators('investment_by_asset', data_rows, metadata_rows)


def process_investment_by_asset(processor) -> int:
    """Deprecated: run update then transform."""
    return update_investment_by_asset(processor) + transform_investment_by_asset(processor)
