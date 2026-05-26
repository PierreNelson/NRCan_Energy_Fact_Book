import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Page59 from '../pages/Page59';
import Page61 from '../pages/Page61';
import Page62 from '../pages/Page62';
import Page63 from '../pages/Page63';

const SectionFive = () => {
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
        <div className="section-five-container stacked-section-container">
            <div id="clean-power-low-carbon-overview" className="stacked-page-wrapper">
                <Page59 />
            </div>
            <div id="environmental-clean-technology" className="stacked-page-wrapper">
                <Page61 />
            </div>
            <div id="cleantech-companies" className="stacked-page-wrapper">
                <Page62 />
            </div>
            <div id="cleantech-companies-industry" className="stacked-page-wrapper">
                <Page63 />
            </div>
        </div>
    );
};

export default SectionFive;
