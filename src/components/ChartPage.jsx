import React from 'react';
import PageShell from './PageShell';
import LazyPlot from './LazyPlot';
import ChartDataTable from './ChartDataTable';
import PageFootnotes from './PageFootnotes';
import { layoutBleedCssVars } from '../hooks/useLayoutBleedStyle';

/**
 * Thin shell for standard single-chart Plotly pages.
 */
export default function ChartPage({
  lang = 'en',
  layoutPadding,
  className = '',
  pageClassName = '',
  titleId,
  title,
  subtitle,
  beforeChart = null,
  afterChart = null,
  plotProps,
  chartRef,
  table,
  footnotes,
  children,
  bleed = true,
}) {
  const bleedVars = layoutBleedCssVars(layoutPadding);

  return (
    <PageShell
      className={`page-content page-chrome ${bleed ? 'page-chrome--bleed' : ''} ${pageClassName} ${className}`.trim()}
      aria-labelledby={titleId}
      style={{ backgroundColor: '#ffffff', ...bleedVars }}
    >
      <div className="chart-page-inner" style={{ width: '100%', padding: '15px 0 40px 0', boxSizing: 'border-box' }}>
        {title && (
          <header>
            <h1
              id={titleId}
              style={{
                fontFamily: "'Lato', sans-serif",
                fontSize: 41,
                fontWeight: 'bold',
                color: 'var(--gc-text, #333)',
                marginTop: 0,
                marginBottom: subtitle ? 10 : 25,
                lineHeight: 1.25,
              }}
            >
              {title}
            </h1>
            {subtitle ? (
              <p style={{ fontFamily: "'Noto Sans', sans-serif", fontSize: 18, marginTop: 0, marginBottom: 25 }}>
                {subtitle}
              </p>
            ) : null}
          </header>
        )}

        {beforeChart}

        {plotProps ? (
          <div ref={chartRef} className="chart-page-plot">
            <LazyPlot {...plotProps} />
          </div>
        ) : null}

        {afterChart}

        {table ? <ChartDataTable lang={lang} {...table} /> : null}

        {footnotes?.items?.length ? (
          <PageFootnotes lang={lang} {...footnotes} />
        ) : null}

        {children}
      </div>
    </PageShell>
  );
}
