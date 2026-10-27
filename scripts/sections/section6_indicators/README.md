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
| **103** | No | — | — | — | Section cover — `src/pages/OilGasCoalOverview.jsx` |
| **105** | Yes | `getPetroleumEmploymentByRegionData()` | `petroleum_sector_employment` | `update_petroleum_sector_employment()` / `transform_petroleum_sector_employment()` · `petroleum_sector_employment.py` | SharePoint `energy_rankings_and_petroleum_emp.xlsx`, sheet `petroleum_sector_employment` |
| **106** | No | — | — | — | Hardcoded — `src/pages/PetroleumEmployment.jsx` |
| **107** | No | — | — | — | Hardcoded — `src/pages/PetroleumGdp.jsx` |
| **108** | No | — | — | — | Hardcoded world crude data — `src/pages/CrudeOilInternational.jsx` |
| **110** | Yes | `getCanadianCrudeReservesData()` | `petroleum_reserves`, `western_canada_oil_wells` | `update_petroleum_reserves()` / `update_western_canada_oil_wells()` · `petroleum_reserves.py`, `western_canada_oil_wells.py` | Oil-well chart: AER ST59 latest year, `AB_wells_completions_historical.csv`, Petrinex SK, Manitoba stats page, BC ER drill completions, `manual_well_overrides.csv`. Reserves stay on `energy_rankings_and_petroleum_emp.xlsx`. |
| **111** | Yes | `getCanadianCrudeProductionData()` | `canadian_production` | `update_canadian_production()` / `transform_canadian_production()` · `canadian_production.py` | StatCan 25-10-0014-01 + 25-10-0063-01 |
| **112** | No | — | — | — | Hardcoded — `src/pages/CanadianSupplyDemand.jsx` |
| **113** | Yes | `getOilSandsProductionData()` | `oil_sands` | `build_oil_sands_rows()` · `oil_sands.py` | CAPP XLSX + StatCan in `oil_sands.py` / `constants.py` |
| **114** | Yes | `getOilSandsMiningData()` | `oil_sands_mining` | `update_oil_sands_mining()` / `transform_oil_sands_mining()` · `oil_sands_mining.py` | Latest AER ST39 workbook, sheet `VAR0800-ST39Extracts_xls`, plus StatCan v107757054 and v107757056. |
| **115** | Yes | `getOilSandsInSituData()` | `oil_sands_in_situ` | `update_oil_sands_in_situ()` / `transform_oil_sands_in_situ()` · `oil_sands_in_situ.py` | Latest AER ST53 BITUMEN sheet, plus StatCan v107757054 and v107757056. |
| **117** | Yes | `getCrudeOilPricesData()` | `crude_prices` | `build_crude_price_rows()` · `crude_prices.py` | `constants.py` → EIA, Sproule, BoC URLs |
| **118** | Image | — | — | `publish_cer_oil_pipeline_map()` · `export/cer_oil_pipeline_map.py` | CER Canada's Pipeline System 2021, crude oil page. Export replaces `src/assets/major_cer_regulated_oil_pipelines_bg.png` and the French file. |
| **119** | No | — | — | — | Hardcoded — `src/pages/OilByRail.jsx` |
| **120** | Yes | `getOilSandsEnvironmentalConsiderationsData()` | `oil_sands_environmental_considerations` | `update_oil_sands_environmental_considerations()` / `transform_oil_sands_environmental_considerations()` · `oil_sands_environmental_considerations.py` | AER water use performance workbook. Mining fresh water is Lower Athabasca River plus groundwater plus surface runoff. In situ non-saline water is high quality nonsaline plus alternative nonsaline. Intensity is annual barrels divided by annual hydrocarbon production. Recycled share is recycled water divided by total water use. |
| **121** | Yes | `getOilSandsGreenhouseGasesData()` | `oil_sands_greenhouse_gases` | `update_oil_sands_greenhouse_gases()` / `transform_oil_sands_greenhouse_gases()` · `greenhouse_gases.py` | StatCan v17946 and v17947 (2000–2015, thousand m³) plus v107757052 and v107757060 (2016+, cubic metres). Climate Watch World total excluding LULUCF. ECCC `GHG_Econ_Can_Prov_Terr.csv` for Canada and oil sands. |
| **122** | No | — | — | — | Hardcoded world gas production — `src/pages/NaturalGasInternational.jsx` |
| **123** | No | — | — | — | Hardcoded world gas reserves — `src/pages/WorldProvedGasReserves.jsx` |
| **126** | Yes | `getWesternCanadaGasWellCompletionsData()` | `western_canada_gas_wells` | `update_western_canada_gas_wells()` / `transform_western_canada_gas_wells()` · `western_canada_gas_wells.py` | Same provincial well sources as page 110. Natural gas product only. |
| **130** | Image | — | — | `publish_cer_gas_pipeline_map()` · `export/cer_gas_pipeline_map.py` | CER Canada's Pipeline System 2021, natural gas page. Export replaces `src/assets/cer_regulated_gas_pipelines_bg.png` and the French file. |
| **131** | Yes | `getNaturalGasEnergyUseData()` | `natural_gas_energy_use`, `natural_gas_energy_use_province` | `natural_gas_energy_use.py` | Sector table from `oee_neud_ngenergyuse_sector`. Province donut from `oee_neud_ngenergyuse_province`. Both read `Energy Efficiency.xlsx` sheet `NG energy use` until `oee_neud_energy_efficiency_customfile.xlsx` is in Manual Data. Shares are the sheet values. Sector Bcf/d is PJ divided by days in the year divided by 1.055. The donut centre is the sum of province petajoules. |
| **132** | Yes* | `getOilGasGhgSpotlightData()`, `getGhgNarrativeStats()` | `ghg_emissions`* | Section 1 `ghg_emissions.py`* | Section 1 README |
| **134** | Yes | `getNaturalGasLiquidsEnergyUseData()` | `natural_gas_liquids_energy_use`, `natural_gas_liquids_energy_use_province` | `natural_gas_liquids_energy_use.py` | Sector table from `oee_neud_ngl_energyuse_sector`. Province donut from `oee_neud_ngl_energyuse_province`. Both read `Energy Efficiency.xlsx` sheet `NGL energy use` until `oee_neud_energy_efficiency_customfile.xlsx` is in Manual Data. Shares are the sheet values. The heading and donut centre round the petajoule total to a whole number. |
| **135** | No | — | — | — | Static — `src/pages/RefinedPetroleumProducts.jsx` |
| **136** | Yes | `getRppSupplyDemandData()` | `rpp_supply_demand`, `rpp_refinery_input` | `process_rpp_*()` · `rpp.py` | `constants.py` StatCan vector IDs |
| **138** | Yes | `getRetailGasolinePricesGasolineData()` | `kal_gas_prices` | `build_kalibrate_gas_price_rows()` · `kalibrate.py` | Kalibrate web + `Section 6.xlsx` |
| **139** | Yes | `getRefineryCapacityRefineryCapacityData()` | `osm_refin_cap` | `build_refinery_capacity_rows()` · `refinery_capacity.py` | Oil Sands Magazine HTML |
| **140** | No | — | — | — | Hardcoded world coal data — `src/pages/CoalInternational.jsx` |

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

### `petroleum_sector_employment` — Page 105

| Item | Location |
|------|----------|
| Handler | `update_petroleum_sector_employment()` / `transform_petroleum_sector_employment()` in `petroleum_sector_employment.py` |
| EEDAS table | `ca_statcan_petroleum_sector_employment_summary` |
| Source | SharePoint Manual Data → `energy_rankings_and_petroleum_emp.xlsx`, sheet `petroleum_sector_employment` |
| Website getter | `getPetroleumEmploymentByRegionData()` in `src/utils/dataLoader.js` |
| Vectors | `pet_emp_{region}_{direct\|indirect}_pct`, `pet_emp_direct_total`, `pet_emp_indirect_total`, `pet_emp_reporting_year` |

### `petroleum_reserves` — Page 110 (infographic reserves)

| Item | Location |
|------|----------|
| Handler | `update_petroleum_reserves()` / `transform_petroleum_reserves()` in `petroleum_reserves.py` |
| EEDAS table | `ca_petroleum_reserves_summary` |
| Source | SharePoint Manual Data → `energy_rankings_and_petroleum_emp.xlsx`, sheet `petroleum_reserves_summary` |
| Website getter | `getCanadianCrudeReservesData()` in `src/utils/dataLoader.js` |
| Vectors | `cr_res_total_bb`, `cr_res_conventional_bb`, `cr_res_oil_sands_bb`, `cr_res_mining_bb`, `cr_res_insitu_bb`, `cr_res_reporting_year` |

### `western_canada_oil_wells` — Page 110 (combo chart)

| Item | Location |
|------|----------|
| Handler | `update_western_canada_oil_wells()` / `transform_western_canada_oil_wells()` in `western_canada_oil_wells.py` |
| EEDAS table | `ca_western_canada_oil_wells_count_depth` |
| Alberta | Latest year from AER ST59 (crude oil + crude bitumen). Earlier years from SharePoint `AB_wells_completions_historical.csv` |
| Saskatchewan | Petrinex SK well infrastructure CSV, `WellStatusFluid = OIL` |
| Manitoba | [Manitoba petroleum statistics](https://www.gov.mb.ca/iem/petroleum/stats/index.html), with `manual_well_overrides.csv` replacing only the records it contains |
| British Columbia | BC ER data-centre completion zip → `compl_wo.csv`, one record per UWI |
| Vectors | `wc_oil_wells_completed`, `wc_oil_total_metres`, `wc_oil_avg_depth_m` |

### `western_canada_gas_wells` — Page 126 (combo chart)

| Item | Location |
|------|----------|
| Handler | `update_western_canada_gas_wells()` / `transform_western_canada_gas_wells()` in `western_canada_gas_wells.py` |
| EEDAS table | `ca_western_canada_gas_wells_count_depth` |
| Sources | Page 126 spec: Alberta, Saskatchewan, and British Columbia only. Alberta gas is the AER ST59 natural gas total (coalbed methane excluded); earlier years come from SharePoint `AB_wells_completions_historical.csv`, and the ST59 year replaces that CSV year. Saskatchewan Petrinex `WellStatusFluid = GAS`, year from `FinishedDrillDate`, depth `FinalTotalDepth`. British Columbia `Flow_fluid_type = GAS`, one record per UWI. Manitoba is not a source for this chart. |
| Website getter | `getWesternCanadaGasWellCompletionsData()` in `src/utils/dataLoader.js` |
| Vectors | `wc_gas_wells_completed`, `wc_gas_total_metres`, `wc_gas_avg_depth_m` |

### `oil_sands_mining` — Page 114

| Item | Location |
|------|----------|
| Handler | `update_oil_sands_mining()` / `transform_oil_sands_mining()` in `oil_sands_mining.py` |
| EEDAS table | `aer_oil_sands_mining_method` |
| Projects | Latest AER ST39 workbook, sheet `VAR0800-ST39Extracts_xls`. For each named project, use the Crude Bitumen production row and the reporting-year column. Syncrude Mildred Lake and Syncrude Aurora are added in cubic metres, then converted. Thousand barrels per day = annual cubic metres × 6.2898 ÷ days in the reporting year ÷ 1,000. The seven projects stay in the spec order. |
| Share | StatCan v107757056 ÷ (v107757054 + v107757056) × 100 for the reporting year when both vectors have 12 months. Displayed as a whole percent. Roughly 20% of oil sands resources, and the 75 m formation label, stay on the graphic. |
| Website getter | `getOilSandsMiningData()` in `src/utils/dataLoader.js` |
| Vectors | `osmm_reporting_year`, `osmm_project_count`, `osmm_total_mbd`, `osmm_current_production_pct`, `osmm_horizon`, `osmm_syncrude`, `osmm_kearl`, `osmm_suncor`, `osmm_fort_hills`, `osmm_muskeg`, `osmm_jackpine` |

### `oil_sands_in_situ` — Page 115

| Item | Location |
|------|----------|
| Handler | `update_oil_sands_in_situ()` / `transform_oil_sands_in_situ()` in `oil_sands_in_situ.py` |
| EEDAS table | `aer_oil_sands_in_situ_method` |
| Projects | Latest AER ST53 workbook, sheet `BITUMEN`. Monthly Average is cubic metres per day. Thousand barrels per day = Monthly Average × 6.289811 ÷ 1,000. Rows with the same scheme and operator are summed. Suncor's Firebag and MacKay River are then added together; other operators' schemes, including PetroChina's MacKay River and MEG's Christina Lake, stay separate. The top four are ranked by that production. |
| Share | StatCan v107757054 ÷ (v107757054 + v107757056) × 100 for the reporting year when both vectors have 12 months. Displayed as a whole percent. Roughly 80% of oil sands resources stays on the graphic. |
| Website getter | `getOilSandsInSituData()` in `src/utils/dataLoader.js` |
| Vectors | `osi_reporting_year`, `osi_project_count`, `osi_current_production_pct`, `osi_rank_1` … `osi_rank_4` |

### `oil_sands_greenhouse_gases` — Page 121

| Item | Location |
|------|----------|
| Handler | `update_oil_sands_greenhouse_gases()` / `transform_oil_sands_greenhouse_gases()` in `greenhouse_gases.py` |
| EEDAS table | `ca_oil_sands_greenhouse_gases` |
| Production | 2000–2015: StatCan v17946 (synthetic crude) + v17947 (crude bitumen), already thousand m³, 12 months required. 2016 onward: v107757052 (non-upgraded crude bitumen) + v107757060 (synthetic crude), cubic metres summed and divided by 1,000. Incomplete years are dropped. Thousand barrels = thousand m³ × 6.28981077. |
| Global GHG | Climate Watch historical emissions, source 274, gas 553, sector 3208, World, already Mt CO2e. |
| Canada and oil sands | ECCC `GHG_Econ_Can_Prov_Terr.csv`. Canada is `National Inventory Total`. Oil sands is `Oil and Gas` / `Oil Sands and Thermal Heavy Oil Production` (kt). Canada Mt = kt / 1,000. |
| Shares | Oil sands kt / 1,000 divided by the matching Mt total, times 100. Canada and global shares can use different latest years. |
| Intensity | Oil sands kt / thousand barrels × 1,000, for years with both production and oil sands emissions. The decrease is (1 − latest / 2000) × 100, stored as a positive percent. |
| Website getter | `getOilSandsGreenhouseGasesData()` in `src/utils/dataLoader.js` |
| Vectors | `osghg_prod_thousand_m3`, `osghg_prod_thousand_bbl`, `osghg_global_mt`, `osghg_canada_mt`, `osghg_oil_sands_kt`, `osghg_share_global_pct`, `osghg_share_canada_pct`, `osghg_intensity_kg_bbl`, `osghg_intensity_decrease_pct` |

### `canadian_production` — Page 111

| Item | Location |
|------|----------|
| Handlers | `update_canadian_production()` / `transform_canadian_production()` in `canadian_production.py` |
| EEDAS table | `stc_canadian_production` |
| StatCan sources | Table **25-10-0014-01** (Canada by type, 2000–2015) + **25-10-0063-01** (Canada by type and province, 2016+) |
| Website getter | `getCanadianCrudeProductionData()` in `src/utils/dataLoader.js` |
| Update (raw) | `raw_cp_s14_*_m3` category totals from 25100014; `raw_cp_s63_*_m3` from 25100063 (Canada + provinces) |
| Transform | Oil sands = synthetic + bitumen; conventional = heavy + light/medium + condensate + pentanes plus; MMb/d = m³ × 6.2898 ÷ 1000 ÷ 365 |
| Production vectors | `cp_oil_sands_*`, `cp_conventional_*`, `cp_total_*`, `cp_share_pct` |
| Province vectors | `cp_prov_{ab,sk,nl,mb,bc,ns,on,nt,other}_{thousand_m3,pct}`; Other = Canada − (AB + SK + NL + MB + BC + NS + ON + NT) |
| Static UI only | Infographic PNG, overlay positions (`CanadianCrudeProductionProvinceInfographic.constants.js`), chart colours |

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
| Handler | `update_ghg_emissions()` / `transform_ghg_emissions()` in Section 1 `ghg_emissions.py` |
| Chart | ECCC `GHG_Econ_Can_Prov_Terr.csv`. Oil sands = in situ + mining and extraction + upgrading. Natural gas = Natural Gas Production and Processing. Conventional oil = Conventional Oil Production. Other = Natural Gas Distribution + Oil, Natural Gas and CO2 Transmission. Values stored in Mt (source kt / 1000). |
| Narrative | Total percent change is the sum of those four categories. Oil sands uses the end-year / 2000 ratio. The conventional oil and natural gas percent is the change in emissions per unit of production, using StatCan v107757053 (non-upgraded bitumen, barrels) and v107757061 (synthetic crude, barrels). Those vectors start in 2016; 2000–2015 uses table 25-10-0014-01 converted from thousands of cubic metres to barrels. |
| Vectors | `ghg_oilgas_spotlight_*`, `ghg_stat_oil_gas_spotlight_total_pct`, `ghg_stat_oil_sands_emissions_ratio`, `ghg_stat_conv_gas_emissions_pct` |

---

## Shared files

| File | Purpose |
|------|---------|
| `constants.py` | StatCan vector IDs, external URLs, province maps |
| `rpp.py`, `crude_prices.py`, `oil_sands.py`, `oil_sands_mining.py`, `oil_sands_in_situ.py`, `canadian_production.py`, `petroleum_reserves.py`, `western_canada_oil_wells.py`, `western_canada_gas_wells.py`, `greenhouse_gases.py`, `natural_gas_energy_use.py`, `natural_gas_liquids_energy_use.py`, `kalibrate.py`, `refinery_capacity.py` | One module per source |

---

## If something changes

| Change type | What to edit |
|-------------|--------------|
| **Source file** (`Section 6.xlsx`) | `config.yaml` → `kal_gas_prices.section6_xlsx`; file in `EXTERNAL_XLSX_DATA_DIR` or repo root |
| **Workbook sheet / columns** | `kalibrate.py` — sheet `kalibrate_archive` |
| **Download URL** changed (StatCan, CAPP, EIA, Kalibrate, Oil Sands Magazine) | `constants.py` and/or handler for that source |
| **Parsing rule** (StatCan vector IDs, province maps, Kalibrate formulas, HTML scrape) | `constants.py` for IDs/maps; logic in matching module |
| Page 132 GHG split | Section 1 `ghg_emissions.py` |
