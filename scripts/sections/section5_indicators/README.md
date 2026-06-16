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
| **65** | Yes | `getPage65Data()` | `electricity_trade_us` | `update_electricity_trade_us()` / `transform_electricity_trade_us()` · `electricity_trade_us.py` | CER Electricity Trade Summary XLSM |
| **67** | No | — | — | — | Hardcoded generation infographic — `src/pages/Page67.jsx` |
| **71** | Yes | `getPage71Data()` | `ghg_electricity_spotlight` | `update_ghg_electricity_spotlight()` / `transform_ghg_electricity_spotlight()` · `ghg_electricity_spotlight.py` | ECCC environmental indicators CSV + gencap `coal_elegen` |
| **74** | Yes | `getPage74Data()` | `renewable_electricity_capacity` | `update_renewable_electricity_capacity()` / `transform_renewable_electricity_capacity()` · `renewable_electricity_capacity.py` | SharePoint gencap `ren_elecap` sheet |
| **96** | Yes | `getPage96Data()` | `ev_sales` | `build_ev_sales_rows()` · `ev_sales.py` | `constants.py` → `EV_SALES_*` |
| **78** | Yes | `getPage78Data()` | `solid_biofuels` | `update_solid_biofuels()` / `transform_solid_biofuels()` · `solid_biofuels.py` | SharePoint `RenAQ.xlsx` + StatCan 25-10-0031-01 |
| **81** | Yes | `getPage81Data()` | `wind_capacity_by_province`, `largest_wind_projects` | `update_*` / `transform_*` · `wind_capacity.py` | SharePoint gencap + largest-projects workbooks |
| **84** | Yes | `getPage84Data()` | `largest_solar_projects` | `update_largest_solar_projects()` / `transform_largest_solar_projects()` · `largest_solar_projects.py` | SharePoint `Largest hydrofac, wind and solar projects.xlsx` → `solprojects` |

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

### `electricity_trade_us` — Page 65

| Item | Location |
|------|----------|
| Handlers | `update_electricity_trade_us()` / `transform_electricity_trade_us()` in `electricity_trade_us.py` |
| Source URL | `constants.py` → `CER_ELECTRICITY_TRADE_URL` |
| Sheet | `Fig. 1 (a), Fig. 3 (a)` — annual exports/imports in MW.h |
| Monthly check | `Fig. 1(m), Fig. 3(m)` — a year is published only when it has **12 distinct months** in this sheet |
| Unit conversion | MWh ÷ 1,000,000 → TWh, **one decimal place** (`round(..., 1)`); net = exports − imports at same precision |
| Vectors | `elec_trade_exports`, `elec_trade_imports`, `elec_trade_net` |
| Raw helper | `months_reported` — month count stored on EEDAS update; transform skips years with fewer than 12 |

### `ghg_electricity_spotlight` — Page 71

| Item | Location |
|------|----------|
| Handlers | `update_ghg_electricity_spotlight()` / `transform_ghg_electricity_spotlight()` in `ghg_electricity_spotlight.py` |
| EEDAS table | `ecc_ghg_electricity` |
| GHG source | [ECCC environmental indicators — electricity sector CSV](https://www.canada.ca/en/environment-climate-change/services/environmental-indicators/greenhouse-gas-emissions.html) |
| Narrative source | `secondary Master gencap file.xlsx` → sheet `coal_elegen` (coal generation share) |
| Years | 2000+ per indicator spec |
| Chart vectors | `elec_ghg_coal`, `elec_ghg_natural_gas`, `elec_ghg_other`, `elec_ghg_total` |
| Narrative stats | `elec_ghg_stat_total_pct_change`, `elec_ghg_stat_coal_gen_share_pct`, `elec_ghg_stat_coal_ghg_share_pct` |

### `renewable_electricity_capacity` — Page 74

| Item | Location |
|------|----------|
| Handlers | `update_renewable_electricity_capacity()` / `transform_renewable_electricity_capacity()` in `renewable_electricity_capacity.py` |
| EEDAS table | `nrcan_renelecap` |
| Workbook | `secondary Master gencap file.xlsx` → sheet `ren_elecap` |
| Years | 2018+ per indicator spec |
| Source mapping | `hydro`, `wind`, `biomass` (Biomass & Geothermal), `solar & tidal` (Solar & Tidal) |
| Vectors | `ren_cap_hydro`, `ren_cap_wind`, `ren_cap_biomass`, `ren_cap_solar_tidal` |

### `solid_biofuels` — Page 78

| Item | Location |
|------|----------|
| Handlers | `update_solid_biofuels()` / `transform_solid_biofuels()` in `solid_biofuels.py` |
| EEDAS table | `nrcan_solid_biofuels` (raw RenAQ + StatCan inputs prefixed `sbio_raw_*`) |
| Bar chart source | `RenAQ.xlsx` → sheets `SGBIOFUELS`, `PRIMSBIO` |
| Pie chart source | `PRIMSBIO` (Ts, Res, Is) + StatCan table 25-10-0031-01 (solid wood waste, spent pulping liquor) |
| Bar vectors | `sbio_prod_pulping`, `sbio_prod_swr`, `sbio_prod_firewood`, `sbio_prod_pellets` |
| Pie vectors | `sbio_use_electricity`, `sbio_use_residential`, `sbio_use_industrial`, `sbio_use_total` |
| Industrial (Isc) | `Is × ICEsw × 0.8 + Is × ICEspl × 0.7` (TJ), rounded to PJ; ICEsw = sww/(sww+spl) |

### `wind_capacity_by_province` — Page 81 (province bar chart)

| Item | Location |
|------|----------|
| Handlers | `update_wind_capacity_by_province()` / `transform_wind_capacity_by_province()` in `wind_capacity.py` |
| EEDAS table | `nrcan_windcapbyprov` |
| Workbook | `secondary Master gencap file.xlsx` → sheet `src_elecap_prov` |
| Filter | `source = wind`, all provinces/territories where MW > 0; sorted descending for chart |
| Vectors | `wind_cap_{prov_key}` (e.g. `wind_cap_ont`, `wind_cap_alta`) |

### `largest_wind_projects` — Page 81 (horizontal bar chart)

| Item | Location |
|------|----------|
| Handlers | `update_largest_wind_projects()` / `transform_largest_wind_projects()` in `wind_capacity.py` |
| EEDAS table | `can_largestwindprojects` |
| Workbook | `Largest hydrofac, wind and solar projects.xlsx` → sheet `windprojects` |
| Filter | capacity ≥ 200 MW; ordered largest to smallest |
| Vectors | `wind_proj_{nn}_mw`, `wind_proj_{nn}_prov` (facility title in metadata) |

### `largest_solar_projects` — Page 84 (horizontal bar chart)

| Item | Location |
|------|----------|
| Handlers | `update_largest_solar_projects()` / `transform_largest_solar_projects()` in `largest_solar_projects.py` |
| EEDAS table | `can_largestsolprojects` |
| Workbook | `Largest hydrofac, wind and solar projects.xlsx` → sheet `solprojects` |
| Filter | capacity ≥ 50 MW; ordered largest to smallest |
| Vectors | `solar_proj_{nn}_mw`, `solar_proj_{nn}_prov` (facility title in metadata) |

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

