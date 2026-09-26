/**
 * Chart data table keyboard / screen reader navigation.
 *
 * Tab order:
 *   1. Table title (visible heading or caption) — focus styles the title
 *   2. Column headers stop — unique/expanded headers (not Res./Prod./Exp. spam)
 *   3. Each body cell — e.g. "Crude oil production, 4" or "Canada, 2023, 4 percent"
 *   4. Controls after the table
 */

function headerText(el) {
  return (el?.textContent || '').replace(/\s+/g, ' ').trim();
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
  // Full static-table headers → metric word for cell phrases
  if (/reserve|réserve|capacit/i.test(t)) {
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
  ) {
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
  } else {
    const money = spokenMoneyUnit(unitRaw);
    if (money) {
      unitSpoken = money;
    } else if (unitRaw) {
      unitSpoken = unitRaw;
    }
  }
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
      return /^(res|prod|exp|rés)\.?$/i.test(only)
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
  if (/^(res|prod|exp|rés)\.?$/i.test(text)) {
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
  return first === 'year' || first === 'année' || first === 'annee';
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
  const joined = (colHeaders || []).join(' ');
  const hasMetrics = /(reserve|production|export|\bres\.?\b|\bprod\.?\b|\bexp\.?\b)/i.test(
    joined,
  );
  const hasPercent = /\(%\)/.test(joined);
  return hasMetrics && !hasPercent;
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

  // Year × country (%) tables (not rankings)
  if (looksLikeYearHeader(colHeaders) && !rankings) {
    const { name: colName, unitSpoken } = parseColumnHeader(rawCol);
    const valueOut = formatValueWithUnit(value, unitSpoken);
    return [colName, rowHeader, valueOut].filter(Boolean).join(', ');
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

  // Generic fallback
  let metric = '';
  if (rawCol) {
    const withoutGroup = rawCol.replace(rowHeader, '').trim();
    metric = expandMetricAbbrev(withoutGroup || rawCol);
  }
  if (rowHeader && metric) return `${rowHeader} ${metric}, ${value}`;
  if (metric) return `${metric}, ${value}`;
  if (rowHeader) return `${rowHeader}, ${value}`;
  return value;
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

function findTableTitleEl(table) {
  const host =
    table.closest(
      '.table-responsive, .static-rankings-scroll-container, [class*="-table-scroll"]',
    ) || table.parentElement;
  if (!host) return null;

  let prev = host.previousElementSibling;
  while (prev && prev.getAttribute('aria-hidden') === 'true') {
    prev = prev.previousElementSibling;
  }
  if (prev && /^H[1-6]$/.test(prev.tagName)) return prev;

  const section = table.closest(
    '.energy-production-rankings-section, [class*="rankings-section"], section, article',
  );
  if (section) {
    const heading = section.querySelector('h2, h3, h4');
    if (heading && section.contains(table)) return heading;
  }
  return null;
}

function applyTitleSection(table) {
  const titleEl = findTableTitleEl(table);
  const caption = tableCaptionText(table);
  if (!titleEl) return;

  if (titleEl.getAttribute('data-chart-title-nav') === '1') {
    if (caption && !titleEl.getAttribute('aria-label')) {
      titleEl.setAttribute('aria-label', caption);
    }
    return;
  }

  titleEl.setAttribute('tabindex', '0');
  titleEl.setAttribute('data-chart-title-nav', '1');
  // Prefer visible title text; fall back to caption
  const titleText = headerText(titleEl) || caption;
  if (titleText) titleEl.setAttribute('aria-label', titleText);

  titleEl.addEventListener('focus', () => {
    titleEl.classList.add(TITLE_FOCUS_CLASS);
  });
  titleEl.addEventListener('blur', () => {
    titleEl.classList.remove(TITLE_FOCUS_CLASS);
  });
}

function ensureHeaderSentinel(table) {
  const parent = table.parentElement;
  if (!parent) return null;

  let sentinel = parent.querySelector(`:scope > .${SENTINEL_CLASS}`);
  if (!sentinel) {
    sentinel = document.createElement('div');
    sentinel.className = SENTINEL_CLASS;
    sentinel.setAttribute('tabindex', '0');
    parent.insertBefore(sentinel, table);
  }
  return sentinel;
}

function applyHeaderSection(table) {
  if (table.tHead) {
    table.tHead.removeAttribute('tabindex');
    table.tHead.removeAttribute('aria-label');
  }

  applyTitleSection(table);

  const headers = columnHeadersFor(table);
  const announcement = columnHeadersAnnouncement(headers);
  if (!announcement) return;

  const parent = table.parentElement;
  if (parent && getComputedStyle(parent).position === 'static') {
    parent.style.position = 'relative';
  }

  const sentinel = ensureHeaderSentinel(table);
  if (!sentinel) return;

  const headerPrefix = isFrenchDoc() ? 'En-têtes de colonne' : 'Column headers';
  // Title is a separate tab stop — do not repeat caption here.
  sentinel.setAttribute('role', 'group');
  sentinel.setAttribute('aria-label', `${headerPrefix}: ${announcement}`);
  sentinel.setAttribute('tabindex', '0');

  const thead = table.tHead;
  if (thead) {
    const top = table.offsetTop + thead.offsetTop;
    const height = Math.max(thead.offsetHeight, 40);
    sentinel.style.top = `${top}px`;
    sentinel.style.height = `${height}px`;
  }

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
    if (/^(res|prod|exp|rés)\.?$/i.test(text)) {
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
