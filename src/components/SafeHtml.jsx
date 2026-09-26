import React from 'react';
import { sanitizeHtml } from '../utils/sanitizeHtml';

/**
 * Renders allowlisted HTML from trusted translation/repo strings only.
 * Never pass untrusted remote content here.
 */
export default function SafeHtml({ html, as = 'span', className, ...rest }) {
  return React.createElement(as, {
    className,
    dangerouslySetInnerHTML: { __html: sanitizeHtml(html) },
    ...rest,
  });
}
