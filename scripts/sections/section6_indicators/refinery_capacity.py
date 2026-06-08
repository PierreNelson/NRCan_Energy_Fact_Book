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


def build_refinery_capacity_rows(
    source_url: str = OSM_REFINERY_URL,
    vintage: Optional[str] = None,
    config=None,
) -> Tuple[List[Tuple[str, str, float]], List[Tuple]]:
    """Download Oil Sands Magazine refinery table and aggregate by province/type (Page 139 spec)."""
    vintage_key = vintage or datetime.utcnow().strftime('%Y-%m')
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

    aggregates: Dict[str, Dict[str, Dict[str, float]]] = {
        prov: {rtype: {'count': 0, 'capacity': 0.0} for rtype in OSM_REFINERY_TYPES}
        for prov in OSM_PROVINCE_KEYS
    }
    totals = {rtype: {'count': 0, 'capacity': 0.0} for rtype in OSM_REFINERY_TYPES}

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

    metadata_rows = [
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
    print(f'    OSM refinery capacity: {len(data_rows)} rows (vintage {vintage_key})')
    return data_rows, metadata_rows


SOURCE_KEY = 'osm_refin_cap'


def update_osm_refin_cap(processor, source_url: str = OSM_REFINERY_URL, vintage: Optional[str] = None) -> int:
    """EEDAS ingest: Oil Sands Magazine refinery capacity table (source-native)."""
    print('  Fetching Oil Sands Magazine refinery capacity (raw)...')
    cfg_url = (
        processor.config.sections.get('section6_indicators', {})
        .get('sources', {})
        .get('osm_refin_cap', {})
        .get('source_url', source_url)
    )
    data_rows, metadata_rows = build_refinery_capacity_rows(
        source_url=cfg_url, vintage=vintage, config=processor.config
    )
    if not data_rows:
        raise RuntimeError('osm_refin_cap: no source-native rows produced')
    raw_rows = [(f'raw_{vec}', ref, val) for vec, ref, val in data_rows]
    raw_meta = [(f'raw_{row[0]}', *row[1:]) for row in metadata_rows]
    return processor.replace_raw_data(SOURCE_KEY, raw_rows, raw_meta)


def transform_osm_refin_cap(processor) -> int:
    """EFB transform: map raw refinery capacity rows to refcap_* indicators."""
    df = processor.get_raw_dataframe(SOURCE_KEY)
    if df.empty:
        raise RuntimeError('osm_refin_cap transform: no raw rows found')

    data_rows: List[Tuple[str, str, float]] = []
    for _, row in df.iterrows():
        vec = str(row['vector'])
        if not vec.startswith('raw_'):
            continue
        try:
            data_rows.append((vec[4:], str(row['ref_date']), float(row['value'])))
        except (TypeError, ValueError):
            continue

    if not data_rows:
        raise RuntimeError('osm_refin_cap transform: no indicator rows produced')

    source_url = (
        processor.config.sections.get('section6_indicators', {})
        .get('sources', {})
        .get('osm_refin_cap', {})
        .get('source_url', OSM_REFINERY_URL)
    )
    metadata_rows = [
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
    n = processor.store_indicators(SOURCE_KEY, data_rows, metadata_rows)
    print(f'    Stored {n} indicator rows for osm_refin_cap')
    return n
