
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

    // Focus Management: When page changes, focus the main content
    // This is the standard accessibility pattern for SPA navigation
    useEffect(() => {
        // Skip the first render (initial page load)
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }
        
        // Use setTimeout to ensure React has finished rendering the new page
        // before attempting to focus the main content
        const focusTimer = setTimeout(() => {
            const mainContent = document.getElementById('main-content');
            if (mainContent) {
                // Scroll to top first
                window.scrollTo(0, 0);
                // Then focus the main content
                mainContent.focus({ preventScroll: true });
            }
        }, 100);
        
        return () => clearTimeout(focusTimer);
    }, [location.pathname]);

    // Footer Navigation Logic
    const pages = [
        { path: '/', labelKey: 'nav_section2_title' },
        { path: '/page-24', labelKey: 'nav_capital_expenditure' },
        { path: '/page-25', labelKey: 'nav_infrastructure' },
        { path: '/page-26', labelKey: 'nav_economic_contributions' },
        { path: '/page-27', labelKey: 'nav_investment_detail' }
    ];

    const currentIndex = pages.findIndex(p => p.path === location.pathname);
    const prevPage = currentIndex > 0 ? pages[currentIndex - 1] : null;
    const nextPage = currentIndex < pages.length - 1 ? pages[currentIndex + 1] : null;

    return (
        <>
            <style>{`
                /* Reset box sizing */
                * {
                    box-sizing: border-box;
                }
                
                /* Main wrapper - single column layout with single scrollbar */
                .layout-wrapper {
                    display: flex;
                    flex-direction: column;
                    min-height: 100vh;
                }
                
                /* Viewport section - allows content to grow beyond 100vh */
                .layout-viewport {
                    min-height: 100vh;
                    display: flex;
                    flex-direction: column;
                    overflow: visible;
                }
                
                /* Header area - flex-shrink 0 to maintain size */
                .gc-header {
                    flex-shrink: 0;
                }
                
                /* Main content area - fills remaining space */
                .layout-main-area {
                    flex: 1 1 auto;
                    display: flex;
                    flex-direction: column;
                    min-height: 0;
                    overflow: visible;
                }
                
                /* Content wrapper */
                .layout-content-wrapper {
                    flex: 1 1 auto;
                    display: flex;
                    flex-direction: column;
                    min-height: 0;
                    overflow: visible;
                }
                
                /* Page content - no internal scroll */
                .layout-page-content {
                    flex: 1 1 auto;
                    min-height: 0;
                    display: flex;
                    flex-direction: column;
                    overflow: visible;
                }
                
                /* Navigation buttons - always visible at bottom of viewport */
                .layout-nav-footer {
                    flex-shrink: 0;
                    background: #f5f5f5;
                    border-top: 1px solid #ddd;
                    padding: 12px 20px;
                }
                
                .page-navigation {
                    display: flex;
                    justify-content: space-between;
                    max-width: 1400px;
                    margin: 0 auto;
                }
                
                /* Original navigation button style - blue underlined links */
                .nav-arrow {
                    color: #ffffff;
                    background-color: #284162;
                    text-decoration: none;
                    font-size: 1rem;
                    font-weight: bold;
                    padding: 8px 12px;
                    border-radius: 4px;
                    transition: background-color 0.2s;
                }
                
                .nav-arrow:hover {
                    background-color: #444444;
                }
                
                .nav-arrow.disabled {
                    color: #a0a0a0;
                    pointer-events: none;
                    background-color: transparent;
                }
                
                                .nav-arrow:focus {
                                    outline: 2px solid #005fcc;
                                    outline-offset: 2px;
                                }
            `}</style>
            
            <div className="layout-wrapper">
                {/* Viewport section - fills exactly 100vh */}
                <div className="layout-viewport">
                    {/* Government of Canada Header */}
                    <GCHeader lang={lang} onToggleLanguage={toggleLanguage} />

                    {/* Sidebar */}
                    <Sidebar lang={lang} />

                    {/* Main Content Area */}
                    <div className="layout-main-area">
                        <div className="content layout-content-wrapper">
                            <div className="layout-page-content">
                                <Outlet context={{ lang }} />
                            </div>
                        </div>
                    </div>

                    {/* Navigation Buttons - Always visible */}
                    <div className="layout-nav-footer">
                        <nav id="page-navigation-footer" className="page-navigation" aria-label={lang === 'en' ? 'Page navigation' : 'Navigation de page'}>
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
                </div>

                {/* Footer - revealed by scrolling past viewport */}
                <GCFooter lang={lang} />
            </div>
        </>
    );
};

export default Layout;
