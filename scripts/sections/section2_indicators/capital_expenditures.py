"""Capital expenditures (StatCan Table 34-10-0036-01)."""

import pandas as pd

from ._shared import raw_to_dimension_df, store_publisher_rows
from ._statcan import get_capital_expenditures_url

SOURCE_ORG = 'Statistics Canada'
SOURCE_URL = 'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=3410003601'


def update_capital_expenditures(processor) -> int:
    """EEDAS ingest: fetch StatCan CSV and store publisher-native dimension rows."""
    print("  Fetching capital expenditures data...")

    try:
        df = processor.fetch_csv_from_url(get_capital_expenditures_url())
    except Exception as e:
        raise RuntimeError(f"Failed to fetch capital expenditures data: {e}") from e

    ref_date_col = processor.get_column(df, 'REF_DATE', 'Ref_date', 'ref_date')
    value_col = processor.get_column(df, 'VALUE', 'Value', 'value')

    capex_col = None
    for col in df.columns:
        if 'capital' in col.lower() and 'repair' in col.lower():
            capex_col = col
            break

    naics_col = None
    for col in df.columns:
        if 'naics' in col.lower() or 'industry' in col.lower():
            naics_col = col
            break

    if not ref_date_col or not value_col:
        print(f"    Warning: Missing REF_DATE or VALUE. Columns: {df.columns.tolist()[:10]}")
        return 0

    dim_cols = [c for c in (capex_col, naics_col) if c]
    n = store_publisher_rows(
        processor,
        'capital_expenditures',
        df,
        ref_date_col,
        value_col,
        dim_cols,
        source_org=SOURCE_ORG,
        source_url=SOURCE_URL,
    )
    print(f"    Stored {n} publisher-native data points")
    return n


def transform_capital_expenditures(processor) -> int:
    """EFB transform: aggregate raw StatCan rows into capex_* indicator vectors."""
    raw_df = processor.repo.get_raw_dataframe('capital_expenditures')
    if raw_df is None or raw_df.empty:
        print("    Warning: No raw capital expenditures data in database")
        return 0

    df = raw_to_dimension_df(raw_df, ['capex_type', 'naics'])
    df['year'] = pd.to_numeric(df['ref_date'], errors='coerce')

    if 'capex_type' in df.columns:
        df = df[
            df['capex_type'].astype(str).str.contains('Capital expenditures', case=False, na=False)
            & ~df['capex_type'].astype(str).str.contains('Repair construction', case=False, na=False)
        ].copy()

    years = sorted(df['year'].dropna().unique())
    if not years:
        return 0

    naics_col = 'naics'
    value_col = 'value'

    def _sum_naics(year_df, pattern, *, exact=False):
        if naics_col not in year_df.columns:
            return 0.0
        if exact:
            mask = year_df[naics_col].astype(str).str.match(pattern, na=False)
        else:
            mask = year_df[naics_col].astype(str).str.contains(pattern, regex=True, na=False)
        return float(year_df.loc[mask, value_col].sum())

    data_rows = []

    for year in years:
        year_df = df[df['year'] == year]

        oil_gas = _sum_naics(year_df, r'^Oil and gas extraction \[211\]$', exact=True)
        electricity = _sum_naics(year_df, r'\[2211\]')
        mining_ex_oil_gas = _sum_naics(
            year_df, r'^Mining and quarrying \(except oil and gas\) \[212\]$', exact=True
        )
        coal = _sum_naics(year_df, r'^Coal mining \[2121\]$', exact=True)
        support = _sum_naics(
            year_df,
            r'^Support activities for mining, and oil and gas extraction \[213\]$',
            exact=True,
        )
        nat_gas = _sum_naics(year_df, r'\[2212\]')
        petroleum = _sum_naics(year_df, r'\[324\]')
        pipeline = _sum_naics(year_df, r'\[486\]')

        support_oil_gas = 0.0
        mining_denominator = oil_gas + mining_ex_oil_gas
        if mining_denominator > 0 and support > 0:
            support_oil_gas = (oil_gas / mining_denominator) * support

        other = coal + nat_gas + petroleum + pipeline + support_oil_gas
        total = oil_gas + electricity + other

        if total > 0:
            year_int = int(year)
            oil_gas_pct = round((oil_gas / total) * 100, 1)
            electricity_pct = round((electricity / total) * 100, 1)
            other_pct = round((other / total) * 100, 1)
            total_billions = round(total / 1000, 2)
            oil_gas_billions = round(oil_gas / 1000, 2)
            electricity_billions = round(electricity / 1000, 2)
            other_billions = round(other / 1000, 2)

            data_rows.extend([
                ('capex_oil_gas', str(year_int), round(oil_gas, 1)),
                ('capex_electricity', str(year_int), round(electricity, 1)),
                ('capex_other', str(year_int), round(other, 1)),
                ('capex_total', str(year_int), round(total, 1)),
                ('capex_oil_gas_pct', str(year_int), oil_gas_pct),
                ('capex_electricity_pct', str(year_int), electricity_pct),
                ('capex_other_pct', str(year_int), other_pct),
                ('capex_oil_gas_billions', str(year_int), oil_gas_billions),
                ('capex_electricity_billions', str(year_int), electricity_billions),
                ('capex_other_billions', str(year_int), other_billions),
                ('capex_total_billions', str(year_int), total_billions),
            ])

    metadata_rows = [
        ('capex_oil_gas', 'Capital expenditures - Oil and gas extraction', 'Millions of dollars', 'millions', SOURCE_ORG, SOURCE_URL),
        ('capex_electricity', 'Capital expenditures - Electric power', 'Millions of dollars', 'millions', SOURCE_ORG, SOURCE_URL),
        ('capex_other', 'Capital expenditures - Other energy', 'Millions of dollars', 'millions', SOURCE_ORG, SOURCE_URL),
        ('capex_total', 'Capital expenditures - Total energy sector', 'Millions of dollars', 'millions', SOURCE_ORG, SOURCE_URL),
        ('capex_oil_gas_pct', 'Capital expenditures - Oil and gas (% of total)', 'Percent', 'percent', SOURCE_ORG, SOURCE_URL),
        ('capex_electricity_pct', 'Capital expenditures - Electric power (% of total)', 'Percent', 'percent', SOURCE_ORG, SOURCE_URL),
        ('capex_other_pct', 'Capital expenditures - Other energy (% of total)', 'Percent', 'percent', SOURCE_ORG, SOURCE_URL),
        ('capex_oil_gas_billions', 'Capital expenditures - Oil and gas extraction', 'Billions of dollars', 'billions', SOURCE_ORG, SOURCE_URL),
        ('capex_electricity_billions', 'Capital expenditures - Electric power', 'Billions of dollars', 'billions', SOURCE_ORG, SOURCE_URL),
        ('capex_other_billions', 'Capital expenditures - Other energy', 'Billions of dollars', 'billions', SOURCE_ORG, SOURCE_URL),
        ('capex_total_billions', 'Capital expenditures - Total energy sector', 'Billions of dollars', 'billions', SOURCE_ORG, SOURCE_URL),
    ]

    if not data_rows:
        return 0
    return processor.store_indicators('capital_expenditures', data_rows, metadata_rows)


def process_capital_expenditures(processor) -> int:
    """Deprecated: run update then transform."""
    n_update = update_capital_expenditures(processor)
    n_transform = transform_capital_expenditures(processor)
    return n_update + n_transform
