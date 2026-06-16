"""Page 78 — Canadian production of solid biofuels (RenAQ + StatCan 25-10-0031-01)."""

from __future__ import annotations

import time
import zipfile
from typing import Dict, List, Tuple

import pandas as pd

from config_loader import get_config
from sections.section6_indicators.oil_sands import _download_os_statcan_csv
from utils.http_retry import resilience_from_config
from utils.io_retry import ensure_workbook, read_excel_with_retry, run_with_retry

from .constants import (
    RENAQ_XLSX,
    SBIO_METADATA,
    SBIO_RAW_PREFIX,
    SBIO_STATCAN_WOOD_WASTE_TABLE,
    SBIO_STATCAN_WOOD_WASTE_URL,
    SBIO_WOOD_LIQUOR_CF,
    SBIO_WOOD_WASTE_CF,
)

SOURCE_KEY = 'solid_biofuels'

PRODUCT_FWR = 'Fuelwood, wood residues and by-products'
PRODUCT_WP = 'Wood pellets'
PRODUCT_BL = 'Black liquor'
SECTOR_RES = 'Residential'
SECTOR_TS = 'Transformation sector'
SECTOR_IS = 'Industry sector'
SECTOR_INCALC = 'Inland consumption (calculated)'
FUEL_SWW = 'Solid wood waste'
FUEL_SPL = 'Spent pulping liquor'

STATCAN_REQUIRED_COLUMNS = frozenset({'GEO', 'Fuel type', 'Measures', 'REF_DATE', 'VALUE'})
RENAQ_SG_SHEET = 'SGBIOFUELS'
RENAQ_PB_SHEET = 'PRIMSBIO'


def _normalize_renaq_frame(frame: pd.DataFrame, sheet: str) -> pd.DataFrame:
    if 'Year' not in frame.columns or 'Value' not in frame.columns:
        raise ValueError(
            f'solid_biofuels: {RENAQ_XLSX} sheet {sheet!r} missing Year/Value columns '
            f'(found {frame.columns.tolist()})'
        )
    out = frame.dropna(subset=['Year']).copy()
    out['Year'] = pd.to_numeric(out['Year'], errors='coerce')
    out.dropna(subset=['Year'], inplace=True)
    out['Year'] = out['Year'].astype(int)
    if out.empty:
        raise ValueError(f'solid_biofuels: {RENAQ_XLSX} sheet {sheet!r} has no year rows')
    return out


def _read_renaq_sheets(config=None) -> Tuple[pd.DataFrame, pd.DataFrame]:
    cfg = config or get_config()

    def _load() -> Tuple[pd.DataFrame, pd.DataFrame]:
        path = ensure_workbook(RENAQ_XLSX, config=cfg)
        sg = read_excel_with_retry(
            path, RENAQ_SG_SHEET, config=cfg, label=f'{RENAQ_XLSX} {RENAQ_SG_SHEET}'
        )
        pb = read_excel_with_retry(
            path, RENAQ_PB_SHEET, config=cfg, label=f'{RENAQ_XLSX} {RENAQ_PB_SHEET}'
        )
        return _normalize_renaq_frame(sg, RENAQ_SG_SHEET), _normalize_renaq_frame(pb, RENAQ_PB_SHEET)

    return run_with_retry(_load, config=cfg, label=f'{RENAQ_XLSX} load')


def _validate_statcan_wood_waste(df: pd.DataFrame) -> pd.DataFrame:
    missing = STATCAN_REQUIRED_COLUMNS - set(df.columns)
    if missing:
        raise ValueError(
            f'solid_biofuels: StatCan table {SBIO_STATCAN_WOOD_WASTE_TABLE} missing columns {sorted(missing)}'
        )
    canada = df[df['GEO'].astype(str).str.strip() == 'Canada']
    if canada.empty:
        raise ValueError('solid_biofuels: StatCan wood-waste table has no Canada rows')
    return df


def _load_statcan_wood_waste(config=None) -> pd.DataFrame:
    cfg = config or get_config()
    max_r, delay = resilience_from_config(cfg)
    last_error: Exception | None = None

    for attempt in range(max_r):
        try:
            if attempt > 0:
                wait = delay * attempt
                print(
                    f'  Retrying StatCan wood-waste CSV '
                    f'(attempt {attempt + 1}/{max_r}, wait {wait}s)...'
                )
                time.sleep(wait)
            df = _download_os_statcan_csv(SBIO_STATCAN_WOOD_WASTE_TABLE, config=cfg)
            return _validate_statcan_wood_waste(df)
        except (ValueError, KeyError, zipfile.BadZipFile, RuntimeError) as exc:
            last_error = exc
            if attempt >= max_r - 1:
                break

    raise RuntimeError(
        f'solid_biofuels: failed to load StatCan table {SBIO_STATCAN_WOOD_WASTE_TABLE} '
        f'after {max_r} attempts: {last_error}'
    ) from last_error


def _canada_wood_waste_tj(statcan_df: pd.DataFrame, year: int, fuel_type: str) -> float:
    rows = statcan_df[
        (statcan_df['GEO'] == 'Canada')
        & (statcan_df['Fuel type'] == fuel_type)
        & (statcan_df['Measures'] == 'Terajoules')
        & (statcan_df['REF_DATE'].astype(str).str.startswith(str(year)))
    ]
    if rows.empty:
        raise ValueError(f'solid_biofuels: no StatCan {fuel_type} row for {year}')
    return float(rows['VALUE'].iloc[0])


def _value_for(df: pd.DataFrame, year: int, column: str, match_value: str) -> float:
    rows = df[(df['Year'] == year) & (df[column].astype(str).str.strip() == match_value)]
    if rows.empty:
        raise ValueError(f'solid_biofuels: missing {match_value} for {year}')
    return float(rows['Value'].iloc[0])


def _compute_industrial_pj(is_tj: float, sww: float, spl: float) -> int:
    """Spec steps 5–7: Isc (PJ) = Is×ICEsw×wcf + Is×ICEspl×splcf, rounded."""
    twpl = sww + spl
    if twpl <= 0:
        raise ValueError('solid_biofuels: sww + spl must be positive for industrial share')
    icesw = sww / twpl
    icespl = spl / twpl
    isc_tj = is_tj * icesw * SBIO_WOOD_WASTE_CF + is_tj * icespl * SBIO_WOOD_LIQUOR_CF
    return round(isc_tj / 1000)


def _compute_year_row(
    year: int,
    sg: pd.DataFrame,
    pb: pd.DataFrame,
    statcan_df: pd.DataFrame,
) -> Dict[str, int]:
    fwr = _value_for(sg, year, 'Product', PRODUCT_FWR)
    wp = _value_for(sg, year, 'Product', PRODUCT_WP)
    bl = _value_for(sg, year, 'Product', PRODUCT_BL)
    res = _value_for(pb, year, 'Sector/flow', SECTOR_RES)
    ts = _value_for(pb, year, 'Sector/flow', SECTOR_TS)
    is_val = _value_for(pb, year, 'Sector/flow', SECTOR_IS)

    swr = round((fwr - wp - res) / 1000)
    pellets = round(wp / 1000)
    pulping = round(bl / 1000)
    firewood = round(res / 1000)
    electricity = round(ts / 1000)
    residential = round(res / 1000)

    sww = _canada_wood_waste_tj(statcan_df, year, FUEL_SWW)
    spl = _canada_wood_waste_tj(statcan_df, year, FUEL_SPL)
    industrial = _compute_industrial_pj(is_val, sww, spl)
    total = electricity + residential + industrial

    return {
        'pulping': pulping,
        'swr': swr,
        'firewood': firewood,
        'pellets': pellets,
        'electricity': electricity,
        'residential': residential,
        'industrial': industrial,
        'total': total,
    }


def _build_indicator_rows(config=None) -> Tuple[List[Tuple[str, str, float]], List[Tuple[str, str, str, str, str, str]]]:
    sg, pb = _read_renaq_sheets(config)
    statcan_df = _load_statcan_wood_waste(config)
    years = sorted(set(sg['Year']) & set(pb['Year']))
    if not years:
        raise ValueError('solid_biofuels: RenAQ sheets have no overlapping years')

    data_rows: List[Tuple[str, str, float]] = []
    metadata_rows: List[Tuple[str, str, str, str, str, str]] = []
    seen_meta: set[str] = set()
    skipped_years: List[str] = []

    for year in years:
        try:
            values = _compute_year_row(year, sg, pb, statcan_df)
        except ValueError as exc:
            skipped_years.append(f'{year} ({exc})')
            continue
        vector_map = {
            'pulping': 'sbio_prod_pulping',
            'swr': 'sbio_prod_swr',
            'firewood': 'sbio_prod_firewood',
            'pellets': 'sbio_prod_pellets',
            'electricity': 'sbio_use_electricity',
            'residential': 'sbio_use_residential',
            'industrial': 'sbio_use_industrial',
            'total': 'sbio_use_total',
        }
        for key, value in values.items():
            vector = vector_map[key]
            data_rows.append((vector, str(year), float(value)))
            if vector not in seen_meta:
                meta = next((row for row in SBIO_METADATA if row[0] == vector), None)
                if meta:
                    metadata_rows.append(meta)
                    seen_meta.add(vector)

    if skipped_years:
        print(f'    Warning: solid_biofuels skipped {len(skipped_years)} year(s): {", ".join(skipped_years)}')

    if not data_rows:
        raise ValueError('solid_biofuels: no publishable rows produced')

    return data_rows, metadata_rows


def update_solid_biofuels(processor) -> int:
    """EEDAS ingest: store raw RenAQ + StatCan inputs (prefixed)."""
    sg, pb = _read_renaq_sheets(processor.config)
    statcan_df = _load_statcan_wood_waste(processor.config)
    years = sorted(set(sg['Year']) & set(pb['Year']))
    if not years:
        raise ValueError('solid_biofuels update: RenAQ sheets have no overlapping years')

    data_rows: List[Tuple[str, str, float]] = []
    metadata_rows: List[Tuple[str, str, str, str, str, str]] = []
    skipped_years: List[str] = []

    for year in years:
        try:
            fwr = _value_for(sg, year, 'Product', PRODUCT_FWR)
            wp = _value_for(sg, year, 'Product', PRODUCT_WP)
            bl = _value_for(sg, year, 'Product', PRODUCT_BL)
            res = _value_for(pb, year, 'Sector/flow', SECTOR_RES)
            ts = _value_for(pb, year, 'Sector/flow', SECTOR_TS)
            is_val = _value_for(pb, year, 'Sector/flow', SECTOR_IS)
            incalc = _value_for(pb, year, 'Sector/flow', SECTOR_INCALC)
            sww = _canada_wood_waste_tj(statcan_df, year, FUEL_SWW)
            spl = _canada_wood_waste_tj(statcan_df, year, FUEL_SPL)
        except ValueError as exc:
            skipped_years.append(f'{year} ({exc})')
            continue
        raw_pairs = [
            ('fwr_bp', fwr),
            ('wp', wp),
            ('bl', bl),
            ('res', res),
            ('ts', ts),
            ('is', is_val),
            ('incalc', incalc),
            ('sww', sww),
            ('spl', spl),
        ]
        for suffix, value in raw_pairs:
            vector = f'{SBIO_RAW_PREFIX}_{suffix}'
            data_rows.append((vector, str(year), round(float(value), 4)))
            metadata_rows.append((
                vector,
                f'Solid biofuels raw {suffix}, {year}',
                'TJ',
                'terajoules',
                'Natural Resources Canada / Statistics Canada',
                SBIO_STATCAN_WOOD_WASTE_URL if suffix in ('sww', 'spl') else '',
            ))

    if skipped_years:
        print(f'    Warning: solid_biofuels update skipped {len(skipped_years)} year(s): {", ".join(skipped_years)}')

    if not data_rows:
        raise ValueError('solid_biofuels update: no raw rows produced')

    n = processor.replace_raw_data(SOURCE_KEY, data_rows, metadata_rows)
    print(f'    Stored {n} source-native rows for {SOURCE_KEY}')
    return n


def transform_solid_biofuels(processor) -> int:
    """EFB transform: sbio_* vectors for Page 78."""
    data_rows, metadata_rows = _build_indicator_rows(processor.config)
    n = processor.store_indicators(SOURCE_KEY, data_rows, metadata_rows)
    print(f'    Stored {n} indicator rows for {SOURCE_KEY}')
    return n


def build_solid_biofuels_indicator_rows(
    config=None,
) -> Tuple[List[Tuple[str, str, float]], List[Tuple[str, str, str, str, str, str]]]:
    """Build indicator rows without SQL (offline export / tests)."""
    return _build_indicator_rows(config)
