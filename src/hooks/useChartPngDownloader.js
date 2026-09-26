import { useCallback } from 'react';
import { downloadChartPng, resolvePlotElement } from '../utils/downloadChartPng';

/**
 * Stable Plotly PNG download callback. Reads chartRef only on click (lint-safe).
 *
 * @param {React.RefObject} chartRef
 * @param {object|(() => object)} optionsOrFactory - downloadChartPng options
 * @param {unknown[]} [deps] - extra useCallback deps when options are created inline
 */
export default function useChartPngDownloader(chartRef, optionsOrFactory, deps = []) {
  return useCallback((plotEl = null) => {
    const plotElement = resolvePlotElement(plotEl, chartRef);
    const options = typeof optionsOrFactory === 'function'
      ? optionsOrFactory(plotElement)
      : optionsOrFactory;
    return downloadChartPng(plotElement, options);
    // Caller supplies deps for options fields; chartRef identity is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
