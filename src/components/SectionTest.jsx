import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Page24Stacked from '../pages/Page24Stacked';
import Page25Stacked from '../pages/Page25Stacked';
import Page28Stacked from '../pages/Page28Stacked';
import Page37Stacked from '../pages/Page37Stacked';

const SectionTest = () => {
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
                const overviewPage = document.getElementById('capital-expenditure');
                if (overviewPage) {
                    overviewPage.scrollIntoView({ behavior: 'instant', block: 'start' });
                }
            }
        }, 300);
        
        return () => clearTimeout(scrollTimer);
    }, [location.pathname, location.hash]);

    return (
        <div className="stacked-section-container">
            <div id="capital-expenditure" className="stacked-page-wrapper">
                <Page24Stacked />
            </div>
            <div id="infrastructure-stock" className="stacked-page-wrapper">
                <Page25Stacked />
            </div>
            <div id="major-projects" className="stacked-page-wrapper">
                <Page28Stacked />
            </div>
            <div id="environmental-protection" className="stacked-page-wrapper">
                <Page37Stacked />
            </div>
        </div>
    );
};

export default SectionTest;
