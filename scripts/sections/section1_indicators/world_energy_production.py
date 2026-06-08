"""World energy production rankings — IEA World Energy Balances."""

import pandas as pd

from xlsx_paths import resolve_root_xlsx

from .constants import WORLD_ENERGY_AGGREGATES, WORLD_ENERGY_COUNTRY_MAPPING, WORLD_ENERGY_XLSX


def update_world_energy_production(processor) -> int:
    """EEDAS ingest: read IEA Excel and store publisher-native production rows."""
    print("  Ingesting world energy production data...")

    excel_path = resolve_root_xlsx(WORLD_ENERGY_XLSX)
    if not excel_path.exists():
        raise FileNotFoundError(f"IEA Excel file not found at {excel_path}")

    df = pd.read_excel(excel_path, sheet_name='TimeSeries_1971-2024', header=1)
    production_df = df[(df['Flow'] == 'Production (PJ)') & (df['Product'] == 'Total')]

    data_rows = []
    metadata_rows = []
    seen = set()
    source_org = 'International Energy Agency'
    source_url = 'https://www.iea.org/data-and-statistics/data-tools/world-energy-balances'

    for _, row in production_df.iterrows():
        country = row['Country']
        for year in range(2005, 2025):
            year_str = str(year)
            if year_str not in df.columns:
                continue
            val = row[year_str]
            if pd.isna(val):
                continue
            vector = f'{country}|Production (PJ)|Total'
            data_rows.append((vector, year_str, round(float(val), 2)))
            if vector not in seen:
                seen.add(vector)
                metadata_rows.append((
                    vector, f'{country} primary energy production', 'PJ', 'petajoules', source_org, source_url
                ))

    if not data_rows:
        return 0
    n = processor.replace_raw_data('world_energy_production', data_rows, metadata_rows)
    print(f"    Stored {n} raw IEA production data points")
    return n


def transform_world_energy_production(processor) -> int:
    """EFB transform: build energy_prod_* indicator vectors from raw IEA rows."""
    raw_df = processor.repo.get_raw_dataframe('world_energy_production')
    if raw_df is None or raw_df.empty:
        print("    Warning: No raw world energy production data in database")
        return 0

    by_country_year = {}
    for _, row in raw_df.iterrows():
        country = str(row['vector']).split('|', 1)[0]
        year = str(row['ref_date'])
        by_country_year[(country, year)] = float(row['value'])

    data_rows = []
    years = [str(y) for y in range(2007, 2025)]

    for year in years:
        world_total = by_country_year.get(('World', year))
        if world_total is None or world_total <= 0:
            continue

        year_int = int(year)
        data_rows.append(('energy_prod_world_total', str(year_int), round(float(world_total), 2)))

        canada_val = by_country_year.get(('Canada', year))
        if canada_val is not None:
            data_rows.append(('energy_prod_canada_pj', str(year_int), round(float(canada_val), 2)))
            data_rows.append((
                'energy_prod_canada_pct', str(year_int),
                round(float(canada_val) / float(world_total) * 100, 1),
            ))

        all_countries = {}
        for (country_name, y), production_pj in by_country_year.items():
            if y != year or country_name in WORLD_ENERGY_AGGREGATES:
                continue
            country_key = WORLD_ENERGY_COUNTRY_MAPPING.get(country_name)
            if country_key and production_pj > 0:
                pct_of_world = float(production_pj) / float(world_total) * 100
                all_countries[country_key] = {
                    'pj': round(float(production_pj), 2),
                    'pct': round(pct_of_world, 1),
                }

        for rank, (country_key, values) in enumerate(
            sorted(all_countries.items(), key=lambda x: x[1]['pct'], reverse=True)[:10], 1
        ):
            data_rows.append((f'energy_prod_{country_key}_pj', str(year_int), values['pj']))
            data_rows.append((f'energy_prod_{country_key}_pct', str(year_int), values['pct']))
            data_rows.append((f'energy_prod_{country_key}_rank', str(year_int), rank))

    canada_2005 = by_country_year.get(('Canada', '2005'))
    world_2005 = by_country_year.get(('World', '2005'))
    for year in years:
        year_int = int(year)
        canada_current = by_country_year.get(('Canada', year))
        world_current = by_country_year.get(('World', year))

        if canada_2005 and canada_current and canada_2005 > 0:
            canada_growth = (float(canada_current) - float(canada_2005)) / float(canada_2005) * 100
            data_rows.append(('energy_prod_canada_growth_since_2005', str(year_int), round(canada_growth, 0)))

        if world_2005 and world_current and world_2005 > 0:
            world_growth = (float(world_current) - float(world_2005)) / float(world_2005) * 100
            data_rows.append(('energy_prod_world_growth_since_2005', str(year_int), round(world_growth, 0)))

    source_org = 'International Energy Agency'
    source_url = 'https://www.iea.org/data-and-statistics/data-tools/world-energy-balances'
    metadata_rows = [
        ('energy_prod_world_total', 'World Total Primary Energy Production', 'PJ', 'petajoules', source_org, source_url),
        ('energy_prod_canada_pj', 'Canada Primary Energy Production', 'PJ', 'petajoules', source_org, source_url),
        ('energy_prod_canada_pct', 'Canada Share of World Energy Production', '%', 'percent', source_org, source_url),
        ('energy_prod_canada_growth_since_2005', 'Canada Energy Production Growth Since 2005', '%', 'percent', source_org, source_url),
        ('energy_prod_world_growth_since_2005', 'World Energy Production Growth Since 2005', '%', 'percent', source_org, source_url),
        ('energy_prod_china_pct', 'China Share of World Energy Production', '%', 'percent', source_org, source_url),
        ('energy_prod_united_states_pct', 'United States Share of World Energy Production', '%', 'percent', source_org, source_url),
        ('energy_prod_india_pct', 'India Share of World Energy Production', '%', 'percent', source_org, source_url),
        ('energy_prod_indonesia_pct', 'Indonesia Share of World Energy Production', '%', 'percent', source_org, source_url),
        ('energy_prod_australia_pct', 'Australia Share of World Energy Production', '%', 'percent', source_org, source_url),
    ]

    if not data_rows:
        return 0
    print(f"    Processed {len(data_rows)} indicator rows")
    return processor.store_indicators('world_energy_production', data_rows, metadata_rows)


def process_world_energy_production(processor) -> int:
    """Deprecated: run update then transform."""
    return update_world_energy_production(processor) + transform_world_energy_production(processor)
