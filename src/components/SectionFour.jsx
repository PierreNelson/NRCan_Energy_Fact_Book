import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Page47 from '../pages/Page47';
import Page48 from '../pages/Page48';
import Page49 from '../pages/Page49';
import Page50 from '../pages/Page50';
import Page51 from '../pages/Page51';
import Page52 from '../pages/Page52';

const SectionFour = () => {
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
        <div className="section-four-container">
            <div id="energy-efficiency-overview">
                <Page47 />
            </div>
            <div id="energy-use" className="section-four-page">
                <Page48 />
            </div>
            <div id="secondary-energy-by-fuel" className="section-four-page">
                <Page49 />
            </div>
            <div id="energy-in-daily-lives" className="section-four-page">
                <Page50 />
            </div>
            <div id="residential-energy-use" className="section-four-page">
                <Page51 />
            </div>
            <div id="commercial-institutional-energy" className="section-four-page">
                <Page52 />
            </div>
        </div>
    );
};

export default SectionFour;
