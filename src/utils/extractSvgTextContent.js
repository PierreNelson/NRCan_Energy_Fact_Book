/**
 * Pull readable strings from trusted SVG markup (<text> blocks).
 * Used so screen readers get real infographic wording even when AT
 * support for inline SVG text nodes is incomplete.
 *
 * Each top-level <text> element becomes one phrase. The default join is
 * ". " so separate headings and list items get a pause. Pass a space when
 * the nodes are one sentence broken across lines.
 *
 * @param {string} markup
 * @param {{ separator?: string }} [options]
 * @returns {string}
 */
export function extractSvgTextContent(markup, { separator = '. ' } = {}) {
  if (!markup) return '';
  const parts = [];
  // Prefer whole <text> nodes (nested <tspan> folded in) so list items
  // stay as one spoken phrase each.
  const re = /<text\b[^>]*>([\s\S]*?)<\/text>/gi;
  let match;
  while ((match = re.exec(markup)) !== null) {
    const raw = match[1]
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
      .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
      .replace(/\s+/g, ' ')
      .trim();
    if (raw) parts.push(raw);
  }
  // Fallback: older SVGs / title-only markup
  if (parts.length === 0) {
    const loose = /<(?:tspan|title)\b[^>]*>([\s\S]*?)<\/(?:tspan|title)>/gi;
    while ((match = loose.exec(markup)) !== null) {
      const raw = match[1]
        .replace(/<[^>]+>/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/\s+/g, ' ')
        .trim();
      if (raw) parts.push(raw);
    }
  }
  const out = [];
  for (const p of parts) {
    if (out[out.length - 1] !== p) out.push(p);
  }
  return out.join(separator).replace(/\s+/g, ' ').replace(/\s+,/g, ',').replace(/\.\s*\./g, '.').trim();
}
