"""
Export glossary CSV bundles and copy the standalone data-gallery HTML viewer.

Run from repo root or any cwd; adds scripts/ to sys.path for local imports.
"""

from __future__ import annotations

import argparse
import csv
import re
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Tuple

import pandas as pd

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent
sys.path.insert(0, str(SCRIPT_DIR))

from config_loader import Config  # noqa: E402
from db import DataRepository, DatabaseConnection, get_connection  # noqa: E402
from db.eedas_registry import (  # noqa: E402
    TABLE_EXPORT,
    TABLE_DATA_SOURCES,
    TABLE_MAJOR_PROJECTS_MAP,
    TABLE_RUN_HISTORY,
    unique_source_tables,
)

DEFAULT_OUT = REPO_ROOT / "public" / "glossary"
TEMPLATE_PATH = SCRIPT_DIR / "templates" / "data-gallery.html"

MANIFEST_TITLES: Dict[str, Tuple[str, str]] = {
    "glossary_metadata.csv": (
        "Export metadata (vectors, units, sources)",
        "Métadonnées d'export (vecteurs, unités, sources)",
    ),
    "glossary_series.csv": (
        "Time series (nrcan_fb_export)",
        "Séries temporelles (nrcan_fb_export)",
    ),
    "glossary_major_projects.csv": (
        "Major projects map (raw)",
        "Carte des grands projets (brut)",
    ),
    "glossary_data_sources.csv": (
        "Data sources registry",
        "Registre des sources de données",
    ),
    "glossary_run_history.csv": (
        "Run history (audit log)",
        "Historique des exécutions (journal d'audit)",
    ),
}


def _is_safe_section_calc_table(name: str) -> bool:
    # Section-scoped calculated tables only (nrcan_fb_sN_*).
    return bool(re.fullmatch(r"nrcan_fb_s[0-9]_[a-z][a-z0-9_]*", name))


def _purge_legacy_calc_glossary_csvs(out_dir: Path) -> None:
    """
    Remove stale glossary_calc_*.csv files. Legacy DB table names were calc_*; the
    exporter only writes glossary_nrcan_fb_s*.csv. Old files linger in public/glossary/
    and the manifest listed them until removed.
    """
    for p in out_dir.glob("glossary_calc_*.csv"):
        try:
            p.unlink()
        except OSError:
            pass


def _titles_for_csv_filename(filename: str) -> Tuple[str, str]:
    if filename in MANIFEST_TITLES:
        return MANIFEST_TITLES[filename]
    m = re.fullmatch(r"glossary_(nrcan_fb_s[0-9]_[a-z0-9_]+)\.csv", filename)
    if m:
        tab = m.group(1)
        return (f"Calculated table: {tab}", f"Table calculée : {tab}")
    stem = Path(filename).stem
    # Avoid "Glossary Calc Energy Use" — drop the filename prefix used for all exports
    display = stem[9:] if stem.lower().startswith("glossary_") else stem
    pretty = display.replace("_", " ").title()
    return (pretty, pretty)


def _write_manifest(out_dir: Path) -> None:
    rows: List[Dict[str, str]] = []
    for path in sorted(out_dir.glob("glossary_*.csv")):
        if path.name == "glossary_manifest.csv":
            continue
        # Never list legacy calc_* exports (pre–nrcan_fb_s* schema).
        if re.fullmatch(r"glossary_calc_[a-z0-9_]+\.csv", path.name, re.IGNORECASE):
            continue
        title_en, title_fr = _titles_for_csv_filename(path.name)
        rows.append(
            {"filename": path.name, "title_en": title_en, "title_fr": title_fr}
        )
    manifest_path = out_dir / "glossary_manifest.csv"
    with open(manifest_path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["filename", "title_en", "title_fr"])
        w.writeheader()
        w.writerows(rows)


def _copy_html_template(out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    shutil.copy2(TEMPLATE_PATH, out_dir / "data-gallery.html")
    # Helps hosts/browsers that cache HTML without revalidation (avoids stale viewer JS).
    stamp_path = out_dir / "glossary_export_stamp.txt"
    try:
        stamp_path.write_text(
            datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ") + "\n",
            encoding="utf-8",
        )
    except OSError:
        pass


def export_from_database(out_dir: Path, skip_prepare: bool) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    _purge_legacy_calc_glossary_csvs(out_dir)
    config = Config()
    db_mgr: DatabaseConnection = get_connection(config.database)
    repo = DataRepository(db_mgr)

    if not skip_prepare:
        repo.prepare_export_data()

    meta_union = " UNION ALL ".join(
        f"SELECT vector, source_key FROM [{t}]" for t in unique_source_tables()
    )
    metadata_sql = f"""
        SELECT e.vector, e.title, e.uom, e.scalar_factor,
               COALESCE(m.source_key,'') AS data_source, e.source_org, e.source_url
        FROM (
            SELECT vector, MAX(title) AS title, MAX(uom) AS uom, MAX(scalar_factor) AS scalar_factor,
                   MAX(source_org) AS source_org, MAX(source_url) AS source_url
            FROM [{TABLE_EXPORT}]
            WHERE title IS NOT NULL
            GROUP BY vector
        ) e
        LEFT JOIN (
            {meta_union}
        ) m ON m.vector = e.vector
        ORDER BY e.vector
    """
    series_sql = f"""
        SELECT vector, ref_date, value
        FROM [{TABLE_EXPORT}]
        WHERE value IS NOT NULL AND ref_date <> N''
        ORDER BY vector, ref_date
    """
    major_sql = f"""
        SELECT * FROM [{TABLE_MAJOR_PROJECTS_MAP}]
        ORDER BY lang, id
    """
    sources_sql = f"""
        SELECT * FROM [{TABLE_DATA_SOURCES}]
        ORDER BY section_id, source_key
    """
    run_history_sql = f"""
        SELECT TOP 20000 *
        FROM [{TABLE_RUN_HISTORY}]
        ORDER BY started_at DESC
    """

    with db_mgr.get_connection() as conn:
        pd.read_sql(metadata_sql, conn).to_csv(
            out_dir / "glossary_metadata.csv", index=False, encoding="utf-8"
        )
        pd.read_sql(series_sql, conn).to_csv(
            out_dir / "glossary_series.csv", index=False, encoding="utf-8"
        )
        pd.read_sql(major_sql, conn).to_csv(
            out_dir / "glossary_major_projects.csv", index=False, encoding="utf-8"
        )
        pd.read_sql(sources_sql, conn).to_csv(
            out_dir / "glossary_data_sources.csv", index=False, encoding="utf-8"
        )
        pd.read_sql(run_history_sql, conn).to_csv(
            out_dir / "glossary_run_history.csv", index=False, encoding="utf-8"
        )

        tables_df = pd.read_sql(
            """
            SELECT TABLE_NAME
            FROM INFORMATION_SCHEMA.TABLES
            WHERE TABLE_TYPE = 'BASE TABLE'
              AND TABLE_SCHEMA = 'dbo'
              AND TABLE_NAME LIKE 'nrcan_fb_s[0-9]_%'
            ORDER BY TABLE_NAME
            """,
            conn,
        )
        for table_name in tables_df["TABLE_NAME"].astype(str):
            if not _is_safe_section_calc_table(table_name):
                continue
            quoted = "[" + table_name.replace("]", "]]") + "]"
            out_name = f"glossary_{table_name.lower()}.csv"
            out_path = out_dir / out_name
            cnt_df = pd.read_sql(f"SELECT COUNT(*) AS n FROM {quoted}", conn)
            n = int(cnt_df.iloc[0]["n"]) if not cnt_df.empty else 0
            if n == 0:
                if out_path.is_file():
                    try:
                        out_path.unlink()
                    except OSError:
                        pass
                continue
            q = f"SELECT * FROM {quoted}"
            pd.read_sql(q, conn).to_csv(out_path, index=False, encoding="utf-8")

    _write_manifest(out_dir)
    _copy_html_template(out_dir)
    print(f"Wrote database glossary export to {out_dir}")


DATA_SOURCES_HEADER = (
    "source_id,source_key,source_name,section_id,section_name,"
    "is_enabled,last_refresh_at,created_at,updated_at\n"
)

RUN_HISTORY_HEADER = (
    "run_id,source_key,run_type,status,rows_affected,error_message,"
    "started_at,completed_at,duration_seconds\n"
)


def seed_from_public_data(out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    _purge_legacy_calc_glossary_csvs(out_dir)
    data_dir = REPO_ROOT / "public" / "data"
    shutil.copy2(data_dir / "metadata.csv", out_dir / "glossary_metadata.csv")
    shutil.copy2(data_dir / "data.csv", out_dir / "glossary_series.csv")
    shutil.copy2(
        data_dir / "major_projects_map.csv",
        out_dir / "glossary_major_projects.csv",
    )
    (out_dir / "glossary_data_sources.csv").write_text(
        DATA_SOURCES_HEADER, encoding="utf-8"
    )
    (out_dir / "glossary_run_history.csv").write_text(
        RUN_HISTORY_HEADER, encoding="utf-8"
    )
    _write_manifest(out_dir)
    _copy_html_template(out_dir)
    print(f"Seeded glossary CSV + viewer from public/data into {out_dir}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Export glossary CSV files and copy data-gallery.html"
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=DEFAULT_OUT,
        help=f"Output directory (default: {DEFAULT_OUT})",
    )
    parser.add_argument(
        "--seed-from-public",
        action="store_true",
        help="Copy public/data CSVs into glossary_* names (no database)",
    )
    parser.add_argument(
        "--skip-prepare-export",
        action="store_true",
        help="Skip DataRepository.prepare_export_data() before SQL export",
    )
    args = parser.parse_args()

    if args.seed_from_public:
        seed_from_public_data(args.out.resolve())
    else:
        export_from_database(args.out.resolve(), args.skip_prepare_export)


if __name__ == "__main__":
    main()
