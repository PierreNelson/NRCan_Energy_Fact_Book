/**
 * Smooth-scroll to a footnote (or other in-page) target and move keyboard
 * focus to the corresponding control — the .fn-num / .fn-lnk button, not the
 * wrapping dd/span (those are not focusable, so Enter currently drops focus).
 */

function isFocusableControl(el) {
  if (!el || el.nodeType !== 1) return false;
  if (el.hasAttribute?.('disabled') || el.getAttribute?.('aria-disabled') === 'true') {
    return false;
  }
  const tag = el.tagName;
  if (tag === 'A' && el.hasAttribute('href')) return true;
  if (tag === 'BUTTON' || tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return true;
  const tab = el.getAttribute?.('tabindex');
  return tab != null && tab !== '' && Number(tab) >= 0;
}

export function resolveFocusTarget(el) {
  if (!el) return null;
  if (isFocusableControl(el)) return el;
  return (
    el.querySelector?.('a.fn-num, a.fn-lnk, button.fn-num, button.fn-lnk, a[href], button')
    || (isFocusableControl(el) ? el : null)
    || el
  );
}

/**
 * @param {string} id — element id without leading #
 * @param {ScrollIntoViewOptions} [options]
 */
export function scrollToId(id, options = { behavior: 'smooth', block: 'center' }) {
  if (!id) return;
  const el = document.getElementById(id);
  if (!el) return;

  const focusEl = resolveFocusTarget(el);
  el.scrollIntoView(options);

  const toFocus = isFocusableControl(focusEl) ? focusEl : el;
  if (typeof toFocus.focus !== 'function') return;

  const applyFocus = () => {
    try {
      if (toFocus.getAttribute?.('tabindex') == null
        && toFocus.tagName !== 'A'
        && toFocus.tagName !== 'BUTTON'
        && toFocus.tagName !== 'INPUT'
        && toFocus.tagName !== 'SELECT'
        && toFocus.tagName !== 'TEXTAREA') {
        toFocus.setAttribute('tabindex', '-1');
      }
      toFocus.focus({ preventScroll: true });
    } catch {
      // ignore non-focusable targets
    }
  };

  applyFocus();
  requestAnimationFrame(applyFocus);
}

/**
 * Click handler factory: preventDefault + scrollToId.
 * @param {string} id
 */
export function makeScrollToIdHandler(id) {
  return (event) => {
    event?.preventDefault?.();
    scrollToId(id);
  };
}
