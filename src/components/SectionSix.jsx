import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Page103 from '../pages/Page103';
import Page105 from '../pages/Page105';
import Page108 from '../pages/Page108';
import Page106 from '../pages/Page106';
import Page107 from '../pages/Page107';
import Page119 from '../pages/Page119';
import Page122 from '../pages/Page122';
import Page123 from '../pages/Page123';
import Page140 from '../pages/Page140';
import Page126 from '../pages/Page126';
import Page132 from '../pages/Page132';
import Page135 from '../pages/Page135';
import Page138 from '../pages/Page138';
import Page139 from '../pages/Page139';

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
                <Page103 />
            </div>
            <div id="petroleum-employment-by-region" className="stacked-page-wrapper">
                <Page105 />
            </div>
            <div id="petroleum-employment" className="stacked-page-wrapper">
                <Page106 />
            </div>
            <div id="petroleum-gdp" className="stacked-page-wrapper">
                <Page107 />
            </div>
            <div id="crude-oil-international" className="stacked-page-wrapper">
                <Page108 />
            </div>
            <div id="oil-by-rail" className="stacked-page-wrapper">
                <Page119 />
            </div>
            <div id="natural-gas-international" className="stacked-page-wrapper">
                <Page122 />
            </div>
            <div id="world-natural-gas-proved-reserves" className="stacked-page-wrapper">
                <Page123 />
            </div>
            <div id="western-canada-gas-well-completions" className="stacked-page-wrapper">
                <Page126 />
            </div>
            <div id="ghg-spotlight-oil-gas" className="stacked-page-wrapper">
                <Page132 />
            </div>
            <div id="refined-petroleum-products" className="stacked-page-wrapper">
                <Page135 />
            </div>
            <div id="retail-gasoline-prices" className="stacked-page-wrapper">
                <Page138 />
            </div>
            <div id="refinery-capacity" className="stacked-page-wrapper">
                <Page139 />
            </div>
            <div id="coal-international" className="stacked-page-wrapper">
                <Page140 />
            </div>
        </div>
    );
};

export default SectionSix;
