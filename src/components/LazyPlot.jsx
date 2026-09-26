import React, {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { observeChartAccessibility, observePlotlyModebarA11y } from '../utils/chartAccessibility';
import { mergePlotConfig, mergePlotLayout } from '../utils/plotlyInteractiveDefaults';
import { configStableKey, layoutStableKey } from '../utils/stablePlotProps';

const Plot = lazy(() => import('./plotlyComponent'));

function useStablePlotHandler(handler) {
  const handlerRef = useRef(handler);

  useLayoutEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  return useCallback((...args) => {
    handlerRef.current?.(...args);
  }, []);
}

function bindGraphDivHandlers(graphDiv, getHandlers) {
  if (!graphDiv?.on) return;

  const bindings = [
    ['plotly_click', 'onClick', '_lazyPlotClickHandler'],
    ['plotly_hover', 'onHover', '_lazyPlotHoverHandler'],
    ['plotly_unhover', 'onUnhover', '_lazyPlotUnhoverHandler'],
  ];

  bindings.forEach(([eventName, handlerKey, storageKey]) => {
    if (graphDiv[storageKey]) {
      graphDiv.removeListener(eventName, graphDiv[storageKey]);
      graphDiv[storageKey] = null;
    }
    const wrapped = (event) => {
      const handler = getHandlers()?.[handlerKey];
      if (typeof handler === 'function') {
        handler(event);
      }
    };
    graphDiv[storageKey] = wrapped;
    graphDiv.on(eventName, wrapped);
  });
}

/**
 * Loads Plotly when visible; applies chart a11y attributes when mounted.
 * Keeps layout/config references and event handlers stable to avoid Plotly.react
 * churn that can interrupt click-to-select interactions.
 */
export default function LazyPlot({
  ariaLabel,
  describedById,
  layout,
  config,
  onClick,
  onInitialized,
  onUpdate,
  onHover,
  onUnhover,
  style,
  ...props
}) {
  const hostRef = useRef(null);
  const plotHostRef = useRef(null);
  const interactionHandlersRef = useRef({});
  const [shouldLoad, setShouldLoad] = useState(
    () => typeof IntersectionObserver === 'undefined',
  );

  // Preserve parent-sized charts (pies in fixed frames). Only fall back to 400px
  // min-height when the caller did not specify a height — extra wrappers must not
  // collapse `height: '100%'` or force overflow past tuned containers.
  const resolvedStyle = style ?? {};
  const explicitHeight = resolvedStyle.height;
  const hostStyle = {
    width: resolvedStyle.width ?? '100%',
    ...(explicitHeight != null
      ? { height: explicitHeight, minHeight: explicitHeight }
      : { minHeight: resolvedStyle.minHeight ?? 400 }),
  };
  const innerStyle = {
    width: '100%',
    ...(explicitHeight != null ? { height: '100%' } : null),
  };

  const layoutKey = layoutStableKey(layout);
  const mergedLayout = useMemo(
    () => mergePlotLayout(layout),
    // layoutKey captures serializable layout content; layout object identity changes every render on many pages.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [layoutKey],
  );
  const configKey = configStableKey(config);
  const mergedConfig = useMemo(
    () => mergePlotConfig(config),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [configKey],
  );

  interactionHandlersRef.current = { onClick, onHover, onUnhover };

  const stableOnClick = useStablePlotHandler(onClick);
  const stableOnInitialized = useStablePlotHandler(onInitialized);
  const stableOnUpdate = useStablePlotHandler(onUpdate ?? onInitialized);
  const stableOnHover = useStablePlotHandler(onHover);
  const stableOnUnhover = useStablePlotHandler(onUnhover);

  const bindInteractions = useCallback((figure, graphDiv) => {
    bindGraphDivHandlers(graphDiv, () => interactionHandlersRef.current);
  }, []);

  const stablePlotReady = useCallback((figure, graphDiv) => {
    stableOnInitialized(figure, graphDiv);
    bindInteractions(figure, graphDiv);
  }, [stableOnInitialized, bindInteractions]);

  const stablePlotUpdate = useCallback((figure, graphDiv) => {
    stableOnUpdate(figure, graphDiv);
    bindInteractions(figure, graphDiv);
  }, [stableOnUpdate, bindInteractions]);

  const needsPlotReady = Boolean(onInitialized || onClick || onHover || onUnhover);
  const needsPlotUpdate = Boolean(onUpdate || needsPlotReady);

  useEffect(() => {
    const node = hostRef.current;
    if (!node || shouldLoad) return undefined;
    if (typeof IntersectionObserver === 'undefined') return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px 0px', threshold: 0.01 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [shouldLoad]);

  useEffect(() => {
    if (!shouldLoad || !ariaLabel) return undefined;
    return observeChartAccessibility(plotHostRef, {
      ariaLabel,
      describedById,
    });
  }, [shouldLoad, ariaLabel, describedById]);

  // PNG-only modebar: label the custom download control; hide any leftover built-ins.
  useEffect(() => {
    if (!shouldLoad) return undefined;
    return observePlotlyModebarA11y(plotHostRef);
  }, [shouldLoad, configKey]);

  const plotProps = {
    ...props,
    style: {
      ...resolvedStyle,
      width: resolvedStyle.width ?? '100%',
      ...(explicitHeight != null ? { height: explicitHeight } : null),
    },
    layout: mergedLayout,
    config: mergedConfig,
  };

  if (onClick) plotProps.onClick = stableOnClick;
  if (needsPlotReady) plotProps.onInitialized = stablePlotReady;
  if (needsPlotUpdate) plotProps.onUpdate = stablePlotUpdate;
  if (onHover) plotProps.onHover = stableOnHover;
  if (onUnhover) plotProps.onUnhover = stableOnUnhover;

  return (
    <div ref={hostRef} className="lazy-plot-host" style={hostStyle}>
      {shouldLoad ? (
        <div ref={plotHostRef} className="lazy-plot-inner" style={innerStyle}>
          <Suspense
            fallback={
              <div
                className="lazy-plot-fallback"
                style={{ width: '100%', ...innerStyle, ...(explicitHeight == null ? { minHeight: hostStyle.minHeight } : null) }}
                aria-busy="true"
                aria-label="Loading chart"
              />
            }
          >
            <Plot {...plotProps} />
          </Suspense>
        </div>
      ) : (
        <div
          className="lazy-plot-placeholder"
          style={{ width: '100%', ...innerStyle, ...(explicitHeight == null ? { minHeight: hostStyle.minHeight } : null) }}
          aria-hidden="true"
        />
      )}
    </div>
  );
}
