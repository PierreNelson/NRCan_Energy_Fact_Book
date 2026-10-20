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
| **59** | No | — | — | — | Section cover — `src/pages/CleanPowerLowCarbonOverview.jsx` |
| **60** | No | — | — | — | Static infographic — `src/pages/CleanTechnologyEconomy.jsx` |
| **61** | Yes | `getEnvironmentalCleanTechData()` | `environmental_clean_tech` | `process_environmental_clean_tech()` · `environmental_clean_tech.py` | StatCan URLs in handler + optional TSX XLSX |
| **62** | Yes | `getCleantechCompaniesByRegionData()` | `cleantech_companies_geo` | `process_cleantech_companies_geo()` · `cleantech_companies_geo.py` | NRCan web page + `constants.py` regions |
| **63** | Yes | `getCleantechCompaniesByIndustryData()` | `cleantech_companies_industry` | `process_cleantech_companies_industry()` · `cleantech_companies_industry.py` | Same NRCan URL + `constants.py` industries |
| **64** | Yes | `getElectricityWorldProductionExportsData()` | `electricity_world_production` | `update_electricity_world_production()` / `transform_electricity_world_production()` · `electricity_world_production.py` | `oecd_iea_data.xlsx` sheets `electricity_world_production` and `electricity_world_exports` |
| **65** | Yes | `getElectricityTradeData()` | `electricity_trade_us` | `update_electricity_trade_us()` / `transform_electricity_trade_us()` · `electricity_trade_us.py` | CER Electricity Trade Summary XLSM |
| **66** | Yes | `getCanadianElectricityGenerationData()` | `electricity_generation_by_source` | `update_electricity_generation_by_source()` / `transform_electricity_generation_by_source()` · `electricity_generation.py` | gencap `src_elegen_can` / `src_elegen_prov` |
| **67** | Yes | `getProvincialElectricityGenerationData()` | `electricity_generation_by_source` | same as Page 66 | same as Page 66 |
| **68** | Yes | `getElectricalEnergyUseData()` | `electrical_energy_use` | `update_electrical_energy_use()` / `transform_electrical_energy_use()` · `electrical_energy_use.py` | OEE NEUD electrical energy use (sector + province) |
| **71** | Yes | `getElectricityGhgSpotlightData()` | `ghg_electricity_spotlight` | `update_ghg_electricity_spotlight()` / `transform_ghg_electricity_spotlight()` · `ghg_electricity_spotlight.py` | ECCC environmental indicators CSV + gencap `coal_elegen` |
| **72** | Yes | `getWorldRenewableEnergyData()` | `world_renewable_energy` | `update_world_renewable_energy()` / `transform_world_renewable_energy()` · `world_renewable_energy.py` | `oecd_iea_data.xlsx` sheets `renewables_world_production` and `total_energy_supply` |
| **73** | Yes | `getCanadianRenewableEnergyProductionData()` | `canadian_renewable_energy_production` | `update_canadian_renewable_energy_production()` / `transform_canadian_renewable_energy_production()` · `canadian_renewable_energy_production.py` | SharePoint `oecd_iea_data.xlsx` sheet `renewables_canada_production` |
| **74** | Yes | `getRenewableElectricityCapacityData()` | `renewable_electricity_capacity` | `update_renewable_electricity_capacity()` / `transform_renewable_electricity_capacity()` · `renewable_electricity_capacity.py` | SharePoint gencap `ren_elecap` sheet |
| **75** | Yes | `getHydroelectricityData()` | `hydroelectricity` | `update_hydroelectricity()` / `transform_hydroelectricity()` · `hydroelectricity.py` | `oecd_iea_data.xlsx` `hydro_world_gen` + gencap `src_elegen_can` |
| **100** | Yes | `getHydrogenNarrativeData()` | `hydrogen_narrative` | `update_hydrogen_narrative()` / `transform_hydrogen_narrative()` · `hydrogen_narrative.py` | `iea_h2_narrative_summary_global_prod_and_demand.xlsx` sheet `h2_narrative` |
| **102** | Yes | `getHydrogenCanadaSummaryData()` | `hydrogen_narrative` | same as Page 100 | same workbook, sheet `h2_canada_summary` |
| **96** | Yes | `getEvSalesRegistrationsData()` | `ev_sales` | `build_ev_sales_rows()` · `ev_sales.py` | `constants.py` → `EV_SALES_*` |
| **77** | Yes | `getBiomassData()` | `biomass` | `update_biomass()` / `transform_biomass()` · `biomass.py` | SharePoint `oecd_iea_data.xlsx` (`renewables_oecd_production`, `renewables_canada_production`) + `biomass_narrative.xlsx` |
| **78** | Yes | `getSolidBiofuelsProductionData()` | `solid_biofuels` | `update_solid_biofuels()` / `transform_solid_biofuels()` · `solid_biofuels.py` | SharePoint `RenAQ.xlsx` + StatCan 25-10-0031-01 |
| **80** | Yes | `getCanadianWindPowerData()` | `wind_power_canada` | `update_wind_power_canada()` / `transform_wind_power_canada()` · `wind_power_canada.py` | `Wind capacity and generation_Canada.xlsx` → `cap`, `gen` |
| **81** | Yes | `getWindProjectsMapData()` | `wind_capacity_by_province`, `largest_wind_projects` | `update_*` / `transform_*` · `wind_capacity.py` | SharePoint gencap + largest-projects workbooks |
| **84** | Yes | `getLargestSolarProjectsData()` | `largest_solar_projects` | `update_largest_solar_projects()` / `transform_largest_solar_projects()` · `largest_solar_projects.py` | SharePoint `Largest hydrofac, wind and solar projects.xlsx` → `solprojects` |
| **91** | Yes | `getWorldBiofuelsProductionData()` | `world_biofuels_production` | `update_world_biofuels_production()` / `transform_world_biofuels_production()` · `world_biofuels_production.py` | `oecd_iea_data.xlsx` sheet `biofuels_world_production`, latest-year ranking |
| **92** | Yes | `getWorldBiofuelsProductionData()` | `world_biofuels_production` | same as Page 91 | same sheet, 2011 to latest regional trend |

---

## Pipeline sources (detail)

### `world_renewable_energy` — Page 72

| Item | Location |
|------|----------|
| Handlers | `update_world_renewable_energy()` / `transform_world_renewable_energy()` in `world_renewable_energy.py` |
| EEDAS table | `iea_renewables_world_production` |
| Workbook | `oecd_iea_data.xlsx` |
| Ranking | Sheet `renewables_world_production`, product Total of renewable energy sources, latest year, top five countries plus Canada |
| Supply share | Sheet `total_energy_supply`, renewable total divided by total energy supply, for World, OECD Total, and Canada |
| Names | Ranking names from `ref_iea_gac_geo_concordance` |
| Vectors | `wren_rank_*`, `wren_s_*` |
| Website getter | `getWorldRenewableEnergyData()` |

### `world_biofuels_production` — Pages 91 and 92

| Item | Location |
|------|----------|
| Handlers | `update_world_biofuels_production()` / `transform_world_biofuels_production()` in `world_biofuels_production.py` |
| EEDAS table | `iea_biofuels_world_production` |
| Workbook | `oecd_iea_data.xlsx` sheet `biofuels_world_production` |
| Products | Biogasoline, biodiesels, other liquid biofuels, and bio jet kerosene, summed |
| Page 91 | Latest year: world total in PJ, top five countries, and Canada if outside the top five |
| Page 92 | 2011 to the latest year: China region, European Union (27), United States, Brazil, Canada, and the rest of the world |
| Names | Ranking names from `ref_iea_gac_geo_concordance` |
| Vectors | `wbfl_rank_*`, `wbfl_t_*` |
| Website getter | `getWorldBiofuelsProductionData()` |

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

### `electricity_world_production` — Page 64

| Item | Location |
|------|----------|
| Handlers | `update_electricity_world_production()` / `transform_electricity_world_production()` in `electricity_world_production.py` |
| EEDAS table | `iea_electricity_world_production` |
| Workbook | `oecd_iea_data.xlsx` |
| Production | Sheet `electricity_world_production`, unit GWh, latest year is the default |
| Exports | Sheet `electricity_world_exports` |
| Names | `ref_iea_gac_geo_concordance` (`gc_nm_ab_en`, `gc_nm_ab_fr`) |
| Vectors | `ewld_p_*` production, `ewld_x_*` exports |
| Website getter | `getElectricityWorldProductionExportsData()` |

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

### `electricity_generation_by_source` — Pages 66–67

| Item | Location |
|------|----------|
| Handlers | `update_electricity_generation_by_source()` / `transform_electricity_generation_by_source()` in `electricity_generation.py` |
| EEDAS table | `nrcan_elegen_can` |
| Workbook | `secondary Master gencap file.xlsx` → sheets `src_elegen_can`, `src_elegen_prov` |
| Website getters | `getCanadianElectricityGenerationData()`, `getProvincialElectricityGenerationData()` in `src/utils/dataLoader.js` |
| Page 66 — donut chart | `elegen_can_total_twh`, `elegen_can_{coal,natural_gas,petroleum,nuclear,hydro,other_renewables}_pct` |
| Page 66 — infographic | `elegen_prov_{hydro,nuclear,wind}_{canada\|province}_pct` (province order in `CanadianElectricityGenerationGenerationInfographic.constants.js`) |
| Page 67 — infographic | `elegen_prov_{biomass,natural_gas,petroleum,solar,coal,other}_{canada\|province}_pct` |
| Vector prefix | `elegen_` |
| Static UI only | Background PNGs, overlay positions/fonts, chart colours (`src/pages/CanadianElectricityGeneration.jsx`, `ProvincialElectricityGeneration.jsx`, infographic components) |

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

### `electric_vehicle_charging` — Page 98

| Item | Location |
|------|----------|
| Handlers | `update_electric_vehicle_charging()` / `transform_electric_vehicle_charging()` in `electric_vehicle_charging.py` |
| EEDAS table | `nrcan_ev_charging_narrative` |
| Workbook | `ev_charging_narrative.xlsx` → sheet `ev_charging_narrative` |
| Website getter | `getElectricVehicleChargingData()` in `src/utils/dataLoader.js` |
| Table cells | `evch_r{n}_{charger,input,outlet,charging_time,range,uses}` copied as written |
| Footnote | `evch_footnote` |
| French table | `charger_fr`, `input_fr`, `outlet_type_fr`, `estimated_charging_time_fr`, `estimated_range_per_hour_of_charging_fr`, `typical_uses_fr`, `footnote_fr` |

### `global_hydrogen_production_demand` — Page 101

| Item | Location |
|------|----------|
| Handlers | `update_global_hydrogen_production_demand()` / `transform_global_hydrogen_production_demand()` in `global_hydrogen_production_demand.py` |
| EEDAS table | `iea_hydrogen_global_prod_demand` |
| Workbook | `iea_h2_narrative_summary_global_prod_and_demand.xlsx` |
| Sheets | `h2_global_production`, `h2_prod_source`, `h2_global_demand`, `h2_demand_end_use` |
| Year | Latest reporting year present on all four sheets |
| Bullets | Whole-number Mt and whole percentages |
| Production chart | Source shares keep the workbook’s decimal precision |
| Demand chart | End-use shares are whole percentages |
| Website getter | `getGlobalHydrogenProductionDemandData()` |

### `hydrogen_narrative` — Pages 100 and 102

| Item | Location |
|------|----------|
| Handlers | `update_hydrogen_narrative()` / `transform_hydrogen_narrative()` in `hydrogen_narrative.py` |
| EEDAS table | `iea_hydrogen_narrative` |
| Workbook | `iea_h2_narrative_summary_global_prod_and_demand.xlsx` |
| Page 100 | Sheet `h2_narrative`: introductions, benefits, and the fact, in `display_order` |
| Page 102 | Sheet `h2_canada_summary`: `summary_text` bullets for EN and FR |
| Vectors | `hnar_intro_{n}`, `hnar_benefit_{n}`, `hnar_fact`, `hnar_summary_{n}_{en,fr}` |
| Website getters | `getHydrogenNarrativeData()`, `getHydrogenCanadaSummaryData()` |

### `hydroelectricity` — Page 75

| Item | Location |
|------|----------|
| Handlers | `update_hydroelectricity()` / `transform_hydroelectricity()` in `hydroelectricity.py` |
| EEDAS table | `iea_hydroelectricity_world_production` |
| World ranking | `oecd_iea_data.xlsx` sheet `hydro_world_gen`, geography names from `ref_iea_gac_geo_concordance` |
| Canada share | `secondary Master gencap file.xlsx` sheet `src_elegen_can`, source `hydro` |
| Year | Latest year present in both sources |
| Vectors | `hyel_world_twh`, `hyel_canada_elec_share`, `hyel_canada_rank`, `hyel_r{n}_*` |
| Website getter | `getHydroelectricityData()` |

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

### `wind_power_canada` — Page 80

| Item | Location |
|------|----------|
| Handlers | `update_wind_power_canada()` / `transform_wind_power_canada()` in `wind_power_canada.py` |
| Workbook | `Wind capacity and generation_Canada.xlsx` → sheets `cap`, `gen` |
| Infographic | `win_pwr_stat_cap_gw`, `win_pwr_stat_gen_twh`, growth ratios vs 2011 |
| Chart vectors | `win_pwr_cap_cum_mw`, `win_pwr_cap_add_mw` (2011–latest) |
| Website getter | `getCanadianWindPowerData()` in `src/utils/dataLoader.js` |

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
| `constants.py` | EV sales URLs/vectors, cleantech geo/industry lists, TSX defaults, electricity generation source/location maps (`ELECTRICITY_GENERATION_*`) |

---

## If something changes

| Change type | What to edit |
|-------------|--------------|
| **Source file** (TSX list) | `config.yaml` → `tmx_xlsx_path`; defaults in `constants.py` → `DEFAULT_TMX_XLSX*` |
| **Workbook sheet / columns** | `environmental_clean_tech.py` (TSX XLSX read logic) |
| **Download URL** changed (StatCan, NRCan web, TSX) | Handler for that source or `constants.py` |
| **Parsing rule** (region/industry lists, StatCan filters, EV vector IDs) | `constants.py`; scraper/filter logic in matching handler |

