/**
 * Spoken chart summaries that enumerate all categories (years/bars),
 * matching pie-chart summaries that list every slice.
 */

/**
 * Reverse category order and each series' values together.
 * Used so multi-year bar charts are spoken newest year first.
 * @param {Array<string|number>} categories
 * @param {Array<{ values?: Array<unknown> }>} series
 */
function reverseCategories(categories, series) {
  const order = categories.map((_, i) => i).reverse();
  return {
    categories: order.map((i) => categories[i]),
    series: series.map((s) => ({
      ...s,
      values: order.map((i) => s.values?.[i]),
    })),
  };
}

/**
 * @param {object} options
 * @param {Array<string|number>} options.categories - x-axis labels (years, cities, …)
 * @param {Array<{ name: string, values: Array<number|string|null|undefined>, format?: (v: any) => string }>} options.series
 * @param {'en'|'fr'|string} [options.lang='en']
 * @param {boolean} [options.newestFirst] - Speak the last category first (multi-year bar charts)
 * @returns {string}
 */
export function summarizeByCategory({ categories, series, lang = 'en', newestFirst = false }) {
  if (!categories?.length || !series?.length) return '';

  const spoken = newestFirst ? reverseCategories(categories, series) : { categories, series };
  const inWord = lang === 'fr' || String(lang).startsWith('fr') ? 'En' : 'In';
  const sep = lang === 'fr' || String(lang).startsWith('fr') ? ' ; ' : '; ';

  return spoken.categories
    .map((cat, i) => {
      const parts = spoken.series
        .map((s) => {
          const raw = s.values?.[i];
          const formatted =
            typeof s.format === 'function' ? s.format(raw) : raw == null || raw === '' ? '—' : String(raw);
          return `${s.name}: ${formatted}`;
        })
        .join(sep);
      return `${inWord} ${cat}, ${parts}`;
    })
    .join('. ');
}

/**
 * Prefix + full enumeration + optional unit note.
 * @param {object} options
 * @param {string} options.intro - Chart type / range sentence (no trailing period required)
 * @param {string} options.body - From summarizeByCategory
 * @param {string} [options.unitNote] - e.g. "Values in billions of dollars."
 */
export function joinChartSummary({ intro, body, unitNote = '' }) {
  const parts = [];
  if (intro) parts.push(intro.replace(/\.\s*$/, ''));
  if (unitNote) parts.push(unitNote.replace(/\.\s*$/, ''));
  if (body) parts.push(body.replace(/\.\s*$/, ''));
  return `${parts.filter(Boolean).join('. ')}.`;
}
