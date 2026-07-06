import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Investment from '../pages/Investment';
import CapitalExpenditures from '../pages/CapitalExpenditures';
import Infrastructure from '../pages/Infrastructure';
import EconomicContributions from '../pages/EconomicContributions';
import InvestmentByAsset from '../pages/InvestmentByAsset';
import MajorEnergyProjects from '../pages/MajorEnergyProjects';
import CleanTechTrends from '../pages/CleanTechTrends';
import MajorProjectsMap from '../pages/MajorProjectsMap';
import InternationalInvestment from '../pages/InternationalInvestment';
import ForeignControl from '../pages/ForeignControl';
import CEA from '../pages/CEA';
import ResearchDevelopmentDemonstration from '../pages/ResearchDevelopmentDemonstration';
import PublicEnergyRddExpenditures from '../pages/PublicEnergyRddExpenditures';
import EnergyRddByTechnology from '../pages/EnergyRddByTechnology';
import EnvironmentalProtection from '../pages/EnvironmentalProtection';

const SectionTwo = () => {
    const location = useLocation();

    // Scroll to anchor when hash changes (e.g., #page-24)
    // Or scroll to top and focus page-23 when entering section without hash
    useEffect(() => {
        // Immediate scroll to top to prevent flash
        window.scrollTo(0, 0);
        
        // Delayed scroll to override any page auto-focus effects (e.g., environmental protection expenditures focuses at 100ms)
        const scrollTimer = setTimeout(() => {
            if (location.hash) {
                const elementId = location.hash.replace('#', '');
                const element = document.getElementById(elementId);
                if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            } else {
                // No hash - scroll to top and focus on investment overview (title screen)
                window.scrollTo({ top: 0, behavior: 'instant' });
                const overviewPage = document.getElementById('investment-overview');
                if (overviewPage) {
                    overviewPage.scrollIntoView({ behavior: 'instant', block: 'start' });
                }
            }
        }, 300); // Run after environmental protection expenditures page 100ms auto-focus effect
        
        return () => clearTimeout(scrollTimer);
    }, [location.pathname, location.hash]);

    return (
        <div className="stacked-section-container">
            {/* Each page wrapper has a semantic ID for anchor links */}
            
            <div id="investment-overview" className="stacked-page-wrapper">
                <Investment />
            </div>

            <div id="capital-expenditure" className="stacked-page-wrapper page-with-title-divider">
                <CapitalExpenditures />
            </div>

            <div id="infrastructure-stock" className="stacked-page-wrapper page-with-title-divider">
                <Infrastructure />
            </div>

            <div id="economic-contributions" className="stacked-page-wrapper">
                <EconomicContributions />
            </div>

            <div id="investment-by-asset" className="stacked-page-wrapper">
                <InvestmentByAsset />
            </div>

            <div id="major-projects" className="stacked-page-wrapper">
                <MajorEnergyProjects />
            </div>

            <div id="clean-tech-trends" className="stacked-page-wrapper">
                <CleanTechTrends />
            </div>

            <div id="projects-map" className="stacked-page-wrapper">
                <MajorProjectsMap />
            </div>

            <div id="international-investment" className="stacked-page-wrapper page-with-title-divider">
                <InternationalInvestment />
            </div>

            <div id="foreign-control" className="stacked-page-wrapper">
                <ForeignControl />
            </div>

            <div id="canadian-energy-assets" className="stacked-page-wrapper page-with-title-divider">
                <CEA />
            </div>

            <div id="research-development-demonstration" className="stacked-page-wrapper">
                <ResearchDevelopmentDemonstration />
            </div>

            <div id="public-energy-rdd-expenditures" className="stacked-page-wrapper">
                <PublicEnergyRddExpenditures />
            </div>

            <div id="energy-rdd-by-technology" className="stacked-page-wrapper">
                <EnergyRddByTechnology />
            </div>

            <div id="environmental-protection" className="stacked-page-wrapper page-with-title-divider">
                <EnvironmentalProtection />
            </div>
        </div>
    );
};

export default SectionTwo;
