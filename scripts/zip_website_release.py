#!/usr/bin/env python3
"""
Zip the production website for static hosting.

Default (deploy): runs npm run build (unless --skip-build), then zips only the *contents*
of dist/ at the zip root (index.html, assets/, data/, glossary/, …) plus DEPLOYMENT.md.
No src/, public/, or package files — suitable for uploading to a web server.

Optional --full: previous "developer handoff" bundle (dist/ + src/ + public/ + package files
+ docs/DEPLOYMENT.md under docs/).

Usage:
  python scripts/zip_website_release.py
  python scripts/zip_website_release.py --output-dir ../release
  python scripts/zip_website_release.py --skip-build
  python scripts/zip_website_release.py --full
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
        arc = Path(arc_prefix) / rel if arc_prefix else rel
        zf.write(path, arcname=str(arc).replace("\\", "/"))


def _add_dist_flat(zf: zipfile.ZipFile, dist_dir: Path) -> None:
    """Add dist/ contents at zip root (no dist/ prefix)."""
    if not dist_dir.is_dir():
        raise FileNotFoundError(f"Missing directory: {dist_dir}")
    for path in sorted(dist_dir.rglob("*")):
        if not path.is_file() or _skip_file(path):
            continue
        rel = path.relative_to(dist_dir)
        zf.write(path, arcname=rel.as_posix())


def build_zip(output_dir: Path, *, skip_build: bool, full: bool) -> Path:
    root = _repo_root()
    output_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    suffix = "-full" if full else ""
    out_path = output_dir / f"nrcan-energy-factbook-website{suffix}-{stamp}.zip"

    if skip_build:
        _ensure_dist_ready(root)
    else:
        _run_build(root)
        _ensure_dist_ready(root)

    deploy_path = root.joinpath(*DEPLOY_DOC)
    if not deploy_path.is_file():
        raise FileNotFoundError(f"Missing deploy documentation: {deploy_path}")

    with zipfile.ZipFile(out_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        if full:
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
        else:
            zf.write(deploy_path, arcname="DEPLOYMENT.md")
            _add_dist_flat(zf, root / "dist")

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
    parser.add_argument(
        "--full",
        action="store_true",
        help="Include src/, public/, package files, and dist/ with repo-like paths (large handoff)",
    )
    args = parser.parse_args()
    try:
        out = build_zip(
            args.output_dir.resolve(),
            skip_build=args.skip_build,
            full=args.full,
        )
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
