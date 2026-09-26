/**
 * Keyboard / screen-reader stops for page titles, intro prose, chart titles,
 * and footnote bodies.
 *
 * Static headings and paragraphs are in the a11y tree but not in Tab order.
 * Factbook SR testing (and many keyboard+SR users) Tab through content; without
 * stops, titles, intros, and footnotes are skipped between chrome and controls.
 *
 * This helper adds tabindex="0" only — it never sets aria-hidden on content.
 */

const MARK = 'data-prose-tab';

const INTRO_P_SELECTOR = [
  'p[class*="-subtitle"]',
  'p[class*="-narrative"]',
  'p[class*="-paragraph"]',
  'p[class*="-intro"]',
  'p[class*="-formula"]',
  'p[class*="-summary"]',
  '[class*="-body"] > p',
  'header > p',
].join(', ');

/** Page h2/h3 subtitles (e.g. Nominal GDP) — not covered by intro <p> selectors. */
const PAGE_SUBTITLE_SELECTOR = [
  'h2[class*="-subtitle"]',
  'h3[class*="-subtitle"]',
].join(', ');

const CHART_TITLE_SELECTOR = [
  'h2[class*="-chart-title"]',
  'h3[class*="-chart-title"]',
  'h4[class*="-chart-title"]',
  'h3[class*="-graphic-title"]',
].join(', ');

const FOOTNOTE_HEADING_SELECTOR = '.wb-fnote h2, [role="note"] h2';
const FOOTNOTE_BODY_SELECTOR = '.wb-fnote dd p, [role="note"] dd p';
/** Prefer ul.-bullets > li; also li.-bullet when the list itself has no -bullets class. */
const BULLET_SELECTOR = [
  'ul[class*="-bullets"] > li',
  'li[class*="-bullet"]',
].join(', ');

function isDecorativeExcluded(el) {
  if (!el) return true;
  if (el.classList?.contains('wb-inv')) return true;
  if (el.closest('details, table, .js-plotly-plot, [aria-hidden="true"]')) {
    return true;
  }
  return false;
}

function isFootnoteExcluded(el) {
  return Boolean(el?.closest('.wb-fnote, [role="note"]'));
}

export function markProseTabStop(el, options = {}) {
  const { allowFootnotes = false } = options;
  if (!el || isDecorativeExcluded(el)) return false;
  if (!allowFootnotes && isFootnoteExcluded(el)) return false;
  if (el.getAttribute(MARK) === '1') return true;
  el.setAttribute('tabindex', '0');
  el.setAttribute(MARK, '1');
  return true;
}

/**
 * Enhance one page article/root: h1, intro, chart titles, bullets, footnotes.
 */
export function enhancePageProse(root) {
  if (!root?.querySelectorAll) return;

  root.querySelectorAll('h1').forEach((h1) => {
    markProseTabStop(h1);
  });

  root.querySelectorAll(INTRO_P_SELECTOR).forEach((p) => {
    markProseTabStop(p);
  });

  root.querySelectorAll(PAGE_SUBTITLE_SELECTOR).forEach((h) => {
    markProseTabStop(h);
  });

  root.querySelectorAll(CHART_TITLE_SELECTOR).forEach((h) => {
    markProseTabStop(h);
  });

  root.querySelectorAll(BULLET_SELECTOR).forEach((li) => {
    markProseTabStop(li);
  });

  root.querySelectorAll(FOOTNOTE_HEADING_SELECTOR).forEach((h) => {
    markProseTabStop(h, { allowFootnotes: true });
  });

  root.querySelectorAll(FOOTNOTE_BODY_SELECTOR).forEach((p) => {
    markProseTabStop(p, { allowFootnotes: true });
  });
}

function enhanceInDocument(doc) {
  const wrappers = doc.querySelectorAll('.stacked-page-wrapper');
  if (wrappers.length) {
    wrappers.forEach((wrapper) => {
      const page =
        wrapper.querySelector(':scope > article, :scope > main') || wrapper;
      enhancePageProse(page);
    });
    return;
  }
  doc.querySelectorAll('article, main').forEach((el) => enhancePageProse(el));
}

/**
 * Install MutationObserver so lazy-loaded topic pages get stops after mount.
 */
export function enablePageProseKeyboardNav(doc = document) {
  if (typeof doc === 'undefined' || !doc.documentElement) {
    return () => {};
  }

  const run = () => enhanceInDocument(doc);
  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }

  let timer = null;
  let observer;
  if (typeof MutationObserver !== 'undefined') {
    observer = new MutationObserver(() => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        run();
      }, 200);
    });
    observer.observe(doc.documentElement, { childList: true, subtree: true });
  }

  return () => {
    observer?.disconnect();
    if (timer) clearTimeout(timer);
  };
}
