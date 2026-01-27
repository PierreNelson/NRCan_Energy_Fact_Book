import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Page59 from '../pages/Page59';

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
        <div className="section-five-container">
            <div id="clean-power-low-carbon-overview">
                <Page59 />
            </div>
        </div>
    );
};

export default SectionFive;
