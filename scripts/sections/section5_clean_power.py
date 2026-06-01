"""
Section 5: Clean power and low carbon fuels data processor.

Handles data for:
- Environmental and clean technology (StatCan 4 tables + TSX/TSXV cleantech XLSX)
"""

import io
import os
import re
import time
import pandas as pd
import requests
from pathlib import Path
from html.parser import HTMLParser
from typing import Dict, List, Optional, Tuple
from datetime import datetime

from collections import defaultdict

from .base import SectionProcessor
from xlsx_paths import default_xlsx_base_dir

EV_SALES_URL_20100021 = "https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=2010002101"
EV_SALES_URL_20100025 = "https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=2010002501"

EV_SALES_OLD_TOTAL = 1079014832
EV_SALES_OLD_BEV = 1079014835
EV_SALES_OLD_PHEV = 1079014837
EV_SALES_NEW_TOTAL = 1671330686
EV_SALES_NEW_BEV = 1277485216
EV_SALES_NEW_PHEV = 1277490561

EV_SALES_METADATA = [
    (
        "ev_total_regs",
        "Total new vehicle registrations",
        "Number",
        "units",
        "Statistics Canada",
        EV_SALES_URL_20100025,
    ),
    (
        "ev_new_regs",
        "New EV registrations (battery electric + plug-in hybrid electric)",
        "Number",
        "units",
        "Statistics Canada",
        EV_SALES_URL_20100025,
    ),
    (
        "ev_share_pct",
        "Proportion of total new vehicle registrations",
        "Percent",
        "percent",
        "Statistics Canada",
        EV_SALES_URL_20100025,
    ),
]

EV_SALES_VECTORS = {row[0] for row in EV_SALES_METADATA}


def _fetch_wds_annual_totals(vector_ids: List[int], start_ref: str = "2010-01-01") -> Dict[int, Dict[int, float]]:
    """Fetch StatCan WDS vectors and aggregate to annual totals per vector id."""
    ids = [str(v).lstrip("vV") for v in vector_ids]
    url = (
        "https://www150.statcan.gc.ca/t1/wds/rest/getDataFromVectorByReferencePeriodRange"
        f"?vectorIds={','.join(ids)}&startRefPeriod={start_ref}&endReferencePeriod=2030-12-31"
    )
    headers = {
        "Accept": "*/*",
        "Accept-Language": "en-CA,en;q=0.9",
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        ),
        "Referer": "https://www.statcan.gc.ca/",
    }
    response = requests.get(url, timeout=120, headers=headers)
    response.raise_for_status()
    raw = response.json()
    items = raw if isinstance(raw, list) else [raw]
    totals: Dict[int, Dict[int, float]] = defaultdict(lambda: defaultdict(float))
    for item in items:
        if item.get("status") != "SUCCESS":
            continue
        obj = item.get("object") or {}
        vid = obj.get("vectorId")
        if vid is None:
            continue
        for pt in obj.get("vectorDataPoint") or []:
            ref = pt.get("refPer") or pt.get("refPerRaw") or ""
            val = pt.get("value")
            if not ref or val is None:
                continue
            year = int(str(ref)[:4])
            totals[int(vid)][year] += float(val)
    return totals


def build_ev_sales_rows(max_year: Optional[int] = None) -> List[Tuple[str, str, float]]:
    """
    Amalgamate StatCan 20-10-0021-01 (2011-2016) and 20-10-0025-01 (2017+).
    Returns rows of (vector, year, value) for ev_total_regs, ev_new_regs, ev_share_pct.
    """
    old = _fetch_wds_annual_totals(
        [EV_SALES_OLD_TOTAL, EV_SALES_OLD_BEV, EV_SALES_OLD_PHEV],
        start_ref="2010-01-01",
    )
    new = _fetch_wds_annual_totals(
        [EV_SALES_NEW_TOTAL, EV_SALES_NEW_BEV, EV_SALES_NEW_PHEV],
        start_ref="2016-01-01",
    )

    rows: List[Tuple[str, str, float]] = []
    for year in range(2011, 2017):
        total = old[EV_SALES_OLD_TOTAL].get(year, 0.0)
        ev = old[EV_SALES_OLD_BEV].get(year, 0.0) + old[EV_SALES_OLD_PHEV].get(year, 0.0)
        if total <= 0 or ev <= 0:
            continue
        share = round((ev / total) * 100, 1)
        rows.extend(
            [
                ("ev_total_regs", str(year), round(total, 0)),
                ("ev_new_regs", str(year), round(ev, 0)),
                ("ev_share_pct", str(year), share),
            ]
        )

    quarterly_years = sorted(set(new[EV_SALES_NEW_TOTAL]) | set(new[EV_SALES_NEW_BEV]) | set(new[EV_SALES_NEW_PHEV]))
    for year in quarterly_years:
        if year < 2017:
            continue
        if max_year is not None and year > max_year:
            continue
        total = new[EV_SALES_NEW_TOTAL].get(year, 0.0)
        ev = new[EV_SALES_NEW_BEV].get(year, 0.0) + new[EV_SALES_NEW_PHEV].get(year, 0.0)
        if total <= 0 or ev <= 0:
            continue
        share = round((ev / total) * 100, 1)
        rows.extend(
            [
                ("ev_total_regs", str(year), round(total, 0)),
                ("ev_new_regs", str(year), round(ev, 0)),
                ("ev_share_pct", str(year), share),
            ]
        )
    return rows


class _TableTextParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tables = []
        self._table = None
        self._row = None
        self._cell = None

    def handle_starttag(self, tag, attrs):
        tag = tag.lower()
        if tag == "table":
            self._table = []
        elif tag == "tr" and self._table is not None:
            self._row = []
        elif tag in ("th", "td") and self._row is not None:
            self._cell = []

    def handle_data(self, data):
        if self._cell is not None:
            self._cell.append(data)

    def handle_endtag(self, tag):
        tag = tag.lower()
        if tag in ("th", "td") and self._cell is not None and self._row is not None:
            self._row.append(re.sub(r"\s+", " ", "".join(self._cell)).strip())
            self._cell = None
        elif tag == "tr" and self._row is not None and self._table is not None:
            if any(cell for cell in self._row):
                self._table.append(self._row)
            self._row = None
        elif tag == "table" and self._table is not None:
            if self._table:
                self.tables.append(self._table)
            self._table = None


class Section5CleanPower(SectionProcessor):
    """
    Processor for Section 5: Clean power and low carbon fuels.

    Data sources:
    - environmental_clean_tech: StatCan 14-10-0023-01, 36-10-0103-01,
      36-10-0632-01, 36-10-0629-01 (WDS fallback when CSV fails)
    """

    SECTION_KEY = "section5_clean_power"
    SECTION_NAME = "Clean Power and Low Carbon Fuels"
    SECTION_ID = 5

    def get_source_handlers(self) -> Dict[str, callable]:
        """Return mapping of source keys to handler functions."""
        return {
            'environmental_clean_tech': self._process_environmental_clean_tech,
            'cleantech_companies_geo': self._process_cleantech_companies_geo,
            'cleantech_companies_industry': self._process_cleantech_companies_industry,
            'ev_sales': self._process_ev_sales,
        }

    def _process_ev_sales(self) -> int:
        """Fetch amalgamated plug-in EV registration vectors for Page 96."""
        data_rows = build_ev_sales_rows(max_year=2024)
        if not data_rows:
            return 0
        self.repo.clear_raw_data('ev_sales')
        return self.store_raw_data('ev_sales', data_rows, EV_SALES_METADATA)

    def _get_future_end_date(self) -> str:
        """Get end date 5 years in future for StatCan queries."""
        return f"{datetime.now().year + 5}0101"

    def _get_ect_labour_url(self) -> str:
        """Get URL for Table 14-10-0023-01 (Labour force by industry, annual). Vector V2363382."""
        end_date = self._get_future_end_date()
        return (
            f"https://www150.statcan.gc.ca/t1/tbl1/en/dtl!downloadDbLoadingData-nonTraduit.action?"
            f"pid=1410002301&latestN=0&startDate=20070101&endDate={end_date}&csvLocale=en"
        )

    def _get_ect_gdp_url(self) -> str:
        """Get URL for Table 36-10-0103-01 (GDP income-based, quarterly). Vectors V62295574, V62295576."""
        end_date = self._get_future_end_date()
        return (
            f"https://www150.statcan.gc.ca/t1/tbl1/en/dtl!downloadDbLoadingData-nonTraduit.action?"
            f"pid=3610010301&latestN=0&startDate=20070101&endDate={end_date}&csvLocale=en"
            f"&selectedMembers=%5B%5B1%5D%2C%5B2%5D%2C%5B12%2C14%5D%5D&checkedLevels=0D1"
        )

    def _get_ect_eco_jobs_url(self) -> str:
        """Get URL for Table 36-10-0632-01 (Environmental and clean tech jobs)."""
        end_date = self._get_future_end_date()
        return (
            f"https://www150.statcan.gc.ca/t1/tbl1/en/dtl!downloadDbLoadingData-nonTraduit.action?"
            f"pid=3610063201&latestN=0&startDate=20070101&endDate={end_date}&csvLocale=en"
        )

    def _get_ect_eco_exports_url(self) -> str:
        """Get URL for Table 36-10-0629-01 (Environmental and clean tech supply/use, exports)."""
        end_date = self._get_future_end_date()
        return (
            f"https://www150.statcan.gc.ca/t1/tbl1/en/dtl!downloadDbLoadingData-nonTraduit.action?"
            f"pid=3610062901&latestN=0&startDate=20070101&endDate={end_date}&csvLocale=en"
        )

    def _get_ect_eco_gdp_url(self) -> str:
        """Get URL for Table 36-10-0645-01 (ECT GDP by industry, Page 61 step 3)."""
        end_date = self._get_future_end_date()
        return (
            f"https://www150.statcan.gc.ca/t1/tbl1/en/dtl!downloadDbLoadingData-nonTraduit.action?"
            f"pid=3610064501&latestN=0&startDate=20120101&endDate={end_date}&csvLocale=en"
        )

    TSX_CLEANTECH_URL = "https://www.tsx.com/resource/en/571"

    DEFAULT_TMX_XLSX = "tmx_cleantech.xlsx"
    DEFAULT_TMX_XLSX_ROOT = "tsx-and-amp-tsxv-listed-companies-2026-02-17-en.xlsx"
    CLEANTECH_GEO_URL = "https://natural-resources.canada.ca/science-innovation/research-development/clean-technology/clean-growth-hub/clean-technology-data-strategy/cleantech-companies"
    CLEANTECH_GEO_REGIONS = [
        ("alta", "Alberta"),
        ("atl", "Atlantic Provinces"),
        ("bc", "British Columbia"),
        ("man", "Manitoba"),
        ("ont", "Ontario"),
        ("que", "Quebec"),
        ("sask", "Saskatchewan"),
        ("terr", "Territories"),
    ]
    CLEANTECH_INDUSTRIES = [
        ("renewable_energy", "Renewable Energy"),
        ("energy_efficiency", "Energy Efficiency"),
        ("biofuels_bioenergy", "Biofuels, Bioenergy and Bioproducts"),
        ("air_env_remediation", "Air, Environment and Remediation"),
        ("water_wastewater", "Water and Wastewater"),
        ("smart_grid_storage", "Smart Grid and Energy Storage"),
        ("transportation", "Transportation"),
        ("agriculture_forestry", "Agriculture and Forestry"),
        ("waste_recycling", "Waste and Recycling"),
        ("mining_manufacturing", "Mining and Manufacturing"),
    ]

    def _source_url_for(self, source_key: str, fallback: str) -> str:
        try:
            sec = self.config.sections.get("section5_clean_power", {})
            src = sec.get("sources", {}).get(source_key, {})
            return src.get("source_url") or fallback
        except Exception:
            return fallback

    def _parse_int_text(self, value: str) -> Optional[int]:
        text = re.sub(r"[^\d.-]", "", str(value or ""))
        if not text:
            return None
        try:
            return int(float(text))
        except ValueError:
            return None

    def _extract_cleantech_geo(self, html: str) -> Tuple[int, int, Dict[str, int]]:
        plain = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", html))
        year_match = re.search(r"accurate as of [A-Za-z]+\s+(\d{4})", plain, re.I) or re.search(r"\b(?:June|July|August|September)\s+(\d{4})\b", plain, re.I)
        ref_year = int(year_match.group(1)) if year_match else 2025
        total_match = re.search(r"Total Pureplay Industry Involvement:\s*([\d,]+)", plain, re.I)
        reported_total = self._parse_int_text(total_match.group(1)) if total_match else None

        parser = _TableTextParser()
        parser.feed(html)
        candidates = []
        for table in parser.tables:
            if not table:
                continue
            header = table[0]
            norm_header = [re.sub(r"\s+", " ", cell).strip().lower() for cell in header]
            indexes = {}
            for key, label in self.CLEANTECH_GEO_REGIONS:
                label_norm = label.lower()
                if label_norm in norm_header:
                    indexes[key] = norm_header.index(label_norm)
            if len(indexes) != len(self.CLEANTECH_GEO_REGIONS):
                continue
            for row in table[1:]:
                if not row or row[0].strip().lower() != "total":
                    continue
                counts = {}
                for key, _label in self.CLEANTECH_GEO_REGIONS:
                    idx = indexes[key]
                    counts[key] = self._parse_int_text(row[idx] if idx < len(row) else "")
                if all(v is not None for v in counts.values()):
                    row_sum = sum(counts.values())
                    candidates.append((row_sum, counts))
        if not candidates:
            raise ValueError("Could not find cleantech company province totals in the NRCan source page")
        if reported_total is not None:
            for row_sum, counts in candidates:
                if row_sum == reported_total:
                    return ref_year, reported_total, counts
        row_sum, counts = candidates[0]
        return ref_year, reported_total or row_sum, counts

    def _extract_cleantech_industries(self, html: str) -> Tuple[int, List[Tuple[str, str, int, float]]]:
        plain = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", html))
        year_match = re.search(r"accurate as of [A-Za-z]+\s+(\d{4})", plain, re.I) or re.search(r"\b(?:June|July|August|September)\s+(\d{4})\b", plain, re.I)
        ref_year = int(year_match.group(1)) if year_match else 2025
        parser = _TableTextParser()
        parser.feed(html)
        def norm_label(value: str) -> str:
            return re.sub(r"[^a-z0-9]+", " ", value.lower()).strip()
        industry_lookup = {norm_label(label): (key, label) for key, label in self.CLEANTECH_INDUSTRIES}
        rows = []
        for table in parser.tables:
            if not table:
                continue
            header = table[0]
            norm_header = [re.sub(r"\s+", " ", cell).strip().lower() for cell in header]
            region_indexes = []
            for _key, label in self.CLEANTECH_GEO_REGIONS:
                label_norm = label.lower()
                if label_norm in norm_header:
                    region_indexes.append(norm_header.index(label_norm))
            if len(region_indexes) != len(self.CLEANTECH_GEO_REGIONS):
                continue
            candidate_rows = []
            for row in table[1:]:
                if not row:
                    continue
                label = re.sub(r"\s+", " ", row[0]).strip()
                if label.lower() == "total":
                    continue
                item = industry_lookup.get(norm_label(label))
                if not item:
                    continue
                count = 0
                for idx in region_indexes:
                    parsed = self._parse_int_text(row[idx] if idx < len(row) else "")
                    count += parsed or 0
                candidate_rows.append((item[0], item[1], count))
            if len(candidate_rows) == len(self.CLEANTECH_INDUSTRIES):
                rows = candidate_rows
                break
        if not rows:
            raise ValueError("Could not find cleantech industry totals in the NRCan source page")
        total = sum(count for _key, _label, count in rows)
        if total <= 0:
            raise ValueError("Cleantech industry total must be greater than zero")
        out = [
            (key, label, count, round((count / total) * 100, 1))
            for key, label, count in rows
        ]
        out.sort(key=lambda item: item[2], reverse=True)
        return ref_year, out

    def _process_cleantech_companies_geo(self) -> int:
        source_key = "cleantech_companies_geo"
        source_url = self._source_url_for(source_key, self.CLEANTECH_GEO_URL)
        response = requests.get(source_url, timeout=self.REQUEST_TIMEOUT, headers={"User-Agent": "Mozilla/5.0 (compatible; NRCan-Energy-Factbook/1.0)"})
        response.raise_for_status()
        ref_year, total, counts = self._extract_cleantech_geo(response.text)
        if total <= 0:
            raise ValueError("Cleantech company total must be greater than zero")

        data_rows = [("cleantech_geo_total", ref_year, float(total))]
        metadata_rows = [("cleantech_geo_total", "Total pureplay industry involvement", "Number", "units", "Natural Resources Canada", source_url)]
        for key, label in self.CLEANTECH_GEO_REGIONS:
            count = counts[key]
            share = round((count / total) * 100, 1)
            data_rows.append((f"cleantech_geo_{key}_count", ref_year, float(count)))
            data_rows.append((f"cleantech_geo_{key}_pct", ref_year, share))
            metadata_rows.append((f"cleantech_geo_{key}_count", f"Cleantech companies, {label}", "Number", "units", "Natural Resources Canada", source_url))
            metadata_rows.append((f"cleantech_geo_{key}_pct", f"Cleantech companies share, {label}", "Percent", "percent", "Natural Resources Canada", source_url))

        self.repo.clear_raw_data(source_key)
        return self.store_raw_data(source_key, data_rows, metadata_rows)

    def _process_cleantech_companies_industry(self) -> int:
        source_key = "cleantech_companies_industry"
        source_url = self._source_url_for(source_key, self.CLEANTECH_GEO_URL)
        response = requests.get(source_url, timeout=self.REQUEST_TIMEOUT, headers={"User-Agent": "Mozilla/5.0 (compatible; NRCan-Energy-Factbook/1.0)"})
        response.raise_for_status()
        ref_year, industries = self._extract_cleantech_industries(response.text)
        data_rows = []
        metadata_rows = []
        for key, label, count, share in industries:
            data_rows.append((f"cleantech_ind_{key}_count", ref_year, float(count)))
            data_rows.append((f"cleantech_ind_{key}_pct", ref_year, share))
            metadata_rows.append((f"cleantech_ind_{key}_count", f"Cleantech companies, {label}", "Number", "units", "Natural Resources Canada", source_url))
            metadata_rows.append((f"cleantech_ind_{key}_pct", f"Cleantech companies share, {label}", "Percent", "percent", "Natural Resources Canada", source_url))
        self.repo.clear_raw_data(source_key)
        return self.store_raw_data(source_key, data_rows, metadata_rows)

    def _fetch_tsx_xlsx_bytes(self) -> Optional[bytes]:
        """Try to load TSX cleantech XLSX from config, then project-root default, then cwd, then scripts/, then download. Returns bytes or None."""
        scripts_dir = Path(__file__).resolve().parent.parent
        project_root = scripts_dir.parent
        cwd = Path.cwd()
        try:
            sec = self.config.sections.get("section5_clean_power", {})
            src = sec.get("sources", {}).get("environmental_clean_tech", {})
            local_path = src.get("tmx_xlsx_path") or src.get("xlsx_path")
            if local_path:
                p = (scripts_dir / local_path) if not os.path.isabs(local_path) else Path(local_path)
                if not p.is_file() and (project_root / local_path).is_file():
                    p = project_root / local_path
                if not p.is_file() and (cwd / local_path).is_file():
                    p = cwd / local_path
                if p.is_file():
                    data = p.read_bytes()
                    print(f"    Loaded TSX XLSX from config path: {p}")
                    return data
            for label, base in [("project root", project_root), ("current directory", cwd), ("scripts", scripts_dir)]:
                p = base / self.DEFAULT_TMX_XLSX_ROOT
                if p.is_file():
                    data = p.read_bytes()
                    print(f"    Loaded TSX XLSX from {label}: {p.name}")
                    return data
            default_p = scripts_dir / self.DEFAULT_TMX_XLSX
            if default_p.is_file():
                data = default_p.read_bytes()
                print(f"    Loaded TSX XLSX: {default_p.name}")
                return data
        except Exception as e:
            print(f"    Warning: TSX local XLSX read failed: {e}")
        url = None
        try:
            sec = self.config.sections.get("section5_clean_power", {})
            src = sec.get("sources", {}).get("environmental_clean_tech", {})
            url = src.get("source_url") or self.TSX_CLEANTECH_URL
        except Exception:
            url = self.TSX_CLEANTECH_URL
        try:
            r = requests.get(url, timeout=30, headers={"User-Agent": "Mozilla/5.0 (compatible; NRCan-Energy-Factbook/1.0)"})
            r.raise_for_status()
            ct = (r.headers.get("Content-Type") or "").lower()
            if "spreadsheet" in ct or "excel" in ct or "octet-stream" in ct:
                return r.content
            if r.content[:2] == b"PK":
                return r.content
            text = r.text
            if not text.strip():
                return None
            match = re.search(r'href\s*=\s*["\']([^"\']+\.xlsx?)["\']', text, re.I)
            if match:
                link = match.group(1)
                if link.startswith("/"):
                    link = "https://www.tsx.com" + link
                elif not link.startswith("http"):
                    link = url.rsplit("/", 1)[0] + "/" + link
                r2 = requests.get(link, timeout=30, headers={"User-Agent": "Mozilla/5.0 (compatible; NRCan-Energy-Factbook/1.0)"})
                r2.raise_for_status()
                if r2.content[:2] == b"PK":
                    return r2.content
        except Exception as e:
            print(f"    Warning: TSX XLSX fetch failed: {e}")
        return None

    def _parse_tsx_xlsx(self, data: bytes) -> Optional[Tuple[int, float, int, float]]:
        """
        Parse TSX/TSXV listed companies XLSX (e.g. tsx-and-amp-tsxv-listed-companies-*-en.xlsx).
        Returns (total_count, total_mcap_billions, can_count, can_mcap_billions) or None.
        Expects header row with Sector, Market Cap (C$), HQ Region; filters Sector by clean|renewable.
        """
        def norm(s: str) -> str:
            return str(s).replace("\n", " ").strip().lower().replace(" ", "_")

        try:
            xl = pd.ExcelFile(io.BytesIO(data), engine="openpyxl")
            all_clean = []
            for sheet in xl.sheet_names:
                df = pd.read_excel(xl, sheet_name=sheet, header=None)
                if df.empty or df.shape[1] < 5:
                    continue
                header_row = None
                for i in range(min(15, len(df))):
                    row = df.iloc[i].astype(str)
                    row_lower = row.str.lower()
                    if any("market" in v and "cap" in v for v in row_lower) and any("sector" in v for v in row_lower):
                        header_row = i
                        break
                if header_row is None:
                    continue
                df = pd.read_excel(xl, sheet_name=sheet, header=header_row)
                df.columns = [norm(c) for c in df.columns]
                cap_col = None
                sector_col = None
                region_col = None
                for c in df.columns:
                    if "market" in c and "cap" in c:
                        cap_col = c
                    if c == "sector":
                        sector_col = c
                    elif sector_col is None and ("sector" in c or "industry" in c) and "sub" not in c:
                        sector_col = c
                    if "hq" in c and "region" in c:
                        region_col = c
                if cap_col is None or sector_col is None:
                    continue
                mask = df[sector_col].astype(str).str.lower().str.contains("clean|renewable", na=False, regex=True)
                clean_df = df.loc[mask].copy()
                if clean_df.empty:
                    continue
                clean_df["_mcap"] = pd.to_numeric(clean_df[cap_col], errors="coerce").fillna(0)
                if clean_df["_mcap"].sum() <= 0:
                    continue
                all_clean.append(clean_df)
            if not all_clean:
                return None
            combined = pd.concat(all_clean, ignore_index=True)
            total_mcap = combined["_mcap"].sum()
            count = len(combined)
            can_count = count
            can_mcap = total_mcap
            if region_col and region_col in combined.columns:
                is_can = combined[region_col].astype(str).str.upper().str.contains("CANADA", na=False)
                can_count = int(is_can.sum())
                can_mcap = float(combined.loc[is_can, "_mcap"].sum())
            total_b = total_mcap / 1e9 if total_mcap >= 1e9 else total_mcap / 1e6
            can_b = can_mcap / 1e9 if can_mcap >= 1e9 else can_mcap / 1e6
            return (count, round(total_b, 2), can_count, round(can_b, 2))
        except Exception as e:
            print(f"    Warning: TSX XLSX parse failed: {e}")
        return None

    def _process_environmental_clean_tech(self) -> int:
        """
        Process environmental and clean technology data for the factbook snapshot.
        Sources: StatCan 14-10-0023-01, 36-10-0103-01, 36-10-0645-01, 36-10-0632-01, 36-10-0629-01, TSX.
        Vectors use prefix envcleantech_. Uses WDS JSON API when CSV download fails.
        """
        data_rows = []
        metadata_rows = []
        source_org_sc = 'Statistics Canada'
        url_labour = 'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=1410002301'
        url_gdp = 'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=3610010301'
        url_eco_gdp = 'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=3610064501'
        url_eco_jobs = 'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=3610063201'
        url_eco_exports = 'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=3610062901'
        try:
            df = self.fetch_csv_from_url(self._get_ect_labour_url())
            vcol = self.get_column(df, 'VECTOR', 'Vector', 'vector')
            rcol = self.get_column(df, 'REF_DATE', 'Ref_date', 'ref_date')
            valcol = self.get_column(df, 'VALUE', 'Value', 'value')
            if vcol and rcol and valcol:
                sub = df[df[vcol].astype(str).str.upper().str.strip().str.lstrip('V').isin(['2363382'])]
                if not sub.empty:
                    sub = sub.copy()
                    sub['year'] = pd.to_numeric(sub[rcol].astype(str).str[:4], errors='coerce')
                    for year in sub['year'].dropna().unique():
                        yv = sub[sub['year'] == year][valcol].sum()
                        if pd.notna(yv) and yv != 0:
                            data_rows.append(('envcleantech_employment_total', int(year), round(float(yv), 1)))
        except Exception as e:
            try:
                time.sleep(2)
                wds = self.fetch_wds_vector_data(['2363382'], start_ref='2007-01-01')
                by_year = {}
                for _vid, ref_per, value in wds:
                    year = int(str(ref_per)[:4]) if ref_per else None
                    if year and year >= 2007:
                        by_year[year] = by_year.get(year, 0) + value
                for year, yv in sorted(by_year.items()):
                    if yv != 0:
                        data_rows.append(('envcleantech_employment_total', year, round(float(yv), 1)))
            except Exception as e2:
                print(f"    Warning: environmental_clean_tech labour fetch failed: {e2}")
        try:
            df = self.fetch_csv_from_url(self._get_ect_gdp_url())
            vcol = self.get_column(df, 'VECTOR', 'Vector', 'vector')
            rcol = self.get_column(df, 'REF_DATE', 'Ref_date', 'ref_date')
            valcol = self.get_column(df, 'VALUE', 'Value', 'value')
            if vcol and rcol and valcol:
                df = df.copy()
                df['year'] = pd.to_numeric(df[rcol].astype(str).str[:4], errors='coerce')
                for year in df['year'].dropna().unique():
                    ydf = df[df['year'] == year]
                    gdp_mp = ydf[ydf[vcol].astype(str).str.upper().isin(['V62295576'])][valcol].sum()
                    if pd.notna(gdp_mp) and gdp_mp != 0:
                        data_rows.append(('envcleantech_canada_gdp_market', int(year), round(float(gdp_mp), 1)))
        except Exception as e:
            print(f"    Warning: environmental_clean_tech Canada GDP fetch failed: {e}")
        try:
            df = self.fetch_csv_from_url(self._get_ect_eco_gdp_url())
            vcol = self.get_column(df, 'VECTOR', 'Vector', 'vector')
            rcol = self.get_column(df, 'REF_DATE', 'Ref_date', 'ref_date')
            valcol = self.get_column(df, 'VALUE', 'Value', 'value')
            if vcol and rcol and valcol:
                df = df.copy()
                df['year'] = pd.to_numeric(df[rcol].astype(str).str[:4], errors='coerce')
                clean_vecs = {'v1257883276', 'v1257883278', 'v1257883280'}
                for year in df['year'].dropna().unique():
                    ydf = df[df['year'] == year]
                    eco = ydf[ydf[vcol].astype(str).str.lower().isin(['v1257883274'])][valcol].sum()
                    if pd.notna(eco) and eco != 0:
                        data_rows.append(('envcleantech_eco_gdp', int(year), round(float(eco), 1)))
                    clean = ydf[ydf[vcol].astype(str).str.lower().isin(clean_vecs)][valcol].sum()
                    if pd.notna(clean) and clean != 0:
                        data_rows.append(('envcleantech_clean_energy_gdp', int(year), round(float(clean), 1)))
        except Exception as e:
            try:
                time.sleep(2)
                wds = self.fetch_wds_vector_data(
                    ['1257883274', '1257883276', '1257883278', '1257883280'],
                    start_ref='2012-01-01',
                )
                eco_by_year: Dict[int, float] = {}
                clean_by_year: Dict[int, float] = {}
                total_vec = 1257883274
                clean_vecs = {1257883276, 1257883278, 1257883280}
                for vid, ref_per, value in wds:
                    year = int(str(ref_per)[:4]) if ref_per else None
                    if not year or year < 2012:
                        continue
                    if vid == total_vec:
                        eco_by_year[year] = eco_by_year.get(year, 0) + value
                    elif vid in clean_vecs:
                        clean_by_year[year] = clean_by_year.get(year, 0) + value
                for year in sorted(eco_by_year):
                    if eco_by_year[year] != 0:
                        data_rows.append(('envcleantech_eco_gdp', year, round(float(eco_by_year[year]), 1)))
                for year in sorted(clean_by_year):
                    if clean_by_year[year] != 0:
                        data_rows.append(('envcleantech_clean_energy_gdp', year, round(float(clean_by_year[year]), 1)))
            except Exception as e2:
                print(f"    Warning: environmental_clean_tech ECT GDP fetch failed: {e2}")
        try:
            df = self.fetch_csv_from_url(self._get_ect_eco_jobs_url())
            vcol = self.get_column(df, 'VECTOR', 'Vector', 'vector')
            rcol = self.get_column(df, 'REF_DATE', 'Ref_date', 'ref_date')
            valcol = self.get_column(df, 'VALUE', 'Value', 'value')
            if vcol and rcol and valcol:
                df = df.copy()
                df['year'] = pd.to_numeric(df[rcol].astype(str).str[:4], errors='coerce')
                for year in df['year'].dropna().unique():
                    ydf = df[df['year'] == year]
                    total = ydf[ydf[vcol].astype(str).str.lower().isin(['v1140989197'])][valcol].sum()
                    if pd.notna(total) and total != 0:
                        data_rows.append(('envcleantech_eco_jobs_total', int(year), round(float(total), 0)))
                    clean = ydf[ydf[vcol].astype(str).str.lower().isin(['v1234855548', 'v1234855549', 'v1234855550'])][valcol].sum()
                    if pd.notna(clean) and clean != 0:
                        data_rows.append(('envcleantech_eco_jobs_clean_energy', int(year), round(float(clean), 0)))
        except Exception as e:
            try:
                time.sleep(2)
                wds = self.fetch_wds_vector_data(
                    ['1140989197', '1234855548', '1234855549', '1234855550'],
                    start_ref='2007-01-01'
                )
                total_by_year = {}
                clean_by_year = {}
                total_vec = 1140989197
                clean_vecs = {1234855548, 1234855549, 1234855550}
                for vid, ref_per, value in wds:
                    year = int(str(ref_per)[:4]) if ref_per else None
                    if not year or year < 2007:
                        continue
                    if vid == total_vec:
                        total_by_year[year] = total_by_year.get(year, 0) + value
                    elif vid in clean_vecs:
                        clean_by_year[year] = clean_by_year.get(year, 0) + value
                for year in sorted(set(total_by_year) | set(clean_by_year)):
                    if total_by_year.get(year, 0) != 0:
                        data_rows.append(('envcleantech_eco_jobs_total', year, round(float(total_by_year[year]), 0)))
                    if clean_by_year.get(year, 0) != 0:
                        data_rows.append(('envcleantech_eco_jobs_clean_energy', year, round(float(clean_by_year[year]), 0)))
            except Exception as e2:
                print(f"    Warning: environmental_clean_tech eco jobs fetch failed: {e2}")
        try:
            df = self.fetch_csv_from_url(self._get_ect_eco_exports_url())
            vcol = self.get_column(df, 'VECTOR', 'Vector', 'vector')
            rcol = self.get_column(df, 'REF_DATE', 'Ref_date', 'ref_date')
            valcol = self.get_column(df, 'VALUE', 'Value', 'value')
            if vcol and rcol and valcol:
                sub = df[df[vcol].astype(str).str.lower().isin(['v1140985542'])]
                if not sub.empty:
                    sub = sub.copy()
                    sub['year'] = pd.to_numeric(sub[rcol].astype(str).str[:4], errors='coerce')
                    for year in sub['year'].dropna().unique():
                        yv = sub[sub['year'] == year][valcol].sum()
                        if pd.notna(yv) and yv != 0:
                            data_rows.append(('envcleantech_eco_exports', int(year), round(float(yv), 1)))
        except Exception as e:
            try:
                time.sleep(2)
                wds = self.fetch_wds_vector_data(['1140985542'], start_ref='2007-01-01')
                for _vid, ref_per, value in wds:
                    year = int(str(ref_per)[:4]) if ref_per else None
                    if year and year >= 2007 and value is not None and value != 0:
                        data_rows.append(('envcleantech_eco_exports', year, round(float(value), 1)))
            except Exception as e2:
                print(f"    Warning: environmental_clean_tech eco exports fetch failed: {e2}")
        tmx_ref_year = 2025
        url_tsx = "https://www.tsx.com/resource/en/571"
        xlsx_bytes = self._fetch_tsx_xlsx_bytes()
        if xlsx_bytes:
            parsed = self._parse_tsx_xlsx(xlsx_bytes)
            if parsed:
                tmx_count, tmx_mcap, tmx_can_count, tmx_can_mcap = parsed
                data_rows.append(('envcleantech_tmx_count', tmx_ref_year, float(tmx_count)))
                data_rows.append(('envcleantech_tmx_mcap_total', tmx_ref_year, float(tmx_mcap)))
                data_rows.append(('envcleantech_tmx_can_count', tmx_ref_year, float(tmx_can_count)))
                data_rows.append(('envcleantech_tmx_can_mcap', tmx_ref_year, float(tmx_can_mcap)))
                print(f"    TMX cleantech: {int(tmx_count)} companies, ${tmx_mcap}B total; {int(tmx_can_count)} in Canada, ${tmx_can_mcap}B (ref year {tmx_ref_year})")
            else:
                print("    TMX skipped: XLSX parse failed (check sheet has Sector + Market Cap + HQ Region)")
        else:
            print("    TMX skipped: no XLSX file found (place tsx-and-amp-tsxv-listed-companies-2026-02-17-en.xlsx in EXTERNAL_XLSX_DATA_DIR or set tmx_xlsx_path in config)")
        if data_rows:
            metadata_rows = [
                ('envcleantech_employment_total', 'Employment, total all industries', 'Thousands', 'thousands', source_org_sc, url_labour),
                ('envcleantech_canada_gdp_market', 'Gross domestic product at market prices, Canada', 'Millions of dollars', 'millions', source_org_sc, url_gdp),
                ('envcleantech_eco_gdp', 'Environmental and clean technology GDP, total industries', 'Millions of dollars', 'millions', source_org_sc, url_eco_gdp),
                ('envcleantech_clean_energy_gdp', 'Clean energy GDP (electric power, engineering, equipment)', 'Millions of dollars', 'millions', source_org_sc, url_eco_gdp),
                ('envcleantech_eco_jobs_total', 'Environmental and clean technology products, jobs total', 'Number', 'units', source_org_sc, url_eco_jobs),
                ('envcleantech_eco_jobs_clean_energy', 'Clean energy jobs (electric power, engineering, equipment)', 'Number', 'units', source_org_sc, url_eco_jobs),
                ('envcleantech_eco_exports', 'Environmental and clean technology products, international exports', 'Millions of dollars', 'millions', source_org_sc, url_eco_exports),
            ]
            if any(r[0].startswith('envcleantech_tmx_') for r in data_rows):
                tmx_org = 'Toronto Stock Exchange'
                metadata_rows.extend([
                    ('envcleantech_tmx_count', 'TSX/TSXV cleantech listed companies, count', 'Number', 'units', tmx_org, url_tsx),
                    ('envcleantech_tmx_mcap_total', 'TSX/TSXV cleantech total market capitalization', 'Billions of dollars', 'billions', tmx_org, url_tsx),
                    ('envcleantech_tmx_can_count', 'TSX/TSXV cleantech companies headquartered in Canada', 'Number', 'units', tmx_org, url_tsx),
                    ('envcleantech_tmx_can_mcap', 'TSX/TSXV cleantech Canada-headquartered market capitalization', 'Billions of dollars', 'billions', tmx_org, url_tsx),
                ])
            self.repo.clear_raw_data('environmental_clean_tech')
            return self.store_raw_data('environmental_clean_tech', data_rows, metadata_rows)
        return 0
