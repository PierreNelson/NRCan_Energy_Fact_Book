# Section 5 — Clean Power source map

Section 5 covers **Clean Power and Low Carbon Fuels** on the website: environmental and clean technology indicators from StatCan tables and optional TSX listing data.

This map lists **every page in Section 5** (`SectionFive.jsx`). Optional local TSX workbook for page 61; all other pipeline pages fetch from the web.

## How to use this map

1. Find your **page number** below.
2. Note the `source_key` and run all three pipeline stages for that source:

```bash
cd scripts
python main.py eedas update --source <source_key>
python main.py efb transform --indicator <source_key>
python main.py export
```


## Every page in Section 5

| Page | In pipeline? | Website getter | `source_key` | Handler function | Edit data here |
|------|--------------|----------------|--------------|------------------|----------------|
| **59** | No | — | — | — | Section cover — `src/pages/Page59.jsx` |
| **60** | No | — | — | — | Static infographic — `src/pages/Page60.jsx` |
| **61** | Yes | `getEnvironmentalCleanTechData()` | `environmental_clean_tech` | `process_environmental_clean_tech()` · `environmental_clean_tech.py` | StatCan URLs in handler + optional TSX XLSX |
| **62** | Yes | `getPage62Data()` | `cleantech_companies_geo` | `process_cleantech_companies_geo()` · `cleantech_companies_geo.py` | NRCan web page + `constants.py` regions |
| **63** | Yes | `getPage63Data()` | `cleantech_companies_industry` | `process_cleantech_companies_industry()` · `cleantech_companies_industry.py` | Same NRCan URL + `constants.py` industries |
| **64** | No | — | — | — | Hardcoded / static — `src/pages/Page64.jsx` |
| **65** | No | — | — | — | Hardcoded trade data — `src/pages/Page65.jsx` |
| **67** | No | — | — | — | Hardcoded generation infographic — `src/pages/Page67.jsx` |
| **71** | No | — | — | — | Hardcoded chart data — `src/pages/Page71.jsx` |
| **74** | No | — | — | — | Hardcoded chart data — `src/pages/Page74.jsx` |
| **96** | Yes | `getPage96Data()` | `ev_sales` | `build_ev_sales_rows()` · `ev_sales.py` | `constants.py` → `EV_SALES_*` |

---

## Pipeline sources (detail)

### `environmental_clean_tech` — Page 61

| Item | Location |
|------|----------|
| Handler | `process_environmental_clean_tech()` in `environmental_clean_tech.py` |
| StatCan tables | 14-10-0023-01, 36-10-0103-01, 36-10-0645-01, 36-10-0632-01, 36-10-0629-01 — URLs in handler |
| TSX list (optional) | `constants.py` → `TSX_CLEANTECH_URL`, `DEFAULT_TMX_XLSX*`; config `tmx_xlsx_path` |
| Vectors | `envcleantech_*` |

### `cleantech_companies_geo` — Page 62

| Item | Location |
|------|----------|
| Handler | `process_cleantech_companies_geo()` in `cleantech_companies_geo.py` |
| Web URL | `config.yaml` or `constants.py` → `CLEANTECH_GEO_URL` |
| Region list | `constants.py` → `CLEANTECH_GEO_REGIONS` |
| Vectors | `cleantech_geo_*` |

### `cleantech_companies_industry` — Page 63

| Item | Location |
|------|----------|
| Handler | `process_cleantech_companies_industry()` in `cleantech_companies_industry.py` |
| Web URL | Same as Page 62 |
| Industry list | `constants.py` → `CLEANTECH_INDUSTRIES` |
| Vectors | `cleantech_ind_*` |

### `ev_sales` — Page 96

| Item | Location |
|------|----------|
| Handler | `_process_ev_sales()` in `__init__.py` → `build_ev_sales_rows()` in `ev_sales.py` |
| StatCan URLs / vectors | `constants.py` → `EV_SALES_URL_*`, `EV_SALES_OLD_*`, `EV_SALES_NEW_*` |
| Vectors | `ev_*` |

---

## Shared files

| File | Purpose |
|------|---------|
| `constants.py` | EV sales URLs/vectors, cleantech geo/industry lists, TSX defaults |

---

## If something changes

| Change type | What to edit |
|-------------|--------------|
| **Source file** (TSX list) | `config.yaml` → `tmx_xlsx_path`; defaults in `constants.py` → `DEFAULT_TMX_XLSX*` |
| **Workbook sheet / columns** | `environmental_clean_tech.py` (TSX XLSX read logic) |
| **Download URL** changed (StatCan, NRCan web, TSX) | Handler for that source or `constants.py` |
| **Parsing rule** (region/industry lists, StatCan filters, EV vector IDs) | `constants.py`; scraper/filter logic in matching handler |

