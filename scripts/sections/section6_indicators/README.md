# Section 6 — Oil, Gas and Coal source map

Section 6 covers **Oil, Natural Gas and Coal** on the website: production, trade, reserves, prices, and related indicators from StatCan, NRCan, and local Excel where noted.

This map lists **every page in Section 6** (`SectionSix.jsx`). Local Excel is used for page 138 only; other pipeline pages fetch from the web.

## How to use this map

1. Find your **page number** below.
2. Note the `source_key` and run all three pipeline stages for that source:

```bash
cd scripts
python main.py eedas update --source <source_key>
python main.py efb transform --indicator <source_key>
python main.py export
```


## Every page in Section 6

| Page | In pipeline? | Website getter | `source_key` | Handler function | Edit data here |
|------|--------------|----------------|--------------|------------------|----------------|
| **103** | No | — | — | — | Section cover — `src/pages/Page103.jsx` |
| **105** | No | — | — | — | Hardcoded — `src/pages/Page105.jsx` |
| **106** | No | — | — | — | Hardcoded — `src/pages/Page106.jsx` |
| **107** | No | — | — | — | Hardcoded — `src/pages/Page107.jsx` |
| **108** | No | — | — | — | Hardcoded world crude data — `src/pages/Page108.jsx` |
| **111** | Yes | `getPage111Data()` | `canadian_production` | `update_canadian_production()` / `transform_canadian_production()` · `canadian_production.py` | StatCan 25-10-0014-01 + 25-10-0063-01 |
| **112** | No | — | — | — | Hardcoded — `src/pages/Page112.jsx` |
| **113** | Yes | `getPage113Data()` | `oil_sands` | `build_oil_sands_rows()` · `oil_sands.py` | CAPP XLSX + StatCan in `oil_sands.py` / `constants.py` |
| **117** | Yes | `getPage117Data()` | `crude_prices` | `build_crude_price_rows()` · `crude_prices.py` | `constants.py` → EIA, Sproule, BoC URLs |
| **119** | No | — | — | — | Hardcoded — `src/pages/Page119.jsx` |
| **122** | No | — | — | — | Hardcoded world gas production — `src/pages/Page122.jsx` |
| **123** | No | — | — | — | Hardcoded world gas reserves — `src/pages/Page123.jsx` |
| **126** | No | — | — | — | Hardcoded — `src/pages/Page126.jsx` |
| **132** | Yes* | `getOilGasGhgSpotlightData()`, `getGhgNarrativeStats()` | `ghg_emissions`* | Section 1 `ghg_emissions.py`* | Section 1 README |
| **135** | No | — | — | — | Static — `src/pages/Page135.jsx` |
| **136** | Yes | `getPage136Data()` | `rpp_supply_demand`, `rpp_refinery_input` | `process_rpp_*()` · `rpp.py` | `constants.py` StatCan vector IDs |
| **138** | Yes | `getPage138GasolineData()` | `kal_gas_prices` | `build_kalibrate_gas_price_rows()` · `kalibrate.py` | Kalibrate web + `Section 6.xlsx` |
| **139** | Yes | `getPage139RefineryCapacityData()` | `osm_refin_cap` | `build_refinery_capacity_rows()` · `refinery_capacity.py` | Oil Sands Magazine HTML |
| **140** | No | — | — | — | Hardcoded world coal data — `src/pages/Page140.jsx` |

\*Source owned by **Section 1** — run EEDAS update / EFB transform with `--source ghg_emissions`.

---

## Pipeline sources (detail)

### `rpp_supply_demand` — Page 136

| Item | Location |
|------|----------|
| Handler | `process_rpp_supply_demand()` in `rpp.py` |
| StatCan table | 25-10-0081-01 |
| Vector IDs | `constants.py` → `SUPPLY_VECTORS`, `PRODUCT_VECTORS` |
| Vectors | `rpp_net_prod_*`, `rpp_imports_*`, … |

### `rpp_refinery_input` — Page 136

| Item | Location |
|------|----------|
| Handler | `process_rpp_refinery_input()` in `rpp.py` |
| StatCan table | 25-10-0063-01 |
| Vector ID | `constants.py` → `REFINERY_INPUT_VECTOR` |
| Vectors | `rpp_refinery_*` |

### `crude_prices` — Page 117

| Item | Location |
|------|----------|
| Handler | `build_crude_price_rows()` in `crude_prices.py` |
| WTI / WCS / FX | `constants.py` → `EIA_WTI_XLS`, `SPROULE_BASE`, `BOC_VALET` |
| Vectors | `crude_*` |

### `oil_sands` — Page 113

| Item | Location |
|------|----------|
| Handler | `build_oil_sands_rows()` in `oil_sands.py` |
| Sources | CAPP XLSX + StatCan vectors — URLs in `constants.py` and `oil_sands.py` |
| Vectors | `os_*` |

### `canadian_production` — Page 111

| Item | Location |
|------|----------|
| Handlers | `update_canadian_production()` / `transform_canadian_production()` in `canadian_production.py` |
| EEDAS table | `stc_canadian_production` |
| StatCan sources | Table **25-10-0014-01** (Canada by type, 2000–2015) + **25-10-0063-01** (Canada by type and province, 2016+) |
| Website getter | `getPage111Data()` in `src/utils/dataLoader.js` |
| Update (raw) | `raw_cp_s14_*_m3` category totals from 25100014; `raw_cp_s63_*_m3` from 25100063 (Canada + provinces) |
| Transform | Oil sands = synthetic + bitumen; conventional = heavy + light/medium + condensate + pentanes plus; MMb/d = m³ × 6.2898 ÷ 1000 ÷ 365 |
| Production vectors | `cp_oil_sands_*`, `cp_conventional_*`, `cp_total_*`, `cp_share_pct` |
| Province vectors | `cp_prov_{ab,sk,nl,mb,bc,ns,on,nt,other}_{thousand_m3,pct}`; Other = Canada − (AB + SK + NL + MB + BC + NS + ON + NT) |
| Static UI only | Infographic PNG, overlay positions (`Page111ProvinceInfographic.constants.js`), chart colours |

### `kal_gas_prices` — Page 138

| Item | Location |
|------|----------|
| Handler | `build_kalibrate_gas_price_rows()` in `kalibrate.py` |
| Web | `config.yaml` → `kal_gas_prices.source_url` |
| Excel | `Section 6.xlsx`, sheet `kalibrate_archive`; config `section6_xlsx` |
| Market IDs | `kalibrate.py` → `KALIBRATE_WEB_MARKETS` |
| Vectors | `kal_*` |

### `osm_refin_cap` — Page 139

| Item | Location |
|------|----------|
| Handler | `build_refinery_capacity_rows()` in `refinery_capacity.py` |
| URL | `config.yaml` or `OSM_REFINERY_URL` in `refinery_capacity.py` |
| Vectors | `refcap_*` |

### `ghg_emissions` — Page 132 (Section 1)

| Item | Location |
|------|----------|
| Handler | `process_ghg_emissions()` in Section 1 `ghg_emissions.py` |
| Spotlight rows | `build_oil_gas_spotlight_rows()` |
| Vectors | `ghg_*` |

---

## Shared files

| File | Purpose |
|------|---------|
| `constants.py` | StatCan vector IDs, external URLs, province maps |
| `rpp.py`, `crude_prices.py`, `oil_sands.py`, `canadian_production.py`, `kalibrate.py`, `refinery_capacity.py` | One module per source |

---

## If something changes

| Change type | What to edit |
|-------------|--------------|
| **Source file** (`Section 6.xlsx`) | `config.yaml` → `kal_gas_prices.section6_xlsx`; file in `EXTERNAL_XLSX_DATA_DIR` or repo root |
| **Workbook sheet / columns** | `kalibrate.py` — sheet `kalibrate_archive` |
| **Download URL** changed (StatCan, CAPP, EIA, Kalibrate, Oil Sands Magazine) | `constants.py` and/or handler for that source |
| **Parsing rule** (StatCan vector IDs, province maps, Kalibrate formulas, HTML scrape) | `constants.py` for IDs/maps; logic in matching module |
| Page 132 GHG split | Section 1 `ghg_emissions.py` |
