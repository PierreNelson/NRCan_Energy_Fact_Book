
import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { getText } from '../utils/translations';

const Sidebar = ({ lang }) => {
    // Start collapsed - user must expand to see contents
    const [section2Expanded, setSection2Expanded] = useState(false);

    const toggleSection2 = () => {
        setSection2Expanded(!section2Expanded);
    };

    // Handle keyboard navigation - Space or Enter to toggle
    const handleKeyDown = (e) => {
        if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            toggleSection2();
        }
    };

    return (
        <div className="sidebar" role="navigation" aria-label={lang === 'en' ? 'Main Navigation' : 'Navigation principale'}>
            <div className="sidebar-header">
                <span id="sidebar-title">{getText('table_of_contents', lang)}</span>
            </div>

            <div id="nav-links-container" className="nav-links">
                <div className="nav-section">
                    <button
                        className="nav-section-header"
                        onClick={toggleSection2}
                        onKeyDown={handleKeyDown}
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
                            {/* Investment (Home) */}
                            <NavLink
                                to="/"
                                className={({ isActive }) => `nav-link nav-sublink ${isActive ? 'active' : ''}`}
                            >
                                {getText('nav_section2_title', lang)}
                            </NavLink>

                            {/* Page 24 */}
                            <NavLink
                                to="/page-24"
                                className={({ isActive }) => `nav-link nav-sublink ${isActive ? 'active' : ''}`}
                            >
                                {getText('nav_capital_expenditure', lang)}
                            </NavLink>

                            {/* Page 25 */}
                            <NavLink
                                to="/page-25"
                                className={({ isActive }) => `nav-link nav-sublink ${isActive ? 'active' : ''}`}
                            >
                                {getText('nav_infrastructure', lang)}
                            </NavLink>

                            {/* Page 26 */}
                            <NavLink
                                to="/page-26"
                                className={({ isActive }) => `nav-link nav-sublink ${isActive ? 'active' : ''}`}
                            >
                                {getText('nav_economic_contributions', lang)}
                            </NavLink>

                            {/* Page 27 */}
                            <NavLink
                                to="/page-27"
                                className={({ isActive }) => `nav-link nav-sublink ${isActive ? 'active' : ''}`}
                            >
                                {getText('nav_investment_detail', lang)}
                            </NavLink>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Sidebar;
