# Section 4 — Energy Efficiency source map

Section 4 covers **Energy Efficiency** on the website: primary and secondary energy use by sector, residential and commercial end-use charts, SEU by fuel, and OEE-derived narratives. Sources combine OEE web downloads, local Excel workbooks, and HTML table scraping.

This map lists **every page in Section 4** (`SectionFour.jsx`). Local Excel is required for pages 48–49; pages 50–53 also use OEE web data (`constants.py`, `_oee.py`). OEE URLs are pinned to 2022/2023 vintages.

## How to use this map

1. Find your **page number** below.
2. Note the `source_key` and run all three pipeline stages for that source:

```bash
cd scripts
python main.py eedas update --source <source_key>
python main.py efb transform --indicator <source_key>
python main.py export
```


## Every page in Section 4

| Page | In pipeline? | Website getter | `source_key` | Handler function | Edit data here |
|------|--------------|----------------|--------------|------------------|----------------|
| **47** | No | — | — | — | Section cover — `src/pages/Page47.jsx` |
| **48** | Yes | `getEnergyUseData()` | `energy_use` | `update_energy_use()` · `energy_use.py` | `Energy Efficiency.xlsx` → `Primary and secondary demand` |
| **49** | Yes | `getSEUByFuelData()` | `seu_by_fuel` | `update_seu_by_fuel()` · `seu.py` | `Energy Efficiency.xlsx` → `SEU (final demand)` |
| **50** | Yes | `getPage50ResidentialData()` | `residential_daily_lives` | `update_residential_daily_lives()` · `residential.py` | OEE web + `Energy Efficiency.xlsx` → `EE Improvement` |
| **51** | Yes | `getPage51Data()` | `residential_pie_charts` | `update_residential_pie_charts()` · `residential.py` | OEE HB / Table 7 / Table 14 HTML |
| **52** | Yes | `getPage52Data()` | `commercial_institutional` | `update_commercial_institutional()` · `commercial.py` | OEE commercial HB/AN + `Energy Efficiency.xlsx` → `EE Improvement` |
| **53** | Yes | `getPage53Data()` | `industrial_sector` | `update_industrial_sector()` · `industrial.py` | OEE industrial CP + `Energy Efficiency.xlsx` → `EE Improvement` |
| **54** | No | — | — | — | Hardcoded — `src/pages/Page54.jsx` |
| **55** | No | — | — | — | Hardcoded — `src/pages/Page55.jsx` |
| **56** | No | — | — | — | Hardcoded — `src/pages/Page56.jsx` |
| **57** | No | — | — | — | Hardcoded — `src/pages/Page57.jsx` |

\*Pages 50 and 51 share the `res_*` prefix but different `source_key` values — update and transform both when residential data changes. Config key `energy_use.oee_neud_file_path` is **not used** (OEE NEUD comes from web ZIPs).

---

## Pipeline sources (detail)

Excel paths resolve via SharePoint sync (`EXTERNAL_XLSX_DATA_DIR` in `scripts/.env`). Section 4 reads **`Energy Efficiency.xlsx`** (consolidated Manual Data workbook); sheet names are in `constants.py` and `config.yaml`.

### `energy_use` — Page 48

| Item | Location |
|------|----------|
| Handler | `update_energy_use()`, `_load_primary_demand()` in `energy_use.py` |
| OEE fetch | `_oee.py` → `_fetch_oee_by_year()`; prefers `Energy Efficiency.xlsx` sheet `Primary and secondary demand`, else ZIP URLs in `constants.py` |
| Excel | `Energy Efficiency.xlsx`; sheet `Primary and secondary demand`; config override `primary_demand_file_path` |
| Primary columns | year + product + value — map in `PRIMARY_PRODUCT_TO_VEC` / `map_primary_secondary_product()` |
| Vectors | `oee_neud_*` |

### `seu_by_fuel` — Page 49

| Item | Location |
|------|----------|
| Handler | `update_seu_by_fuel()` in `seu.py` |
| Excel | `Energy Efficiency.xlsx`; sheet `SEU (final demand)`; config override `seu_final_demand_file_path` |
| Columns | year, fuel, value |
| Fuel rollup | Logic in `seu.py` → Ele, NG, mogas, Oil, OOP, BM, OT |
| Vectors | `seu_*` |

### `residential_daily_lives` — Page 50

| Item | Location |
|------|----------|
| Handler | `update_residential_daily_lives()` in `residential.py` |
| OEE web | `_oee.py` → `_fetch_oee_residential_analysis()`; URLs in `constants.py` |
| Row labels | `constants.py` → `_residential_label_*` |
| EE Excel | `Energy Efficiency.xlsx`; sheet `EE Improvement`, sector `residential`; optional sheet `Residential` |
| Vectors | `res_ter`, `res_eee`, `res_space_heating_pj`, `res_water_heating_pj`, `res_ee_*` |

### `residential_pie_charts` — Page 51

| Item | Location |
|------|----------|
| Handler | `_process_residential_pie_charts()` in `residential.py` |
| OEE HTML | `constants.py` → `OEE_HB_PAGES`, `OEE_TABLE7_PAGES`, `OEE_TABLE14_PAGES` |
| Parsing | `_oee.py` → `_parse_oee_html_table_generic()`; row maps in `residential.py` |
| Vectors | `res_reu_*`, `res_sh_*`, `res_wh_*`, … |

### `commercial_institutional` — Page 52

| Item | Location |
|------|----------|
| Handler | `_process_commercial_institutional()` in `commercial.py` |
| OEE HTML | `constants.py` → `OEE_COM_HB_PAGES`, `OEE_COM_AN_PAGES` |
| EE Excel | `Energy Efficiency.xlsx` → `EE Improvement`; sector `commercial` |
| Vectors | `com_*` |

### `industrial_sector` — Page 53

| Item | Location |
|------|----------|
| Handler | `_process_industrial_sector()` in `industrial.py` |
| OEE HTML | `constants.py` → `OEE_INDUSTRIAL_CP_URL` |
| EE Excel | `Energy Efficiency.xlsx` → `EE Improvement`; sector `industrial_excl_resource_extraction` |
| Vectors | `ind_*` |

---

## Shared files

| File | Purpose |
|------|---------|
| `constants.py` | OEE URLs, `Energy Efficiency.xlsx` + sheet names, residential row-label matchers |
| `_oee.py` | OEE ZIP/XLS/HTML download and parse helpers |

---

## If something changes

| Change type | What to edit |
|-------------|--------------|
| **Source file** (new path or filename) | `config.yaml` → `section4_indicators.sources.<key>.<*_file_path>`; or put the default file in `EXTERNAL_XLSX_DATA_DIR` (see pipeline detail above) |
| **Workbook sheet** renamed | Handler for that `source_key` — `sheet_name=` in `pd.read_excel()` |
| **Expected column** renamed or added | Same handler — `get_column()` calls in the Excel read block |
| **OEE page or ZIP URL** changed | `constants.py` (e.g. `OEE_NEUD_ZIP_URLS`, `OEE_HB_PAGES`, `OEE_COM_*`, `OEE_INDUSTRIAL_CP_URL`) |
| **Parsing rule** (row label → vector, fuel rollup, product keywords) | `_oee.py` for HTML/XLS structure; row maps in handler; residential matchers in `constants.py` → `_residential_label_*` |

| `source_key` | Sheet(s) to check | Column / parsing logic |
|--------------|-------------------|------------------------|
| `energy_use` | Primary Excel: first sheet | Year + product + value → `PRIMARY_PRODUCT_TO_VEC` in `energy_use.py`; OEE in `_oee.py` |
| `seu_by_fuel` | `SEU (final demand)` | Year, fuel, value; fuel rollup in `seu.py` |
| `residential_daily_lives` | `EE Improvement`; optional `Residential` | sector / metric / uom / value / year; OEE labels in `constants.py` |
| `residential_pie_charts` | *(web only)* | Row label lists in `residential.py`; HTML parse in `_oee.py` |
| `commercial_institutional` | `EE Improvement` | sector = `commercial`; OEE row maps in `commercial.py` |
| `industrial_sector` | `EE Improvement` | sector = `industrial_excl_resource_extraction`; OEE row maps in `industrial.py` |
