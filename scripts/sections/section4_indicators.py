"""
Section 4: Energy Efficiency / Indicators data processor.

Handles data for:
- Energy use (OEE NEUD sector totals R,C,I,T,A + Primary Energy Use Demand P,NPC,FK,EL).
  OEE: five sector Table 1 XLS from NRCan OEE NEUD (URLs in code). Primary: local Excel (EXTERNAL_XLSX_DATA_DIR or repo root).
"""

import io
import re
import zipfile
from pathlib import Path
from typing import Dict, Any, List, Tuple, Optional

import pandas as pd
import requests
from bs4 import BeautifulSoup

from .base import SectionProcessor
from xlsx_paths import default_xlsx_base_dir

# OEE NEUD: all sectors use comprehensive ZIPs (direct Excel XLS URLs often 404/500).
OEE_NEUD_ZIP_BASE = "https://oee.nrcan.gc.ca/corporate/statistics/neud/dpa/data_e/downloads/comprehensive/zip/2022"
OEE_NEUD_ZIP_URLS = {
    'R': f"{OEE_NEUD_ZIP_BASE}/resca2022e.zip",
    'C': f"{OEE_NEUD_ZIP_BASE}/comca2022e.zip",
    'I': f"{OEE_NEUD_ZIP_BASE}/aggca2022e.zip",
    'T': f"{OEE_NEUD_ZIP_BASE}/tranca2022e.zip",
    'A': f"{OEE_NEUD_ZIP_BASE}/agrca2022e.zip",
}
OEE_RESIDENTIAL_ANALYSIS_XLS = "https://oee.nrcan.gc.ca/corporate/statistics/neud/dpa/data_e/downloads/analysis/Excel/2023/res_00_1_e_1.xls"
OEE_RESIDENTIAL_ANALYSIS_PAGES = [
    "https://oee.nrcan.gc.ca/corporate/statistics/neud/dpa/showTable.cfm?type=AN&sector=res&juris=00&rn=11&year=2023&page=1",
    "https://oee.nrcan.gc.ca/corporate/statistics/neud/dpa/showTable.cfm?type=AN&sector=res&juris=00&rn=11&year=2023&page=2",
    "https://oee.nrcan.gc.ca/corporate/statistics/neud/dpa/showTable.cfm?type=AN&sector=res&juris=00&rn=11&year=2023&page=3",
]
OEE_HB_BASE = "https://oee.nrcan.gc.ca/corporate/statistics/neud/dpa/showTable.cfm?type=HB&sector=res&juris=00&rn=1&year=2023"
OEE_HB_PAGES = [f"{OEE_HB_BASE}&page=1", f"{OEE_HB_BASE}&page=2", f"{OEE_HB_BASE}&page=3"]
OEE_TABLE7_BASE = "https://oee.nrcan.gc.ca/corporate/statistics/neud/dpa/showTable.cfm?type=CP&sector=res&juris=ca&rn=7&year=2023"
OEE_TABLE7_PAGES = [f"{OEE_TABLE7_BASE}&page=1", f"{OEE_TABLE7_BASE}&page=2"]
OEE_TABLE14_BASE = "https://oee.nrcan.gc.ca/corporate/statistics/neud/dpa/showTable.cfm?type=CP&sector=res&juris=ca&rn=14&year=2023"
OEE_TABLE14_PAGES = [f"{OEE_TABLE14_BASE}&page=1", f"{OEE_TABLE14_BASE}&page=2"]

OEE_COM_HB_BASE = "https://oee.nrcan.gc.ca/corporate/statistics/neud/dpa/showTable.cfm?type=HB&sector=com&juris=00&rn=1&year=2023"
OEE_COM_HB_PAGES = [f"{OEE_COM_HB_BASE}&page=1", f"{OEE_COM_HB_BASE}&page=2"]
OEE_COM_AN_BASE = "https://oee.nrcan.gc.ca/corporate/statistics/neud/dpa/showTable.cfm?type=AN&sector=com&juris=00&rn=11&year=2023"
OEE_COM_AN_PAGES = [f"{OEE_COM_AN_BASE}&page=1", f"{OEE_COM_AN_BASE}&page=2"]

DEFAULT_PRIMARY_DEMAND_FILENAME = "Primary Energy Use Demand.xlsx"
REQUEST_TIMEOUT = 60

# OEE Residential Analysis (AN) row labels vary by file version; match broadly.
def _residential_label_ter(label: str) -> bool:
    l = (label or "").strip().lower().replace("\n", " ")
    if not l or "efficiency effect" in l:
        return False
    if "space heating" in l or "water heating" in l:
        return False
    if "share" in l or l.startswith("%"):
        return False
    return (
        ("total energy use" in l or "total energy requirements" in l or "total residential energy" in l)
        and ("pj" in l or "terajoule" in l or "(pj)" in l)
    ) or (l.startswith("ter") and "pj" in l)


def _residential_label_eee(label: str) -> bool:
    l = (label or "").strip().lower().replace("\n", " ")
    return (
        "energy efficiency effect" in l
        or "efficiency effect" in l
        or ("efficiency" in l and "effect" in l and "pj" in l)
    )


def _residential_label_space(label: str) -> bool:
    l = (label or "").strip().lower().replace("\n", " ")
    return "space heating" in l and "water" not in l and "share" not in l


def _residential_label_water(label: str) -> bool:
    l = (label or "").strip().lower().replace("\n", " ")
    return "water heating" in l and "share" not in l


class Section4Indicators(SectionProcessor):
    """
    Processor for Section 4 (Energy Efficiency / Indicators).

    Data sources:
    - energy_use: OEE NEUD (R,C,I,T,A) from five sector XLS URLs; Primary (P,NPC,FK,EL) from local Excel.
    """

    SECTION_KEY = "section4_indicators"
    SECTION_NAME = "Energy Efficiency"
    SECTION_ID = 4

    OEE_NEUD_VECTORS = ['R', 'C', 'I', 'T', 'A', 'P', 'NPC', 'FK', 'EL']

    def get_source_handlers(self) -> Dict[str, callable]:
        return {
            'energy_use': self._process_energy_use,
            'seu_by_fuel': self._process_seu_by_fuel,
            'residential_daily_lives': self._process_residential_daily_lives,
            'residential_pie_charts': self._process_residential_pie_charts,
            'commercial_institutional': self._process_commercial_institutional,
        }

    def _resolve_path(self, path_str: str, base_dir: Path) -> Path:
        p = Path(path_str)
        if not p.is_absolute():
            p = base_dir / path_str
        return p

    def _fetch_xls_bytes(self, url: str) -> Optional[bytes]:
        """Download XLS from URL; return content bytes or None on failure."""
        try:
            r = requests.get(url, timeout=REQUEST_TIMEOUT)
            r.raise_for_status()
            return r.content
        except Exception as e:
            print(f"    Failed to fetch {url}: {e}")
            return None

    def _fetch_sector_xls_from_zip(self, zip_url: str, sector_key: str) -> Optional[bytes]:
        """Download a sector comprehensive ZIP and return the single XLS file bytes (e.g. res_ca_e.xls)."""
        try:
            r = requests.get(zip_url, timeout=REQUEST_TIMEOUT)
            r.raise_for_status()
        except Exception as e:
            print(f"    Failed to fetch sector {sector_key} ZIP: {e}")
            return None
        try:
            with zipfile.ZipFile(io.BytesIO(r.content), 'r') as zf:
                for name in zf.namelist():
                    if name.endswith('.xls'):
                        return zf.read(name)
        except Exception as e:
            print(f"    Failed to read sector {sector_key} ZIP: {e}")
            return None
        print(f"    Sector {sector_key} ZIP: no XLS file in archive")
        return None

    def _find_total_energy_use_row(self, df: pd.DataFrame, max_rows: int, max_cols: int) -> Tuple[Optional[int], Optional[int]]:
        """Return (row_idx, col_idx) of cell containing 'Total Energy Use (PJ)' or (None, None)."""
        target_lower = "total energy use (pj)"
        for r in range(min(df.shape[0], max_rows)):
            for c in range(min(df.shape[1], max_cols)):
                val = df.iloc[r, c]
                if pd.isna(val):
                    continue
                if target_lower in str(val).lower():
                    return r, c
                if "total energy use" in str(val).lower() and "pj" in str(val).lower():
                    return r, c
        return None, None

    def _parse_oee_sector_xls(self, content: bytes, sector_key: str) -> Dict[int, float]:
        """
        Parse one OEE NEUD Table 1 XLS (e.g. res_ca_e_1.xls). Find "Total Energy Use (PJ)" and year columns/rows.
        Industrial agg_ca_e.xls has multiple sheets; Table 1 is sheet "Table 1" (index 1), not sheet 0 (Menu).
        Returns {year: total_pj}.
        """
        out: Dict[int, float] = {}
        try:
            xls = pd.ExcelFile(io.BytesIO(content), engine='xlrd')
        except Exception as e:
            print(f"    Failed to read sector {sector_key} XLS: {e}")
            return out
        # Try sheets in order: 0, then "Table 1" / 1 (for industrial multi-sheet workbook)
        sheet_order: List[Any] = [0]
        if "Table 1" in xls.sheet_names:
            sheet_order.append("Table 1")
        if 1 < len(xls.sheet_names):
            sheet_order.append(1)
        df = None
        for sh in sheet_order:
            try:
                df = pd.read_excel(xls, sheet_name=sh, header=None)
            except Exception:
                continue
            row_idx, col_idx = self._find_total_energy_use_row(df, 30, 30)
            if row_idx is not None:
                break
        if df is None or row_idx is None:
            print(f"    Sector {sector_key}: could not find 'Total Energy Use (PJ)' row")
            return out
        # Years are usually in the first row (header) or first column. OEE tables: years as columns.
        # Res/Com/Tran/Agr Table 1 often have years as floats (2000.0); accept numeric or 4-digit string.
        def to_year(cell):
            if pd.isna(cell):
                return None
            try:
                n = float(cell)
                if 1990 <= n <= 2030:
                    return int(n)
            except (ValueError, TypeError):
                pass
            s = str(cell).strip()
            if re.match(r'^(19|20)\d{2}$', s):
                return int(s)
            return None

        check_rows = [0, 1, row_idx - 1, row_idx - 2]
        for check_row in check_rows:
            if check_row < 0:
                continue
            for c in range(col_idx + 1, df.shape[1]):
                cell = df.iloc[check_row, c]
                year = to_year(cell)
                if year is not None:
                    val_cell = df.iloc[row_idx, c]
                    if pd.notna(val_cell):
                        try:
                            out[year] = float(val_cell)
                        except (ValueError, TypeError):
                            pass
        # If no years found in columns, try years in first column and value in row_idx
        if not out and row_idx < df.shape[0]:
            for c in range(df.shape[1]):
                if c == col_idx:
                    continue
                val_cell = df.iloc[row_idx, c]
                if pd.isna(val_cell):
                    continue
                try:
                    v = float(val_cell)
                except (ValueError, TypeError):
                    continue
                # Check header row for year
                for hrow in [0, 1]:
                    if hrow >= df.shape[0]:
                        continue
                    cell = df.iloc[hrow, c]
                    year = to_year(cell)
                    if year is not None:
                        out[year] = v
                        break
        return out

    def _fetch_oee_by_year(self) -> Dict[int, Dict[str, float]]:
        """Download all five sector XLS from comprehensive ZIPs, parse Total Energy Use (PJ) by year."""
        by_year: Dict[int, Dict[str, float]] = {}
        for sector, zip_url in OEE_NEUD_ZIP_URLS.items():
            content = self._fetch_sector_xls_from_zip(zip_url, sector)
            if not content:
                continue
            series = self._parse_oee_sector_xls(content, sector)
            for y, pj in series.items():
                if y not in by_year:
                    by_year[y] = {}
                by_year[y][sector] = pj
        return by_year

    def _get_primary_demand_path(self, energy_cfg: Dict[str, Any]) -> Path:
        """Resolve Primary Energy Use Demand file: config override or default dir / DEFAULT_PRIMARY_DEMAND_FILENAME."""
        primary_path = energy_cfg.get('primary_demand_file_path') or energy_cfg.get('primary_demand_path')
        xlsx_base = default_xlsx_base_dir()
        if primary_path and str(primary_path).strip():
            return self._resolve_path(primary_path.strip(), xlsx_base)
        return xlsx_base / DEFAULT_PRIMARY_DEMAND_FILENAME

    def _find_year_col(self, df: pd.DataFrame) -> str:
        return self.get_column(df, 'ref_date', 'REF_DATE', 'year', 'Year', 'YEAR')

    # Primary demand: map product/category names (long format) to vectors.
    # Match longer phrases first; avoid single-char 'p' so "Noncovered producer consumption" doesn't match P.
    PRIMARY_PRODUCT_TO_VEC = {
        'P': ['pipeline'],
        'NPC': ['non-energy (feedstock)', 'non-energy', 'non-energy use', 'nonenergy', 'feedstock'],
        'FK': ['noncovered producer consumption', 'non-covered producer consumption', 'non-covered', 'noncovered', 'producer consumption'],
        'EL': ['energy losses (conversion)', 'energy losses', 'losses', 'el'],
    }

    def _load_primary_demand(self, file_path: Path) -> Dict[int, Dict[str, float]]:
        """
        Load Primary Energy Use Demand from a single-sheet Excel with columns YEAR, PRODUCT, VALUE.
        Maps product names (Pipeline, Non-energy (feedstock), etc.) to vectors P, NPC, FK, EL.
        """
        by_year: Dict[int, Dict[str, float]] = {}
        df = pd.read_excel(file_path, sheet_name=0)
        df.columns = [str(c).strip() for c in df.columns]
        year_col = self._find_year_col(df)
        product_col = self.get_column(df, 'product', 'PRODUCT', 'category', 'Category')
        value_col = self.get_column(df, 'value', 'VALUE', 'amount', 'val')
        if not year_col or not product_col or not value_col:
            return by_year
        for _, row in df.iterrows():
            try:
                y = row[year_col]
                if pd.isna(y):
                    continue
                year_int = int(float(y))
            except (ValueError, TypeError):
                continue
            prod = row.get(product_col)
            if pd.isna(prod):
                continue
            prod_str = str(prod).strip().lower()
            vec = None
            for v, keywords in self.PRIMARY_PRODUCT_TO_VEC.items():
                if any(kw in prod_str or prod_str in kw for kw in keywords):
                    vec = v
                    break
            if vec is None:
                continue
            try:
                val = float(row[value_col])
            except (ValueError, TypeError):
                continue
            if year_int not in by_year:
                by_year[year_int] = {}
            by_year[year_int][vec] = val
        return by_year

    def _process_energy_use(self) -> int:
        """
        Extract from OEE NEUD (five sector XLS URLs) and Primary Energy Use Demand (local Excel),
        write to nrcan_fb_s4_energy_use and per-source ingest tables, then export to data.csv.
        """
        section_cfg = self.config.sections.get(self.SECTION_KEY, {})
        sources_cfg = section_cfg.get('sources', {})
        energy_cfg = sources_cfg.get('energy_use', {}) or {}
        print("  Fetching OEE NEUD sector tables (R,C,I,T,A)...")
        oee_by_year = self._fetch_oee_by_year()
        if not oee_by_year:
            print("    energy_use: could not load any OEE NEUD sector data from URLs")
            return 0
        for sector in ['R', 'C', 'I', 'T', 'A']:
            years_with = sum(1 for d in oee_by_year.values() if sector in d)
            print(f"    Sector {sector}: {years_with} years")
        path_primary = self._get_primary_demand_path(energy_cfg)
        primary_by_year: Dict[int, Dict[str, float]] = {}
        if path_primary.exists():
            primary_by_year = self._load_primary_demand(path_primary)
            vecs = set()
            for d in primary_by_year.values():
                vecs.update(d.keys())
            print(f"    Primary: {len(primary_by_year)} years, vectors: {', '.join(sorted(vecs)) or 'none'}")
        else:
            print(f"    Primary file not found: {path_primary}")
            print(f"    Place '{DEFAULT_PRIMARY_DEMAND_FILENAME}' in EXTERNAL_XLSX_DATA_DIR or set primary_demand_file_path in config.")
            return 0
        if not primary_by_year:
            print("    Primary Energy Use Demand file is empty or has no recognized columns.")
            return 0
        print("  Merging OEE NEUD with Primary Energy Use Demand...")
        if primary_by_year:
            all_years = sorted(set(oee_by_year) & set(primary_by_year))
        else:
            all_years = sorted(oee_by_year.keys())
        data_rows: List[Tuple[str, str, float]] = []
        calc_data: List[Dict[str, Any]] = []
        for year in all_years:
            o = oee_by_year.get(year, {})
            p = primary_by_year.get(year, {}) if primary_by_year else {}
            row = {**o, **p}
            # Fill any missing vector with 0 so we can output the year (e.g. EL missing in Primary file)
            for k in self.OEE_NEUD_VECTORS:
                if k not in row:
                    row[k] = 0.0
            if not all(k in row for k in self.OEE_NEUD_VECTORS):
                continue
            year_str = str(year)
            for vec in self.OEE_NEUD_VECTORS:
                data_rows.append((f'oee_neud_{vec}', year_str, round(float(row[vec]), 2)))
            calc_data.append({
                'year': year,
                'R': round(float(row['R']), 2), 'C': round(float(row['C']), 2),
                'I': round(float(row['I']), 2), 'T': round(float(row['T']), 2), 'A': round(float(row['A']), 2),
                'P': round(float(row['P']), 2), 'NPC': round(float(row['NPC']), 2),
                'FK': round(float(row['FK']), 2), 'EL': round(float(row['EL']), 2),
            })
        if not data_rows:
            print("    No complete year rows (need all 9 vectors per year)")
            return 0
        source_org = 'Natural Resources Canada (OEE)'
        source_url = 'https://oee.nrcan.gc.ca/corporate/statistics/neud/dpa/data_e.html'
        metadata_rows = [
            ('oee_neud_R', 'Energy use - Residential', 'PJ', 'petajoules', source_org, source_url),
            ('oee_neud_C', 'Energy use - Commercial', 'PJ', 'petajoules', source_org, source_url),
            ('oee_neud_I', 'Energy use - Industrial', 'PJ', 'petajoules', source_org, source_url),
            ('oee_neud_T', 'Energy use - Transportation', 'PJ', 'petajoules', source_org, source_url),
            ('oee_neud_A', 'Energy use - Agriculture', 'PJ', 'petajoules', source_org, source_url),
            ('oee_neud_P', 'Energy use - Pipeline', 'PJ', 'petajoules', source_org, source_url),
            ('oee_neud_NPC', 'Energy use - Non-energy (feedstock)', 'PJ', 'petajoules', source_org, source_url),
            ('oee_neud_FK', 'Energy use - Non-covered producer/consumption', 'PJ', 'petajoules', source_org, source_url),
            ('oee_neud_EL', 'Energy use - Energy losses', 'PJ', 'petajoules', source_org, source_url),
        ]
        self.repo.clear_raw_data('energy_use')
        n = self.store_raw_data('energy_use', data_rows, metadata_rows)
        if calc_data:
            self.repo.upsert_energy_use(calc_data)
        print(f"    Stored {n} rows in ingest tables + nrcan_fb_s4_energy_use ({len(all_years)} years)")
        return n

    def _open_oee_residential_analysis_workbook(self, content: bytes) -> Optional[pd.ExcelFile]:
        """Try openpyxl (xlsx) then xlrd (xls); OEE may serve either format."""
        for eng in ("openpyxl", "xlrd", None):
            try:
                return pd.ExcelFile(io.BytesIO(content), engine=eng)
            except Exception:
                continue
        return None

    def _merge_residential_oee_year_dicts(
        self,
        base: Dict[int, Dict[str, float]],
        add: Dict[int, Dict[str, float]],
    ) -> Dict[int, Dict[str, float]]:
        """Fill missing ter/eee/space/water per year (later sources only fill gaps)."""
        keys = ("ter", "eee", "space_heating_pj", "water_heating_pj")
        for year, row in add.items():
            if year not in base:
                base[year] = {}
            for k in keys:
                v = row.get(k)
                if v is not None and base[year].get(k) is None:
                    base[year][k] = v
        return base

    def _parse_oee_residential_analysis_xls(self, content: bytes) -> Dict[int, Dict[str, float]]:
        """
        Parse OEE Residential Sector Energy Use Analysis XLS/XLSX.
        Extracts by year: Total Energy Use (PJ)=ter, Energy Efficiency Effect=eee,
        Space Heating, Water Heating (from Total Residential section).
        Returns {year: {'ter': v, 'eee': v, 'space_heating_pj': v, 'water_heating_pj': v}}.
        EEE in source is negative (savings); we store as positive.
        """
        merged: Dict[int, Dict[str, float]] = {}
        xls = self._open_oee_residential_analysis_workbook(content)
        if xls is None:
            print("    Failed to read Residential Analysis workbook (openpyxl/xlrd)")
            return merged

        def to_year(cell):
            if pd.isna(cell):
                return None
            try:
                n = float(cell)
                if 1990 <= n <= 2030:
                    return int(n)
            except (ValueError, TypeError):
                pass
            s = str(cell).strip().replace(',', '')
            if re.match(r'^(19|20)\d{2}$', s):
                return int(s)
            return None

        def to_float(cell):
            if pd.isna(cell):
                return None
            try:
                return float(str(cell).replace(",", "").replace("\u2212", "-"))
            except (ValueError, TypeError):
                return None

        for sheet_name in xls.sheet_names:
            sheet_out: Dict[int, Dict[str, float]] = {}
            try:
                df = pd.read_excel(xls, sheet_name=sheet_name, header=None)
            except Exception:
                continue
            if df.shape[0] < 5 or df.shape[1] < 2:
                continue
            header_row = None
            for r in range(min(8, df.shape[0])):
                for c in range(1, min(df.shape[1], 40)):
                    cell = df.iloc[r, c]
                    y = to_year(cell)
                    if y is not None:
                        header_row = r
                        break
                if header_row is not None:
                    break
            if header_row is None:
                continue
            year_cols = {}
            for c in range(1, df.shape[1]):
                cell = df.iloc[header_row, c]
                y = to_year(cell)
                if y is not None:
                    year_cols[c] = y
            if not year_cols:
                continue
            row_labels_seen = set()
            for r in range(header_row + 1, min(df.shape[0], 150)):
                cell0 = df.iloc[r, 0]
                if pd.isna(cell0):
                    continue
                label = str(cell0).strip().lower().replace("\n", " ")
                if not label:
                    continue

                key = None
                if _residential_label_ter(label) and "ter" not in row_labels_seen:
                    key = "ter"
                    row_labels_seen.add("ter")
                elif _residential_label_eee(label) and "eee" not in row_labels_seen:
                    key = "eee"
                    row_labels_seen.add("eee")
                elif _residential_label_space(label) and "space_heating_pj" not in row_labels_seen:
                    key = "space_heating_pj"
                    row_labels_seen.add("space_heating_pj")
                elif _residential_label_water(label) and "water_heating_pj" not in row_labels_seen:
                    key = "water_heating_pj"
                    row_labels_seen.add("water_heating_pj")
                if key is None:
                    continue
                for c, year in year_cols.items():
                    v = to_float(df.iloc[r, c])
                    if v is not None:
                        if year not in sheet_out:
                            sheet_out[year] = {}
                        val = round(abs(v), 2) if key == "eee" else round(v, 2)
                        sheet_out[year][key] = val
            self._merge_residential_oee_year_dicts(merged, sheet_out)
        return merged

    def _parse_oee_residential_analysis_html_table(self, table) -> Dict[int, Dict[str, float]]:
        """Parse one OEE AN HTML table; return {year: {ter, eee, space_heating_pj, water_heating_pj}}."""
        out: Dict[int, Dict[str, float]] = {}
        rows = table.find_all('tr')
        if len(rows) < 2:
            return out

        def to_year(cell_text):
            s = (cell_text or "").strip().replace(",", "")
            try:
                n = int(float(s))
                if 1990 <= n <= 2030:
                    return n
            except (ValueError, TypeError):
                pass
            if re.match(r"^(19|20)\d{2}$", s):
                return int(s)
            return None

        def to_float(cell_text):
            if not cell_text:
                return None
            try:
                return float(str(cell_text).strip().replace(",", "").replace("\u2212", "-"))
            except (ValueError, TypeError):
                return None

        year_cols = {}
        data_start = 0
        best_count = 0
        for header_row_idx in range(min(6, len(rows))):
            cells = rows[header_row_idx].find_all(["th", "td"])
            cols = {}
            for i in range(1, min(len(cells), 40)):
                y = to_year(cells[i].get_text())
                if y is not None:
                    cols[i] = y
            if len(cols) > best_count:
                best_count = len(cols)
                year_cols = cols
                data_start = header_row_idx + 1
        if not year_cols:
            return out

        found = set()
        for r in rows[data_start:]:
            cells = r.find_all(["th", "td"])
            if len(cells) <= 1:
                continue
            label = (cells[0].get_text() or "").strip().lower().replace("\n", " ")
            if not label:
                continue
            key = None
            if _residential_label_ter(label) and "ter" not in found:
                key = "ter"
                found.add("ter")
            elif _residential_label_eee(label) and "eee" not in found:
                key = "eee"
                found.add("eee")
            elif _residential_label_space(label) and "space_heating_pj" not in found:
                key = "space_heating_pj"
                found.add("space_heating_pj")
            elif _residential_label_water(label) and "water_heating_pj" not in found:
                key = "water_heating_pj"
                found.add("water_heating_pj")
            if key is None:
                continue
            for i, year in year_cols.items():
                if i < len(cells):
                    v = to_float(cells[i].get_text())
                    if v is not None:
                        if year not in out:
                            out[year] = {}
                        out[year][key] = round(abs(v), 2) if key == "eee" else round(v, 2)
        return out

    def _parse_oee_residential_analysis_html(self, html: str) -> Dict[int, Dict[str, float]]:
        """Parse OEE Residential Analysis HTML; merge all tables that look like AN data."""
        merged: Dict[int, Dict[str, float]] = {}
        soup = BeautifulSoup(html, "html.parser")
        for table in soup.find_all("table"):
            part = self._parse_oee_residential_analysis_html_table(table)
            if part:
                self._merge_residential_oee_year_dicts(merged, part)
        return merged

    def _parse_oee_html_table_generic(
        self,
        html: str,
        row_to_vector: List[Tuple[str, str, Optional[List[str]]]],
    ) -> Dict[int, Dict[str, float]]:
        """
        Parse an OEE HTML table: find year columns from header rows, then for each data row
        whose first cell matches one of row_to_vector (label_substring, vector_name, optional_exclude).
        If optional_exclude is given and any of its strings is in label, skip that row.
        """
        out: Dict[int, Dict[str, float]] = {}
        soup = BeautifulSoup(html, "html.parser")
        table = soup.find("table")
        if not table:
            return out
        rows = table.find_all("tr")
        if len(rows) < 2:
            return out

        def to_year(cell_text: str):
            s = (cell_text or "").strip().replace(",", "")
            try:
                n = int(float(s))
                if 1990 <= n <= 2030:
                    return n
            except (ValueError, TypeError):
                pass
            if re.match(r"^(19|20)\d{2}$", s):
                return int(s)
            return None

        def to_float(cell_text: str):
            if not cell_text:
                return None
            s = str(cell_text).strip().replace(",", "").replace("\u2212", "-")
            try:
                return float(s)
            except (ValueError, TypeError):
                return None

        # Find the header row that has the most year-like cells (robust to colspan on title row)
        year_cols: Dict[int, int] = {}
        data_start_idx = 0
        best_count = 0
        for header_row_idx in range(min(5, len(rows))):
            cells = rows[header_row_idx].find_all(["th", "td"])
            count = 0
            cols: Dict[int, int] = {}
            for i in range(1, min(len(cells), 35)):
                if i >= len(cells):
                    break
                y = to_year(cells[i].get_text())
                if y is not None:
                    cols[i] = y
                    count += 1
            if count > best_count:
                best_count = count
                year_cols = cols
                data_start_idx = header_row_idx + 1
        if not year_cols:
            return out

        for r in rows[data_start_idx:]:
            cells = r.find_all(["th", "td"])
            if len(cells) <= 1:
                continue
            label = (cells[0].get_text() or "").strip().lower().replace("\n", " ").replace("\u2212", "-")
            if not label:
                continue
            for item in row_to_vector:
                label_sub = item[0]
                vec = item[1]
                exclude = item[2] if len(item) > 2 else None
                if exclude and any(ex in label for ex in exclude):
                    continue
                if label_sub in label:
                    for col_idx, year in year_cols.items():
                        if col_idx < len(cells):
                            v = to_float(cells[col_idx].get_text())
                            if v is not None:
                                if year not in out:
                                    out[year] = {}
                                if vec not in out[year]:
                                    out[year][vec] = round(v, 2)
                    break
        return out

    def _merge_by_year(
        self, *dicts: Dict[int, Dict[str, float]]
    ) -> Dict[int, Dict[str, float]]:
        merged: Dict[int, Dict[str, float]] = {}
        for d in dicts:
            for year, row in d.items():
                if year not in merged:
                    merged[year] = {}
                for k, v in row.items():
                    merged[year][k] = v
        return merged

    def _process_residential_pie_charts(self) -> int:
        """
        Fetch OEE HB (residential by end-use), Table 7 (space heating by source),
        Table 14 (water heating by source). Output vectors for page 51 pie charts.
        """
        data_rows: List[Tuple[str, str, float]] = []
        merged_hb: Dict[int, Dict[str, float]] = {}
        hb_row_mappings = [
            ("total energy use (pj)", "res_reu_total", None),
            ("space heating", "res_reu_space_heating", None),
            ("water heating", "res_reu_water_heating", None),
            ("appliances", "res_appliances_pj", ["major", "other appliances"]),
            ("lighting", "res_lighting_pj", None),
            ("space cooling", "res_space_cooling_pj", None),
        ]
        for url in OEE_HB_PAGES:
            try:
                r = requests.get(url, timeout=REQUEST_TIMEOUT)
                r.raise_for_status()
                parsed = self._parse_oee_html_table_generic(r.text, hb_row_mappings)
                for year, row in parsed.items():
                    for k, v in row.items():
                        merged_hb.setdefault(year, {})[k] = v
            except Exception as e:
                print(f"    Failed to fetch HB page {url}: {e}")
        for year in sorted(merged_hb.keys()):
            for vec, val in merged_hb[year].items():
                data_rows.append((vec, str(year), val))

        merged_t7: Dict[int, Dict[str, float]] = {}
        for url in OEE_TABLE7_PAGES:
            try:
                r = requests.get(url, timeout=REQUEST_TIMEOUT)
                r.raise_for_status()
                parsed = self._parse_oee_html_table_generic(
                    r.text,
                    [
                        ("total space heating energy use (pj)", "res_sh_total", None),
                        ("electricity", "res_sh_ele", None),
                        ("natural gas", "res_sh_ng", None),
                        ("heating oil", "res_sh_ho", None),
                        ("other", "res_sh_ot", None),
                        ("wood", "res_sh_wd", None),
                    ],
                )
                for year, row in parsed.items():
                    for k, v in row.items():
                        merged_t7.setdefault(year, {})[k] = v
            except Exception as e:
                print(f"    Failed to fetch Table 7 page {url}: {e}")
        for year in sorted(merged_t7.keys()):
            for vec, val in merged_t7[year].items():
                data_rows.append((vec, str(year), val))

        merged_t14: Dict[int, Dict[str, float]] = {}
        for url in OEE_TABLE14_PAGES:
            try:
                r = requests.get(url, timeout=REQUEST_TIMEOUT)
                r.raise_for_status()
                parsed = self._parse_oee_html_table_generic(
                    r.text,
                    [
                        ("total water heating energy use (pj)", "res_wh_total", None),
                        ("electricity", "res_wh_ele", None),
                        ("natural gas", "res_wh_ng", None),
                        ("heating oil", "res_wh_ho", None),
                        ("other", "res_wh_ot", None),
                        ("wood", "res_wh_wd", None),
                    ],
                )
                for year, row in parsed.items():
                    for k, v in row.items():
                        merged_t14.setdefault(year, {})[k] = v
            except Exception as e:
                print(f"    Failed to fetch Table 14 page {url}: {e}")
        for year in sorted(merged_t14.keys()):
            for vec, val in merged_t14[year].items():
                data_rows.append((vec, str(year), val))

        if not data_rows:
            print("    No residential_pie_charts rows produced")
            return 0
        source_org = "Natural Resources Canada (OEE)"
        metadata_rows = [
            ("res_reu_total", "Residential total energy use (PJ) from HB table", "PJ", "petajoules", source_org, OEE_HB_PAGES[0]),
            ("res_reu_space_heating", "Residential space heating (PJ) from HB table", "PJ", "petajoules", source_org, OEE_HB_PAGES[0]),
            ("res_reu_water_heating", "Residential water heating (PJ) from HB table", "PJ", "petajoules", source_org, OEE_HB_PAGES[0]),
            ("res_appliances_pj", "Residential appliances energy use (PJ)", "PJ", "petajoules", source_org, OEE_HB_PAGES[0]),
            ("res_lighting_pj", "Residential lighting energy use (PJ)", "PJ", "petajoules", source_org, OEE_HB_PAGES[0]),
            ("res_space_cooling_pj", "Residential space cooling energy use (PJ)", "PJ", "petajoules", source_org, OEE_HB_PAGES[0]),
            ("res_sh_total", "Total space heating energy use (PJ) from Table 7", "PJ", "petajoules", source_org, OEE_TABLE7_PAGES[0]),
            ("res_sh_ele", "Space heating electricity (PJ)", "PJ", "petajoules", source_org, OEE_TABLE7_PAGES[0]),
            ("res_sh_ng", "Space heating natural gas (PJ)", "PJ", "petajoules", source_org, OEE_TABLE7_PAGES[0]),
            ("res_sh_ho", "Space heating heating oil (PJ)", "PJ", "petajoules", source_org, OEE_TABLE7_PAGES[0]),
            ("res_sh_ot", "Space heating other (PJ)", "PJ", "petajoules", source_org, OEE_TABLE7_PAGES[0]),
            ("res_sh_wd", "Space heating wood (PJ)", "PJ", "petajoules", source_org, OEE_TABLE7_PAGES[0]),
            ("res_wh_total", "Total water heating energy use (PJ) from Table 14", "PJ", "petajoules", source_org, OEE_TABLE14_PAGES[0]),
            ("res_wh_ele", "Water heating electricity (PJ)", "PJ", "petajoules", source_org, OEE_TABLE14_PAGES[0]),
            ("res_wh_ng", "Water heating natural gas (PJ)", "PJ", "petajoules", source_org, OEE_TABLE14_PAGES[0]),
            ("res_wh_ho", "Water heating heating oil (PJ)", "PJ", "petajoules", source_org, OEE_TABLE14_PAGES[0]),
            ("res_wh_ot", "Water heating other (PJ)", "PJ", "petajoules", source_org, OEE_TABLE14_PAGES[0]),
            ("res_wh_wd", "Water heating wood (PJ)", "PJ", "petajoules", source_org, OEE_TABLE14_PAGES[0]),
        ]
        self.repo.clear_raw_data("residential_pie_charts")
        n = self.store_raw_data("residential_pie_charts", data_rows, metadata_rows)
        print(f"    Stored {n} rows for residential_pie_charts")
        return n

    def _fetch_oee_residential_analysis(self) -> Dict[int, Dict[str, float]]:
        """
        Fetch OEE Residential Analysis (XLS/XLSX and AN HTML pages).
        Always merges HTML after XLS so missing EEE/rows from an incomplete XLS parse are filled.
        """
        merged: Dict[int, Dict[str, float]] = {}
        try:
            r = requests.get(OEE_RESIDENTIAL_ANALYSIS_XLS, timeout=REQUEST_TIMEOUT)
            r.raise_for_status()
            parsed = self._parse_oee_residential_analysis_xls(r.content)
            self._merge_residential_oee_year_dicts(merged, parsed)
            if parsed:
                print(f"    OEE Residential XLS: parsed {len(parsed)} year rows")
        except Exception as e:
            print(f"    OEE Residential XLS not available ({e}); will use HTML / generic table parse")

        for url in OEE_RESIDENTIAL_ANALYSIS_PAGES:
            try:
                r = requests.get(url, timeout=REQUEST_TIMEOUT)
                r.raise_for_status()
                text = r.text
                parsed = self._parse_oee_residential_analysis_html(text)
                self._merge_residential_oee_year_dicts(merged, parsed)
                # Substring-based fallback (different table markup / wording on some pages)
                generic = self._parse_oee_html_table_generic(
                    text,
                    [
                        ("total energy use (pj)", "ter", None),
                        ("total energy requirements (pj)", "ter", None),
                        ("energy efficiency effect (pj)", "eee", None),
                        ("energy efficiency effect", "eee", None),
                        ("efficiency effect (pj)", "eee", None),
                        ("space heating", "space_heating_pj", ["water heating", "share"]),
                        ("water heating", "water_heating_pj", ["space heating", "share"]),
                    ],
                )
                self._merge_residential_oee_year_dicts(merged, generic)
            except Exception as e2:
                print(f"    Failed to fetch {url}: {e2}")
        return merged

    def _process_residential_daily_lives(self) -> int:
        """
        Extract from OEE Residential Analysis (TEr, EEE, space heating, water heating by year)
        and EE Improvement.xlsx (EE Improvement sheet: improvement %, savings PJ, $B; optional Residential sheet override).
        Outputs res_ter, res_eee, res_space_heating_pj, res_water_heating_pj from OEE; res_ee_improvement_pct,
        res_ee_savings_pj, res_ee_savings_billion from EE Improvement sheet.
        """
        section_cfg = self.config.sections.get(self.SECTION_KEY, {})
        sources_cfg = section_cfg.get('sources', {})
        res_cfg = sources_cfg.get('residential_daily_lives', {}) or {}
        base_dir = default_xlsx_base_dir()
        path_str = (res_cfg.get('ee_improvement_file_path') or '').strip()
        if path_str:
            path = self._resolve_path(path_str, base_dir)
        else:
            path = base_dir / "EE Improvement.xlsx"
        data_rows: List[Tuple[str, str, float]] = []
        print("    Fetching OEE Residential Analysis (TEr, EEE, space heating, water heating)...")
        oee_by_year = self._fetch_oee_residential_analysis()
        if oee_by_year:
            for year, d in sorted(oee_by_year.items()):
                year_str = str(year)
                if d.get('ter') is not None:
                    data_rows.append(('res_ter', year_str, d['ter']))
                if d.get('eee') is not None:
                    data_rows.append(('res_eee', year_str, round(abs(float(d['eee'])), 2)))
                if d.get('space_heating_pj') is not None:
                    data_rows.append(('res_space_heating_pj', year_str, d['space_heating_pj']))
                if d.get('water_heating_pj') is not None:
                    data_rows.append(('res_water_heating_pj', year_str, d['water_heating_pj']))
            print(f"    OEE Residential: {len(oee_by_year)} years")
        if path.exists():
            ee_year = 2022
            try:
                df_ee = pd.read_excel(path, sheet_name="EE Improvement")
            except Exception as e:
                print(f"    Failed to read sheet EE Improvement: {e}")
                df_ee = pd.DataFrame()
            if not df_ee.empty:
                df_ee.columns = [str(c).strip() for c in df_ee.columns]
                sector_col = self.get_column(df_ee, 'sector', 'SECTOR', 'Sector', 'sectors')
                metric_col = self.get_column(df_ee, 'metric', 'METRIC', 'Metric', 'metric name', 'metric_name', 'indicator')
                uom_col = self.get_column(df_ee, 'uom', 'UOM', 'Uom', 'unit', 'units')
                value_col = self.get_column(df_ee, 'value', 'VALUE', 'Value', 'val', 'amount', 'data')
                year_col = self.get_column(df_ee, 'year', 'YEAR', 'Year', 'end_year', 'ref_date', 'end year')
                if sector_col and metric_col and value_col:
                    res = df_ee[df_ee[sector_col].astype(str).str.strip().str.lower() == 'residential']
                    for _, row in res.iterrows():
                        metric = str(row.get(metric_col, '')).strip().lower()
                        uom = str(row.get(uom_col, '')).strip().lower() if uom_col else ''
                        try:
                            val = float(row[value_col])
                        except (TypeError, ValueError):
                            continue
                        if year_col and pd.notna(row.get(year_col)):
                            try:
                                ee_year = int(float(row[year_col]))
                            except (TypeError, ValueError):
                                pass
                        if 'improvement' in metric:
                            data_rows.append(('res_ee_improvement_pct', str(ee_year), round(val, 2)))
                        elif 'energy savings' in metric or 'savings' in metric:
                            if 'pj' in uom or uom == 'pj':
                                data_rows.append(('res_ee_savings_pj', str(ee_year), round(val, 2)))
                            elif 'billion' in uom or '$' in uom:
                                data_rows.append(('res_ee_savings_billion', str(ee_year), round(val, 2)))
            try:
                df_res = pd.read_excel(path, sheet_name="Residential")
            except Exception:
                df_res = pd.DataFrame()
            if not df_res.empty:
                df_res.columns = [str(c).strip() for c in df_res.columns]
                year_col = self.get_column(df_res, 'year', 'YEAR', 'Year', 'ref_date', 'REF_DATE')
                ter_col = self.get_column(df_res, 'ter', 'total_energy_use_pj', 'total energy use (pj)', 'Total Energy Use (PJ)', 'total (pj)', 'Total (PJ)', 'total_energy_pj')
                eee_col = self.get_column(
                    df_res,
                    'eee',
                    'EEE',
                    'energy_efficiency_effect',
                    'energy efficiency effect',
                    'energy efficiency effect (pj)',
                    'efficiency effect (pj)',
                    'Energy Efficiency Effect (PJ)',
                )
                sh_col = self.get_column(df_res, 'space_heating_pj', 'space_heating', 'Space Heating (PJ)', 'space heating', 'space heating (pj)', 'space heating (PJ)')
                wh_col = self.get_column(df_res, 'water_heating_pj', 'water_heating', 'Water Heating (PJ)', 'water heating', 'water heating (pj)', 'water heating (PJ)')
                if year_col:
                    for _, row in df_res.iterrows():
                        try:
                            y = int(float(row[year_col]))
                        except (TypeError, ValueError):
                            continue
                        year_str = str(y)
                        if ter_col and pd.notna(row.get(ter_col)):
                            try:
                                data_rows.append(('res_ter', year_str, round(float(row[ter_col]), 2)))
                            except (TypeError, ValueError):
                                pass
                        if eee_col and pd.notna(row.get(eee_col)):
                            try:
                                data_rows.append(('res_eee', year_str, round(abs(float(row[eee_col])), 2)))
                            except (TypeError, ValueError):
                                pass
                        if sh_col and pd.notna(row.get(sh_col)):
                            try:
                                data_rows.append(('res_space_heating_pj', year_str, round(float(row[sh_col]), 2)))
                            except (TypeError, ValueError):
                                pass
                        if wh_col and pd.notna(row.get(wh_col)):
                            try:
                                data_rows.append(('res_water_heating_pj', year_str, round(float(row[wh_col]), 2)))
                            except (TypeError, ValueError):
                                pass
        else:
            print(f"    EE Improvement file not found: {path}")
        if not data_rows:
            print("    No residential_daily_lives rows produced")
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
        self.repo.clear_raw_data('residential_daily_lives')
        n = self.store_raw_data('residential_daily_lives', data_rows, metadata_rows)
        print(f"    Stored {n} rows for residential_daily_lives")
        return n

    def _process_commercial_institutional(self) -> int:
        """
        Scrape Commercial/Institutional data for page 52.
        - HB tables: Total Energy Use, end use (Space Heating, Water Heating, Auxiliary Equipment,
          Auxiliary Motors, Lighting, Space Cooling), Energy Intensity.
        - AN tables: Energy Efficiency Effect.
        - EE Improvement.xlsx (EE Improvement sheet): Commercial sector improvement %, savings PJ, $ billion.
        Outputs com_teu_cieu, com_sh, com_wh, com_ae, com_am, com_lt, com_sc, com_ei, com_eee,
        com_ee_improvement_pct, com_ee_savings_pj, com_ee_savings_billion.
        """
        data_rows: List[Tuple[str, str, float]] = []
        merged_hb: Dict[int, Dict[str, float]] = {}
        hb_row_mappings = [
            ("total energy use (pj)", "com_teu_cieu", None),
            ("space heating", "com_sh", ["street"]),
            ("water heating", "com_wh", ["street"]),
            ("auxiliary equipment", "com_ae", None),
            ("auxiliary motors", "com_am", None),
            ("lighting", "com_lt", ["street"]),
            ("space cooling", "com_sc", ["street"]),
            ("energy intensity", "com_ei", ["street"]),
        ]
        for url in OEE_COM_HB_PAGES:
            try:
                r = requests.get(url, timeout=REQUEST_TIMEOUT)
                r.raise_for_status()
                parsed = self._parse_oee_html_table_generic(r.text, hb_row_mappings)
                for year, row in parsed.items():
                    for k, v in row.items():
                        merged_hb.setdefault(year, {})[k] = v
            except Exception as e:
                print(f"    Failed to fetch Commercial HB page {url}: {e}")
        for year in sorted(merged_hb.keys()):
            for vec, val in merged_hb[year].items():
                data_rows.append((vec, str(year), val))

        merged_an: Dict[int, Dict[str, float]] = {}
        an_row_mappings = [
            ("energy efficiency effect", "com_eee", None),
        ]
        for url in OEE_COM_AN_PAGES:
            try:
                r = requests.get(url, timeout=REQUEST_TIMEOUT)
                r.raise_for_status()
                parsed = self._parse_oee_html_table_generic(r.text, an_row_mappings)
                for year, row in parsed.items():
                    for k, v in row.items():
                        if k == "com_eee" and v is not None and v < 0:
                            v = abs(v)
                        merged_an.setdefault(year, {})[k] = v
            except Exception as e:
                print(f"    Failed to fetch Commercial AN page {url}: {e}")
        for year in sorted(merged_an.keys()):
            for vec, val in merged_an[year].items():
                data_rows.append((vec, str(year), val))

        section_cfg = self.config.sections.get(self.SECTION_KEY, {})
        sources_cfg = section_cfg.get('sources', {})
        res_cfg = sources_cfg.get('residential_daily_lives', {}) or {}
        base_dir = default_xlsx_base_dir()
        path_str = (res_cfg.get('ee_improvement_file_path') or '').strip()
        if path_str:
            path = self._resolve_path(path_str, base_dir)
        else:
            path = base_dir / "EE Improvement.xlsx"
        if path.exists():
            try:
                df_ee = pd.read_excel(path, sheet_name="EE Improvement")
            except Exception as e:
                print(f"    Failed to read sheet EE Improvement: {e}")
                df_ee = pd.DataFrame()
            if not df_ee.empty:
                df_ee.columns = [str(c).strip() for c in df_ee.columns]
                sector_col = self.get_column(df_ee, 'sector', 'SECTOR', 'Sector', 'sectors')
                metric_col = self.get_column(df_ee, 'metric', 'METRIC', 'Metric', 'metric name', 'metric_name', 'indicator')
                uom_col = self.get_column(df_ee, 'uom', 'UOM', 'Uom', 'unit', 'units')
                value_col = self.get_column(df_ee, 'value', 'VALUE', 'Value', 'val', 'amount', 'data')
                year_col = self.get_column(df_ee, 'year', 'YEAR', 'Year', 'end_year', 'ref_date', 'end year')
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
                        if 'improvement' in metric:
                            data_rows.append(('com_ee_improvement_pct', str(ee_year), round(val, 2)))
                        elif 'energy savings' in metric or 'savings' in metric:
                            if 'pj' in uom or uom == 'pj':
                                data_rows.append(('com_ee_savings_pj', str(ee_year), round(val, 2)))
                            elif 'billion' in uom or '$' in uom:
                                data_rows.append(('com_ee_savings_billion', str(ee_year), round(val, 2)))
        else:
            print(f"    EE Improvement file not found (optional for commercial): {path}")

        if not data_rows:
            print("    No commercial_institutional rows produced")
            return 0
        source_org = "Natural Resources Canada (OEE)"
        source_url_hb = OEE_COM_HB_PAGES[0]
        source_url_an = OEE_COM_AN_PAGES[0]
        metadata_rows = [
            ("com_teu_cieu", "Commercial and institutional total energy use (PJ)", "PJ", "petajoules", source_org, source_url_hb),
            ("com_sh", "Commercial and institutional space heating (PJ)", "PJ", "petajoules", source_org, source_url_hb),
            ("com_wh", "Commercial and institutional water heating (PJ)", "PJ", "petajoules", source_org, source_url_hb),
            ("com_ae", "Commercial and institutional auxiliary equipment (PJ)", "PJ", "petajoules", source_org, source_url_hb),
            ("com_am", "Commercial and institutional auxiliary motors (PJ)", "PJ", "petajoules", source_org, source_url_hb),
            ("com_lt", "Commercial and institutional lighting (PJ)", "PJ", "petajoules", source_org, source_url_hb),
            ("com_sc", "Commercial and institutional space cooling (PJ)", "PJ", "petajoules", source_org, source_url_hb),
            ("com_ei", "Commercial and institutional energy intensity (GJ/m²)", "GJ/m²", "units", source_org, source_url_hb),
            ("com_eee", "Commercial and institutional energy efficiency effect (PJ)", "PJ", "petajoules", source_org, source_url_an),
            ("com_ee_improvement_pct", "Commercial energy efficiency improvement (2000 to end year)", "%", "percent", source_org, source_url_an),
            ("com_ee_savings_pj", "Commercial energy savings (PJ)", "PJ", "petajoules", source_org, source_url_an),
            ("com_ee_savings_billion", "Commercial energy cost savings (billion $)", "billion $", "billions", source_org, source_url_an),
        ]
        self.repo.clear_raw_data("commercial_institutional")
        n = self.store_raw_data("commercial_institutional", data_rows, metadata_rows)
        print(f"    Stored {n} rows for commercial_institutional")
        return n

    NEUD_2000_BASELINE = {'TE': 8042.1, 'Ele': 1707.2, 'NG': 2140.8}

    def _process_seu_by_fuel(self) -> int:
        """
        Read SEU Final Demand.xlsx (sheet "SEU (final demand)"), aggregate by fuel category
        (Ele, NG, mogas, Oil, OOP, BM, OT), compute TE and output vectors for export.
        Adds year 2000 baseline from NEUD when not present for % change from 2000.
        """
        section_cfg = self.config.sections.get(self.SECTION_KEY, {})
        sources_cfg = section_cfg.get('sources', {})
        seu_cfg = sources_cfg.get('seu_by_fuel', {}) or {}
        base_dir = default_xlsx_base_dir()
        path_str = (seu_cfg.get('seu_final_demand_file_path') or '').strip()
        if path_str:
            path = self._resolve_path(path_str, base_dir)
        else:
            path = base_dir / "SEU Final Demand.xlsx"
        if not path.exists():
            print(f"    SEU Final Demand file not found: {path}")
            return 0
        try:
            df = pd.read_excel(path, sheet_name="SEU (final demand)")
        except Exception as e:
            print(f"    Failed to read SEU (final demand) sheet: {e}")
            return 0
        df.columns = [str(c).strip() for c in df.columns]
        year_col = self.get_column(df, 'ref_date', 'REF_DATE', 'year', 'Year', 'YEAR')
        fuel_col = self.get_column(df, 'fuel', 'FUEL', 'product', 'Fuel')
        value_col = self.get_column(df, 'value', 'VALUE', 'amount', 'val')
        if not year_col or not fuel_col or not value_col:
            print("    SEU sheet missing YEAR, FUEL or VALUE columns")
            return 0
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
        def _sum(y_dict, *keys):
            return sum(y_dict.get(k, 0) for k in keys)
        vectors = ['Ele', 'NG', 'mogas', 'Oil', 'OOP', 'BM', 'OT']
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
            for vec, val in [('seu_TE', self.NEUD_2000_BASELINE['TE']),
                             ('seu_Ele', self.NEUD_2000_BASELINE['Ele']),
                             ('seu_NG', self.NEUD_2000_BASELINE['NG'])]:
                data_rows.append((vec, '2000', round(val, 2)))
        if not data_rows:
            print("    No SEU rows computed")
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
        self.repo.clear_raw_data('seu_by_fuel')
        n = self.store_raw_data('seu_by_fuel', data_rows, metadata_rows)
        print(f"    Stored {n} rows for SEU by fuel ({len(by_year)} years)")
        return n
