/**
 * Prefix id / url(#id) / href="#id" references in SVG markup so multiple
 * inlined copies (or EN/FR swaps) do not collide in the document.
 *
 * @param {string} markup
 * @param {string} prefix e.g. "ai-energy-trade-en"
 * @returns {string}
 */
export function prefixSvgIds(markup, prefix) {
  if (!markup || !prefix) return markup || '';
  const safe = String(prefix).replace(/[^a-zA-Z0-9_-]/g, '-');

  const ids = new Set();
  const idAttr = /\bid\s*=\s*(["'])([^"']+)\1/gi;
  let match;
  while ((match = idAttr.exec(markup)) !== null) {
    ids.add(match[2]);
  }
  if (ids.size === 0) return markup;

  // Longest ids first so "foo" does not break "foo-bar"
  const sorted = [...ids].sort((a, b) => b.length - a.length);
  let out = markup;
  for (const id of sorted) {
    const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const prefixed = `${safe}-${id}`;
    out = out.replace(new RegExp(`\\bid=(["'])${escaped}\\1`, 'g'), `id=$1${prefixed}$1`);
    out = out.replace(new RegExp(`url\\(#${escaped}\\)`, 'g'), `url(#${prefixed})`);
    out = out.replace(new RegExp(`(href|xlink:href)=(["'])#${escaped}\\2`, 'g'), `$1=$2#${prefixed}$2`);
  }
  return out;
}

/**
 * Prepare trusted asset SVG for accessible inlining: prefix ids, drop
 * aria-hidden that would hide text from AT, ensure root svg is focusable-friendly.
 *
 * @param {string} markup
 * @param {string} idPrefix
 * @returns {string}
 */
export function prepareInlineSvgMarkup(markup, idPrefix) {
  if (!markup) return '';
  let out = String(markup).trim();
  // Remove XML / doctype preambles that break HTML parsers
  out = out.replace(/<\?xml[\s\S]*?\?>/gi, '');
  out = out.replace(/<!DOCTYPE[\s\S]*?>/gi, '');
  out = prefixSvgIds(out, idPrefix);
  // Un-hide text layers that were marked decorative for <img> use
  out = out.replace(/\saria-hidden\s*=\s*(["'])true\1/gi, '');
  out = out.replace(/\saria-hidden\s*=\s*true\b/gi, '');
  return out;
}
