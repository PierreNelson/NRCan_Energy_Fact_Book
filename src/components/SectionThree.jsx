import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Page39 from '../pages/Page39';

const SectionThree = () => {
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
        <div className="section-three-container">
            <div id="skills-diversity-community-overview">
                <Page39 />
            </div>
        </div>
    );
};

export default SectionThree;
