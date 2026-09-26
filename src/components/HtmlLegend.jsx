import React from 'react';

/**
 * Shared HTML chart legend (swatch or line markers).
 * Page-specific layout via className; keep aria-hidden when Plotly legend is spoken elsewhere.
 *
 * @param {{
 *   items: Array<{ label: string, color: string, dash?: boolean }>,
 *   variant?: 'swatch' | 'line',
 *   className?: string,
 *   itemClassName?: string,
 *   markerClassName?: string,
 *   labelClassName?: string,
 *   ariaHidden?: boolean,
 * }} props
 */
export default function HtmlLegend({
  items = [],
  variant = 'swatch',
  className = '',
  itemClassName = 'html-legend__item',
  markerClassName = 'html-legend__marker',
  labelClassName = 'html-legend__label',
  ariaHidden = true,
}) {
  if (!items.length) return null;

  return (
    <div
      className={`html-legend ${className}`.trim()}
      aria-hidden={ariaHidden ? 'true' : undefined}
    >
      {items.map((item) => (
        <div key={item.label} className={itemClassName}>
          {variant === 'line' ? (
            <span
              className={markerClassName}
              style={{
                display: 'inline-block',
                width: 28,
                height: 0,
                borderTop: item.dash ? '3px dashed' : '3px solid',
                borderColor: item.color,
              }}
            />
          ) : (
            <span
              className={markerClassName}
              style={{
                display: 'inline-block',
                width: 14,
                height: 14,
                backgroundColor: item.color,
                flexShrink: 0,
              }}
            />
          )}
          <span className={labelClassName}>{item.label}</span>
        </div>
      ))}
    </div>
  );
}
