/**
 * Audit Plotly pages for chart data alternatives (<details> and/or <table>).
 * Also flags patterns that break screen reader access to chart data tables:
 * - <summary role="button">
 * - .table-responsive (or similar) with role="region" + tabIndex={0}
 * Usage: node scripts/audit-chart-alternatives.mjs
 */
import fs from 'fs';
import path from 'path';

const pagesDir = 'src/pages';
const missing = [];
const summaryRoleButton = [];
const focusableTableRegion = [];

/** Find <summary ...> opening tags even when attributes span lines / contain `>`. */
function summaryOpenTagsHaveRoleButton(content) {
  const starts = [...content.matchAll(/<summary\b/g)];
  for (const start of starts) {
    let i = start.index + '<summary'.length;
    let depth = 0;
    let inQuote = null;
    while (i < content.length) {
      const ch = content[i];
      if (inQuote) {
        if (ch === inQuote && content[i - 1] !== '\\') inQuote = null;
        i += 1;
        continue;
      }
      if (ch === '"' || ch === "'") {
        inQuote = ch;
        i += 1;
        continue;
      }
      if (ch === '{') {
        depth += 1;
        i += 1;
        continue;
      }
      if (ch === '}') {
        depth = Math.max(0, depth - 1);
        i += 1;
        continue;
      }
      if (ch === '>' && depth === 0) {
        const openTag = content.slice(start.index, i + 1);
        if (/role=["']button["']/.test(openTag)) return true;
        break;
      }
      i += 1;
    }
  }
  return false;
}

/**
 * Detect scroll hosts around tables that are focusable regions.
 * Matches multi-line openings for table-responsive / rankings / *-table-scroll.
 */
function hasFocusableTableRegion(content) {
  const multilineHost =
    /<(?:div|section)\b[\s\S]{0,500}?(?:table-responsive|static-rankings-scroll-container|[-\w]*table-scroll)[\s\S]{0,500}?>/gi;
  let match;
  while ((match = multilineHost.exec(content)) !== null) {
    const tag = match[0];
    if (tag.includes('<table')) continue;
    const hasRole = /role=["']region["']/.test(tag);
    const hasTab =
      /tabIndex=["']?0["']?/.test(tag) ||
      /tabIndex=\{0\}/.test(tag) ||
      /tabindex=["']?0["']?/.test(tag);
    if (hasRole && hasTab) return true;
  }
  return false;
}

for (const file of fs.readdirSync(pagesDir).filter((f) => f.endsWith('.jsx'))) {
  const content = fs.readFileSync(path.join(pagesDir, file), 'utf8');
  if (!content.includes('LazyPlot') && !content.includes("from '../components/LazyPlot'")) continue;

  const hasDetails = content.includes('<details');
  const hasTable = content.includes('<table');
  if (!hasDetails && !hasTable) {
    missing.push(file);
  }

  if (summaryOpenTagsHaveRoleButton(content)) {
    summaryRoleButton.push(file);
  }

  if (hasFocusableTableRegion(content)) {
    focusableTableRegion.push(file);
  }
}

let failed = false;

if (missing.length) {
  failed = true;
  console.error('Plotly pages missing <details> or <table>:', missing.length);
  missing.forEach((f) => console.error(' -', f));
}

if (summaryRoleButton.length) {
  failed = true;
  console.error(
    'Plotly pages still use <summary role="button"> (breaks native disclosure for AT):',
    summaryRoleButton.length,
  );
  summaryRoleButton.forEach((f) => console.error(' -', f));
}

if (focusableTableRegion.length) {
  failed = true;
  console.error(
    'Plotly pages wrap chart tables in focusable role="region" (Tab skips table cells):',
    focusableTableRegion.length,
  );
  focusableTableRegion.forEach((f) => console.error(' -', f));
}

if (failed) {
  process.exit(1);
}

console.log(
  'All LazyPlot pages include a data-table alternative with native <summary> (no role=button / no focusable table region).',
);
