import React, { useState, useEffect, useRef } from 'react';
import { Outlet, useLocation, Link } from 'react-router-dom';
import Sidebar from './Sidebar';
import GCHeader from './GCHeader';
import GCFooter from './GCFooter';
import { getText } from '../utils/translations';

const Layout = () => {
    const [lang, setLang] = useState('en');
    const location = useLocation();
    const isFirstRender = useRef(true);

    const toggleLanguage = () => {
        setLang(prev => prev === 'en' ? 'fr' : 'en');
    };

    // Focus Management
    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }
        
        const focusTimer = setTimeout(() => {
            const mainContent = document.getElementById('main-content');
            if (mainContent) {
                window.scrollTo(0, 0);
                mainContent.focus({ preventScroll: true });
            }
        }, 100);
        
        return () => clearTimeout(focusTimer);
    }, [location.pathname]);

    // Section Navigation Logic - Users navigate between sections, not individual pages
    const pages = [
        { path: '/', labelKey: 'nav_section1_title' },
        { path: '/section-2', labelKey: 'nav_section2_title' }
    ];

    // Handle both / and /section-1 as the same section
    const normalizedPath = location.pathname === '/section-1' ? '/' : location.pathname;
    const currentIndex = pages.findIndex(p => p.path === normalizedPath);
    const prevPage = currentIndex > 0 ? pages[currentIndex - 1] : null;
    const nextPage = currentIndex < pages.length - 1 ? pages[currentIndex + 1] : null;

    return (
        <>
            <style>{`
                /* Reset box sizing */
                * { box-sizing: border-box; }
                
                /* Layout Wrapper */
                .layout-wrapper {
                    display: flex;
                    flex-direction: column;
                    min-height: 100vh;
                }
                
                .layout-viewport {
                    min-height: 100vh;
                    display: flex;
                    flex-direction: column;
                    overflow: visible;
                }
                
                .gc-header { flex-shrink: 0; }
                
                /* Navigation Bar - Top */
                .layout-nav-header {
                    flex-shrink: 0;
                    background: none;
                    padding: 10px 0; 
                    z-index: 10;
                    width: 100%;
                }
                
                .page-navigation {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    width: 100%;
                    max-width: 1400px;
                    margin: 0 auto;
                    /* DESKTOP (Default): 55px Left (Aligns with Flag), 30px Right (Aligns with Lang) */
                    padding: 0 30px 0 55px; 
                }
                
                /* Main Content Area */
                .layout-main-area {
                    flex: 1 1 auto;
                    display: flex;
                    flex-direction: column;
                    min-height: 0;
                    overflow: visible;
                    position: relative;
                }
                
                .layout-content-wrapper {
                    flex: 1 1 auto;
                    display: flex;
                    flex-direction: column;
                    min-height: 0;
                    overflow: visible;
                    position: relative;
                }
                
                .layout-page-content {
                    overflow: visible;
                    position: relative;
                }
                
                /* Strict Alignment Container */
                .layout-content-container {
                    width: 100%;
                    max-width: 1400px;
                    margin: 0 auto;
                    padding: 20px 30px 20px 37px;
                    text-align: left;
                    position: relative;
                    overflow: visible;
                }
                
                h1, h2, h3, h4, h5, h6 { 
                    text-align: left !important; 
                }
                
                /* Nav Buttons */
                .nav-arrow {
                    display: inline-flex;
                    align-items: center;
                    color: #ffffff;
                    background-color: #284162;
                    text-decoration: none;
                    font-size: 1rem;
                    font-weight: bold;
                    padding: 8px 12px;
                    border-radius: 4px;
                    transition: background-color 0.2s;
                    
                    /* Desktop Wrapping Settings */
                    white-space: normal; 
                    max-width: 400px;
                    text-align: left;
                    line-height: 1.3;
                }
                
                .nav-arrow:hover { background-color: #444444; }
                
                .nav-arrow.disabled {
                    color: #a0a0a0;
                    pointer-events: none;
                    background-color: transparent;
                }
                
                .nav-arrow:focus {
                    outline: 2px solid #005fcc;
                    outline-offset: 2px;
                }

                /* --- BREAKPOINTS --- */

                /* 1. Intermediate Zoom (200% / 960px) 
                   Issue: Buttons need to stack, BUT padding must remain desktop-like (55px)
                   because Header flag is still at 55px until 768px.
                */
                @media (max-width: 960px) {
                    .page-navigation {
                        flex-direction: column; /* Stack buttons */
                        gap: 10px;
                        /* KEEP 55px LEFT to match header flag */
                        padding: 0 30px 0 55px !important; 
                    }
                    
                    .nav-arrow {
                        width: 100%;
                        max-width: none;
                        justify-content: center;
                    }
                    
                    /* Update Layout Container padding for Page 1 calculations */
                    .layout-content-container {
                        padding: 15px 30px 15px 45px; 
                    }
                }

                /* 2. Tablet Mode (<= 768px)
                   Header flag moves to 45px left. Nav must match.
                */
                @media (max-width: 768px) {
                    .page-navigation {
                        /* Switch to 45px Left to match Header mobile state */
                        padding: 0 20px 0 45px !important;
                    }

                    .layout-content-container {
                        padding: 15px 20px 15px 45px; 
                    }
                }

                /* 3. Mobile Mode (<= 480px)
                   Header flag moves to 10px left. Nav must match.
                */
                @media (max-width: 480px) {
                    .page-navigation {
                        padding: 0 10px !important;
                    }
                    .layout-content-container {
                        padding: 15px 10px;
                    }
                    
                    .nav-arrow {
                        font-size: 0.9rem;
                        padding: 10px;
                    }
                }

                    /* GHOST NAVIGATION STYLES */
/* 1. Hides the link visually but keeps it in the DOM for Screen Readers */
.sr-only-focusable {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
}

/* 2. When focused (via Tab key), it pops into view */
.sr-only-focusable:focus {
    position: static;
    width: auto;
    height: auto;
    clip: auto;
    white-space: normal;
    overflow: visible;
    
    /* Visual styling to look like a button */
    display: inline-block;
    margin-top: 20px;
    margin-right: 15px;
    padding: 10px 20px;
    background-color: #284162; /* Matches your top nav color */
    color: #ffffff;
    font-weight: bold;
    text-decoration: none;
    border-radius: 4px;
    outline: 3px solid #ffcc00; /* High visibility focus ring */
    box-shadow: 0 4px 8px rgba(0,0,0,0.2);
    z-index: 9999;
}
            `}</style>
            
            <div className="layout-wrapper">
                <div className="layout-viewport">
                    <GCHeader lang={lang} onToggleLanguage={toggleLanguage} />

                    {/* Navigation Buttons */}
                    <div className="layout-nav-header">
                        <nav id="page-navigation-top" className="page-navigation" aria-label={lang === 'en' ? 'Page navigation' : 'Navigation de page'}>
                            {prevPage ? (
                                <Link 
                                    to={prevPage.path} 
                                    className="nav-arrow"
                                    aria-label={lang === 'en' 
                                        ? `Previous page: ${getText(prevPage.labelKey, lang)}` 
                                        : `Page précédente: ${getText(prevPage.labelKey, lang)}`}
                                >
                                    <span aria-hidden="true">← </span>
                                    {getText(prevPage.labelKey, lang)}
                                </Link>
                            ) : (
                                <span className="nav-arrow disabled" aria-hidden="true">
                                    ← {getText('previous', lang)}
                                </span>
                            )}

                            {nextPage ? (
                                <Link 
                                    to={nextPage.path} 
                                    className="nav-arrow"
                                    aria-label={lang === 'en' 
                                        ? `Next page: ${getText(nextPage.labelKey, lang)}` 
                                        : `Page suivante: ${getText(nextPage.labelKey, lang)}`}
                                >
                                    {getText(nextPage.labelKey, lang)}
                                    <span aria-hidden="true"> →</span>
                                </Link>
                            ) : (
                                <span className="nav-arrow disabled" aria-hidden="true">
                                    {getText('next', lang)} →
                                </span>
                            )}
                        </nav>
                    </div>

                    <div className="layout-main-area">
                        <Sidebar lang={lang} />
                        <div className="content layout-content-wrapper">
                            <div className="layout-page-content">
                                <div className="layout-content-container">
                                <Outlet context={{ lang }} />

{/* --- START GHOST NAVIGATION --- 
    These links are invisible to mouse users.
    They only appear when a keyboard/screen reader user tabs past the content.
*/}
<div className="text-center" style={{ textAlign: 'center' }}>
    {prevPage && (
        <Link 
            to={prevPage.path} 
            className="sr-only-focusable"
        >
            {/* Screen Reader hears: "Previous page" */}
            {lang === 'en' ? 'Previous page' : 'Page précédente'}
        </Link>
    )}

    {nextPage && (
        <Link 
            to={nextPage.path} 
            className="sr-only-focusable"
        >
            {/* Screen Reader hears: "Next page" */}
            {lang === 'en' ? 'Next page' : 'Page suivante'}
        </Link>
    )}
</div>
{/* --- END GHOST NAVIGATION --- */}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <GCFooter lang={lang} />
            </div>
        </>
    );
};

export default Layout;