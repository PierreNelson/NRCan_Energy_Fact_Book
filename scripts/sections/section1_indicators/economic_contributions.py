"""Economic contributions (GDP, Jobs, Income) — StatCan Table 36-10-0610-01."""

import pandas as pd

from ._statcan import get_economic_contributions_url
from .constants import ECON_VECTORS


def update_economic_contributions(processor) -> int:
    """EEDAS ingest: fetch StatCan CSV and store v* vectors only."""
    print("  Fetching economic contributions data...")

    df_econ = processor.fetch_csv_from_url(get_economic_contributions_url())
    raw_data_rows, raw_metadata = processor.extract_data_and_metadata(df_econ, 'economic_contributions')
    if not raw_data_rows:
        print("    Warning: No raw StatCan data extracted")
        return 0

    n = processor.replace_raw_data('economic_contributions', raw_data_rows, raw_metadata)
    print(f"    Stored {n} raw StatCan data points")
    return n


def transform_economic_contributions(processor) -> int:
    """EFB transform: build econ_* vectors from raw econ + capital_expenditures data."""
    raw_econ = processor.repo.get_raw_dataframe('economic_contributions')
    if raw_econ is None or raw_econ.empty:
        print("    Warning: No raw economic contributions data in database")
        return 0

    df_filtered = raw_econ.copy()
    df_filtered['vector_norm'] = df_filtered['vector'].astype(str).apply(
        lambda v: v if str(v).startswith('v') else f'v{v}'
    )
    df_filtered['year'] = pd.to_numeric(df_filtered['ref_date'], errors='coerce')
    value_col = 'value'

    all_vectors = set(ECON_VECTORS.values())
    df_filtered = df_filtered[df_filtered['vector_norm'].isin(all_vectors)].copy()
    years = sorted(df_filtered['year'].dropna().unique())

    raw_capex = processor.repo.get_raw_dataframe('capital_expenditures')
    df_capex = None
    if raw_capex is not None and not raw_capex.empty:
        df_capex = raw_capex.copy()
        df_capex['year'] = pd.to_numeric(df_capex['ref_date'], errors='coerce')
        if 'title' in df_capex.columns:
            titles = df_capex['title'].astype(str)
            df_capex = df_capex[
                titles.str.contains('Capital expenditures', case=False, na=False)
                & ~titles.str.contains('Repair construction', case=False, na=False)
            ].copy()

    data_rows = []

    for year in years:
        year_df = df_filtered[df_filtered['year'] == year]

        def get_val(vector_key):
            vec = ECON_VECTORS.get(vector_key)
            row = year_df[year_df['vector_norm'] == vec]
            if not row.empty:
                val = row[value_col].iloc[0]
                return float(val) if pd.notna(val) else 0
            return 0

        jobs_direct = get_val('jobs_direct')
        jobs_indirect = get_val('jobs_indirect')
        jobs_total = (jobs_direct + jobs_indirect) * 1000
        income_direct = get_val('income_direct')
        income_indirect = get_val('income_indirect')
        income_total = income_direct + income_indirect
        gdp_direct = get_val('gdp_direct')
        gdp_indirect = get_val('gdp_indirect')
        gdp_total = gdp_direct + gdp_indirect

        investment_value = 0.0
        if df_capex is not None and 'title' in df_capex.columns:
            year_capex = df_capex[df_capex['year'] == year]
            investment_mask = year_capex['title'].str.contains(
                r'\[211\]|\[2211\]|\[2212\]|\[486\]|\[324\]', regex=True, na=False
            )
            investment_value = float(year_capex.loc[investment_mask, value_col].sum())

        if any([jobs_total, income_total, gdp_total]):
            year_int = int(year)
            data_rows.extend([
                ('econ_jobs', str(year_int), round(float(jobs_total), 0)),
                ('econ_employment_income', str(year_int), round(float(income_total), 1)),
                ('econ_gdp', str(year_int), round(float(gdp_total), 1)),
                ('econ_investment_value', str(year_int), round(float(investment_value), 1)),
                ('econ_jobs_thousands', str(year_int), round(float(jobs_total) / 1000, 1)),
                ('econ_employment_income_billions', str(year_int), round(float(income_total) / 1000, 2)),
                ('econ_gdp_billions', str(year_int), round(float(gdp_total) / 1000, 2)),
                ('econ_investment_value_billions', str(year_int), round(float(investment_value) / 1000, 2)),
            ])

    source_org = 'Statistics Canada'
    source_url = 'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=3610061001'
    metadata_rows = [
        ('econ_jobs', 'Economic contributions - Jobs (direct + indirect)', 'Number', 'units', source_org, source_url),
        ('econ_employment_income', 'Economic contributions - Employment income', 'Millions of dollars', 'millions', source_org, source_url),
        ('econ_gdp', 'Economic contributions - GDP', 'Millions of dollars', 'millions', source_org, source_url),
        ('econ_investment_value', 'Annual investment - Fuel, energy and pipelines', 'Millions of dollars', 'millions', source_org, source_url),
        ('econ_jobs_thousands', 'Economic contributions - Jobs (thousands)', 'Thousands', 'thousands', source_org, source_url),
        ('econ_employment_income_billions', 'Economic contributions - Employment income (billions)', 'Billions of dollars', 'billions', source_org, source_url),
        ('econ_gdp_billions', 'Economic contributions - GDP (billions)', 'Billions of dollars', 'billions', source_org, source_url),
        ('econ_investment_value_billions', 'Annual investment (billions)', 'Billions of dollars', 'billions', source_org, source_url),
    ]

    if not data_rows:
        return 0
    return processor.store_indicators('economic_contributions', data_rows, metadata_rows)


def process_economic_contributions(processor) -> int:
    """Deprecated: run update then transform."""
    return update_economic_contributions(processor) + transform_economic_contributions(processor)
