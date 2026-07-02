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
    r"\bHARDCODED\b",
    r"\bDATA_BY_YEAR\b",
    r"\bPAGE\d+_HARDCODED\b",
    r"placeholder\s+series",
    r"placeholder\s+data",
]

CSV_FETCH_PATTERN = re.compile(
    r"""fetch\s*\(\s*[`'"].*?data/([^`'"]+\.csv)""",
    re.I,
)


@dataclass
class PageRow:
    section_order: int
    section_title: str
    page_order_in_section: int
    page_num: int
    page_component: str
    title: str
    data_status: str
    indicator_keys: list[str] = field(default_factory=list)
    raw_source_tables: list[str] = field(default_factory=list)
    vectors_in_csv: list[str] = field(default_factory=list)
    vectors_expected: list[str] = field(default_factory=list)
    notes: str = ""


def _read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def parse_section_page_order() -> list[tuple[int, int]]:
    """Return [(section_num, page_num), ...] in website scroll order."""
    ordered: list[tuple[int, int]] = []
    for section_idx, section_path in enumerate(SECTION_FILES, start=1):
        if not section_path.exists():
            continue
        text = _read_text(section_path)
        for match in re.finditer(r"<Page(\d+)\s*/>", text):
            ordered.append((section_idx, int(match.group(1))))
    return ordered


def parse_translations_en() -> tuple[dict[str, str], dict[int, str]]:
    """Parse pageNN_title and nav_sectionN_title from translations.js (English block)."""
    text = _read_text(TRANSLATIONS)
    en_match = re.search(r"'en'\s*:\s*\{", text)
    if not en_match:
        return {}, {}
    fr_match = re.search(r"'fr'\s*:\s*\{", text[en_match.end() :])
    en_block = text[en_match.start() : en_match.start() + fr_match.start()] if fr_match else text[en_match.start() :]

    page_titles: dict[int, str] = {}
    section_titles: dict[int, str] = {}

    for key, value in re.findall(r"'([^']+)':\s*'((?:\\'|[^'])*)'", en_block):
        if m := re.fullmatch(r"page(\d+)_title", key):
            title = value.replace("\\n", " ").replace("\\'", "'")
            title = re.sub(r"\{\{[^}]+\}\}", "", title).strip()
            title = re.sub(r"\s+", " ", title).strip(" ,")
            page_titles[int(m.group(1))] = title
        if m := re.fullmatch(r"nav_section(\d+)_title", key):
            section_titles[int(m.group(1))] = value.replace("\\'", "'")

    return page_titles, section_titles


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


def parse_data_loader_getters() -> dict[str, dict]:
    """
    Parse dataLoader.js getters -> {prefixes: [], literals: [], excludes: []}.
    """
    text = _read_text(DATA_LOADER)
    getters: dict[str, dict] = {}
    chunks = re.split(r"(?=export async function |export function )", text)
    for chunk in chunks:
        m = re.match(r"export (?:async )?function (\w+)", chunk)
        if not m:
            continue
        name = m.group(1)
        prefixes = set(re.findall(r"\.startsWith\('([^']+)'\)", chunk))
        prefixes.update(re.findall(r'\.startsWith\("([^"]+)"\)', chunk))
        literals = set(re.findall(r"row\.vector === '([^']+)'", chunk))
        literals.update(re.findall(r'row\.vector === "([^"]+)"', chunk))
        regex_prefixes = re.findall(r"row\.vector\.match\(\s*/\^([^$\\]+)", chunk)
        for rp in regex_prefixes:
            rp = rp.replace("\\.", ".").rstrip("_")
            if rp and not rp.endswith("_"):
                prefixes.add(rp + "_")
            elif rp:
                prefixes.add(rp)
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


def parse_page_file(page_num: int) -> dict:
    path = PAGES / f"Page{page_num}.jsx"
    if not path.exists():
        return {"exists": False, "getters": [], "hardcoded": False, "csv_files": [], "notes": "Page file missing"}
    text = _read_text(path)
    getters: list[str] = []
    if "dataLoader" in text:
        import_match = re.search(
            r"from\s+['\"].*?dataLoader['\"];?",
            text,
        )
        if import_match:
            block_start = max(0, text.rfind("import", 0, import_match.start()))
            import_line = text[block_start : import_match.end() + 200]
            brace = re.search(r"import\s*\{([^}]+)\}", import_line, re.S)
            if brace:
                getters = re.findall(r"\b(get\w+Data\w*)\b", brace.group(1))

    hardcoded = any(re.search(p, text, re.I) for p in HARDCODED_PATTERNS)
    csv_files = CSV_FETCH_PATTERN.findall(text)

    override = PAGE_OVERRIDES.get(page_num, {})
    for g in override.get("getters", []):
        if g not in getters:
            getters.append(g)
    csv_files.extend(override.get("extra_csv", []))

    notes = override.get("notes", "")
    return {
        "exists": True,
        "getters": getters,
        "hardcoded": hardcoded,
        "csv_files": sorted(set(csv_files)),
        "notes": notes,
    }


def vectors_for_getter(getter_info: dict, csv_vectors: set[str]) -> tuple[list[str], list[str]]:
    """Return (expected_from_prefixes, matching_in_csv)."""
    prefixes = getter_info.get("prefixes", [])
    literals = getter_info.get("literals", [])

    expected: set[str] = set(literals)
    matched: set[str] = set()

    for lit in literals:
        if lit in csv_vectors:
            matched.add(lit)

    for prefix in prefixes:
        for v in csv_vectors:
            if v.startswith(prefix):
                matched.add(v)
                expected.add(v)

    if not expected and prefixes:
        for prefix in prefixes:
            expected.add(f"{prefix}*")

    return sorted(expected), sorted(matched)


def indicators_and_tables(
    prefixes: list[str],
    prefix_to_indicator: dict[str, list[str]],
    efb: dict[str, dict],
    eedas_tables: dict[str, str],
) -> tuple[list[str], list[str]]:
    indicators: set[str] = set()
    for prefix in prefixes:
        for ind in prefix_to_indicator.get(prefix, []):
            indicators.add(ind)
    raw_tables: set[str] = set()
    for ind in indicators:
        entry = efb.get(ind) or {}
        for table in entry.get("depends_on") or []:
            raw_tables.add(table)
        if ind in eedas_tables:
            raw_tables.add(eedas_tables[ind])
    return sorted(indicators), sorted(raw_tables)


def classify_page(
    page_info: dict,
    getter_defs: dict[str, dict],
    csv_vectors: set[str],
    prefix_to_indicator: dict[str, list[str]],
    efb: dict[str, dict],
    eedas_tables: dict[str, str],
) -> tuple[str, list[str], list[str], list[str], list[str], str]:
    getters = page_info.get("getters", [])
    csv_files = page_info.get("csv_files", [])
    notes = page_info.get("notes", "")

    if page_info.get("hardcoded"):
        return "static_hardcoded", [], [], [], [], notes or "Uses hardcoded or placeholder data in page file"

    if getters or csv_files:
        all_prefixes: list[str] = []
        all_expected: set[str] = set()
        all_matched: set[str] = set()
        for g in getters:
            info = getter_defs.get(g, {"prefixes": [], "literals": []})
            expected, matched = vectors_for_getter(info, csv_vectors)
            all_prefixes.extend(info.get("prefixes", []))
            all_expected.update(expected)
            all_matched.update(matched)

        indicators, raw_tables = indicators_and_tables(
            sorted(set(all_prefixes)), prefix_to_indicator, efb, eedas_tables
        )

        if csv_files:
            notes = "; ".join(filter(None, [notes, f"Also loads CSV: {', '.join(csv_files)}"]))

        if all_matched:
            status = "pipeline_present"
        else:
            status = "pipeline_missing"

        return (
            status,
            indicators,
            raw_tables,
            sorted(all_matched),
            sorted(all_expected),
            notes,
        )

    return "no_data", [], [], [], [], notes


def build_inventory() -> list[PageRow]:
    order = parse_section_page_order()
    page_titles, section_titles = parse_translations_en()
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
        status, indicators, raw_tables, in_csv, expected, notes = classify_page(
            page_info, getter_defs, csv_vectors, prefix_to_indicator, efb, eedas_tables
        )

        title = page_titles.get(page_num) or f"(no title key for page{page_num}_title)"
        rows.append(
            PageRow(
                section_order=section_num,
                section_title=section_titles.get(section_num, f"Section {section_num}"),
                page_order_in_section=section_counters[section_num],
                page_num=page_num,
                page_component=f"Page{page_num}",
                title=title,
                data_status=status,
                indicator_keys=indicators,
                raw_source_tables=raw_tables,
                vectors_in_csv=in_csv,
                vectors_expected=expected,
                notes=notes,
            )
        )
    return rows


def write_csv(rows: list[PageRow], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = [
        "section_order",
        "section_title",
        "page_order_in_section",
        "page_component",
        "title",
        "data_status",
        "indicator_keys",
        "raw_source_tables",
        "vectors_in_csv",
        "vectors_expected",
        "notes",
    ]
    with path.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow(
                {
                    "section_order": row.section_order,
                    "section_title": row.section_title,
                    "page_order_in_section": row.page_order_in_section,
                    "page_component": row.page_component,
                    "title": row.title,
                    "data_status": row.data_status,
                    "indicator_keys": "; ".join(row.indicator_keys),
                    "raw_source_tables": "; ".join(row.raw_source_tables),
                    "vectors_in_csv": "; ".join(row.vectors_in_csv),
                    "vectors_expected": "; ".join(row.vectors_expected),
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
        "| `pipeline_present` | Pipeline vectors found in exported `data.csv` |",
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
        lines.append(f"- **Data status:** `{row.data_status}`")
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
    args = parser.parse_args(argv)

    if yaml is None:
        print("Warning: PyYAML not installed; indicator/raw table mapping may be incomplete")

    rows = build_inventory()
    csv_path = Path(args.csv)
    md_path = Path(args.md)
    write_csv(rows, csv_path)
    write_markdown(rows, md_path)

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
