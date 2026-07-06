import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import EnergyOverview from '../pages/EnergyOverview';
import WorldEnergyProduction from '../pages/WorldEnergyProduction';
import CanadianEnergyProduction from '../pages/CanadianEnergyProduction';
import PrimaryEnergyProduction from '../pages/PrimaryEnergyProduction';
import PrimaryEnergyByRegion from '../pages/PrimaryEnergyByRegion';
import NominalGdp from '../pages/NominalGdp';
import ProvincialGdp from '../pages/ProvincialGdp';
import Employment from '../pages/Employment';
import EmploymentChart from '../pages/EmploymentChart';
import GdpChart from '../pages/GdpChart';
import CanadianEnergyExportsUsStates from '../pages/CanadianEnergyExportsUsStates';
import CanadaGlobalEnergyTrade from '../pages/CanadaGlobalEnergyTrade';
import GovernmentRevenues from '../pages/GovernmentRevenues';
import CorporateIncomeTaxes from '../pages/CorporateIncomeTaxes';
import GhgEmissionsBySector from '../pages/GhgEmissionsBySector';
import EnergyInformationLandscape from '../pages/EnergyInformationLandscape';

const SectionOne = () => {
    const location = useLocation();
    const [nativeWidth] = React.useState(typeof window !== 'undefined' ? window.innerWidth : 1200);


    useEffect(() => {
        window.scrollTo(0, 0);

        const scrollTimer = setTimeout(() => {
            if (location.hash) {
                const elementId = location.hash.replace('#', '');
                const element = document.getElementById(elementId);
                if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            } else {
                window.scrollTo({ top: 0, behavior: 'instant' });
            }
        }, 300);

        return () => clearTimeout(scrollTimer);
    }, [location.pathname, location.hash]);

    return (
        <div className="stacked-section-container" style={{ backgroundColor: '#ccc' }}>
            <div className="stacked-section-inner" style={{ maxWidth: nativeWidth, margin: '0 0', backgroundColor: 'white', transition: 'max-width 0.3s ease-in-out', boxShadow: 'none' }}>
                <div id="energy-overview" className="stacked-page-wrapper page-with-title-divider">
                    <EnergyOverview />
                </div>
                <div id="energy-production" className="stacked-page-wrapper page-with-title-divider">
                    <WorldEnergyProduction />
                </div>
                <div id="canadian-energy-production" className="stacked-page-wrapper">
                    <CanadianEnergyProduction />
                </div>
                <div id="primary-energy-production" className="stacked-page-wrapper">
                    <PrimaryEnergyProduction />
                </div>
                <div id="primary-energy-by-region" className="stacked-page-wrapper">
                    <PrimaryEnergyByRegion />
                </div>
                <div id="economic-contributions" className="stacked-page-wrapper page-with-title-divider">
                    <NominalGdp />
                </div>
                <div id="provincial-gdp" className="stacked-page-wrapper">
                    <ProvincialGdp />
                </div>
                <div id="employment" className="stacked-page-wrapper page-with-title-divider">
                    <Employment />
                </div>
                <div id="employment-chart" className="stacked-page-wrapper">
                    <EmploymentChart />
                </div>
                <div id="gdp-chart" className="stacked-page-wrapper">
                    <GdpChart />
                </div>
                <div id="canadian-energy-exports-us-states" className="stacked-page-wrapper">
                    <CanadianEnergyExportsUsStates />
                </div>
                <div id="canada-global-energy-trade" className="stacked-page-wrapper">
                    <CanadaGlobalEnergyTrade />
                </div>
                <div id="government-revenues" className="stacked-page-wrapper">
                    <GovernmentRevenues />
                </div>
                <div id="corporate-income-taxes" className="stacked-page-wrapper">
                    <CorporateIncomeTaxes />
                </div>
                <div id="ghg-emissions" className="stacked-page-wrapper">
                    <GhgEmissionsBySector />
                </div>
                <div id="energy-information-landscape" className="stacked-page-wrapper">
                    <EnergyInformationLandscape />
                </div>
            </div>
        </div>
    );
};

export default SectionOne;
