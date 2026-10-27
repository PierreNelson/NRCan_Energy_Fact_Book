"""Oil sands water use (page 120): AER water use performance workbook."""

import io
import re
from typing import Dict, List, Optional, Tuple
from urllib.parse import urljoin

import pandas as pd

from .western_canada_oil_wells import _http_get

SOURCE_KEY = 'oil_sands_environmental_considerations'
PAGE_URL = 'https://www.aer.ca/data-and-performance-reports/industry-performance/water-use-performance'
MIN_YEAR = 2013
BBL_PER_M3 = 6.2901

METADATA = [
    ('osec_mining_hydrocarbon_boe', 'Mining hydrocarbon production', 'barrels of oil equivalent', 'units'),
    ('osec_mining_intensity_water_m3', 'Mining fresh water', 'cubic metres', 'units'),
    ('osec_mining_intensity_water_bbl', 'Mining fresh water', 'barrels', 'units'),
    ('osec_mining_makeup_m3', 'Mining make-up water', 'cubic metres', 'units'),
    ('osec_mining_recycled_m3', 'Mining recycled water', 'cubic metres', 'units'),
    ('osec_mining_total_water_m3', 'Mining total water use', 'cubic metres', 'units'),
    ('osec_mining_intensity', 'Mining fresh water use intensity', 'barrels per barrel of oil equivalent', 'units'),
    ('osec_mining_recycled_pct', 'Mining recycled water share', 'proportion', 'proportion'),
    ('osec_insitu_hydrocarbon_boe', 'In situ hydrocarbon production', 'barrels of oil equivalent', 'units'),
    ('osec_insitu_intensity_water_m3', 'In situ non-saline water', 'cubic metres', 'units'),
    ('osec_insitu_intensity_water_bbl', 'In situ non-saline water', 'barrels', 'units'),
    ('osec_insitu_makeup_m3', 'In situ make-up water', 'cubic metres', 'units'),
    ('osec_insitu_recycled_m3', 'In situ recycled water', 'cubic metres', 'units'),
    ('osec_insitu_total_water_m3', 'In situ total water use', 'cubic metres', 'units'),
    ('osec_insitu_intensity', 'In situ non-saline water use intensity', 'barrels per barrel of oil equivalent', 'units'),
    ('osec_insitu_recycled_pct', 'In situ recycled water share', 'proportion', 'proportion'),
]


def _norm(value) -> str:
    text = str(value or '').replace('\xa0', ' ').replace('³', '3')
    text = text.replace('–', '-').replace('—', '-')
    return re.sub(r'\s+', ' ', text).strip().casefold()


def _num(value) -> float:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return 0.0
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return float(value)
    text = str(value).strip().replace(',', '').replace('\xa0', '')
    if text in ('', '-', '–', '—', 'nan', 'None'):
        return 0.0
    try:
        return float(text)
    except ValueError:
        return 0.0


def _year(value) -> Optional[int]:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    if isinstance(value, pd.Timestamp):
        return int(value.year)
    text = str(value).strip()
    if not re.fullmatch(r'\d{4}(\.0+)?', text):
        return None
    return int(float(text))


def _latest_workbook(config) -> Tuple[str, bytes]:
    page = _http_get(PAGE_URL, config=config, label='AER water use')
    hrefs = re.findall(r'href="([^"]+\.xlsx)"', page.text, flags=re.I)
    if not hrefs:
        raise RuntimeError('AER water use page has no workbook')

    def sort_key(href: str) -> int:
        match = re.search(r'(20\d{2})', href)
        return int(match.group(1)) if match else 0

    href = max(hrefs, key=sort_key)
    full = href if href.startswith('http') else urljoin('https://www.aer.ca', href)
    response = _http_get(full, config=config, timeout=180, label='AER water use workbook')
    print(f'  Water use workbook: {full}')
    return full, response.content


def _sheet(xl: pd.ExcelFile, name: str) -> pd.DataFrame:
    wanted = _norm(name)
    sheet = next(s for s in xl.sheet_names if _norm(s) == wanted)
    raw = pd.read_excel(xl, sheet_name=sheet, header=None)
    header_idx = None
    for idx, row in raw.iterrows():
        cells = [_norm(value) for value in row.tolist()]
        if any(cell.startswith('year') for cell in cells) and any(
            'hydrocarbon' in cell and 'boe' in cell for cell in cells
        ):
            header_idx = int(idx)
            break
    if header_idx is None:
        raise RuntimeError(f'{sheet} has no year and hydrocarbon production header')
    frame = raw.iloc[header_idx + 1:].copy()
    frame.columns = [_norm(value) for value in raw.iloc[header_idx].tolist()]
    return frame


def _column(frame: pd.DataFrame, pred) -> str:
    for name in frame.columns:
        if name and pred(name):
            return name
    raise RuntimeError('Water use sheet is missing a required column')


def _annual(frame: pd.DataFrame, columns: Dict[str, str]) -> Dict[int, Dict[str, float]]:
    year_col = _column(frame, lambda name: name.startswith('year'))
    totals: Dict[int, Dict[str, float]] = {}
    for _, row in frame.iterrows():
        year = _year(row[year_col])
        if year is None or year < MIN_YEAR:
            continue
        bucket = totals.setdefault(year, {key: 0.0 for key in columns})
        for key, name in columns.items():
            bucket[key] += _num(row[name])
    return totals


def _mining_columns(frame: pd.DataFrame) -> Dict[str, str]:
    return {
        'river': _column(frame, lambda name: 'lower athabasca' in name),
        'groundwater': _column(frame, lambda name: 'groundwater' in name),
        'runoff': _column(frame, lambda name: 'surface runoff' in name),
        'recycled': _column(frame, lambda name: name.startswith('recycled')),
        'boe': _column(frame, lambda name: 'hydrocarbon' in name and 'boe' in name),
    }


def _insitu_columns(frame: pd.DataFrame) -> Dict[str, str]:
    return {
        'hq': _column(frame, lambda name: 'high quality' in name and 'nonsaline' in name),
        'alt': _column(
            frame,
            lambda name: 'alternative nonsaline' in name and 'high quality' not in name,
        ),
        'other': _column(frame, lambda name: 'other alternative' in name),
        'recycled': _column(frame, lambda name: 'recycled water' in name),
        'boe': _column(frame, lambda name: 'hydrocarbon' in name and 'boe' in name),
    }


def build_water_raw_rows(content: bytes) -> List[Tuple[str, str, float]]:
    xl = pd.ExcelFile(io.BytesIO(content))
    mining = _annual(_sheet(xl, 'oil sands mining'), _mining_columns(_sheet(xl, 'oil sands mining')))
    insitu = _annual(_sheet(xl, 'in situ report data'), _insitu_columns(_sheet(xl, 'in situ report data')))
    rows: List[Tuple[str, str, float]] = []
    for year, values in sorted(mining.items()):
        ref = str(year)
        rows.extend([
            ('raw_osec_mining_boe', ref, values['boe']),
            ('raw_osec_mining_river_m3', ref, values['river']),
            ('raw_osec_mining_groundwater_m3', ref, values['groundwater']),
            ('raw_osec_mining_runoff_m3', ref, values['runoff']),
            ('raw_osec_mining_recycled_m3', ref, values['recycled']),
        ])
    for year, values in sorted(insitu.items()):
        ref = str(year)
        rows.extend([
            ('raw_osec_insitu_boe', ref, values['boe']),
            ('raw_osec_insitu_hq_m3', ref, values['hq']),
            ('raw_osec_insitu_alt_m3', ref, values['alt']),
            ('raw_osec_insitu_other_m3', ref, values['other']),
            ('raw_osec_insitu_recycled_m3', ref, values['recycled']),
        ])
    return rows


def _raw_by_year(raw_df: pd.DataFrame) -> Dict[str, Dict[str, float]]:
    grouped: Dict[str, Dict[str, float]] = {}
    for _, row in raw_df.iterrows():
        vector = str(row['vector'])
        if not vector.startswith('raw_osec_'):
            continue
        year = str(row['ref_date'])[:4]
        try:
            grouped.setdefault(year, {})[vector] = float(row['value'])
        except (TypeError, ValueError):
            continue
    return grouped


def _method_rows(prefix: str, year: str, fresh_m3: float, recycled_m3: float, makeup_m3: float, boe: float) -> List[Tuple[str, str, float]]:
    if boe <= 0:
        return []
    total = makeup_m3 + recycled_m3
    fresh_bbl = fresh_m3 * BBL_PER_M3
    rows = [
        (f'{prefix}_hydrocarbon_boe', year, boe),
        (f'{prefix}_intensity_water_m3', year, fresh_m3),
        (f'{prefix}_intensity_water_bbl', year, fresh_bbl),
        (f'{prefix}_makeup_m3', year, makeup_m3),
        (f'{prefix}_recycled_m3', year, recycled_m3),
        (f'{prefix}_total_water_m3', year, total),
        (f'{prefix}_intensity', year, fresh_bbl / boe),
    ]
    if total > 0:
        rows.append((f'{prefix}_recycled_pct', year, recycled_m3 / total))
    return rows


def build_water_indicator_rows(raw_df: pd.DataFrame) -> List[Tuple[str, str, float]]:
    grouped = _raw_by_year(raw_df)
    rows: List[Tuple[str, str, float]] = []
    for year in sorted(grouped):
        raw = grouped[year]
        mining_fresh = (
            raw.get('raw_osec_mining_river_m3', 0.0)
            + raw.get('raw_osec_mining_groundwater_m3', 0.0)
            + raw.get('raw_osec_mining_runoff_m3', 0.0)
        )
        mining_recycled = raw.get('raw_osec_mining_recycled_m3', 0.0)
        rows.extend(_method_rows(
            'osec_mining',
            year,
            mining_fresh,
            mining_recycled,
            mining_fresh,
            raw.get('raw_osec_mining_boe', 0.0),
        ))
        insitu_fresh = raw.get('raw_osec_insitu_hq_m3', 0.0) + raw.get('raw_osec_insitu_alt_m3', 0.0)
        insitu_recycled = raw.get('raw_osec_insitu_recycled_m3', 0.0)
        insitu_makeup = raw.get('raw_osec_insitu_other_m3', 0.0) + insitu_fresh
        rows.extend(_method_rows(
            'osec_insitu',
            year,
            insitu_fresh,
            insitu_recycled,
            insitu_makeup,
            raw.get('raw_osec_insitu_boe', 0.0),
        ))
    return rows


def update_oil_sands_environmental_considerations(processor) -> int:
    print('  Fetching AER oil sands water use...')
    _url, content = _latest_workbook(processor.config)
    rows = build_water_raw_rows(content)
    if not rows:
        raise RuntimeError('oil sands water use: no annual rows produced')
    metadata = [
        (vector, vector, 'units', 'units', 'Alberta Energy Regulator', PAGE_URL)
        for vector in sorted({row[0] for row in rows})
    ]
    n = processor.replace_raw_data(SOURCE_KEY, rows, metadata)
    print(f'    Stored {n} source rows for oil sands water use')
    return n


def transform_oil_sands_environmental_considerations(processor) -> int:
    raw_df = processor.get_raw_dataframe(SOURCE_KEY)
    if raw_df is None or raw_df.empty:
        print('    oil sands water use transform: no raw rows found')
        return 0
    data_rows = build_water_indicator_rows(raw_df)
    if not data_rows:
        print('    oil sands water use transform: no indicator rows produced')
        return 0
    titles = {item[0]: item for item in METADATA}
    metadata = [titles[vector] for vector in sorted({row[0] for row in data_rows})]
    n = processor.store_indicators(SOURCE_KEY, data_rows, metadata)
    latest = {}
    for vector, year, value in data_rows:
        if vector in (
            'osec_mining_intensity',
            'osec_mining_recycled_pct',
            'osec_insitu_intensity',
            'osec_insitu_recycled_pct',
        ):
            latest.setdefault(year, {})[vector] = value
    if latest:
        year = max(latest)
        values = latest[year]
        print(
            f'    {year}: mining intensity {values.get("osec_mining_intensity", 0):.4f}, '
            f'recycle {values.get("osec_mining_recycled_pct", 0) * 100:.2f}%, '
            f'in situ intensity {values.get("osec_insitu_intensity", 0):.4f}, '
            f'recycle {values.get("osec_insitu_recycled_pct", 0) * 100:.2f}%'
        )
    print(f'    Stored {n} indicator rows for oil sands water use')
    return n
