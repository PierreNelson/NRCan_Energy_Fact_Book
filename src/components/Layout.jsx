import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { Outlet, useLocation, Link, useSearchParams } from 'react-router-dom';
import Sidebar from './Sidebar';
import GCHeader from './GCHeader';
import GCFooter from './GCFooter';
import { focusRouteContent } from '../utils/focusRouteContent';

const LANG_STORAGE_KEY = 'efb-lang';

const readStoredLang = () => {
  try {
    return localStorage.getItem(LANG_STORAGE_KEY) === 'fr' ? 'fr' : 'en';
  } catch {
    return 'en';
  }
};

const Layout = ({ embed: embedProp = false }) => {
  const [searchParams] = useSearchParams();
  const embedFromQuery = searchParams.get('embed') === '1'
    || (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('embed') === '1');
  const embed = embedProp || embedFromQuery;

  const [lang, setLang] = useState(readStoredLang);
  const [alignedPadding, setAlignedPadding] = useState({ left: 55, right: 15 });
  const location = useLocation();
  const isFirstRender = useRef(true);
  const layoutPadding = embed ? { left: 24, right: 24 } : alignedPadding;

  const toggleLanguage = () => {
    setLang((prev) => {
      const next = prev === 'en' ? 'fr' : 'en';
      try {
        localStorage.setItem(LANG_STORAGE_KEY, next);
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  useEffect(() => {
    document.documentElement.lang = lang === 'fr' ? 'fr' : 'en';
    document.title = lang === 'fr'
      ? "Livre de faits sur l'énergie"
      : 'Energy Fact Book';
  }, [lang]);

  useLayoutEffect(() => {
    if (embed) {
      return undefined;
    }

    const updateAlignment = () => {
      const leftAnchor = document.getElementById('alignment-anchor-left');
      const rightAnchor = document.getElementById('alignment-anchor-right');
      const mainContainer = document.getElementById('main-content-container');

      if (leftAnchor && rightAnchor && mainContainer) {
        const leftRect = leftAnchor.getBoundingClientRect();
        const rightRect = rightAnchor.getBoundingClientRect();
        const containerRect = mainContainer.getBoundingClientRect();
        const newLeft = Math.max(0, leftRect.left - containerRect.left);
        const newRight = Math.max(0, containerRect.right - rightRect.right);
        setAlignedPadding({ left: newLeft, right: newRight });
      }
    };

    window.addEventListener('resize', updateAlignment);
    updateAlignment();
    const delayedUpdate = setTimeout(updateAlignment, 100);

    return () => {
      window.removeEventListener('resize', updateAlignment);
      clearTimeout(delayedUpdate);
    };
  }, [location.pathname, embed]);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return undefined;
    }

    let cancelFocus = () => {};
    const focusTimer = setTimeout(() => {
      window.scrollTo(0, 0);
      // Section changes: focus the first page heading in the new section.
      // Topic hash changes are handled in ActivePageSection.
      cancelFocus = focusRouteContent();
    }, 100);

    return () => {
      clearTimeout(focusTimer);
      cancelFocus();
    };
  }, [location.pathname]);

  const pages = [
    { path: '/section-1' },
    { path: '/section-2' },
    { path: '/section-3' },
    { path: '/section-4' },
    { path: '/section-5' },
    { path: '/section-6' },
  ];

  const normalizedPath = location.pathname === '/' ? '/section-1' : location.pathname;
  const currentIndex = pages.findIndex((p) => p.path === normalizedPath);
  const prevPage = currentIndex > 0 ? pages[currentIndex - 1] : null;
  const nextPage = currentIndex < pages.length - 1 ? pages[currentIndex + 1] : null;

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }

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

        .layout-content-container {
          width: 100%;
          max-width: 1140px;
          margin: 0 auto;
          text-align: left;
          position: relative;
          overflow: visible;
          box-sizing: border-box;
        }

        .layout-main {
          outline: none;
        }

        h1, h2, h3, h4, h5, h6 {
          text-align: left;
        }

        .employment-chart-chart-title,
        .gdp-chart-chart-title,
        .capital-expenditure-chart-title,
        .capital-expenditureh-chart-title,
        .environmental-protectionh-chart-title {
          text-align: center !important;
        }

        .section-nav {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          margin-top: 2rem;
          padding-top: 1rem;
          border-top: 1px solid #ccc;
          flex-wrap: wrap;
        }

        .section-nav-link {
          display: inline-block;
          padding: 10px 20px;
          background-color: var(--gc-link);
          color: var(--gc-background);
          font-weight: bold;
          text-decoration: none;
          border-radius: 4px;
        }

        .section-nav-link:visited {
          color: var(--gc-background);
        }

        .section-nav-link:hover,
        .section-nav-link:focus-visible {
          background-color: var(--gc-link-hover);
          outline: 3px solid #ffcc00;
          outline-offset: 2px;
        }

        .section-page-nav {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          margin: 1.5rem 0 0;
          padding: 1rem 0;
          border-top: 1px solid #e0e0e0;
          flex-wrap: wrap;
          background-color: var(--gc-background, #fff);
        }

        .section-page-nav-link {
          display: inline-block;
          padding: 10px 20px;
          background-color: var(--gc-link);
          color: var(--gc-background);
          font-weight: bold;
          text-decoration: none;
          border-radius: 4px;
        }

        .section-page-nav-link:visited {
          color: var(--gc-background);
        }

        .section-page-nav-link:hover,
        .section-page-nav-link:focus-visible {
          background-color: var(--gc-link-hover);
          outline: 3px solid #ffcc00;
          outline-offset: 2px;
        }

        .layout-embed .sidebar {
          display: none !important;
        }

        .skip-link {
          position: absolute;
          left: -9999px;
          top: 0;
          z-index: 10000;
          padding: 0.75rem 1rem;
          background: #000;
          color: #fff;
        }

        .skip-link:focus {
          left: 1rem;
          top: 1rem;
        }
      `}</style>

      <a className="skip-link" href="#main-content">
        {lang === 'fr' ? 'Passer au contenu principal' : 'Skip to main content'}
      </a>

      <div className={`layout-wrapper${embed ? ' layout-embed' : ''}`}>
        <div className="layout-viewport">
          {!embed && (
            <GCHeader lang={lang} onToggleLanguage={toggleLanguage} slimMegaMenu />
          )}

          <div className="layout-main-area">
            {!embed && <Sidebar lang={lang} />}
            <div className="content layout-content-wrapper">
              <div className="layout-page-content">
                <div
                  id="main-content-container"
                  className="layout-content-container"
                  style={{
                    paddingLeft: `${layoutPadding.left}px`,
                    paddingRight: `${layoutPadding.right}px`,
                    paddingTop: '20px',
                    paddingBottom: '20px',
                  }}
                >
                  <main id="main-content" className="layout-main" tabIndex={-1}>
                    <Outlet context={{ lang, layoutPadding, embed }} />
                  </main>

                  {!embed && (
                    <nav
                      className="section-nav"
                      aria-label={lang === 'fr' ? 'Navigation entre sections' : 'Section navigation'}
                    >
                      {prevPage ? (
                        <Link to={prevPage.path} className="section-nav-link">
                          {lang === 'en' ? 'Previous section' : 'Section précédente'}
                        </Link>
                      ) : (
                        <span />
                      )}
                      {nextPage ? (
                        <Link to={nextPage.path} className="section-nav-link">
                          {lang === 'en' ? 'Next section' : 'Section suivante'}
                        </Link>
                      ) : (
                        <span />
                      )}
                    </nav>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {!embed && <GCFooter lang={lang} />}
      </div>
    </>
  );
};

export default Layout;
