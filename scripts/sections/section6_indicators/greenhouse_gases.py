"""Oil sands greenhouse gases (page 121): production, emissions shares, and intensity."""

import io
from collections import defaultdict
from typing import Dict, List, Optional, Tuple

import pandas as pd

from utils.http_retry import fetch_get, resilience_from_config

from ..section1_indicators.ghg_emissions import (
    GHG_REQUEST_HEADERS,
    GHG_VALUE_COLUMN,
    _fetch_ghg_econ_csv,
    _norm_label,
)

SOURCE_KEY = 'oil_sands_greenhouse_gases'
MIN_YEAR = 2000
BBL_PER_M3 = 6.28981077

# 2000–2015 values are already thousand cubic metres. 2016+ values are cubic metres.
HISTORICAL_VECTORS = (17946, 17947)
RECENT_VECTORS = (107757052, 107757060)
CLIMATE_WATCH_URL = 'https://www.climatewatchdata.org/api/v1/data/historical_emissions'
CLIMATE_WATCH_SOURCE_ID = 274
CLIMATE_WATCH_GAS_ID = 553  # All GHG
CLIMATE_WATCH_TOTAL_SECTOR_ID = 3208  # Total excluding LULUCF

METADATA = [
    ('osghg_prod_thousand_m3', 'Oil sands production', 'thousand cubic metres', 'units'),
    ('osghg_prod_thousand_bbl', 'Oil sands production', 'thousand barrels', 'units'),
    ('osghg_global_mt', 'World GHG emissions excluding LULUCF', 'Mt CO2e', 'megatonnes'),
    ('osghg_canada_mt', 'Canada national inventory total', 'Mt CO2e', 'megatonnes'),
    ('osghg_oil_sands_kt', 'Oil sands GHG emissions', 'kt CO2e', 'kilotonnes'),
    ('osghg_share_global_pct', 'Oil sands share of global GHG emissions', 'percent', 'percent'),
    ('osghg_share_canada_pct', 'Oil sands share of Canada GHG emissions', 'percent', 'percent'),
    ('osghg_intensity_kg_bbl', 'Oil sands emissions intensity', 'kg CO2e per barrel', 'units'),
    ('osghg_intensity_decrease_pct', 'Oil sands emissions intensity decrease since 2000', 'percent', 'percent'),
]


def _annual_groups(points: List[Tuple[str, float]]) -> Dict[int, List[float]]:
    grouped: Dict[int, List[float]] = defaultdict(list)
    for ref_date, value in points:
        year = int(str(ref_date)[:4])
        if year >= MIN_YEAR:
            grouped[year].append(float(value))
    return grouped


def _complete_annual_sum(grouped: Dict[int, List[float]]) -> Dict[int, float]:
    """Sum a monthly series only for years with 12 months. A single annual point is kept."""
    counts = [len(values) for values in grouped.values()]
    monthly = max(counts, default=0) > 1
    needed = 12 if monthly else 1
    return {
        year: sum(values)
        for year, values in grouped.items()
        if len(values) >= needed
    }


def _fetch_wds_points(vector_id: int, max_retries: int, retry_delay: int) -> List[Tuple[str, float]]:
    url = (
        'https://www150.statcan.gc.ca/t1/wds/rest/getDataFromVectorByReferencePeriodRange'
        f'?vectorIds={vector_id}&startRefPeriod=2000-01-01&endReferencePeriod=2030-12-31'
    )
    response = fetch_get(
        url,
        timeout=120,
        headers=GHG_REQUEST_HEADERS,
        max_retries=max_retries,
        retry_delay_seconds=retry_delay,
        label=f'StatCan v{vector_id}',
    )
    payload = response.json()
    item = payload[0] if isinstance(payload, list) else payload
    if item.get('status') != 'SUCCESS':
        raise RuntimeError(f'StatCan v{vector_id} request failed')
    points = []
    for point in (item.get('object') or {}).get('vectorDataPoint') or []:
        if point.get('value') is None:
            continue
        points.append((str(point['refPer']), float(point['value'])))
    return points


def _fetch_climate_watch(max_retries: int, retry_delay: int) -> List[Tuple[str, str, float]]:
    response = fetch_get(
        CLIMATE_WATCH_URL,
        timeout=120,
        headers=GHG_REQUEST_HEADERS,
        params={
            'source_ids[]': CLIMATE_WATCH_SOURCE_ID,
            'gas_ids[]': CLIMATE_WATCH_GAS_ID,
            'sector_ids[]': CLIMATE_WATCH_TOTAL_SECTOR_ID,
            'start_year': MIN_YEAR,
            'per_page': 500,
        },
        max_retries=max_retries,
        retry_delay_seconds=retry_delay,
        label='Climate Watch',
    )
    rows = []
    for row in response.json().get('data') or []:
        if str(row.get('iso_code3') or '').upper() != 'WORLD':
            continue
        if str(row.get('sector') or '') != 'Total excluding LULUCF':
            continue
        for point in row.get('emissions') or []:
            year = point.get('year')
            value = point.get('value')
            if year is None or value is None or int(year) < MIN_YEAR:
                continue
            rows.append(('cw|total', str(int(year)), float(value)))
    if not rows:
        raise RuntimeError('Climate Watch returned no World total excluding LULUCF')
    print(f'  Climate Watch World total rows: {len(rows)}')
    return rows


def _matching_kt(frame: pd.DataFrame, year: int, *, source: str, sub_sector: Optional[str] = None) -> Optional[float]:
    part = frame[
        (frame['Region'].map(_norm_label) == 'Canada')
        & (frame['Year'] == year)
        & (frame['Source'].map(_norm_label) == source)
    ]
    if sub_sector is not None:
        part = part[part['Sub-sector'].map(_norm_label) == sub_sector]
        totals = part[part['Total'].map(_norm_label).str.lower() == 'y']
        part = totals if len(totals) else part
    if part.empty:
        return None
    value = part.iloc[0][GHG_VALUE_COLUMN]
    if pd.isna(value):
        return None
    return float(value)


def _fetch_eccc_rows(max_retries: int, retry_delay: int) -> List[Tuple[str, str, float]]:
    content, _url = _fetch_ghg_econ_csv(max_retries=max_retries, retry_delay_seconds=retry_delay)
    frame = pd.read_csv(io.BytesIO(content))
    frame[GHG_VALUE_COLUMN] = pd.to_numeric(frame[GHG_VALUE_COLUMN], errors='coerce')
    frame['Year'] = pd.to_numeric(frame['Year'], errors='coerce')
    rows = []
    years = sorted(int(year) for year in frame['Year'].dropna().unique() if int(year) >= MIN_YEAR)
    for year in years:
        canada = _matching_kt(frame, year, source='National Inventory Total')
        oil_sands = _matching_kt(
            frame,
            year,
            source='Oil and Gas',
            sub_sector='Oil Sands and Thermal Heavy Oil Production',
        )
        if canada is not None:
            rows.append(('eccc|canada_kt', str(year), canada))
        if oil_sands is not None:
            rows.append(('eccc|oil_sands_kt', str(year), oil_sands))
    if not any(vector == 'eccc|canada_kt' for vector, _year, _value in rows):
        raise RuntimeError('ECCC CSV has no Canada National Inventory Total')
    if not any(vector == 'eccc|oil_sands_kt' for vector, _year, _value in rows):
        raise RuntimeError('ECCC CSV has no oil sands sub-sector total')
    print(f'  ECCC oil sands and Canada rows: {len(rows)}')
    return rows


def update_oil_sands_greenhouse_gases(processor) -> int:
    max_retries, retry_delay = resilience_from_config(processor.config)
    data_rows: List[Tuple[str, str, float]] = []
    for vector_id in HISTORICAL_VECTORS + RECENT_VECTORS:
        for ref_date, value in _fetch_wds_points(vector_id, max_retries, retry_delay):
            data_rows.append((f'v{vector_id}', ref_date, value))
    data_rows.extend(_fetch_climate_watch(max_retries, retry_delay))
    data_rows.extend(_fetch_eccc_rows(max_retries, retry_delay))
    metadata = [
        ('v17946', 'Synthetic crude oil', 'thousand cubic metres', 'units', 'Statistics Canada', ''),
        ('v17947', 'Crude bitumen', 'thousand cubic metres', 'units', 'Statistics Canada', ''),
        ('v107757052', 'Non-upgraded production of crude bitumen', 'cubic metres', 'units', 'Statistics Canada', ''),
        ('v107757060', 'Synthetic crude oil production', 'cubic metres', 'units', 'Statistics Canada', ''),
        ('cw|total', 'World total GHG excluding LULUCF', 'Mt CO2e', 'megatonnes', 'Climate Watch', CLIMATE_WATCH_URL),
        ('eccc|canada_kt', 'Canada national inventory total', 'kt CO2e', 'kilotonnes', 'Environment and Climate Change Canada', ''),
        ('eccc|oil_sands_kt', 'Oil sands and thermal heavy oil production', 'kt CO2e', 'kilotonnes', 'Environment and Climate Change Canada', ''),
    ]
    print(f'    Prepared {len(data_rows)} oil sands greenhouse gas source rows')
    return processor.replace_raw_data(SOURCE_KEY, data_rows, metadata)


def _series(raw_df: pd.DataFrame, vector: str) -> List[Tuple[str, float]]:
    points = []
    for _, row in raw_df.iterrows():
        if str(row['vector']) != vector:
            continue
        try:
            points.append((str(row['ref_date']), float(row['value'])))
        except (TypeError, ValueError):
            continue
    return points


def _year_value_map(raw_df: pd.DataFrame, vector: str) -> Dict[int, float]:
    values = {}
    for ref_date, value in _series(raw_df, vector):
        year = int(str(ref_date)[:4])
        if year >= MIN_YEAR:
            values[year] = value
    return values


def build_oil_sands_greenhouse_gas_rows(raw_df: pd.DataFrame) -> List[Tuple[str, str, float]]:
    historical = {
        vector_id: _complete_annual_sum(_annual_groups(_series(raw_df, f'v{vector_id}')))
        for vector_id in HISTORICAL_VECTORS
    }
    recent = {
        vector_id: _complete_annual_sum(_annual_groups(_series(raw_df, f'v{vector_id}')))
        for vector_id in RECENT_VECTORS
    }
    production = {}
    for year in range(MIN_YEAR, 2016):
        synthetic = historical[17946].get(year)
        bitumen = historical[17947].get(year)
        if synthetic is None or bitumen is None:
            continue
        production[year] = synthetic + bitumen
    for year in sorted(set(recent[107757052]) | set(recent[107757060])):
        bitumen = recent[107757052].get(year)
        synthetic = recent[107757060].get(year)
        if bitumen is None or synthetic is None:
            continue
        production[year] = (bitumen + synthetic) / 1000.0

    global_mt = _year_value_map(raw_df, 'cw|total')
    canada_kt = _year_value_map(raw_df, 'eccc|canada_kt')
    oil_sands_kt = _year_value_map(raw_df, 'eccc|oil_sands_kt')
    canada_mt = {year: value / 1000.0 for year, value in canada_kt.items()}

    rows: List[Tuple[str, str, float]] = []
    for year, thousand_m3 in sorted(production.items()):
        rows.append(('osghg_prod_thousand_m3', str(year), thousand_m3))
        rows.append(('osghg_prod_thousand_bbl', str(year), thousand_m3 * BBL_PER_M3))
    for year, value in sorted(global_mt.items()):
        rows.append(('osghg_global_mt', str(year), value))
    for year, value in sorted(canada_mt.items()):
        rows.append(('osghg_canada_mt', str(year), value))
    for year, value in sorted(oil_sands_kt.items()):
        rows.append(('osghg_oil_sands_kt', str(year), value))

    share_global_years = sorted(set(oil_sands_kt) & set(global_mt))
    share_canada_years = sorted(set(oil_sands_kt) & set(canada_mt))
    for year in share_global_years:
        share = (oil_sands_kt[year] / 1000.0) / global_mt[year] * 100.0
        rows.append(('osghg_share_global_pct', str(year), share))
    for year in share_canada_years:
        share = (oil_sands_kt[year] / 1000.0) / canada_mt[year] * 100.0
        rows.append(('osghg_share_canada_pct', str(year), share))

    intensity = {}
    for year, thousand_m3 in production.items():
        emissions = oil_sands_kt.get(year)
        thousand_bbl = thousand_m3 * BBL_PER_M3
        if emissions is None or thousand_bbl == 0:
            continue
        intensity[year] = emissions / thousand_bbl * 1000.0
        rows.append(('osghg_intensity_kg_bbl', str(year), intensity[year]))

    if MIN_YEAR in intensity and intensity:
        latest = max(intensity)
        decrease = (1.0 - intensity[latest] / intensity[MIN_YEAR]) * 100.0
        rows.append(('osghg_intensity_decrease_pct', str(latest), decrease))
        print(
            f'    Intensity {MIN_YEAR}–{latest}: {intensity[MIN_YEAR]:.2f} to {intensity[latest]:.2f} kg/bbl, '
            f'decrease {decrease:.1f}%'
        )
    if share_canada_years:
        year = share_canada_years[-1]
        print(f'    Canada share {year}: {(oil_sands_kt[year] / 1000.0) / canada_mt[year] * 100.0:.2f}%')
    if share_global_years:
        year = share_global_years[-1]
        print(f'    Global share {year}: {(oil_sands_kt[year] / 1000.0) / global_mt[year] * 100.0:.3f}%')
    return rows


def transform_oil_sands_greenhouse_gases(processor) -> int:
    raw_df = processor.get_raw_dataframe(SOURCE_KEY)
    if raw_df is None or raw_df.empty:
        print('    oil_sands_greenhouse_gases transform: no raw rows found — re-run eedas update')
        return 0
    data_rows = build_oil_sands_greenhouse_gas_rows(raw_df)
    if not data_rows:
        print('    oil_sands_greenhouse_gases transform: no indicator rows produced')
        return 0
    n = processor.store_indicators(SOURCE_KEY, data_rows, METADATA)
    print(f'    Stored {n} indicator rows for oil_sands_greenhouse_gases')
    return n
