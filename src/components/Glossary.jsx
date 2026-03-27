import React from 'react';
import { useOutletContext } from 'react-router-dom';
import { getText } from '../utils/translations';

const Glossary = () => {
    const { lang } = useOutletContext();
    const glossaryHref =
        import.meta.env.VITE_GLOSSARY_HTML_URL ||
        `${import.meta.env.BASE_URL}glossary/data-gallery.html`;

    return (
        <main id="main-content" tabIndex="-1" className="page-content">
            <style>{`
                .glossary-landing {
                    max-width: 1140px;
                    margin: 0 auto;
                    padding: 20px;
                }
                .glossary-landing h1 {
                    font-family: 'Lato', sans-serif;
                    font-size: 32px;
                    font-weight: bold;
                    margin-bottom: 1rem;
                    color: var(--gc-accent, #26374a);
                }
                .glossary-landing p {
                    margin-bottom: 1.25rem;
                    max-width: 65ch;
                }
                .glossary-open-link {
                    display: inline-block;
                    margin: 0.5rem 0 1.25rem;
                    padding: 12px 24px;
                    font-size: 18px;
                    font-weight: 600;
                    font-family: 'Lato', sans-serif;
                    color: #fff;
                    background: #26374a;
                    border: 2px solid #26374a;
                    border-radius: 4px;
                    text-decoration: none;
                    cursor: pointer;
                }
                .glossary-open-link:hover,
                .glossary-open-link:focus {
                    background: #1a252f;
                    border-color: #1a252f;
                    color: #fff;
                }
                .glossary-secondary-note {
                    font-size: 16px;
                    color: #555;
                    max-width: 65ch;
                }
            `}</style>
            <div className="glossary-landing">
                <h1>{getText('glossary_page_title', lang)}</h1>
                <p>{getText('glossary_intro', lang)}</p>
                <a
                    className="glossary-open-link"
                    href={glossaryHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={getText('glossary_link_aria', lang)}
                >
                    {getText('glossary_link_label', lang)}
                </a>
                <p className="glossary-secondary-note">{getText('glossary_note', lang)}</p>
            </div>
        </main>
    );
};

export default Glossary;
