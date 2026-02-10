
import React, { useState, useEffect, useRef } from 'react';
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
    const toggleButtonRef = useRef(null);
    const sidebarRef = useRef(null);

    // Handle toggle and maintain focus on the button
    const handleToggle = () => {
        setSidebarOpen(!sidebarOpen);
        // Refocus the button after state change
        setTimeout(() => {
            if (toggleButtonRef.current) {
                toggleButtonRef.current.focus();
            }
        }, 50);
    };

    // Close sidebar when keyboard focus leaves it
    const handleFocusOut = (event) => {
        // Check if the new focus target is outside the sidebar
        if (sidebarOpen && sidebarRef.current && !sidebarRef.current.contains(event.relatedTarget)) {
            setSidebarOpen(false);
        }
    };

    // Close sidebar when mouse leaves
    // At tablet/mobile (1366px and below), don't close on mouse leave - user must click button
    // At desktop (above 1366px), CSS hover handles everything, JS state not used
    const handleMouseLeave = (event) => {
        // Don't close on mouse leave - at desktop CSS handles it, at tablet user clicks button
        // This function is kept for potential future use but currently does nothing
    };

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
            const sidebar = sidebarRef.current;
            
            // Don't close if clicking inside sidebar (button is now inside)
            if (sidebarOpen && sidebar && !sidebar.contains(event.target)) {
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
                /* 300% zoom (640px) - larger button for easier touch */
                @media (max-width: 640px) {
                    .sidebar-toggle-closed {
                        width: 40px !important;
                        height: 55px !important;
                    }
                }
            `}</style>
            
            <div 
                id="sidebar-nav"
                ref={sidebarRef}
                className={`sidebar ${sidebarOpen ? 'sidebar-mobile-open' : ''}`} 
                role="navigation" 
                aria-label={getText('main_navigation', lang)}
                onBlur={handleFocusOut}
                onMouseLeave={handleMouseLeave}
            >
            {/* Visual indicator - hidden from screen readers */}
            <span className="sidebar-indicator" aria-hidden="true">☰</span>
            
            {/* Toggle button - INSIDE navigation so landmark is announced first */}
            <button
                ref={toggleButtonRef}
                className={`sidebar-toggle-btn ${sidebarOpen ? 'sidebar-toggle-open' : 'sidebar-toggle-closed'}`}
                onClick={handleToggle}
                aria-label={sidebarOpen 
                    ? (lang === 'en' ? 'Close navigation menu' : 'Fermer le menu de navigation')
                    : (lang === 'en' ? 'Open navigation menu' : 'Ouvrir le menu de navigation')
                }
                aria-expanded={sidebarOpen}
            >
                <span aria-hidden="true">☰</span>
            </button>
            
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
                                to="/section-1#energy-production"
                                className={({ isActive }) => `nav-link nav-sublink ${isActive ? 'active' : ''}`}
                            >
                                {getText('nav_energy_production', lang)}
                            </NavLink>
                            <NavLink
                                to="/section-1#economic-contributions"
                                className={({ isActive }) => `nav-link nav-sublink ${isActive ? 'active' : ''}`}
                            >
                                {getText('nav_econ_contributions', lang)}
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
                                {getText('page23_item1', lang)}
                            </NavLink>

                            {/* Energy infrastructure and major projects */}
                            <NavLink
                                to="/section-2#infrastructure-stock"
                                className={({ isActive }) => `nav-link nav-sublink ${isActive ? 'active' : ''}`}
                            >
                                {getText('page23_item2', lang)}
                            </NavLink>

                            {/* FDI and investment abroad */}
                            <NavLink
                                to="/section-2#international-investment"
                                className={({ isActive }) => `nav-link nav-sublink ${isActive ? 'active' : ''}`}
                            >
                                {getText('page23_item3', lang)}
                            </NavLink>

                            {/* Energy assets */}
                            <NavLink
                                to="/section-2#canadian-energy-assets"
                                className={({ isActive }) => `nav-link nav-sublink ${isActive ? 'active' : ''}`}
                            >
                                {getText('page23_item4', lang)}
                            </NavLink>

                            {/* Environmental Protection */}
                            <NavLink
                                to="/section-2#environmental-protection"
                                className={({ isActive }) => `nav-link nav-sublink ${isActive ? 'active' : ''}`}
                            >
                                {getText('page23_item6', lang)}
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
                            {/* Capital Expenditure - Page24Stacked */}
                            <NavLink
                                to="/section-test#capital-expenditure"
                                className={({ isActive }) => `nav-link nav-sublink ${isActive ? 'active' : ''}`}
                            >
                                {getText('page23_item1', lang)}
                            </NavLink>

                            {/* Energy infrastructure and major projects - Page25Stacked */}
                            <NavLink
                                to="/section-test#infrastructure-stock"
                                className={({ isActive }) => `nav-link nav-sublink ${isActive ? 'active' : ''}`}
                            >
                                {getText('page23_item2', lang)}
                            </NavLink>

                            {/* Major Projects - Page28Stacked */}
                            <NavLink
                                to="/section-test#major-projects"
                                className={({ isActive }) => `nav-link nav-sublink ${isActive ? 'active' : ''}`}
                            >
                                {getText('nav_major_projects', lang)}
                            </NavLink>

                            {/* Environmental Protection - Page37Stacked */}
                            <NavLink
                                to="/section-test#environmental-protection"
                                className={({ isActive }) => `nav-link nav-sublink ${isActive ? 'active' : ''}`}
                            >
                                {getText('page23_item6', lang)}
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
