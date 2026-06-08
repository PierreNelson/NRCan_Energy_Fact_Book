"""Foreign control (StatCan Table 33-10-0570-01)."""

import pandas as pd

from ._shared import raw_to_dimension_df, store_publisher_rows
from ._statcan import get_foreign_control_url


def update_foreign_control(processor) -> int:
    """EEDAS ingest: fetch StatCan CSV and store publisher-native rows."""
    print("  Fetching foreign control data...")

    df = processor.fetch_csv_from_url(get_foreign_control_url())
    ref_date_col = processor.get_column(df, 'REF_DATE', 'Ref_date', 'ref_date')
    value_col = processor.get_column(df, 'VALUE', 'Value', 'value')
    naics_col = processor.get_column(
        df, 'North American Industry Classification System (NAICS)', 'NAICS', 'Industry'
    )

    if not naics_col or not ref_date_col or not value_col:
        print(f"    Warning: Missing required columns. Columns: {df.columns.tolist()[:10]}")
        return 0

    source_org = 'Statistics Canada'
    source_url = 'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=3310002401'
    return store_publisher_rows(
        processor,
        'foreign_control',
        df,
        ref_date_col,
        value_col,
        [naics_col],
        source_org,
        source_url,
    )


def transform_foreign_control(processor) -> int:
    """EFB transform: map raw NAICS rows to foreign_* indicator vectors."""
    raw_df = processor.repo.get_raw_dataframe('foreign_control')
    if raw_df is None or raw_df.empty:
        print("    Warning: No raw foreign control data in database")
        return 0

    df = raw_to_dimension_df(raw_df, ['NAICS'])
    df['year'] = pd.to_numeric(df['ref_date'], errors='coerce')
    value_col = 'value'
    naics_col = 'NAICS'

    industry_mapping = {
        'Total non-financial industries (excluding management of companies and enterprises)': 'foreign_all_non_financial',
        'Oil and gas extraction and support activities [211, 213]': 'foreign_oil_gas',
        'Utilities [22]': 'foreign_utilities',
    }

    years = sorted(df['year'].dropna().unique())
    data_rows = []

    for year in years:
        year_df = df[df['year'] == year]
        year_int = int(year)
        for industry_name, vector_key in industry_mapping.items():
            industry_row = year_df[year_df[naics_col] == industry_name]
            if not industry_row.empty:
                value = industry_row[value_col].values[0]
                if pd.notna(value):
                    data_rows.append((vector_key, str(year_int), round(float(value), 1)))

    source_org = 'Statistics Canada'
    source_url = 'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=3310002401'
    metadata_rows = [
        ('foreign_all_non_financial', 'Foreign control - Total non-financial industries', 'Percent', 'percent', source_org, source_url),
        ('foreign_oil_gas', 'Foreign control - Oil and gas extraction', 'Percent', 'percent', source_org, source_url),
        ('foreign_utilities', 'Foreign control - Utilities', 'Percent', 'percent', source_org, source_url),
    ]

    if not data_rows:
        return 0
    return processor.store_indicators('foreign_control', data_rows, metadata_rows)


def process_foreign_control(processor) -> int:
    """Deprecated: run update then transform."""
    return update_foreign_control(processor) + transform_foreign_control(processor)
