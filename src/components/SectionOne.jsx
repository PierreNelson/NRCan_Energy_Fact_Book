import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Page1 from '../pages/Page1';
import Page8 from '../pages/Page8';

const SectionOne = () => {
    const location = useLocation();

    // Scroll to anchor when hash changes (e.g., #page-8)
    // Or scroll to top when entering section without hash
    useEffect(() => {
        // Immediate scroll to top to prevent flash
        window.scrollTo(0, 0);
        
        // Delayed scroll to handle hash navigation
        const scrollTimer = setTimeout(() => {
            if (location.hash) {
                const elementId = location.hash.replace('#', '');
                const element = document.getElementById(elementId);
                if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            } else {
                // No hash - scroll to top (page-1 / title screen)
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
            <div id="provincial-gdp" className="stacked-page-wrapper">
                <Page8 />
            </div>
        </div>
    );
};

export default SectionOne;
