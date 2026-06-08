"""Cleantech companies by geography (NRCan Clean Growth Hub page)."""

import re
from html.parser import HTMLParser
from typing import Dict, Optional, Tuple

from .constants import CLEANTECH_GEO_REGIONS, CLEANTECH_GEO_URL

SOURCE_KEY = 'cleantech_companies_geo'


class _TableTextParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tables = []
        self._table = None
        self._row = None
        self._cell = None

    def handle_starttag(self, tag, attrs):
        tag = tag.lower()
        if tag == 'table':
            self._table = []
        elif tag == 'tr' and self._table is not None:
            self._row = []
        elif tag in ('th', 'td') and self._row is not None:
            self._cell = []

    def handle_data(self, data):
        if self._cell is not None:
            self._cell.append(data)

    def handle_endtag(self, tag):
        tag = tag.lower()
        if tag in ('th', 'td') and self._cell is not None and self._row is not None:
            self._row.append(re.sub(r'\s+', ' ', ''.join(self._cell)).strip())
            self._cell = None
        elif tag == 'tr' and self._row is not None and self._table is not None:
            if any(cell for cell in self._row):
                self._table.append(self._row)
            self._row = None
        elif tag == 'table' and self._table is not None:
            if self._table:
                self.tables.append(self._table)
            self._table = None


def _parse_int_text(value: str) -> Optional[int]:
    text = re.sub(r'[^\d.-]', '', str(value or ''))
    if not text:
        return None
    try:
        return int(float(text))
    except ValueError:
        return None


def _extract_cleantech_geo(html: str) -> Tuple[int, int, Dict[str, int]]:
    plain = re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', html))
    year_match = re.search(r'accurate as of [A-Za-z]+\s+(\d{4})', plain, re.I) or re.search(r'\b(?:June|July|August|September)\s+(\d{4})\b', plain, re.I)
    ref_year = int(year_match.group(1)) if year_match else 2025
    total_match = re.search(r'Total Pureplay Industry Involvement:\s*([\d,]+)', plain, re.I)
    reported_total = _parse_int_text(total_match.group(1)) if total_match else None

    parser = _TableTextParser()
    parser.feed(html)
    candidates = []
    for table in parser.tables:
        if not table:
            continue
        header = table[0]
        norm_header = [re.sub(r'\s+', ' ', cell).strip().lower() for cell in header]
        indexes = {}
        for key, label in CLEANTECH_GEO_REGIONS:
            label_norm = label.lower()
            if label_norm in norm_header:
                indexes[key] = norm_header.index(label_norm)
        if len(indexes) != len(CLEANTECH_GEO_REGIONS):
            continue
        for row in table[1:]:
            if not row or row[0].strip().lower() != 'total':
                continue
            counts = {}
            for key, _label in CLEANTECH_GEO_REGIONS:
                idx = indexes[key]
                counts[key] = _parse_int_text(row[idx] if idx < len(row) else '')
            if all(v is not None for v in counts.values()):
                row_sum = sum(counts.values())
                candidates.append((row_sum, counts))
    if not candidates:
        raise ValueError('Could not find cleantech company province totals in the NRCan source page')
    if reported_total is not None:
        for row_sum, counts in candidates:
            if row_sum == reported_total:
                return ref_year, reported_total, counts
    row_sum, counts = candidates[0]
    return ref_year, reported_total or row_sum, counts


def _source_url_for(processor, source_key: str, fallback: str) -> str:
    try:
        sec = processor.config.sections.get('section5_indicators', {})
        src = sec.get('sources', {}).get(source_key, {})
        return src.get('source_url') or fallback
    except Exception:
        return fallback


def update_cleantech_companies_geo(processor) -> int:
    """EEDAS ingest: NRCan cleantech company counts by province (source-native)."""
    source_url = _source_url_for(processor, SOURCE_KEY, CLEANTECH_GEO_URL)
    response = processor.fetch_url_with_retry(
        source_url,
        timeout=processor.REQUEST_TIMEOUT,
        headers={'User-Agent': 'Mozilla/5.0 (compatible; NRCan-Energy-Factbook/1.0)'},
        label='Cleantech geo',
    )
    ref_year, total, counts = _extract_cleantech_geo(response.text)
    if total <= 0:
        raise ValueError('Cleantech company total must be greater than zero')

    data_rows = [('geo_total', ref_year, float(total))]
    metadata_rows = [('geo_total', 'Total pureplay industry involvement', 'Number', 'units', 'Natural Resources Canada', source_url)]
    for key, label in CLEANTECH_GEO_REGIONS:
        count = counts[key]
        data_rows.append((f'geo_{key}_count', ref_year, float(count)))
        metadata_rows.append((f'geo_{key}_count', f'Cleantech companies, {label}', 'Number', 'units', 'Natural Resources Canada', source_url))

    n = processor.replace_raw_data(SOURCE_KEY, data_rows, metadata_rows)
    print(f'    Stored {n} source-native rows for cleantech_companies_geo')
    return n


def transform_cleantech_companies_geo(processor) -> int:
    """EFB transform: compute province shares and export cleantech_geo_* indicators."""
    df = processor.get_raw_dataframe(SOURCE_KEY)
    if df.empty:
        raise ValueError('cleantech_companies_geo transform: no raw rows found')

    total_row = df[df['vector'].astype(str) == 'geo_total']
    if total_row.empty:
        raise ValueError('cleantech_companies_geo transform: missing geo_total')
    ref_year = int(float(total_row.iloc[0]['ref_date']))
    total = float(total_row.iloc[0]['value'])
    source_url = _source_url_for(processor, SOURCE_KEY, CLEANTECH_GEO_URL)

    data_rows = [('cleantech_geo_total', ref_year, float(total))]
    metadata_rows = [('cleantech_geo_total', 'Total pureplay industry involvement', 'Number', 'units', 'Natural Resources Canada', source_url)]
    for key, label in CLEANTECH_GEO_REGIONS:
        sub = df[df['vector'].astype(str) == f'geo_{key}_count']
        if sub.empty:
            continue
        count = float(sub.iloc[0]['value'])
        share = round((count / total) * 100, 1)
        data_rows.append((f'cleantech_geo_{key}_count', ref_year, count))
        data_rows.append((f'cleantech_geo_{key}_pct', ref_year, share))
        metadata_rows.append((f'cleantech_geo_{key}_count', f'Cleantech companies, {label}', 'Number', 'units', 'Natural Resources Canada', source_url))
        metadata_rows.append((f'cleantech_geo_{key}_pct', f'Cleantech companies share, {label}', 'Percent', 'percent', 'Natural Resources Canada', source_url))

    n = processor.store_indicators(SOURCE_KEY, data_rows, metadata_rows)
    print(f'    Stored {n} indicator rows for cleantech_companies_geo')
    return n


def process_cleantech_companies_geo(processor) -> int:
    """Legacy combined handler."""
    return update_cleantech_companies_geo(processor) + transform_cleantech_companies_geo(processor)
