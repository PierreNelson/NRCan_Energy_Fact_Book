import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Page1 from '../pages/Page1';
import Page2 from '../pages/Page2';
import Page3 from '../pages/Page3';
import Page7 from '../pages/Page7';
import Page8 from '../pages/Page8';

const SectionOne = () => {
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
            }
        }, 300);
        
        return () => clearTimeout(scrollTimer);
    }, [location.pathname, location.hash]);

    return (
        <div className="stacked-section-container">
            <div id="energy-overview" className="stacked-page-wrapper">
                <Page1 />
            </div>
            <div id="energy-production" className="stacked-page-wrapper">
                <Page2 />
            </div>
            <div id="canadian-energy-production" className="stacked-page-wrapper">
                <Page3 />
            </div>
            <div id="economic-contributions" className="stacked-page-wrapper">
                <Page7 />
            </div>
            <div id="provincial-gdp" className="stacked-page-wrapper">
                <Page8 />
            </div>
        </div>
    );
};

export default SectionOne;
