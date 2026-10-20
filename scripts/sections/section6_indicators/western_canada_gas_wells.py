"""Western Canada natural gas wells completed (count and average depth)."""

from .constants import WESTERN_CANADA_GAS_WELLS_METADATA
from .western_canada_oil_wells import (
    _transform_from_raw,
    build_western_canada_well_completions,
)

SOURCE_KEY = 'western_canada_gas_wells'


def update_western_canada_gas_wells(processor) -> int:
    print('  Building Western Canada natural gas well completions from the shared provincial sources...')
    built = build_western_canada_well_completions(processor.config)
    rows = built['gas_raw']
    if not rows:
        print('    WARNING: no Western Canada natural gas wells rows produced')
        return 0
    print(f'    Prepared {len(rows)} Western Canada natural gas wells data points')
    return processor.replace_raw_data(SOURCE_KEY, rows, list(WESTERN_CANADA_GAS_WELLS_METADATA))


def transform_western_canada_gas_wells(processor) -> int:
    df = processor.get_raw_dataframe(SOURCE_KEY)
    if df.empty:
        print('    western_canada_gas_wells transform: no raw rows found — re-run eedas update')
        return 0
    data_rows = _transform_from_raw(
        df,
        wells_vector='raw_wc_gas_wells_completed',
        metres_vector='raw_wc_gas_total_metres',
        out_prefix='wc_gas',
    )
    if not data_rows:
        print('    western_canada_gas_wells transform: no indicator rows produced')
        return 0
    n = processor.store_indicators(SOURCE_KEY, data_rows, WESTERN_CANADA_GAS_WELLS_METADATA)
    print(f'    Stored {n} indicator rows for western_canada_gas_wells')
    return n
