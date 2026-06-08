"""Residential sector handlers: daily lives and pie charts."""

from typing import Any, Dict, List, Tuple

import pandas as pd

from xlsx_paths import default_xlsx_base_dir

from .constants import (
    OEE_HB_PAGES,
    OEE_TABLE14_PAGES,
    OEE_TABLE7_PAGES,
    REQUEST_TIMEOUT,
)

PIE_SOURCE_KEY = 'residential_pie_charts'
DAILY_SOURCE_KEY = 'residential_daily_lives'


def _ee_improvement_path(processor) -> 'Path':
    from pathlib import Path
    section_cfg = processor.config.sections.get(processor.SECTION_KEY, {})
    res_cfg = section_cfg.get('sources', {}).get('residential_daily_lives', {}) or {}
    base_dir = default_xlsx_base_dir()
    path_str = (res_cfg.get('ee_improvement_file_path') or '').strip()
    if path_str:
        return processor._resolve_path(path_str, base_dir)
    return base_dir / 'EE Improvement.xlsx'


def update_residential_pie_charts(processor) -> int:
    """EEDAS ingest: OEE HB, Table 7 and Table 14 parsed rows (source-native)."""
    data_rows: List[Tuple[str, str, float]] = []
    hb_row_mappings = [
        ('total energy use (pj)', 'hb_total_energy_use', None),
        ('space heating', 'hb_space_heating', None),
        ('water heating', 'hb_water_heating', None),
        ('appliances', 'hb_appliances', ['major', 'other appliances']),
        ('lighting', 'hb_lighting', None),
        ('space cooling', 'hb_space_cooling', None),
    ]
    for url in OEE_HB_PAGES:
        try:
            r = processor.fetch_url_with_retry(url, timeout=REQUEST_TIMEOUT, label='OEE HB')
            parsed = processor._parse_oee_html_table_generic(r.text, hb_row_mappings)
            for year, row in parsed.items():
                for k, v in row.items():
                    data_rows.append((k, str(year), v))
        except Exception as e:
            print(f'    Failed to fetch HB page {url}: {e}')

    t7_mappings = [
        ('total space heating energy use (pj)', 't7_sh_total', None),
        ('electricity', 't7_sh_ele', None),
        ('natural gas', 't7_sh_ng', None),
        ('heating oil', 't7_sh_ho', None),
        ('other', 't7_sh_ot', None),
        ('wood', 't7_sh_wd', None),
    ]
    for url in OEE_TABLE7_PAGES:
        try:
            r = processor.fetch_url_with_retry(url, timeout=REQUEST_TIMEOUT, label='OEE Table 7')
            parsed = processor._parse_oee_html_table_generic(r.text, t7_mappings)
            for year, row in parsed.items():
                for k, v in row.items():
                    data_rows.append((k, str(year), v))
        except Exception as e:
            print(f'    Failed to fetch Table 7 page {url}: {e}')

    t14_mappings = [
        ('total water heating energy use (pj)', 't14_wh_total', None),
        ('electricity', 't14_wh_ele', None),
        ('natural gas', 't14_wh_ng', None),
        ('heating oil', 't14_wh_ho', None),
        ('other', 't14_wh_ot', None),
        ('wood', 't14_wh_wd', None),
    ]
    for url in OEE_TABLE14_PAGES:
        try:
            r = processor.fetch_url_with_retry(url, timeout=REQUEST_TIMEOUT, label='OEE Table 14')
            parsed = processor._parse_oee_html_table_generic(r.text, t14_mappings)
            for year, row in parsed.items():
                for k, v in row.items():
                    data_rows.append((k, str(year), v))
        except Exception as e:
            print(f'    Failed to fetch Table 14 page {url}: {e}')

    if not data_rows:
        print('    No residential_pie_charts raw rows produced')
        return 0

    source_org = 'Natural Resources Canada (OEE)'
    metadata_rows = [
        (vec, f'Residential pie raw — {vec}', 'PJ', 'petajoules', source_org, OEE_HB_PAGES[0])
        for vec in sorted({r[0] for r in data_rows})
    ]
    n = processor.replace_raw_data(PIE_SOURCE_KEY, data_rows, metadata_rows)
    print(f'    Stored {n} source-native rows for residential_pie_charts')
    return n


_PIE_RAW_TO_INDICATOR = {
    'hb_total_energy_use': 'res_reu_total',
    'hb_space_heating': 'res_reu_space_heating',
    'hb_water_heating': 'res_reu_water_heating',
    'hb_appliances': 'res_appliances_pj',
    'hb_lighting': 'res_lighting_pj',
    'hb_space_cooling': 'res_space_cooling_pj',
    't7_sh_total': 'res_sh_total',
    't7_sh_ele': 'res_sh_ele',
    't7_sh_ng': 'res_sh_ng',
    't7_sh_ho': 'res_sh_ho',
    't7_sh_ot': 'res_sh_ot',
    't7_sh_wd': 'res_sh_wd',
    't14_wh_total': 'res_wh_total',
    't14_wh_ele': 'res_wh_ele',
    't14_wh_ng': 'res_wh_ng',
    't14_wh_ho': 'res_wh_ho',
    't14_wh_ot': 'res_wh_ot',
    't14_wh_wd': 'res_wh_wd',
}


def transform_residential_pie_charts(processor) -> int:
    """EFB transform: map raw OEE table rows to res_* pie chart indicators."""
    df = processor.get_raw_dataframe(PIE_SOURCE_KEY)
    if df.empty:
        print('    residential_pie_charts transform: no raw rows found')
        return 0

    data_rows: List[Tuple[str, str, float]] = []
    for _, row in df.iterrows():
        raw_vec = str(row['vector'])
        indicator = _PIE_RAW_TO_INDICATOR.get(raw_vec)
        if not indicator:
            continue
        try:
            data_rows.append((indicator, str(row['ref_date']), float(row['value'])))
        except (TypeError, ValueError):
            continue

    if not data_rows:
        print('    No residential_pie_charts indicator rows produced')
        return 0

    source_org = 'Natural Resources Canada (OEE)'
    metadata_rows = [
        ('res_reu_total', 'Residential total energy use (PJ) from HB table', 'PJ', 'petajoules', source_org, OEE_HB_PAGES[0]),
        ('res_reu_space_heating', 'Residential space heating (PJ) from HB table', 'PJ', 'petajoules', source_org, OEE_HB_PAGES[0]),
        ('res_reu_water_heating', 'Residential water heating (PJ) from HB table', 'PJ', 'petajoules', source_org, OEE_HB_PAGES[0]),
        ('res_appliances_pj', 'Residential appliances energy use (PJ)', 'PJ', 'petajoules', source_org, OEE_HB_PAGES[0]),
        ('res_lighting_pj', 'Residential lighting energy use (PJ)', 'PJ', 'petajoules', source_org, OEE_HB_PAGES[0]),
        ('res_space_cooling_pj', 'Residential space cooling energy use (PJ)', 'PJ', 'petajoules', source_org, OEE_HB_PAGES[0]),
        ('res_sh_total', 'Total space heating energy use (PJ) from Table 7', 'PJ', 'petajoules', source_org, OEE_TABLE7_PAGES[0]),
        ('res_sh_ele', 'Space heating electricity (PJ)', 'PJ', 'petajoules', source_org, OEE_TABLE7_PAGES[0]),
        ('res_sh_ng', 'Space heating natural gas (PJ)', 'PJ', 'petajoules', source_org, OEE_TABLE7_PAGES[0]),
        ('res_sh_ho', 'Space heating heating oil (PJ)', 'PJ', 'petajoules', source_org, OEE_TABLE7_PAGES[0]),
        ('res_sh_ot', 'Space heating other (PJ)', 'PJ', 'petajoules', source_org, OEE_TABLE7_PAGES[0]),
        ('res_sh_wd', 'Space heating wood (PJ)', 'PJ', 'petajoules', source_org, OEE_TABLE7_PAGES[0]),
        ('res_wh_total', 'Total water heating energy use (PJ) from Table 14', 'PJ', 'petajoules', source_org, OEE_TABLE14_PAGES[0]),
        ('res_wh_ele', 'Water heating electricity (PJ)', 'PJ', 'petajoules', source_org, OEE_TABLE14_PAGES[0]),
        ('res_wh_ng', 'Water heating natural gas (PJ)', 'PJ', 'petajoules', source_org, OEE_TABLE14_PAGES[0]),
        ('res_wh_ho', 'Water heating heating oil (PJ)', 'PJ', 'petajoules', source_org, OEE_TABLE14_PAGES[0]),
        ('res_wh_ot', 'Water heating other (PJ)', 'PJ', 'petajoules', source_org, OEE_TABLE14_PAGES[0]),
        ('res_wh_wd', 'Water heating wood (PJ)', 'PJ', 'petajoules', source_org, OEE_TABLE14_PAGES[0]),
    ]
    n = processor.store_indicators(PIE_SOURCE_KEY, data_rows, metadata_rows)
    print(f'    Stored {n} indicator rows for residential_pie_charts')
    return n


def update_residential_daily_lives(processor) -> int:
    """EEDAS ingest: OEE Residential Analysis + EE Improvement / Residential Excel rows."""
    data_rows: List[Tuple[str, str, float]] = []
    print('    Fetching OEE Residential Analysis (TEr, EEE, space heating, water heating)...')
    oee_by_year = processor._fetch_oee_residential_analysis()
    if oee_by_year:
        for year, d in sorted(oee_by_year.items()):
            year_str = str(year)
            if d.get('ter') is not None:
                data_rows.append(('oee_ter', year_str, d['ter']))
            if d.get('eee') is not None:
                data_rows.append(('oee_eee', year_str, round(abs(float(d['eee'])), 2)))
            if d.get('space_heating_pj') is not None:
                data_rows.append(('oee_space_heating_pj', year_str, d['space_heating_pj']))
            if d.get('water_heating_pj') is not None:
                data_rows.append(('oee_water_heating_pj', year_str, d['water_heating_pj']))
        print(f'    OEE Residential: {len(oee_by_year)} years')

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
                res = df_ee[df_ee[sector_col].astype(str).str.strip().str.lower() == 'residential']
                for _, row in res.iterrows():
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

        try:
            df_res = pd.read_excel(path, sheet_name='Residential')
        except Exception:
            df_res = pd.DataFrame()
        if not df_res.empty:
            df_res.columns = [str(c).strip() for c in df_res.columns]
            year_col = processor.get_column(df_res, 'year', 'YEAR', 'Year', 'ref_date', 'REF_DATE')
            ter_col = processor.get_column(df_res, 'ter', 'total_energy_use_pj', 'total energy use (pj)', 'Total Energy Use (PJ)', 'total (pj)', 'Total (PJ)', 'total_energy_pj')
            eee_col = processor.get_column(
                df_res, 'eee', 'EEE', 'energy_efficiency_effect', 'energy efficiency effect',
                'energy efficiency effect (pj)', 'efficiency effect (pj)', 'Energy Efficiency Effect (PJ)',
            )
            sh_col = processor.get_column(df_res, 'space_heating_pj', 'space_heating', 'Space Heating (PJ)', 'space heating', 'space heating (pj)', 'space heating (PJ)')
            wh_col = processor.get_column(df_res, 'water_heating_pj', 'water_heating', 'Water Heating (PJ)', 'water heating', 'water heating (pj)', 'water heating (PJ)')
            if year_col:
                for _, row in df_res.iterrows():
                    try:
                        y = int(float(row[year_col]))
                    except (TypeError, ValueError):
                        continue
                    year_str = str(y)
                    for raw_key, col in [
                        ('xls_ter', ter_col), ('xls_eee', eee_col),
                        ('xls_space_heating_pj', sh_col), ('xls_water_heating_pj', wh_col),
                    ]:
                        if col and pd.notna(row.get(col)):
                            try:
                                val = float(row[col])
                                if raw_key == 'xls_eee':
                                    val = abs(val)
                                data_rows.append((raw_key, year_str, round(val, 2)))
                            except (TypeError, ValueError):
                                pass
    else:
        print(f'    EE Improvement file not found: {path}')

    if not data_rows:
        print('    No residential_daily_lives raw rows produced')
        return 0

    source_org = 'Natural Resources Canada (OEE)'
    source_url = 'https://oee.nrcan.gc.ca/corporate/statistics/neud/dpa/showTable.cfm?type=AN&sector=res&juris=00&rn=11&year=2023&page=1'
    metadata_rows = [
        (vec, f'Residential daily lives raw — {vec}', 'PJ', 'petajoules', source_org, source_url)
        for vec in sorted({r[0] for r in data_rows})
    ]
    n = processor.replace_raw_data(DAILY_SOURCE_KEY, data_rows, metadata_rows)
    print(f'    Stored {n} source-native rows for residential_daily_lives')
    return n


def _raw_series(df: pd.DataFrame, vector: str) -> Dict[str, float]:
    sub = df[df['vector'].astype(str) == vector]
    return {str(r['ref_date']): float(r['value']) for _, r in sub.iterrows() if pd.notna(r['value'])}


def transform_residential_daily_lives(processor) -> int:
    """EFB transform: merge OEE + Excel overrides into res_* indicators."""
    df = processor.get_raw_dataframe(DAILY_SOURCE_KEY)
    if df.empty:
        print('    residential_daily_lives transform: no raw rows found')
        return 0

    data_rows: List[Tuple[str, str, float]] = []

    for year_str, val in _raw_series(df, 'oee_ter').items():
        data_rows.append(('res_ter', year_str, val))
    for year_str, val in _raw_series(df, 'oee_eee').items():
        data_rows.append(('res_eee', year_str, val))
    for year_str, val in _raw_series(df, 'oee_space_heating_pj').items():
        data_rows.append(('res_space_heating_pj', year_str, val))
    for year_str, val in _raw_series(df, 'oee_water_heating_pj').items():
        data_rows.append(('res_water_heating_pj', year_str, val))

    for year_str, val in _raw_series(df, 'ee_improvement_pct').items():
        data_rows.append(('res_ee_improvement_pct', year_str, val))
    for year_str, val in _raw_series(df, 'ee_savings_pj').items():
        data_rows.append(('res_ee_savings_pj', year_str, val))
    for year_str, val in _raw_series(df, 'ee_savings_billion').items():
        data_rows.append(('res_ee_savings_billion', year_str, val))

    xls_overrides = {
        'xls_ter': 'res_ter',
        'xls_eee': 'res_eee',
        'xls_space_heating_pj': 'res_space_heating_pj',
        'xls_water_heating_pj': 'res_water_heating_pj',
    }
    for raw_key, ind_key in xls_overrides.items():
        for year_str, val in _raw_series(df, raw_key).items():
            data_rows = [(v, y, x) for v, y, x in data_rows if not (v == ind_key and y == year_str)]
            data_rows.append((ind_key, year_str, val))

    if not data_rows:
        print('    No residential_daily_lives indicator rows produced')
        return 0

    source_org = 'Natural Resources Canada (OEE)'
    source_url = 'https://oee.nrcan.gc.ca/corporate/statistics/neud/dpa/showTable.cfm?type=AN&sector=res&juris=00&rn=11&year=2023&page=1'
    metadata_rows = [
        ('res_ee_improvement_pct', 'Residential energy efficiency improvement (2000 to end year)', '%', 'percent', source_org, source_url),
        ('res_ee_savings_pj', 'Residential energy savings (PJ)', 'PJ', 'petajoules', source_org, source_url),
        ('res_ee_savings_billion', 'Residential energy cost savings (billion $)', 'billion $', 'billions', source_org, source_url),
        ('res_ter', 'Residential total energy use (PJ) from Residential sheet', 'PJ', 'petajoules', source_org, source_url),
        ('res_eee', 'Residential energy efficiency effect (PJ)', 'PJ', 'petajoules', source_org, source_url),
        ('res_space_heating_pj', 'Residential space heating energy use (PJ)', 'PJ', 'petajoules', source_org, source_url),
        ('res_water_heating_pj', 'Residential water heating energy use (PJ)', 'PJ', 'petajoules', source_org, source_url),
    ]
    n = processor.store_indicators(DAILY_SOURCE_KEY, data_rows, metadata_rows)
    print(f'    Stored {n} indicator rows for residential_daily_lives')
    return n
