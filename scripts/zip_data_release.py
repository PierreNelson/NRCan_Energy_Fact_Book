#!/usr/bin/env python3
"""
Zip data CSVs (including public/data/data.csv, metadata.csv, major_projects_map.csv),
glossary assets, and UI translations for a lightweight release drop.

Usage:
  python scripts/zip_data_release.py
  python scripts/zip_data_release.py --output-dir ../release
"""
from __future__ import annotations

import argparse
import sys
import zipfile
from datetime import datetime
from pathlib import Path


def _repo_root() -> Path:
    return Path(__file__).resolve().parent.parent


def _skip_file(path: Path) -> bool:
    parts = path.parts
    if "__pycache__" in parts:
        return True
    if path.name in (".DS_Store", "Thumbs.db"):
        return True
    return False


def _add_tree(zf: zipfile.ZipFile, source_dir: Path, arc_prefix: str) -> None:
    if not source_dir.is_dir():
        raise FileNotFoundError(f"Missing directory: {source_dir}")
    for path in sorted(source_dir.rglob("*")):
        if not path.is_file() or _skip_file(path):
            continue
        rel = path.relative_to(source_dir)
        zf.write(path, arcname=str(Path(arc_prefix) / rel).replace("\\", "/"))


def build_zip(output_dir: Path) -> Path:
    root = _repo_root()
    output_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    out_path = output_dir / f"nrcan-energy-factbook-data-{stamp}.zip"

    translations = root / "src" / "utils" / "translations.js"
    if not translations.is_file():
        raise FileNotFoundError(f"Missing file: {translations}")

    with zipfile.ZipFile(out_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        _add_tree(zf, root / "public" / "data", "public/data")
        _add_tree(zf, root / "public" / "glossary", "public/glossary")
        zf.write(translations, arcname="src/utils/translations.js")

    return out_path


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=_repo_root() / "release",
        help="Directory for the zip file (default: <repo>/release)",
    )
    args = parser.parse_args()
    try:
        out = build_zip(args.output_dir.resolve())
    except FileNotFoundError as e:
        print(e, file=sys.stderr)
        return 1
    print(out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
