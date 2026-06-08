"""Commercial and institutional sector handler."""

from typing import Dict, List, Tuple

import pandas as pd

from xlsx_paths import default_xlsx_base_dir

from .constants import OEE_COM_AN_PAGES, OEE_COM_HB_PAGES, REQUEST_TIMEOUT

SOURCE_KEY = 'commercial_institutional'


def _ee_improvement_path(processor):
    section_cfg = processor.config.sections.get(processor.SECTION_KEY, {})
    res_cfg = section_cfg.get('sources', {}).get('residential_daily_lives', {}) or {}
    base_dir = default_xlsx_base_dir()
    path_str = (res_cfg.get('ee_improvement_file_path') or '').strip()
    if path_str:
        return processor._resolve_path(path_str, base_dir)
    return base_dir / 'EE Improvement.xlsx'


def update_commercial_institutional(processor) -> int:
    """EEDAS ingest: OEE Commercial HB/AN tables + EE Improvement Excel rows."""
    data_rows: List[Tuple[str, str, float]] = []
    hb_row_mappings = [
        ('total energy use (pj)', 'hb_teu_cieu', None),
        ('space heating', 'hb_sh', ['street']),
        ('water heating', 'hb_wh', ['street']),
        ('auxiliary equipment', 'hb_ae', None),
        ('auxiliary motors', 'hb_am', None),
        ('lighting', 'hb_lt', ['street']),
        ('space cooling', 'hb_sc', ['street']),
        ('energy intensity', 'hb_ei', ['street']),
    ]
    for url in OEE_COM_HB_PAGES:
        try:
            r = processor.fetch_url_with_retry(url, timeout=REQUEST_TIMEOUT, label='OEE Commercial HB')
            parsed = processor._parse_oee_html_table_generic(r.text, hb_row_mappings)
            for year, row in parsed.items():
                for k, v in row.items():
                    data_rows.append((k, str(year), v))
        except Exception as e:
            print(f'    Failed to fetch Commercial HB page {url}: {e}')

    an_row_mappings = [('energy efficiency effect', 'an_eee', None)]
    for url in OEE_COM_AN_PAGES:
        try:
            r = processor.fetch_url_with_retry(url, timeout=REQUEST_TIMEOUT, label='OEE Commercial AN')
            parsed = processor._parse_oee_html_table_generic(r.text, an_row_mappings)
            for year, row in parsed.items():
                for k, v in row.items():
                    if k == 'an_eee' and v is not None and v < 0:
                        v = abs(v)
                    data_rows.append((k, str(year), v))
        except Exception as e:
            print(f'    Failed to fetch Commercial AN page {url}: {e}')

    path = _ee_improvement_path(processor)
    if path.exists():
        try:
            df_ee = pd.read_excel(path, sheet_name='EE Improvement')
        except Exception as e:
            print(f'    Failed to read sheet EE Improvement: {e}')
            df_ee = pd.DataFrame()
        if not df_ee.empty:
            df_ee.columns = [str(c).strip() for c in df_ee.columns]
            sector_col = processor.get_column(df_ee, 'sector', 'SECTOR', 'Sector', 'sectors')
            metric_col = processor.get_column(df_ee, 'metric', 'METRIC', 'Metric', 'metric name', 'metric_name', 'indicator')
            uom_col = processor.get_column(df_ee, 'uom', 'UOM', 'Uom', 'unit', 'units')
            value_col = processor.get_column(df_ee, 'value', 'VALUE', 'Value', 'val', 'amount', 'data')
            year_col = processor.get_column(df_ee, 'year', 'YEAR', 'Year', 'end_year', 'ref_date', 'end year')
            if sector_col and metric_col and value_col:
                com = df_ee[df_ee[sector_col].astype(str).str.strip().str.lower() == 'commercial']
                for _, row in com.iterrows():
                    metric = str(row.get(metric_col, '')).strip().lower()
                    uom = str(row.get(uom_col, '')).strip().lower() if uom_col else ''
                    try:
                        val = float(row[value_col])
                    except (TypeError, ValueError):
                        continue
                    ee_year = 2022
                    if year_col and pd.notna(row.get(year_col)):
                        try:
                            ee_year = int(float(row[year_col]))
                        except (TypeError, ValueError):
                            pass
                    ref = str(ee_year)
                    if 'improvement' in metric:
                        data_rows.append(('ee_improvement_pct', ref, round(val, 2)))
                    elif 'energy savings' in metric or 'savings' in metric:
                        if 'pj' in uom or uom == 'pj':
                            data_rows.append(('ee_savings_pj', ref, round(val, 2)))
                        elif 'billion' in uom or '$' in uom:
                            data_rows.append(('ee_savings_billion', ref, round(val, 2)))
    else:
        print(f'    EE Improvement file not found (optional for commercial): {path}')

    if not data_rows:
        print('    No commercial_institutional raw rows produced')
        return 0

    source_org = 'Natural Resources Canada (OEE)'
    metadata_rows = [
        (vec, f'Commercial raw — {vec}', 'PJ', 'petajoules', source_org, OEE_COM_HB_PAGES[0])
        for vec in sorted({r[0] for r in data_rows})
    ]
    n = processor.replace_raw_data(SOURCE_KEY, data_rows, metadata_rows)
    print(f'    Stored {n} source-native rows for commercial_institutional')
    return n


_RAW_TO_INDICATOR = {
    'hb_teu_cieu': 'com_teu_cieu',
    'hb_sh': 'com_sh',
    'hb_wh': 'com_wh',
    'hb_ae': 'com_ae',
    'hb_am': 'com_am',
    'hb_lt': 'com_lt',
    'hb_sc': 'com_sc',
    'hb_ei': 'com_ei',
    'an_eee': 'com_eee',
    'ee_improvement_pct': 'com_ee_improvement_pct',
    'ee_savings_pj': 'com_ee_savings_pj',
    'ee_savings_billion': 'com_ee_savings_billion',
}


def transform_commercial_institutional(processor) -> int:
    """EFB transform: map raw OEE/Excel rows to com_* indicators."""
    df = processor.get_raw_dataframe(SOURCE_KEY)
    if df.empty:
        print('    commercial_institutional transform: no raw rows found')
        return 0

    data_rows: List[Tuple[str, str, float]] = []
    for _, row in df.iterrows():
        raw_vec = str(row['vector'])
        indicator = _RAW_TO_INDICATOR.get(raw_vec)
        if not indicator:
            continue
        try:
            data_rows.append((indicator, str(row['ref_date']), float(row['value'])))
        except (TypeError, ValueError):
            continue

    if not data_rows:
        print('    No commercial_institutional indicator rows produced')
        return 0

    source_org = 'Natural Resources Canada (OEE)'
    source_url_hb = OEE_COM_HB_PAGES[0]
    source_url_an = OEE_COM_AN_PAGES[0]
    metadata_rows = [
        ('com_teu_cieu', 'Commercial and institutional total energy use (PJ)', 'PJ', 'petajoules', source_org, source_url_hb),
        ('com_sh', 'Commercial and institutional space heating (PJ)', 'PJ', 'petajoules', source_org, source_url_hb),
        ('com_wh', 'Commercial and institutional water heating (PJ)', 'PJ', 'petajoules', source_org, source_url_hb),
        ('com_ae', 'Commercial and institutional auxiliary equipment (PJ)', 'PJ', 'petajoules', source_org, source_url_hb),
        ('com_am', 'Commercial and institutional auxiliary motors (PJ)', 'PJ', 'petajoules', source_org, source_url_hb),
        ('com_lt', 'Commercial and institutional lighting (PJ)', 'PJ', 'petajoules', source_org, source_url_hb),
        ('com_sc', 'Commercial and institutional space cooling (PJ)', 'PJ', 'petajoules', source_org, source_url_hb),
        ('com_ei', 'Commercial and institutional energy intensity (GJ/m²)', 'GJ/m²', 'units', source_org, source_url_hb),
        ('com_eee', 'Commercial and institutional energy efficiency effect (PJ)', 'PJ', 'petajoules', source_org, source_url_an),
        ('com_ee_improvement_pct', 'Commercial energy efficiency improvement (2000 to end year)', '%', 'percent', source_org, source_url_an),
        ('com_ee_savings_pj', 'Commercial energy savings (PJ)', 'PJ', 'petajoules', source_org, source_url_an),
        ('com_ee_savings_billion', 'Commercial energy cost savings (billion $)', 'billion $', 'billions', source_org, source_url_an),
    ]
    n = processor.store_indicators(SOURCE_KEY, data_rows, metadata_rows)
    print(f'    Stored {n} indicator rows for commercial_institutional')
    return n
