
import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { getText } from '../utils/translations';

const Sidebar = ({ lang }) => {
    // Start collapsed - user must expand to see contents
    const [section1Expanded, setSection1Expanded] = useState(false);
    const [section2Expanded, setSection2Expanded] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const toggleSection1 = () => {
        setSection1Expanded(!section1Expanded);
    };

    const toggleSection2 = () => {
        setSection2Expanded(!section2Expanded);
    };

    // Handle keyboard navigation - Space or Enter to toggle
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
            </div>
        </div>
        </>
    );
};

export default Sidebar;
