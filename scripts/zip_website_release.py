#!/usr/bin/env python3
"""
Zip the Vite/React website: runs npm run build (unless --skip-build), then packs dist/ plus source.

Excludes pipeline code (scripts/*.py except this tool), node_modules.

Usage:
  python scripts/zip_website_release.py
  python scripts/zip_website_release.py --output-dir ../release
  python scripts/zip_website_release.py --skip-build
"""
from __future__ import annotations

import argparse
import shutil
import subprocess
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

DEPLOY_DOC = ("docs", "DEPLOYMENT.md")


def _repo_root() -> Path:
    return Path(__file__).resolve().parent.parent


def _find_npm() -> str | None:
    for name in ("npm.cmd", "npm.exe", "npm"):
        p = shutil.which(name)
        if p:
            return p
    return None


def _run_build(root: Path) -> None:
    npm = _find_npm()
    if not npm:
        print(
            "npm not found in PATH. Install Node.js or use --skip-build with an existing dist/.",
            file=sys.stderr,
        )
        raise FileNotFoundError("npm")

    subprocess.run(
        [npm, "run", "build"],
        cwd=root,
        check=True,
    )


def _ensure_dist_ready(root: Path) -> None:
    index = root / "dist" / "index.html"
    if not index.is_file():
        raise FileNotFoundError(
            f"Missing {index}. Run 'npm run build' first or omit --skip-build."
        )


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


def build_zip(output_dir: Path, *, skip_build: bool) -> Path:
    root = _repo_root()
    output_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    out_path = output_dir / f"nrcan-energy-factbook-website-{stamp}.zip"

    if skip_build:
        _ensure_dist_ready(root)
    else:
        _run_build(root)
        _ensure_dist_ready(root)

    deploy_path = root.joinpath(*DEPLOY_DOC)
    if not deploy_path.is_file():
        raise FileNotFoundError(f"Missing deploy documentation: {deploy_path}")

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

        zf.write(deploy_path, arcname="/".join(DEPLOY_DOC))

        _add_tree(zf, root / "dist", "dist")
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
    parser.add_argument(
        "--skip-build",
        action="store_true",
        help="Do not run npm run build; require existing dist/ with index.html",
    )
    args = parser.parse_args()
    try:
        out = build_zip(args.output_dir.resolve(), skip_build=args.skip_build)
    except FileNotFoundError as e:
        print(e, file=sys.stderr)
        return 1
    except subprocess.CalledProcessError as e:
        print(f"npm run build failed with exit code {e.returncode}", file=sys.stderr)
        return e.returncode or 1
    print(out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
