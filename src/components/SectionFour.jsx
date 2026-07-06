import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import EnergyEfficiencyOverview from '../pages/EnergyEfficiencyOverview';
import EnergyUse from '../pages/EnergyUse';
import SEUByFuel from '../pages/SEUByFuel';
import EnergyInDailyLives from '../pages/EnergyInDailyLives';
import ResidentialEnergyUse from '../pages/ResidentialEnergyUse';
import CommercialInstitutionalEnergyUse from '../pages/CommercialInstitutionalEnergyUse';
import IndustrialSectorEnergy from '../pages/IndustrialSectorEnergy';
import EfficiencyTrends from '../pages/EfficiencyTrends';
import EnergyIntensityIndex from '../pages/EnergyIntensityIndex';
import EnergyUseFactors from '../pages/EnergyUseFactors';
import SectorEnergyTrends from '../pages/SectorEnergyTrends';

const SectionFour = () => {
    const location = useLocation();

    useEffect(() => {
        if (location.hash) {
            const id = location.hash.replace('#', '');
            const element = document.getElementById(id);
            if (element) {
                setTimeout(() => {
                    element.scrollIntoView({ behavior: 'smooth' });
                }, 100);
            }
        } else {
            window.scrollTo(0, 0);
        }
    }, [location]);

    return (
        <div className="section-four-container stacked-section-container">
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

                .section-four-page > * {
                    width: 100%;
                }

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

                .section-four-page .wb-fnote dd:last-child {
                    margin-bottom: 0 !important;
                }

                @media (max-width: 768px) {
                    .section-four-page .wb-fnote {
                        font-size: 0.9rem !important;
                    }

                    .section-four-page .wb-fnote h2 {
                        font-size: 1.2rem !important;
                        margin-bottom: 0.75rem !important;
                    }
                }
            `}</style>
            <div id="energy-efficiency-overview" className="section-four-page stacked-page-wrapper">
                <EnergyEfficiencyOverview />
            </div>
            <div id="energy-use" className="section-four-page stacked-page-wrapper page-with-title-divider">
                <EnergyUse />
            </div>
            <div id="secondary-energy-by-fuel" className="section-four-page stacked-page-wrapper">
                <SEUByFuel />
            </div>
            <div id="energy-in-daily-lives" className="section-four-page stacked-page-wrapper">
                <EnergyInDailyLives />
            </div>
            <div id="residential-energy-use" className="section-four-page stacked-page-wrapper">
                <ResidentialEnergyUse />
            </div>
            <div id="commercial-institutional-energy" className="section-four-page stacked-page-wrapper">
                <CommercialInstitutionalEnergyUse />
            </div>
            <div id="industrial-sector-energy" className="section-four-page stacked-page-wrapper">
                <IndustrialSectorEnergy />
            </div>
            <div id="efficiency-trends" className="section-four-page stacked-page-wrapper page-with-title-divider">
                <EfficiencyTrends />
            </div>
            <div id="energy-intensity-index" className="section-four-page stacked-page-wrapper">
                <EnergyIntensityIndex />
            </div>
            <div id="energy-use-factors" className="section-four-page stacked-page-wrapper">
                <EnergyUseFactors />
            </div>
            <div id="sector-energy-trends" className="section-four-page stacked-page-wrapper">
                <SectorEnergyTrends />
            </div>
        </div>
    );
};

export default SectionFour;
