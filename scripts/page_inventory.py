"""
Generate a website-order page coverage report (CSV + Markdown).

Lists each wired page with title, data status, indicator keys, raw DB tables,
and transformed vectors present in public/data/data.csv.
"""

from __future__ import annotations

import argparse
import ast
import csv
import re
from dataclasses import dataclass, field
from pathlib import Path

try:
    import yaml
except ImportError:
    yaml = None  # type: ignore

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
SCRIPTS = ROOT / "scripts"
COMPONENTS = SRC / "components"
PAGES = SRC / "pages"
TRANSLATIONS = SRC / "utils" / "translations.js"
DATA_LOADER = SRC / "utils" / "dataLoader.js"
DATA_CSV = ROOT / "public" / "data" / "data.csv"
SOURCE_VECTORS = SCRIPTS / "export" / "source_vectors.py"
EFB_REGISTRY = SCRIPTS / "db" / "efb_indicators_registry.yaml"
EEDAS_REGISTRY = SCRIPTS / "db" / "eedas_registry.yaml"

SECTION_FILES = [
    COMPONENTS / f"Section{['One', 'Two', 'Three', 'Four', 'Five', 'Six'][i]}.jsx"
    for i in range(6)
]

PAGE_OVERRIDES: dict[int, dict] = {
    30: {
        "extra_csv": ["major_projects_map.csv"],
        "notes": "Map from major_projects_map.csv; chart may use projects_* when wired",
        "getters": ["getMajorProjectsData"],
    },
    28: {"getters": ["getMajorProjectsData"]},
    29: {"getters": ["getCleanTechTrendsData"]},
}

HARDCODED_PATTERNS = [
    r"_HARDCODED\b",
    r"\bHARDCODED\b",
    r"\bDATA_BY_YEAR\b",
    r"placeholder\s+series",
    r"placeholder\s+data",
    r"\bconst\s+\w+_DATA\s*=",
    r"\bconst\s+\w+_DATA_\w+\s*=",
    r"\bconst\s+DATA\s*=\s*\[",
    r"\bbuild\w+Data\s*=\s*\(",
    r"\bbuild\w+Data\s*\(\s*\)\s*=>",
    r"\bINFOGRAPHIC_DATA\b",
]

HARDCODED_OVERRIDES: set[int] = {
    2, 10, 11, 36, 46, 98, 119,
}

CSV_FETCH_PATTERN = re.compile(
    r"""fetch\s*\(\s*[`'"].*?data/([^`'"]+\.csv)""",
    re.I,
)

TITLE_KEY_PRIORITY = ("title", "section_title", "infographic_title", "chart_title", "chart_heading")


def _title_suffix_rank(suffix: str) -> int:
    if suffix in TITLE_KEY_PRIORITY:
        return TITLE_KEY_PRIORITY.index(suffix)
    if suffix.endswith("_chart_title") or suffix == "chart_title":
        return len(TITLE_KEY_PRIORITY)
    if suffix.endswith("_title_prefix") or suffix == "title_prefix":
        return len(TITLE_KEY_PRIORITY) + 1
    return 999

GETTER_PREFIX_HINTS: dict[str, list[str]] = {
    "getWindSolarElectricityGrowthData": ["ws_elec_"],
    "getCanadianElectricityGenerationData": ["elegen_"],
    "getProvincialElectricityGenerationData": ["elegen_prov_"],
    "getUraniumInternationalData": ["urani_exp_", "urani_prod_", "urani_res_"],
    "getResidentialSectorOverviewData": ["res_", "oee_neud_"],
    "getCommercialInstitutionalEnergyUseData": ["com_", "oee_neud_"],
    "getIndustrialEnergyUseData": ["ind_", "oee_neud_"],
    "getElectricityPricesMapData": ["elec_price_"],
    "getHydroelectricCapacityData": ["hydro_fac_", "ren_cap_hydro"],
    "getOilGasGhgSpotlightData": ["ghg_oilgas_spotlight_"],
}

# Pages where getters use dynamic/wildcard vectors that do not map to registry prefixes.
INDICATOR_EXCEPTIONS: set[int] = set()

_VECTOR_NAME_RE = re.compile(r"^[a-z][a-z0-9_]*$")


@dataclass
class PageRow:
    section_order: int
    section_title: str
    page_order_in_section: int
    page_num: int
    page_component: str
    component_name: str
    translation_prefix: str
    css_prefix: str
    section_anchor_id: str
    title: str
    data_status: str
    data_getters: list[str] = field(default_factory=list)
    indicator_keys: list[str] = field(default_factory=list)
    raw_source_tables: list[str] = field(default_factory=list)
    vectors_in_csv: list[str] = field(default_factory=list)
    vectors_expected: list[str] = field(default_factory=list)
    vectors_missing: list[str] = field(default_factory=list)
    coverage_pct: str = ""
    notes: str = ""


def _read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def _clean_title(value: str) -> str:
    title = value.replace("\\n", " ").replace("\\'", "'")
    title = re.sub(r"\{\{[^}]+\}\}", "", title).strip()
    title = re.sub(r"\s+", " ", title).strip(" ,")
    return title


def parse_section_page_order() -> list[tuple[int, int]]:
    """Return [(section_num, legacy_page_num), ...] in website scroll order."""
    from page_registry import component_legacy_map, parse_section_component_order

    legacy_by_component = component_legacy_map()
    return [
        (section_idx, legacy_by_component[comp])
        for section_idx, comp in parse_section_component_order()
    ]


def _translation_prefix_and_title_suffix(key: str) -> tuple[str, str] | None:
    if re.match(r"page\d+_", key) or key.startswith("nav_"):
        return None
    candidates = list(TITLE_KEY_PRIORITY) + ["chart_title", "title_prefix"]
    for suffix in sorted(candidates, key=len, reverse=True):
        token = f"_{suffix}"
        if key.endswith(token):
            prefix = key[: -len(token)]
            if prefix and _title_suffix_rank(suffix) < 999:
                return prefix, suffix
    return None


def parse_translations_en() -> tuple[dict[str, str], dict[int, str], dict[str, dict[str, str]]]:
    """Parse translation-prefix titles and nav_sectionN_title from translations.js."""
    text = _read_text(TRANSLATIONS)
    en_match = re.search(r"'en'\s*:\s*\{", text)
    if not en_match:
        return {}, {}, {}
    fr_match = re.search(r"'fr'\s*:\s*\{", text[en_match.end() :])
    if fr_match:
        en_end = en_match.end() + fr_match.start()
        en_block = text[en_match.start() : en_end]
    else:
        en_block = text[en_match.start() :]

    prefix_title_keys: dict[str, dict[str, str]] = {}
    section_titles: dict[int, str] = {}

    for m in re.finditer(
        r"'([^']+)':\s*(?:'((?:\\'|[^'])*)'|\"((?:\\\"|[^\"])*)\")",
        en_block,
    ):
        key = m.group(1)
        value = (m.group(2) if m.group(2) is not None else m.group(3) or "").replace("\\'", "'")
        if sm := re.fullmatch(r"nav_section(\d+)_title", key):
            section_titles[int(sm.group(1))] = value
            continue
        if parsed := _translation_prefix_and_title_suffix(key):
            prefix, suffix = parsed
            if _title_suffix_rank(suffix) < 999:
                prefix_title_keys.setdefault(prefix, {})[suffix] = _clean_title(value)

    prefix_titles: dict[str, str] = {}
    for prefix, keys in prefix_title_keys.items():
        best_suffix = min(keys.keys(), key=lambda s: (_title_suffix_rank(s), s))
        if keys[best_suffix]:
            prefix_titles[prefix] = keys[best_suffix]

    return prefix_titles, section_titles, prefix_title_keys


def lookup_prefix_title(
    prefix: str,
    prefix_titles: dict[str, str],
    prefix_title_keys: dict[str, dict[str, str]],
) -> str:
    if prefix in prefix_titles:
        return prefix_titles[prefix]
    best_title = ""
    best_rank = 999
    for candidate, keys in prefix_title_keys.items():
        if candidate != prefix and not candidate.startswith(f"{prefix}_"):
            continue
        for suffix, title in keys.items():
            rank = _title_suffix_rank(suffix)
            if title and rank < best_rank:
                best_rank = rank
                best_title = title
    return best_title


def parse_source_vector_prefixes() -> dict[str, list[str]]:
    """Load SOURCE_VECTOR_PREFIXES from source_vectors.py via AST."""
    tree = ast.parse(_read_text(SOURCE_VECTORS))
    for node in tree.body:
        if isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name) and target.id == "SOURCE_VECTOR_PREFIXES":
                    return ast.literal_eval(node.value)
    return {}


def parse_efb_registry() -> dict[str, dict]:
    if yaml is None:
        return {}
    data = yaml.safe_load(_read_text(EFB_REGISTRY))
    return data.get("indicators") or {}


def parse_eedas_source_tables() -> dict[str, str]:
    """indicator_key -> source_table."""
    if yaml is None:
        return {}
    data = yaml.safe_load(_read_text(EEDAS_REGISTRY))
    tables = data.get("source_tables") or {}
    return {
        key: (entry.get("source_table") or key)
        for key, entry in tables.items()
        if isinstance(entry, dict)
    }


def prefix_to_indicators(prefix_map: dict[str, list[str]]) -> dict[str, list[str]]:
    """vector_prefix -> [indicator_key, ...]"""
    out: dict[str, list[str]] = {}
    for indicator, prefixes in prefix_map.items():
        for prefix in prefixes:
            out.setdefault(prefix, []).append(indicator)
    return out


def _parse_dataloader_const_maps(text: str) -> dict[str, set[str]]:
    """Extract vector-like string literals from module-level const objects."""
    maps: dict[str, set[str]] = {}
    for m in re.finditer(r"const (\w+) = \{([^}]+)\}", text, re.S):
        name = m.group(1)
        vectors: set[str] = set()
        for sm in re.finditer(r"'([^']+)'", m.group(2)):
            s = sm.group(1)
            if _VECTOR_NAME_RE.match(s) and "_" in s:
                vectors.add(s)
        if vectors:
            maps[name] = vectors
    return maps


def _parse_export_functions(text: str) -> dict[str, str]:
    """Map exported function name -> function body only."""
    exports: dict[str, str] = {}
    for m in re.finditer(
        r"export (async )?function (\w+)\([^)]*\)\s*\{",
        text,
    ):
        name = m.group(2)
        start = m.end()
        depth = 1
        i = start
        while i < len(text) and depth > 0:
            if text[i] == "{":
                depth += 1
            elif text[i] == "}":
                depth -= 1
            i += 1
        exports[name] = text[start : i - 1]
    return exports


def _parse_function_bodies(text: str) -> dict[str, str]:
    """Map function name -> body for function declarations in dataLoader.js."""
    bodies: dict[str, str] = {}
    for m in re.finditer(
        r"(?:^|\n)(?:async\s+)?function (\w+)\([^)]*\)\s*\{",
        text,
    ):
        name = m.group(1)
        start = m.end()
        depth = 1
        i = start
        while i < len(text) and depth > 0:
            if text[i] == "{":
                depth += 1
            elif text[i] == "}":
                depth -= 1
            i += 1
        bodies[name] = text[start : i - 1]
    return bodies


def _expand_getter_analysis_text(export_body: str, all_bodies: dict[str, str]) -> str:
    """Include one level of called helper function bodies for vector discovery."""
    combined = export_body
    skip = {
        "loadAllData", "loadMetadata", "parseCSV", "Number", "Math", "String",
        "Object", "Array", "Promise", "Set", "parseInt", "parseFloat", "filter",
        "map", "forEach", "find", "reduce", "sort", "slice", "push", "includes",
    }
    for call in re.findall(r"\b([a-zA-Z_]\w*)\(", export_body):
        if call in all_bodies and call not in skip:
            combined += "\n" + all_bodies[call]
    return combined


def _extract_vectors_from_chunk(chunk: str, const_maps: dict[str, set[str]]) -> tuple[set[str], set[str]]:
    prefixes: set[str] = set()
    literals: set[str] = set()

    prefixes.update(re.findall(r"\.startsWith\('([^']+)'\)", chunk))
    prefixes.update(re.findall(r'\.startsWith\("([^"]+)"\)', chunk))
    literals.update(re.findall(r"row\.vector === '([^']+)'", chunk))
    literals.update(re.findall(r'row\.vector === "([^"]+)"', chunk))
    literals.update(re.findall(r"\bv === '([^']+)'", chunk))
    literals.update(re.findall(r'\bv === "([^"]+)"', chunk))

    for fn in ("valueForVector", "windSolarScalar"):
        literals.update(re.findall(rf"{fn}\([^,]+,\s*'([^']+)'", chunk))

    for m in re.finditer(r"elegenRows\([^,]+,\s*'([^']+)'", chunk):
        prefixes.add(m.group(1))

    for m in re.finditer(r"parseUraniumRankingSeries\([^,]+,\s*'([^']+)',\s*'([^']+)'", chunk):
        prefixes.add(m.group(1))
        literals.add(m.group(2))

    arr = re.search(r"const vectors = \[\s*([^\]]+)\]", chunk, re.S)
    if arr:
        literals.update(re.findall(r"'([^']+)'", arr.group(1)))

    regex_prefixes = re.findall(r"row\.vector\.match\(\s*/\^([^$\\]+)", chunk)
    for rp in regex_prefixes:
        rp = rp.replace("\\.", ".").rstrip("_")
        if rp and not rp.endswith("_"):
            prefixes.add(rp + "_")
        elif rp:
            prefixes.add(rp)

    for map_name in re.findall(r"\b([A-Z][A-Z0-9_]*VECTORS|[A-Z][A-Z0-9_]*_PIPELINE)\b", chunk):
        if map_name in const_maps:
            literals.update(const_maps[map_name])

    return prefixes, literals


def parse_data_loader_getters() -> dict[str, dict]:
    """
    Parse dataLoader.js getters -> {prefixes: [], literals: []}.
    """
    text = _read_text(DATA_LOADER)
    const_maps = _parse_dataloader_const_maps(text)
    all_bodies = _parse_function_bodies(text)
    export_bodies = _parse_export_functions(text)
    getters: dict[str, dict] = {}

    for name, body in export_bodies.items():
        analysis = _expand_getter_analysis_text(body, all_bodies)
        prefixes, literals = _extract_vectors_from_chunk(analysis, const_maps)

        for hint_prefix in GETTER_PREFIX_HINTS.get(name, []):
            prefixes.add(hint_prefix)

        getters[name] = {
            "prefixes": sorted(prefixes),
            "literals": sorted(literals),
        }
    return getters


def load_csv_vectors() -> set[str]:
    vectors: set[str] = set()
    if not DATA_CSV.exists():
        return vectors
    with DATA_CSV.open(encoding="utf-8", newline="") as fh:
        reader = csv.DictReader(fh)
        for row in reader:
            v = (row.get("vector") or "").strip()
            val = (row.get("value") or "").strip()
            if v and val not in ("", "null", "None"):
                vectors.add(v)
    return vectors


def _extract_dataloader_getters(text: str) -> list[str]:
    getters: list[str] = []
    for block in re.findall(
        r"import\s*\{([^}]+)\}\s*from\s+['\"][^'\"]*dataLoader['\"]",
        text,
        re.S,
    ):
        getters.extend(re.findall(r"\b(get\w+Data\w*)\b", block))
    return sorted(set(getters))


def parse_page_file(page_num: int) -> dict:
    from page_registry import page_to_component

    path = PAGES / f"{page_to_component(page_num)}.jsx"
    if not path.exists():
        return {"exists": False, "getters": [], "hardcoded": False, "csv_files": [], "notes": "Page file missing"}
    text = _read_text(path)
    getters = _extract_dataloader_getters(text) if "dataLoader" in text else []

    hardcoded = (
        page_num in HARDCODED_OVERRIDES
        or any(re.search(p, text, re.I) for p in HARDCODED_PATTERNS)
    )
    csv_files = CSV_FETCH_PATTERN.findall(text)

    override = PAGE_OVERRIDES.get(page_num, {})
    for g in override.get("getters", []):
        if g not in getters:
            getters.append(g)
    csv_files.extend(override.get("extra_csv", []))

    notes = override.get("notes", "")
    return {
        "exists": True,
        "getters": sorted(set(getters)),
        "hardcoded": hardcoded,
        "csv_files": sorted(set(csv_files)),
        "notes": notes,
    }


def _concrete_expected(expected: set[str]) -> set[str]:
    return {v for v in expected if not v.endswith("*")}


def vectors_for_getter(getter_info: dict, csv_vectors: set[str]) -> tuple[set[str], set[str], set[str]]:
    """Return (all_expected, matched_in_csv, prefix_wildcards)."""
    prefixes = getter_info.get("prefixes", [])
    literals = getter_info.get("literals", [])

    expected: set[str] = set(literals)
    matched: set[str] = set()
    wildcards: set[str] = set()

    for lit in literals:
        if lit in csv_vectors:
            matched.add(lit)

    for prefix in prefixes:
        prefix_vectors = {v for v in csv_vectors if v.startswith(prefix)}
        if prefix_vectors:
            matched.update(prefix_vectors)
            expected.update(prefix_vectors)
        else:
            wildcards.add(f"{prefix}*")

    if not expected and prefixes:
        for prefix in prefixes:
            wildcards.add(f"{prefix}*")

    return expected, matched, wildcards


def indicators_and_tables(
    prefixes: list[str],
    prefix_to_indicator: dict[str, list[str]],
    efb: dict[str, dict],
    eedas_tables: dict[str, str],
) -> tuple[list[str], list[str]]:
    indicators: set[str] = set()
    for prefix in prefixes:
        for reg_prefix, inds in prefix_to_indicator.items():
            if prefix.startswith(reg_prefix) or reg_prefix.startswith(prefix):
                indicators.update(inds)
        for ind_key, entry in efb.items():
            for vp in entry.get("vector_prefixes") or []:
                if prefix.startswith(vp) or vp.startswith(prefix):
                    indicators.add(ind_key)
    raw_tables: set[str] = set()
    for ind in indicators:
        entry = efb.get(ind) or {}
        for table in entry.get("depends_on") or []:
            raw_tables.add(table)
        if ind in eedas_tables:
            raw_tables.add(eedas_tables[ind])
    return sorted(indicators), sorted(raw_tables)


def _coverage_pct(matched: set[str], concrete: set[str]) -> str:
    if not concrete:
        return ""
    pct = round(100.0 * len(matched & concrete) / len(concrete), 1)
    return f"{pct}"


def classify_page(
    page_info: dict,
    getter_defs: dict[str, dict],
    csv_vectors: set[str],
    prefix_to_indicator: dict[str, list[str]],
    efb: dict[str, dict],
    eedas_tables: dict[str, str],
) -> tuple[str, list[str], list[str], list[str], list[str], list[str], str, str]:
    getters = page_info.get("getters", [])
    csv_files = page_info.get("csv_files", [])
    notes = page_info.get("notes", "")
    hardcoded = page_info.get("hardcoded", False)

    if hardcoded and not getters and not csv_files:
        return (
            "static_hardcoded",
            getters,
            [],
            [],
            set(),
            set(),
            set(),
            notes or "Uses hardcoded or placeholder data in page file",
            "",
        )

    if getters or csv_files:
        all_prefixes: list[str] = []
        all_expected: set[str] = set()
        all_matched: set[str] = set()
        all_wildcards: set[str] = set()

        for g in getters:
            info = getter_defs.get(g, {"prefixes": [], "literals": []})
            expected, matched, wildcards = vectors_for_getter(info, csv_vectors)
            all_prefixes.extend(info.get("prefixes", []))
            all_expected.update(expected)
            all_matched.update(matched)
            all_wildcards.update(wildcards)

        indicators, raw_tables = indicators_and_tables(
            sorted(set(all_prefixes)), prefix_to_indicator, efb, eedas_tables
        )

        if csv_files:
            notes = "; ".join(filter(None, [notes, f"Also loads CSV: {', '.join(csv_files)}"]))

        concrete = _concrete_expected(all_expected)
        missing = concrete - all_matched
        coverage = _coverage_pct(all_matched, concrete)

        if hardcoded:
            status = "pipeline_partial"
            hybrid_note = "Hybrid: pipeline getter + hardcoded/inline data"
            notes = "; ".join(filter(None, [notes, hybrid_note]))
        elif not all_matched and not all_wildcards:
            status = "pipeline_missing"
        elif not all_matched and all_wildcards and not concrete:
            status = "pipeline_missing"
        elif missing and concrete:
            status = "pipeline_partial"
            notes = "; ".join(filter(None, [notes, f"Missing {len(missing)} of {len(concrete)} expected vectors in export"]))
        elif not all_matched:
            status = "pipeline_missing"
        else:
            status = "pipeline_present"

        return (
            status,
            getters,
            indicators,
            raw_tables,
            all_matched,
            all_expected | all_wildcards,
            missing,
            notes,
            coverage,
        )

    if hardcoded:
        return (
            "static_hardcoded",
            [],
            [],
            [],
            set(),
            set(),
            set(),
            notes or "Uses hardcoded or placeholder data in page file",
            "",
        )

    return "no_data", [], [], [], set(), set(), set(), notes, ""


def build_inventory() -> list[PageRow]:
    from page_registry import build_registry, derive_translation_prefix, parse_section_page_anchors

    order = parse_section_page_order()
    prefix_titles, section_titles, prefix_title_keys = parse_translations_en()
    anchors = parse_section_page_anchors()
    prefix_map = parse_source_vector_prefixes()
    prefix_to_indicator = prefix_to_indicators(prefix_map)
    efb = parse_efb_registry()
    eedas_tables = parse_eedas_source_tables()
    getter_defs = parse_data_loader_getters()
    csv_vectors = load_csv_vectors()

    section_counters: dict[int, int] = {}
    rows: list[PageRow] = []

    for section_num, page_num in order:
        section_counters[section_num] = section_counters.get(section_num, 0) + 1
        page_info = parse_page_file(page_num)
        status, data_getters, indicators, raw_tables, in_csv, expected, missing, notes, coverage = classify_page(
            page_info, getter_defs, csv_vectors, prefix_to_indicator, efb, eedas_tables
        )

        title_prefix = derive_translation_prefix(
            page_num, f"Page{page_num}", indicators, anchors.get(page_num, "")
        )
        title = lookup_prefix_title(title_prefix, prefix_titles, prefix_title_keys) or (
            f"(no title key for {title_prefix}_title)"
        )
        rows.append(
            PageRow(
                section_order=section_num,
                section_title=section_titles.get(section_num, f"Section {section_num}"),
                page_order_in_section=section_counters[section_num],
                page_num=page_num,
                page_component=f"Page{page_num}",
                component_name="",
                translation_prefix="",
                css_prefix="",
                section_anchor_id="",
                title=title,
                data_status=status,
                data_getters=data_getters,
                indicator_keys=indicators,
                raw_source_tables=raw_tables,
                vectors_in_csv=sorted(in_csv),
                vectors_expected=sorted(expected),
                vectors_missing=sorted(missing),
                coverage_pct=coverage,
                notes=notes,
            )
        )

    registry_by_num = {e.legacy_page_num: e for e in build_registry(rows)}
    for row in rows:
        entry = registry_by_num[row.page_num]
        row.component_name = entry.component_name
        row.translation_prefix = entry.translation_prefix
        row.css_prefix = entry.css_prefix
        row.section_anchor_id = entry.section_anchor_id
        row.page_component = entry.component_name
    return rows


@dataclass
class PageAuditResult:
    page_num: int
    page_component: str
    title: str
    section_order: int
    section_title: str
    inventory_status: str
    derived_status: str
    audit_result: str
    issue_count: int
    issues: list[str]
    checks: dict[str, bool]
    data_getters: list[str]
    vectors_in_csv: list[str]
    coverage_pct: str
    derived: dict


def _prefixes_could_map(
    prefixes: list[str],
    prefix_to_indicator: dict[str, list[str]],
    efb: dict[str, dict],
) -> bool:
    for prefix in prefixes:
        for reg_prefix in prefix_to_indicator:
            if prefix.startswith(reg_prefix) or reg_prefix.startswith(prefix):
                return True
        for entry in efb.values():
            for vp in entry.get("vector_prefixes") or []:
                if prefix.startswith(vp) or vp.startswith(prefix):
                    return True
    return False


def audit_single_page(
    page_num: int,
    inventory_row: PageRow | None,
    getter_defs: dict[str, dict],
    csv_vectors: set[str],
    prefix_to_indicator: dict[str, list[str]],
    efb: dict[str, dict],
    eedas_tables: dict[str, str],
) -> PageAuditResult:
    """Independently re-parse a page and verify inventory row consistency."""
    page_info = parse_page_file(page_num)
    (
        derived_status,
        derived_getters,
        indicators,
        _raw_tables,
        in_csv,
        expected,
        missing,
        _notes,
        coverage,
    ) = classify_page(
        page_info, getter_defs, csv_vectors, prefix_to_indicator, efb, eedas_tables
    )

    issues: list[str] = []
    checks: dict[str, bool] = {}

    inv_status = inventory_row.data_status if inventory_row else ""
    inv_getters = inventory_row.data_getters if inventory_row else []
    inv_coverage = inventory_row.coverage_pct if inventory_row else ""
    title = inventory_row.title if inventory_row else ""
    parsed_getters = page_info.get("getters", [])
    csv_files = page_info.get("csv_files", [])
    hardcoded = page_info.get("hardcoded", False)
    expected_set = set(expected) if expected else set()
    wildcards = {v for v in expected_set if v.endswith("*")}

    checks["file_exists"] = page_info.get("exists", False)
    if not checks["file_exists"]:
        issues.append("Page file missing")

    checks["getters_match"] = set(inv_getters) == set(parsed_getters)
    if inventory_row and not checks["getters_match"]:
        issues.append(
            f"getters mismatch: inventory={inv_getters}, parsed={parsed_getters}"
        )

    checks["status_match"] = inv_status == derived_status
    if inventory_row and not checks["status_match"]:
        issues.append(
            f"status mismatch: inventory={inv_status!r}, derived={derived_status!r}"
        )

    checks["title_resolved"] = bool(title.strip()) and not title.startswith("(no title key")
    if inventory_row and not checks["title_resolved"]:
        issues.append(f"title not resolved: {title!r}")

    if inv_status.startswith("pipeline"):
        checks["pipeline_has_getters"] = bool(derived_getters or csv_files)
        if not checks["pipeline_has_getters"]:
            issues.append("pipeline status but no getters or CSV fetches")
    else:
        checks["pipeline_has_getters"] = True

    if inv_status in ("pipeline_present", "pipeline_partial"):
        checks["pipeline_vectors"] = bool(in_csv) or bool(wildcards)
        if not checks["pipeline_vectors"]:
            issues.append("pipeline_present/partial but no matched vectors or wildcards")
    else:
        checks["pipeline_vectors"] = True

    if inv_status == "pipeline_missing":
        has_expected = bool(_concrete_expected(expected_set)) or bool(wildcards) or bool(expected_set)
        checks["pipeline_missing_vectors"] = (
            bool(derived_getters or csv_files) and not in_csv and has_expected
        )
        if not derived_getters and not csv_files:
            issues.append("pipeline_missing but no getters or CSV fetches")
        elif in_csv:
            issues.append(f"pipeline_missing but vectors found in CSV ({len(in_csv)})")
        elif not has_expected:
            issues.append("pipeline_missing but no expected vectors detected")
    else:
        checks["pipeline_missing_vectors"] = True

    if inv_status == "static_hardcoded":
        checks["static_no_pipeline"] = not (derived_getters and not hardcoded)
        if derived_getters and not hardcoded:
            issues.append("static_hardcoded but has pipeline getters without hardcoded flag")
    else:
        checks["static_no_pipeline"] = True

    if inv_status == "no_data":
        checks["no_data_clean"] = not derived_getters and not csv_files and not hardcoded
        if not checks["no_data_clean"]:
            issues.append(
                f"no_data but getters={derived_getters}, csv={csv_files}, hardcoded={hardcoded}"
            )
    else:
        checks["no_data_clean"] = True

    all_prefixes: list[str] = []
    for g in derived_getters:
        all_prefixes.extend(getter_defs.get(g, {}).get("prefixes", []))
        if g not in getter_defs:
            issues.append(f"getter {g!r} not exported from dataLoader.js")

    if (
        derived_getters
        and inv_status.startswith("pipeline")
        and page_num not in INDICATOR_EXCEPTIONS
        and _prefixes_could_map(all_prefixes, prefix_to_indicator, efb)
    ):
        checks["indicators_plausible"] = bool(indicators)
        if not indicators:
            issues.append("pipeline getters map to registry prefixes but no indicators resolved")
    else:
        checks["indicators_plausible"] = True

    if inv_coverage or coverage:
        checks["coverage_consistent"] = inv_coverage == coverage
        if inventory_row and inv_coverage != coverage:
            issues.append(
                f"coverage mismatch: inventory={inv_coverage!r}, derived={coverage!r}"
            )
    else:
        checks["coverage_consistent"] = True

    if not inventory_row:
        issues.append("page wired in section but missing from inventory")

    from page_registry import page_to_component

    component = inventory_row.page_component if inventory_row else page_to_component(page_num)
    audit_pass = len(issues) == 0
    return PageAuditResult(
        page_num=page_num,
        page_component=component,
        title=title or f"(no title key for page{page_num}_title)",
        section_order=inventory_row.section_order if inventory_row else 0,
        section_title=inventory_row.section_title if inventory_row else "",
        inventory_status=inv_status,
        derived_status=derived_status,
        audit_result="PASS" if audit_pass else "FAIL",
        issue_count=len(issues),
        issues=issues,
        checks=checks,
        data_getters=derived_getters,
        vectors_in_csv=sorted(in_csv),
        coverage_pct=coverage,
        derived={
            "status": derived_status,
            "getters": derived_getters,
            "indicators": indicators,
            "vectors_in_csv": sorted(in_csv),
            "vectors_expected": sorted(expected_set),
            "vectors_missing": sorted(missing) if missing else [],
            "coverage_pct": coverage,
            "hardcoded": hardcoded,
            "csv_files": csv_files,
        },
    )


def audit_all_pages(rows: list[PageRow]) -> list[PageAuditResult]:
    """Run independent audit for every wired page."""
    prefix_map = parse_source_vector_prefixes()
    prefix_to_indicator = prefix_to_indicators(prefix_map)
    efb = parse_efb_registry()
    eedas_tables = parse_eedas_source_tables()
    getter_defs = parse_data_loader_getters()
    csv_vectors = load_csv_vectors()

    row_by_page = {r.page_num: r for r in rows}
    wired_pages = [page_num for _section, page_num in parse_section_page_order()]

    return [
        audit_single_page(
            page_num,
            row_by_page.get(page_num),
            getter_defs,
            csv_vectors,
            prefix_to_indicator,
            efb,
            eedas_tables,
        )
        for page_num in wired_pages
    ]


def write_csv(rows: list[PageRow], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = [
        "legacy_page_num",
        "section_order",
        "section_title",
        "page_order_in_section",
        "page_component",
        "component_name",
        "translation_prefix",
        "css_prefix",
        "section_anchor_id",
        "title",
        "data_status",
        "data_getters",
        "indicator_keys",
        "raw_source_tables",
        "vectors_in_csv",
        "vectors_expected",
        "vectors_missing",
        "coverage_pct",
        "notes",
    ]
    with path.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow(
                {
                    "legacy_page_num": row.page_num,
                    "section_order": row.section_order,
                    "section_title": row.section_title,
                    "page_order_in_section": row.page_order_in_section,
                    "page_component": row.page_component,
                    "component_name": row.component_name,
                    "translation_prefix": row.translation_prefix,
                    "css_prefix": row.css_prefix,
                    "section_anchor_id": row.section_anchor_id,
                    "title": row.title,
                    "data_status": row.data_status,
                    "data_getters": "; ".join(row.data_getters),
                    "indicator_keys": "; ".join(row.indicator_keys),
                    "raw_source_tables": "; ".join(row.raw_source_tables),
                    "vectors_in_csv": "; ".join(row.vectors_in_csv),
                    "vectors_expected": "; ".join(row.vectors_expected),
                    "vectors_missing": "; ".join(row.vectors_missing),
                    "coverage_pct": row.coverage_pct,
                    "notes": row.notes,
                }
            )


def write_markdown(rows: list[PageRow], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    lines = [
        "# NRCan Energy Factbook — page coverage inventory",
        "",
        "Generated by `python scripts/page_inventory.py`. Pages are listed in website scroll order.",
        "",
        "| Status | Meaning |",
        "|--------|---------|",
        "| `no_data` | Overview or static page with no pipeline/hardcoded chart data |",
        "| `static_hardcoded` | Data embedded in page source (placeholder or manual constants) |",
        "| `pipeline_missing` | Uses dataLoader/CSV but no matching vectors in `data.csv` |",
        "| `pipeline_partial` | Some pipeline vectors in export, hybrid getter+hardcoded, or incomplete coverage |",
        "| `pipeline_present` | All expected pipeline vectors found in exported `data.csv` |",
        "",
    ]

    current_section: int | None = None
    for row in rows:
        if row.section_order != current_section:
            current_section = row.section_order
            lines.extend(["", f"## Section {row.section_order}: {row.section_title}", ""])

        lines.append(f"### {row.title}")
        lines.append("")
        lines.append(f"- **Component:** `{row.page_component}`")
        lines.append(f"- **Legacy page #:** {row.page_num}")
        if row.translation_prefix:
            lines.append(f"- **Translation prefix:** `{row.translation_prefix}`")
        lines.append(f"- **Data status:** `{row.data_status}`")
        if row.data_getters:
            lines.append(f"- **Data getters:** {', '.join(f'`{g}`' for g in row.data_getters)}")
        if row.coverage_pct:
            lines.append(f"- **Vector coverage:** {row.coverage_pct}%")
        if row.indicator_keys:
            lines.append(f"- **Indicators (transformed):** {', '.join(f'`{k}`' for k in row.indicator_keys)}")
        if row.raw_source_tables:
            lines.append(f"- **Raw DB tables:** {', '.join(f'`{t}`' for t in row.raw_source_tables)}")
        if row.vectors_in_csv:
            vec_display = ", ".join(f"`{v}`" for v in row.vectors_in_csv[:40])
            if len(row.vectors_in_csv) > 40:
                vec_display += f" … (+{len(row.vectors_in_csv) - 40} more)"
            lines.append(f"- **Vectors in export ({len(row.vectors_in_csv)}):** {vec_display}")
        elif row.vectors_expected:
            lines.append(f"- **Expected vectors:** {', '.join(f'`{v}`' for v in row.vectors_expected[:20])}")
        if row.vectors_missing:
            miss_display = ", ".join(f"`{v}`" for v in row.vectors_missing[:20])
            if len(row.vectors_missing) > 20:
                miss_display += f" … (+{len(row.vectors_missing) - 20} more)"
            lines.append(f"- **Vectors missing from export ({len(row.vectors_missing)}):** {miss_display}")
        if row.notes:
            lines.append(f"- **Notes:** {row.notes}")
        lines.append("")

    path.write_text("\n".join(lines), encoding="utf-8")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Generate page coverage inventory (CSV + Markdown)")
    parser.add_argument(
        "--csv",
        default=str(ROOT / "docs" / "page_inventory.csv"),
        help="Output CSV path",
    )
    parser.add_argument(
        "--md",
        default=str(ROOT / "docs" / "page_inventory.md"),
        help="Output Markdown path",
    )
    parser.add_argument(
        "--registry",
        action="store_true",
        help="Also write docs/page_registry.yaml and docs/page_registry.csv",
    )
    args = parser.parse_args(argv)

    if yaml is None:
        print("Warning: PyYAML not installed; indicator/raw table mapping may be incomplete")

    rows = build_inventory()
    csv_path = Path(args.csv)
    md_path = Path(args.md)
    write_csv(rows, csv_path)
    write_markdown(rows, md_path)

    if args.registry:
        from page_registry import build_registry, write_registry_csv, write_registry_yaml

        entries = build_registry(rows)
        reg_yaml = ROOT / "docs" / "page_registry.yaml"
        reg_csv = ROOT / "docs" / "page_registry.csv"
        write_registry_yaml(entries, reg_yaml)
        write_registry_csv(entries, reg_csv)
        print(f"  {reg_yaml}")
        print(f"  {reg_csv}")

    counts: dict[str, int] = {}
    for r in rows:
        counts[r.data_status] = counts.get(r.data_status, 0) + 1

    print(f"Wrote {len(rows)} pages to:")
    print(f"  {csv_path}")
    print(f"  {md_path}")
    print("Status summary:", ", ".join(f"{k}={v}" for k, v in sorted(counts.items())))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
