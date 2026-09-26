import { useCallback, useRef, useState } from 'react';

/**
 * Shared Plotly multi-select with mobile double-tap gate.
 *
 * @param {'points'|'slices'} mode
 *   points — selection is number[][] keyed by curveNumber (bar/line)
 *   slices — selection is number[] of pie slice indices
 * @param {number} traceCount — length of number[][] when mode is 'points'
 * @param {number} [windowWidth] — when <= mobileBreakpoint, require double-tap
 */
export default function usePlotlySelection({
  mode = 'points',
  traceCount = 1,
  windowWidth = 1200,
  mobileBreakpoint = 768,
  doubleTapMs = 300,
} = {}) {
  const [selected, setSelected] = useState(null);
  const lastClickRef = useRef(
    mode === 'slices'
      ? { time: 0, index: null }
      : { time: 0, traceIndex: null, pointIndex: null },
  );

  const clear = useCallback(() => setSelected(null), []);

  const passesMobileGate = useCallback((key) => {
    if (windowWidth > mobileBreakpoint) return true;
    const now = Date.now();
    const last = lastClickRef.current;
    let isDoubleTap = false;
    if (mode === 'slices') {
      isDoubleTap = key.index === last.index && now - last.time < doubleTapMs;
      lastClickRef.current = { time: now, index: key.index };
    } else {
      isDoubleTap =
        key.traceIndex === last.traceIndex
        && key.pointIndex === last.pointIndex
        && now - last.time < doubleTapMs;
      lastClickRef.current = {
        time: now,
        traceIndex: key.traceIndex,
        pointIndex: key.pointIndex,
      };
    }
    return isDoubleTap;
  }, [windowWidth, mobileBreakpoint, doubleTapMs, mode]);

  const togglePoint = useCallback((traceIndex, pointIndex) => {
    if (traceIndex == null || traceIndex < 0 || pointIndex == null || pointIndex < 0) return;
    if (!passesMobileGate({ traceIndex, pointIndex })) return;

    setSelected((prev) => {
      if (prev === null) {
        const next = Array.from({ length: traceCount }, () => []);
        if (traceIndex >= next.length) return prev;
        next[traceIndex].push(pointIndex);
        return next;
      }
      const isOn = prev[traceIndex]?.includes(pointIndex);
      if (isOn) {
        const next = prev.map((pts, idx) =>
          idx === traceIndex ? pts.filter((p) => p !== pointIndex) : [...pts],
        );
        return next.every((arr) => arr.length === 0) ? null : next;
      }
      return prev.map((pts, idx) =>
        idx === traceIndex ? [...pts, pointIndex] : [...pts],
      );
    });
  }, [passesMobileGate, traceCount]);

  const toggleSlice = useCallback((sliceIndex) => {
    if (sliceIndex == null || sliceIndex < 0) return;
    if (!passesMobileGate({ index: sliceIndex })) return;

    setSelected((prev) => {
      if (prev === null) return [sliceIndex];
      if (prev.includes(sliceIndex)) {
        const next = prev.filter((i) => i !== sliceIndex);
        return next.length ? next : null;
      }
      return [...prev, sliceIndex];
    });
  }, [passesMobileGate]);

  const onPlotClick = useCallback((event) => {
    const pt = event?.points?.[0];
    if (!pt) return;
    if (mode === 'slices') {
      const idx = pt.pointNumber ?? pt.pointIndex;
      toggleSlice(idx);
      return;
    }
    togglePoint(pt.curveNumber, pt.pointIndex);
  }, [mode, togglePoint, toggleSlice]);

  const isSelected = useCallback((a, b) => {
    if (selected === null) return false;
    if (mode === 'slices') return selected.includes(a);
    return Boolean(selected[a]?.includes(b));
  }, [selected, mode]);

  const opacityFor = useCallback((a, b) => {
    if (selected === null) return 1;
    if (mode === 'slices') return selected.includes(a) ? 1 : 0.3;
    return selected[a]?.includes(b) ? 1 : 0.3;
  }, [selected, mode]);

  const hasSelection = selected !== null
    && (mode === 'slices'
      ? selected.length > 0
      : selected.some((arr) => arr.length > 0));

  return {
    selected,
    setSelected,
    clear,
    onPlotClick,
    togglePoint,
    toggleSlice,
    isSelected,
    opacityFor,
    hasSelection,
    lastClickRef,
  };
}
