"""Shared OEE fetch and parse helpers for Section 4."""

import io
import re
import zipfile
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import pandas as pd
import requests
from bs4 import BeautifulSoup

from utils.io_retry import ensure_workbook, resolve_sheet_name

from .constants import (
    EE_SHEET_PRIMARY,
    ENERGY_EFFICIENCY_XLSX,
    OEE_NEUD_ZIP_URLS,
    OEE_RESIDENTIAL_ANALYSIS_PAGES,
    OEE_RESIDENTIAL_ANALYSIS_XLS,
    REQUEST_TIMEOUT,
    map_primary_secondary_product,
    _residential_label_eee,
    _residential_label_space,
    _residential_label_ter,
    _residential_label_water,
)


class OEESharedMixin:
    """Fetch and parse helpers shared across Section 4 handlers."""

    def _resolve_path(self, path_str: str, base_dir: Path) -> Path:
        p = Path(path_str)
        if not p.is_absolute():
            p = base_dir / path_str
        return p

    def _fetch_xls_bytes(self, url: str) -> Optional[bytes]:
        """Download XLS from URL; return content bytes or None on failure."""
        try:
            r = self.fetch_url_with_retry(url, timeout=REQUEST_TIMEOUT, label="OEE XLS")
            return r.content
        except Exception as e:
            print(f"    Failed to fetch {url}: {e}")
            return None

    def _fetch_sector_xls_from_zip(self, zip_url: str, sector_key: str) -> Optional[bytes]:
        """Download a sector comprehensive ZIP and return the single XLS file bytes (e.g. res_ca_e.xls)."""
        try:
            r = self.fetch_url_with_retry(zip_url, timeout=REQUEST_TIMEOUT, label="OEE ZIP")
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

    def _load_oee_from_energy_efficiency_excel(self) -> Dict[int, Dict[str, float]]:
        """Load R,C,I,T,A from SharePoint Energy Efficiency workbook when available."""
        path = ensure_workbook(ENERGY_EFFICIENCY_XLSX, config=self.config)
        if not path.is_file():
            return {}
        try:
            sheet = resolve_sheet_name(path, EE_SHEET_PRIMARY, label='energy_use OEE sectors')
            df = pd.read_excel(path, sheet_name=sheet)
        except Exception as e:
            print(f"    Could not read {path.name} sheet {EE_SHEET_PRIMARY!r}: {e}")
            return {}
        df.columns = [str(c).strip() for c in df.columns]
        year_col = self.get_column(df, "year", "Year", "YEAR", "ref_date")
        product_col = self.get_column(df, "product", "PRODUCT", "category")
        value_col = self.get_column(df, "value", "VALUE", "amount")
        if not year_col or not product_col or not value_col:
            return {}
        oee_sectors = {"R", "C", "I", "T", "A"}
        by_year: Dict[int, Dict[str, float]] = {}
        for _, row in df.iterrows():
            code = map_primary_secondary_product(row.get(product_col, ""))
            if code not in oee_sectors:
                continue
            try:
                year = int(float(row[year_col]))
                val = float(row[value_col])
            except (TypeError, ValueError):
                continue
            by_year.setdefault(year, {})[code] = val
        if by_year:
            print(f"    OEE sectors R,C,I,T,A from {path.name} ({len(by_year)} years)")
        return by_year

    def _fetch_oee_by_year(self) -> Dict[int, Dict[str, float]]:
        """Load sector totals R,C,I,T,A from SharePoint Excel, else OEE NEUD ZIP downloads."""
        from_excel = self._load_oee_from_energy_efficiency_excel()
        if from_excel:
            return from_excel

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

    def _fetch_oee_residential_analysis(self) -> Dict[int, Dict[str, float]]:
        """
        Fetch OEE Residential Analysis (XLS/XLSX and AN HTML pages).
        Always merges HTML after XLS so missing EEE/rows from an incomplete XLS parse are filled.
        """
        merged: Dict[int, Dict[str, float]] = {}
        try:
            r = self.fetch_url_with_retry(
                OEE_RESIDENTIAL_ANALYSIS_XLS, timeout=REQUEST_TIMEOUT, label="OEE Residential XLS"
            )
            parsed = self._parse_oee_residential_analysis_xls(r.content)
            self._merge_residential_oee_year_dicts(merged, parsed)
            if parsed:
                print(f"    OEE Residential XLS: parsed {len(parsed)} year rows")
        except Exception as e:
            print(f"    OEE Residential XLS not available ({e}); will use HTML / generic table parse")

        for url in OEE_RESIDENTIAL_ANALYSIS_PAGES:
            try:
                r = self.fetch_url_with_retry(url, timeout=REQUEST_TIMEOUT, label="OEE Residential HTML")
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
