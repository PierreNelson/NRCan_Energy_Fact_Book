"""
Safe CSV export: backup before overwrite and atomic writes.
"""

import csv
import os
import shutil
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence

from config_loader import Config

Row = Sequence[Any]


def get_backup_dir(config: Config) -> Path:
    """Resolve configured backup directory (relative to scripts/)."""
    export_cfg = config.export
    backup_dir = export_cfg.get('backup_dir', '../public/data/.backups')
    script_dir = Path(__file__).resolve().parent.parent
    return (script_dir / backup_dir).resolve()


def _rotate_backups(backup_dir: Path, basename: str, keep: int) -> None:
    if keep <= 0:
        return
    backups = sorted(
        backup_dir.glob(f"{basename}.*"),
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )
    for old in backups[keep:]:
        old.unlink()


def backup_file(path: Path, config: Config) -> Optional[Path]:
    """Copy existing export file to timestamped backup before overwrite."""
    if not config.export.get('backup_enabled', True):
        return None
    if not path.exists():
        return None

    backup_root = get_backup_dir(config)
    backup_root.mkdir(parents=True, exist_ok=True)
    ts = datetime.now().strftime('%Y%m%d_%H%M%S')
    backup_path = backup_root / f"{path.name}.{ts}"
    shutil.copy2(path, backup_path)
    print(f"  Backed up {path.name} -> {backup_path.name}")
    _rotate_backups(backup_root, path.name, config.export.get('keep_backups', 5))
    return backup_path


def atomic_write_csv(
    path: Path,
    header: List[str],
    rows: Iterable[Row],
    *,
    encoding: str = 'utf-8',
) -> None:
    """Write CSV atomically via a temp file and os.replace."""
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = path.with_suffix(path.suffix + '.tmp')
    try:
        with open(tmp_path, 'w', newline='', encoding=encoding) as f:
            writer = csv.writer(f)
            writer.writerow(header)
            for row in rows:
                writer.writerow(row)
        os.replace(tmp_path, path)
    finally:
        if tmp_path.exists():
            tmp_path.unlink(missing_ok=True)


def atomic_write_dict_csv(
    path: Path,
    fieldnames: List[str],
    rows: Iterable[Dict[str, Any]],
    *,
    encoding: str = 'utf-8-sig',
) -> None:
    """Write dict rows to CSV atomically."""
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = path.with_suffix(path.suffix + '.tmp')
    try:
        with open(tmp_path, 'w', newline='', encoding=encoding) as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction='ignore')
            writer.writeheader()
            for row in rows:
                writer.writerow(row)
        os.replace(tmp_path, path)
    finally:
        if tmp_path.exists():
            tmp_path.unlink(missing_ok=True)


def _latest_backup(backup_dir: Path, filename: str) -> Optional[Path]:
    backups = sorted(
        backup_dir.glob(f"{filename}.*"),
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )
    return backups[0] if backups else None


def restore_latest_backups(config: Config) -> Dict[str, Dict[str, Any]]:
    """Restore each export file from its most recent backup."""
    backup_dir = get_backup_dir(config)
    if not backup_dir.exists():
        return {'error': {'status': 'failed', 'reason': f'Backup directory not found: {backup_dir}'}}

    files_cfg = config.export.get('files', {})
    results: Dict[str, Dict[str, Any]] = {}

    for key, filename in files_cfg.items():
        latest = _latest_backup(backup_dir, filename)
        target = config.get_export_path(filename)
        if latest is None:
            results[key] = {'status': 'skipped', 'reason': 'no backup found', 'path': str(target)}
            continue
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(latest, target)
        results[key] = {'status': 'restored', 'from': str(latest), 'path': str(target)}

    return results


def list_backups(config: Config) -> Dict[str, List[Dict[str, Any]]]:
    """List available backups grouped by export filename."""
    backup_dir = get_backup_dir(config)
    files_cfg = config.export.get('files', {})
    results: Dict[str, List[Dict[str, Any]]] = {}

    if not backup_dir.exists():
        return results

    for key, filename in files_cfg.items():
        entries = []
        for path in sorted(
            backup_dir.glob(f"{filename}.*"),
            key=lambda p: p.stat().st_mtime,
            reverse=True,
        ):
            stat = path.stat()
            entries.append({
                'path': str(path),
                'name': path.name,
                'modified': datetime.fromtimestamp(stat.st_mtime).strftime('%Y-%m-%d %H:%M:%S'),
                'size_bytes': stat.st_size,
            })
        results[key] = entries

    return results
