"""One-off helper: regenerate eedas_raw_tables_fragment.sql from eedas_registry.yaml."""
from __future__ import annotations

import yaml
from pathlib import Path


def esc(s: str) -> str:
    return s.replace("'", "''")


def main() -> None:
    root = Path(__file__).resolve().parent
    doc = yaml.safe_load((root / "eedas_registry.yaml").read_text(encoding="utf-8"))
    st = doc["source_tables"]
    data_tables = sorted({v["data_table"] for v in st.values()})
    meta_tables = sorted({v["metadata_table"] for v in st.values()})

    lines: list[str] = [
        "-- EEDAS per-source raw / semantic ingest tables (generated from eedas_registry.yaml)",
        "-- Regenerate: python scripts/db/_gen_eedas_raw_sql.py",
        "",
    ]

    def emit_data(name: str) -> None:
        lines.append(f"IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = '{name}')")
        lines.append("BEGIN")
        lines.append(f"    CREATE TABLE {name} (")
        lines.append("        id BIGINT IDENTITY(1,1) PRIMARY KEY,")
        lines.append("        vector NVARCHAR(50) NOT NULL,")
        lines.append("        ref_date NVARCHAR(20) NOT NULL,")
        lines.append("        value DECIMAL(18,4) NULL,")
        lines.append("        source_key NVARCHAR(100) NOT NULL,")
        lines.append("        fetched_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),")
        lines.append(f"        CONSTRAINT UQ_{name}_vd UNIQUE (vector, ref_date)")
        lines.append("    );")
        lines.append(f"    CREATE INDEX IX_{name}_vector ON {name}(vector);")
        lines.append(f"    CREATE INDEX IX_{name}_source ON {name}(source_key);")
        lines.append(f"    CREATE INDEX IX_{name}_ref_date ON {name}(ref_date);")
        lines.append(f"    PRINT 'Table {esc(name)} created.';")
        lines.append("END")
        lines.append("GO")
        lines.append("")

    def emit_meta(name: str) -> None:
        lines.append(f"IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = '{name}')")
        lines.append("BEGIN")
        lines.append(f"    CREATE TABLE {name} (")
        lines.append("        id INT IDENTITY(1,1) PRIMARY KEY,")
        lines.append("        vector NVARCHAR(50) NOT NULL UNIQUE,")
        lines.append("        title NVARCHAR(500) NULL,")
        lines.append("        uom NVARCHAR(100) NULL,")
        lines.append("        scalar_factor NVARCHAR(50) NULL,")
        lines.append("        source_org NVARCHAR(255) NULL,")
        lines.append("        source_url NVARCHAR(1000) NULL,")
        lines.append("        source_key NVARCHAR(100) NOT NULL,")
        lines.append("        fetched_at DATETIME2 NOT NULL DEFAULT GETUTCDATE()")
        lines.append("    );")
        lines.append(f"    CREATE INDEX IX_{name}_source ON {name}(source_key);")
        lines.append(f"    PRINT 'Table {esc(name)} created.';")
        lines.append("END")
        lines.append("GO")
        lines.append("")

    for t in data_tables:
        emit_data(t)
    for t in meta_tables:
        emit_meta(t)

    out = root / "eedas_raw_tables_fragment.sql"
    out.write_text("\n".join(lines), encoding="utf-8")
    print(f"Wrote {out} ({len(data_tables)} data + {len(meta_tables)} metadata tables)")


if __name__ == "__main__":
    main()
