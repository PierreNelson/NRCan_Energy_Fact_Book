/**
 * Locale-aware number / percent formatters (en-CA / fr-CA).
 */

export function localeForLang(lang = 'en') {
  return lang === 'fr' ? 'fr-CA' : 'en-CA';
}

/**
 * @param {unknown} value
 * @param {string} [lang]
 * @param {Intl.NumberFormatOptions} [options]
 */
export function formatLocaleNumber(value, lang = 'en', options = {}) {
  if (value == null || value === '' || Number.isNaN(Number(value))) return '—';
  return Number(value).toLocaleString(localeForLang(lang), options);
}

/**
 * Format a percent value. Pass already-scaled percents (e.g. 12.5 for 12.5%).
 * @param {unknown} value
 * @param {string} [lang]
 * @param {Intl.NumberFormatOptions & { suffix?: boolean }} [options]
 */
export function formatLocalePct(value, lang = 'en', options = {}) {
  const { suffix = true, ...intlOpts } = options;
  if (value == null || value === '' || Number.isNaN(Number(value))) return '—';
  const formatted = Number(value).toLocaleString(localeForLang(lang), {
    maximumFractionDigits: 1,
    ...intlOpts,
  });
  return suffix ? `${formatted}%` : formatted;
}
