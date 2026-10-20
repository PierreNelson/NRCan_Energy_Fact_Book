import React from 'react';
import { lazyWithPreload } from '../utils/lazyWithPreload';
import { useOutletContext } from 'react-router-dom';
import ActivePageSection from './ActivePageSection';

const OilGasCoalOverview = lazyWithPreload(() => import('../pages/OilGasCoalOverview'));
const PetroleumEmploymentByRegion = lazyWithPreload(() => import('../pages/PetroleumEmploymentByRegion'));
const PetroleumEmployment = lazyWithPreload(() => import('../pages/PetroleumEmployment'));
const PetroleumGdp = lazyWithPreload(() => import('../pages/PetroleumGdp'));
const CrudeOilInternational = lazyWithPreload(() => import('../pages/CrudeOilInternational'));
const WorldProvedCrudeReserves = lazyWithPreload(() => import('../pages/WorldProvedCrudeReserves'));
const CanadianCrudeReserves = lazyWithPreload(() => import('../pages/CanadianCrudeReserves'));
const CanadianCrudeProduction = lazyWithPreload(() => import('../pages/CanadianCrudeProduction'));
const CanadianSupplyDemand = lazyWithPreload(() => import('../pages/CanadianSupplyDemand'));
const OilSandsProduction = lazyWithPreload(() => import('../pages/OilSandsProduction'));
const OilSandsMiningMethod = lazyWithPreload(() => import('../pages/OilSandsMiningMethod'));
const OilSandsInSituMethod = lazyWithPreload(() => import('../pages/OilSandsInSituMethod'));
const CrudeOilPrices = lazyWithPreload(() => import('../pages/CrudeOilPrices'));
const MajorCerRegulatedOilPipelines = lazyWithPreload(() => import('../pages/MajorCerRegulatedOilPipelines'));
const OilByRail = lazyWithPreload(() => import('../pages/OilByRail'));
const OilSandsGreenhouseGases = lazyWithPreload(() => import('../pages/OilSandsGreenhouseGases'));
const NaturalGasInternational = lazyWithPreload(() => import('../pages/NaturalGasInternational'));
const WorldProvedGasReserves = lazyWithPreload(() => import('../pages/WorldProvedGasReserves'));
const WesternCanadaGasWellCompletions = lazyWithPreload(() => import('../pages/WesternCanadaGasWellCompletions'));
const CerRegulatedGasPipelines = lazyWithPreload(() => import('../pages/CerRegulatedGasPipelines'));
const NaturalGasEnergyUse = lazyWithPreload(() => import('../pages/NaturalGasEnergyUse'));
const HglSupplyDemand = lazyWithPreload(() => import('../pages/HglSupplyDemand'));
const OilGasGhgSpotlight = lazyWithPreload(() => import('../pages/OilGasGhgSpotlight'));
const RefinedPetroleumProducts = lazyWithPreload(() => import('../pages/RefinedPetroleumProducts'));
const NaturalGasLiquidsEnergyUse = lazyWithPreload(() => import('../pages/NaturalGasLiquidsEnergyUse'));
const RppSupplyDemand = lazyWithPreload(() => import('../pages/RppSupplyDemand'));
const RetailGasolinePrices = lazyWithPreload(() => import('../pages/RetailGasolinePrices'));
const RefineryCapacity = lazyWithPreload(() => import('../pages/RefineryCapacity'));
const CoalInternational = lazyWithPreload(() => import('../pages/CoalInternational'));
const CanadianCoalSupplyDemand = lazyWithPreload(() => import('../pages/CanadianCoalSupplyDemand'));

const PAGES = [
  { id: 'oil-gas-coal-overview', Component: OilGasCoalOverview,
    pageClassName: 'page-with-title-divider' },
  { id: 'petroleum-employment-by-region', Component: PetroleumEmploymentByRegion,
    pageClassName: 'page-with-title-divider' },
  { id: 'petroleum-employment', Component: PetroleumEmployment },
  { id: 'petroleum-gdp', Component: PetroleumGdp },
  { id: 'crude-oil-international', Component: CrudeOilInternational,
    pageClassName: 'page-with-title-divider' },
  { id: 'world-crude-oil-proved-reserves', Component: WorldProvedCrudeReserves },
  { id: 'canadian-crude-reserves', Component: CanadianCrudeReserves },
  { id: 'canadian-crude-production', Component: CanadianCrudeProduction },
  { id: 'canadian-supply-demand', Component: CanadianSupplyDemand },
  { id: 'oil-sands', Component: OilSandsProduction },
  { id: 'oil-sands-mining', Component: OilSandsMiningMethod },
  { id: 'oil-sands-in-situ', Component: OilSandsInSituMethod },
  { id: 'crude-oil-prices', Component: CrudeOilPrices },
  { id: 'major-cer-regulated-oil-pipelines', Component: MajorCerRegulatedOilPipelines },
  { id: 'oil-by-rail', Component: OilByRail },
  { id: 'oil-sands-greenhouse-gases', Component: OilSandsGreenhouseGases },
  { id: 'natural-gas-international', Component: NaturalGasInternational,
    pageClassName: 'page-with-title-divider' },
  { id: 'world-natural-gas-proved-reserves', Component: WorldProvedGasReserves },
  { id: 'western-canada-gas-well-completions', Component: WesternCanadaGasWellCompletions },
  { id: 'cer-regulated-gas-pipelines', Component: CerRegulatedGasPipelines },
  { id: 'natural-gas-energy-use', Component: NaturalGasEnergyUse },
  { id: 'hgl-supply-demand', Component: HglSupplyDemand,
    pageClassName: 'page-with-title-divider' },
  { id: 'ghg-spotlight-oil-gas', Component: OilGasGhgSpotlight },
  { id: 'refined-petroleum-products', Component: RefinedPetroleumProducts,
    pageClassName: 'page-with-title-divider' },
  { id: 'natural-gas-liquids-energy-use', Component: NaturalGasLiquidsEnergyUse },
  { id: 'rpp-supply-demand', Component: RppSupplyDemand },
  { id: 'retail-gasoline-prices', Component: RetailGasolinePrices },
  { id: 'refinery-capacity', Component: RefineryCapacity },
  { id: 'coal-international', Component: CoalInternational,
    pageClassName: 'page-with-title-divider' },
  { id: 'canadian-coal-supply-demand', Component: CanadianCoalSupplyDemand }
];

const TOPIC_ANCHORS = [
  'petroleum-employment-by-region',
  'crude-oil-international',
  'natural-gas-international',
  'hgl-supply-demand',
  'refined-petroleum-products',
  'coal-international',
];

const SectionSix = () => {
  const { lang = 'en' } = useOutletContext() || {};
  return (
    <ActivePageSection
      sectionPath="/section-6"
      pages={PAGES}
      topicAnchors={TOPIC_ANCHORS}
      lang={lang}
    />
  );
};

export default SectionSix;
