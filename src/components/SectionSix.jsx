import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import OilGasCoalOverview from '../pages/OilGasCoalOverview';
import PetroleumEmploymentByRegion from '../pages/PetroleumEmploymentByRegion';
import PetroleumEmployment from '../pages/PetroleumEmployment';
import PetroleumGdp from '../pages/PetroleumGdp';
import CrudeOilInternational from '../pages/CrudeOilInternational';
import WorldProvedCrudeReserves from '../pages/WorldProvedCrudeReserves';
import CanadianCrudeReserves from '../pages/CanadianCrudeReserves';
import CanadianCrudeProduction from '../pages/CanadianCrudeProduction';
import CanadianSupplyDemand from '../pages/CanadianSupplyDemand';
import OilSandsProduction from '../pages/OilSandsProduction';
import CrudeOilPrices from '../pages/CrudeOilPrices';
import OilByRail from '../pages/OilByRail';
import NaturalGasInternational from '../pages/NaturalGasInternational';
import WorldProvedGasReserves from '../pages/WorldProvedGasReserves';
import WesternCanadaGasWellCompletions from '../pages/WesternCanadaGasWellCompletions';
import OilGasGhgSpotlight from '../pages/OilGasGhgSpotlight';
import RefinedPetroleumProducts from '../pages/RefinedPetroleumProducts';
import RppSupplyDemand from '../pages/RppSupplyDemand';
import RetailGasolinePrices from '../pages/RetailGasolinePrices';
import RefineryCapacity from '../pages/RefineryCapacity';
import CoalInternational from '../pages/CoalInternational';
import CanadianCoalSupplyDemand from '../pages/CanadianCoalSupplyDemand';
const SectionSix = () => {
    const location = useLocation();

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
                const overviewPage = document.getElementById('oil-gas-coal-overview');
                if (overviewPage) {
                    overviewPage.scrollIntoView({ behavior: 'instant', block: 'start' });
                }
            }
        }, 300);
        
        return () => clearTimeout(scrollTimer);
    }, [location.pathname, location.hash]);

    return (
        <div className="stacked-section-container">
            <div id="oil-gas-coal-overview" className="stacked-page-wrapper page-with-title-divider">
                <OilGasCoalOverview />
            </div>
            <div id="petroleum-employment-by-region" className="stacked-page-wrapper">
                <PetroleumEmploymentByRegion />
            </div>
            <div id="petroleum-employment" className="stacked-page-wrapper">
                <PetroleumEmployment />
            </div>
            <div id="petroleum-gdp" className="stacked-page-wrapper">
                <PetroleumGdp />
            </div>
            <div id="crude-oil-international" className="stacked-page-wrapper">
                <CrudeOilInternational />
            </div>
            <div id="world-crude-oil-proved-reserves" className="stacked-page-wrapper">
                <WorldProvedCrudeReserves />
            </div>
            <div id="canadian-crude-reserves" className="stacked-page-wrapper">
                <CanadianCrudeReserves />
            </div>
            <div id="canadian-crude-production" className="stacked-page-wrapper">
                <CanadianCrudeProduction />
            </div>
            <div id="canadian-supply-demand" className="stacked-page-wrapper">
                <CanadianSupplyDemand />
            </div>
            <div id="oil-sands" className="stacked-page-wrapper">
                <OilSandsProduction />
            </div>
            <div id="crude-oil-prices" className="stacked-page-wrapper">
                <CrudeOilPrices />
            </div>
            <div id="oil-by-rail" className="stacked-page-wrapper">
                <OilByRail />
            </div>
            <div id="natural-gas-international" className="stacked-page-wrapper">
                <NaturalGasInternational />
            </div>
            <div id="world-natural-gas-proved-reserves" className="stacked-page-wrapper">
                <WorldProvedGasReserves />
            </div>
            <div id="western-canada-gas-well-completions" className="stacked-page-wrapper">
                <WesternCanadaGasWellCompletions />
            </div>
            <div id="ghg-spotlight-oil-gas" className="stacked-page-wrapper">
                <OilGasGhgSpotlight />
            </div>
            <div id="refined-petroleum-products" className="stacked-page-wrapper">
                <RefinedPetroleumProducts />
            </div>
            <div id="rpp-supply-demand" className="stacked-page-wrapper">
                <RppSupplyDemand />
            </div>
            <div id="retail-gasoline-prices" className="stacked-page-wrapper">
                <RetailGasolinePrices />
            </div>
            <div id="refinery-capacity" className="stacked-page-wrapper">
                <RefineryCapacity />
            </div>
            <div id="coal-international" className="stacked-page-wrapper">
                <CoalInternational />
            </div>
            <div id="canadian-coal-supply-demand" className="stacked-page-wrapper">
                <CanadianCoalSupplyDemand />
            </div>
        </div>
    );
};

export default SectionSix;
