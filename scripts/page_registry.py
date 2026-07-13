"""
Page registry: legacy PageNN -> semantic component / translation / CSS names.

Used by page_inventory.py and validate_page_registry.py.
"""

from __future__ import annotations

import csv
import re
from dataclasses import asdict, dataclass, field
from pathlib import Path

try:
    import yaml
except ImportError:
    yaml = None  # type: ignore

ROOT = Path(__file__).resolve().parents[1]
REGISTRY_YAML = ROOT / "docs" / "page_registry.yaml"
REGISTRY_CSV = ROOT / "docs" / "page_registry.csv"

# Legacy Factbook page numbers in website scroll order (pre-rename Section*.jsx order).
LEGACY_PAGE_ORDER: list[int] = [
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21,
    23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37,
    39, 40, 41, 42, 43, 44, 45, 46,
    47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57,
    59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77,
    78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97,
    98, 99, 100, 101, 102, 103, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114,
    115, 117, 118, 119, 122, 123, 126, 132, 135, 131, 134, 136, 138, 139, 142, 143,
]

SKIP_SECTION_TAGS = {"Suspense", "Fragment", "LoadingSpinner"}
COMPONENTS = ROOT / "src" / "components"
SECTION_FILES = [
    COMPONENTS / f"Section{['One', 'Two', 'Three', 'Four', 'Five', 'Six'][i]}.jsx"
    for i in range(6)
]

# (component_name, translation_prefix) — translation_prefix None = auto from indicator/component
PAGE_NAME_OVERRIDES: dict[int, tuple[str, str | None]] = {
    6: ("CanadaEnergySupply", "canada_energy_supply"),
    7: ("NominalGdp", "nominal_gdp"),
    12: ("EnergyTrade", "energy_trade"),
    13: ("EnergyImports", "energy_imports"),
    18: ("EnergyAndGhgEmissions", "energy_and_ghg_emissions"),
    19: ("GhgEmissionsIntensityIndex", "ghg_emissions_intensity_index"),
    20: ("GhgEmissionsBySector", "ghg_emissions_by_sector"),
    23: ("Investment", "investment"),
    24: ("CapitalExpenditures", "capital_expenditures"),
    26: ("EconomicContributions", "economic_contributions"),
    28: ("MajorEnergyProjects", "major_energy_projects"),
    29: ("CleanTechTrends", "clean_tech_trends"),
    30: ("MajorProjectsMap", "major_projects_map"),
    48: ("EnergyUse", "energy_use"),
    50: ("EnergyInDailyLives", "energy_in_daily_lives"),
    53: ("IndustrialSectorEnergy", "industrial_sector_energy"),
    62: ("CleantechCompaniesByRegion", "cleantech_companies_geo"),
    63: ("CleantechCompaniesByIndustry", "cleantech_companies_industry"),
    66: ("CanadianElectricityGeneration", "electricity_generation_canada"),
    67: ("ProvincialElectricityGeneration", "electricity_generation_provincial"),
    71: ("ElectricityGhgSpotlight", "ghg_electricity_spotlight"),
    72: ("RenewableEnergyInternational", "renewable_energy_international"),
    97: ("TransportationGhgSpotlight", "ghg_transportation_spotlight"),
    100: ("Hydrogen", "hydrogen"),
    109: ("WorldProvedCrudeReserves", "world_crude_reserves"),
    114: ("OilSandsMiningMethod", "oil_sands_mining"),
    115: ("OilSandsInSituMethod", "oil_sands_in_situ"),
    123: ("WorldProvedGasReserves", "world_gas_reserves"),
    132: ("OilGasGhgSpotlight", "ghg_oilgas_spotlight"),
}


@dataclass
class PageRegistryEntry:
    legacy_page_num: int
    legacy_component: str
    component_name: str
    file_name: str
    translation_prefix: str
    css_prefix: str
    section_anchor_id: str
    title: str
    indicator_keys: list[str] = field(default_factory=list)
    data_getters: list[str] = field(default_factory=list)
    data_status: str = ""


def _read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def parse_section_component_order() -> list[tuple[int, str]]:
    """Return [(section_num, component_name), ...] in website scroll order."""
    ordered: list[tuple[int, str]] = []
    for section_idx, section_path in enumerate(SECTION_FILES, start=1):
        if not section_path.exists():
            continue
        text = _read_text(section_path)
        for match in re.finditer(r"<(\w+)\s*/>", text):
            comp = match.group(1)
            if comp.startswith("Section") or comp in SKIP_SECTION_TAGS:
                continue
            ordered.append((section_idx, comp))
    return ordered


def component_legacy_map() -> dict[str, int]:
    """Map semantic component name -> legacy page number."""
    components = [c for _s, c in parse_section_component_order()]
    if len(components) != len(LEGACY_PAGE_ORDER):
        raise RuntimeError(
            f"component count {len(components)} != legacy page count {len(LEGACY_PAGE_ORDER)}"
        )
    return dict(zip(components, LEGACY_PAGE_ORDER))


def legacy_page_for_component(component_name: str) -> int:
    mapping = component_legacy_map()
    if component_name not in mapping:
        raise RuntimeError(f"Unknown semantic page component: {component_name}")
    return mapping[component_name]


def parse_section_page_anchors() -> dict[int, str]:
    """Map legacy page number -> section wrapper id (kebab-case)."""
    legacy_by_component = component_legacy_map()
    anchors: dict[int, str] = {}
    for section_path in SECTION_FILES:
        if not section_path.exists():
            continue
        text = _read_text(section_path)
        for match in re.finditer(r"<(\w+)\s*/>", text):
            comp = match.group(1)
            if comp.startswith("Section") or comp in SKIP_SECTION_TAGS:
                continue
            page_num = legacy_by_component[comp]
            before = text[: match.start()]
            ids = re.findall(r'id="([^"]+)"', before)
            if ids:
                anchors[page_num] = ids[-1]
    return anchors


def getter_to_component(getter: str) -> str:
    name = getter
    if name.startswith("get"):
        name = name[3:]
    if name.endswith("Data"):
        name = name[:-4]
    return name


def snake_to_pascal(snake: str) -> str:
    return "".join(part.capitalize() for part in snake.split("_") if part)


def pascal_to_snake(name: str) -> str:
    return re.sub(r"(?<!^)(?=[A-Z])", "_", name).lower()


def anchor_to_pascal(anchor: str) -> str:
    return "".join(part.capitalize() for part in anchor.split("-") if part)


def derive_component_name(
    page_num: int,
    getters: list[str],
    indicators: list[str],
    anchor: str,
) -> str:
    if page_num in PAGE_NAME_OVERRIDES:
        return PAGE_NAME_OVERRIDES[page_num][0]
    if len(getters) == 1:
        return getter_to_component(getters[0])
    if len(getters) > 1:
        return anchor_to_pascal(anchor) if anchor else f"Page{page_num}"
    if indicators:
        return snake_to_pascal(indicators[0])
    if anchor:
        return anchor_to_pascal(anchor)
    return f"Page{page_num}"


def derive_translation_prefix(
    page_num: int,
    component_name: str,
    indicators: list[str],
    anchor: str,
) -> str:
    if page_num in PAGE_NAME_OVERRIDES:
        override = PAGE_NAME_OVERRIDES[page_num][1]
        if override:
            return override
    if indicators:
        return indicators[0]
    if anchor:
        return anchor.replace("-", "_")
    return pascal_to_snake(component_name)


def page_to_component(page_num: int) -> str:
    """Map legacy page number -> semantic component name."""
    inv = {num: comp for comp, num in component_legacy_map().items()}
    if page_num not in inv:
        raise RuntimeError(f"No component mapped for legacy page {page_num}")
    return inv[page_num]


def build_registry(rows) -> list[PageRegistryEntry]:
    """Build registry entries from page_inventory PageRow list."""
    anchors = parse_section_page_anchors()
    entries: list[PageRegistryEntry] = []
    for row in rows:
        anchor = anchors.get(row.page_num, "")
        component = derive_component_name(
            row.page_num, row.data_getters, row.indicator_keys, anchor
        )
        trans_prefix = derive_translation_prefix(
            row.page_num, component, row.indicator_keys, anchor
        )
        entries.append(
            PageRegistryEntry(
                legacy_page_num=row.page_num,
                legacy_component=f"Page{row.page_num}",
                component_name=component,
                file_name=f"{component}.jsx",
                translation_prefix=trans_prefix,
                css_prefix="",  # filled below for uniqueness
                section_anchor_id=anchor,
                title=row.title,
                indicator_keys=row.indicator_keys,
                data_getters=row.data_getters,
                data_status=row.data_status,
            )
        )

    anchor_counts: dict[str, int] = {}
    for e in entries:
        if e.section_anchor_id:
            anchor_counts[e.section_anchor_id] = anchor_counts.get(e.section_anchor_id, 0) + 1

    for e in entries:
        if e.section_anchor_id and anchor_counts[e.section_anchor_id] == 1:
            e.css_prefix = e.section_anchor_id
        else:
            e.css_prefix = e.translation_prefix.replace("_", "-")
    return entries


def validate_registry(entries: list[PageRegistryEntry]) -> list[str]:
    errors: list[str] = []
    expected = len(LEGACY_PAGE_ORDER)
    if len(entries) != expected:
        errors.append(f"expected {expected} entries, got {len(entries)}")

    for field_name in ("component_name", "file_name", "translation_prefix", "css_prefix"):
        seen: dict[str, int] = {}
        for e in entries:
            val = getattr(e, field_name)
            seen[val] = seen.get(val, 0) + 1
        for val, count in seen.items():
            if count > 1:
                pages = [str(x.legacy_page_num) for x in entries if getattr(x, field_name) == val]
                errors.append(f"duplicate {field_name} {val!r} on pages {', '.join(pages)}")

    for e in entries:
        if not re.match(r"^[A-Z][A-Za-z0-9]*$", e.component_name):
            errors.append(f"invalid component_name {e.component_name!r} for page {e.legacy_page_num}")
        if not re.match(r"^[a-z][a-z0-9_]*$", e.translation_prefix):
            errors.append(
                f"invalid translation_prefix {e.translation_prefix!r} for page {e.legacy_page_num}"
            )
    return errors


def write_registry_yaml(entries: list[PageRegistryEntry], path: Path) -> None:
    if yaml is None:
        raise RuntimeError("PyYAML required for registry YAML output")
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "pages": [asdict(e) for e in entries],
    }
    path.write_text(
        yaml.safe_dump(payload, sort_keys=False, allow_unicode=True),
        encoding="utf-8",
    )


def write_registry_csv(entries: list[PageRegistryEntry], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = list(asdict(entries[0]).keys()) if entries else []
    with path.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=fieldnames)
        writer.writeheader()
        for e in entries:
            row = asdict(e)
            row["indicator_keys"] = "; ".join(e.indicator_keys)
            row["data_getters"] = "; ".join(e.data_getters)
            writer.writerow(row)


def load_registry_yaml(path: Path) -> list[PageRegistryEntry]:
    if yaml is None:
        raise RuntimeError("PyYAML required")
    data = yaml.safe_load(_read_text(path))
    entries: list[PageRegistryEntry] = []
    for item in data.get("pages") or []:
        if isinstance(item.get("indicator_keys"), str):
            item["indicator_keys"] = [
                x.strip() for x in item["indicator_keys"].split(";") if x.strip()
            ]
        if isinstance(item.get("data_getters"), str):
            item["data_getters"] = [
                x.strip() for x in item["data_getters"].split(";") if x.strip()
            ]
        entries.append(PageRegistryEntry(**item))
    return entries
