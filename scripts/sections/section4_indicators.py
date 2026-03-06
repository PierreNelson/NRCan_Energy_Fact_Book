"""
Section 4: Energy Efficiency / Indicators data processor.

Handles data for:
- Energy use (OEE NEUD sector totals R,C,I,T,A + Primary Energy Use Demand P,NPC,FK,EL).
  OEE: five sector Table 1 XLS from NRCan OEE NEUD (URLs in code). Primary: local Excel at project root.
"""

import io
import re
import zipfile
from pathlib import Path
from typing import Dict, Any, List, Tuple, Optional

import pandas as pd
import requests

from .base import SectionProcessor

# OEE NEUD: all sectors use comprehensive ZIPs (direct Excel XLS URLs often 404/500).
OEE_NEUD_ZIP_BASE = "https://oee.nrcan.gc.ca/corporate/statistics/neud/dpa/data_e/downloads/comprehensive/zip/2022"
OEE_NEUD_ZIP_URLS = {
    'R': f"{OEE_NEUD_ZIP_BASE}/resca2022e.zip",
    'C': f"{OEE_NEUD_ZIP_BASE}/comca2022e.zip",
    'I': f"{OEE_NEUD_ZIP_BASE}/aggca2022e.zip",
    'T': f"{OEE_NEUD_ZIP_BASE}/tranca2022e.zip",
    'A': f"{OEE_NEUD_ZIP_BASE}/agrca2022e.zip",
}

DEFAULT_PRIMARY_DEMAND_FILENAME = "Primary Energy Use Demand.xlsx"
REQUEST_TIMEOUT = 60


class Section4Indicators(SectionProcessor):
    """
    Processor for Section 4 (Energy Efficiency / Indicators).

    Data sources:
    - energy_use: OEE NEUD (R,C,I,T,A) from five sector XLS URLs; Primary (P,NPC,FK,EL) from project-root Excel.
    """

    SECTION_KEY = "section4_indicators"
    SECTION_NAME = "Energy Efficiency"
    SECTION_ID = 4

    OEE_NEUD_VECTORS = ['R', 'C', 'I', 'T', 'A', 'P', 'NPC', 'FK', 'EL']

    def get_source_handlers(self) -> Dict[str, callable]:
        return {
            'energy_use': self._process_energy_use,
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
        """Resolve Primary Energy Use Demand file: config override or project_root / DEFAULT_PRIMARY_DEMAND_FILENAME."""
        primary_path = energy_cfg.get('primary_demand_file_path') or energy_cfg.get('primary_demand_path')
        script_dir = Path(__file__).resolve().parent.parent
        if primary_path and str(primary_path).strip():
            return self._resolve_path(primary_path.strip(), script_dir)
        project_root = Path(__file__).resolve().parent.parent.parent
        p = project_root / DEFAULT_PRIMARY_DEMAND_FILENAME
        if not p.exists() and script_dir.parent.exists():
            p_alt = script_dir.parent / DEFAULT_PRIMARY_DEMAND_FILENAME
            if p_alt.exists():
                return p_alt
        return p

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
        Extract from OEE NEUD (five sector XLS URLs) and Primary Energy Use Demand (project-root Excel),
        write to calc_energy_use and raw_statcan_data, then export to data.csv.
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
            print(f"    Place '{DEFAULT_PRIMARY_DEMAND_FILENAME}' at project root or set primary_demand_file_path in config.")
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
        print(f"    Stored {n} rows in raw_statcan_data + calc_energy_use ({len(all_years)} years)")
        return n
