import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import SkillsDiversityCommunityOverview from '../pages/SkillsDiversityCommunityOverview';
import EnergySectorDemographics from '../pages/EnergySectorDemographics';
import EnergySectorWages from '../pages/EnergySectorWages';
import DemographicRepresentation from '../pages/DemographicRepresentation';
import EnergyAffordability from '../pages/EnergyAffordability';
import HouseholdEnergyExpenditures from '../pages/HouseholdEnergyExpenditures';
import HouseholdEnergyPricesComparison from '../pages/HouseholdEnergyPricesComparison';
import EnergyReliantCommunities from '../pages/EnergyReliantCommunities';

const SectionThree = () => {
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
        <div className="section-three-container stacked-section-container">
            <div id="skills-diversity-community-overview" className="stacked-page-wrapper">
                <SkillsDiversityCommunityOverview />
            </div>
            <div id="energy-sector-demographics" className="stacked-page-wrapper page-with-title-divider">
                <EnergySectorDemographics />
            </div>
            <div id="energy-sector-wages" className="stacked-page-wrapper">
                <EnergySectorWages />
            </div>
            <div id="demographic-representation" className="stacked-page-wrapper">
                <DemographicRepresentation />
            </div>
            <div id="energy-affordability" className="stacked-page-wrapper page-with-title-divider">
                <EnergyAffordability />
            </div>
            <div id="household-energy-expenditures" className="stacked-page-wrapper">
                <HouseholdEnergyExpenditures />
            </div>
            <div id="household-energy-prices-comparison" className="stacked-page-wrapper">
                <HouseholdEnergyPricesComparison />
            </div>
            <div id="energy-reliant-communities" className="stacked-page-wrapper page-with-title-divider">
                <EnergyReliantCommunities />
            </div>
        </div>
    );
};

export default SectionThree;
