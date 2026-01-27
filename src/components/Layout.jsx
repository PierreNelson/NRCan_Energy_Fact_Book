import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { Outlet, useLocation, Link } from 'react-router-dom';
import Sidebar from './Sidebar';
import GCHeader from './GCHeader';
import GCFooter from './GCFooter';

const Layout = () => {
    const [lang, setLang] = useState('en');
    const [layoutPadding, setLayoutPadding] = useState({ left: 55, right: 15 }); // Defaults
    const location = useLocation();
    const isFirstRender = useRef(true);

    const toggleLanguage = () => {
        setLang(prev => prev === 'en' ? 'fr' : 'en');
    };

    // --- ALIGNMENT AUTOMATION ENGINE ---
    // This calculates alignment perfectly at ANY zoom level by measuring
    // the actual positions of the header anchors
    useLayoutEffect(() => {
        const updateAlignment = () => {
            const leftAnchor = document.getElementById('alignment-anchor-left');
            const rightAnchor = document.getElementById('alignment-anchor-right');
            const mainContainer = document.getElementById('main-content-container');

            if (leftAnchor && rightAnchor && mainContainer) {
                // Get positions relative to viewport
                const leftRect = leftAnchor.getBoundingClientRect();
                const rightRect = rightAnchor.getBoundingClientRect();
                const containerRect = mainContainer.getBoundingClientRect();

                // Calculate the exact padding needed to match header elements
                // "How far is the flag from the container left edge?"
                const newLeft = Math.max(0, leftRect.left - containerRect.left);
                
                // "How far is the container right edge from the lang button right edge?"
                const newRight = Math.max(0, containerRect.right - rightRect.right);

                setLayoutPadding({ left: newLeft, right: newRight });
            }
        };

        // Run on load, resize, and zoom
        window.addEventListener('resize', updateAlignment);
        updateAlignment(); // Initial run
        
        // Slight delay to catch layout shifts (common with custom fonts/images)
        const delayedUpdate = setTimeout(updateAlignment, 100);

        return () => {
            window.removeEventListener('resize', updateAlignment);
            clearTimeout(delayedUpdate);
        };
    }, [location.pathname]); // Re-check when changing pages

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

    const pages = [
        { path: '/section-1' },
        { path: '/section-2' },
        { path: '/section-6' }
    ];

    const normalizedPath = location.pathname === '/' ? '/section-1' : location.pathname;
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
                
                /* Strict Alignment Container - Padding is now set dynamically via JS */
                .layout-content-container {
                    width: 100%;
                    max-width: 1400px;
                    margin: 0 auto;
                    /* Padding is applied via inline styles from alignment automation */
                    text-align: left;
                    position: relative;
                    overflow: visible;
                    box-sizing: border-box;
                    transition: padding 0.1s ease-out; /* Smooth adjustment during zoom */
                }
                
                h1, h2, h3, h4, h5, h6 { 
                    text-align: left !important; 
                }

                /* ===============================================
                   GHOST NAVIGATION STYLES
                   Hides links visually but keeps them in DOM for 
                   screen readers. Appears when focused via Tab.
                   =============================================== */
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

                .sr-only-focusable:focus {
                    position: static;
                    width: auto;
                    height: auto;
                    clip: auto;
                    white-space: normal;
                    overflow: visible;
                    display: inline-block;
                    margin-top: 20px;
                    margin-right: 15px;
                    padding: 10px 20px;
                    background-color: #284162;
                    color: #ffffff;
                    font-weight: bold;
                    text-decoration: none;
                    border-radius: 4px;
                    outline: 3px solid #ffcc00;
                    box-shadow: 0 4px 8px rgba(0,0,0,0.2);
                    z-index: 9999;
                }
            `}</style>
            
            <div className="layout-wrapper">
                <div className="layout-viewport">
                    <GCHeader lang={lang} onToggleLanguage={toggleLanguage} />

                    <div className="layout-main-area">
                        <Sidebar lang={lang} />
                        <div className="content layout-content-wrapper">
                            <div className="layout-page-content">
                                <div 
                                    id="main-content-container"
                                    className="layout-content-container"
                                    style={{
                                        paddingLeft: `${layoutPadding.left}px`,
                                        paddingRight: `${layoutPadding.right}px`,
                                        paddingTop: '20px',
                                        paddingBottom: '20px'
                                    }}
                                >
                                <Outlet context={{ lang, layoutPadding }} />

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
            {/* Screen Reader hears: "Previous section" */}
            {lang === 'en' ? 'Previous section' : 'Section précédente'}
        </Link>
    )}

    {nextPage && (
        <Link 
            to={nextPage.path} 
            className="sr-only-focusable"
        >
            {/* Screen Reader hears: "Next section" */}
            {lang === 'en' ? 'Next section' : 'Section suivante'}
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