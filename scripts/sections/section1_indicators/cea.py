"""Canadian Energy Assets (CEA) — CEA_2023.xlsx."""

import pandas as pd

from xlsx_paths import resolve_root_xlsx

from .constants import CEA_REGION_MAPPING, CEA_XLSX


def _parse_cea_year_data(cea_path=None) -> dict:
    """
    Parse CEA Excel and return per-year aggregates (values in millions).

    - A1 = aggregate Non-current assets (Grand Total row)
    - A3 = aggregate Non-current assets for Country=Canada (domestic)
    - A4 = A1 - A3 (abroad)
    - regions = aggregate by Continent from Row Labels for map
    """
    print("  Parsing CEA data from Excel...")

    cea_path = cea_path or resolve_root_xlsx(CEA_XLSX)

    if not cea_path.exists():
        print(f"    Warning: CEA file not found at {cea_path}")
        return {}

    try:
        xl_file = pd.ExcelFile(cea_path)
        sheet_names = xl_file.sheet_names
        print(f"    Found {len(sheet_names)} sheet(s): {sheet_names}")

        year_data = {}

        detailed_sheets_by_year = {}
        summary_sheet = None

        for sheet_name in sheet_names:
            year_match = pd.Series([sheet_name]).str.extract(r'(\d{4})')[0]
            if not year_match.empty and not year_match.isna().all():
                year = int(year_match.iloc[0])
                if 'Canadian Energy Assets' in sheet_name and 2012 <= year <= 2023:
                    detailed_sheets_by_year[year] = sheet_name
                    print(f"    Found detailed sheet for {year}: '{sheet_name}'")

            if 'Evolution' in sheet_name or 'evolution' in sheet_name.lower():
                summary_sheet = sheet_name
                print(f"    Found Evolution table sheet: '{summary_sheet}'")

        if not summary_sheet and 'By region' in sheet_names:
            summary_sheet = 'By region'
            print(f"    Using 'By region' sheet for Evolution table")

        if not summary_sheet and len(detailed_sheets_by_year) == 0:
            print(f"    WARNING: No Evolution table or detailed sheets found")
            summary_sheet = sheet_names[0] if sheet_names else None

        if summary_sheet:
            print(f"\n    Processing Evolution table from sheet: '{summary_sheet}'")
            try:
                df_raw = pd.read_excel(cea_path, sheet_name=summary_sheet, header=None)

                header_row = None
                row_labels_col_idx = None
                year_cols_info = {}

                evolution_start_row = None
                for row_idx in range(min(100, len(df_raw))):
                    row_text = ' '.join([str(df_raw.iloc[row_idx, j]) for j in range(min(5, len(df_raw.columns))) if pd.notna(df_raw.iloc[row_idx, j])])
                    if 'evolution' in row_text.lower() and '2012' in row_text and '2023' in row_text:
                        evolution_start_row = row_idx
                        print(f"      Found Evolution table starting at row {row_idx}")
                        break

                search_start = evolution_start_row if evolution_start_row is not None else 0
                search_end = min(search_start + 20, len(df_raw)) if evolution_start_row else min(100, len(df_raw))

                for row_idx in range(search_start, search_end):
                    for col_idx in range(min(15, len(df_raw.columns))):
                        cell_val = str(df_raw.iloc[row_idx, col_idx]).strip()
                        cell_lower = cell_val.lower()

                        if 'row labels' in cell_lower and row_labels_col_idx is None:
                            row_labels_col_idx = col_idx
                            header_row = row_idx
                            print(f"      Found 'Row Labels' at row {row_idx}, col {col_idx}")

                        if 'non-current' in cell_lower or 'noncurrent' in cell_lower or ('assets' in cell_lower and ('somme' in cell_lower or 'sum' in cell_lower)):
                            year_match = pd.Series([cell_val]).str.extract(r'(\d{4})')[0]
                            if not year_match.empty and not year_match.isna().all():
                                year = int(year_match.iloc[0])
                                if 2012 <= year <= 2023:
                                    if header_row is None:
                                        header_row = row_idx
                                    year_cols_info[year] = (row_idx, col_idx)
                                    print(f"      Found year {year} at row {row_idx}, col {col_idx}")

                if header_row is not None and len(year_cols_info) > 0:
                    df = pd.read_excel(cea_path, sheet_name=summary_sheet, header=header_row)
                    print(f"      Read with header at row {header_row}")

                    row_labels_col = None
                    year_columns = {}

                    for col in df.columns:
                        col_str = str(col).strip()
                        col_lower = col_str.lower()

                        if 'row labels' in col_lower:
                            row_labels_col = col

                        if 'non-current' in col_lower or 'noncurrent' in col_lower or 'assets' in col_lower:
                            year_match = pd.Series([col_str]).str.extract(r'(\d{4})')[0]
                            if not year_match.empty and not year_match.isna().all():
                                year = int(year_match.iloc[0])
                                if 2012 <= year <= 2023:
                                    year_columns[year] = col

                    if row_labels_col and len(year_columns) > 0:
                        for year, year_col in sorted(year_columns.items()):
                            print(f"\n      Processing year {year}...")

                            df_year = df[[row_labels_col, year_col]].copy()
                            df_year[year_col] = pd.to_numeric(df_year[year_col], errors='coerce')
                            df_year = df_year.dropna(subset=[year_col])

                            A1 = 0
                            A3 = 0
                            region_values = {}

                            for _, row in df_year.iterrows():
                                region_name = str(row[row_labels_col]).strip()
                                value = row[year_col]

                                if pd.isna(value) or value == 0:
                                    continue

                                if 'Grand Total' in region_name:
                                    A1 = float(value)
                                    print(f"        A1 (Grand Total): ${A1:,.0f}M")
                                    continue

                                if 'Total ABROAD' in region_name or 'Total Abroad' in region_name:
                                    continue

                                for map_key, region_key in CEA_REGION_MAPPING.items():
                                    if map_key.lower() in region_name.lower():
                                        if region_key not in region_values:
                                            region_values[region_key] = 0
                                        region_values[region_key] += float(value)

                                        if region_key == 'canada' and A3 == 0:
                                            A3 = float(value)
                                            print(f"        A3 (Canada from Row Labels): ${A3:,.0f}M")
                                        break

                            if A1 == 0:
                                A1 = float(df_year[year_col].sum())
                                print(f"        A1 (calculated from sum): ${A1:,.0f}M")

                            A4 = A1 - A3

                            year_data[year] = {
                                'A1': A1,
                                'A3': A3,
                                'A4': A4,
                                'regions': region_values
                            }

                            print(f"        Year {year}: A1=${A1/1000:.1f}B, A3=${A3/1000:.1f}B, A4=${A4/1000:.1f}B")
                else:
                    df = pd.read_excel(cea_path, sheet_name=summary_sheet)
                    print(f"      Shape: {df.shape}, Columns: {list(df.columns)[:10]}...")

            except Exception as e:
                print(f"      ERROR processing Evolution table: {e}")
                import traceback
                traceback.print_exc()

        for year, sheet_name in detailed_sheets_by_year.items():
            if year in year_data:
                continue

            print(f"\n    Processing detailed sheet for {year}: '{sheet_name}'")
            try:
                df = pd.read_excel(cea_path, sheet_name=sheet_name)

                assets_col = None
                country_col = None
                continent_col = None

                for col in df.columns:
                    col_str = str(col).strip()
                    col_lower = col_str.lower()

                    if assets_col is None and ('non-current' in col_lower or 'noncurrent' in col_lower) and str(year) in col_str:
                        assets_col = col

                    if country_col is None and 'country' in col_lower:
                        country_col = col

                    if continent_col is None and 'continent' in col_lower:
                        continent_col = col

                if assets_col:
                    df[assets_col] = pd.to_numeric(df[assets_col], errors='coerce')
                    df = df.dropna(subset=[assets_col])

                    A1 = float(df[assets_col].sum())

                    if country_col and country_col in df.columns:
                        A3 = float(df[df[country_col].str.contains('Canada', case=False, na=False)][assets_col].sum())
                    elif continent_col and continent_col in df.columns:
                        A3 = float(df[df[continent_col].str.contains('Canada', case=False, na=False)][assets_col].sum())
                    else:
                        A3 = 0

                    A4 = A1 - A3

                    year_data[year] = {'A1': A1, 'A3': A3, 'A4': A4, 'regions': {}}

                    if continent_col and continent_col in df.columns:
                        region_agg = df.groupby(continent_col)[assets_col].sum().reset_index()
                        for _, row in region_agg.iterrows():
                            continent_name = str(row[continent_col]).strip()
                            value = row[assets_col]

                            for map_key, region_key in CEA_REGION_MAPPING.items():
                                if map_key.lower() in continent_name.lower():
                                    year_data[year]['regions'][region_key] = float(value)
                                    break

                    print(f"      {year}: A1=${A1/1000:.1f}B, A3=${A3/1000:.1f}B, A4=${A4/1000:.1f}B")
            except Exception as e:
                print(f"      ERROR: {e}")

        if len(year_data) == 0:
            print(f"\n    ERROR: No data extracted from any sheet")
            return {}

        print(f"\n    CEA parse complete: years {sorted(year_data.keys())}")
        return year_data

    except Exception as e:
        print(f"    Error processing CEA file: {e}")
        import traceback
        traceback.print_exc()
        return {}


def _cea_year_data_to_raw_rows(year_data: dict):
    data_rows = []
    metadata_rows = []
    seen = set()
    source_org = 'NRCan'
    source_url = 'https://www.nrcan.gc.ca/energy/energy-sources-distribution/energy-facts/canadian-energy-assets/20064'

    for year in sorted(year_data.keys()):
        data = year_data[year]
        for key in ('A1', 'A3', 'A4'):
            vector = f'raw|{key}'
            data_rows.append((vector, str(year), float(data.get(key, 0))))
            if vector not in seen:
                seen.add(vector)
                metadata_rows.append((vector, key, 'Millions of dollars', 'millions', source_org, source_url))
        for region_key, region_value in data.get('regions', {}).items():
            vector = f'raw|region|{region_key}'
            data_rows.append((vector, str(year), float(region_value)))
            if vector not in seen:
                seen.add(vector)
                metadata_rows.append((vector, f'Region {region_key}', 'Millions of dollars', 'millions', source_org, source_url))
    return data_rows, metadata_rows


def _load_cea_year_data(raw_df) -> dict:
    year_data = {}
    if raw_df is None or raw_df.empty:
        return year_data
    for _, row in raw_df.iterrows():
        vector = str(row['vector'])
        year = int(row['ref_date'])
        value = float(row['value'])
        year_data.setdefault(year, {'A1': 0, 'A3': 0, 'A4': 0, 'regions': {}})
        if vector == 'raw|A1':
            year_data[year]['A1'] = value
        elif vector == 'raw|A3':
            year_data[year]['A3'] = value
        elif vector == 'raw|A4':
            year_data[year]['A4'] = value
        elif vector.startswith('raw|region|'):
            region_key = vector.split('|', 2)[2]
            year_data[year]['regions'][region_key] = value
    return year_data


def _cea_year_data_to_indicator_rows(year_data: dict):
    data_rows = []
    for year in sorted(year_data.keys()):
        data = year_data[year]
        A1 = data['A1']
        A3 = data.get('A3', 0)
        A4 = data.get('A4', 0)
        if A3 == 0 and 'canada' in data['regions']:
            A3 = data['regions']['canada']
            A4 = A1 - A3
        if A4 == 0:
            A4 = A1 - A3
        data_rows.append(('cea_total', str(year), round(A1 / 1000, 1)))
        data_rows.append(('cea_domestic', str(year), round(A3 / 1000, 1)))
        data_rows.append(('cea_abroad', str(year), round(A4 / 1000, 1)))
        for region_key, region_value in data['regions'].items():
            if region_value > 0:
                data_rows.append((f'cea_{region_key}', str(year), round(float(region_value) / 1000, 1)))
    return data_rows


def update_cea_data(processor) -> int:
    """EEDAS ingest: parse CEA Excel and store publisher-native rows (millions)."""
    cea_path = resolve_root_xlsx(CEA_XLSX)
    if not cea_path.exists():
        print(f"    Warning: CEA file not found at {cea_path}")
        return 0
    year_data = _parse_cea_year_data(cea_path)
    if not year_data:
        return 0
    data_rows, metadata_rows = _cea_year_data_to_raw_rows(year_data)
    return processor.replace_raw_data('canadian_energy_assets', data_rows, metadata_rows)


def transform_cea_data(processor) -> int:
    """EFB transform: build cea_* indicator vectors from raw CEA rows."""
    year_data = _load_cea_year_data(processor.repo.get_raw_dataframe('canadian_energy_assets'))
    if not year_data:
        print("    Warning: No raw CEA data in database")
        return 0
    data_rows = _cea_year_data_to_indicator_rows(year_data)
    source_org = 'NRCan'
    source_url = 'https://www.nrcan.gc.ca/energy/energy-sources-distribution/energy-facts/canadian-energy-assets/20064'
    metadata_rows = [
        ('cea_total', 'Canadian Energy Assets - Total (A1)', 'Billions of dollars', 'billions', source_org, source_url),
        ('cea_domestic', 'Canadian Energy Assets - Domestic (A3, Country=Canada)', 'Billions of dollars', 'billions', source_org, source_url),
        ('cea_abroad', 'Canadian Energy Assets - Abroad (A4)', 'Billions of dollars', 'billions', source_org, source_url),
        ('cea_canada', 'Canadian Energy Assets - Canada (by Continent)', 'Billions of dollars', 'billions', source_org, source_url),
        ('cea_north_america', 'Canadian Energy Assets - North America (US and Mexico)', 'Billions of dollars', 'billions', source_org, source_url),
        ('cea_latin_america', 'Canadian Energy Assets - Latin America and Caribbean', 'Billions of dollars', 'billions', source_org, source_url),
        ('cea_europe', 'Canadian Energy Assets - Europe', 'Billions of dollars', 'billions', source_org, source_url),
        ('cea_africa', 'Canadian Energy Assets - Africa', 'Billions of dollars', 'billions', source_org, source_url),
        ('cea_asia', 'Canadian Energy Assets - Asia', 'Billions of dollars', 'billions', source_org, source_url),
        ('cea_oceania', 'Canadian Energy Assets - Oceania', 'Billions of dollars', 'billions', source_org, source_url),
    ]
    print(f"    CEA indicators: {len(data_rows)} rows for years {sorted(year_data.keys())}")
    if not data_rows:
        return 0
    return processor.store_indicators('canadian_energy_assets', data_rows, metadata_rows)


def process_cea_data(processor) -> int:
    """Deprecated: run update then transform."""
    return update_cea_data(processor) + transform_cea_data(processor)
