
import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { getText } from '../utils/translations';

const Sidebar = ({ lang }) => {
    const [section1Expanded, setSection1Expanded] = useState(false);
    const [section2Expanded, setSection2Expanded] = useState(false);
    const [section3Expanded, setSection3Expanded] = useState(false);
    const [section4Expanded, setSection4Expanded] = useState(false);
    const [section5Expanded, setSection5Expanded] = useState(false);
    const [section6Expanded, setSection6Expanded] = useState(false);
    const [sectionTestExpanded, setSectionTestExpanded] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const toggleSection1 = () => {
        setSection1Expanded(!section1Expanded);
    };

    const toggleSection2 = () => {
        setSection2Expanded(!section2Expanded);
    };

    const toggleSection3 = () => {
        setSection3Expanded(!section3Expanded);
    };

    const toggleSection4 = () => {
        setSection4Expanded(!section4Expanded);
    };

    const toggleSection5 = () => {
        setSection5Expanded(!section5Expanded);
    };

    const toggleSection6 = () => {
        setSection6Expanded(!section6Expanded);
    };

    const toggleSectionTest = () => {
        setSectionTestExpanded(!sectionTestExpanded);
    };

    const handleKeyDown1 = (e) => {
        if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            toggleSection1();
        }
    };

    const handleKeyDown2 = (e) => {
        if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            toggleSection2();
        }
    };

    const handleKeyDown3 = (e) => {
        if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            toggleSection3();
        }
    };

    const handleKeyDown4 = (e) => {
        if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            toggleSection4();
        }
    };

    const handleKeyDown5 = (e) => {
        if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            toggleSection5();
        }
    };

    const handleKeyDown6 = (e) => {
        if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            toggleSection6();
        }
    };

    const handleKeyDownTest = (e) => {
        if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            toggleSectionTest();
        }
    };

    // Close sidebar when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            const sidebar = document.querySelector('.sidebar');
            const toggleBtn = document.querySelector('.sidebar-mobile-toggle');
            if (sidebarOpen && sidebar && !sidebar.contains(event.target) && 
                toggleBtn && !toggleBtn.contains(event.target)) {
                setSidebarOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('touchstart', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('touchstart', handleClickOutside);
        };
    }, [sidebarOpen]);

    return (
        <>
        <style>{`
                /* 250% zoom (768px) */
                @media (max-width: 768px) {
                    .sidebar {
                        width: 10px; 
                    }
                    .sidebar:hover, 
                    .sidebar.sidebar-mobile-open {
                        width: 300px !important; 
                    }
                }

                /* 300% zoom (640px) */
                @media (max-width: 640px) {
                    .sidebar {
                        width: 30px; 
                    }
                    .sidebar:hover, 
                    .sidebar.sidebar-mobile-open {
                        width: 300px !important; 
                    }
                }
                
                /* 400% - 500% zoom (480px) */
                @media (max-width: 480px) {
                    .sidebar-mobile-toggle {
                        width: 50px !important; 
                        margin-top: -45px !important;
                        height: 50px !important;
                        font-size: 1.5rem !important; 
                    }
                }
            `}</style>
            {/* Mobile toggle button - always visible */}
            <button
                className={`sidebar-mobile-toggle ${sidebarOpen ? 'open' : ''}`}
                onClick={() => setSidebarOpen(!sidebarOpen)}
                aria-label={sidebarOpen 
                    ? (lang === 'en' ? 'Close navigation menu' : 'Fermer le menu de navigation')
                    : (lang === 'en' ? 'Open navigation menu' : 'Ouvrir le menu de navigation')
                }
                aria-expanded={sidebarOpen}
            >
                <span aria-hidden="true">{sidebarOpen ? '✕' : '☰'}</span>
            </button>

            <div 
                className={`sidebar ${sidebarOpen ? 'sidebar-mobile-open' : ''}`} 
                role="navigation" 
                aria-label={getText('main_navigation', lang)}
            >
            <div className="sidebar-header">
                <span id="sidebar-title">{getText('table_of_contents', lang)}</span>
            </div>

            <div id="nav-links-container" className="nav-links">
                {/* Section 1 */}
                <div className="nav-section">
                    <button
                        className="nav-section-header"
                        onClick={toggleSection1}
                        onKeyDown={handleKeyDown1}
                        aria-expanded={section1Expanded}
                        aria-controls="section1-content"
                        aria-label={`${getText('nav_section1', lang)}. ${section1Expanded 
                            ? (lang === 'en' ? 'Expanded. Press Space to collapse.' : 'Développé. Appuyez sur Espace pour réduire.')
                            : (lang === 'en' ? 'Collapsed. Press Space to expand.' : 'Réduit. Appuyez sur Espace pour développer.')
                        }`}
                    >
                        <span className="section-arrow" aria-hidden="true">
                            {section1Expanded ? "▼" : "▶"}
                        </span>
                        <span>{getText('nav_section1', lang)}</span>
                    </button>

                    {/* Only render content when expanded - completely hidden from screen readers when collapsed */}
                    {section1Expanded && (
                        <div 
                            id="section1-content"
                            className="nav-section-content expanded"
                            role="group"
                            aria-label={getText('nav_section1', lang)}
                        >
                            <NavLink
                                to="/section-1#energy-overview"
                                className={({ isActive }) => `nav-link nav-sublink ${isActive ? 'active' : ''}`}
                            >
                                {getText('nav_section1_title', lang)}
                            </NavLink>
                            <NavLink
                                to="/section-1#economic-contributions"
                                className={({ isActive }) => `nav-link nav-sublink ${isActive ? 'active' : ''}`}
                            >
                                {getText('nav_econ_contributions', lang)}
                            </NavLink>
                            <NavLink
                                to="/section-1#provincial-gdp"
                                className={({ isActive }) => `nav-link nav-sublink ${isActive ? 'active' : ''}`}
                            >
                                {getText('nav_provincial_gdp', lang)}
                            </NavLink>
                        </div>
                    )}
                </div>

                {/* Section 2 */}
                <div className="nav-section">
                    <button
                        className="nav-section-header"
                        onClick={toggleSection2}
                        onKeyDown={handleKeyDown2}
                        aria-expanded={section2Expanded}
                        aria-controls="section2-content"
                        aria-label={`${getText('nav_section2', lang)}. ${section2Expanded 
                            ? (lang === 'en' ? 'Expanded. Press Space to collapse.' : 'Développé. Appuyez sur Espace pour réduire.')
                            : (lang === 'en' ? 'Collapsed. Press Space to expand.' : 'Réduit. Appuyez sur Espace pour développer.')
                        }`}
                    >
                        <span className="section-arrow" aria-hidden="true">
                            {section2Expanded ? "▼" : "▶"}
                        </span>
                        <span>{getText('nav_section2', lang)}</span>
                    </button>

                    {/* Only render content when expanded - completely hidden from screen readers when collapsed */}
                    {section2Expanded && (
                        <div 
                            id="section2-content"
                            className="nav-section-content expanded"
                            role="group"
                            aria-label={getText('nav_section2', lang)}
                        >
                            {/* Investment Overview */}
                            <NavLink
                                to="/section-2#investment-overview"
                                className={({ isActive }) => `nav-link nav-sublink ${isActive ? 'active' : ''}`}
                            >
                                {getText('nav_section2_title', lang)}
                            </NavLink>

                            {/* Capital Expenditure */}
                            <NavLink
                                to="/section-2#capital-expenditure"
                                className={({ isActive }) => `nav-link nav-sublink ${isActive ? 'active' : ''}`}
                            >
                                {getText('nav_capital_expenditure', lang)}
                            </NavLink>

                            {/* Infrastructure Stock */}
                            <NavLink
                                to="/section-2#infrastructure-stock"
                                className={({ isActive }) => `nav-link nav-sublink ${isActive ? 'active' : ''}`}
                            >
                                {getText('nav_infrastructure', lang)}
                            </NavLink>

                            {/* Economic Contributions */}
                            <NavLink
                                to="/section-2#economic-contributions"
                                className={({ isActive }) => `nav-link nav-sublink ${isActive ? 'active' : ''}`}
                            >
                                {getText('nav_economic_contributions', lang)}
                            </NavLink>

                            {/* Investment by Asset */}
                            <NavLink
                                to="/section-2#investment-by-asset"
                                className={({ isActive }) => `nav-link nav-sublink ${isActive ? 'active' : ''}`}
                            >
                                {getText('nav_investment_detail', lang)}
                            </NavLink>

                            {/* Major Projects */}
                            <NavLink
                                to="/section-2#major-projects"
                                className={({ isActive }) => `nav-link nav-sublink ${isActive ? 'active' : ''}`}
                            >
                                {getText('nav_major_projects', lang)}
                            </NavLink>

                            {/* Clean Tech Trends */}
                            <NavLink
                                to="/section-2#clean-tech-trends"
                                className={({ isActive }) => `nav-link nav-sublink ${isActive ? 'active' : ''}`}
                            >
                                {getText('nav_clean_tech_trends', lang)}
                            </NavLink>

                            <NavLink
                                to="/section-2#projects-map"
                                className={({ isActive }) => `nav-link nav-sublink ${isActive ? 'active' : ''}`}
                            >
                                {getText('nav_projects_map', lang)}
                            </NavLink>

                            {/* International Investment */}
                            <NavLink
                                to="/section-2#international-investment"
                                className={({ isActive }) => `nav-link nav-sublink ${isActive ? 'active' : ''}`}
                            >
                                {getText('nav_international_investment', lang)}
                            </NavLink>

                            {/* Foreign Control */}
                            <NavLink
                                to="/section-2#foreign-control"
                                className={({ isActive }) => `nav-link nav-sublink ${isActive ? 'active' : ''}`}
                            >
                                {getText('nav_fdi_stock', lang)}
                            </NavLink>

                            {/* Environmental Protection */}
                            <NavLink
                                to="/section-2#environmental-protection"
                                className={({ isActive }) => `nav-link nav-sublink ${isActive ? 'active' : ''}`}
                            >
                                {getText('nav_environmental_protection', lang)}
                            </NavLink>
                        </div>
                    )}
                </div>

                {/* Section 3 */}
                <div className="nav-section">
                    <button
                        className="nav-section-header"
                        onClick={toggleSection3}
                        onKeyDown={handleKeyDown3}
                        aria-expanded={section3Expanded}
                        aria-controls="section3-content"
                        aria-label={`${getText('nav_section3', lang)}. ${section3Expanded 
                            ? (lang === 'en' ? 'Expanded. Press Space to collapse.' : 'Développé. Appuyez sur Espace pour réduire.')
                            : (lang === 'en' ? 'Collapsed. Press Space to expand.' : 'Réduit. Appuyez sur Espace pour développer.')
                        }`}
                    >
                        <span className="section-arrow" aria-hidden="true">
                            {section3Expanded ? "▼" : "▶"}
                        </span>
                        <span>{getText('nav_section3', lang)}</span>
                    </button>

                    {section3Expanded && (
                        <div 
                            id="section3-content"
                            className="nav-section-content expanded"
                            role="group"
                            aria-label={getText('nav_section3', lang)}
                        >
                            <NavLink
                                to="/section-3#skills-diversity-community-overview"
                                className={({ isActive }) => `nav-link nav-sublink ${isActive ? 'active' : ''}`}
                            >
                                {getText('nav_section3_title', lang)}
                            </NavLink>
                        </div>
                    )}
                </div>

                {/* Section 4 */}
                <div className="nav-section">
                    <button
                        className="nav-section-header"
                        onClick={toggleSection4}
                        onKeyDown={handleKeyDown4}
                        aria-expanded={section4Expanded}
                        aria-controls="section4-content"
                        aria-label={`${getText('nav_section4', lang)}. ${section4Expanded 
                            ? (lang === 'en' ? 'Expanded. Press Space to collapse.' : 'Développé. Appuyez sur Espace pour réduire.')
                            : (lang === 'en' ? 'Collapsed. Press Space to expand.' : 'Réduit. Appuyez sur Espace pour développer.')
                        }`}
                    >
                        <span className="section-arrow" aria-hidden="true">
                            {section4Expanded ? "▼" : "▶"}
                        </span>
                        <span>{getText('nav_section4', lang)}</span>
                    </button>

                    {section4Expanded && (
                        <div 
                            id="section4-content"
                            className="nav-section-content expanded"
                            role="group"
                            aria-label={getText('nav_section4', lang)}
                        >
                            <NavLink
                                to="/section-4#energy-efficiency-overview"
                                className={({ isActive }) => `nav-link nav-sublink ${isActive ? 'active' : ''}`}
                            >
                                {getText('nav_section4_title', lang)}
                            </NavLink>
                        </div>
                    )}
                </div>

                {/* Section 5 */}
                <div className="nav-section">
                    <button
                        className="nav-section-header"
                        onClick={toggleSection5}
                        onKeyDown={handleKeyDown5}
                        aria-expanded={section5Expanded}
                        aria-controls="section5-content"
                        aria-label={`${getText('nav_section5', lang)}. ${section5Expanded 
                            ? (lang === 'en' ? 'Expanded. Press Space to collapse.' : 'Développé. Appuyez sur Espace pour réduire.')
                            : (lang === 'en' ? 'Collapsed. Press Space to expand.' : 'Réduit. Appuyez sur Espace pour développer.')
                        }`}
                    >
                        <span className="section-arrow" aria-hidden="true">
                            {section5Expanded ? "▼" : "▶"}
                        </span>
                        <span>{getText('nav_section5', lang)}</span>
                    </button>

                    {section5Expanded && (
                        <div 
                            id="section5-content"
                            className="nav-section-content expanded"
                            role="group"
                            aria-label={getText('nav_section5', lang)}
                        >
                            <NavLink
                                to="/section-5#clean-power-low-carbon-overview"
                                className={({ isActive }) => `nav-link nav-sublink ${isActive ? 'active' : ''}`}
                            >
                                {getText('nav_section5_title', lang)}
                            </NavLink>
                        </div>
                    )}
                </div>

                {/* Section 6 */}
                <div className="nav-section">
                    <button
                        className="nav-section-header"
                        onClick={toggleSection6}
                        onKeyDown={handleKeyDown6}
                        aria-expanded={section6Expanded}
                        aria-controls="section6-content"
                        aria-label={`${getText('nav_section6', lang)}. ${section6Expanded 
                            ? (lang === 'en' ? 'Expanded. Press Space to collapse.' : 'Développé. Appuyez sur Espace pour réduire.')
                            : (lang === 'en' ? 'Collapsed. Press Space to expand.' : 'Réduit. Appuyez sur Espace pour développer.')
                        }`}
                    >
                        <span className="section-arrow" aria-hidden="true">
                            {section6Expanded ? "▼" : "▶"}
                        </span>
                        <span>{getText('nav_section6', lang)}</span>
                    </button>

                    {section6Expanded && (
                        <div 
                            id="section6-content"
                            className="nav-section-content expanded"
                            role="group"
                            aria-label={getText('nav_section6', lang)}
                        >
                            <NavLink
                                to="/section-6#oil-gas-coal-overview"
                                className={({ isActive }) => `nav-link nav-sublink ${isActive ? 'active' : ''}`}
                            >
                                {getText('nav_section6_title', lang)}
                            </NavLink>
                        </div>
                    )}
                </div>

                {/* Test Pages Section */}
                <div className="nav-section">
                    <button
                        className="nav-section-header"
                        onClick={toggleSectionTest}
                        onKeyDown={handleKeyDownTest}
                        aria-expanded={sectionTestExpanded}
                        aria-controls="sectiontest-content"
                        aria-label={`${lang === 'en' ? 'Test Pages' : 'Pages de test'}. ${sectionTestExpanded 
                            ? (lang === 'en' ? 'Expanded. Press Space to collapse.' : 'Développé. Appuyez sur Espace pour réduire.')
                            : (lang === 'en' ? 'Collapsed. Press Space to expand.' : 'Réduit. Appuyez sur Espace pour développer.')
                        }`}
                    >
                        <span className="section-arrow" aria-hidden="true">
                            {sectionTestExpanded ? "▼" : "▶"}
                        </span>
                        <span>{lang === 'en' ? 'Test Pages' : 'Pages de test'}</span>
                    </button>

                    {sectionTestExpanded && (
                        <div 
                            id="sectiontest-content"
                            className="nav-section-content expanded"
                            role="group"
                            aria-label={lang === 'en' ? 'Test Pages' : 'Pages de test'}
                        >
                            <NavLink
                                to="/section-test#test-page24"
                                className={({ isActive }) => `nav-link nav-sublink ${isActive ? 'active' : ''}`}
                            >
                                {lang === 'en' ? 'Page 24 (Stacked)' : 'Page 24 (Empilée)'}
                            </NavLink>
                            <NavLink
                                to="/section-test#test-page25"
                                className={({ isActive }) => `nav-link nav-sublink ${isActive ? 'active' : ''}`}
                            >
                                {lang === 'en' ? 'Page 25 (Stacked)' : 'Page 25 (Empilée)'}
                            </NavLink>
                            <NavLink
                                to="/section-test#test-page28"
                                className={({ isActive }) => `nav-link nav-sublink ${isActive ? 'active' : ''}`}
                            >
                                {lang === 'en' ? 'Page 28 (Horizontal)' : 'Page 28 (Horizontal)'}
                            </NavLink>
                            <NavLink
                                to="/section-test#test-page37"
                                className={({ isActive }) => `nav-link nav-sublink ${isActive ? 'active' : ''}`}
                            >
                                {lang === 'en' ? 'Page 37 (Stacked)' : 'Page 37 (Empilée)'}
                            </NavLink>
                        </div>
                    )}
                </div>
            </div>
        </div>
        </>
    );
};

export default Sidebar;
