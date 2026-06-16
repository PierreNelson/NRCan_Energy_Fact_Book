"""Secondary energy use (SEU) by fuel handler."""

from typing import Dict, List, Tuple

import pandas as pd

from utils.io_retry import ensure_workbook, resolve_sheet_name

from .constants import EE_SHEET_SEU, ENERGY_EFFICIENCY_XLSX

SOURCE_KEY = 'seu_by_fuel'
NEUD_2000_BASELINE = {'TE': 8042.1, 'Ele': 1707.2, 'NG': 2140.8}


def _seu_excel_path(processor) -> 'Path':
    from pathlib import Path
    from xlsx_paths import default_xlsx_base_dir

    section_cfg = processor.config.sections.get(processor.SECTION_KEY, {})
    seu_cfg = section_cfg.get('sources', {}).get('seu_by_fuel', {}) or {}
    base_dir = default_xlsx_base_dir()
    path_str = (seu_cfg.get('seu_final_demand_file_path') or '').strip()
    if path_str:
        return processor._resolve_path(path_str, base_dir)
    return ensure_workbook(ENERGY_EFFICIENCY_XLSX, config=processor.config)


def _seu_sheet_name(processor, path: 'Path') -> str | int:
    default_path = ensure_workbook(ENERGY_EFFICIENCY_XLSX, config=processor.config)
    if path.resolve() == default_path.resolve():
        return resolve_sheet_name(path, EE_SHEET_SEU, label='seu_by_fuel')
    return EE_SHEET_SEU


def _read_seu_sheet(processor) -> pd.DataFrame:
    path = _seu_excel_path(processor)
    if not path.exists():
        from utils.log_sanitize import format_path_for_log
        print(f'    SEU Final Demand file not found: {format_path_for_log(path)}')
        return pd.DataFrame()
    read_sheet = _seu_sheet_name(processor, path)
    try:
        df = pd.read_excel(path, sheet_name=read_sheet)
    except Exception as e:
        print(f'    Failed to read SEU (final demand) sheet: {e}')
        return pd.DataFrame()
    df.columns = [str(c).strip() for c in df.columns]
    return df


def _parse_seu_raw_by_year(processor, df: pd.DataFrame) -> Dict[int, Dict[str, float]]:
    year_col = processor.get_column(df, 'ref_date', 'REF_DATE', 'year', 'Year', 'YEAR')
    fuel_col = processor.get_column(df, 'fuel', 'FUEL', 'product', 'Fuel')
    value_col = processor.get_column(df, 'value', 'VALUE', 'amount', 'val')
    if not year_col or not fuel_col or not value_col:
        print('    SEU sheet missing YEAR, FUEL or VALUE columns')
        return {}
    by_year: Dict[int, Dict[str, float]] = {}
    for _, row in df.iterrows():
        try:
            y = int(float(row[year_col]))
        except (TypeError, ValueError):
            continue
        fuel = str(row[fuel_col]).strip().lower()
        try:
            val = float(row[value_col])
        except (TypeError, ValueError):
            continue
        if y not in by_year:
            by_year[y] = {}
        by_year[y][fuel] = by_year[y].get(fuel, 0) + val
    return by_year


def update_seu_by_fuel(processor) -> int:
    """EEDAS ingest: SEU Final Demand Excel fuel rows (source-native)."""
    df = _read_seu_sheet(processor)
    if df.empty:
        return 0
    by_year = _parse_seu_raw_by_year(processor, df)
    if not by_year:
        return 0

    data_rows: List[Tuple[str, str, float]] = []
    for year, fuels in sorted(by_year.items()):
        year_str = str(year)
        for fuel, val in fuels.items():
            data_rows.append((fuel, year_str, round(float(val), 2)))

    source_org = 'Natural Resources Canada (OEE)'
    source_url = 'https://oee.nrcan.gc.ca/corporate/statistics/neud/dpa/showTable.cfm?type=HB&sector=aaa&juris=ca&rn=1&year=2022&page=2'
    metadata_rows = [
        (fuel, f'SEU final demand — {fuel}', 'PJ', 'petajoules', source_org, source_url)
        for fuel in sorted({f for d in by_year.values() for f in d})
    ]
    n = processor.replace_raw_data(SOURCE_KEY, data_rows, metadata_rows)
    print(f'    Stored {n} source-native rows for SEU by fuel ({len(by_year)} years)')
    return n


def transform_seu_by_fuel(processor) -> int:
    """EFB transform: aggregate raw fuel rows into seu_* indicators."""
    df = processor.get_raw_dataframe(SOURCE_KEY)
    if df.empty:
        print('    seu_by_fuel transform: no raw rows found')
        return 0

    by_year: Dict[int, Dict[str, float]] = {}
    for _, row in df.iterrows():
        try:
            y = int(str(row['ref_date'])[:4])
            fuel = str(row['vector']).strip().lower()
            val = float(row['value'])
        except (TypeError, ValueError):
            continue
        if y not in by_year:
            by_year[y] = {}
        by_year[y][fuel] = by_year[y].get(fuel, 0) + val

    def _sum(y_dict, *keys):
        return sum(y_dict.get(k, 0) for k in keys)

    data_rows: List[Tuple[str, str, float]] = []
    for year in sorted(by_year.keys()):
        d = by_year[year]
        Oil = _sum(d, 'dfo', 'lfo', 'kerosene', 'hfo')
        OOP = _sum(d, 'airgas', 'airturbo', 'stillgas', 'petrocoke', 'lpgngl')
        BM = _sum(d, 'pulp', 'wood', 'hog')
        OT = _sum(d, 'coal', 'coke', 'cokegas', 'steam', 'waste', 'other')
        Ele = _sum(d, 'electricity')
        NG = _sum(d, 'ng')
        mogas = _sum(d, 'mogas')
        TE = Ele + NG + mogas + Oil + OOP + BM + OT
        if TE <= 0:
            continue
        year_str = str(year)
        data_rows.append(('seu_TE', year_str, round(TE, 2)))
        data_rows.append(('seu_Ele', year_str, round(Ele, 2)))
        data_rows.append(('seu_NG', year_str, round(NG, 2)))
        data_rows.append(('seu_mogas', year_str, round(mogas, 2)))
        data_rows.append(('seu_Oil', year_str, round(Oil, 2)))
        data_rows.append(('seu_OOP', year_str, round(OOP, 2)))
        data_rows.append(('seu_BM', year_str, round(BM, 2)))
        data_rows.append(('seu_OT', year_str, round(OT, 2)))

    if 2000 not in by_year and data_rows:
        for vec, val in [
            ('seu_TE', NEUD_2000_BASELINE['TE']),
            ('seu_Ele', NEUD_2000_BASELINE['Ele']),
            ('seu_NG', NEUD_2000_BASELINE['NG']),
        ]:
            data_rows.append((vec, '2000', round(val, 2)))

    if not data_rows:
        print('    No SEU rows computed')
        return 0

    source_org = 'Natural Resources Canada (OEE)'
    source_url = 'https://oee.nrcan.gc.ca/corporate/statistics/neud/dpa/showTable.cfm?type=HB&sector=aaa&juris=ca&rn=1&year=2022&page=2'
    metadata_rows = [
        ('seu_TE', 'Secondary energy use (final demand) total', 'PJ', 'petajoules', source_org, source_url),
        ('seu_Ele', 'Secondary energy use - Electricity', 'PJ', 'petajoules', source_org, source_url),
        ('seu_NG', 'Secondary energy use - Natural gas', 'PJ', 'petajoules', source_org, source_url),
        ('seu_mogas', 'Secondary energy use - Motor gasoline', 'PJ', 'petajoules', source_org, source_url),
        ('seu_Oil', 'Secondary energy use - Oil', 'PJ', 'petajoules', source_org, source_url),
        ('seu_OOP', 'Secondary energy use - Other oil products', 'PJ', 'petajoules', source_org, source_url),
        ('seu_BM', 'Secondary energy use - Biomass', 'PJ', 'petajoules', source_org, source_url),
        ('seu_OT', 'Secondary energy use - Other', 'PJ', 'petajoules', source_org, source_url),
    ]
    n = processor.store_indicators(SOURCE_KEY, data_rows, metadata_rows)
    print(f'    Stored {n} indicator rows for SEU by fuel')
    return n
