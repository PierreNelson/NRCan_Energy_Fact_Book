#!/usr/bin/env python3
"""
Zip the Vite/React website source and static assets for handoff (e.g. station dev test).
Excludes pipeline code (scripts/), docs, node_modules, and build output.

Usage:
  python scripts/zip_website_release.py
  python scripts/zip_website_release.py --output-dir ../release
"""
from __future__ import annotations

import argparse
import sys
import zipfile
from datetime import datetime
from pathlib import Path

ROOT_FILES = (
    "index.html",
    "package.json",
    "package-lock.json",
    "vite.config.js",
    "eslint.config.js",
)
OPTIONAL_ROOT = (".env.example",)


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
    out_path = output_dir / f"nrcan-energy-factbook-website-{stamp}.zip"

    with zipfile.ZipFile(out_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        for name in ROOT_FILES:
            p = root / name
            if not p.is_file():
                raise FileNotFoundError(f"Required file missing: {p}")
            zf.write(p, arcname=name.replace("\\", "/"))

        for name in OPTIONAL_ROOT:
            p = root / name
            if p.is_file():
                zf.write(p, arcname=name.replace("\\", "/"))

        _add_tree(zf, root / "src", "src")
        _add_tree(zf, root / "public", "public")

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
