"""Publish the CER gas pipeline map from the page named in the indicator spec.

The spec source is the hyperlink on "CER - Canada's Pipeline System 2021 -
Natural Gas Pipeline Transportation System". That page's map figure is
downloaded on each export, along with the French page linked from it.
"""

from __future__ import annotations

from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin, urlparse

from utils.http_retry import fetch_get

SOURCE_PAGE = (
    'https://www.cer-rec.gc.ca/en/data-analysis/facilities-we-regulate/'
    'canadas-pipeline-system/2021/natural-gas-pipeline-transportation-system.html'
)
ASSET_STEMS = {
    'en': 'cer_regulated_gas_pipelines_bg',
    'fr': 'cer_regulated_gas_pipelines_bg_fr',
}
SUFFIXES = ('.svg', '.png', '.jpg', '.jpeg', '.webp')
LEGACY_DATA_FILES = (
    'cer_gas_pipelines_map.png',
    'cer_gas_pipelines_map_fr.png',
    'cer_gas_pipelines_map.json',
)


class _PageParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.images = []
        self.french_href = None

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        if tag == 'img':
            self.images.append(attributes)
        if tag == 'a' and (attributes.get('hreflang') or '').lower() == 'fr':
            self.french_href = attributes.get('href')


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def _is_map_image(alt: str) -> bool:
    text = alt.casefold()
    names_the_map = 'map' in text or 'carte' in text
    names_the_pipelines = 'pipeline' in text or 'gazoduc' in text
    return names_the_map and names_the_pipelines


def _map_url(page_url: str) -> str:
    response = fetch_get(page_url, timeout=60, label='CER gas pipeline page')
    parser = _PageParser()
    parser.feed(response.text)
    for image in parser.images:
        if _is_map_image(image.get('alt') or ''):
            src = image.get('src')
            if src:
                return urljoin(page_url, src), parser.french_href
    raise RuntimeError(f'CER page has no gas pipeline map image: {page_url}')


def _download(url: str) -> tuple[bytes, str]:
    response = fetch_get(url, timeout=60, label='CER gas pipeline map')
    content_type = (response.headers.get('Content-Type') or '').split(';', 1)[0].strip().lower()
    if content_type and not content_type.startswith('image/'):
        raise RuntimeError(f'CER map URL did not return an image: {url}')
    suffix = Path(urlparse(url).path).suffix.lower()
    if suffix not in SUFFIXES:
        suffix = '.png'
    return response.content, suffix


def _published_names() -> list[str]:
    names = []
    for stem in ASSET_STEMS.values():
        names.extend(f'{stem}{suffix}' for suffix in SUFFIXES)
    return names


def _snapshot(out_dir: Path) -> dict[str, bytes]:
    saved = {}
    for name in _published_names():
        path = out_dir / name
        if path.is_file():
            saved[name] = path.read_bytes()
    return saved


def _restore(out_dir: Path, saved: dict[str, bytes]) -> None:
    for name in _published_names():
        path = out_dir / name
        if name in saved:
            path.write_bytes(saved[name])
        elif path.is_file():
            path.unlink()


def _clear_incoming(out_dir: Path) -> None:
    for path in out_dir.glob('cer_regulated_gas_pipelines_bg*.incoming'):
        if path.is_file():
            path.unlink()


def _remove_legacy_copies() -> None:
    data_dir = _repo_root() / 'public' / 'data'
    for name in LEGACY_DATA_FILES:
        path = data_dir / name
        if path.is_file():
            path.unlink()


def _install_maps(out_dir: Path, downloaded: dict[str, tuple[bytes, str, str]]) -> dict:
    """Replace the published maps only after every download is in memory."""
    saved = _snapshot(out_dir)
    try:
        staged = {}
        for lang, stem in ASSET_STEMS.items():
            content, suffix, _source = downloaded[lang]
            dest_name = f'{stem}{suffix}'
            incoming = out_dir / f'{dest_name}.incoming'
            incoming.write_bytes(content)
            staged[lang] = (incoming, out_dir / dest_name)
        for lang, (incoming, dest) in staged.items():
            incoming.replace(dest)
            for suffix in SUFFIXES:
                stale = dest.with_name(f'{dest.stem}{suffix}')
                if stale != dest and stale.is_file():
                    stale.unlink()
            print(f'  Map {lang}: {dest.name}')
        return {
            'status': 'success',
            'files': [str(dest) for _incoming, dest in staged.values()],
        }
    except Exception:
        _restore(out_dir, saved)
        raise
    finally:
        _clear_incoming(out_dir)


def publish_cer_gas_pipeline_map() -> dict:
    """Download the current CER map and replace the page asset.

    Both language images are downloaded before any asset file is changed.
    A failed download or a failed write leaves the previous map in place.
    """
    english_url, french_href = _map_url(SOURCE_PAGE)
    if not french_href:
        raise RuntimeError('CER gas pipeline page has no French link')
    french_page = urljoin(SOURCE_PAGE, french_href)
    french_url, _unused = _map_url(french_page)
    pages = {'en': english_url, 'fr': french_url}

    downloaded = {}
    for lang in ASSET_STEMS:
        content, suffix = _download(pages[lang])
        if not content:
            raise RuntimeError(f'CER gas pipeline map download was empty ({lang})')
        downloaded[lang] = (content, suffix, pages[lang])

    out_dir = _repo_root() / 'src' / 'assets'
    out_dir.mkdir(parents=True, exist_ok=True)
    result = _install_maps(out_dir, downloaded)
    _remove_legacy_copies()
    return result
