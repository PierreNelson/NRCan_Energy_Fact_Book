/**
 * Chart data table keyboard / screen reader navigation.
 *
 * Tab order:
 *   1. Table title (visible heading or caption) — focus styles the title
 *   2. Each body cell — e.g. "Crude oil production, 4" or "Canada, 2023, Natural gas, 4,884"
 *   3. Controls after the table
 *
 * Column names are spoken with each cell. There is no separate header-row stop
 * between the chart-data-table button and the first cell.
 */

function headerText(el) {
  return (el?.textContent || '').replace(/\s+/g, ' ').trim();
}

/** Title text that is actually in the accessibility tree (not aria-hidden). */
function exposedTitleText(el) {
  if (!el?.cloneNode) return '';
  const clone = el.cloneNode(true);
  clone.querySelectorAll('[aria-hidden="true"], .wb-inv').forEach((node) => node.remove());
  return (clone.textContent || '').replace(/\s+/g, ' ').trim();
}

function isFrenchDoc() {
  const lang = (document.documentElement?.lang || '').toLowerCase();
  return lang.startsWith('fr');
}

/** Expand Res./Prod./Exp. (and FR) to full metric words. */
export function expandMetricAbbrev(text) {
  const t = (text || '').trim();
  const lower = t.toLowerCase().replace(/\.$/, '');
  const fr = isFrenchDoc();
  if (lower === 'res' || lower === 'rés') {
    return fr ? 'réserves' : 'reserves';
  }
  if (lower === 'prod') {
    return fr ? 'production' : 'production';
  }
  if (lower === 'exp') {
    return fr ? 'exportations' : 'exports';
  }
  if (lower === 'prov') {
    return 'Province';
  }
  // Full static-table headers → metric word for cell phrases
  if (/reserve|réserve/i.test(t)) {
    return fr ? 'réserves' : 'reserves';
  }
  if (/^production$/i.test(t)) {
    return fr ? 'production' : 'production';
  }
  if (/^exports?$/i.test(t) || /^exportations?$/i.test(t)) {
    return fr ? 'exportations' : 'exports';
  }
  return t;
}

/** Index scale notes like "2002=100" are not measurement units. */
function isIndexBaseYearNote(text) {
  return /^\d{4}\s*=\s*\d+$/.test((text || '').trim());
}

/** Normalize "$ millions" / "millions $" / "C$ millions" style header units for SR. */
function spokenMoneyUnit(unitRaw) {
  const u = (unitRaw || '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (!u) return null;
  const fr = isFrenchDoc();
  // CAD-specific first so "C$ millions" is not read as "c dollar millions".
  if (
    /^c\$\s*millions?(\s+of\s+dollars)?$/.test(u)
    || /^millions?\s+(de\s+)?\$\s*can\.?$/.test(u)
    || /^millions?\s+de\s+dollars?\s+canadiens?$/.test(u)
    || /^millions?\s+of\s+canadian\s+dollars$/.test(u)
  ) {
    return fr ? 'millions de dollars canadiens' : 'millions of Canadian dollars';
  }
  if (
    /^c\$\s*billions?(\s+of\s+dollars)?$/.test(u)
    || /^billions?\s+(de\s+)?\$\s*can\.?$/.test(u)
    || /^milliards?\s+de\s+dollars?\s+canadiens?$/.test(u)
    || /^billions?\s+of\s+canadian\s+dollars$/.test(u)
  ) {
    return fr ? 'milliards de dollars canadiens' : 'billions of Canadian dollars';
  }
  if (
    /^\$\s*millions?(\s+of\s+dollars)?$/.test(u)
    || /^millions?\s*\$/.test(u)
    || /^millions?\s+de\s+(\$|dollars)$/.test(u)
    || /^millions?\s+of\s+dollars$/.test(u)
    || /^\$\s*m$/.test(u)
    || /^m\s*\$$/.test(u)
  ) {
    if (/^\$\s*m$/.test(u) || /^m\s*\$$/.test(u)) {
      return fr ? 'millions de dollars' : 'million dollars';
    }
    return fr ? 'millions de dollars' : 'millions of dollars';
  }
  if (
    /^\$\s*billions?(\s+of\s+dollars)?$/.test(u)
    || /^billions?\s*\$/.test(u)
    || /^milliards?\s*\$/.test(u)
    || /^milliards?\s+de\s+(\$|dollars)$/.test(u)
    || /^billions?\s+of\s+dollars$/.test(u)
    || u === 'g$'
  ) {
    return fr ? 'milliards de dollars' : 'billions of dollars';
  }
  return null;
}

/**
 * Split "Canada (%)" → { name, unitSpoken, unitRaw }
 * Parenthetical index base years (e.g. 2002=100) are kept out of unitSpoken
 * so they are not repeated after every cell value.
 */
export function parseColumnHeader(colHeader) {
  const text = (colHeader || '').trim();
  const match = text.match(/^(.*?)(?:\s*\(([^)]*)\))\s*$/);
  if (!match) {
    if (/^mt$/i.test(text)) {
      return {
        name: isFrenchDoc() ? 'Mégatonnes' : 'Megatonnes',
        unitSpoken: '',
        unitRaw: 'mt',
      };
    }
    if (/^mmb\/d$/i.test(text)) {
      return {
        name: isFrenchDoc() ? 'Millions de barils par jour' : 'Million barrels per day',
        unitSpoken: '',
        unitRaw: 'mmb/d',
      };
    }
    if (/^mb\/d$/i.test(text)) {
      return {
        name: isFrenchDoc() ? 'Milliers de barils par jour' : 'Thousand barrels per day',
        unitSpoken: '',
        unitRaw: 'mb/d',
      };
    }
    return { name: text, unitSpoken: '', unitRaw: '' };
  }
  const name = match[1].trim();
  const unitRaw = (match[2] || '').trim();
  if (isIndexBaseYearNote(unitRaw)) {
    return { name, unitSpoken: '', unitRaw: '' };
  }
  let unitSpoken = unitRaw;
  const rawLower = unitRaw.toLowerCase();
  if (unitRaw === '%' || rawLower === 'pct' || rawLower === 'percent') {
    unitSpoken = isFrenchDoc() ? 'pour cent' : 'percent';
  } else if (rawLower === 'pj') {
    unitSpoken = isFrenchDoc() ? 'pétajoules' : 'petajoules';
  } else if (rawLower === 'mb/d') {
    unitSpoken = isFrenchDoc() ? 'milliers de barils par jour' : 'thousand barrels per day';
  } else if (rawLower === 'mmb/d') {
    unitSpoken = isFrenchDoc() ? 'millions de barils par jour' : 'million barrels per day';
  } else if (rawLower === 'bb') {
    unitSpoken = isFrenchDoc() ? 'milliards de barils' : 'billion barrels';
  } else if (rawLower === 'mt') {
    unitSpoken = isFrenchDoc() ? 'mégatonnes' : 'megatonnes';
  } else if (rawLower === 'cents/kwh') {
    unitSpoken = isFrenchDoc() ? 'cents par kilowattheure' : 'cents per kilowatt hour';
  } else if (rawLower === 'mw') {
    unitSpoken = isFrenchDoc() ? 'mégawatts' : 'megawatts';
  } else if (rawLower === 'gw') {
    unitSpoken = isFrenchDoc() ? 'gigawatts' : 'gigawatts';
  } else if (rawLower === 'gwh') {
    unitSpoken = isFrenchDoc() ? 'gigawattheures' : 'gigawatt hours';
  } else if (rawLower === 'twh') {
    unitSpoken = isFrenchDoc() ? 'térawattheures' : 'terawatt hours';
  } else {
    const money = spokenMoneyUnit(unitRaw);
    if (money) {
      unitSpoken = money;
    } else if (unitRaw) {
      unitSpoken = unitRaw;
    }
  }
  // "US$" is spoken as the word "us dollars". Spaced letters are read "U S dollars".
  unitSpoken = unitSpoken
    .replace(/US\$/g, 'U S dollars')
    .replace(/\$\s*US\b/g, 'dollars U S');
  return { name, unitSpoken, unitRaw };
}

/** "-" / en-dash → "not applicable" for SR; otherwise the visible value. */
export function formatSpokenValue(value) {
  const v = String(value ?? '').trim();
  if (v === '-' || v === '–' || v === '—' || /^n\/?a$/i.test(v)) {
    return isFrenchDoc() ? 'sans objet' : 'not applicable';
  }
  return v;
}

function stripCurrencyGlyphs(spoken) {
  return String(spoken ?? '')
    .replace(/\$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function formatValueWithUnit(value, unitSpoken) {
  let spoken = formatSpokenValue(value);
  if (spoken === 'not applicable' || spoken === 'sans objet') return spoken;
  if (!spoken) return spoken;
  if (!unitSpoken) return spoken;
  if (/%|percent|pour cent/i.test(spoken)) return spoken;
  // "$232" + "billions of dollars" would be spoken as "dollar … billions of dollars".
  if (/(dollar|dollars)/i.test(unitSpoken)) {
    spoken = stripCurrencyGlyphs(spoken);
  }
  // "14.3 ktU" in a "(ktU)" column, or "3 milliards de dollars" in a matching column.
  if (new RegExp(`(?:^|\\s)${escapeRegExp(unitSpoken)}\\s*$`, 'i').test(spoken)) {
    return spoken;
  }
  // "$3 billion" + "billions of dollars" → "3 billions of dollars".
  const scale = unitSpoken.match(/^(millions?|billions?|milliards?)\b/i);
  if (scale) {
    const word = scale[1].replace(/s$/i, '');
    spoken = spoken.replace(new RegExp(`\\s+${word}s?\\.?$`, 'i'), '').trim();
  }
  return `${spoken} ${unitSpoken}`;
}

function tableCaptionText(table) {
  const cap = table.querySelector('caption');
  return headerText(cap);
}

function countLeafColumns(thead) {
  const rows = [...thead.rows];
  if (!rows.length) return 0;
  // Prefer first row total colSpans (accounts for groups)
  return [...rows[0].cells].reduce((sum, cell) => sum + (cell.colSpan || 1), 0);
}

/**
 * Resolve one header string per body column, combining stacked thead rows
 * and expanding Res./Prod./Exp. so columns stay aligned (fixes mixed headers).
 */
export function columnHeadersFor(table) {
  const thead = table.tHead;
  if (!thead) return [];
  const rows = [...thead.rows];
  if (!rows.length) return [];

  if (rows.length === 1) {
    return [...rows[0].cells].map((cell) => headerText(cell));
  }

  const colCount = countLeafColumns(thead);
  const grid = Array.from({ length: rows.length }, () =>
    Array.from({ length: colCount }, () => ''),
  );

  rows.forEach((row, r) => {
    let c = 0;
    [...row.cells].forEach((cell) => {
      while (c < colCount && grid[r][c] !== '') c += 1;
      const cs = cell.colSpan || 1;
      const rs = cell.rowSpan || 1;
      const text = headerText(cell);
      for (let i = 0; i < rs && r + i < rows.length; i += 1) {
        for (let j = 0; j < cs && c + j < colCount; j += 1) {
          if (!grid[r + i][c + j]) grid[r + i][c + j] = text;
        }
      }
      c += cs;
    });
  });

  return Array.from({ length: colCount }, (_, c) => {
    const parts = [];
    for (let r = 0; r < rows.length; r += 1) {
      const t = grid[r][c];
      if (t && parts[parts.length - 1] !== t) parts.push(t);
    }
    if (!parts.length) return '';
    if (parts.length === 1) {
      const only = parts[0];
      return /^(res|prod|exp|rés|prov)\.?$/i.test(only)
        ? expandMetricAbbrev(only)
        : only;
    }
    // Group + metric abbrev → "Crude oil reserves"
    const groupParts = parts.slice(0, -1).filter(Boolean);
    const metric = expandMetricAbbrev(parts[parts.length - 1]);
    return `${groupParts.join(' ')} ${metric}`.replace(/\s+/g, ' ').trim();
  });
}

/** Headers list for the column-headers stop (dedupe repeating Res/Prod/Exp). */
export function columnHeadersAnnouncement(colHeaders) {
  const cleaned = colHeaders.map((h) => h.trim()).filter(Boolean);
  if (!cleaned.length) return '';

  // Detect repeating metric triplets under resource groups
  const metrics = cleaned
    .map((h) => {
      const m = h.match(/\b(reserve|reserves|réserves|production|exports|exportations)\b/i);
      return m ? m[1].toLowerCase() : null;
    })
    .filter(Boolean);
  const groups = cleaned
    .map((h) =>
      h
        .replace(/\b(reserve|reserves|réserves|production|exports|exportations)\b/gi, '')
        .trim(),
    )
    .filter(Boolean);

  const uniqueGroups = [...new Set(groups)];
  const uniqueMetrics = [...new Set(metrics.map((m) => expandMetricAbbrev(m)))];

  if (uniqueGroups.length >= 2 && uniqueMetrics.length >= 2) {
    const metricList = uniqueMetrics.join(', ');
    const fr = isFrenchDoc();
    const each = fr ? 'Pour chacune' : 'For each';
    return `${uniqueGroups.join(', ')}. ${each}: ${metricList}`;
  }

  // Province/Territory × year ($ millions): years once, unit spoken as "millions of dollars"
  if (looksLikeProvinceHeader(cleaned)) {
    const years = [];
    let moneyUnit = '';
    cleaned.slice(1).forEach((h) => {
      const { name, unitSpoken, unitRaw } = parseColumnHeader(h);
      if (isYearColumnName(name) && spokenMoneyUnit(unitRaw)) {
        years.push(name);
        moneyUnit = unitSpoken;
      }
    });
    if (years.length && moneyUnit) {
      const fr = isFrenchDoc();
      const valuesIn = fr ? 'Valeurs en' : 'Values in';
      return `${cleaned[0]}, ${years.join(', ')}. ${valuesIn} ${moneyUnit}`;
    }
  }

  // Simple tables: speak headers with normalized money/percent units (not "$ millions")
  return [...new Set(cleaned.map((h) => speakHeaderLabel(h)))].join(', ');
}

/** Visible header → SR label ("2009 ($ millions)" → "2009, millions of dollars"). */
export function speakHeaderLabel(header) {
  const text = (header || '').trim();
  if (!text) return '';
  if (/^(res|prod|exp|rés|prov)\.?$/i.test(text)) {
    return expandMetricAbbrev(text) || text;
  }
  const { name, unitSpoken, unitRaw } = parseColumnHeader(text);
  if (spokenMoneyUnit(unitRaw)) {
    return `${name}, ${unitSpoken}`;
  }
  if (unitSpoken === 'percent' || unitSpoken === 'pour cent') {
    return `${name}, ${unitSpoken}`;
  }
  return text;
}

function findRowHeaderCell(row, colHeaders) {
  const cells = [...row.cells];
  const scoped = row.querySelector('th[scope="row"]');
  if (scoped) return scoped;
  const resource = row.querySelector('td.resource-cell, th.resource-cell');
  if (resource) return resource;
  if (cells[0] && (cells[0].tagName === 'TH' || !colHeaders[0])) {
    return cells[0];
  }
  return null;
}

function looksLikeYearHeader(colHeaders) {
  const first = (colHeaders[0] || '').toLowerCase();
  return first === 'year' || first === 'année' || first === 'annee'
    || first === 'period' || first === 'période' || first === 'periode'
    || first === 'rank' || first === 'rang';
}

/** Year + Source/State/Category tables: earlier columns are row labels, not value series. */
function isDescriptiveBesideYear(name) {
  const n = String(name || '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (/^(source|sources|state|states|état|etats|états|category|categories|catégorie|catégories|categorie|region|regions|région|régions|industry|industries|industrie|energy source)$/.test(n)) return true;
  if (/^source d['’][eé]nergie$/.test(n)) return true;
  if (/^charger type$/.test(n) || /^type de borne$/.test(n)) return true;
  if (/^country or region$/.test(n) || /^pays ou r[eé]gion$/.test(n)) return true;
  if (/^(country|countries|pays)$/.test(n)) return true;
  return /province|territoire|territory/.test(n);
}

function sourceBesideYear(colHeaders, cells, index) {
  if (!looksLikeYearHeader(colHeaders) || index <= 1) return '';
  const parts = [];
  for (let i = 1; i < index; i += 1) {
    const name = parseColumnHeader(colHeaders[i] || '').name.toLowerCase();
    if (!isDescriptiveBesideYear(name)) break;
    const text = headerText(cells[i]);
    if (text) parts.push(text);
  }
  return parts.join(', ');
}

function looksLikeProvinceHeader(colHeaders) {
  const first = (colHeaders[0] || '').toLowerCase();
  return /province|territoire|territory/.test(first);
}

function isYearColumnName(name) {
  return /^\d{4}$/.test(String(name || '').trim());
}

function isRankingsContext(table, colHeaders) {
  if (table) {
    const cap = tableCaptionText(table).toLowerCase();
    if (/ranking|classement/.test(cap)) return true;
    if (
      table.closest(
        '.static-rankings-scroll-container, .energy-production-rankings-section',
      )
    ) {
      return true;
    }
  }
  // "Exports (C$ millions)" and "Exports (Terawatt hours)" are value columns, not rankings metrics.
  const metricHeaders = (colHeaders || []).filter((h) => {
    const { unitRaw } = parseColumnHeader(h);
    if (spokenMoneyUnit(unitRaw)) return false;
    if (isPhysicalQuantityUnit(unitRaw)) return false;
    return true;
  });
  const joined = metricHeaders.join(' ');
  const hasMetrics = /(reserve|production|export|\bres\.?\b|\bprod\.?\b|\bexp\.?\b)/i.test(
    joined,
  );
  const hasPercent = /\(%\)/.test(joined);
  return hasMetrics && !hasPercent;
}

function isPhysicalQuantityUnit(unitRaw) {
  const u = (unitRaw || '').toLowerCase();
  return /terawatt|térawatt|twh|petajoule|gigawatt|gwh|megawatt|mwh|barrel|baril|tonne|mb\/d|\bbb\b|\bmt\b/.test(u);
}

function rankingWord() {
  return isFrenchDoc() ? 'classement' : 'ranking';
}

/** From "Crude oil reserve" → { resource: "Crude oil", metric: "reserve" } */
function splitResourceMetric(rawCol, rowHeader) {
  let text = (rawCol || '').trim();
  if (rowHeader) {
    text = text.replace(new RegExp(`^${rowHeader}\\s*`, 'i'), '').trim() || text;
  }
  const metricMatch = text.match(
    /^(.*?)[\s,]*(reserve|reserves|réserves|production|exports|exportations)$/i,
  );
  if (metricMatch) {
    return {
      resource: metricMatch[1].trim(),
      metric: expandMetricAbbrev(metricMatch[2]),
    };
  }
  // Abbrev-only or full header like "Production"
  const metric = expandMetricAbbrev(text);
  return { resource: '', metric };
}

export function labelForCell(cell, colHeaders, table = null) {
  const row = cell.parentElement;
  if (!(row instanceof HTMLTableRowElement)) return headerText(cell);

  const cells = [...row.cells];
  const index = cells.indexOf(cell);
  const rowHeaderCell = findRowHeaderCell(row, colHeaders);
  const rowHeader = rowHeaderCell ? headerText(rowHeaderCell) : '';
  const value = formatSpokenValue(headerText(cell));
  const rawCol = index >= 0 ? colHeaders[index] || '' : '';
  const rankings = isRankingsContext(table || cell.closest?.('table'), colHeaders);
  const rank = rankings ? rankingWord() : '';

  if (cell === rowHeaderCell) {
    if (looksLikeYearHeader(colHeaders) && colHeaders[0]) {
      return `${colHeaders[0]}, ${value}`;
    }
    if (looksLikeProvinceHeader(colHeaders) && colHeaders[0]) {
      return `${colHeaders[0]}, ${value}`;
    }
    return value;
  }

  // Province/Territory × year ($ millions): "British Columbia, 2009, 10,250, millions of dollars"
  if (looksLikeProvinceHeader(colHeaders) && !rankings) {
    const { name: colName, unitSpoken } = parseColumnHeader(rawCol);
    if (isYearColumnName(colName)) {
      return [rowHeader, colName, value, unitSpoken].filter(Boolean).join(', ');
    }
  }

  // Year × country (%) tables (not rankings).
  // Year + Source + values also speaks the source with each number.
  if (looksLikeYearHeader(colHeaders) && !rankings) {
    const { name: colName, unitSpoken } = parseColumnHeader(rawCol);
    const valueOut = formatValueWithUnit(value, unitSpoken);
    const source = sourceBesideYear(colHeaders, cells, index);
    const firstHeader = (colHeaders[0] || '').toLowerCase();
    const rowSpoken = firstHeader === 'rank' || firstHeader === 'rang'
      ? `${colHeaders[0]} ${rowHeader}`
      : rowHeader;
    return [colName, rowSpoken, source, valueOut].filter(Boolean).join(', ');
  }

  // Energy source × province × value, with the year only in the caption.
  if (!looksLikeYearHeader(colHeaders) && !rankings && index > 1) {
    const firstName = parseColumnHeader(colHeaders[0] || '').name.toLowerCase();
    if (isDescriptiveBesideYear(firstName)) {
      const extras = [];
      let descriptive = true;
      for (let i = 1; i < index; i += 1) {
        const name = parseColumnHeader(colHeaders[i] || '').name.toLowerCase();
        if (!isDescriptiveBesideYear(name)) {
          descriptive = false;
          break;
        }
        const text = headerText(cells[i]);
        if (text) extras.push(text);
      }
      if (descriptive && extras.length) {
        const { name: colName, unitSpoken } = parseColumnHeader(rawCol);
        const valueOut = formatValueWithUnit(value, unitSpoken);
        const cap = table ? tableCaptionText(table) : '';
        const years = cap.match(/\b(?:19|20)\d{2}\b/g) || [];
        const year = years.length === 1 ? years[0] : '';
        return [colName, year, rowHeader, ...extras, valueOut].filter(Boolean).join(', ');
      }
    }
  }

  // Sector × values: speak the sector with each number, and the year when the caption has one.
  if (!looksLikeYearHeader(colHeaders) && !rankings && index > 0) {
    const firstName = parseColumnHeader(colHeaders[0] || '').name.toLowerCase();
    if (/^(sector|sectors|secteur|secteurs|category|categories|catégorie|catégories|categorie|region|regions|région|régions|province|provinces|city|cities|ville|villes|facility|facilities|centrale|centrales|indicator|indicators|indicateur|indicateurs)$/.test(firstName)
      && !isYearColumnName(parseColumnHeader(rawCol).name)) {
      const { name: colName, unitSpoken } = parseColumnHeader(rawCol);
      const valueOut = formatValueWithUnit(value, unitSpoken);
      const cap = table ? tableCaptionText(table) : '';
      const years = cap.match(/\b(?:19|20)\d{2}\b/g) || [];
      const year = years.length === 1 ? years[0] : '';
      return [colName, year, rowHeader, valueOut].filter(Boolean).join(', ');
    }
  }

  // Rankings tables (static summary + yearly Res/Prod/Exp grid)
  if (rankings) {
    if (looksLikeYearHeader(colHeaders)) {
      // e.g. "2007, Crude oil production, ranking, 4"
      const { resource, metric } = splitResourceMetric(rawCol, '');
      const phrase = [resource, metric].filter(Boolean).join(' ');
      return [rowHeader, phrase, rank, value].filter((p) => p !== '').join(', ');
    }
    // e.g. "Crude oil production, ranking, 4"
    let metric = '';
    if (rawCol) {
      const withoutGroup = rawCol.replace(rowHeader, '').trim();
      metric = expandMetricAbbrev(withoutGroup || rawCol);
      if (rowHeader && metric.toLowerCase().startsWith(rowHeader.toLowerCase())) {
        metric = metric.slice(rowHeader.length).trim();
      }
      metric = expandMetricAbbrev(metric) || metric;
    }
    const phrase = [rowHeader, metric].filter(Boolean).join(' ');
    return [phrase, rank, value].filter((p) => p !== '').join(', ');
  }

  // Generic fallback. Money units follow the number: "12,000.00 million dollars".
  const { name, unitSpoken, unitRaw } = parseColumnHeader(rawCol);
  const metricSource = name || rawCol;
  const withoutGroup = rowHeader
    ? metricSource.replace(rowHeader, '').trim()
    : metricSource;
  const metric = expandMetricAbbrev(withoutGroup || metricSource);
  const valueOut = spokenMoneyUnit(unitRaw) || unitSpoken === 'percent' || unitSpoken === 'pour cent'
    ? formatValueWithUnit(value, unitSpoken)
    : value;
  if (rowHeader && metric) return `${rowHeader} ${metric}, ${valueOut}`;
  if (metric) return `${metric}, ${valueOut}`;
  if (rowHeader) return `${rowHeader}, ${valueOut}`;
  return valueOut;
}

function bodyCells(table) {
  return [...table.querySelectorAll('tbody th, tbody td')];
}

function cellMatrix(table) {
  return [...table.tBodies].flatMap((body) =>
    [...body.rows].map((row) => [...row.cells]),
  );
}

const SENTINEL_CLASS = 'chart-table-colheaders';
let lastTabShift = false;
let tabFromKeyboard = false;
const TITLE_FOCUS_CLASS = 'chart-table-title-focused';
const CHEVRON_CLASS = 'chart-summary-chevron';
const TRIANGLE_RE = /^[▼▶►▾▸◄▷▽△▴]+$/u;

function summaryAccessibleName(summary) {
  let name = '';
  summary.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      name += node.textContent;
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = /** @type {HTMLElement} */ (node);
    if (el.classList.contains('wb-inv')) return;
    if (el.classList.contains(CHEVRON_CLASS)) return;
    if (el.getAttribute('aria-hidden') === 'true') return;
    name += el.textContent || '';
  });
  return name.replace(/\s+/g, ' ').trim();
}

function sanitizeSummaryControls(root) {
  if (!root?.querySelectorAll) return;
  root.querySelectorAll('details summary').forEach((summary) => {
    summary.querySelectorAll('span').forEach((span) => {
      const text = (span.textContent || '').trim();
      const alreadyChevron = span.classList.contains(CHEVRON_CLASS);
      // React often restores ▶/▼ into a span that already has the CSS chevron class.
      if (!alreadyChevron && !TRIANGLE_RE.test(text)) return;
      span.textContent = '';
      span.classList.add(CHEVRON_CLASS);
      span.setAttribute('aria-hidden', 'true');
    });
    [...summary.childNodes].forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE && TRIANGLE_RE.test(node.textContent.trim())) {
        node.textContent = '';
      }
    });

    const label = summaryAccessibleName(summary);
    if (label) summary.setAttribute('aria-label', label);
    summary.setAttribute(
      'aria-roledescription',
      isFrenchDoc() ? 'bouton' : 'button',
    );
  });
}

/** Scrub triangle text now and again after React paints (onToggle setState). */
function scrubSummaryChevrons(root) {
  sanitizeSummaryControls(root);
  if (typeof requestAnimationFrame === 'undefined') return;
  requestAnimationFrame(() => {
    sanitizeSummaryControls(root);
    requestAnimationFrame(() => sanitizeSummaryControls(root));
  });
}

function isUsableTitleHeading(el) {
  if (!el || !/^H[1-6]$/.test(el.tagName)) return false;
  if (el.classList.contains('wb-inv')) return false;
  if (el.getAttribute('aria-hidden') === 'true') return false;
  if (el.closest('[aria-hidden="true"]')) return false;
  return true;
}

function findTableTitleEl(table) {
  const host =
    table.closest(
      '.table-responsive, .static-rankings-scroll-container, [class*="-table-scroll"]',
    ) || table.parentElement;
  if (!host) return null;

  let prev = host.previousElementSibling;
  while (prev) {
    if (prev.getAttribute('aria-hidden') === 'true' || prev.classList.contains('wb-inv')) {
      prev = prev.previousElementSibling;
      continue;
    }
    if (/^H[1-6]$/.test(prev.tagName)) {
      if (isUsableTitleHeading(prev)) return prev;
      prev = prev.previousElementSibling;
      continue;
    }
    break;
  }

  const section = table.closest(
    '.energy-production-rankings-section, [class*="rankings-section"], section, article',
  );
  if (section) {
    const heading = [...section.querySelectorAll('h2, h3, h4')].find(
      (el) => isUsableTitleHeading(el),
    );
    if (heading && section.contains(table)) return heading;
  }
  return null;
}

function yearsIn(text) {
  return [...String(text || '').matchAll(/\b(?:19|20)\d{2}\b/g)].map((match) => match[0]);
}

/**
 * Keep years inside an accessible name aligned with the title's current text.
 * A year selector rewrites the visible title; a label captured on first paint
 * would otherwise keep announcing the previous year.
 * Labels with a different count of years are left alone (spoken summaries).
 */
export function syncYearsInLabel(label, source) {
  const current = String(label || '');
  const visible = String(source || '');
  if (!current || !visible) return current;
  const labelYears = yearsIn(current);
  const sourceYears = yearsIn(visible);
  if (!labelYears.length || labelYears.length !== sourceYears.length) return current;
  if (labelYears.every((year, index) => year === sourceYears[index])) return current;
  let index = 0;
  return current.replace(/\b(?:19|20)\d{2}\b/g, () => sourceYears[index++]);
}

/** Chart titles whose accessible name must follow the selected year. */
const CHART_TITLE_YEAR_SELECTOR = [
  '[data-chart-title-nav="1"]',
  'h1[class*="-chart-title"]',
  'h2[class*="-chart-title"]',
  'h3[class*="-chart-title"]',
  'h4[class*="-chart-title"]',
  'h2[class*="-graphic-title"]',
  'h3[class*="-graphic-title"]',
  'h4[class*="-graphic-title"]',
  'p[class*="-chart-title"]',
].join(', ');

/** Same sentence with different figures, e.g. a title snapshot from another year. */
function sameTitleShape(a, b) {
  const shape = (text) => String(text || '')
    .replace(/\d[\d,.\u00a0\u202f]*/g, '#')
    .replace(/\s+/g, ' ')
    .trim();
  return shape(a) === shape(b);
}

function refreshTitleAccessibleName(titleEl) {
  if (!titleEl || titleEl.classList?.contains('wb-inv')) return;
  if (titleEl.getAttribute('aria-hidden') === 'true') return;
  const source = headerText(titleEl);
  if (!source) return;
  const label = titleEl.getAttribute('aria-label');
  if (!label) return;
  const exposed = exposedTitleText(titleEl);
  const captionLabel = labelIsNearbyCaption(titleEl, label);
  // A copied label or another chart's caption overrides the live title, so a
  // year change keeps announcing the first total and year.
  if (exposed && (label === exposed || sameTitleShape(label, exposed) || captionLabel)) {
    titleEl.removeAttribute('aria-label');
    return;
  }
  // Visible wording is hidden; the label is the only name, so keep every figure.
  if (!exposed && sameTitleShape(label, source)) {
    if (label !== source) titleEl.setAttribute('aria-label', source);
    return;
  }
  const synced = syncYearsInLabel(label, source);
  if (synced !== label) titleEl.setAttribute('aria-label', synced);
}

function labelIsNearbyCaption(titleEl, label) {
  const root = titleEl.closest('article, main, section') || titleEl.ownerDocument;
  if (!root?.querySelectorAll) return false;
  const wanted = label.replace(/\s+/g, ' ').trim();
  return [...root.querySelectorAll('caption')].some((caption) => headerText(caption) === wanted);
}

function syncChartTitleYears(root) {
  if (!root?.querySelectorAll) return;
  root.querySelectorAll(CHART_TITLE_YEAR_SELECTOR).forEach((el) => {
    refreshTitleAccessibleName(el);
  });
}

function applyTitleSection(table) {
  const titleEl = findTableTitleEl(table);
  const caption = tableCaptionText(table);
  if (!titleEl) return;

  const titleText = headerText(titleEl) || caption;

  if (titleEl.getAttribute('data-chart-title-nav') !== '1') {
    titleEl.setAttribute('tabindex', '0');
    titleEl.setAttribute('data-chart-title-nav', '1');
    // Don't copy an exposed title into aria-label. That snapshot overrides the
    // text and keeps announcing the first year's total after the selector changes.
    if (titleText && !titleEl.getAttribute('aria-label') && !exposedTitleText(titleEl)) {
      titleEl.setAttribute('aria-label', titleText);
    }

    titleEl.addEventListener('focus', () => {
      titleEl.classList.add(TITLE_FOCUS_CLASS);
    });
    titleEl.addEventListener('blur', () => {
      titleEl.classList.remove(TITLE_FOCUS_CLASS);
    });
  } else if (caption && !titleEl.getAttribute('aria-label') && !exposedTitleText(titleEl)) {
    titleEl.setAttribute('aria-label', caption);
  }

  refreshTitleAccessibleName(titleEl);
}

function removeHeaderSentinel(table) {
  table.parentElement?.querySelectorAll(`:scope > .${SENTINEL_CLASS}`).forEach((el) => {
    el.remove();
  });
}

function ensureTabDirectionTracking() {
  if (typeof document === 'undefined') return;
  const host = document.documentElement;
  if (!host || host.dataset.chartTabDir === '1') return;
  host.dataset.chartTabDir = '1';
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab') return;
    lastTabShift = event.shiftKey;
    tabFromKeyboard = true;
  }, true);
  document.addEventListener('keyup', (event) => {
    if (event.key === 'Tab') tabFromKeyboard = false;
  }, true);
}

function skipIfScrollStop(el, table) {
  if (el.dataset.scrollStopSkip === '1') return;
  el.dataset.scrollStopSkip = '1';
  el.addEventListener('focus', () => {
    if (!tabFromKeyboard) return;
    const summary = table.closest('details')?.querySelector('summary');
    const cell = table.querySelector('tbody th, tbody td');
    const next = lastTabShift ? summary : cell;
    if (next && next !== document.activeElement) next.focus();
  });
}

/**
 * Scroll panes between the disclosure button and the table are not tab stops.
 * A named wrapper is exposed as a group; a focusable scroller is announced as "group".
 */
function disarmScrollStops(table) {
  const root = table.closest('details') || table.parentElement?.parentElement || table.parentElement;
  if (!root?.querySelectorAll) return;
  ensureTabDirectionTracking();
  root.querySelectorAll('.table-scroll-top').forEach((el) => {
    el.setAttribute('tabindex', '-1');
    el.setAttribute('aria-hidden', 'true');
    skipIfScrollStop(el, table);
  });
  root.querySelectorAll('.table-responsive, .static-rankings-scroll-container').forEach((el) => {
    el.setAttribute('tabindex', '-1');
    el.removeAttribute('aria-label');
    el.removeAttribute('role');
    skipIfScrollStop(el, table);
  });
}

function applyHeaderSection(table) {
  if (table.tHead) {
    table.tHead.removeAttribute('tabindex');
    table.tHead.removeAttribute('aria-label');
  }

  applyTitleSection(table);
  // Drop the old column-header tab stop and any scroll-pane group so focus
  // moves from the disclosure button straight to the first cell.
  removeHeaderSentinel(table);
  disarmScrollStops(table);

  const cap = table.querySelector('caption');
  if (cap) cap.setAttribute('aria-hidden', 'true');
}

function applyLeafHeaderAria(table) {
  const thead = table.tHead;
  if (!thead) return;
  // Ensure AT never speaks visible "Res." / "Prod." / "Exp." abbreviations,
  // and never speaks "$ millions" as "dollar millions".
  thead.querySelectorAll('th').forEach((th) => {
    const text = headerText(th);
    if (/^(res|prod|exp|rés|prov)\.?$/i.test(text)) {
      th.setAttribute('aria-label', expandMetricAbbrev(text));
      return;
    }
    const spoken = speakHeaderLabel(text);
    if (spoken && spoken !== text) {
      th.setAttribute('aria-label', spoken);
    }
  });
}

function applyCellLabels(table) {
  const colHeaders = columnHeadersFor(table);
  applyLeafHeaderAria(table);
  bodyCells(table).forEach((cell) => {
    const label = labelForCell(cell, colHeaders, table);
    if (label) cell.setAttribute('aria-label', label);
    cell.setAttribute('tabindex', '0');
  });
}

function focusCell(cell) {
  if (!cell) return;
  try {
    cell.focus({ preventScroll: false });
  } catch {
    cell.focus();
  }
}

function moveFocus(table, fromCell, key) {
  const matrix = cellMatrix(table);
  if (!matrix.length) return null;

  let r = -1;
  let c = -1;
  for (let i = 0; i < matrix.length; i += 1) {
    const j = matrix[i].indexOf(fromCell);
    if (j >= 0) {
      r = i;
      c = j;
      break;
    }
  }
  if (r < 0) return null;

  if (key === 'ArrowRight') c += 1;
  if (key === 'ArrowLeft') c -= 1;
  if (key === 'ArrowDown') r += 1;
  if (key === 'ArrowUp') r -= 1;

  if (r < 0 || r >= matrix.length) return null;
  if (c < 0 || c >= matrix[r].length) return null;
  return matrix[r][c];
}

function onCellKeyDown(event) {
  const key = event.key;
  if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(key)) {
    return;
  }
  const cell = event.currentTarget;
  const table = cell.closest('table');
  if (!table) return;

  let next = null;
  if (key === 'Home') {
    next = cell.parentElement?.cells?.[0] || null;
  } else if (key === 'End') {
    const cells = cell.parentElement?.cells;
    next = cells?.length ? cells[cells.length - 1] : null;
  } else {
    next = moveFocus(table, cell, key);
  }
  if (!next) return;
  event.preventDefault();
  focusCell(next);
}

function enhanceTable(table) {
  if (!(table instanceof HTMLTableElement)) return;

  applyHeaderSection(table);
  applyCellLabels(table);

  const cells = bodyCells(table);
  cells.forEach((cell) => {
    if (cell.dataset.chartCellKeyNav === '1') return;
    cell.dataset.chartCellKeyNav = '1';
    cell.addEventListener('keydown', onCellKeyDown);
  });

  if (table.dataset.chartCellNav === '1') return;
  table.dataset.chartCellNav = '1';

  if (typeof MutationObserver !== 'undefined') {
    const observer = new MutationObserver(() => {
      applyHeaderSection(table);
      applyCellLabels(table);
      bodyCells(table).forEach((cell) => {
        if (cell.dataset.chartCellKeyNav === '1') return;
        cell.dataset.chartCellKeyNav = '1';
        cell.addEventListener('keydown', onCellKeyDown);
      });
    });
    observer.observe(table, { childList: true, subtree: true });
  }
}

function isChartDataTable(table) {
  if (!(table instanceof HTMLTableElement)) return false;
  if (table.closest('details')) return true;
  if (
    table.closest(
      '.table-responsive, .static-rankings-scroll-container, [class*="-table-scroll"]',
    )
  ) {
    return true;
  }
  return table.classList.contains('table');
}

function enhanceInRoot(root) {
  if (!root?.querySelectorAll) return;
  sanitizeSummaryControls(root);
  root.querySelectorAll('table').forEach((table) => {
    if (isChartDataTable(table)) enhanceTable(table);
  });
  syncChartTitleYears(root);
}

export function enableChartDataTableCellNavigation(
  root = typeof document !== 'undefined' ? document : null,
) {
  if (!root?.addEventListener) return () => {};

  const onToggle = (event) => {
    const details = event.target;
    if (!(details instanceof HTMLDetailsElement)) return;
    // Always scrub on open *and* close so React-restored ▶/▼ cannot flash beside the CSS chevron.
    scrubSummaryChevrons(details);
    if (details.open) {
      requestAnimationFrame(() => {
        details.querySelectorAll('table').forEach(enhanceTable);
      });
    }
  };

  root.addEventListener('toggle', onToggle, true);

  const runEnhance = () => enhanceInRoot(root);
  if (root.readyState === 'loading') {
    root.addEventListener('DOMContentLoaded', runEnhance);
  } else {
    runEnhance();
  }

  let timer = null;
  let observer;
  if (typeof MutationObserver !== 'undefined' && root.documentElement) {
    observer = new MutationObserver((mutations) => {
      const summaryTouched = mutations.some((mutation) => {
        const node = mutation.target;
        const el = node?.nodeType === Node.TEXT_NODE ? node.parentElement : node;
        return Boolean(
          el?.closest?.('summary')
          || el?.classList?.contains?.(CHEVRON_CLASS),
        );
      });
      if (summaryTouched) {
        sanitizeSummaryControls(root);
      }
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        runEnhance();
      }, 250);
    });
    observer.observe(root.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  return () => {
    root.removeEventListener('toggle', onToggle, true);
    observer?.disconnect();
    if (timer) clearTimeout(timer);
  };
}

export {
  enhanceTable,
  applyCellLabels,
  applyHeaderSection,
  formatValueWithUnit,
  sanitizeSummaryControls,
  scrubSummaryChevrons,
};
