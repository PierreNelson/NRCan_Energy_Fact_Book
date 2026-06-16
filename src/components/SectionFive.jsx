import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Page59 from '../pages/Page59';
import Page60 from '../pages/Page60';
import Page61 from '../pages/Page61';
import Page62 from '../pages/Page62';
import Page63 from '../pages/Page63';
import Page64 from '../pages/Page64';
import Page65 from '../pages/Page65';
import Page67 from '../pages/Page67';
import Page71 from '../pages/Page71';
import Page74 from '../pages/Page74';
import Page78 from '../pages/Page78';
import Page81 from '../pages/Page81';
import Page84 from '../pages/Page84';
import Page96 from '../pages/Page96';

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
            <div id="clean-technology-economy" className="stacked-page-wrapper">
                <Page60 />
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
            <div id="electricity-international-context" className="stacked-page-wrapper">
                <Page64 />
            </div>
            <div id="electricity-trade-us" className="stacked-page-wrapper">
                <Page65 />
            </div>
            <div id="provincial-electricity-generation" className="stacked-page-wrapper">
                <Page67 />
            </div>
            <div id="electricity-ghg-spotlight" className="stacked-page-wrapper">
                <Page71 />
            </div>
            <div id="renewable-electricity-capacity" className="stacked-page-wrapper">
                <Page74 />
            </div>
            <div id="solid-biofuels" className="stacked-page-wrapper">
                <Page78 />
            </div>
            <div id="wind-capacity" className="stacked-page-wrapper">
                <Page81 />
            </div>
            <div id="largest-solar-projects" className="stacked-page-wrapper">
                <Page84 />
            </div>
            <div id="ev-sales" className="stacked-page-wrapper">
                <Page96 />
            </div>
        </div>
    );
};

export default SectionFive;
