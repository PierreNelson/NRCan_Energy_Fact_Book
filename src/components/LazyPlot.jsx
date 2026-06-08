import React, { lazy, Suspense } from 'react';

const Plot = lazy(() => import('react-plotly.js'));

export default function LazyPlot(props) {
    return (
        <Suspense fallback={
            <div
                className="lazy-plot-fallback"
                style={{ width: '100%', minHeight: props.style?.height ?? 400 }}
                aria-busy="true"
                aria-label="Loading chart"
            />
        }>
            <Plot {...props} />
        </Suspense>
    );
}
