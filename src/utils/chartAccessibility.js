/**
 * Shared Plotly chart accessibility helpers.
 * Prefer a focusable outer region/img with a full spoken summary; keep SVG decorative;
 * keep the download modebar button reachable and labeled.
 */

function resolveContainer(containerOrRef) {
  return containerOrRef?.current ?? containerOrRef ?? null;
}

/**
 * Sets role/aria on the Plotly plot root only (never a broad container).
 */
export function setupChartAccessibility(container, {
  ariaLabel,
  describedById,
} = {}) {
  if (!container) return;

  const plotRoot =
    container.querySelector?.('.js-plotly-plot') ||
    container.querySelector?.('.plotly') ||
    (container.classList?.contains('js-plotly-plot') || container.classList?.contains('plotly')
      ? container
      : null);

  if (!plotRoot) return;

  plotRoot.setAttribute('role', 'img');
  if (ariaLabel) {
    plotRoot.setAttribute('aria-label', ariaLabel);
  }
  if (describedById) {
    plotRoot.setAttribute('aria-describedby', describedById);
  }
}

/**
 * Observe DOM mutations until Plotly mounts, then apply a11y attributes.
 * Returns a cleanup function.
 */
export function observeChartAccessibility(containerRef, options = {}, delayMs = 500) {
  const run = () => {
    setupChartAccessibility(resolveContainer(containerRef), options);
  };

  const timer = setTimeout(run, delayMs);
  const target = resolveContainer(containerRef);
  let observer;
  if (target && typeof MutationObserver !== 'undefined') {
    observer = new MutationObserver(run);
    observer.observe(target, { childList: true, subtree: true });
  }

  return () => {
    clearTimeout(timer);
    observer?.disconnect();
  };
}

export function isDownloadModebarButton(btn) {
  if (!btn) return false;
  const title =
    btn.getAttribute('data-title') ||
    btn.getAttribute('aria-label') ||
    btn.getAttribute('title') ||
    '';
  return /download|t[eé]l[eé]charger/i.test(title);
}

/**
 * Hide decorative Plotly SVGs; label the PNG download control; hide other modebar buttons.
 * Do not wrap the Plot in aria-hidden — that also hides the download button from AT.
 */
export function setupPlotlyModebarA11y(container, { downloadLabel } = {}) {
  if (!container) return;

  container.querySelectorAll?.('.main-svg, .svg-container svg').forEach((svg) => {
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
  });

  // Keep Plotly's plot surface out of the tab order; the outer spoken region + download button are the stops.
  container.querySelectorAll?.('.js-plotly-plot, .plotly').forEach((plotRoot) => {
    if (!plotRoot.getAttribute('tabindex') || plotRoot.getAttribute('tabindex') === '0') {
      plotRoot.setAttribute('tabindex', '-1');
    }
  });
  container.querySelectorAll?.('.nsewdrag, .draglayer, .plotly-notifier').forEach((el) => {
    el.setAttribute('aria-hidden', 'true');
    el.setAttribute('tabindex', '-1');
  });

  const modebar = container.querySelector?.('.modebar');
  if (modebar) {
    modebar.removeAttribute('aria-hidden');
    modebar.querySelectorAll('[aria-hidden="true"]').forEach((el) => {
      if (el.classList?.contains('modebar-btn') && isDownloadModebarButton(el)) {
        el.removeAttribute('aria-hidden');
      }
    });
  }

  container.querySelectorAll?.('.modebar-btn').forEach((btn) => {
    if (isDownloadModebarButton(btn)) {
      const label =
        downloadLabel ||
        btn.getAttribute('data-title') ||
        btn.getAttribute('title') ||
        'Download chart as PNG';
      btn.setAttribute('aria-label', label);
      btn.setAttribute('title', label);
      btn.setAttribute('role', 'button');
      btn.setAttribute('tabindex', '0');
      btn.removeAttribute('aria-hidden');
      btn.style.removeProperty('display');
      btn.onkeydown = (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          btn.click();
        }
      };
    } else {
      // Fact Book modebar is PNG-download only — hide leftovers visually and from AT.
      btn.setAttribute('aria-hidden', 'true');
      btn.setAttribute('tabindex', '-1');
      btn.style.display = 'none';
    }
  });

  // Collapse empty modebar groups left behind after hiding built-ins.
  container.querySelectorAll?.('.modebar-group').forEach((group) => {
    const visible = [...(group.querySelectorAll?.('.modebar-btn') || [])].some(
      (btn) => btn.style.display !== 'none' && btn.getAttribute('aria-hidden') !== 'true',
    );
    if (!visible) {
      group.style.display = 'none';
      group.setAttribute('aria-hidden', 'true');
    } else {
      group.style.removeProperty('display');
      group.removeAttribute('aria-hidden');
    }
  });
}

/**
 * Re-apply modebar a11y whenever Plotly remounts/rebuilds the modebar.
 */
export function observePlotlyModebarA11y(containerRef, options = {}, delayMs = 300) {
  let debounceId = 0;
  const run = () => {
    window.clearTimeout(debounceId);
    debounceId = window.setTimeout(() => {
      setupPlotlyModebarA11y(resolveContainer(containerRef), options);
    }, 50);
  };

  const timer = setTimeout(run, delayMs);
  const target = resolveContainer(containerRef);
  let observer;
  if (target && typeof MutationObserver !== 'undefined') {
    observer = new MutationObserver(run);
    observer.observe(target, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-title', 'aria-hidden', 'class', 'tabindex'],
    });
  }

  return () => {
    clearTimeout(timer);
    window.clearTimeout(debounceId);
    observer?.disconnect();
  };
}
