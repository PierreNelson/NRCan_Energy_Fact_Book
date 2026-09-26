import React from 'react';
import { lazyWithPreload } from '../utils/lazyWithPreload';
import { useOutletContext } from 'react-router-dom';
import ActivePageSection from './ActivePageSection';

const Investment = lazyWithPreload(() => import('../pages/Investment'));
const CapitalExpenditures = lazyWithPreload(() => import('../pages/CapitalExpenditures'));
const Infrastructure = lazyWithPreload(() => import('../pages/Infrastructure'));
const EconomicContributions = lazyWithPreload(() => import('../pages/EconomicContributions'));
const InvestmentByAsset = lazyWithPreload(() => import('../pages/InvestmentByAsset'));
const MajorEnergyProjects = lazyWithPreload(() => import('../pages/MajorEnergyProjects'));
const CleanTechTrends = lazyWithPreload(() => import('../pages/CleanTechTrends'));
const MajorProjectsMap = lazyWithPreload(() => import('../pages/MajorProjectsMap'));
const InternationalInvestment = lazyWithPreload(() => import('../pages/InternationalInvestment'));
const ForeignControl = lazyWithPreload(() => import('../pages/ForeignControl'));
const CEA = lazyWithPreload(() => import('../pages/CEA'));
const ResearchDevelopmentDemonstration = lazyWithPreload(() => import('../pages/ResearchDevelopmentDemonstration'));
const PublicEnergyRddExpenditures = lazyWithPreload(() => import('../pages/PublicEnergyRddExpenditures'));
const EnergyRddByTechnology = lazyWithPreload(() => import('../pages/EnergyRddByTechnology'));
const EnvironmentalProtection = lazyWithPreload(() => import('../pages/EnvironmentalProtection'));

const PAGES = [
  { id: 'investment-overview', Component: Investment },
  { id: 'capital-expenditure', Component: CapitalExpenditures,
    pageClassName: 'page-with-title-divider' },
  { id: 'infrastructure-stock', Component: Infrastructure,
    pageClassName: 'page-with-title-divider' },
  { id: 'economic-contributions', Component: EconomicContributions },
  { id: 'investment-by-asset', Component: InvestmentByAsset },
  { id: 'major-projects', Component: MajorEnergyProjects },
  { id: 'clean-tech-trends', Component: CleanTechTrends },
  { id: 'projects-map', Component: MajorProjectsMap },
  { id: 'international-investment', Component: InternationalInvestment,
    pageClassName: 'page-with-title-divider' },
  { id: 'foreign-control', Component: ForeignControl },
  { id: 'canadian-energy-assets', Component: CEA,
    pageClassName: 'page-with-title-divider' },
  { id: 'research-development-demonstration', Component: ResearchDevelopmentDemonstration },
  { id: 'public-energy-rdd-expenditures', Component: PublicEnergyRddExpenditures },
  { id: 'energy-rdd-by-technology', Component: EnergyRddByTechnology },
  { id: 'environmental-protection', Component: EnvironmentalProtection,
    pageClassName: 'page-with-title-divider' }
];

const TOPIC_ANCHORS = [
  'capital-expenditure',
  'infrastructure-stock',
  'international-investment',
  'canadian-energy-assets',
  'environmental-protection',
];

const SectionTwo = () => {
  const { lang = 'en' } = useOutletContext() || {};
  return (
    <ActivePageSection
      sectionPath="/section-2"
      pages={PAGES}
      topicAnchors={TOPIC_ANCHORS}
      lang={lang}
    />
  );
};

export default SectionTwo;
