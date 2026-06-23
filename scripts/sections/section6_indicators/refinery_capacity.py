"""Page 139 — Oil Sands Magazine refinery capacity."""

import re
from datetime import datetime
from typing import Dict, List, Optional, Tuple

import requests
from bs4 import BeautifulSoup

from config_loader import get_config
from utils.http_retry import fetch_get, resilience_from_config

from .constants import FETCH_UA

OSM_REFINERY_URL = 'https://www.oilsandsmagazine.com/projects/canadian-refineries'
OSM_EXCLUDE_NAMES = ('braya renewable fuels',)
OSM_ASPHALT_NAMES = ('moose jaw refinery', 'lloydminster refinery')
OSM_LUBRICANT_NAMES = ('clarkson refinery',)
OSM_PROVINCE_KEYS = ('ab', 'bc', 'nb', 'on', 'qc', 'sk')
OSM_REFINERY_TYPES = ('petroleum', 'asphalt', 'lubricant', 'total')

OSM_RAW_PREFIX = 'raw_osm'
OSM_PROVINCE_CODES = {'ab': 1, 'bc': 2, 'nb': 3, 'on': 4, 'qc': 5, 'sk': 6}
OSM_TYPE_CODES = {'petroleum': 1, 'asphalt': 2, 'lubricant': 3}


def _osm_province_key(location: str) -> Optional[str]:
    loc = str(location or '').upper()
    if ', AB' in loc or ' ALBERTA' in loc:
        return 'ab'
    if ', BC' in loc or ' BRITISH COLUMBIA' in loc:
        return 'bc'
    if ', NB' in loc or ' NEW BRUNSWICK' in loc:
        return 'nb'
    if ', ON' in loc or ' ONTARIO' in loc:
        return 'on'
    if ', QC' in loc or ' QUEBEC' in loc or 'LÉVIS' in loc:
        return 'qc'
    if ', SK' in loc or ' SASKATCHEWAN' in loc:
        return 'sk'
    return None


def _osm_facility_type(name: str, operator: str) -> Optional[str]:
    label = f'{name} {operator}'.lower()
    if any(x in label for x in OSM_EXCLUDE_NAMES):
        return None
    if any(x in label for x in OSM_ASPHALT_NAMES):
        return 'asphalt'
    if any(x in label for x in OSM_LUBRICANT_NAMES):
        return 'lubricant'
    return 'petroleum'


def _osm_parse_capacity(raw: str) -> Optional[float]:
    text = str(raw or '').strip().upper()
    if not text or 'NOTE' in text:
        return None
    digits = re.sub(r'[^\d.]', '', text.replace(',', ''))
    if not digits:
        return None
    value = float(digits)
    # OSM table is bbl/day; page displays thousand bbl/day
    return round(value / 1000)


def _fetch_refinery_facilities(
    source_url: str = OSM_REFINERY_URL,
    config=None,
) -> List[Dict[str, object]]:
    cfg = config or get_config()
    max_r, delay = resilience_from_config(cfg)
    response = fetch_get(
        source_url, headers=FETCH_UA, timeout=120,
        max_retries=max_r, retry_delay_seconds=delay, label="OSM refineries",
    )
    soup = BeautifulSoup(response.text, 'html.parser')
    table = soup.find('table')
    if table is None:
        raise RuntimeError('Oil Sands Magazine refinery table not found')

    facilities: List[Dict[str, object]] = []
    for tr in table.find_all('tr'):
        cells = [c.get_text(' ', strip=True) for c in tr.find_all(['td', 'th'])]
        if len(cells) < 5:
            continue
        name, operator, location, _startup, capacity_raw = cells[:5]
        if name.upper() in ('NAME', '') or location.upper().startswith('NEW '):
            continue
        facility_type = _osm_facility_type(name, operator)
        if facility_type is None:
            continue
        prov = _osm_province_key(location)
        if prov is None:
            continue
        capacity = _osm_parse_capacity(capacity_raw)
        if capacity is None:
            continue
        facilities.append({
            'name': name,
            'operator': operator,
            'location': location,
            'province': prov,
            'type': facility_type,
            'capacity': capacity,
        })
    return facilities


def _aggregate_refinery_facilities(
    facilities: List[Dict[str, object]],
    vintage_key: str,
) -> List[Tuple[str, str, float]]:
    aggregates: Dict[str, Dict[str, Dict[str, float]]] = {
        prov: {rtype: {'count': 0, 'capacity': 0.0} for rtype in OSM_REFINERY_TYPES}
        for prov in OSM_PROVINCE_KEYS
    }
    totals = {rtype: {'count': 0, 'capacity': 0.0} for rtype in OSM_REFINERY_TYPES}

    for facility in facilities:
        prov = str(facility['province'])
        facility_type = str(facility['type'])
        capacity = float(facility['capacity'])
        aggregates[prov][facility_type]['count'] += 1
        aggregates[prov][facility_type]['capacity'] += capacity
        aggregates[prov]['total']['count'] += 1
        aggregates[prov]['total']['capacity'] += capacity
        totals[facility_type]['count'] += 1
        totals[facility_type]['capacity'] += capacity
        totals['total']['count'] += 1
        totals['total']['capacity'] += capacity

    data_rows: List[Tuple[str, str, float]] = []
    for prov in OSM_PROVINCE_KEYS:
        for rtype in OSM_REFINERY_TYPES:
            bucket = aggregates[prov][rtype]
            if bucket['count'] > 0:
                data_rows.append((f'refcap_{prov}_{rtype}_count', vintage_key, float(bucket['count'])))
                data_rows.append((f'refcap_{prov}_{rtype}_capacity', vintage_key, round(bucket['capacity'], 0)))
    for rtype in OSM_REFINERY_TYPES:
        if totals[rtype]['count'] > 0:
            data_rows.append((f'refcap_total_{rtype}_count', vintage_key, float(totals[rtype]['count'])))
            data_rows.append((f'refcap_total_{rtype}_capacity', vintage_key, round(totals[rtype]['capacity'], 0)))
    return data_rows


def _build_refinery_raw_rows(
    source_url: str = OSM_REFINERY_URL,
    vintage: Optional[str] = None,
    config=None,
) -> Tuple[List[Tuple[str, str, float]], List[Tuple]]:
    """Store one row per facility (capacity, province code, type code) for EEDAS ingest."""
    vintage_key = vintage or datetime.utcnow().strftime('%Y-%m')
    facilities = _fetch_refinery_facilities(source_url=source_url, config=config)
    data_rows: List[Tuple[str, str, float]] = [
        (f'{OSM_RAW_PREFIX}_facility_count', vintage_key, float(len(facilities))),
    ]
    metadata_rows: List[Tuple] = [
        (
            f'{OSM_RAW_PREFIX}_facility_count',
            'OSM refinery facility count',
            'Number',
            'units',
            'Oil Sands Magazine',
            source_url,
        ),
    ]

    for index, facility in enumerate(facilities):
        prefix = f'{OSM_RAW_PREFIX}_f{index}'
        prov_code = OSM_PROVINCE_CODES[str(facility['province'])]
        type_code = OSM_TYPE_CODES[str(facility['type'])]
        capacity = float(facility['capacity'])
        data_rows.extend([
            (f'{prefix}_capacity', vintage_key, capacity),
            (f'{prefix}_province', vintage_key, float(prov_code)),
            (f'{prefix}_type', vintage_key, float(type_code)),
        ])
        metadata_rows.extend([
            (f'{prefix}_capacity', f'OSM facility {index} capacity (thousand bbl/day)', 'Thousand bbl/day', 'units', 'Oil Sands Magazine', source_url),
            (f'{prefix}_province', f'OSM facility {index} province code', 'Code', 'units', 'Oil Sands Magazine', source_url),
            (f'{prefix}_type', f'OSM facility {index} type code', 'Code', 'units', 'Oil Sands Magazine', source_url),
        ])

    print(f'    OSM refinery capacity: {len(facilities)} facilities (vintage {vintage_key})')
    return data_rows, metadata_rows


def _facilities_from_raw_dataframe(df) -> Tuple[List[Dict[str, object]], str]:
    by_index: Dict[int, Dict[str, float]] = {}
    vintage_key = ''
    facility_count = 0

    for _, row in df.iterrows():
        vector = str(row['vector'])
        if not vector.startswith(f'{OSM_RAW_PREFIX}_'):
            continue
        vintage_key = str(row['ref_date'])
        try:
            value = float(row['value'])
        except (TypeError, ValueError):
            continue
        if vector == f'{OSM_RAW_PREFIX}_facility_count':
            facility_count = int(value)
            continue
        match = re.match(rf'{OSM_RAW_PREFIX}_f(\d+)_(capacity|province|type)$', vector)
        if not match:
            continue
        index = int(match.group(1))
        field = match.group(2)
        by_index.setdefault(index, {})[field] = value

    code_to_prov = {float(code): prov for prov, code in OSM_PROVINCE_CODES.items()}
    code_to_type = {float(code): rtype for rtype, code in OSM_TYPE_CODES.items()}

    facilities: List[Dict[str, object]] = []
    for index in sorted(by_index.keys()):
        raw = by_index[index]
        if not {'capacity', 'province', 'type'}.issubset(raw.keys()):
            continue
        prov = code_to_prov.get(raw['province'])
        facility_type = code_to_type.get(raw['type'])
        if prov is None or facility_type is None:
            continue
        facilities.append({
            'province': prov,
            'type': facility_type,
            'capacity': raw['capacity'],
        })

    if facility_count and len(facilities) != facility_count:
        print(
            f'    Warning: osm_refin_cap expected {facility_count} facilities, parsed {len(facilities)}'
        )
    return facilities, vintage_key


def _refinery_metadata_rows(source_url: str) -> List[Tuple]:
    return [
        (f'refcap_{prov}_{rtype}_count', f'Refinery count ({prov}, {rtype})', 'Number', 'units', 'Oil Sands Magazine', source_url)
        for prov in OSM_PROVINCE_KEYS
        for rtype in OSM_REFINERY_TYPES
    ] + [
        (f'refcap_{prov}_{rtype}_capacity', f'Refinery capacity ({prov}, {rtype})', 'Thousand bbl/day', 'units', 'Oil Sands Magazine', source_url)
        for prov in OSM_PROVINCE_KEYS
        for rtype in OSM_REFINERY_TYPES
    ] + [
        (f'refcap_total_{rtype}_count', f'Refinery count (Canada total, {rtype})', 'Number', 'units', 'Oil Sands Magazine', source_url)
        for rtype in OSM_REFINERY_TYPES
    ] + [
        (f'refcap_total_{rtype}_capacity', f'Refinery capacity (Canada total, {rtype})', 'Thousand bbl/day', 'units', 'Oil Sands Magazine', source_url)
        for rtype in OSM_REFINERY_TYPES
    ]


def build_refinery_capacity_rows(
    source_url: str = OSM_REFINERY_URL,
    vintage: Optional[str] = None,
    config=None,
) -> Tuple[List[Tuple[str, str, float]], List[Tuple]]:
    """Download OSM table, ingest facility raw rows, and transform to refcap_* indicators."""
    raw_rows, _ = _build_refinery_raw_rows(source_url=source_url, vintage=vintage, config=config)
    if not raw_rows:
        return [], []

    vintage_key = vintage or datetime.utcnow().strftime('%Y-%m')
    facilities = _fetch_refinery_facilities(source_url=source_url, config=config)
    data_rows = _aggregate_refinery_facilities(facilities, vintage_key)
    metadata_rows = _refinery_metadata_rows(source_url)
    print(f'    OSM refinery capacity: {len(data_rows)} indicator rows (vintage {vintage_key})')
    return data_rows, metadata_rows


SOURCE_KEY = 'osm_refin_cap'


def update_osm_refin_cap(processor, source_url: str = OSM_REFINERY_URL, vintage: Optional[str] = None) -> int:
    """EEDAS ingest: Oil Sands Magazine refinery facility rows (source-native)."""
    print('  Fetching Oil Sands Magazine refinery capacity (raw)...')
    cfg_url = (
        processor.config.sections.get('section6_indicators', {})
        .get('sources', {})
        .get('osm_refin_cap', {})
        .get('source_url', source_url)
    )
    data_rows, metadata_rows = _build_refinery_raw_rows(
        source_url=cfg_url, vintage=vintage, config=processor.config
    )
    if not data_rows:
        raise RuntimeError('osm_refin_cap: no source-native rows produced')
    n = processor.replace_raw_data(SOURCE_KEY, data_rows, metadata_rows)
    print(f'    Stored {n} source-native rows for {SOURCE_KEY}')
    return n


def transform_osm_refin_cap(processor) -> int:
    """EFB transform: aggregate facility raw rows into refcap_* indicators."""
    df = processor.get_raw_dataframe(SOURCE_KEY)
    if df.empty:
        raise RuntimeError('osm_refin_cap transform: no raw rows found — re-run eedas update')

    facilities, vintage_key = _facilities_from_raw_dataframe(df)
    if not facilities or not vintage_key:
        raise RuntimeError('osm_refin_cap transform: no facility rows parsed from raw data')

    data_rows = _aggregate_refinery_facilities(facilities, vintage_key)
    if not data_rows:
        raise RuntimeError('osm_refin_cap transform: no indicator rows produced')

    source_url = (
        processor.config.sections.get('section6_indicators', {})
        .get('sources', {})
        .get('osm_refin_cap', {})
        .get('source_url', OSM_REFINERY_URL)
    )
    metadata_rows = _refinery_metadata_rows(source_url)
    n = processor.store_indicators(SOURCE_KEY, data_rows, metadata_rows)
    print(f'    Stored {n} indicator rows for osm_refin_cap')
    return n
