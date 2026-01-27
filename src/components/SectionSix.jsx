import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Page103 from '../pages/Page103';

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
            <div id="oil-gas-coal-overview" className="stacked-page-wrapper">
                <Page103 />
            </div>
        </div>
    );
};

export default SectionSix;
