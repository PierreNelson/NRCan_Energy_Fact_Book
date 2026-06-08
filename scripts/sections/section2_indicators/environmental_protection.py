"""Environmental protection expenditures (StatCan Table 38-10-0130-01)."""

import pandas as pd

from ._shared import raw_to_dimension_df, store_publisher_rows
from ._statcan import get_environmental_protection_url


def update_environmental_protection(processor) -> int:
    """EEDAS ingest: fetch StatCan CSV and store publisher-native rows."""
    print("  Fetching environmental protection data...")

    df = processor.fetch_csv_from_url(get_environmental_protection_url())
    source_org = 'Statistics Canada'
    source_url = 'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=3810013001'
    return store_publisher_rows(
        processor,
        'environmental_protection',
        df,
        'REF_DATE',
        'VALUE',
        ['Expenditures', 'Industries', 'Environmental protection activities'],
        source_org,
        source_url,
    )


def transform_environmental_protection(processor) -> int:
    """EFB transform: aggregate raw rows into enviro_* indicator vectors."""
    raw_df = processor.repo.get_raw_dataframe('environmental_protection')
    if raw_df is None or raw_df.empty:
        print("    Warning: No raw environmental protection data in database")
        return 0

    df = raw_to_dimension_df(
        raw_df,
        ['Expenditures', 'Industries', 'Environmental protection activities'],
    )
    df = df.rename(columns={
        'Expenditures': 'Expenditures',
        'Industries': 'Industries',
        'Environmental protection activities': 'Environmental protection activities',
    })
    df = df[df['Expenditures'] == 'Total, expenditures'].copy()
    df['year'] = pd.to_numeric(df['ref_date'], errors='coerce').astype(int)
    df = df[df['year'] >= 2018].copy()

    industries = {
        'oil_gas': 'Oil and gas extraction [211]',
        'electric': 'Electric power generation, transmission and distribution [2211]',
        'natural_gas': 'Natural gas distribution [2212]',
        'petroleum': 'Petroleum and coal product manufacturing [324]',
        'all_industries': 'Total, industries',
    }
    main_activities = {
        'wastewater': 'Wastewater management',
        'soil': 'Protection and remediation of soil, groundwater and surface water',
        'air': 'Air pollution management',
        'solid_waste': 'Solid waste management',
        'total': 'Total, environmental protection activities',
    }
    other_activities = [
        'Protection of biodiversity and habitat',
        'Noise and vibration abatement',
        'Protection against radiation',
        'Environmental charges',
        'Clean vehicles and transportation technologies',
        'Other environmental protection activities',
    ]

    data_rows = []

    for year in df['year'].unique():
        year_df = df[df['year'] == year]

        for act_key, act_name in main_activities.items():
            oil_gas_df = year_df[
                (year_df['Industries'] == industries['oil_gas'])
                & (year_df['Environmental protection activities'] == act_name)
            ]
            if len(oil_gas_df) > 0:
                value = oil_gas_df['value'].values[0]
                if pd.notna(value):
                    data_rows.append((f'enviro_oil_gas_{act_key}', str(year), float(value)))

        other_sum = 0.0
        for other_act in other_activities:
            oil_gas_other_df = year_df[
                (year_df['Industries'] == industries['oil_gas'])
                & (year_df['Environmental protection activities'] == other_act)
            ]
            if len(oil_gas_other_df) > 0:
                value = oil_gas_other_df['value'].values[0]
                if pd.notna(value):
                    other_sum += float(value)
        if other_sum > 0:
            data_rows.append(('enviro_oil_gas_other', str(year), other_sum))

        electric_df = year_df[
            (year_df['Industries'] == industries['electric'])
            & (year_df['Environmental protection activities'] == main_activities['total'])
        ]
        if len(electric_df) > 0:
            value = electric_df['value'].values[0]
            if pd.notna(value):
                data_rows.append(('enviro_electric_total', str(year), float(value)))

        natural_gas_df = year_df[
            (year_df['Industries'] == industries['natural_gas'])
            & (year_df['Environmental protection activities'] == main_activities['total'])
        ]
        if len(natural_gas_df) > 0:
            value = natural_gas_df['value'].values[0]
            if pd.notna(value):
                data_rows.append(('enviro_natural_gas_total', str(year), float(value)))

        petroleum_df = year_df[
            (year_df['Industries'] == industries['petroleum'])
            & (year_df['Environmental protection activities'] == main_activities['total'])
        ]
        if len(petroleum_df) > 0:
            value = petroleum_df['value'].values[0]
            if pd.notna(value):
                data_rows.append(('enviro_petroleum_total', str(year), float(value)))

        pollution_sum = 0.0
        for cat in ['air', 'wastewater', 'solid_waste', 'soil']:
            petroleum_cat_df = year_df[
                (year_df['Industries'] == industries['petroleum'])
                & (year_df['Environmental protection activities'] == main_activities[cat])
            ]
            if len(petroleum_cat_df) > 0:
                value = petroleum_cat_df['value'].values[0]
                if pd.notna(value):
                    pollution_sum += float(value)
        if pollution_sum > 0:
            data_rows.append(('enviro_petroleum_pollution', str(year), pollution_sum))

        all_ind_df = year_df[
            (year_df['Industries'] == industries['all_industries'])
            & (year_df['Environmental protection activities'] == main_activities['total'])
        ]
        if len(all_ind_df) > 0:
            value = all_ind_df['value'].values[0]
            if pd.notna(value):
                data_rows.append(('enviro_all_industries_total', str(year), float(value)))

    billions_fields = [
        'oil_gas_total', 'electric_total', 'natural_gas_total',
        'petroleum_total', 'all_industries_total',
    ]
    for vector, ref_date, value in list(data_rows):
        field = vector.replace('enviro_', '')
        if field in billions_fields:
            data_rows.append((f'{vector}_billions', ref_date, round(float(value) / 1000, 2)))

    source_org = 'Statistics Canada'
    source_url = 'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=3810013001'
    metadata_rows = [
        ('enviro_oil_gas_total', 'Oil and gas extraction - Total environmental protection expenditures', 'Millions of dollars', 'millions', source_org, source_url),
        ('enviro_oil_gas_wastewater', 'Oil and gas extraction - Wastewater management', 'Millions of dollars', 'millions', source_org, source_url),
        ('enviro_oil_gas_soil', 'Oil and gas extraction - Protection and remediation of soil, groundwater and surface water', 'Millions of dollars', 'millions', source_org, source_url),
        ('enviro_oil_gas_air', 'Oil and gas extraction - Air pollution management', 'Millions of dollars', 'millions', source_org, source_url),
        ('enviro_oil_gas_solid_waste', 'Oil and gas extraction - Solid waste management', 'Millions of dollars', 'millions', source_org, source_url),
        ('enviro_oil_gas_other', 'Oil and gas extraction - Other environmental protection activities', 'Millions of dollars', 'millions', source_org, source_url),
        ('enviro_electric_total', 'Electric power generation - Total environmental protection expenditures', 'Millions of dollars', 'millions', source_org, source_url),
        ('enviro_natural_gas_total', 'Natural gas distribution - Total environmental protection expenditures', 'Millions of dollars', 'millions', source_org, source_url),
        ('enviro_petroleum_total', 'Petroleum and coal product manufacturing - Total environmental protection expenditures', 'Millions of dollars', 'millions', source_org, source_url),
        ('enviro_petroleum_pollution', 'Petroleum and coal product manufacturing - Pollution abatement and control', 'Millions of dollars', 'millions', source_org, source_url),
        ('enviro_all_industries_total', 'Total industries - Total environmental protection expenditures', 'Millions of dollars', 'millions', source_org, source_url),
        ('enviro_oil_gas_total_billions', 'Oil and gas - Total (billions)', 'Billions of dollars', 'billions', source_org, source_url),
        ('enviro_electric_total_billions', 'Electric power - Total (billions)', 'Billions of dollars', 'billions', source_org, source_url),
        ('enviro_all_industries_total_billions', 'All industries - Total (billions)', 'Billions of dollars', 'billions', source_org, source_url),
    ]

    if not data_rows:
        return 0
    return processor.store_indicators('environmental_protection', data_rows, metadata_rows)


def process_environmental_protection(processor) -> int:
    """Deprecated: run update then transform."""
    return update_environmental_protection(processor) + transform_environmental_protection(processor)
