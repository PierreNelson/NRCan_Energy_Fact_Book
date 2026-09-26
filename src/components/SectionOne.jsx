import React from 'react';
import { lazyWithPreload } from '../utils/lazyWithPreload';
import { useOutletContext } from 'react-router-dom';
import ActivePageSection from './ActivePageSection';

const EnergyOverview = lazyWithPreload(() => import('../pages/EnergyOverview'));
const WorldEnergyProduction = lazyWithPreload(() => import('../pages/WorldEnergyProduction'));
const CanadianEnergyProduction = lazyWithPreload(() => import('../pages/CanadianEnergyProduction'));
const PrimaryEnergyProduction = lazyWithPreload(() => import('../pages/PrimaryEnergyProduction'));
const PrimaryEnergyByRegion = lazyWithPreload(() => import('../pages/PrimaryEnergyByRegion'));
const CanadaEnergySupply = lazyWithPreload(() => import('../pages/CanadaEnergySupply'));
const NominalGdp = lazyWithPreload(() => import('../pages/NominalGdp'));
const ProvincialGdp = lazyWithPreload(() => import('../pages/ProvincialGdp'));
const Employment = lazyWithPreload(() => import('../pages/Employment'));
const EmploymentChart = lazyWithPreload(() => import('../pages/EmploymentChart'));
const GdpChart = lazyWithPreload(() => import('../pages/GdpChart'));
const EnergyTrade = lazyWithPreload(() => import('../pages/EnergyTrade'));
const EnergyImports = lazyWithPreload(() => import('../pages/EnergyImports'));
const CanadianEnergyExportsUsStates = lazyWithPreload(() => import('../pages/CanadianEnergyExportsUsStates'));
const CanadaGlobalEnergyTrade = lazyWithPreload(() => import('../pages/CanadaGlobalEnergyTrade'));
const GovernmentRevenues = lazyWithPreload(() => import('../pages/GovernmentRevenues'));
const CorporateIncomeTaxes = lazyWithPreload(() => import('../pages/CorporateIncomeTaxes'));
const EnergyAndGhgEmissions = lazyWithPreload(() => import('../pages/EnergyAndGhgEmissions'));
const GhgEmissionsIntensityIndex = lazyWithPreload(() => import('../pages/GhgEmissionsIntensityIndex'));
const GhgEmissionsBySector = lazyWithPreload(() => import('../pages/GhgEmissionsBySector'));
const EnergyInformationLandscape = lazyWithPreload(() => import('../pages/EnergyInformationLandscape'));

const PAGES = [
  { id: 'energy-overview', Component: EnergyOverview,
    pageClassName: 'page-with-title-divider' },
  { id: 'energy-production', Component: WorldEnergyProduction,
    pageClassName: 'page-with-title-divider' },
  { id: 'canadian-energy-production', Component: CanadianEnergyProduction },
  { id: 'primary-energy-production', Component: PrimaryEnergyProduction },
  { id: 'primary-energy-by-region', Component: PrimaryEnergyByRegion },
  { id: 'canada-energy-supply', Component: CanadaEnergySupply },
  { id: 'economic-contributions', Component: NominalGdp,
    pageClassName: 'page-with-title-divider' },
  { id: 'provincial-gdp', Component: ProvincialGdp },
  { id: 'employment', Component: Employment,
    pageClassName: 'page-with-title-divider' },
  { id: 'employment-chart', Component: EmploymentChart },
  { id: 'gdp-chart', Component: GdpChart },
  { id: 'energy-trade', Component: EnergyTrade },
  { id: 'energy-imports', Component: EnergyImports },
  { id: 'canadian-energy-exports-us-states', Component: CanadianEnergyExportsUsStates },
  { id: 'canada-global-energy-trade', Component: CanadaGlobalEnergyTrade },
  { id: 'government-revenues', Component: GovernmentRevenues },
  { id: 'corporate-income-taxes', Component: CorporateIncomeTaxes },
  { id: 'energy-and-ghg-emissions', Component: EnergyAndGhgEmissions },
  { id: 'ghg-emissions-intensity-index', Component: GhgEmissionsIntensityIndex },
  { id: 'ghg-emissions', Component: GhgEmissionsBySector },
  { id: 'energy-information-landscape', Component: EnergyInformationLandscape }
];

/** Section overview topic entry hashes (pages linked from EnergyOverview). */
const TOPIC_ANCHORS = [
  'energy-production',
  'economic-contributions',
  'energy-and-ghg-emissions',
];

const SectionOne = () => {
  const { lang = 'en' } = useOutletContext() || {};
  return (
    <ActivePageSection
      sectionPath="/section-1"
      pages={PAGES}
      topicAnchors={TOPIC_ANCHORS}
      lang={lang}
    />
  );
};

export default SectionOne;
