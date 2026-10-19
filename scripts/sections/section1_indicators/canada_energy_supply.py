"""Canada and world total energy supply — IEA workbook total_energy_supply."""

import pandas as pd

from xlsx_paths import resolve_root_xlsx

from .constants import (
    CANADA_ENERGY_SUPPLY_SHEET,
    CANADA_ENERGY_SUPPLY_XLSX,
    TES_BIOFUELS_WASTE,
    TES_CANADA_TOTAL,
    TES_COAL_PRODUCTS,
    TES_CRUDE_NGL,
    TES_MEMO_GEO_SOLAR_HEAT_ELEC,
    TES_MEMO_PEAT_COAL_SHALE,
    TES_MEMO_PRIMARY_SECONDARY_OIL,
    TES_OIL_PRODUCTS,
    TES_OIL_SHALE,
    TES_PEAT,
    TES_RENEWABLES_MEMO,
    TES_SOLAR_WIND_OTHER,
    TES_WORLD_TOTAL,
)

SOURCE_ORG = 'International Energy Agency'
SOURCE_URL = 'https://www.iea.org/data-and-statistics'
_COLUMN_ALIASES = {
    'COUNTRY': ('COUNTRY', 'Country'),
    'ENERGY_PRODUCT': ('ENERGY_PRODUCT', 'Energy product', 'PRODUCT'),
    'TIME_PERIOD': ('TIME_PERIOD', 'Time period', 'YEAR'),
    'OBS_VALUE': ('OBS_VALUE', 'Obs value', 'Value', 'OBS VALUE'),
}


def _share(part_pj, total_pj):
    if not total_pj:
        return 0.0
    return round(float(part_pj) / float(total_pj) * 100.0, 1)


def _pj(bucket, codes):
    total = 0.0
    for code in dict.fromkeys(codes):
        total += float(bucket.get(code, 0.0) or 0.0)
    return total / 1000.0


def _append(rows, vector, year, value, digits=2):
    rows.append((vector, str(year), round(float(value), digits)))


def build_tes_indicators(observations):
    """
    Apply the page 6 Canada and World formulas.

    observations: iterable of (country, energy_product, year, obs_value).
    OBS_VALUE is the source unit; PJ = aggregate / 1000.
    Canada oil excludes oil shale. World oil is oil shale plus crude/NGL
    and excludes oil products. Canada total adds ELECTRICITY; world total does not.
    """
    buckets = {}
    for country, product, year, obs_value in observations:
        if obs_value is None or pd.isna(obs_value):
            continue
        country_code = str(country or '').strip().upper()
        product_code = str(product or '').strip().upper()
        year_key = str(year).strip()
        if year_key.endswith('.0'):
            year_key = year_key[:-2]
        if country_code not in ('CANADA', 'WORLD') or not product_code or not year_key:
            continue
        try:
            amount = float(obs_value)
        except (TypeError, ValueError):
            continue
        slot = buckets.setdefault((country_code, year_key), {})
        slot[product_code] = slot.get(product_code, 0.0) + amount

    rows = []
    years = sorted({year for (_country, year) in buckets})
    for year in years:
        canada = buckets.get(('CANADA', year), {})
        world = buckets.get(('WORLD', year), {})
        if canada and _pj(canada, TES_CANADA_TOTAL):
            _append_canada(rows, year, canada)
        if world and _pj(world, TES_WORLD_TOTAL):
            _append_world(rows, year, world)
    return rows


def _append_canada(rows, year, bucket):
    coal = _pj(bucket, TES_COAL_PRODUCTS)
    crude = _pj(bucket, TES_CRUDE_NGL)
    oil_products = _pj(bucket, TES_OIL_PRODUCTS)
    oil = crude + oil_products
    gas = _pj(bucket, ('NATURAL_GAS',))
    nuclear = _pj(bucket, ('NUCLEAR',))
    hydro = _pj(bucket, ('HYDRO',))
    other = _pj(bucket, TES_SOLAR_WIND_OTHER)
    biofuels = _pj(bucket, TES_BIOFUELS_WASTE)
    total = _pj(bucket, TES_CANADA_TOTAL)
    renewables_memo = _pj(bucket, TES_RENEWABLES_MEMO)

    components = {
        'tes_can_coal_pj': coal,
        'tes_can_crude_ngl_pj': crude,
        'tes_can_oil_products_pj': oil_products,
        'tes_can_oil_pj': oil,
        'tes_can_natural_gas_pj': gas,
        'tes_can_nuclear_pj': nuclear,
        'tes_can_hydro_pj': hydro,
        'tes_can_other_renewables_pj': other,
        'tes_can_biofuels_waste_pj': biofuels,
        'tes_can_peat_pj': _pj(bucket, TES_PEAT),
        'tes_can_oil_shale_pj': _pj(bucket, TES_OIL_SHALE),
        'tes_can_geothermal_pj': _pj(bucket, ('GEOTHERMAL',)),
        'tes_can_heat_pj': _pj(bucket, ('HEAT',)),
        'tes_can_total_pj': total,
        'tes_can_renewables_memo_pj': renewables_memo,
        'tes_can_memo_peat_coal_shale_pj': _pj(bucket, TES_MEMO_PEAT_COAL_SHALE),
        'tes_can_memo_primary_secondary_oil_pj': _pj(bucket, TES_MEMO_PRIMARY_SECONDARY_OIL),
        'tes_can_memo_geo_solar_heat_elec_pj': _pj(bucket, TES_MEMO_GEO_SOLAR_HEAT_ELEC),
    }
    for vector, value in components.items():
        _append(rows, vector, year, value)

    oil_share = _share(oil, total)
    gas_share = _share(gas, total)
    coal_share = _share(coal, total)
    shares = {
        'tes_can_oil_share': oil_share,
        'tes_can_natural_gas_share': gas_share,
        'tes_can_coal_share': coal_share,
        'tes_can_hydro_share': _share(hydro, total),
        'tes_can_other_renewables_share': _share(other, total),
        'tes_can_biofuels_waste_share': _share(biofuels, total),
        'tes_can_nuclear_share': _share(nuclear, total),
        'tes_can_fossil_share': round(oil_share + gas_share + coal_share, 1),
        'tes_can_renewables_share': _share(renewables_memo, total),
    }
    for vector, value in shares.items():
        _append(rows, vector, year, value, digits=1)


def _append_world(rows, year, bucket):
    coal = _pj(bucket, TES_COAL_PRODUCTS)
    oil_shale = _pj(bucket, TES_OIL_SHALE)
    crude = _pj(bucket, TES_CRUDE_NGL)
    oil = oil_shale + crude
    gas = _pj(bucket, ('NATURAL_GAS',))
    nuclear = _pj(bucket, ('NUCLEAR',))
    renewables_memo = _pj(bucket, TES_RENEWABLES_MEMO)
    total = _pj(bucket, TES_WORLD_TOTAL)

    components = {
        'tes_world_coal_pj': coal,
        'tes_world_oil_shale_pj': oil_shale,
        'tes_world_crude_ngl_pj': crude,
        'tes_world_oil_products_pj': _pj(bucket, TES_OIL_PRODUCTS),
        'tes_world_oil_pj': oil,
        'tes_world_natural_gas_pj': gas,
        'tes_world_nuclear_pj': nuclear,
        'tes_world_renewables_memo_pj': renewables_memo,
        'tes_world_total_pj': total,
    }
    for vector, value in components.items():
        _append(rows, vector, year, value)

    oil_share = _share(oil, total)
    gas_share = _share(gas, total)
    coal_share = _share(coal, total)
    shares = {
        'tes_world_oil_share': oil_share,
        'tes_world_coal_share': coal_share,
        'tes_world_natural_gas_share': gas_share,
        'tes_world_fossil_share': round(oil_share + gas_share + coal_share, 1),
        'tes_world_renewables_share': _share(renewables_memo, total),
        'tes_world_nuclear_share': _share(nuclear, total),
    }
    for vector, value in shares.items():
        _append(rows, vector, year, value, digits=1)


def _column(df, *names):
    lookup = {str(col).strip().upper(): col for col in df.columns}
    for name in names:
        hit = lookup.get(str(name).strip().upper())
        if hit is not None:
            return hit
    return None


def _read_supply_sheet(path):
    df = pd.read_excel(path, sheet_name=CANADA_ENERGY_SUPPLY_SHEET)
    if _column(df, 'COUNTRY') is None:
        df = pd.read_excel(path, sheet_name=CANADA_ENERGY_SUPPLY_SHEET, header=1)
    return df


def update_canada_energy_supply(processor) -> int:
    """EEDAS ingest: store publisher-native COUNTRY|ENERGY_PRODUCT rows."""
    print('  Ingesting Canada total energy supply...')
    excel_path = resolve_root_xlsx(CANADA_ENERGY_SUPPLY_XLSX)
    if not excel_path.exists():
        raise FileNotFoundError(
            f'{CANADA_ENERGY_SUPPLY_XLSX} not found at {excel_path}. '
            'Place it in the SharePoint Manual Data folder.'
        )

    df = _read_supply_sheet(excel_path)
    country_col = _column(df, *_COLUMN_ALIASES['COUNTRY'])
    product_col = _column(df, *_COLUMN_ALIASES['ENERGY_PRODUCT'])
    year_col = _column(df, *_COLUMN_ALIASES['TIME_PERIOD'])
    value_col = _column(df, *_COLUMN_ALIASES['OBS_VALUE'])
    missing = [
        name for name, col in (
            ('COUNTRY', country_col),
            ('ENERGY_PRODUCT', product_col),
            ('TIME_PERIOD', year_col),
            ('OBS_VALUE', value_col),
        ) if col is None
    ]
    if missing:
        raise ValueError(
            f'{CANADA_ENERGY_SUPPLY_SHEET} is missing columns: {", ".join(missing)}'
        )

    data_rows = []
    seen = set()
    metadata_rows = []
    for _, row in df.iterrows():
        country = str(row[country_col] or '').strip().upper()
        product = str(row[product_col] or '').strip().upper()
        year = row[year_col]
        value = row[value_col]
        if not country or country == 'NAN' or not product or product == 'NAN' or pd.isna(year) or pd.isna(value):
            continue
        year_key = str(year).strip()
        if year_key.endswith('.0'):
            year_key = year_key[:-2]
        vector = f'{country}|{product}'
        data_rows.append((vector, year_key, round(float(value), 4)))
        if vector not in seen:
            seen.add(vector)
            metadata_rows.append((
                vector,
                f'{country} {product} total energy supply',
                'source',
                'OBS_VALUE',
                SOURCE_ORG,
                SOURCE_URL,
            ))

    if not data_rows:
        return 0
    n = processor.replace_raw_data('canada_energy_supply', data_rows, metadata_rows)
    print(f'    Stored {n} raw total energy supply rows')
    return n


def _indicator_metadata():
    rows = []
    pj_vectors = [
        'tes_can_coal_pj', 'tes_can_oil_pj', 'tes_can_natural_gas_pj', 'tes_can_nuclear_pj',
        'tes_can_hydro_pj', 'tes_can_other_renewables_pj', 'tes_can_biofuels_waste_pj',
        'tes_can_total_pj', 'tes_world_total_pj', 'tes_world_oil_pj', 'tes_world_coal_pj',
        'tes_world_natural_gas_pj', 'tes_world_nuclear_pj',
    ]
    share_vectors = [
        'tes_can_oil_share', 'tes_can_natural_gas_share', 'tes_can_coal_share',
        'tes_can_hydro_share', 'tes_can_other_renewables_share', 'tes_can_biofuels_waste_share',
        'tes_can_nuclear_share', 'tes_can_fossil_share', 'tes_can_renewables_share',
        'tes_world_oil_share', 'tes_world_coal_share', 'tes_world_natural_gas_share',
        'tes_world_fossil_share', 'tes_world_renewables_share', 'tes_world_nuclear_share',
    ]
    for vector in pj_vectors:
        rows.append((vector, vector, 'PJ', 'petajoules', SOURCE_ORG, SOURCE_URL))
    for vector in share_vectors:
        rows.append((vector, vector, '%', 'percent', SOURCE_ORG, SOURCE_URL))
    return rows


def transform_canada_energy_supply(processor) -> int:
    """EFB transform: PJ and shares for the Canada chart and the world comparison."""
    raw_df = processor.repo.get_raw_dataframe('canada_energy_supply')
    if raw_df is None or raw_df.empty:
        print('    Warning: No raw Canada energy supply data in database')
        return 0

    observations = []
    for _, row in raw_df.iterrows():
        vector = str(row['vector'])
        if '|' not in vector:
            continue
        country, product = vector.split('|', 1)
        observations.append((country, product, row['ref_date'], row['value']))

    data_rows = build_tes_indicators(observations)
    if not data_rows:
        return 0
    known = {item[0] for item in _indicator_metadata()}
    metadata_rows = list(_indicator_metadata())
    for vector, _year, _value in data_rows:
        if vector not in known:
            metadata_rows.append((vector, vector, 'PJ', 'petajoules', SOURCE_ORG, SOURCE_URL))
            known.add(vector)
    print(f'    Processed {len(data_rows)} indicator rows')
    return processor.store_indicators('canada_energy_supply', data_rows, metadata_rows)


def process_canada_energy_supply(processor) -> int:
    """Run ingest then transform."""
    update_canada_energy_supply(processor)
    return transform_canada_energy_supply(processor)
