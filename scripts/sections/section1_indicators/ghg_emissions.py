"""GHG emissions by economic sector (Page 20 / Page 132) — ECCC GHG_Econ_Can_Prov_Terr.csv."""

import io
from typing import Dict, List, Optional, Tuple

import pandas as pd
import requests

from utils.http_retry import fetch_get, resilience_from_config

GHG_SOURCE_ORG = "Environment and Climate Change Canada"

GHG_ECON_CSV_PATH = (
    "/substances/monitor/canada-s-official-greenhouse-gas-inventory"
    "/B-Economic-Sector/GHG_Econ_Can_Prov_Terr.csv"
)

GHG_DEFAULT_SOURCE_URLS = [
    f"https://data-donnees.ec.gc.ca/api/file?path={GHG_ECON_CSV_PATH.replace('/', '%2F')}",
    f"https://data-donnees.az.ec.gc.ca/api/file?path={GHG_ECON_CSV_PATH.replace('/', '%2F')}",
]

GHG_CHART_MIN_YEAR = 2020
GHG_SPOTLIGHT_MIN_YEAR = 2000
GHG_SPOTLIGHT_MAX_YEAR = 2023
GHG_NARRATIVE_BASE_YEAR = 2000
GHG_NARRATIVE_END_YEAR = 2023

GHG_VALUE_COLUMN = "Total (kt CO2e)"
GHG_KT_TO_MT = 1000.0

GHG_SOURCE_TO_VECTOR = {
    "Oil and Gas": "ghg_oil_gas",
    "Electricity": "ghg_electricity",
    "Transport": "ghg_transportation",
    "Heavy Industry": "ghg_heavy_industry",
    "Buildings": "ghg_buildings",
    "Agriculture": "ghg_agriculture",
}

GHG_WASTE_OTHERS_SOURCES = (
    "Waste",
    "Coal Production",
    "Light Manufacturing, Construction and Forest Resources",
)

GHG_SPOTLIGHT_SUBSECTORS = {
    "oil_sands": "Oil Sands and Thermal Heavy Oil Production",
    "conventional_oil": "Conventional Oil Production",
    "natural_gas": "Natural Gas Production and Processing",
}

GHG_VECTOR_METADATA = {
    "ghg_oil_gas": "GHG Emissions - Oil and Gas",
    "ghg_electricity": "GHG Emissions - Electricity",
    "ghg_transportation": "GHG Emissions - Transportation",
    "ghg_heavy_industry": "GHG Emissions - Heavy Industry",
    "ghg_buildings": "GHG Emissions - Buildings",
    "ghg_agriculture": "GHG Emissions - Agriculture",
    "ghg_waste_others": "GHG Emissions - Waste and Others",
    "ghg_oilgas_spotlight_oil_sands": "GHG oil and gas spotlight - Oil sands",
    "ghg_oilgas_spotlight_natural_gas": "GHG oil and gas spotlight - Natural gas",
    "ghg_oilgas_spotlight_conventional_oil": "GHG oil and gas spotlight - Conventional oil",
    "ghg_oilgas_spotlight_other": "GHG oil and gas spotlight - Other",
}

GHG_STAT_METADATA = {
    "ghg_stat_narrative_base_year": ("GHG narrative comparison base year", "year", "none"),
    "ghg_stat_narrative_end_year": ("GHG narrative comparison end year", "year", "none"),
    "ghg_stat_electricity_emissions_pct": ("Electricity GHG emissions percent change (narrative period)", "percent", "units"),
    "ghg_stat_oil_gas_emissions_pct": ("Oil and gas GHG emissions percent change (narrative period)", "percent", "units"),
    "ghg_stat_heavy_industry_emissions_pct": ("Heavy industry GHG emissions percent change (narrative period)", "percent", "units"),
    "ghg_stat_oil_gas_spotlight_total_pct": ("Oil and gas spotlight total emissions percent change", "percent", "units"),
    "ghg_stat_conv_gas_emissions_pct": ("Conventional oil and natural gas emissions percent change", "percent", "units"),
    "ghg_stat_oil_sands_emissions_ratio": ("Oil sands emissions ratio (end year / base year)", "ratio", "units"),
    "ghg_stat_crude_production_pct": ("Canadian crude oil production percent change (StatCan)", "percent", "units"),
}

GHG_REQUEST_HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; NRCan-Energy-Factbook/1.0)",
    "Accept": "text/csv,application/octet-stream,*/*",
}


def _fetch_ghg_econ_csv(
    source_urls: Optional[List[str]] = None,
    timeout: int = 120,
    max_retries: int = 3,
    retry_delay_seconds: int = 2,
) -> Tuple[bytes, str]:
    """Download GHG economic-sector CSV; tries primary then fallback URLs."""
    urls = source_urls or GHG_DEFAULT_SOURCE_URLS
    last_error: Optional[Exception] = None
    for url in urls:
        try:
            response = fetch_get(
                url,
                timeout=timeout,
                headers=GHG_REQUEST_HEADERS,
                max_retries=max_retries,
                retry_delay_seconds=retry_delay_seconds,
                label="GHG CSV",
            )
            content = response.content
            if not content or content[:15].lstrip().startswith(b"<!doctype"):
                raise ValueError("Response is HTML, not CSV")
            if b"Year" not in content[:500] and b"Region" not in content[:500]:
                raise ValueError("Response does not look like GHG CSV")
            print(f"  Downloaded GHG CSV ({len(content):,} bytes) from {url}")
            return content, url
        except Exception as exc:
            last_error = exc
            print(f"  Warning: GHG CSV fetch failed for {url}: {exc}")
    raise RuntimeError(f"Could not download GHG economic-sector CSV: {last_error}")


def _ghg_sector_total_rows(df: pd.DataFrame) -> pd.DataFrame:
    """Keep Canada source-level totals (Sector blank; Total=Y when flagged)."""
    totals = df["Total"].astype(str).str.lower()
    mask = df["Sector"].isna() & (df["Total"].isna() | (totals == "y"))
    rows = df.loc[mask].copy()
    return rows.sort_values("Index").groupby(["Year", "Source"], as_index=False).first()


def _ghg_subsector_total_mt(df: pd.DataFrame, sub_sector: str, year: int) -> Optional[float]:
    """Return sub-sector total in Mt for Canada Oil and Gas."""
    sub = df[
        (df["Region"] == "Canada")
        & (df["Source"] == "Oil and Gas")
        & (df["Sub-sector"] == sub_sector)
        & (df["Year"] == year)
    ]
    if sub.empty:
        return None
    yrows = sub[sub["Total"].astype(str).str.lower() == "y"]
    row = yrows.iloc[0] if len(yrows) else sub.sort_values("Index").iloc[0]
    val = row[GHG_VALUE_COLUMN]
    if pd.isna(val):
        return None
    return float(val) / GHG_KT_TO_MT


def _ghg_source_total_mt(canada: pd.DataFrame, source: str, year: int) -> Optional[float]:
    rows = _ghg_sector_total_rows(canada[canada["Year"] == year])
    match = rows[rows["Source"] == source]
    if match.empty:
        return None
    val = match.iloc[0][GHG_VALUE_COLUMN]
    if pd.isna(val):
        return None
    return float(val) / GHG_KT_TO_MT


def _ghg_pct_change(v0: float, v1: float) -> int:
    return round((v1 - v0) / v0 * 100)


def _build_ghg_chart_rows(
    by_source_year: Dict[Tuple[str, int], float],
    min_year: int = GHG_CHART_MIN_YEAR,
) -> List[Tuple[str, int, float]]:
    years = sorted({year for (_, year) in by_source_year if year >= min_year})
    sector_data = {key: {} for key in list(GHG_SOURCE_TO_VECTOR.values()) + ["ghg_waste_others"]}

    for source_name, vector in GHG_SOURCE_TO_VECTOR.items():
        for year in years:
            value_mt = by_source_year.get((source_name, year))
            if value_mt is not None:
                sector_data[vector][year] = value_mt

    for year in years:
        waste_others_mt = sum(
            by_source_year.get((source_name, year), 0.0)
            for source_name in GHG_WASTE_OTHERS_SOURCES
        )
        if waste_others_mt:
            sector_data["ghg_waste_others"][year] = waste_others_mt

    output_vectors = list(GHG_SOURCE_TO_VECTOR.values()) + ["ghg_waste_others"]
    data_rows: List[Tuple[str, int, float]] = []
    for vector in output_vectors:
        for year, value_mt in sorted(sector_data.get(vector, {}).items()):
            data_rows.append((vector, year, round(value_mt, 1)))
    return data_rows


def _build_ghg_spotlight_rows(
    df: pd.DataFrame,
    min_year: int = GHG_SPOTLIGHT_MIN_YEAR,
    max_year: int = GHG_SPOTLIGHT_MAX_YEAR,
) -> List[Tuple[str, int, float]]:
    """Page 132 stacked chart: oil sands, conventional oil, natural gas, other."""
    years = sorted(
        y for y in df["Year"].dropna().astype(int).unique()
        if min_year <= y <= max_year
    )
    data_rows: List[Tuple[str, int, float]] = []

    for year in years:
        sands = _ghg_subsector_total_mt(df, GHG_SPOTLIGHT_SUBSECTORS["oil_sands"], year)
        conv = _ghg_subsector_total_mt(df, GHG_SPOTLIGHT_SUBSECTORS["conventional_oil"], year)
        gas = _ghg_subsector_total_mt(df, GHG_SPOTLIGHT_SUBSECTORS["natural_gas"], year)
        total = _ghg_source_total_mt(df, "Oil and Gas", year)
        if sands is None or conv is None or gas is None or total is None:
            continue
        other = max(0.0, total - sands - conv - gas)
        data_rows.extend([
            ("ghg_oilgas_spotlight_oil_sands", year, round(sands, 1)),
            ("ghg_oilgas_spotlight_natural_gas", year, round(gas, 1)),
            ("ghg_oilgas_spotlight_conventional_oil", year, round(conv, 1)),
            ("ghg_oilgas_spotlight_other", year, round(other, 1)),
        ])

    return data_rows


def _build_ghg_stat_rows(
    df: pd.DataFrame,
    base_year: int = GHG_NARRATIVE_BASE_YEAR,
    end_year: int = GHG_NARRATIVE_END_YEAR,
) -> List[Tuple[str, int, float]]:
    """Derived narrative statistics (not used for Page 20/132 charts)."""
    canada = df[df["Region"] == "Canada"].copy()
    rows: List[Tuple[str, int, float]] = [
        ("ghg_stat_narrative_base_year", end_year, float(base_year)),
        ("ghg_stat_narrative_end_year", end_year, float(end_year)),
    ]

    sector_map = {
        "ghg_stat_electricity_emissions_pct": "Electricity",
        "ghg_stat_oil_gas_emissions_pct": "Oil and Gas",
        "ghg_stat_heavy_industry_emissions_pct": "Heavy Industry",
    }
    for vector, source in sector_map.items():
        v0 = _ghg_source_total_mt(canada, source, base_year)
        v1 = _ghg_source_total_mt(canada, source, end_year)
        if v0 is not None and v1 is not None and v0 != 0:
            rows.append((vector, end_year, float(_ghg_pct_change(v0, v1))))

    sands0 = _ghg_subsector_total_mt(canada, GHG_SPOTLIGHT_SUBSECTORS["oil_sands"], base_year)
    sands1 = _ghg_subsector_total_mt(canada, GHG_SPOTLIGHT_SUBSECTORS["oil_sands"], end_year)
    conv0 = _ghg_subsector_total_mt(canada, GHG_SPOTLIGHT_SUBSECTORS["conventional_oil"], base_year)
    conv1 = _ghg_subsector_total_mt(canada, GHG_SPOTLIGHT_SUBSECTORS["conventional_oil"], end_year)
    gas0 = _ghg_subsector_total_mt(canada, GHG_SPOTLIGHT_SUBSECTORS["natural_gas"], base_year)
    gas1 = _ghg_subsector_total_mt(canada, GHG_SPOTLIGHT_SUBSECTORS["natural_gas"], end_year)
    total0 = _ghg_source_total_mt(canada, "Oil and Gas", base_year)
    total1 = _ghg_source_total_mt(canada, "Oil and Gas", end_year)

    if total0 and total1:
        rows.append(("ghg_stat_oil_gas_spotlight_total_pct", end_year, float(_ghg_pct_change(total0, total1))))
    if sands0 and sands1 and sands0 > 0:
        rows.append(("ghg_stat_oil_sands_emissions_ratio", end_year, round(sands1 / sands0, 2)))
    if None not in (conv0, conv1, gas0, gas1) and (conv0 + gas0) != 0:
        rows.append((
            "ghg_stat_conv_gas_emissions_pct",
            end_year,
            float(_ghg_pct_change(conv0 + gas0, conv1 + gas1)),
        ))

    crude_pct = _fetch_ghg_crude_production_pct_change(base_year, end_year)
    if crude_pct is not None:
        rows.append(("ghg_stat_crude_production_pct", end_year, float(crude_pct)))

    return rows


def _fetch_ghg_crude_production_pct_change(base_year: int, end_year: int) -> Optional[int]:
    """StatCan crude production (section 6 oil sands pipeline)."""
    try:
        from ..section6_indicators.oil_sands import build_oil_sands_rows
        by_year: Dict[int, float] = {}
        for vector, year_str, value in build_oil_sands_rows():
            if vector != "os_total_thousand_m3":
                continue
            by_year[int(year_str)] = float(value)
        v0, v1 = by_year.get(base_year), by_year.get(end_year)
        if v0 is None or v1 is None or v0 == 0:
            return None
        return _ghg_pct_change(v0, v1)
    except Exception as exc:
        print(f"  Warning: crude production stat skipped: {exc}")
        return None


def _ghg_row_vector(row) -> str:
    region = row.get('Region', '')
    source = row.get('Source', '')
    sub_sector = row.get('Sub-sector', '') or ''
    sector = row.get('Sector', '') or ''
    total = row.get('Total', '') or ''
    return f"{region}|{source}|{sub_sector}|{sector}|{total}"


def _reconstruct_ghg_df(raw_df: pd.DataFrame) -> pd.DataFrame:
    records = []
    for _, row in raw_df.iterrows():
        parts = str(row['vector']).split('|')
        records.append({
            'Region': parts[0] if len(parts) > 0 else None,
            'Source': parts[1] if len(parts) > 1 else None,
            'Sub-sector': parts[2] if len(parts) > 2 and parts[2] else None,
            'Sector': parts[3] if len(parts) > 3 and parts[3] else None,
            'Total': parts[4] if len(parts) > 4 and parts[4] else None,
            'Year': int(row['ref_date']),
            GHG_VALUE_COLUMN: row['value'],
            'Index': 0,
        })
    return pd.DataFrame(records)


def _build_ghg_rows_from_df(
    df: pd.DataFrame,
    source_url: str,
    chart_min_year: int = GHG_CHART_MIN_YEAR,
) -> Tuple[List[Tuple[str, int, float]], List[Tuple[str, str, str, str, str, str]]]:
    """Build indicator rows from an in-memory GHG economic-sector DataFrame."""
    df = df.copy()
    df[GHG_VALUE_COLUMN] = pd.to_numeric(df[GHG_VALUE_COLUMN], errors='coerce')
    df['Year'] = pd.to_numeric(df['Year'], errors='coerce').astype('Int64')

    canada = df[df['Region'] == 'Canada'].copy()
    if canada.empty:
        print("  Warning: No Canada rows in GHG CSV")
        return [], []

    sector_rows = _ghg_sector_total_rows(canada)
    by_source_year = {
        (row['Source'], int(row['Year'])): float(row[GHG_VALUE_COLUMN]) / GHG_KT_TO_MT
        for _, row in sector_rows.iterrows()
        if pd.notna(row[GHG_VALUE_COLUMN])
    }

    chart_rows = _build_ghg_chart_rows(by_source_year, min_year=chart_min_year)
    spotlight_rows = _build_ghg_spotlight_rows(canada)
    stat_rows = _build_ghg_stat_rows(canada)
    data_rows = chart_rows + spotlight_rows + stat_rows

    metadata_rows = [
        (vector, title, 'Mt CO2 eq', 'megatonnes', GHG_SOURCE_ORG, source_url)
        for vector, title in GHG_VECTOR_METADATA.items()
    ]
    metadata_rows.extend([
        (vector, title, uom, scalar, GHG_SOURCE_ORG, source_url)
        for vector, (title, uom, scalar) in GHG_STAT_METADATA.items()
    ])

    chart_years = sorted({year for (_, year, _) in chart_rows})
    if chart_years:
        print(f"  Chart series: {len(chart_rows)} rows ({min(chart_years)}–{max(chart_years)})")
    print(f"  Spotlight series: {len(spotlight_rows)} rows ({GHG_SPOTLIGHT_MIN_YEAR}–{GHG_SPOTLIGHT_MAX_YEAR})")
    print(f"  Narrative stats: {len(stat_rows)} values")

    return data_rows, metadata_rows


def build_ghg_emissions_rows(
    source_urls: Optional[List[str]] = None,
    chart_min_year: int = GHG_CHART_MIN_YEAR,
    max_retries: int = 3,
    retry_delay_seconds: int = 2,
) -> Tuple[List[Tuple[str, int, float]], List[Tuple[str, str, str, str, str, str]]]:
    """
    Build pipeline rows from ECCC GHG_Econ_Can_Prov_Terr.csv.

    Returns chart series (2020+), Page 132 spotlight (2000–2023), and narrative stats.
    """
    print("Processing GHG Emissions by Economic Sector data (ECCC CSV)...")
    content, source_url = _fetch_ghg_econ_csv(
        source_urls,
        max_retries=max_retries,
        retry_delay_seconds=retry_delay_seconds,
    )

    df = pd.read_csv(io.BytesIO(content))
    data_rows, metadata_rows = _build_ghg_rows_from_df(df, source_url, chart_min_year=chart_min_year)

    for source_name, vector in GHG_SOURCE_TO_VECTOR.items():
        found = sum(
            1 for (vector_name, _year, _val) in data_rows
            if vector_name == vector
        )
        if found:
            print(f"  Found '{source_name}' -> {vector} ({found} rows)")

    return data_rows, metadata_rows


def update_ghg_emissions(processor) -> int:
    """EEDAS ingest: fetch ECCC CSV and store publisher-native rows."""
    source_cfg = (
        processor.config.sections.get("section1_indicators", {})
        .get("sources", {})
        .get("ghg_emissions", {})
    )
    source_url = source_cfg.get("source_url")
    source_urls = [source_url] if source_url else None
    max_retries, retry_delay = resilience_from_config(processor.config)

    print("  Fetching GHG emissions data (ECCC CSV)...")
    content, resolved_url = _fetch_ghg_econ_csv(
        source_urls,
        max_retries=max_retries,
        retry_delay_seconds=retry_delay,
    )
    df = pd.read_csv(io.BytesIO(content))
    df[GHG_VALUE_COLUMN] = pd.to_numeric(df[GHG_VALUE_COLUMN], errors='coerce')
    df['Year'] = pd.to_numeric(df['Year'], errors='coerce')

    data_rows = []
    metadata_rows = []
    seen = set()
    for _, row in df.iterrows():
        if pd.isna(row.get(GHG_VALUE_COLUMN)) or pd.isna(row.get('Year')):
            continue
        vector = _ghg_row_vector(row)
        ref_date = str(int(row['Year']))
        data_rows.append((vector, ref_date, float(row[GHG_VALUE_COLUMN])))
        if vector not in seen:
            seen.add(vector)
            metadata_rows.append((
                vector,
                f"{row.get('Source', '')} ({row.get('Region', '')})",
                'kt CO2 eq',
                'kilotonnes',
                GHG_SOURCE_ORG,
                resolved_url,
            ))

    if not data_rows:
        raise RuntimeError("GHG emissions: no raw rows produced after fetch")
    return processor.replace_raw_data('ghg_emissions', data_rows, metadata_rows)


def transform_ghg_emissions(processor) -> int:
    """EFB transform: build ghg_* indicator vectors from raw ECCC rows."""
    raw_df = processor.repo.get_raw_dataframe('ghg_emissions')
    if raw_df is None or raw_df.empty:
        print("    Warning: No raw GHG emissions data in database")
        return 0

    source_url = ''
    if 'source_url' in raw_df.columns and raw_df['source_url'].notna().any():
        source_url = str(raw_df['source_url'].dropna().iloc[0])

    df = _reconstruct_ghg_df(raw_df)
    data_rows, metadata_rows = _build_ghg_rows_from_df(df, source_url)
    if not data_rows:
        raise RuntimeError("GHG emissions: no indicator rows produced after transform")
    return processor.store_indicators('ghg_emissions', data_rows, metadata_rows)


def process_ghg_emissions(processor) -> int:
    """Deprecated: run update then transform."""
    return update_ghg_emissions(processor) + transform_ghg_emissions(processor)
