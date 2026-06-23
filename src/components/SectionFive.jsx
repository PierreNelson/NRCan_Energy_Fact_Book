import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Page59 from '../pages/Page59';
import Page60 from '../pages/Page60';
import Page61 from '../pages/Page61';
import Page62 from '../pages/Page62';
import Page63 from '../pages/Page63';
import Page64 from '../pages/Page64';
import Page65 from '../pages/Page65';
import Page66 from '../pages/Page66';
import Page67 from '../pages/Page67';
import Page68 from '../pages/Page68';
import Page71 from '../pages/Page71';
import Page74 from '../pages/Page74';
import Page76 from '../pages/Page76';
import Page78 from '../pages/Page78';
import Page79 from '../pages/Page79';
import Page80 from '../pages/Page80';
import Page81 from '../pages/Page81';
import Page82 from '../pages/Page82';
import Page84 from '../pages/Page84';
import Page96 from '../pages/Page96';

const SectionFive = () => {
    const location = useLocation();

    useEffect(() => {
        if (!location.hash) {
            window.scrollTo(0, 0);
            return undefined;
        }

        const id = location.hash.replace('#', '');
        let attempts = 0;
        let timerId = null;

        const scrollToTarget = () => {
            const element = document.getElementById(id);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                return;
            }
            if (attempts < 30) {
                attempts += 1;
                timerId = window.setTimeout(scrollToTarget, 150);
            }
        };

        timerId = window.setTimeout(scrollToTarget, 100);
        return () => {
            if (timerId) window.clearTimeout(timerId);
        };
    }, [location.pathname, location.hash]);

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
            <div id="canadian-electricity-generation" className="stacked-page-wrapper">
                <Page66 />
            </div>
            <div id="provincial-electricity-generation" className="stacked-page-wrapper">
                <Page67 />
            </div>
            <div id="electricity-energy-use" className="stacked-page-wrapper">
                <Page68 />
            </div>
            <div id="electricity-ghg-spotlight" className="stacked-page-wrapper">
                <Page71 />
            </div>
            <div id="renewable-electricity-capacity" className="stacked-page-wrapper page-with-title-divider">
                <Page74 />
            </div>
            <div id="major-hydro-facilities" className="stacked-page-wrapper page-with-title-divider">
                <Page76 />
            </div>
            <div id="solid-biofuels" className="stacked-page-wrapper">
                <Page78 />
            </div>
            <div id="world-wind-power" className="stacked-page-wrapper">
                <Page79 />
            </div>
            <div id="wind-power-canada" className="stacked-page-wrapper">
                <Page80 />
            </div>
            <div id="wind-capacity" className="stacked-page-wrapper">
                <Page81 />
            </div>
            <div id="world-solar-pv" className="stacked-page-wrapper">
                <Page82 />
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
