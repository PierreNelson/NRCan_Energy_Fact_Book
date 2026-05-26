import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Page47 from '../pages/Page47';
import Page48 from '../pages/Page48';
import Page49 from '../pages/Page49';
import Page50 from '../pages/Page50';
import Page51 from '../pages/Page51';
import Page52 from '../pages/Page52';
import Page53 from '../pages/Page53';

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
        <div className="section-four-container stacked-section-container">
            <style>{`
                #commercial-institutional-energy .page52-stack {
                    padding-bottom: 0 !important;
                }

                #energy-use .page48-chart-frame,
                #secondary-energy-by-fuel .page49-chart-frame,
                #residential-energy-use .page51-chart-frame-before-footnote,
                #industrial-sector-energy .page53-chart-frame {
                    padding-bottom: 20px !important;
                    margin-bottom: 20px !important;
                }

                .section-four-page > * {
                    width: 100%;
                }

                .section-four-page .wb-fnote {
                    margin-top: 24px !important;
                    margin-bottom: 0 !important;
                    padding-top: 12px !important;
                    border-top: 1px solid #e0e0e0 !important;
                    font-family: var(--font-body) !important;
                    font-size: 1rem !important;
                    line-height: 1.65 !important;
                    color: var(--gc-text) !important;
                    max-width: 100%;
                    box-sizing: border-box;
                }

                .section-four-page .wb-fnote h2 {
                    font-family: var(--font-heading) !important;
                    font-size: 1.4rem !important;
                    font-weight: 700 !important;
                    color: var(--gc-text) !important;
                    margin-top: 0 !important;
                    margin-bottom: 1rem !important;
                }

                .section-four-page .wb-fnote dd {
                    display: flex;
                    align-items: flex-start;
                    gap: 0.75rem;
                    margin-left: 0 !important;
                    margin-bottom: 1rem !important;
                }

                .section-four-page .wb-fnote dd:last-child {
                    margin-bottom: 0 !important;
                }

                @media (max-width: 768px) {
                    .section-four-page .wb-fnote {
                        font-size: 0.9rem !important;
                    }

                    .section-four-page .wb-fnote h2 {
                        font-size: 1.2rem !important;
                        margin-bottom: 0.75rem !important;
                    }
                }
            `}</style>
            <div id="energy-efficiency-overview" className="section-four-page stacked-page-wrapper">
                <Page47 />
            </div>
            <div id="energy-use" className="section-four-page stacked-page-wrapper page-with-title-divider">
                <Page48 />
            </div>
            <div id="secondary-energy-by-fuel" className="section-four-page stacked-page-wrapper">
                <Page49 />
            </div>
            <div id="energy-in-daily-lives" className="section-four-page stacked-page-wrapper">
                <Page50 />
            </div>
            <div id="residential-energy-use" className="section-four-page stacked-page-wrapper">
                <Page51 />
            </div>
            <div id="commercial-institutional-energy" className="section-four-page stacked-page-wrapper">
                <Page52 />
            </div>
            <div id="industrial-sector-energy" className="section-four-page stacked-page-wrapper">
                <Page53 />
            </div>
        </div>
    );
};

export default SectionFour;
