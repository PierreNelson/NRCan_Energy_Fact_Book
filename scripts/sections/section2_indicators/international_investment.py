"""International investment FDI/CDIA (StatCan Table 36-10-0009-01)."""

import pandas as pd

from ._shared import raw_to_dimension_df, store_publisher_rows
from ._statcan import get_international_investment_url


def update_international_investment(processor) -> int:
    """EEDAS ingest: fetch StatCan CSV and store publisher-native rows."""
    print("  Fetching international investment data...")

    df = processor.fetch_csv_from_url(get_international_investment_url())
    ref_date_col = processor.get_column(df, 'REF_DATE', 'Ref_date', 'ref_date')
    value_col = processor.get_column(df, 'VALUE', 'Value', 'value')
    naics_col = processor.get_column(
        df, 'North American Industry Classification System (NAICS)', 'NAICS', 'Industry'
    )
    investment_col = processor.get_column(
        df, 'Canadian and foreign direct investment', 'Investment type', 'Type'
    )

    if not naics_col or not investment_col or not ref_date_col or not value_col:
        print(f"    Warning: Missing required columns. Columns: {df.columns.tolist()[:10]}")
        return 0

    source_org = 'Statistics Canada'
    source_url = 'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=3610001001'
    return store_publisher_rows(
        processor,
        'international_investment',
        df,
        ref_date_col,
        value_col,
        [naics_col, investment_col],
        source_org,
        source_url,
    )


def transform_international_investment(processor) -> int:
    """EFB transform: aggregate raw rows into intl_* indicator vectors."""
    raw_df = processor.repo.get_raw_dataframe('international_investment')
    if raw_df is None or raw_df.empty:
        print("    Warning: No raw international investment data in database")
        return 0

    df = raw_to_dimension_df(raw_df, ['NAICS', 'Investment'])
    df['year'] = pd.to_numeric(df['ref_date'], errors='coerce')
    df = df[df['year'] >= 2007].copy()

    naics_col = 'NAICS'
    investment_col = 'Investment'
    value_col = 'value'
    energy_industries = [
        'Oil and gas extraction [211]',
        'Support activities for mining and oil and gas extraction [213]',
        'Utilities [22]',
        'Petroleum and coal products manufacturing [324]',
    ]

    years = sorted(df['year'].dropna().unique())
    data_rows = []

    for year in years:
        year_df = df[df['year'] == year]
        year_int = int(year)
        year_energy = year_df[year_df[naics_col].isin(energy_industries)]

        cdia_mask = year_energy[investment_col].str.contains(
            'Canadian direct investment abroad', case=False, na=False
        )
        cdia_total = float(year_energy.loc[cdia_mask, value_col].sum())

        fdi_mask = year_energy[investment_col].str.contains(
            'Foreign direct investment in Canada', case=False, na=False
        )
        fdi_total = float(year_energy.loc[fdi_mask, value_col].sum())

        if cdia_total > 0 or fdi_total > 0:
            data_rows.extend([
                ('intl_cdia', str(year_int), round(float(cdia_total), 1)),
                ('intl_fdi', str(year_int), round(float(fdi_total), 1)),
                ('intl_cdia_billions', str(year_int), round(float(cdia_total) / 1000, 1)),
                ('intl_fdi_billions', str(year_int), round(float(fdi_total) / 1000, 1)),
            ])

    source_org = 'Statistics Canada'
    source_url = 'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=3610001001'
    metadata_rows = [
        ('intl_cdia', 'Canadian direct investment abroad (CDIA) - Energy industry', 'Millions of dollars', 'millions', source_org, source_url),
        ('intl_fdi', 'Foreign direct investment in Canada (FDI) - Energy industry', 'Millions of dollars', 'millions', source_org, source_url),
        ('intl_cdia_billions', 'CDIA - Energy industry (billions)', 'Billions of dollars', 'billions', source_org, source_url),
        ('intl_fdi_billions', 'FDI - Energy industry (billions)', 'Billions of dollars', 'billions', source_org, source_url),
    ]

    if not data_rows:
        return 0
    return processor.store_indicators('international_investment', data_rows, metadata_rows)


def process_international_investment(processor) -> int:
    """Deprecated: run update then transform."""
    return update_international_investment(processor) + transform_international_investment(processor)
