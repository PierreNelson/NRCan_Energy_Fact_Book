/**
 * After in-app navigation, move keyboard/SR focus to the top of the new content
 * so focus does not remain on the bottom topic/section nav links.
 */

function ensureFocusable(el) {
  if (!el) return null;
  if (el.tabIndex < 0 && !el.hasAttribute('tabindex')) {
    el.setAttribute('tabindex', '-1');
  }
  return el;
}

/**
 * Resolve the best focus target for the newly shown page/topic.
 * @param {{ hash?: string }} [options]
 * @returns {HTMLElement|null}
 */
export function resolveRouteFocusTarget({ hash = '' } = {}) {
  const cleanHash = String(hash || '').replace(/^#/, '');
  const hashEl = cleanHash ? document.getElementById(cleanHash) : null;
  const firstStacked = document.querySelector(
    '.active-page-section .stacked-page-wrapper',
  );
  const main = document.getElementById('main-content');
  const scope = hashEl || firstStacked || main;
  if (!scope) return null;

  const heading =
    (scope.matches?.('h1') ? scope : null) ||
    scope.querySelector?.('h1') ||
    null;
  if (heading) return ensureFocusable(heading);

  const article =
    (scope.matches?.('article') ? scope : null) ||
    scope.querySelector?.('article') ||
    null;
  if (article) return ensureFocusable(article);

  return ensureFocusable(scope === main ? main : scope) || ensureFocusable(main);
}

/**
 * Focus the top of the new route content, retrying while Suspense mounts.
 * @param {{ hash?: string, maxAttempts?: number, onFocused?: (el: HTMLElement) => void }} [options]
 * @returns {() => void} cancel function
 */
export function focusRouteContent({
  hash = '',
  maxAttempts = 40,
  onFocused,
} = {}) {
  let attempts = 0;
  let cancelled = false;
  let rafId = 0;

  const run = () => {
    if (cancelled) return;
    const target = resolveRouteFocusTarget({ hash });
    if (!target) {
      if (attempts++ < maxAttempts) {
        rafId = requestAnimationFrame(run);
      }
      return;
    }
    try {
      target.focus({ preventScroll: true });
      onFocused?.(target);
    } catch {
      /* ignore focus errors in jsdom / detached nodes */
    }
  };

  rafId = requestAnimationFrame(run);

  return () => {
    cancelled = true;
    cancelAnimationFrame(rafId);
  };
}
