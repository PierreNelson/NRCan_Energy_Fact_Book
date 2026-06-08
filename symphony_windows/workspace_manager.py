"""Per-issue workspace paths, sanitization, Windows hook execution."""

from __future__ import annotations

import logging
import os
import re
import subprocess
import tempfile
from pathlib import Path

from symphony_windows.config import HooksConfig

log = logging.getLogger(__name__)

_WS_KEY_RE = re.compile(r"[^A-Za-z0-9._-]+")


def sanitize_workspace_key(issue_identifier: str) -> str:
    """SPEC §4.2: only [A-Za-z0-9._-] in directory names."""
    return _WS_KEY_RE.sub("_", issue_identifier.strip())


def workspace_path(root: Path, issue_identifier: str) -> Path:
    key = sanitize_workspace_key(issue_identifier)
    return (root / key).resolve()


def _normalize_hook_script(script: str) -> str:
    """Map bash no-op ':' to PowerShell-friendly no-op."""
    lines = script.strip().splitlines()
    if len(lines) == 1 and lines[0].strip() == ":":
        return "exit 0"
    return script


def run_hook_windows(
    script: str | None,
    cwd: Path,
    timeout_ms: int,
    hook_name: str,
) -> None:
    """Run multiline hook via PowerShell script file (cwd = workspace)."""
    if not script or not script.strip():
        return
    script = _normalize_hook_script(script)
    cwd.mkdir(parents=True, exist_ok=True)
    timeout_sec = max(1, timeout_ms // 1000)
    with tempfile.NamedTemporaryFile(
        mode="w",
        suffix=".ps1",
        delete=False,
        encoding="utf-8",
    ) as f:
        f.write("$ErrorActionPreference = 'Stop'\n")
        f.write(f"Set-Location -LiteralPath {repr(str(cwd))}\n")
        f.write(script)
        if not script.endswith("\n"):
            f.write("\n")
        ps1 = Path(f.name)
    try:
        log.info("Running hook %s in %s", hook_name, cwd)
        subprocess.run(
            [
                "powershell.exe",
                "-NoProfile",
                "-NonInteractive",
                "-ExecutionPolicy",
                "Bypass",
                "-File",
                str(ps1),
            ],
            cwd=str(cwd),
            timeout=timeout_sec,
            check=True,
            env={**os.environ},
        )
    finally:
        try:
            ps1.unlink(missing_ok=True)
        except OSError:
            pass


def ensure_workspace(
    root: Path,
    issue_identifier: str,
    hooks: HooksConfig,
) -> tuple[Path, bool]:
    """
    Return (path, created_now). If created_now, run after_create.
    """
    path = workspace_path(root, issue_identifier)
    created_now = not path.is_dir()
    if created_now:
        path.mkdir(parents=True, exist_ok=True)
        run_hook_windows(hooks.after_create, path, hooks.timeout_ms, "after_create")
    return path, created_now


def remove_workspace(root: Path, issue_identifier: str, hooks: HooksConfig) -> None:
    path = workspace_path(root, issue_identifier)
    if not path.is_dir():
        return
    run_hook_windows(hooks.before_remove, path, hooks.timeout_ms, "before_remove")
    import shutil

    try:
        shutil.rmtree(path, ignore_errors=False)
    except OSError as e:
        log.warning("Could not remove workspace %s: %s", path, e)
