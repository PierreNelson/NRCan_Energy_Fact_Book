/**
 * Shared Plotly interactive defaults for Fact Book charts.
 * Modebar must show only the custom "Download chart as PNG" control.
 */

export const DEFAULT_INTERACTIVE_LAYOUT = {
  dragmode: false,
  clickmode: 'event',
};

/** Built-in Plotly modebar buttons to strip — leave only custom modeBarButtonsToAdd. */
export const PLOTLY_MODEBAR_BUTTONS_TO_REMOVE = Object.freeze([
  'zoom2d',
  'pan2d',
  'select2d',
  'lasso2d',
  'zoomIn2d',
  'zoomOut2d',
  'autoScale2d',
  'resetScale2d',
  'toImage',
  'sendDataToCloud',
  'hoverClosestCartesian',
  'hoverCompareCartesian',
  'zoom3d',
  'pan3d',
  'orbitRotation',
  'tableRotation',
  'handleDrag3d',
  'resetCameraDefault3d',
  'resetCameraLastSave3d',
  'hoverClosest3d',
  'hoverClosestGeo',
  'hoverClosestGl2d',
  'hoverClosestPie',
  'toggleHover',
  'resetViews',
  'toggleSpikelines',
  'resetViewMapbox',
  'zoomInGeo',
  'zoomOutGeo',
  'resetGeo',
  'hoverClosestMapbox',
]);

export const DEFAULT_INTERACTIVE_CONFIG = {
  scrollZoom: false,
  doubleClick: false,
  displaylogo: false,
  responsive: true,
  modeBarButtonsToRemove: [...PLOTLY_MODEBAR_BUTTONS_TO_REMOVE],
};

export function mergePlotLayout(layout = {}) {
  return { ...DEFAULT_INTERACTIVE_LAYOUT, ...layout, dragmode: false };
}

/**
 * Merge page Plot config with Fact Book defaults.
 * Always unions modeBarButtonsToRemove so pages cannot accidentally leave zoom/pan/etc.
 */
export function mergePlotConfig(config = {}) {
  const pageRemove = Array.isArray(config.modeBarButtonsToRemove)
    ? config.modeBarButtonsToRemove
    : [];
  const modeBarButtonsToRemove = [
    ...new Set([...PLOTLY_MODEBAR_BUTTONS_TO_REMOVE, ...pageRemove]),
  ];

  return {
    ...DEFAULT_INTERACTIVE_CONFIG,
    ...config,
    displaylogo: config.displaylogo === true ? true : false,
    modeBarButtonsToRemove,
  };
}

/** Shared Plotly PNG icon path used by custom modebar download buttons. */
export const PLOTLY_PNG_DOWNLOAD_ICON = Object.freeze({
  width: 24,
  height: 24,
  path: 'M13 8V2H7v6H2l8 8 8-8h-5zM0 18h20v2H0v-2z',
});

export function getDownloadPngLabel(lang = 'en') {
  return lang === 'fr'
    ? 'Télécharger le graphique en PNG'
    : 'Download chart as PNG';
}

/**
 * Build a custom modebar "Download chart as PNG" button.
 * @param {{ name?: string, click: Function, title?: string, lang?: string }} options
 */
export function createPngModeBarButton({ name, click, title, lang } = {}) {
  const label = name || getDownloadPngLabel(lang);
  return {
    name: label,
    title: title || label,
    icon: PLOTLY_PNG_DOWNLOAD_ICON,
    click,
  };
}

/**
 * Build a Fact Book plot config: always-visible modebar with only the custom PNG button.
 * LazyPlot/mergePlotConfig already strips built-in buttons and applies scrollZoom/logo defaults —
 * do not re-list modeBarButtonsToRemove / displaylogo / responsive / scrollZoom here.
 *
 * @param {{ lang?: string, click: Function, name?: string, title?: string } & Record<string, unknown>} options
 */
export function buildPngOnlyPlotConfig({ lang, click, name, title, ...extra } = {}) {
  return {
    displayModeBar: true,
    modeBarButtonsToAdd: [
      createPngModeBarButton({ lang, click, name, title }),
    ],
    ...extra,
  };
}
