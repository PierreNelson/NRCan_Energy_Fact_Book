import React from 'react';

/**
 * Shared page chrome: article landmark (Layout owns the single main).
 */
export default function PageShell({
  children,
  className = 'page-content',
  style,
  ...rest
}) {
  return (
    <article
      className={className}
      style={style}
      tabIndex={-1}
      {...rest}
    >
      {children}
    </article>
  );
}
