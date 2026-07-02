"""Environmental and clean technology (StatCan tables + TSX/TSXV cleantech XLSX)."""

import io
import os
import re
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import pandas as pd
import requests

from .constants import DEFAULT_TMX_XLSX, DEFAULT_TMX_XLSX_ROOT, TSX_CLEANTECH_URL


def _get_future_end_date() -> str:
    """Get end date 5 years in future for StatCan queries."""
    return f"{datetime.now().year + 5}0101"


def _get_ect_labour_url() -> str:
    """Get URL for Table 14-10-0023-01 (Labour force by industry, annual). Vector V2363382."""
    end_date = _get_future_end_date()
    return (
        f"https://www150.statcan.gc.ca/t1/tbl1/en/dtl!downloadDbLoadingData-nonTraduit.action?"
        f"pid=1410002301&latestN=0&startDate=20070101&endDate={end_date}&csvLocale=en"
    )


def _get_ect_gdp_url() -> str:
    """Get URL for Table 36-10-0103-01 (GDP income-based, quarterly). Vectors V62295574, V62295576."""
    end_date = _get_future_end_date()
    return (
        f"https://www150.statcan.gc.ca/t1/tbl1/en/dtl!downloadDbLoadingData-nonTraduit.action?"
        f"pid=3610010301&latestN=0&startDate=20070101&endDate={end_date}&csvLocale=en"
        f"&selectedMembers=%5B%5B1%5D%2C%5B2%5D%2C%5B12%2C14%5D%5D&checkedLevels=0D1"
    )


def _get_ect_eco_jobs_url() -> str:
    """Get URL for Table 36-10-0632-01 (Environmental and clean tech jobs)."""
    end_date = _get_future_end_date()
    return (
        f"https://www150.statcan.gc.ca/t1/tbl1/en/dtl!downloadDbLoadingData-nonTraduit.action?"
        f"pid=3610063201&latestN=0&startDate=20070101&endDate={end_date}&csvLocale=en"
    )


def _get_ect_eco_exports_url() -> str:
    """Get URL for Table 36-10-0629-01 (Environmental and clean tech supply/use, exports)."""
    end_date = _get_future_end_date()
    return (
        f"https://www150.statcan.gc.ca/t1/tbl1/en/dtl!downloadDbLoadingData-nonTraduit.action?"
        f"pid=3610062901&latestN=0&startDate=20070101&endDate={end_date}&csvLocale=en"
    )


def _get_ect_eco_gdp_url() -> str:
    """Get URL for Table 36-10-0645-01 (ECT GDP by industry, eco-sector GDP step)."""
    end_date = _get_future_end_date()
    return (
        f"https://www150.statcan.gc.ca/t1/tbl1/en/dtl!downloadDbLoadingData-nonTraduit.action?"
        f"pid=3610064501&latestN=0&startDate=20120101&endDate={end_date}&csvLocale=en"
    )


def _fetch_tsx_xlsx_bytes(processor) -> Optional[bytes]:
    """Try to load TSX cleantech XLSX from config, then project-root default, then cwd, then scripts/, then download. Returns bytes or None."""
    scripts_dir = Path(__file__).resolve().parent.parent.parent
    project_root = scripts_dir.parent
    cwd = Path.cwd()
    try:
        sec = processor.config.sections.get("section5_indicators", {})
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
            p = base / DEFAULT_TMX_XLSX_ROOT
            if p.is_file():
                data = p.read_bytes()
                print(f"    Loaded TSX XLSX from {label}: {p.name}")
                return data
        default_p = scripts_dir / DEFAULT_TMX_XLSX
        if default_p.is_file():
            data = default_p.read_bytes()
            print(f"    Loaded TSX XLSX: {default_p.name}")
            return data
    except Exception as e:
        print(f"    Warning: TSX local XLSX read failed: {e}")
    url = None
    try:
        sec = processor.config.sections.get("section5_indicators", {})
        src = sec.get("sources", {}).get("environmental_clean_tech", {})
        url = src.get("source_url") or TSX_CLEANTECH_URL
    except Exception:
        url = TSX_CLEANTECH_URL
    try:
        r = processor.fetch_url_with_retry(
            url, timeout=30,
            headers={"User-Agent": "Mozilla/5.0 (compatible; NRCan-Energy-Factbook/1.0)"},
            label="TSX cleantech XLSX",
        )
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
            r2 = processor.fetch_url_with_retry(
                link, timeout=30,
                headers={"User-Agent": "Mozilla/5.0 (compatible; NRCan-Energy-Factbook/1.0)"},
                label="TSX cleantech XLSX link",
            )
            if r2.content[:2] == b"PK":
                return r2.content
    except Exception as e:
        print(f"    Warning: TSX XLSX fetch failed: {e}")
    return None


def _parse_tsx_xlsx(data: bytes) -> Optional[Tuple[int, float, int, float]]:
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


def process_environmental_clean_tech(processor) -> int:
    """Legacy combined handler."""
    return update_environmental_clean_tech(processor) + transform_environmental_clean_tech(processor)


SOURCE_KEY = 'environmental_clean_tech'


def _fetch_statcan_raw(processor, url: str, label: str) -> Tuple[List[Tuple], List[Tuple]]:
    try:
        df = processor.fetch_csv_from_url(url)
        return processor.extract_data_and_metadata(df, SOURCE_KEY)
    except Exception as e:
        print(f'    Warning: {label} CSV fetch failed: {e}')
        return [], []


def _store_wds_raw(processor, vector_ids: List[str], start_ref: str) -> Tuple[List[Tuple], List[Tuple]]:
    data_rows = []
    try:
        wds = processor.fetch_wds_vector_data(vector_ids, start_ref=start_ref)
        for vid, ref_per, value in wds:
            year = str(ref_per)[:4] if ref_per else ''
            if year:
                data_rows.append((f'v{vid}', year, round(float(value), 4)))
    except Exception as e:
        print(f'    Warning: WDS fetch failed for {vector_ids}: {e}')
    metadata = [(f'v{vid.lstrip("vV")}', f'StatCan WDS vector {vid}', '', '', 'Statistics Canada', '') for vid in vector_ids]
    return data_rows, metadata


def update_environmental_clean_tech(processor) -> int:
    """EEDAS ingest: StatCan v* vectors and TSX cleantech XLSX raw counts."""
    data_rows: List[Tuple] = []
    metadata_rows: List[Tuple] = []

    for url, label in [
        (_get_ect_labour_url(), 'labour'),
        (_get_ect_gdp_url(), 'Canada GDP'),
        (_get_ect_eco_gdp_url(), 'ECT GDP'),
        (_get_ect_eco_jobs_url(), 'eco jobs'),
        (_get_ect_eco_exports_url(), 'eco exports'),
    ]:
        rows, meta = _fetch_statcan_raw(processor, url, label)
        data_rows.extend(rows)
        metadata_rows.extend(meta)

    if not any(r[0].lower().startswith('v2363382') or r[0].lower() == 'v2363382' for r in data_rows):
        wds_rows, wds_meta = _store_wds_raw(processor, ['2363382'], '2007-01-01')
        data_rows.extend(wds_rows)
        metadata_rows.extend(wds_meta)

    eco_gdp_vecs = {'v1257883274', 'v1257883276', 'v1257883278', 'v1257883280'}
    if not any(str(r[0]).lower() in eco_gdp_vecs for r in data_rows):
        wds_rows, wds_meta = _store_wds_raw(
            processor, ['1257883274', '1257883276', '1257883278', '1257883280'], '2012-01-01'
        )
        data_rows.extend(wds_rows)
        metadata_rows.extend(wds_meta)

    jobs_vecs = {'v1140989197', 'v1234855548', 'v1234855549', 'v1234855550'}
    if not any(str(r[0]).lower() in jobs_vecs for r in data_rows):
        wds_rows, wds_meta = _store_wds_raw(
            processor, ['1140989197', '1234855548', '1234855549', '1234855550'], '2007-01-01'
        )
        data_rows.extend(wds_rows)
        metadata_rows.extend(wds_meta)

    if not any(str(r[0]).lower() == 'v1140985542' for r in data_rows):
        wds_rows, wds_meta = _store_wds_raw(processor, ['1140985542'], '2007-01-01')
        data_rows.extend(wds_rows)
        metadata_rows.extend(wds_meta)

    tmx_ref_year = 2025
    xlsx_bytes = _fetch_tsx_xlsx_bytes(processor)
    if xlsx_bytes:
        parsed = _parse_tsx_xlsx(xlsx_bytes)
        if parsed:
            tmx_count, tmx_mcap, tmx_can_count, tmx_can_mcap = parsed
            data_rows.extend([
                ('tmx_count', tmx_ref_year, float(tmx_count)),
                ('tmx_mcap_total', tmx_ref_year, float(tmx_mcap)),
                ('tmx_can_count', tmx_ref_year, float(tmx_can_count)),
                ('tmx_can_mcap', tmx_ref_year, float(tmx_can_mcap)),
            ])
            print(f'    TMX cleantech raw: {int(tmx_count)} companies (ref year {tmx_ref_year})')

    if not data_rows:
        raise RuntimeError('environmental_clean_tech: no source-native rows produced')

    seen = set()
    unique_meta = []
    for row in metadata_rows:
        if row[0] not in seen:
            seen.add(row[0])
            unique_meta.append(row)
    n = processor.replace_raw_data(SOURCE_KEY, data_rows, unique_meta)
    print(f'    Stored {n} source-native rows for environmental_clean_tech')
    return n


def _sum_vec_year(df, vectors: set, year: int) -> float:
    if df.empty:
        return 0.0
    sub = df[df['vector'].astype(str).str.lower().isin({v.lower() for v in vectors})]
    total = 0.0
    for _, row in sub.iterrows():
        try:
            if int(str(row['ref_date'])[:4]) == year:
                total += float(row['value'])
        except (TypeError, ValueError):
            continue
    return total


def transform_environmental_clean_tech(processor) -> int:
    """EFB transform: aggregate StatCan v* and TSX raw rows into envcleantech_* indicators."""
    df = processor.get_raw_dataframe(SOURCE_KEY)
    if df.empty:
        raise RuntimeError('environmental_clean_tech transform: no raw rows found')

    data_rows = []
    source_org_sc = 'Statistics Canada'
    url_labour = 'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=1410002301'
    url_gdp = 'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=3610010301'
    url_eco_gdp = 'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=3610064501'
    url_eco_jobs = 'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=3610063201'
    url_eco_exports = 'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=3610062901'

    years = sorted(set(int(str(y)[:4]) for y in df['ref_date'].dropna().unique() if str(y)[:4].isdigit()))

    for year in years:
        if year < 2007:
            continue
        yv = _sum_vec_year(df, {'v2363382'}, year)
        if yv != 0:
            data_rows.append(('envcleantech_employment_total', year, round(yv, 1)))

    for year in years:
        gdp_mp = _sum_vec_year(df, {'v62295576'}, year)
        if gdp_mp != 0:
            data_rows.append(('envcleantech_canada_gdp_market', year, round(gdp_mp, 1)))

    for year in years:
        if year < 2012:
            continue
        eco = _sum_vec_year(df, {'v1257883274'}, year)
        if eco != 0:
            data_rows.append(('envcleantech_eco_gdp', year, round(eco, 1)))
        clean = _sum_vec_year(df, {'v1257883276', 'v1257883278', 'v1257883280'}, year)
        if clean != 0:
            data_rows.append(('envcleantech_clean_energy_gdp', year, round(clean, 1)))

    for year in years:
        if year < 2007:
            continue
        total = _sum_vec_year(df, {'v1140989197'}, year)
        if total != 0:
            data_rows.append(('envcleantech_eco_jobs_total', year, round(total, 0)))
        clean = _sum_vec_year(df, {'v1234855548', 'v1234855549', 'v1234855550'}, year)
        if clean != 0:
            data_rows.append(('envcleantech_eco_jobs_clean_energy', year, round(clean, 0)))

    for year in years:
        if year < 2007:
            continue
        yv = _sum_vec_year(df, {'v1140985542'}, year)
        if yv != 0:
            data_rows.append(('envcleantech_eco_exports', year, round(yv, 1)))

    tmx_ref_year = 2025
    url_tsx = 'https://www.tsx.com/resource/en/571'
    for raw_vec, ind_vec in [
        ('tmx_count', 'envcleantech_tmx_count'),
        ('tmx_mcap_total', 'envcleantech_tmx_mcap_total'),
        ('tmx_can_count', 'envcleantech_tmx_can_count'),
        ('tmx_can_mcap', 'envcleantech_tmx_can_mcap'),
    ]:
        sub = df[df['vector'].astype(str) == raw_vec]
        if not sub.empty:
            data_rows.append((ind_vec, tmx_ref_year, float(sub.iloc[0]['value'])))

    if not data_rows:
        raise RuntimeError('environmental_clean_tech transform: no indicator rows produced')

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

    n = processor.store_indicators(SOURCE_KEY, data_rows, metadata_rows)
    print(f'    Stored {n} indicator rows for environmental_clean_tech')
    return n
