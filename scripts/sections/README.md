# Section processors — how the code is organized

Each Factbook section has its own folder under `scripts/sections/`. The folder name matches the key in `config.yaml` and the value you pass to `main.py eedas update --section …` or `efb transform --section …` (for example `section2_indicators`).

Every source has **two handlers**: an **`update_*`** function (EEDAS ingest) and a **`transform_*`** function (EFB indicators). They usually live in the same Python file per source.

## What lives in each folder

Every section folder is a small Python package:

```
scripts/sections/section2_indicators/
├── __init__.py          # Main class + list of sources this section runs
├── constants.py         # URLs, default filenames, vector name maps
├── _statcan.py          # StatCan URL builders (optional — see naming below)
├── _shared.py           # Other helpers used by 2+ sources (optional)
└── capital_expenditures.py   # One file per source (update_* + transform_*)
```

**One Python file per source, not per web page.** Several pages often read from the same source. Look up the source name in `scripts/config.yaml` under the section’s `sources:` block — that key should match a file name (with underscores instead of hyphens).

| File | Use when |
|------|----------|
| `constants.py` | URLs, filenames, vector maps, metadata — no leading underscore because every section has one |
| `_shared.py` | Generic helpers used by **two or more** source files in this folder |
| `_statcan.py` | StatCan download URL builders shared across sources (sections 1 and 2) |
| `_oee.py` | OEE download and HTML/XLS parsing shared across sources (section 4) |
| `_<topic>.py` | Any other domain-specific shared code (e.g. `_mpi.py` for Major Projects Inventory) |

Try to keep each file under about 500 lines. If a shared module grows much larger, split it by topic into another `_<topic>.py` file.

## How a source file works

When you open a source file, you will usually see two steps:

1. **`update_*`** — fetch or read data from the publisher; build publisher-native rows; save with `replace_raw_data` or `store_publisher_rows` on the section processor.
2. **`transform_*`** — read raw rows from SQL with `get_raw_dataframe`; aggregate to Factbook vectors; save with `store_indicators` → **`nrcan_efb_indicators`**.

Section 6 often uses a `build_*` function that returns rows for transform. Section 4 often uses a small mixin class per source. Both patterns are fine — copy what the neighbouring files in that folder already do.

The `source_key` string must match the key in `config.yaml`, in `scripts/db/eedas_registry.yaml`, and (for transforms) in `scripts/db/efb_indicators_registry.yaml`.

## Section folders

| Folder | Config / CLI key | Number of sources |
|--------|------------------|-------------------|
| [`section1_indicators/`](section1_indicators/) | `section1_indicators` | 6 |
| [`section2_indicators/`](section2_indicators/) | `section2_indicators` | 9 |
| [`section4_indicators/`](section4_indicators/) | `section4_indicators` | 6 |
| [`section5_indicators/`](section5_indicators/) | `section5_indicators` | 4 |
| [`section6_indicators/`](section6_indicators/) | `section6_indicators` | 7 |

(Section 3 is not wired up in the pipeline yet.)

Each section folder has a **page-by-page source map** README. Every page wired in `SectionOne.jsx` … `SectionSix.jsx` is listed — either with the full pipeline chain (getter → `source_key` → handler → files/URLs) or marked **Not in pipeline** with the React file to edit.

| Section | Source map |
|---------|------------|
| Key Indicators | [`section1_indicators/README.md`](section1_indicators/README.md) |
| Investment | [`section2_indicators/README.md`](section2_indicators/README.md) |
| Energy Efficiency | [`section4_indicators/README.md`](section4_indicators/README.md) |
| Clean Power | [`section5_indicators/README.md`](section5_indicators/README.md) |
| Oil, Gas and Coal | [`section6_indicators/README.md`](section6_indicators/README.md) |

## Adding or changing a source — checklist

1. Add or edit the source under `sources:` in `scripts/config.yaml`.
2. Register the table in `scripts/db/eedas_registry.yaml` if it is new.
3. Implement **`update_*`** in the matching `.py` file in the section folder.
4. Register the indicator in `scripts/db/efb_indicators_registry.yaml`; implement **`transform_*`**.
5. Register the vector prefix in `scripts/export/source_vectors.py`.
6. Run all three stages, then check the page in the browser:

   ```bash
   cd scripts
   python main.py eedas update --source my_source_key
   python main.py efb transform --indicator my_source_key
   python main.py export
   ```

7. If something failed, read the newest log in `scripts/logs/`.

**Sync points:**

- **`SECTION_KEY`** on the processor class — must stay in sync with `config.yaml`.
- **Handler registry keys** — must match `config.yaml` source names.
- **Vector prefixes** (for example `capex_`, `res_`) — the React app filters on these.
