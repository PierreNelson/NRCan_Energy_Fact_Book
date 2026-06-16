"""
Download Excel workbooks from BenchScope SharePoint into EXTERNAL_XLSX_DATA_DIR.

Authentication uses an Azure AD app registration (client credentials).
Required in scripts/.env: AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET
"""

from __future__ import annotations

import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import quote

import httpx

from xlsx_paths import ENV_KEY, repo_root
from utils.log_sanitize import format_path_for_log

GRAPH_SCOPE = "https://graph.microsoft.com/.default"
GRAPH_BASE = "https://graph.microsoft.com/v1.0"
EXCEL_SUFFIXES = {".xlsx", ".xlsm", ".xls", ".csv"}

_sync_done = False


def sharepoint_config() -> dict[str, str]:
    return {
        "hostname": os.environ.get("SHAREPOINT_HOSTNAME", "hustlebench.sharepoint.com").strip(),
        "site_path": os.environ.get("SHAREPOINT_SITE_PATH", "sites/BenchScope").strip().strip("/"),
        "folder_path": os.environ.get("SHAREPOINT_FOLDER_PATH", "Manual Data").strip().strip("/"),
    }


def cache_dir() -> Path:
    raw = os.environ.get(ENV_KEY, "").strip()
    if raw:
        p = Path(raw)
        if not p.is_absolute():
            p = (repo_root() / raw).resolve()
        return p
    default = repo_root() / "data" / "sharepoint_cache"
    default.mkdir(parents=True, exist_ok=True)
    return default


def _get_access_token() -> str:
    tenant_id = os.environ.get("AZURE_TENANT_ID", "").strip()
    client_id = os.environ.get("AZURE_CLIENT_ID", "").strip()
    client_secret = os.environ.get("AZURE_CLIENT_SECRET", "").strip()

    missing = [
        name
        for name, value in (
            ("AZURE_TENANT_ID", tenant_id),
            ("AZURE_CLIENT_ID", client_id),
            ("AZURE_CLIENT_SECRET", client_secret),
        )
        if not value
    ]
    if missing:
        raise ValueError(
            "SharePoint sync requires AZURE_TENANT_ID, AZURE_CLIENT_ID, and "
            f"AZURE_CLIENT_SECRET in scripts/.env (missing: {', '.join(missing)})."
        )

    from azure.identity import ClientSecretCredential

    credential = ClientSecretCredential(
        tenant_id=tenant_id,
        client_id=client_id,
        client_secret=client_secret,
    )
    return credential.get_token(GRAPH_SCOPE).token


def _graph_get(client: httpx.Client, url: str) -> dict[str, Any]:
    response = client.get(url)
    if response.status_code >= 400:
        raise RuntimeError(f"Graph API {response.status_code} for {url}: {response.text[:500]}")
    return response.json()


def _graph_get_bytes(client: httpx.Client, url: str) -> bytes:
    response = client.get(url)
    if response.status_code >= 400:
        raise RuntimeError(f"Graph API {response.status_code} for {url}: {response.text[:500]}")
    return response.content


def _parse_graph_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        if value.endswith("Z"):
            value = value[:-1] + "+00:00"
        return datetime.fromisoformat(value)
    except ValueError:
        return None


def _needs_download(local_path: Path, remote_modified: datetime | None, *, force: bool) -> bool:
    if force:
        return True
    if not local_path.is_file():
        return True
    if remote_modified is None:
        return True
    local_mtime = datetime.fromtimestamp(local_path.stat().st_mtime, tz=timezone.utc)
    return remote_modified > local_mtime


def _folder_children_url(site_id: str, folder_path: str) -> str:
    encoded_path = quote(folder_path, safe="/")
    return f"{GRAPH_BASE}/sites/{site_id}/drive/root:/{encoded_path}:/children"


def _download_folder(
    client: httpx.Client, site_id: str, folder_path: str, dest: Path, *, force: bool
) -> list[str]:
    downloaded: list[str] = []
    payload = _graph_get(client, _folder_children_url(site_id, folder_path))
    items = payload.get("value") or []
    if not items:
        print(f"  SharePoint folder empty or not found: {folder_path}")
        return downloaded

    dest.mkdir(parents=True, exist_ok=True)

    for item in items:
        if item.get("folder"):
            continue
        name = item.get("name") or ""
        if not name or Path(name).suffix.lower() not in EXCEL_SUFFIXES:
            continue

        local_path = dest / name
        remote_modified = _parse_graph_datetime(item.get("lastModifiedDateTime"))

        if not _needs_download(local_path, remote_modified, force=force):
            print(f"  Up to date: {name}")
            continue

        item_id = item.get("id")
        if not item_id:
            print(f"  Skipping {name}: missing item id")
            continue

        print(f"  Downloading: {name}")
        content = _graph_get_bytes(
            client, f"{GRAPH_BASE}/sites/{site_id}/drive/items/{item_id}/content"
        )
        if not content:
            print(f"  Warning: empty content for {name}")
            continue
        local_path.write_bytes(content)
        downloaded.append(name)

    return downloaded


def sync_manual_data_folder(*, force: bool = False) -> dict[str, Any]:
    """Download Manual Data workbooks from SharePoint into the cache directory."""
    cfg = sharepoint_config()
    dest = cache_dir()
    dest.mkdir(parents=True, exist_ok=True)

    token = _get_access_token()
    headers = {"Authorization": f"Bearer {token}"}

    site_key = f"{cfg['hostname']}:/{cfg['site_path']}"
    print(f"SharePoint site: {site_key}")
    print(f"Folder: {cfg['folder_path']}")
    print(f"Local cache: {format_path_for_log(dest)}")

    with httpx.Client(headers=headers, timeout=120.0, follow_redirects=True) as client:
        site = _graph_get(client, f"{GRAPH_BASE}/sites/{quote(site_key, safe=':/')}")
        site_id = site.get("id")
        if not site_id:
            raise RuntimeError(f"Could not resolve SharePoint site: {site_key}")

        downloaded = _download_folder(client, site_id, cfg["folder_path"], dest, force=force)

    return {
        "status": "success",
        "downloaded": downloaded,
        "cache_dir": str(dest),
        "file_count": len(list(dest.glob("*"))),
    }


def ensure_sharepoint_sync(*, force: bool = False) -> Path:
    """Sync once per process, then return the local cache directory."""
    global _sync_done

    if force or not _sync_done:
        result = sync_manual_data_folder(force=force)
        if result.get("status") != "success":
            raise RuntimeError(f"SharePoint sync failed: {result}")
        names = result.get("downloaded") or []
        if names:
            print(f"SharePoint sync: downloaded {len(names)} file(s)")
        else:
            print("SharePoint sync: cache is up to date")
        _sync_done = True

    return cache_dir()
