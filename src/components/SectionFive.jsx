import React from 'react';
import { lazyWithPreload } from '../utils/lazyWithPreload';
import { useOutletContext } from 'react-router-dom';
import ActivePageSection from './ActivePageSection';

const CleanPowerLowCarbonOverview = lazyWithPreload(() => import('../pages/CleanPowerLowCarbonOverview'));
const CleanTechnologyEconomy = lazyWithPreload(() => import('../pages/CleanTechnologyEconomy'));
const EnvironmentalCleanTech = lazyWithPreload(() => import('../pages/EnvironmentalCleanTech'));
const CleantechCompaniesByRegion = lazyWithPreload(() => import('../pages/CleantechCompaniesByRegion'));
const CleantechCompaniesByIndustry = lazyWithPreload(() => import('../pages/CleantechCompaniesByIndustry'));
const ElectricityInternationalContext = lazyWithPreload(() => import('../pages/ElectricityInternationalContext'));
const ElectricityTrade = lazyWithPreload(() => import('../pages/ElectricityTrade'));
const CanadianElectricityGeneration = lazyWithPreload(() => import('../pages/CanadianElectricityGeneration'));
const ProvincialElectricityGeneration = lazyWithPreload(() => import('../pages/ProvincialElectricityGeneration'));
const ElectricalEnergyUse = lazyWithPreload(() => import('../pages/ElectricalEnergyUse'));
const ElectricityPricesMap = lazyWithPreload(() => import('../pages/ElectricityPricesMap'));
const WindSolarElectricityGrowth = lazyWithPreload(() => import('../pages/WindSolarElectricityGrowth'));
const ElectricityGhgSpotlight = lazyWithPreload(() => import('../pages/ElectricityGhgSpotlight'));
const RenewableEnergyInternational = lazyWithPreload(() => import('../pages/RenewableEnergyInternational'));
const CanadianRenewableEnergyProduction = lazyWithPreload(() => import('../pages/CanadianRenewableEnergyProduction'));
const RenewableElectricityCapacity = lazyWithPreload(() => import('../pages/RenewableElectricityCapacity'));
const Hydroelectricity = lazyWithPreload(() => import('../pages/Hydroelectricity'));
const HydroelectricCapacity = lazyWithPreload(() => import('../pages/HydroelectricCapacity'));
const Biomass = lazyWithPreload(() => import('../pages/Biomass'));
const SolidBiofuelsProduction = lazyWithPreload(() => import('../pages/SolidBiofuelsProduction'));
const WorldWindPower = lazyWithPreload(() => import('../pages/WorldWindPower'));
const CanadianWindPower = lazyWithPreload(() => import('../pages/CanadianWindPower'));
const WindProjectsMap = lazyWithPreload(() => import('../pages/WindProjectsMap'));
const WorldSolarPower = lazyWithPreload(() => import('../pages/WorldSolarPower'));
const SolarPvInCanada = lazyWithPreload(() => import('../pages/SolarPvInCanada'));
const LargestSolarProjects = lazyWithPreload(() => import('../pages/LargestSolarProjects'));
const UraniumInternational = lazyWithPreload(() => import('../pages/UraniumInternational'));
const NuclearPower = lazyWithPreload(() => import('../pages/NuclearPower'));
const CanadianUraniumSupplyDemand = lazyWithPreload(() => import('../pages/CanadianUraniumSupplyDemand'));
const NuclearFuelCycle = lazyWithPreload(() => import('../pages/NuclearFuelCycle'));
const CanduNuclearReactors = lazyWithPreload(() => import('../pages/CanduNuclearReactors'));
const NuclearPowerPlantsUraniumPrices = lazyWithPreload(() => import('../pages/NuclearPowerPlantsUraniumPrices'));
const BiofuelsTransportation = lazyWithPreload(() => import('../pages/BiofuelsTransportation'));
const WorldBiofuelsProduction = lazyWithPreload(() => import('../pages/WorldBiofuelsProduction'));
const CanadianBiofuelProduction = lazyWithPreload(() => import('../pages/CanadianBiofuelProduction'));
const BiofuelProductionCapacity = lazyWithPreload(() => import('../pages/BiofuelProductionCapacity'));
const TransportationFuelMix = lazyWithPreload(() => import('../pages/TransportationFuelMix'));
const EvSalesRegistrations = lazyWithPreload(() => import('../pages/EvSalesRegistrations'));
const TransportationGhgSpotlight = lazyWithPreload(() => import('../pages/TransportationGhgSpotlight'));
const ElectricVehicleCharging = lazyWithPreload(() => import('../pages/ElectricVehicleCharging'));
const PublicEvChargingStations = lazyWithPreload(() => import('../pages/PublicEvChargingStations'));
const Hydrogen = lazyWithPreload(() => import('../pages/Hydrogen'));
const GlobalHydrogenProductionDemand = lazyWithPreload(() => import('../pages/GlobalHydrogenProductionDemand'));
const HydrogenIndustry = lazyWithPreload(() => import('../pages/HydrogenIndustry'));

const PAGES = [
  { id: 'clean-power-low-carbon-overview', Component: CleanPowerLowCarbonOverview },
  { id: 'clean-technology-economy', Component: CleanTechnologyEconomy },
  { id: 'environmental-clean-technology', Component: EnvironmentalCleanTech },
  { id: 'cleantech-companies', Component: CleantechCompaniesByRegion },
  { id: 'cleantech-companies-industry', Component: CleantechCompaniesByIndustry },
  { id: 'electricity-international-context', Component: ElectricityInternationalContext },
  { id: 'electricity-trade-us', Component: ElectricityTrade },
  { id: 'canadian-electricity-generation', Component: CanadianElectricityGeneration },
  { id: 'provincial-electricity-generation', Component: ProvincialElectricityGeneration },
  { id: 'electricity-energy-use', Component: ElectricalEnergyUse },
  { id: 'electricity-prices', Component: ElectricityPricesMap,
    pageClassName: 'page-with-title-divider' },
  { id: 'wind-solar-electricity-growth', Component: WindSolarElectricityGrowth },
  { id: 'electricity-ghg-spotlight', Component: ElectricityGhgSpotlight },
  { id: 'renewable-energy-international', Component: RenewableEnergyInternational,
    pageClassName: 'page-with-title-divider' },
  { id: 'canadian-renewable-energy-production', Component: CanadianRenewableEnergyProduction,
    pageClassName: 'page-with-title-divider' },
  { id: 'renewable-electricity-capacity', Component: RenewableElectricityCapacity,
    pageClassName: 'page-with-title-divider' },
  { id: 'hydroelectricity', Component: Hydroelectricity,
    pageClassName: 'page-with-title-divider' },
  { id: 'major-hydro-facilities', Component: HydroelectricCapacity,
    pageClassName: 'page-with-title-divider' },
  { id: 'biomass', Component: Biomass },
  { id: 'solid-biofuels', Component: SolidBiofuelsProduction },
  { id: 'world-wind-power', Component: WorldWindPower },
  { id: 'wind-power-canada', Component: CanadianWindPower },
  { id: 'wind-capacity', Component: WindProjectsMap },
  { id: 'world-solar-pv', Component: WorldSolarPower },
  { id: 'solar-pv-canada', Component: SolarPvInCanada },
  { id: 'largest-solar-projects', Component: LargestSolarProjects },
  { id: 'uranium-international', Component: UraniumInternational },
  { id: 'nuclear-power', Component: NuclearPower },
  { id: 'canadian-uranium-supply-demand', Component: CanadianUraniumSupplyDemand },
  { id: 'nuclear-fuel-cycle', Component: NuclearFuelCycle },
  { id: 'candu-nuclear-reactors', Component: CanduNuclearReactors },
  { id: 'nuclear-power-plants-uranium-prices', Component: NuclearPowerPlantsUraniumPrices },
  { id: 'biofuels-transportation', Component: BiofuelsTransportation,
    pageClassName: 'page-with-title-divider' },
  { id: 'world-biofuels-production', Component: WorldBiofuelsProduction },
  { id: 'canadian-biofuel-production', Component: CanadianBiofuelProduction },
  { id: 'biofuel-production-capacity', Component: BiofuelProductionCapacity },
  { id: 'transportation-fuel-mix', Component: TransportationFuelMix },
  { id: 'ev-sales', Component: EvSalesRegistrations },
  { id: 'transportation-ghg-spotlight', Component: TransportationGhgSpotlight },
  { id: 'electric-vehicle-charging', Component: ElectricVehicleCharging },
  { id: 'public-ev-charging-stations', Component: PublicEvChargingStations },
  { id: 'hydrogen', Component: Hydrogen },
  { id: 'global-hydrogen-production-demand', Component: GlobalHydrogenProductionDemand },
  { id: 'hydrogen-industry', Component: HydrogenIndustry }
];

const TOPIC_ANCHORS = [
  'clean-technology-economy',
  'renewable-energy-international',
  'biofuels-transportation',
];

const SectionFive = () => {
  const { lang = 'en' } = useOutletContext() || {};
  return (
    <ActivePageSection
      sectionPath="/section-5"
      pages={PAGES}
      topicAnchors={TOPIC_ANCHORS}
      lang={lang}
    />
  );
};

export default SectionFive;
