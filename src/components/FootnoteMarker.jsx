import React from 'react';
import { makeScrollToIdHandler } from '../utils/scrollToId';

/**
 * Canada.ca-style footnote superscript marker (.fn-lnk).
 *
 * @param {{
 *   href: string,
 *   id?: string,
 *   marker?: string,
 *   lang?: string,
 *   onClick?: (e: Event) => void,
 *   className?: string,
 * }} props
 */
export default function FootnoteMarker({
  href,
  id,
  marker = '*',
  lang = 'en',
  onClick,
  className = '',
}) {
  const targetId = String(href || '').replace(/^#/, '');
  const handleClick = onClick || (targetId ? makeScrollToIdHandler(targetId) : undefined);
  const inv = lang === 'fr' ? 'Note de bas de page ' : 'Footnote ';

  return (
    <span
      id={id}
      className={className}
      style={{ verticalAlign: 'super', fontSize: '0.75em', lineHeight: 0 }}
    >
      <a href={href} onClick={handleClick} className="fn-lnk">
        <span className="wb-inv">{inv}</span>
        {marker}
      </a>
    </span>
  );
}
