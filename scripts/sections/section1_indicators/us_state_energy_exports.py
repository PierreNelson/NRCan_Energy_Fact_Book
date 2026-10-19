"""Canadian energy exports to U.S. states — Energy trade by state workbook."""

import re
from decimal import Decimal, ROUND_HALF_UP

import pandas as pd

from xlsx_paths import resolve_root_xlsx

from .constants import US_STATE_ENERGY_EXPORTS_XLSX, US_STATE_NAME_TO_CODE

SOURCE_ORG = 'Statistics Canada'
SOURCE_URL = 'https://www.statcan.gc.ca/en/trade'
_TRADE_SHEET = re.compile(r'^energy trade by state \((\d{4})\)$', re.IGNORECASE)
_EXPORTS_SHEET = re.compile(r'^x by state \((\d{4})\)$', re.IGNORECASE)
_SKIP_NAMES = {'dummy', 'dummy state', 'united states', 'grand total', 'row labels', 'state'}


def _round_half_up(value, digits):
    quant = Decimal('1') if digits == 0 else Decimal('0.' + ('0' * (digits - 1)) + '1')
    return float(Decimal(str(value)).quantize(quant, rounding=ROUND_HALF_UP))


def _clean_name(value):
    text = re.sub(r'\s+', ' ', str(value or '')).strip()
    if not text or text.lower() == 'nan':
        return ''
    return text


def _state_code(name):
    return US_STATE_NAME_TO_CODE.get(_clean_name(name).lower())


def _number(value):
    if value is None or (isinstance(value, float) and pd.isna(value)) or pd.isna(value):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _share_percent(value):
    """Sheet stores the GDP share as a fraction. Display is one decimal percent."""
    number = float(value)
    if abs(number) <= 1:
        number *= 100.0
    return _round_half_up(number, 1)


def build_us_state_export_indicators(records):
    """
    records: iterable of (year, state_name, exports_m_cad, share_fraction_or_percent).

    Exports display as the nearest million. The GDP share displays to one decimal.
    Nominal GDP in millions of CAD is exports divided by the fractional share.
    """
    rows = []
    seen = set()
    for year, state_name, exports_m, share in records:
        code = _state_code(state_name)
        exports = _number(exports_m)
        share_value = _number(share)
        year_key = str(year).strip()
        if year_key.endswith('.0'):
            year_key = year_key[:-2]
        if not code or exports is None or share_value is None or not year_key:
            continue
        if (year_key, code) in seen:
            continue
        seen.add((year_key, code))
        fraction = float(share_value) / 100.0 if abs(float(share_value)) > 1 else float(share_value)
        rows.append((f'usx_{code}_exports_m', year_key, _round_half_up(exports, 0)))
        rows.append((f'usx_{code}_share_pct', year_key, _share_percent(share_value)))
        if fraction:
            rows.append((
                f'usx_{code}_gdp_m',
                year_key,
                _round_half_up(float(exports) / fraction, 1),
            ))
    return rows


def _sheet_year(name, pattern):
    match = pattern.match(str(name or '').strip())
    return match.group(1) if match else None


def _named_exports(df):
    """State name and CAD millions from an 'X by State (YEAR)' sheet."""
    header_row = None
    for index, row in df.iterrows():
        label = _clean_name(row.iloc[0]).lower()
        if label in {'row labels', 'state', 'u.s. state'}:
            header_row = index
            break
    start = 0 if header_row is None else header_row + 1
    named = []
    for _, row in df.iloc[start:].iterrows():
        name = _clean_name(row.iloc[0])
        if not name or name.lower() in _SKIP_NAMES:
            if name.lower() == 'grand total':
                break
            continue
        amount = _number(row.iloc[1]) if len(row) > 1 else None
        if amount is None:
            continue
        named.append((name, amount))
    return named


def _metric_rows(df):
    """Rows under State / % of nominal state GDP / domestic exports, before Dummy."""
    header_row = None
    for index, row in df.iterrows():
        state = _clean_name(row.iloc[0]).lower()
        share_header = _clean_name(row.iloc[1]).lower() if len(row) > 1 else ''
        export_header = _clean_name(row.iloc[2]).lower() if len(row) > 2 else ''
        if state == 'state' and 'gdp' in share_header and 'export' in export_header:
            header_row = index
            break
    if header_row is None:
        return []
    metrics = []
    for _, row in df.iloc[header_row + 1:].iterrows():
        name = _clean_name(row.iloc[0])
        if name.lower() in {'dummy', 'dummy state'}:
            break
        share = _number(row.iloc[1]) if len(row) > 1 else None
        exports = _number(row.iloc[2]) if len(row) > 2 else None
        if share is None and exports is None and not name:
            break
        if share is None or exports is None:
            continue
        metrics.append((name, exports, share))
    return metrics


def _assign_names(metrics, named_exports):
    """Fill blank state names by matching export values, then leftover order."""
    remaining = list(named_exports)
    assigned = []
    for name, exports, share in metrics:
        if name:
            assigned.append((name, exports, share))
            continue
        hit = next((i for i, (_name, amount) in enumerate(remaining) if abs(amount - exports) < 0.01), None)
        if hit is None and remaining:
            hit = 0
        if hit is None:
            continue
        matched_name, _amount = remaining.pop(hit)
        assigned.append((matched_name, exports, share))
    return assigned


def read_us_state_export_records(path):
    """Read every Energy trade by state (YEAR) sheet into indicator input rows."""
    book = pd.ExcelFile(path)
    export_names = {}
    for sheet in book.sheet_names:
        year = _sheet_year(sheet, _EXPORTS_SHEET)
        if year:
            export_names[year] = _named_exports(pd.read_excel(path, sheet_name=sheet, header=None))

    records = []
    for sheet in book.sheet_names:
        year = _sheet_year(sheet, _TRADE_SHEET)
        if not year:
            continue
        metrics = _metric_rows(pd.read_excel(path, sheet_name=sheet, header=None))
        for name, exports, share in _assign_names(metrics, export_names.get(year, [])):
            records.append((year, name, exports, share))
    return records


def update_us_state_energy_exports(processor) -> int:
    """EEDAS ingest: one raw exports row and one raw GDP-share row per state-year."""
    print('  Ingesting U.S. state energy exports...')
    excel_path = resolve_root_xlsx(US_STATE_ENERGY_EXPORTS_XLSX)
    if not excel_path.exists():
        raise FileNotFoundError(
            f'{US_STATE_ENERGY_EXPORTS_XLSX} not found at {excel_path}. '
            'Place it in the SharePoint Manual Data folder.'
        )

    records = read_us_state_export_records(excel_path)
    data_rows = []
    metadata_rows = []
    seen = set()
    for year, state_name, exports_m, share in records:
        code = _state_code(state_name)
        if not code:
            continue
        for suffix, value, unit in (
            ('exports', exports_m, 'CAD millions'),
            ('share', share, 'fraction of nominal state GDP'),
        ):
            vector = f'{code}|{suffix}'
            data_rows.append((vector, str(year), round(float(value), 8)))
            if vector not in seen:
                seen.add(vector)
                metadata_rows.append((
                    vector,
                    f'{_clean_name(state_name)} {suffix}',
                    unit,
                    unit,
                    SOURCE_ORG,
                    SOURCE_URL,
                ))
    if not data_rows:
        return 0
    n = processor.replace_raw_data('us_state_energy_exports', data_rows, metadata_rows)
    print(f'    Stored {n} raw U.S. state energy export rows')
    return n


def _indicator_metadata(codes):
    rows = []
    for code in codes:
        rows.append((f'usx_{code}_exports_m', f'{code} energy exports', 'CAD millions', 'millions of Canadian dollars', SOURCE_ORG, SOURCE_URL))
        rows.append((f'usx_{code}_share_pct', f'{code} share of nominal state GDP', '%', 'percent', SOURCE_ORG, SOURCE_URL))
        rows.append((f'usx_{code}_gdp_m', f'{code} nominal state GDP', 'CAD millions', 'millions of Canadian dollars', SOURCE_ORG, SOURCE_URL))
    return rows


def transform_us_state_energy_exports(processor) -> int:
    """EFB transform: whole millions, one-decimal GDP share, and nominal GDP."""
    raw_df = processor.repo.get_raw_dataframe('us_state_energy_exports')
    if raw_df is None or raw_df.empty:
        print('    Warning: No raw U.S. state energy export data in database')
        return 0

    grouped = {}
    for _, row in raw_df.iterrows():
        vector = str(row['vector'])
        if '|' not in vector:
            continue
        code, metric = vector.split('|', 1)
        slot = grouped.setdefault((str(row['ref_date']), code), {})
        slot[metric] = row['value']

    records = []
    for (year, code), metrics in grouped.items():
        if 'exports' not in metrics or 'share' not in metrics:
            continue
        name = next((label for label, state_code in US_STATE_NAME_TO_CODE.items() if state_code == code), code)
        records.append((year, name, metrics['exports'], metrics['share']))

    data_rows = build_us_state_export_indicators(records)
    if not data_rows:
        return 0
    codes = sorted({vector.split('_')[1] for vector, _year, _value in data_rows})
    print(f'    Processed {len(data_rows)} indicator rows')
    return processor.store_indicators(
        'us_state_energy_exports',
        data_rows,
        _indicator_metadata(codes),
    )


def process_us_state_energy_exports(processor) -> int:
    """Run ingest then transform."""
    update_us_state_energy_exports(processor)
    return transform_us_state_energy_exports(processor)
