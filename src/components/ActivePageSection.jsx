import React, { Suspense, useEffect, useMemo, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { findTopicIndexForHash, groupPagesIntoTopics } from '../utils/topicGroups';
import { prefetchAdjacentTopics, prefetchTopicPages } from '../utils/prefetchTopicPages';
import { focusRouteContent } from '../utils/focusRouteContent';

function scrollToHash(hash, maxAttempts = 30) {
  if (!hash) {
    window.scrollTo(0, 0);
    return;
  }

  let attempts = 0;
  const tryScroll = () => {
    const el = document.getElementById(hash);
    if (el) {
      el.scrollIntoView({ block: 'start' });
      return;
    }
    if (attempts++ < maxAttempts) {
      requestAnimationFrame(tryScroll);
    }
  };
  tryScroll();
}

/**
 * Mounts one topic (subsection) at a time within a section.
 * All pages in the active topic render in a stacked scroll; deep links use hashes.
 */
export default function ActivePageSection({
  sectionPath,
  pages,
  topicAnchors = [],
  lang = 'en',
}) {
  const location = useLocation();
  const hash = (location.hash || '').replace(/^#/, '');
  const isFirstRender = useRef(true);

  const topics = useMemo(
    () => groupPagesIntoTopics(pages, topicAnchors),
    [pages, topicAnchors],
  );

  const activeTopicIndex = useMemo(
    () => findTopicIndexForHash(topics, hash),
    [topics, hash],
  );

  const activeTopic = topics[activeTopicIndex];
  const prevTopic = activeTopicIndex > 0 ? topics[activeTopicIndex - 1] : null;
  const nextTopic = activeTopicIndex < topics.length - 1 ? topics[activeTopicIndex + 1] : null;

  useEffect(() => {
    scrollToHash(hash);

    // Initial load: do not steal focus from the browser / skip link.
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return undefined;
    }

    // After Previous/Next topic (or sidebar hash) navigation, move SR/keyboard
    // focus to the top of the newly shown content — not the bottom nav link.
    const focusHash = hash || activeTopic?.id || '';
    const timer = window.setTimeout(() => {
      focusRouteContent({ hash: focusHash });
    }, 50);

    return () => clearTimeout(timer);
  }, [activeTopic?.id, hash]);

  useEffect(() => {
    prefetchAdjacentTopics({ nextTopic, prevTopic });
  }, [activeTopicIndex, nextTopic, prevTopic]);

  if (!activeTopic) return null;

  return (
    <div className="stacked-section-container active-page-section">
      <div className="stacked-section-inner">
        {activeTopic.pages.map((page) => {
          const PageComponent = page.Component;
          const wrapperClass = [
            'stacked-page-wrapper',
            page.pageClassName,
          ].filter(Boolean).join(' ');

          return (
            <div key={page.id} id={page.id} className={wrapperClass}>
              <Suspense
                fallback={
                  <div className="active-page-loading" role="status" aria-live="polite">
                    {lang === 'fr' ? 'Chargement…' : 'Loading…'}
                  </div>
                }
              >
                <PageComponent />
              </Suspense>
            </div>
          );
        })}
      </div>

      <nav
        className="section-page-nav"
        aria-label={lang === 'fr' ? 'Sujets de la section' : 'Section topics'}
      >
        {prevTopic ? (
          <Link
            className="section-page-nav-link"
            to={`${sectionPath}#${prevTopic.id}`}
            onMouseEnter={() => prefetchTopicPages(prevTopic)}
            onFocus={() => prefetchTopicPages(prevTopic)}
          >
            {lang === 'fr' ? 'Sujet précédent' : 'Previous topic'}
          </Link>
        ) : (
          <span />
        )}
        {nextTopic ? (
          <Link
            className="section-page-nav-link"
            to={`${sectionPath}#${nextTopic.id}`}
            onMouseEnter={() => prefetchTopicPages(nextTopic)}
            onFocus={() => prefetchTopicPages(nextTopic)}
          >
            {lang === 'fr' ? 'Sujet suivant' : 'Next topic'}
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </div>
  );
}
