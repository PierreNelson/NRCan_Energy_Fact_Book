import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Page39 from '../pages/Page39';
import Page40 from '../pages/Page40';
import Page41 from '../pages/Page41';
import Page42 from '../pages/Page42';
import Page43 from '../pages/Page43';
import Page44 from '../pages/Page44';
import Page45 from '../pages/Page45';
import Page46 from '../pages/Page46';

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
                <Page39 />
            </div>
            <div id="energy-sector-demographics" className="stacked-page-wrapper page-with-title-divider">
                <Page40 />
            </div>
            <div id="energy-sector-wages" className="stacked-page-wrapper">
                <Page41 />
            </div>
            <div id="demographic-representation" className="stacked-page-wrapper">
                <Page42 />
            </div>
            <div id="energy-affordability" className="stacked-page-wrapper page-with-title-divider">
                <Page43 />
            </div>
            <div id="household-energy-expenditures" className="stacked-page-wrapper">
                <Page44 />
            </div>
            <div id="household-energy-prices-comparison" className="stacked-page-wrapper">
                <Page45 />
            </div>
            <div id="energy-reliant-communities" className="stacked-page-wrapper page-with-title-divider">
                <Page46 />
            </div>
        </div>
    );
};

export default SectionThree;
