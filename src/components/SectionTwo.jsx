import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Page23 from '../pages/Page23';
import Page24 from '../pages/Page24';
import Page25 from '../pages/Page25';
import Page26 from '../pages/Page26';
import Page27 from '../pages/Page27';
import Page28 from '../pages/Page28';
import Page29 from '../pages/Page29';
import Page31 from '../pages/Page31';
import Page32 from '../pages/Page32';
import Page37 from '../pages/Page37';

const SectionTwo = () => {
    const location = useLocation();

    // Scroll to anchor when hash changes (e.g., #page-24)
    // Or scroll to top and focus page-23 when entering section without hash
    useEffect(() => {
        // Immediate scroll to top to prevent flash
        window.scrollTo(0, 0);
        
        // Delayed scroll to override any page auto-focus effects (e.g., Page37 focuses at 100ms)
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
        }, 300); // Run after Page37's 100ms auto-focus effect
        
        return () => clearTimeout(scrollTimer);
    }, [location.pathname, location.hash]);

    return (
        <div className="stacked-section-container">
            {/* Each page wrapper has a semantic ID for anchor links */}
            
            <div id="investment-overview" className="stacked-page-wrapper">
                <Page23 />
            </div>

            <div id="capital-expenditure" className="stacked-page-wrapper">
                <Page24 />
            </div>

            <div id="infrastructure-stock" className="stacked-page-wrapper">
                <Page25 />
            </div>

            <div id="economic-contributions" className="stacked-page-wrapper">
                <Page26 />
            </div>

            <div id="investment-by-asset" className="stacked-page-wrapper">
                <Page27 />
            </div>

            <div id="major-projects" className="stacked-page-wrapper">
                <Page28 />
            </div>

            <div id="clean-tech-trends" className="stacked-page-wrapper">
                <Page29 />
            </div>

            <div id="international-investment" className="stacked-page-wrapper">
                <Page31 />
            </div>

            <div id="foreign-control" className="stacked-page-wrapper">
                <Page32 />
            </div>

            <div id="environmental-protection" className="stacked-page-wrapper">
                <Page37 />
            </div>
        </div>
    );
};

export default SectionTwo;
