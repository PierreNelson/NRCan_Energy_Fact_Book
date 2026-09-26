import React from 'react';
import { lazyWithPreload } from '../utils/lazyWithPreload';
import { useOutletContext } from 'react-router-dom';
import ActivePageSection from './ActivePageSection';

const EnergyEfficiencyOverview = lazyWithPreload(() => import('../pages/EnergyEfficiencyOverview'));
const EnergyUse = lazyWithPreload(() => import('../pages/EnergyUse'));
const SEUByFuel = lazyWithPreload(() => import('../pages/SEUByFuel'));
const EnergyInDailyLives = lazyWithPreload(() => import('../pages/EnergyInDailyLives'));
const ResidentialEnergyUse = lazyWithPreload(() => import('../pages/ResidentialEnergyUse'));
const CommercialInstitutionalEnergyUse = lazyWithPreload(() => import('../pages/CommercialInstitutionalEnergyUse'));
const IndustrialSectorEnergy = lazyWithPreload(() => import('../pages/IndustrialSectorEnergy'));
const EfficiencyTrends = lazyWithPreload(() => import('../pages/EfficiencyTrends'));
const EnergyIntensityIndex = lazyWithPreload(() => import('../pages/EnergyIntensityIndex'));
const EnergyUseFactors = lazyWithPreload(() => import('../pages/EnergyUseFactors'));
const SectorEnergyTrends = lazyWithPreload(() => import('../pages/SectorEnergyTrends'));

const PAGES = [
  { id: 'energy-efficiency-overview', Component: EnergyEfficiencyOverview, pageClassName: 'section-four-page' },
  { id: 'energy-use', Component: EnergyUse, pageClassName: 'section-four-page page-with-title-divider' },
  { id: 'secondary-energy-by-fuel', Component: SEUByFuel, pageClassName: 'section-four-page' },
  { id: 'energy-in-daily-lives', Component: EnergyInDailyLives, pageClassName: 'section-four-page' },
  { id: 'residential-energy-use', Component: ResidentialEnergyUse, pageClassName: 'section-four-page' },
  { id: 'commercial-institutional-energy', Component: CommercialInstitutionalEnergyUse, pageClassName: 'section-four-page' },
  { id: 'industrial-sector-energy', Component: IndustrialSectorEnergy, pageClassName: 'section-four-page' },
  { id: 'efficiency-trends', Component: EfficiencyTrends, pageClassName: 'section-four-page page-with-title-divider' },
  { id: 'energy-intensity-index', Component: EnergyIntensityIndex, pageClassName: 'section-four-page' },
  { id: 'energy-use-factors', Component: EnergyUseFactors, pageClassName: 'section-four-page' },
  { id: 'sector-energy-trends', Component: SectorEnergyTrends, pageClassName: 'section-four-page' },
];

const TOPIC_ANCHORS = ['energy-use', 'efficiency-trends'];

const SectionFour = () => {
  const { lang = 'en' } = useOutletContext() || {};
  return (
    <div className="section-four-container">
      <style>{`
        #commercial-institutional-energy .commercial-institutional-energy-stack {
          padding-bottom: 0 !important;
        }
        #energy-use .energy-use-chart-frame,
        #secondary-energy-by-fuel .secondary-energy-by-fuel-chart-frame,
        #residential-energy-use .residential-energy-use-chart-frame-before-footnote,
        #industrial-sector-energy .industrial-sector-energy-chart-frame,
        #efficiency-trends .efficiency-trends-chart-frame,
        #energy-intensity-index .energy-intensity-index-chart-frame,
        #energy-use-factors .energy-use-factors-chart-frame {
          padding-bottom: 20px !important;
          margin-bottom: 20px !important;
        }
        .section-four-page > * { width: 100%; }
        .section-four-page .wb-fnote {
          margin-top: 24px !important;
          margin-bottom: 0 !important;
          padding-top: 12px !important;
          border-top: 1px solid #e0e0e0 !important;
          font-family: var(--font-body) !important;
          font-size: 1rem !important;
          line-height: 1.65 !important;
          color: var(--gc-text) !important;
          max-width: 100%;
          box-sizing: border-box;
        }
        .section-four-page .wb-fnote h2 {
          font-family: var(--font-heading) !important;
          font-size: 1.4rem !important;
          font-weight: 700 !important;
          color: var(--gc-text) !important;
          margin-top: 0 !important;
          margin-bottom: 1rem !important;
        }
        .section-four-page .wb-fnote dd {
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
          margin-left: 0 !important;
          margin-bottom: 1rem !important;
        }
        .section-four-page .wb-fnote dd:last-child { margin-bottom: 0 !important; }
      `}</style>
      <ActivePageSection sectionPath="/section-4" pages={PAGES} topicAnchors={TOPIC_ANCHORS} lang={lang} />
    </div>
  );
};

export default SectionFour;
