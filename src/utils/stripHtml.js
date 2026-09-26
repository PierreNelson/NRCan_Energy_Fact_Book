/** Strip HTML tags and collapse whitespace (shared page helper). */
export function stripHtml(text) {
  return text ? String(text).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '';
}
