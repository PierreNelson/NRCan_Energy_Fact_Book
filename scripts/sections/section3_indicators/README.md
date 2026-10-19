# Section 3 — Skills, diversity and community

| Page | In pipeline? | Website getter | `source_key` | Handler | Sources |
|------|--------------|----------------|--------------|---------|---------|
| **40–41** | Yes | `getEnergySectorDemographicsData()` | `energy_sector_demographics` | `process_energy_sector_demographics()` | `t4_NRSA_final.xlsx` sheet `Table 4 (Data)`, `t1_NRSA_Final.xlsx` sheets `1c_NR_sub-sector` and `1d_NR_sub-sector`, StatCan table 98-10-0585-01, and StatCan table 36-10-0689-01 vectors v1567756783 and v1567757497 |
| **42** | Yes | `getDemographicRepresentationData()` | `demographic_representation` | `process_demographic_representation()` | `t4_NRSA_final.xlsx` sheet `Table 4 (Data)`; StatCan table 98-10-0585-01 for gender, occupation, immigrant status, and age; StatCan table 98-10-0586-01 for visible minority and education; StatCan table 98-10-0587-01 for Indigenous identity |
| **44** | Yes | `getHouseholdEnergyExpendituresData()` | `household_energy_expenditures` | `process_household_energy_expenditures()` | StatCan table 18-10-0004-01 vectors v41691239, v41690973, and v41691238; StatCan table 11-10-0222-01 vectors v64469129, v64469130, v64469131, v64469236, and v54325509 |
| **45** | Yes | `getHouseholdEnergyPricesData()` | `household_energy_prices` | `process_household_energy_prices()` | `oecd_iea_data.xlsx` sheet `HH_energy_prices_per_unit` |
| **43** | Yes | `getEnergyPovertyRatesData()` | `energy_poverty_geography` | `process_energy_poverty_geography()` | Census Chart 1 in the 2021 energy-poverty article, and StatCan table 11-10-0222-01 |
| **46** | Yes | `getEnergyReliantCommunitiesData()` | `energy_reliant_communities` | `process_energy_reliant_communities()` | `EnergyRelianceResults_Updated.xlsx` sheets `energy_reliance_by_province` and `energy_reliance_rural_urban` |

```bash
cd scripts
python main.py eedas update --source energy_poverty_geography
python main.py efb transform --indicator energy_poverty_geography
python main.py export --source energy_poverty_geography
```
