import React, { useId, useMemo, forwardRef, useImperativeHandle, useRef } from 'react';
import { prepareInlineSvgMarkup } from '../utils/prefixSvgIds';
import { extractSvgTextContent } from '../utils/extractSvgTextContent';

/**
 * Focusable infographic for screen readers.
 *
 * - mode="text": inline SVG (visual, aria-hidden) + extracted SVG wording in an
 *   AT-only text block. The full wording is part of the accessible name via
 *   aria-labelledby (title + body) so SRs read all copy on focus — not only a
 *   short aria-describedby blurb, which many engines truncate or skip.
 * - mode="image": informative graphic with overview aria-label, OR decorative
 *   (silent) when decorative={true}.
 *
 * @param {{
 *   mode: 'text' | 'image',
 *   title?: string,
 *   overview?: string,
 *   svgMarkup?: string,
 *   src?: string,
 *   decorative?: boolean,
 *   className?: string,
 *   imgClassName?: string,
 *   imgStyle?: React.CSSProperties,
 *   wrapperStyle?: React.CSSProperties,
 *   as?: 'div' | 'figure',
 *   children?: React.ReactNode,
 *   idPrefix?: string,
 *   label?: string,
 * }} props
 */
const AccessibleInfographic = forwardRef(function AccessibleInfographic(
  {
    mode = 'image',
    title,
    overview,
    label,
    svgMarkup,
    src,
    decorative = false,
    className = '',
    imgClassName = '',
    imgStyle,
    wrapperStyle,
    as = 'div',
    children = null,
    idPrefix,
  },
  ref,
) {
  const reactId = useId().replace(/:/g, '');
  const rootRef = useRef(null);
  const prefix = idPrefix || `ai-${reactId}`;
  const titleId = `${prefix}-title`;
  const textId = `${prefix}-text`;

  useImperativeHandle(ref, () => ({
    getGraphicElement() {
      const root = rootRef.current;
      if (!root) return null;
      if (mode === 'text') return root.querySelector('svg');
      return root.querySelector('img');
    },
    getRootElement() {
      return rootRef.current;
    },
  }), [mode]);

  const preparedSvg = useMemo(() => {
    if (mode !== 'text' || !svgMarkup) return '';
    return prepareInlineSvgMarkup(svgMarkup, prefix);
  }, [mode, svgMarkup, prefix]);

  const extractedText = useMemo(() => {
    if (mode !== 'text' || !svgMarkup) return '';
    return extractSvgTextContent(svgMarkup);
  }, [mode, svgMarkup]);

  const Tag = as === 'figure' ? 'figure' : 'div';
  const shortTitle = (title || '').trim() || 'Infographic';

  // Decorative: present visually only; AT skips entirely.
  if (mode === 'image' && decorative) {
    return (
      <Tag
        ref={rootRef}
        className={`accessible-infographic accessible-infographic--decorative ${className}`.trim()}
        style={wrapperStyle}
        aria-hidden="true"
      >
        <img
          src={src}
          alt=""
          className={imgClassName}
          style={imgStyle}
          draggable={false}
        />
        {children}
      </Tag>
    );
  }

  if (mode === 'text') {
    // A single label is one continuous name. Title plus extracted lines would
    // repeat a leading word and pause at every SVG text node.
    if ((label || '').trim()) {
      return (
        <Tag
          ref={rootRef}
          className={`accessible-infographic accessible-infographic--text ${className}`.trim()}
          role="region"
          tabIndex={0}
          aria-label={label.trim()}
          style={wrapperStyle}
        >
          <div
            className={`accessible-infographic-svg ${imgClassName}`.trim()}
            style={imgStyle}
            aria-hidden="true"
            dangerouslySetInnerHTML={{ __html: preparedSvg }}
          />
          {children}
        </Tag>
      );
    }
    // Include body text in the accessible name so focus announces the full
    // infographic wording (aria-describedby alone is often truncated/skipped).
    const labelIds = extractedText ? `${titleId} ${textId}` : titleId;
    return (
      <Tag
        ref={rootRef}
        className={`accessible-infographic accessible-infographic--text ${className}`.trim()}
        role="region"
        tabIndex={0}
        aria-labelledby={labelIds}
        style={wrapperStyle}
      >
        <span id={titleId} className="wb-inv">{shortTitle}</span>
        {extractedText ? (
          <p id={textId} className="wb-inv accessible-infographic-extracted-text">
            {extractedText}
          </p>
        ) : null}
        {/* Visual SVG hidden from AT — wording is in the extracted text block */}
        <div
          className={`accessible-infographic-svg ${imgClassName}`.trim()}
          style={imgStyle}
          aria-hidden="true"
          dangerouslySetInnerHTML={{ __html: preparedSvg }}
        />
        {children}
      </Tag>
    );
  }

  // Informative image: SR announces graphic + overview.
  const overviewText = (overview || title || '').trim() || 'Infographic';
  return (
    <Tag
      ref={rootRef}
      className={`accessible-infographic accessible-infographic--image ${className}`.trim()}
      role="img"
      tabIndex={0}
      aria-label={overviewText}
      style={wrapperStyle}
    >
      <img
        src={src}
        alt=""
        aria-hidden="true"
        className={imgClassName}
        style={imgStyle}
        draggable={false}
      />
      {children}
      {as === 'figure' ? (
        <figcaption className="wb-inv">{overviewText}</figcaption>
      ) : null}
    </Tag>
  );
});

export default AccessibleInfographic;
