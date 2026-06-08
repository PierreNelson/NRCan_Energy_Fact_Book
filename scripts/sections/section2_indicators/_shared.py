"""Shared NRCan Major Projects Inventory HTML parser helpers."""

import re
from typing import List, Optional, Tuple

import pandas as pd
import requests

from .constants import NRCAN_MPI_URL


def store_publisher_rows(
    processor,
    source_key: str,
    df: pd.DataFrame,
    ref_date_col: str,
    value_col: str,
    dimension_cols: List[str],
    source_org: str = '',
    source_url: str = '',
) -> int:
    """Store CSV rows as publisher-native ingest (non-v* vectors)."""
    data_rows = []
    metadata_rows = []
    seen_vectors = set()
    for _, row in df.iterrows():
        if value_col not in df.columns or pd.isna(row.get(value_col)):
            continue
        ref_raw = row.get(ref_date_col)
        if pd.isna(ref_raw):
            continue
        try:
            ref_date = str(int(ref_raw))
        except (TypeError, ValueError):
            ref_date = str(ref_raw).strip()
        parts = [
            str(row[c]).strip()
            for c in dimension_cols
            if c in df.columns and pd.notna(row.get(c))
        ]
        vector = '|'.join(parts) if parts else ref_date
        try:
            value = float(row[value_col])
        except (TypeError, ValueError):
            continue
        data_rows.append((vector, ref_date, value))
        if vector not in seen_vectors:
            seen_vectors.add(vector)
            title = parts[-1] if parts else vector
            metadata_rows.append((vector, title, '', '', source_org, source_url))
    if not data_rows:
        return 0
    return processor.replace_raw_data(source_key, data_rows, metadata_rows)


def raw_to_dimension_df(raw_df: pd.DataFrame, dimension_names: List[str]) -> pd.DataFrame:
    """Expand pipe-delimited vector keys back into dimension columns."""
    rows = []
    for _, row in raw_df.iterrows():
        parts = str(row['vector']).split('|')
        record = {'ref_date': row['ref_date'], 'value': row['value']}
        for i, name in enumerate(dimension_names):
            record[name] = parts[i] if i < len(parts) else None
        rows.append(record)
    return pd.DataFrame(rows)


def parse_table_cell(cell_text: str) -> Tuple[Optional[int], Optional[float]]:
    """Parse a table cell to extract count and value in billions."""
    cell_text = cell_text.strip()
    count_match = re.search(r'^(\d+)', cell_text)
    value_match = re.search(r'\$?([\d.]+)([BM])\)?', cell_text)

    count = int(count_match.group(1)) if count_match else None
    value = None
    if value_match:
        value = float(value_match.group(1))
        if value_match.group(2) == 'M':
            value = value / 1000  # Convert millions to billions

    return count, value


def extract_years_from_table(table) -> list:
    """Extract years from table headers."""
    if table is None:
        return []

    years = []
    rows = table.find_all('tr')

    for row in rows[:3]:
        cells = row.find_all(['th', 'td'])
        for cell in cells:
            cell_text = cell.get_text().strip()
            year_matches = re.findall(r'\b(20\d{2})\b', cell_text)
            for year_str in year_matches:
                year = int(year_str)
                if 2015 <= year <= 2050 and year not in years:
                    years.append(year)

    if not years:
        table_text = table.get_text()
        year_matches = re.findall(r'\b(20\d{2})\b', table_text)
        seen = set()
        for year_str in year_matches:
            year = int(year_str)
            if 2015 <= year <= 2050 and year not in seen:
                years.append(year)
                seen.add(year)
                if len(years) >= 10:
                    break

    years.sort()
    return years


def fetch_nrcan_mpi_tables(processor=None):
    """Fetch and parse tables from NRCan Major Projects Inventory."""
    from bs4 import BeautifulSoup
    from config_loader import get_config
    from utils.http_retry import fetch_get, resilience_from_config

    print("    Fetching NRCan Major Projects Inventory...")
    url = NRCAN_MPI_URL

    try:
        if processor is not None:
            response = processor.fetch_url_with_retry(url, timeout=60, label="NRCan MPI")
        else:
            max_r, delay = resilience_from_config(get_config())
            response = fetch_get(
                url, timeout=60, max_retries=max_r, retry_delay_seconds=delay, label="NRCan MPI"
            )
        soup = BeautifulSoup(response.content, 'html.parser')

        tables = soup.find_all('table')
        print(f"    Found {len(tables)} tables in NRCan MPI")

        energy_table = None
        cleantech_table = None

        for table in tables:
            header_text = ""
            thead = table.find('thead')
            if thead:
                header_text = thead.get_text()
            first_row = table.find('tr')
            if first_row:
                header_text += first_row.get_text()

            if 'Total Energy Projects' in table.get_text() or 'Oil and Gas' in table.get_text():
                if energy_table is None:
                    energy_table = table
                    print("    Found Energy Projects table (Table 1)")

            if 'Total Clean Technology' in table.get_text() or 'Hydro' in table.get_text():
                if 'Carbon Capture' in table.get_text() and cleantech_table is None:
                    cleantech_table = table
                    print("    Found Clean Technology table (Table 4)")

        return energy_table, cleantech_table, soup

    except Exception as e:
        print(f"    ERROR fetching NRCan MPI: {e}")
        return None, None, None


def parse_energy_table(table) -> dict:
    """Parse the energy projects table."""
    if table is None:
        return None

    years = extract_years_from_table(table)
    if not years:
        print("    WARNING: Could not extract years from energy table")
        return None

    print(f"    Detected years in energy table: {years}")

    rows = table.find_all('tr')
    data = {}

    # Find header row with years
    header_row_idx = -1
    for idx, row in enumerate(rows):
        row_text = row.get_text()
        year_count = sum(1 for y in years if str(y) in row_text)
        if year_count >= len(years) - 1:
            header_row_idx = idx
            break

    # Map column positions to years
    year_positions = []
    if header_row_idx >= 0:
        header_cells = rows[header_row_idx].find_all(['th', 'td'])
        for i, cell in enumerate(header_cells):
            cell_text = cell.get_text().strip()
            for year in years:
                if str(year) in cell_text and year not in [yp[1] for yp in year_positions]:
                    year_positions.append((i, year))
                    break

    if not year_positions:
        year_positions = [(i + 1, year) for i, year in enumerate(years)]

    # Parse data rows
    for row in rows:
        cells = row.find_all(['th', 'td'])
        if len(cells) >= 2:
            row_label = cells[0].get_text().strip().lower()

            category = None
            if 'total energy' in row_label:
                category = 'total'
            elif 'oil and gas' in row_label:
                category = 'oil_gas'
            elif 'electricity' in row_label:
                category = 'electricity'
            elif 'other' in row_label:
                category = 'other'

            if category:
                for col_idx, year in year_positions:
                    if col_idx < len(cells):
                        count, value = parse_table_cell(cells[col_idx].get_text())
                        if year not in data:
                            data[year] = {}
                        if count is not None:
                            data[year][f'{category}_projects'] = count
                        if value is not None:
                            data[year][f'{category}_value'] = value

    return data


def parse_cleantech_table(table) -> dict:
    """Parse the clean technology table."""
    if table is None:
        return None

    years = extract_years_from_table(table)
    if not years:
        print("    WARNING: Could not extract years from clean tech table")
        return None

    print(f"    Detected years in clean tech table: {years}")

    rows = table.find_all('tr')
    data = {}

    category_map = {
        'total clean technology': 'total',
        'hydro': 'hydro',
        'bioenergy': 'biomass',
        'biomass': 'biomass',
        'solar': 'solar',
        'wind': 'wind',
        'carbon capture': 'ccs',
        'tidal': 'tidal',
        'geothermal': 'geothermal',
        'nuclear': 'nuclear',
        'energy storage': 'storage',
        'multiple': 'multiple',
        'other': 'other',
    }

    # Find header row with years
    header_row_idx = -1
    for idx, row in enumerate(rows):
        row_text = row.get_text()
        year_count = sum(1 for y in years if str(y) in row_text)
        if year_count >= len(years) - 1:
            header_row_idx = idx
            break

    # Map column positions to years
    year_positions = []
    if header_row_idx >= 0:
        header_cells = rows[header_row_idx].find_all(['th', 'td'])
        for i, cell in enumerate(header_cells):
            cell_text = cell.get_text().strip()
            for year in years:
                if str(year) in cell_text and year not in [yp[1] for yp in year_positions]:
                    year_positions.append((i, year))
                    break

    if not year_positions:
        year_positions = [(i + 1, year) for i, year in enumerate(years)]

    # Parse data rows
    for row in rows:
        cells = row.find_all(['th', 'td'])
        if len(cells) >= 2:
            row_label = cells[0].get_text().strip().lower()

            category = None
            for key, cat in category_map.items():
                if key in row_label:
                    category = cat
                    break

            if category:
                for col_idx, year in year_positions:
                    if col_idx < len(cells):
                        count, value = parse_table_cell(cells[col_idx].get_text())
                        if year not in data:
                            data[year] = {}
                        if count is not None:
                            data[year][f'{category}_projects'] = count
                        if value is not None:
                            data[year][f'{category}_value'] = value

    return data


def extract_energy_data_from_text(soup) -> dict:
    """Fallback extraction if table parsing fails."""
    if soup is None:
        return {}

    text = soup.get_text()
    data = {}

    # Extract years
    year_matches = re.findall(r'\b(20\d{2})\b', text)
    years = []
    seen = set()
    for year_str in year_matches:
        year = int(year_str)
        if 2015 <= year <= 2050 and year not in seen:
            years.append(year)
            seen.add(year)
            if len(years) >= 10:
                break
    years.sort()

    if not years:
        print("    WARNING: Could not detect years in fallback extraction")
        return {}

    print(f"    Fallback extraction detected years: {years}")

    cell_pattern = r'(\d+)\s*\(\$?([\d.]+)B\)'

    categories = {
        'total': r'Total Energy Projects[^\n]*',
        'oil_gas': r'Oil and Gas[^\n]*',
        'electricity': r'Electricity Generation[^\n]*',
        'other': r'Other[^\n]*\$[\d.]+B',
    }

    for category, pattern in categories.items():
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            line = match.group(0)
            cells = re.findall(cell_pattern, line)
            for i, (count, value) in enumerate(cells):
                if i < len(years):
                    year = years[i]
                    if year not in data:
                        data[year] = {}
                    data[year][f'{category}_projects'] = int(count)
                    data[year][f'{category}_value'] = float(value)

    return data


def extract_cleantech_data_from_text(soup) -> dict:
    """Fallback extraction for clean tech data."""
    if soup is None:
        return {}

    text = soup.get_text()
    data = {}

    # Extract years
    year_matches = re.findall(r'\b(20\d{2})\b', text)
    years = []
    seen = set()
    for year_str in year_matches:
        year = int(year_str)
        if 2015 <= year <= 2050 and year not in seen:
            years.append(year)
            seen.add(year)
            if len(years) >= 10:
                break
    years.sort()

    if not years:
        print("    WARNING: Could not detect years in cleantech fallback extraction")
        return {}

    print(f"    Cleantech fallback extraction detected years: {years}")

    cell_pattern = r'(\d+)\s*\(\$?([\d.]+)B\)'

    categories = {
        'total': r'Total Clean Technology[^\n]*',
        'hydro': r'\bHydro[^\n]*\$[\d.]+B',
        'wind': r'\bWind[^\n]*\$[\d.]+B',
        'solar': r'\bSolar[^\n]*\$[\d.]+B',
        'nuclear': r'\bNuclear[^\n]*\$[\d.]+B',
        'ccs': r'Carbon Capture[^\n]*\$[\d.]+B',
        'biomass': r'\bBioenergy[^\n]*\$[\d.]+B',
        'tidal': r'\bTidal[^\n]*\$[\d.]+B',
        'geothermal': r'\bGeothermal[^\n]*\$[\d.]+B',
        'storage': r'Energy Storage[^\n]*\$[\d.]+B',
        'multiple': r'\bMultiple[^\n]*\$[\d.]+B',
        'other': r'\bOther1?[^\n]*\$[\d.]+B',
    }

    for category, pattern in categories.items():
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            line = match.group(0)
            cells = re.findall(cell_pattern, line)
            for i, (count, value) in enumerate(cells):
                if i < len(years):
                    year = years[i]
                    if year not in data:
                        data[year] = {}
                    data[year][f'{category}_projects'] = int(count)
                    data[year][f'{category}_value'] = float(value)

    return data
