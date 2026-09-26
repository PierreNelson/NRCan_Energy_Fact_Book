import DOMPurify from 'dompurify';

/**
 * Sanitize trusted repo/translation markup before injecting into the DOM.
 * Do not use for untrusted remote input — prefer plain text nodes instead.
 */
const ALLOWED_TAGS = [
  'b', 'strong', 'i', 'em', 'br', 'span', 'sup', 'sub', 'a', 'ul', 'ol', 'li', 'p',
];
const ALLOWED_ATTR = ['href', 'title', 'target', 'rel', 'class', 'aria-hidden'];

export function sanitizeHtml(html) {
  if (html == null || html === '') return '';
  return DOMPurify.sanitize(String(html), {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
  });
}
