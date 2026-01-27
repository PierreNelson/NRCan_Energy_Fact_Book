import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Page47 from '../pages/Page47';

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
        </div>
    );
};

export default SectionFour;
