import React from 'react';

const GCFooter = ({ lang }) => {
    // URLs are now explicitly defined for each language in link objects

    // NRCan contextual links
    const nrcanLinks = [
        { 
            en: { text: 'Contact NRCan', url: 'https://contact-contactez.nrcan-rncan.gc.ca/index.cfm?lang=eng&context=https%3A//admin.natural-resources.canada.ca/home' },
            fr: { text: 'Communiquez avec RNCan', url: 'https://contact-contactez.nrcan-rncan.gc.ca/index.cfm?lang=fra&context=https%3A//admin.ressources-naturelles.canada.ca/accueil' }
        },
        { 
            en: { text: 'News', url: 'https://www.canada.ca/en/news/advanced-news-search/news-results.html?typ=newsreleases&dprtmnt=naturalresourcescanada&mnstr=&start=&end=' },
            fr: { text: 'Nouvelles', url: 'https://www.canada.ca/fr/nouvelles/recherche-avancee-de-nouvelles/resultats-de-nouvelles.html?typ=newsreleases&dprtmnt=naturalresourcescanada&mnstr=&start=&end=' }
        },
        { 
            en: { text: 'Careers', url: 'https://natural-resources.canada.ca/science-and-data/science-and-research/research-centres/careers' },
            fr: { text: 'Carrières', url: 'https://ressources-naturelles.canada.ca/science-donnees/science-recherche/centre-recherche/carrieres' }
        }
    ];

    // Government of Canada footer links
    const govLinks = [
        { 
            en: { text: 'All Contacts', url: 'https://www.canada.ca/en/contact.html' },
            fr: { text: 'Toutes les coordonnées', url: 'https://www.canada.ca/fr/contact.html' }
        },
        { 
            en: { text: 'Departments and agencies', url: 'https://www.canada.ca/en/government/dept.html' },
            fr: { text: 'Ministères et organismes', url: 'https://www.canada.ca/fr/gouvernement/min.html' }
        },
        { 
            en: { text: 'About government', url: 'https://www.canada.ca/en/government/system.html' },
            fr: { text: 'À propos du gouvernement', url: 'https://www.canada.ca/fr/gouvernement/systeme.html' }
        }
    ];

    // Themes and topics links
    const themeLinks = [
        { 
            en: { text: 'Jobs', url: 'https://www.canada.ca/en/services/jobs.html' },
            fr: { text: 'Emplois', url: 'https://www.canada.ca/fr/services/emplois.html' }
        },
        { 
            en: { text: 'Taxes', url: 'https://www.canada.ca/en/services/taxes.html' },
            fr: { text: 'Impôts', url: 'https://www.canada.ca/fr/services/impots.html' }
        },
        { 
            en: { text: 'Canada and the world', url: 'https://www.international.gc.ca/world-monde/index.aspx?lang=eng' },
            fr: { text: 'Le Canada et le monde', url: 'https://www.international.gc.ca/world-monde/index.aspx?lang=fra' }
        },
        { 
            en: { text: 'Immigration and citizenship', url: 'https://www.canada.ca/en/services/immigration-citizenship.html' },
            fr: { text: 'Immigration et citoyenneté', url: 'https://www.canada.ca/fr/services/immigration-citoyennete.html' }
        },
        { 
            en: { text: 'Environment and natural resources', url: 'https://www.canada.ca/en/services/environment.html' },
            fr: { text: 'Environnement et ressources naturelles', url: 'https://www.canada.ca/fr/services/environnement.html' }
        },
        { 
            en: { text: 'Money and finance', url: 'https://www.canada.ca/en/services/finance.html' },
            fr: { text: 'Argent et finance', url: 'https://www.canada.ca/fr/services/finance.html' }
        },
        { 
            en: { text: 'Travel and tourism', url: 'https://travel.gc.ca/' },
            fr: { text: 'Voyage et tourisme', url: 'https://voyage.gc.ca/' }
        },
        { 
            en: { text: 'National security and defence', url: 'https://www.canada.ca/en/services/defence.html' },
            fr: { text: 'Sécurité nationale et défense', url: 'https://www.canada.ca/fr/services/defense.html' }
        },
        { 
            en: { text: 'Science and innovation', url: 'https://www.canada.ca/en/services/science.html' },
            fr: { text: 'Science et innovation', url: 'https://www.canada.ca/fr/services/science.html' }
        },
        { 
            en: { text: 'Business', url: 'https://www.canada.ca/en/services/business.html' },
            fr: { text: 'Entreprises', url: 'https://www.canada.ca/fr/services/entreprises.html' }
        },
        { 
            en: { text: 'Culture, history and sport', url: 'https://www.canada.ca/en/services/culture.html' },
            fr: { text: 'Culture, histoire et sport', url: 'https://www.canada.ca/fr/services/culture.html' }
        },
        { 
            en: { text: 'Indigenous Peoples', url: 'https://www.canada.ca/en/services/indigenous-peoples.html' },
            fr: { text: 'Autochtones', url: 'https://www.canada.ca/fr/services/autochtones.html' }
        },
        { 
            en: { text: 'Benefits', url: 'https://www.canada.ca/en/services/benefits.html' },
            fr: { text: 'Prestations', url: 'https://www.canada.ca/fr/services/prestations.html' }
        },
        { 
            en: { text: 'Policing, justice and emergencies', url: 'https://www.canada.ca/en/services/policing.html' },
            fr: { text: 'Services de police, justice et urgences', url: 'https://www.canada.ca/fr/services/police.html' }
        },
        { 
            en: { text: 'Veterans and military', url: 'https://www.canada.ca/en/services/veterans-military.html' },
            fr: { text: 'Vétérans et militaires', url: 'https://www.canada.ca/fr/services/veterans.html' }
        },
        { 
            en: { text: 'Health', url: 'https://www.canada.ca/en/services/health.html' },
            fr: { text: 'Santé', url: 'https://www.canada.ca/fr/services/sante.html' }
        },
        { 
            en: { text: 'Transport and infrastructure', url: 'https://www.canada.ca/en/services/transport.html' },
            fr: { text: 'Transport et infrastructure', url: 'https://www.canada.ca/fr/services/transport.html' }
        },
        { 
            en: { text: 'Youth', url: 'https://www.canada.ca/en/services/youth.html' },
            fr: { text: 'Jeunesse', url: 'https://www.canada.ca/fr/services/jeunesse.html' }
        }
    ];

    // Brand links
    const brandLinks = [
        { 
            en: { text: 'Social media', url: 'https://www.canada.ca/en/social.html' },
            fr: { text: 'Médias sociaux', url: 'https://www.canada.ca/fr/sociaux.html' }
        },
        { 
            en: { text: 'Mobile applications', url: 'https://www.canada.ca/en/mobile.html' },
            fr: { text: 'Applications mobiles', url: 'https://www.canada.ca/fr/mobile.html' }
        },
        { 
            en: { text: 'About Canada.ca', url: 'https://www.canada.ca/en/government/about.html' },
            fr: { text: 'À propos de Canada.ca', url: 'https://www.canada.ca/fr/gouvernement/a-propos.html' }
        },
        { 
            en: { text: 'Terms and conditions', url: 'https://natural-resources.canada.ca/terms-and-conditions' },
            fr: { text: 'Avis', url: 'https://ressources-naturelles.canada.ca/organisation/avis' }
        },
        { 
            en: { text: 'Privacy', url: 'https://www.canada.ca/en/transparency/privacy.html' },
            fr: { text: 'Confidentialité', url: 'https://www.canada.ca/fr/transparence/confidentialite.html' }
        }
    ];

    return (
        <footer id="wb-info" className="gc-footer" role="contentinfo">
            <style>{`
                .gc-footer {
                    background-color: var(--gc-accent);
                    color: white;
                    font-family: 'Noto Sans', sans-serif, Arial;
                    flex-shrink: 0;
                    margin-top: auto;
                    line-height: 1.5;
                }
                
                .gc-footer a {
                    color: white;
                    text-decoration: none;
                    white-space: nowrap;
                }
                
                .gc-footer a:hover {
                    text-decoration: underline;
                }
                
                .gc-footer a:focus-visible {
                    outline: 3px solid #ffbf47 !important;
                    outline-offset: 2px !important;
                }
                
                /* Landscape/Contextual band - NRCan section */
                .gc-footer-landscape {
                    background-color: #33465c;
                    padding: 20px 0;
                    border-bottom: none;
                }
                
                .gc-footer-landscape a {
                    color: white;
                    text-decoration: none;
                }
                
                .gc-footer-landscape a:hover {
                    text-decoration: underline;
                }
                
                .gc-footer-container {
                    max-width: 1140px;
                    margin: 0 auto;
                    padding: 0 20px;
                }
                
                /* Contextual Navigation Section (NRCan) */
                .gc-footer-contextual {
                    margin-bottom: 0;
                }
                
                .gc-footer-contextual h3 {
                    font-size: 1.2rem;
                    font-weight: 700;
                    margin: 0 0 12px 0;
                    color: white;
                }
                
                .gc-footer-contextual ul {
                    list-style: none;
                    padding: 0;
                    margin: 0;
                    display: grid;
                    grid-template-columns: repeat(3, 65px);
                    gap: 8px 315px;
                }
                
                .gc-footer-contextual li {
                    margin: 0;
                }
                
                .gc-footer-contextual a {
                    font-size: 14px;
                }
                
                /* Main footer section */
                .gc-footer-main {
                    background-color: var(--gc-accent);
                    background-image: url('https://www.canada.ca/etc/designs/canada/wet-boew/assets/landscape.png');
                    background-position: right bottom;
                    background-repeat: no-repeat;
                    background-size: auto 47%;
                    padding: 20px 0 30px;
                }
                
                .gc-footer-main a {
                    color: white;
                    text-decoration: none;
                }
                
                .gc-footer-main a:hover {
                    text-decoration: underline;
                }
                
                /* Government of Canada section */
                .gc-footer-gov {
                    margin-bottom: 20px;
                }
                
                .gc-footer-gov h3 {
                    font-size: 1.2rem;
                    font-weight: 700;
                    margin: 0 0 12px 0;
                    color: white;
                }
                
                .gc-footer-gov ul {
                    list-style: none;
                    padding: 0;
                    margin: 0;
                    display: grid;
                    grid-template-columns: repeat(3, 65px);
                    gap: 8px 315px;
                }
                
                .gc-footer-gov li {
                    margin: 0;
                }
                
                .gc-footer-gov a {
                    font-size: 14px;
                }
                
                /* Divider line */
                .gc-footer-divider {
                    border-top: 4px solid var(--gc-background);
                    margin-bottom: 25px;       
                    margin-top: 50px;
                    width: 40px;
                }
                
                /* Themes and topics section - 3 columns */
                .gc-footer-themes {
                    margin-top: 0;
                }
                
                .gc-footer-themes-list {
                    list-style: none;
                    padding: 0;
                    margin: 0;
                    display: grid;
                    grid-template-columns: repeat(3, 65px);
                    gap: 8px 315px;
                }
                
                .gc-footer-themes-list a {
                    font-size: 14px;
                }
                
                /* Brand bar - no silhouette background */
                .gc-footer-brand {
                    background-color: #f8f8f8;
                    border-top: none;
                    padding: 22px 0;
                    margin-top: 0;
                }
                
                .gc-footer-brand a {
                    color: #33465c;
                    text-decoration: none;
                }
                
                .gc-footer-brand a:hover {
                    color: var(--gc-link-hover);
                    text-decoration: none;
                }
                
                .gc-footer-brand-inner {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    flex-wrap: wrap;
                    gap: 15px;
                }
                
                .gc-footer-brand-links {
                    list-style: none;
                    padding: 0;
                    margin: 0;
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px 20px;
                }
                
                .gc-footer-brand-links li {
                    display: flex;
                    align-items: center;
                }
                
                .gc-footer-brand-links .brand-separator {
                    margin-left: 20px;
                    color: #33465c;
                }
                
                .gc-footer-brand-links a {
                    font-size: 0.9rem;
                    color: #33465c;
                }
                
                .gc-footer-brand-links a:hover {
                    color: var(--gc-link-hover);
                }
                
                .gc-footer-wordmark {
                    flex-shrink: 0;
                    margin-right: 0;
                }
                
                .gc-footer-wordmark img {
                    height: 40px;
                    width: auto;
                }
                
                .wb-inv {
                    clip: rect(1px, 1px, 1px, 1px);
                    height: 1px;
                    margin: 0;
                    overflow: hidden;
                    position: absolute;
                    width: 1px;
                }
                
                /* Responsive adjustments */
                @media (max-width: 991px) {
                    .gc-footer-contextual ul,
                    .gc-footer-gov ul,
                    .gc-footer-themes-list {
                        grid-template-columns: repeat(2, 1fr);
                    }
                    
                    .gc-footer-brand-inner {
                        flex-direction: column;
                        align-items: flex-start;
                    }
                    
                    .gc-footer-wordmark {
                        align-self: flex-end;
                    }
                }
                
                @media (max-width: 768px) {
                    .gc-footer-container {
                        padding: 0 20px 0 45px;
                    }

                    .gc-footer-contextual ul,
                    .gc-footer-gov ul {
                        grid-template-columns: 1fr 1fr;
                        gap: 8px 20px;
                    }
                    
                    .gc-footer-themes-list {
                        grid-template-columns: 1fr 1fr;
                        gap: 8px 20px;
                    }
                }
                
                @media (max-width: 480px) {
                    .gc-footer-container {
                        padding: 0 10px;
                    }

                    .gc-footer-contextual ul,
                    .gc-footer-gov ul,
                    .gc-footer-themes-list {
                        grid-template-columns: 1fr;
                    }
                    
                    .gc-footer-brand-links {
                        flex-direction: column;
                        gap: 8px;
                    }
                    
                    .gc-footer-brand-links .brand-separator {
                        display: none;
                    }
                }
            `}</style>

            {/* Contextual Band - NRCan */}
            <div className="gc-footer-landscape">
                <div className="gc-footer-container">
                    <nav className="gc-footer-contextual" aria-label={lang === 'en' ? 'Natural Resources Canada links' : 'Liens de Ressources naturelles Canada'}>
                        <h3 aria-hidden="true">
                            {lang === 'en' ? 'Natural Resources Canada' : 'Ressources naturelles Canada'}
                        </h3>
                        <ul role="presentation">
                            {nrcanLinks.map((link, index) => (
                                <li key={index} role="presentation">
                                    <a href={link[lang].url}>{link[lang].text}</a>
                                </li>
                            ))}
                        </ul>
                    </nav>
                </div>
            </div>

            {/* Main Footer */}
            <div className="gc-footer-main">
                <div className="gc-footer-container">
                    <nav aria-label={lang === 'en' ? 'Government of Canada footer links' : 'Liens de pied de page du gouvernement du Canada'}>
                        {/* Government of Canada section */}
                        <div className="gc-footer-gov">
                            <h3 aria-hidden="true">{lang === 'en' ? 'Government of Canada' : 'Gouvernement du Canada'}</h3>
                            <ul role="presentation">
                                {govLinks.map((link, index) => (
                                    <li key={index} role="presentation">
                                        <a href={link[lang].url}>{link[lang].text}</a>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Divider line */}
                        <div className="gc-footer-divider" aria-hidden="true"></div>

                        {/* Themes and topics */}
                        <div className="gc-footer-themes">
                            <ul className="gc-footer-themes-list" role="presentation">
                                {themeLinks.map((link, index) => (
                                    <li key={index} role="presentation">
                                        <a href={link[lang].url}>{link[lang].text}</a>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </nav>
                </div>
            </div>

            {/* Brand bar */}
            <div className="gc-footer-brand">
                <div className="gc-footer-container">
                    <div className="gc-footer-brand-inner">
                        <ul className="gc-footer-brand-links" role="presentation">
                            {brandLinks.map((link, index) => (
                                <li key={index} role="presentation">
                                    <a href={link[lang].url}>{link[lang].text}</a>
                                    {index < brandLinks.length - 1 && (
                                        <span className="brand-separator" aria-hidden="true">•</span>
                                    )}
                                </li>
                            ))}
                        </ul>
                        <a 
                            href={lang === 'en' ? 'https://www.canada.ca/en.html' : 'https://www.canada.ca/fr.html'}
                            className="gc-footer-wordmark"
                        >
                            <img 
                                src="https://www.canada.ca/etc/designs/canada/wet-boew/assets/wmms-blk.svg"
                                alt={lang === 'en' ? 'Symbol of the Government of Canada' : 'Symbole du gouvernement du Canada'}
                            />
                        </a>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default GCFooter;
