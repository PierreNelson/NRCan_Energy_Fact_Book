import React from 'react';
import { lazyWithPreload } from '../utils/lazyWithPreload';
import { useOutletContext } from 'react-router-dom';
import ActivePageSection from './ActivePageSection';

const SkillsDiversityCommunityOverview = lazyWithPreload(() => import('../pages/SkillsDiversityCommunityOverview'));
const EnergySectorDemographics = lazyWithPreload(() => import('../pages/EnergySectorDemographics'));
const EnergySectorWages = lazyWithPreload(() => import('../pages/EnergySectorWages'));
const DemographicRepresentation = lazyWithPreload(() => import('../pages/DemographicRepresentation'));
const EnergyAffordability = lazyWithPreload(() => import('../pages/EnergyAffordability'));
const HouseholdEnergyExpenditures = lazyWithPreload(() => import('../pages/HouseholdEnergyExpenditures'));
const HouseholdEnergyPricesComparison = lazyWithPreload(() => import('../pages/HouseholdEnergyPricesComparison'));
const EnergyReliantCommunities = lazyWithPreload(() => import('../pages/EnergyReliantCommunities'));

const PAGES = [
  { id: 'skills-diversity-community-overview', Component: SkillsDiversityCommunityOverview },
  { id: 'energy-sector-demographics', Component: EnergySectorDemographics,
    pageClassName: 'page-with-title-divider' },
  { id: 'energy-sector-wages', Component: EnergySectorWages },
  { id: 'demographic-representation', Component: DemographicRepresentation },
  { id: 'energy-affordability', Component: EnergyAffordability,
    pageClassName: 'page-with-title-divider' },
  { id: 'household-energy-expenditures', Component: HouseholdEnergyExpenditures },
  { id: 'household-energy-prices-comparison', Component: HouseholdEnergyPricesComparison },
  { id: 'energy-reliant-communities', Component: EnergyReliantCommunities,
    pageClassName: 'page-with-title-divider' }
];

const TOPIC_ANCHORS = [
  'energy-sector-demographics',
  'energy-affordability',
  'energy-reliant-communities',
];

const SectionThree = () => {
  const { lang = 'en' } = useOutletContext() || {};
  return (
    <ActivePageSection
      sectionPath="/section-3"
      pages={PAGES}
      topicAnchors={TOPIC_ANCHORS}
      lang={lang}
    />
  );
};

export default SectionThree;
