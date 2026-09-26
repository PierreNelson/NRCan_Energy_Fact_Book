import React from 'react';
import SafeHtml from './SafeHtml';
import { makeScrollToIdHandler } from '../utils/scrollToId';

/**
 * Derive the return-to-referrer hash from a footnote id.
 * fn-asterisk-energy-use → #fn-asterisk-rf-energy-use
 * fn-saudi-world-crude-… → #fn-saudi-rf-world-crude-…
 * fn1 → #fn1-rf
 */
function defaultFootnoteReturnHref(id) {
  if (!id) return '#';
  if (/^fn\d+$/i.test(id)) return `#${id}-rf`;
  const parts = String(id).split('-');
  if (parts[0] === 'fn' && parts.length >= 3) {
    return `#${parts[0]}-${parts[1]}-rf-${parts.slice(2).join('-')}`;
  }
  return `#${id}-rf`;
}

function scrollToHref(href) {
  return makeScrollToIdHandler(String(href || '').replace(/^#/, ''));
}

/**
 * Shared footnotes region (Canada.ca wb-fnote pattern).
 * Marker is a `.fn-num` return link at the start of each `<dd>` (not an underlined ↩).
 *
 * @param {{
 *   lang?: string,
 *   titleId?: string,
 *   heading?: string,
 *   className?: string,
 *   items: Array<{
 *     id: string,
 *     marker?: string,
 *     html?: string,
 *     text?: string,
 *     returnHref?: string,
 *     hideReturn?: boolean,
 *     hideMarker?: boolean,
 *     focusable?: boolean,
 *   }>,
 * }} props
 */
export default function PageFootnotes({
  lang = 'en',
  titleId = 'fn',
  heading,
  items = [],
  className = '',
}) {
  if (!items.length) return null;

  const title = heading || (lang === 'fr' ? 'Notes de bas de page' : 'Footnotes');

  return (
    <aside className={`wb-fnote ${className}`.trim()} role="note">
      <h2 id={titleId}>{title}</h2>
      <dl>
        {items.map((item, index) => {
          const hideMarker = Boolean(item.hideMarker) || item.marker === '';
          const marker = hideMarker ? '' : (item.marker || String(index + 1));
          const returnHref = item.hideReturn || hideMarker
            ? null
            : (item.returnHref || defaultFootnoteReturnHref(item.id));
          const returnTitle = lang === 'fr'
            ? `Retour à la référence de la note de bas de page ${marker}`
            : `Return to footnote ${marker} referrer`;
          const spoken = (item.text || '').trim()
            || (item.html ? String(item.html).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '');
          const dtLabel = hideMarker
            ? (lang === 'fr' ? 'Remarque' : 'Note')
            : (lang === 'fr' ? `Note de bas de page ${marker}` : `Footnote ${marker}`);

          return (
            <React.Fragment key={item.id || marker || index}>
              <dt className="wb-inv">{dtLabel}</dt>
              <dd
                id={item.id}
                {...(item.focusable
                  ? {
                      role: 'region',
                      tabIndex: 0,
                      'aria-label': spoken || dtLabel,
                    }
                  : {})}
              >
                {returnHref ? (
                  <a
                    href={returnHref}
                    className="fn-num"
                    onClick={scrollToHref(returnHref)}
                    title={returnTitle}
                  >
                    <span className="wb-inv">
                      {lang === 'fr' ? 'Retour à la note de bas de page ' : 'Return to footnote '}
                    </span>
                    {marker}
                  </a>
                ) : hideMarker ? null : (
                  <span className="fn-num" aria-hidden="true">{marker}</span>
                )}
                {item.html ? (
                  <SafeHtml html={item.html} as="p" />
                ) : (
                  <p>{item.text}</p>
                )}
              </dd>
            </React.Fragment>
          );
        })}
      </dl>
    </aside>
  );
}
