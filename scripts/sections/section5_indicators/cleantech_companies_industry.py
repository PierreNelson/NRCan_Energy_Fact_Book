"""Cleantech companies by industry (NRCan Clean Growth Hub page)."""

import re
from typing import List, Tuple

from .cleantech_companies_geo import _TableTextParser, _parse_int_text, _source_url_for
from .constants import CLEANTECH_GEO_REGIONS, CLEANTECH_GEO_URL, CLEANTECH_INDUSTRIES

SOURCE_KEY = 'cleantech_companies_industry'


def _extract_cleantech_industries(html: str) -> Tuple[int, List[Tuple[str, str, int, float]]]:
    plain = re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', html))
    year_match = re.search(r'accurate as of [A-Za-z]+\s+(\d{4})', plain, re.I) or re.search(r'\b(?:June|July|August|September)\s+(\d{4})\b', plain, re.I)
    ref_year = int(year_match.group(1)) if year_match else 2025
    parser = _TableTextParser()
    parser.feed(html)

    def norm_label(value: str) -> str:
        return re.sub(r'[^a-z0-9]+', ' ', value.lower()).strip()

    industry_lookup = {norm_label(label): (key, label) for key, label in CLEANTECH_INDUSTRIES}
    rows = []
    for table in parser.tables:
        if not table:
            continue
        header = table[0]
        norm_header = [re.sub(r'\s+', ' ', cell).strip().lower() for cell in header]
        region_indexes = []
        for _key, label in CLEANTECH_GEO_REGIONS:
            label_norm = label.lower()
            if label_norm in norm_header:
                region_indexes.append(norm_header.index(label_norm))
        if len(region_indexes) != len(CLEANTECH_GEO_REGIONS):
            continue
        candidate_rows = []
        for row in table[1:]:
            if not row:
                continue
            label = re.sub(r'\s+', ' ', row[0]).strip()
            if label.lower() == 'total':
                continue
            item = industry_lookup.get(norm_label(label))
            if not item:
                continue
            count = 0
            for idx in region_indexes:
                parsed = _parse_int_text(row[idx] if idx < len(row) else '')
                count += parsed or 0
            candidate_rows.append((item[0], item[1], count))
        if len(candidate_rows) == len(CLEANTECH_INDUSTRIES):
            rows = candidate_rows
            break
    if not rows:
        raise ValueError('Could not find cleantech industry totals in the NRCan source page')
    total = sum(count for _key, _label, count in rows)
    if total <= 0:
        raise ValueError('Cleantech industry total must be greater than zero')
    out = [
        (key, label, count, round((count / total) * 100, 1))
        for key, label, count in rows
    ]
    out.sort(key=lambda item: item[2], reverse=True)
    return ref_year, out


def update_cleantech_companies_industry(processor) -> int:
    """EEDAS ingest: NRCan cleantech company counts by industry (source-native)."""
    source_url = _source_url_for(processor, SOURCE_KEY, CLEANTECH_GEO_URL)
    response = processor.fetch_url_with_retry(
        source_url,
        timeout=processor.REQUEST_TIMEOUT,
        headers={'User-Agent': 'Mozilla/5.0 (compatible; NRCan-Energy-Factbook/1.0)'},
        label='Cleantech industry',
    )
    ref_year, industries = _extract_cleantech_industries(response.text)
    data_rows = []
    metadata_rows = []
    for key, label, count, _share in industries:
        data_rows.append((f'ind_{key}_count', ref_year, float(count)))
        metadata_rows.append((f'ind_{key}_count', f'Cleantech companies, {label}', 'Number', 'units', 'Natural Resources Canada', source_url))
    n = processor.replace_raw_data(SOURCE_KEY, data_rows, metadata_rows)
    print(f'    Stored {n} source-native rows for cleantech_companies_industry')
    return n


def transform_cleantech_companies_industry(processor) -> int:
    """EFB transform: compute industry shares and export cleantech_ind_* indicators."""
    df = processor.get_raw_dataframe(SOURCE_KEY)
    if df.empty:
        raise ValueError('cleantech_companies_industry transform: no raw rows found')

    source_url = _source_url_for(processor, SOURCE_KEY, CLEANTECH_GEO_URL)
    counts = []
    for _, row in df.iterrows():
        vec = str(row['vector'])
        if not vec.startswith('ind_') or not vec.endswith('_count'):
            continue
        key = vec[len('ind_'):-len('_count')]
        counts.append((key, float(row['value']), int(float(row['ref_date']))))

    if not counts:
        raise ValueError('cleantech_companies_industry transform: no industry counts found')
    ref_year = counts[0][2]
    total = sum(c for _k, c, _y in counts)
    label_lookup = {key: label for key, label in CLEANTECH_INDUSTRIES}

    data_rows = []
    metadata_rows = []
    for key, count, _year in sorted(counts, key=lambda x: x[1], reverse=True):
        label = label_lookup.get(key, key)
        share = round((count / total) * 100, 1)
        data_rows.append((f'cleantech_ind_{key}_count', ref_year, count))
        data_rows.append((f'cleantech_ind_{key}_pct', ref_year, share))
        metadata_rows.append((f'cleantech_ind_{key}_count', f'Cleantech companies, {label}', 'Number', 'units', 'Natural Resources Canada', source_url))
        metadata_rows.append((f'cleantech_ind_{key}_pct', f'Cleantech companies share, {label}', 'Percent', 'percent', 'Natural Resources Canada', source_url))

    n = processor.store_indicators(SOURCE_KEY, data_rows, metadata_rows)
    print(f'    Stored {n} indicator rows for cleantech_companies_industry')
    return n


def process_cleantech_companies_industry(processor) -> int:
    """Legacy combined handler."""
    return update_cleantech_companies_industry(processor) + transform_cleantech_companies_industry(processor)
