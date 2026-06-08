"""Provincial energy-sector GDP — StatCan Table 36-10-0624-01."""

import pandas as pd

from ._statcan import get_provincial_gdp_url, raw_to_dimension_df, store_publisher_rows
from .constants import PROVINCE_NAMES, PROVINCE_VECTORS


def update_provincial_gdp(processor) -> int:
    """EEDAS ingest: fetch StatCan CSV and store publisher-native rows."""
    print("  Fetching provincial GDP data...")

    df = processor.fetch_csv_from_url(get_provincial_gdp_url())
    vector_col = processor.get_column(df, 'VECTOR', 'Vector', 'vector')
    if vector_col:
        raw_data_rows, raw_metadata = processor.extract_data_and_metadata(df, 'provincial_gdp')
        if raw_data_rows:
            n = processor.replace_raw_data('provincial_gdp', raw_data_rows, raw_metadata)
            print(f"    Stored {n} raw StatCan data points")
            return n

    source_org = 'Statistics Canada'
    source_url = 'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=3610062401'
    return store_publisher_rows(
        processor,
        'provincial_gdp',
        df,
        'REF_DATE',
        'VALUE',
        ['GEO', 'Sector', 'Economic indicator'],
        source_org,
        source_url,
    )


def transform_provincial_gdp(processor) -> int:
    """EFB transform: build gdp_prov_* indicator vectors from raw provincial GDP rows."""
    raw_df = processor.repo.get_raw_dataframe('provincial_gdp')
    if raw_df is None or raw_df.empty:
        print("    Warning: No raw provincial GDP data in database")
        return 0

    if raw_df['vector'].astype(str).str.match(r'^v\d', case=False, na=False).any():
        df = raw_df.copy()
        df['GEO'] = None
        for geo_name, info in PROVINCE_VECTORS.items():
            vec = info['vector'].lstrip('vV')
            mask = df['vector'].astype(str).str.lstrip('vV') == vec
            df.loc[mask, 'GEO'] = geo_name
        df = df[df['GEO'].notna()].copy()
        df['REF_DATE'] = pd.to_numeric(df['ref_date'], errors='coerce')
        df['VALUE'] = df['value']
    else:
        df = raw_to_dimension_df(raw_df, ['GEO', 'Sector', 'Economic indicator'])
        df = df.rename(columns={'ref_date': 'REF_DATE', 'value': 'VALUE'})
        df['REF_DATE'] = pd.to_numeric(df['REF_DATE'], errors='coerce')
        df = df[df['Sector'] == 'Energy sub-sector'].copy()
        df = df[df['Economic indicator'] == 'Gross domestic product'].copy()

    data_rows = []
    years = sorted([y for y in df['REF_DATE'].dropna().unique() if y >= 2009])
    year_data = {}

    for year in years:
        year_df = df[df['REF_DATE'] == year]
        year_data[year] = {}
        for _, row in year_df.iterrows():
            geo = row['GEO']
            value = row['VALUE']
            if geo in PROVINCE_VECTORS and pd.notna(value):
                prov_code = PROVINCE_VECTORS[geo]['code']
                vector = f'gdp_prov_{prov_code}'
                data_rows.append((vector, str(int(year)), round(value)))
                year_data[year][prov_code] = value

    if years:
        ry_minus_1 = max(years)
        ry = ry_minus_1 + 1
        if ry_minus_1 in year_data and 'national_total' in year_data[ry_minus_1]:
            canada_gdp = year_data[ry_minus_1]['national_total']
            energy_direct_gdp_ry = 231776
            for geo_name, info in PROVINCE_VECTORS.items():
                prov_code = info['code']
                if prov_code != 'national_total' and prov_code in year_data[ry_minus_1]:
                    share = year_data[ry_minus_1][prov_code] / canada_gdp
                    estimated = round(energy_direct_gdp_ry * share)
                    data_rows.append((f'gdp_prov_{prov_code}', str(ry), estimated))
            data_rows.append(('gdp_prov_national_total', str(ry), energy_direct_gdp_ry))

    source_org = 'Statistics Canada'
    source_url = 'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=3610062401'
    metadata_rows = [
        (
            f'gdp_prov_{prov_code}',
            f'Energy sector direct nominal GDP - {prov_name}',
            'Millions of dollars',
            'millions',
            source_org,
            source_url,
        )
        for prov_code, prov_name in PROVINCE_NAMES.items()
    ]

    if not data_rows:
        return 0
    return processor.store_indicators('provincial_gdp', data_rows, metadata_rows)


def process_provincial_gdp(processor) -> int:
    """Deprecated: run update then transform."""
    return update_provincial_gdp(processor) + transform_provincial_gdp(processor)
