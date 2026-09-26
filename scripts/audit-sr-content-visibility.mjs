/**
 * Fail pages that hide real content from the accessibility tree.
 * Scans all src/pages/*.jsx (and optionally shared shells).
 *
 * Rules:
 * - heading-hidden: <h1>/<h2> opening tag with aria-hidden="true"
 * - prose-hidden: SafeHtml with aria-hidden, or heading/p whose children are wrapped in aria-hidden
 * - interactive-under-hidden: fn-lnk / <a / <button / tabIndex={0} inside an aria-hidden ancestor
 * - duplicate-sr-heading: visible h1 aria-hidden + twin <h1 className="wb-inv">
 *
 * Usage: node scripts/audit-sr-content-visibility.mjs
 */
import fs from 'fs';
import path from 'path';

const pagesDir = 'src/pages';

const findings = {
  'heading-hidden': [],
  'prose-hidden': [],
  'interactive-under-hidden': [],
  'duplicate-sr-heading': [],
};

function lineOf(content, index) {
  return content.slice(0, index).split(/\r?\n/).length;
}

function addFinding(rule, file, index, detail) {
  findings[rule].push({ file, line: lineOf(contentForFile.get(file) || ''), detail, index });
}

const contentForFile = new Map();

/** Find matching closing tag index for an element starting at openTagEnd ('>' index). */
function findElementEnd(content, openTagStart, tagName) {
  const openEnd = content.indexOf('>', openTagStart);
  if (openEnd === -1) return -1;
  // Self-closing
  if (content[openEnd - 1] === '/') return openEnd;

  const lower = tagName.toLowerCase();
  let i = openEnd + 1;
  let depth = 1;
  const openRe = new RegExp(`<${lower}\\b`, 'gi');
  const closeRe = new RegExp(`</${lower}\\s*>`, 'gi');

  while (i < content.length && depth > 0) {
    openRe.lastIndex = i;
    closeRe.lastIndex = i;
    const nextOpen = openRe.exec(content);
    const nextClose = closeRe.exec(content);
    if (!nextClose) return -1;
    if (nextOpen && nextOpen.index < nextClose.index) {
      // Check self-closing open
      const gt = content.indexOf('>', nextOpen.index);
      if (gt !== -1 && content[gt - 1] !== '/') depth += 1;
      i = (gt === -1 ? nextOpen.index + 1 : gt + 1);
    } else {
      depth -= 1;
      i = nextClose.index + nextClose[0].length;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function openingTagHasAriaHidden(openTag) {
  return /aria-hidden\s*=\s*(["'])true\1/.test(openTag) || /aria-hidden\s*=\s*\{true\}/.test(openTag);
}

function scanFile(file, content) {
  contentForFile.set(file, content);

  // 1) h1/h2 with aria-hidden on the heading itself
  const headingOpen = /<(h[12])\b([^>]*?)>/gi;
  let m;
  const hiddenHeadings = [];
  while ((m = headingOpen.exec(content)) !== null) {
    const tagName = m[1];
    const attrs = m[2] || '';
    const openTag = m[0];
    if (openingTagHasAriaHidden(openTag) || openingTagHasAriaHidden(`<${tagName}${attrs}>`)) {
      findings['heading-hidden'].push({
        file,
        line: lineOf(content, m.index),
        detail: `<${tagName}> has aria-hidden="true"`,
      });
      hiddenHeadings.push({ tagName, index: m.index, openTag });
    }
  }

  // 2) SafeHtml with aria-hidden
  const safeHtml = /<SafeHtml\b[^>]*aria-hidden\s*=\s*(["'])true\1[^>]*\/?\s*>|<SafeHtml\b[^>]*aria-hidden\s*=\s*\{true\}[^>]*\/?\s*>/gi;
  while ((m = safeHtml.exec(content)) !== null) {
    findings['prose-hidden'].push({
      file,
      line: lineOf(content, m.index),
      detail: 'SafeHtml marked aria-hidden',
    });
  }

  // 3) Interactive content under aria-hidden ancestors (element-level)
  const ariaHiddenOpen = /<(?<tag>[A-Za-z][\w.-]*)\b(?<attrs>[^>]*?aria-hidden\s*=\s*(?:["']true["']|\{true\})[^>]*?)>/gi;
  while ((m = ariaHiddenOpen.exec(content)) !== null) {
    const tagName = m.groups.tag;
    const openTag = m[0];
    if (/\/>$/.test(openTag.trim()) || openTag.endsWith('/>')) continue;
    const end = findElementEnd(content, m.index, tagName);
    if (end === -1) continue;
    const inner = content.slice(m.index + openTag.length, end);
    const hasInteractive =
      /\bfn-lnk\b/.test(inner) ||
      /<a\b/.test(inner) ||
      /<button\b/.test(inner) ||
      /tabIndex\s*=\s*(?:\{0\}|["']0["'])/.test(inner) ||
      /tabindex\s*=\s*(?:\{0\}|["']0["'])/i.test(inner);
    if (hasInteractive) {
      findings['interactive-under-hidden'].push({
        file,
        line: lineOf(content, m.index),
        detail: `Interactive content inside <${tagName} aria-hidden>`,
      });
    }
  }

  // 4) Title/prose flattened: h1/h2/p with role=region (or not) wrapping only aria-hidden children for the text
  // Flag: <span aria-hidden="true"> as direct content wrapper inside narrative/title patterns
  const flattened = /<(h1|h2|h3|p)\b[^>]*>\s*<span\b[^>]*aria-hidden\s*=\s*(["'])true\2[^>]*>/gi;
  while ((m = flattened.exec(content)) !== null) {
    findings['prose-hidden'].push({
      file,
      line: lineOf(content, m.index),
      detail: `<${m[1]}> wraps visible text in aria-hidden span`,
    });
  }

  // 5) Duplicate sr-only h1 when a hidden visible h1 exists
  if (hiddenHeadings.some((h) => h.tagName.toLowerCase() === 'h1') && /<h1\b[^>]*\bwb-inv\b/.test(content)) {
    findings['duplicate-sr-heading'].push({
      file,
      line: lineOf(content, content.search(/<h1\b[^>]*\bwb-inv\b/)),
      detail: 'wb-inv twin h1 with aria-hidden visible h1',
    });
  }
  // Also CorporateIncomeTaxes style: hidden h2 + wb-inv h1
  if (
    /<(h1|h2)\b[^>]*aria-hidden\s*=\s*(["'])true\2/.test(content) &&
    /<h1\b[^>]*\bwb-inv\b/.test(content)
  ) {
    const already = findings['duplicate-sr-heading'].some((f) => f.file === file);
    if (!already) {
      findings['duplicate-sr-heading'].push({
        file,
        line: lineOf(content, content.search(/<h1\b[^>]*\bwb-inv\b/)),
        detail: 'wb-inv twin heading with aria-hidden visible heading',
      });
    }
  }
}

for (const file of fs.readdirSync(pagesDir).filter((f) => f.endsWith('.jsx')).sort()) {
  const content = fs.readFileSync(path.join(pagesDir, file), 'utf8');
  scanFile(file, content);
}

let failed = false;
for (const [rule, list] of Object.entries(findings)) {
  if (!list.length) continue;
  failed = true;
  console.error(`\n[${rule}] ${list.length} finding(s):`);
  for (const f of list) {
    console.error(` - ${f.file}:${f.line} — ${f.detail}`);
  }
}

if (failed) {
  const files = new Set();
  for (const list of Object.values(findings)) {
    for (const f of list) files.add(f.file);
  }
  console.error(`\nSR content visibility audit failed (${files.size} page(s)).`);
  process.exit(1);
}

console.log('SR content visibility audit passed for all pages.');
