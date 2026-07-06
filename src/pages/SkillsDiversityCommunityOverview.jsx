import React, { useEffect } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { getText } from '../utils/translations';
import skillsDiversityCommunityOverviewImage from '../assets/skills_diversity_community_overview_bg.jpg';

const SkillsDiversityCommunityOverview = () => {
    const { lang, layoutPadding } = useOutletContext();

    useEffect(() => {
    }, []);

    return (
        <main 
            id="main-content"
            tabIndex="-1"
            className="page-content page-39 skills-diversity-community-overview-main cover-page" 
            role="main"
            style={{
                backgroundColor: '#a8678f',
                flex: '1 1 auto',
                display: 'flex',
                flexDirection: 'column',
            }}
        >
            <style>{`

.skills-diversity-community-overview-main {
    width: 100%;
    margin: 0;
    padding: 0;
}

.skills-diversity-community-overview-container {
    width: 100%;
    min-height: calc(100vh - 295px);
    display: flex;
    flex-direction: column;
    flex: 1;
}

.skills-diversity-community-overview-image-title-wrapper {
    position: relative;
    width: 100%;
    min-height: 450px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
}

.skills-diversity-community-overview-title {
    position: relative;
    z-index: 2;
    width: 100%;
    padding: 0;
    background-color: transparent;
    box-sizing: border-box;
}

.skills-diversity-community-overview-title-box {
    background-color: rgba(255, 255, 255, 0.7); 
    padding: 20px ${layoutPadding?.right || 15}px 20px ${layoutPadding?.left || 55}px;
    width: 100%;
    box-sizing: border-box;
}

.skills-diversity-community-overview-list {
    width: 100%;
    background-color: #a0346e;
    padding: 42px ${layoutPadding?.right || 15}px 30px ${layoutPadding?.left || 55}px;
    box-sizing: border-box;
}

.skills-diversity-community-overview-title-text {
    font-family: 'Lato', sans-serif;
    font-size: 4.5rem;
    color: #221e1f;
    display: block;
    line-height: 1.15;
    text-shadow: 0px 0px 10px rgba(255, 255, 255, 0.5);
    text-align: left;
}

.skills-diversity-community-overview-list-item {
    margin-bottom: 8px;
    font-size: 2.2rem;
    text-align: left;
    color: #ebe8e1;
}

.skills-diversity-community-overview-list-item a {
    color: #ebe8e1;
    text-decoration: underline;
    transition: color 0.2s ease;
}

.skills-diversity-community-overview-list-item a:hover,
.skills-diversity-community-overview-list-item a:focus {
    color: #ffffff;
    text-decoration: underline;
}

.skills-diversity-community-overview-list-item a:focus {
    outline: 2px solid #ffffff;
    outline-offset: 2px;
}

@media (max-width: 1745px) { .skills-diversity-community-overview-title-text { font-size: 4.2rem; } }
@media (max-width: 1536px) { .skills-diversity-community-overview-title-text { font-size: 4.0rem; } }
@media (max-width: 1280px) { .skills-diversity-community-overview-title-text { font-size: 3.8rem; } }
@media (max-width: 1100px) { .skills-diversity-community-overview-title-text { font-size: 3.5rem; } }

@media (max-width: 960px) {
    .skills-diversity-community-overview-image-title-wrapper { min-height: 350px; }
    .skills-diversity-community-overview-title-text { font-size: 3.2rem; }
    .skills-diversity-community-overview-list-item { font-size: 1.7rem; }
}

@media (max-width: 640px) {
    .skills-diversity-community-overview-title-text { font-size: 2.5rem; }
    .skills-diversity-community-overview-list-item { font-size: 1.5rem; }
}

@media (max-width: 480px) {
    .skills-diversity-community-overview-image-title-wrapper { min-height: 250px; }
    .skills-diversity-community-overview-title-text { font-size: 2.0rem; }
    .skills-diversity-community-overview-list-item { font-size: 1.3rem; }
}

            `}</style>

            <div className="skills-diversity-community-overview-container">
                <div className="skills-diversity-community-overview-image-title-wrapper">
                    <img 
                        src={skillsDiversityCommunityOverviewImage} 
                        alt={getText('skills_diversity_community_overview_image_alt', lang)}
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            objectPosition: '50% 35%',
                            zIndex: 0
                        }} 
                    />
                    <div className="skills-diversity-community-overview-title">
                        <div className="skills-diversity-community-overview-title-box">
                            <h1 className="skills-diversity-community-overview-title-text">
                                <span style={{ fontWeight: 'normal' }}>{getText('skills_diversity_community_overview_section', lang)}</span>
                                <br />
                                <span style={{ fontWeight: 'bold' }}>{getText('skills_diversity_community_overview_title', lang)}</span>
                            </h1>
                        </div>
                    </div>
                </div>

                <nav className="skills-diversity-community-overview-list" aria-label={getText('skills_diversity_community_overview_nav_label', lang)}>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontFamily: "'Noto Sans', sans-serif" }}>
                        <li className="skills-diversity-community-overview-list-item">
                            <Link to="/section-3#energy-sector-demographics">
                                {getText('skills_diversity_community_overview_item1', lang)}
                            </Link>
                        </li>
                        <li className="skills-diversity-community-overview-list-item">
                            <Link to="/section-3#energy-affordability">{getText('skills_diversity_community_overview_item2', lang)}</Link>
                        </li>
                        <li className="skills-diversity-community-overview-list-item">
                            <Link to="/section-3#energy-reliant-communities">{getText('skills_diversity_community_overview_item3', lang)}</Link>
                        </li>
                    </ul>
                </nav>
            </div>
        </main>
    );
};

export default SkillsDiversityCommunityOverview;
