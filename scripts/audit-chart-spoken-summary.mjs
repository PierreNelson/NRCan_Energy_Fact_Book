/**
 * Audit spoken chart descriptions and pie percent pipelines.
 *
 * Rules:
 * - missing-spoken-chart: LazyPlot/Plot (or capsule ranking) page lacks a runtime
 *   data summary helper / rich label wired to a focusable region|img.
 * - title-only-region: focusable region/img aria-label is only a chart title.
 * - translation-only-chart-aria: chart region uses getText('*_chart_aria') without
 *   a runtime summary that enumerates values.
 * - infographic-no-tabstop: labeled infographic/capsule img missing tabIndex={0}.
 *   AccessibleInfographic (mode text|image) satisfies this for shared wrappers.
 * - pie-percent-recompute: pie uses %{percent} while curated pct data exists and
 *   labels are not driven by %{customdata}.
 *
 * Usage: node scripts/audit-chart-spoken-summary.mjs
 */
import fs from 'fs';
import path from 'path';

const pagesDir = 'src/pages';

const findings = {
  'missing-spoken-chart': [],
  'title-only-region': [],
  'translation-only-chart-aria': [],
  'infographic-no-tabstop': [],
  'pie-percent-recompute': [],
};

function lineOf(content, index) {
  return content.slice(0, Math.max(0, index)).split(/\r?\n/).length;
}

function hasLazyPlot(content) {
  return (
    content.includes('LazyPlot') ||
    content.includes("from '../components/LazyPlot'") ||
    content.includes('from "../components/LazyPlot"') ||
    /<\s*Plot\b/.test(content)
  );
}

function hasCapsuleGraphic(content) {
  return (
    /capsule-graphic/.test(content) ||
    /rankingAria\b/.test(content) ||
    /productionAria\b/.test(content) ||
    /exportsAria\b/.test(content) ||
    /reservesAria\b/.test(content) ||
    /capsuleAria\b/.test(content)
  );
}

/** Runtime helpers that build enumerated spoken data (not title / type-only). */
function hasRuntimeSummaryHelper(content) {
  return (
    /getChartSummary\s*\(/.test(content) ||
    /getChartDataSummary\s*\(/.test(content) ||
    /getPieSRSummary\s*\(/.test(content) ||
    /getBarChartSummary\s*\(/.test(content) ||
    /getPieChartSummary\s*\(/.test(content) ||
    /getMapSRSummary\s*\(/.test(content) ||
    /getSRSummary\s*\(/.test(content) ||
    /getAccessibleSummary\s*\(/.test(content) ||
    /mapSpokenSummary\b/.test(content) ||
    /summarizeByCategory\s*\(/.test(content) ||
    /joinChartSummary\s*\(/.test(content) ||
    /rankingAria\b/.test(content) ||
    /productionAria\b/.test(content) ||
    /exportsAria\b/.test(content) ||
    /reservesAria\b/.test(content) ||
    /capsuleAria\b/.test(content) ||
    /chartRegionLabel\b/.test(content) ||
    /chart1RegionLabel\b/.test(content) ||
    /chart2RegionLabel\b/.test(content) ||
    /pieRegionLabel\b/.test(content) ||
    /mapRegionLabel\b/.test(content) ||
    /infographicAria\b/.test(content) ||
    /globalInfographicAria\b/.test(content)
  );
}

function hasFocusableSpokenRegion(content) {
  if (
    /role=["'](?:region|img)["'][\s\S]{0,600}?aria-label=\{[\s\S]{0,400}?tabIndex[=:{]/.test(
      content,
    ) ||
    /role=["'](?:region|img)["'][\s\S]{0,600}?tabIndex[=:{][\s\S]{0,400}?aria-label=\{/.test(
      content,
    ) ||
    /tabIndex[=:{][\s\S]{0,300}?role=["'](?:region|img)["'][\s\S]{0,400}?aria-label=\{/.test(
      content,
    )
  ) {
    return true;
  }
  // Single-line opening tags
  const tags =
    content.match(
      /<(?:div|figure|section)[^>]*(?:role=["'](?:region|img)["'])[^>]*>/g,
    ) || [];
  for (const tag of tags) {
    if (/aria-label=\{/.test(tag) && /tabIndex/.test(tag)) return true;
  }
  return false;
}

function hasSpokenSummaryPattern(content) {
  if (!hasRuntimeSummaryHelper(content)) return false;
  if (hasFocusableSpokenRegion(content)) return true;
  // Capsule pages sometimes put rankingAria on role=img with tabIndex nearby
  if (
    /rankingAria|productionAria|exportsAria|reservesAria|capsuleAria/.test(content) &&
    /role=["']img["']/.test(content) &&
    (/tabIndex=\{0\}/.test(content) || /tabIndex=["']0["']/.test(content))
  ) {
    return true;
  }
  // Shared AccessibleInfographic is a focusable spoken/overview region for
  // infographic-only pages (no LazyPlot / capsule). Chart pages still need
  // a runtime chart summary helper above.
  if (/AccessibleInfographic/.test(content) && !hasLazyPlot(content) && !hasCapsuleGraphic(content)) {
    return true;
  }
  return false;
}

function findTitleOnlyRegions(content, file) {
  const patterns = [
    /aria-label=\{chartTitle\}/g,
    /aria-label=\{chartTitlePlain\}/g,
    /aria-label=\{chartTitleFull\}/g,
    /aria-label=\{pieChartTitle\}/g,
    /aria-label=\{barChartTitle\}/g,
    /aria-label=\{chart1Title\}/g,
    /aria-label=\{chart2Title\}/g,
    /aria-label=\{chart3Title\}/g,
    /aria-label=\{getText\(['"][^'"]*_chart_title['"][^)]*\)\}/g,
    /aria-label=\{getText\(['"][^'"]*_chart\d+_title['"][^)]*\)\}/g,
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(content)) !== null) {
      const window = content.slice(Math.max(0, m.index - 120), m.index + 220);
      if (
        /getChartSummary|getPieSRSummary|getChartDataSummary|chartSummary|RegionLabel|SpokenSummary/.test(
          window,
        )
      ) {
        continue;
      }
      if (/\$\{chartTitle\}[\s\S]{0,40}\$\{/.test(window) || /`\$\{chartTitle\}\. /.test(window)) {
        continue;
      }
      const before = content.slice(Math.max(0, m.index - 280), m.index);
      // PageShell page landmark is fine
      if (/PageShell/.test(before) && !/role=["'](?:region|img)["']/.test(before)) {
        continue;
      }
      const around = content.slice(Math.max(0, m.index - 450), m.index + 80);
      if (
        !/role=["'](?:region|img)["']/.test(before) &&
        !/role=\{['"](?:region|img)['"]\}/.test(before) &&
        !/role=["'](?:region|img)["']/.test(around)
      ) {
        continue;
      }
      findings['title-only-region'].push({
        file,
        line: lineOf(content, m.index),
        detail: 'Focusable chart region/img aria-label is title-only',
      });
    }
  }
}

function findTranslationOnlyChartAria(content, file) {
  const re = /aria-label=\{getText\(['"]([^'"]*_chart_aria)['"][^)]*\)\}/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    const around = content.slice(Math.max(0, m.index - 400), m.index + 120);
    if (!/role=["'](?:region|img)["']/.test(around)) continue;
    // OK if same region also embeds a runtime summary expression
    if (
      /getChartSummary|getChartDataSummary|summarizeByCategory|mapSpokenSummary|RegionLabel|SpokenSummary/.test(
        around,
      )
    ) {
      continue;
    }
    // File-level runtime helper still required nearby isn't enough if this specific label is translation-only
    findings['translation-only-chart-aria'].push({
      file,
      line: lineOf(content, m.index),
      detail: `Chart region uses getText('${m[1]}') without a runtime data enumeration`,
    });
  }
}

function resolveInfographicImports(content) {
  const files = [];
  const importRe =
    /import\s+\w+\s+from\s+['"]((?:\.\.\/)+components\/[^'"]*Infographic[^'"]*)['"]/g;
  let m;
  while ((m = importRe.exec(content)) !== null) {
    let rel = m[1];
    if (!rel.endsWith('.jsx') && !rel.endsWith('.js')) rel += '.jsx';
    const abs = path.normalize(path.join('src/pages', rel));
    if (fs.existsSync(abs)) files.push(abs);
  }
  return files;
}

function componentHasInfographicTabStop(compPath) {
  const comp = fs.readFileSync(compPath, 'utf8');
  // Shared AccessibleInfographic always sets tabIndex={0} + aria-label
  if (/AccessibleInfographic/.test(comp)) return true;
  return (
    /aria-label=\{/.test(comp) &&
    (/tabIndex=\{0\}/.test(comp) || /tabIndex=["']0["']/.test(comp))
  );
}

function hasTabIndexZero(content) {
  return /tabIndex=\{0\}/.test(content) || /tabIndex=["']0["']/.test(content);
}

function findInfographicGaps(content, file) {
  const imported = resolveInfographicImports(content);
  for (const compPath of imported) {
    if (!componentHasInfographicTabStop(compPath)) {
      findings['infographic-no-tabstop'].push({
        file,
        line: 1,
        detail: `Imported ${path.basename(compPath)} lacks tabIndex={0} on labeled figure`,
      });
    }
  }

  const usesInfographicKey =
    /_infographic_aria/.test(content) || /infographic-figure/.test(content);
  if (!usesInfographicKey && imported.length === 0) {
    // Capsule graphics with aria but no tab stop
    const capsuleRe =
      /role=["']img["'][\s\S]{0,200}?aria-label=\{(?:rankingAria|productionAria|exportsAria|reservesAria|capsuleAria)/g;
    let m;
    while ((m = capsuleRe.exec(content)) !== null) {
      const win = content.slice(m.index, m.index + 250);
      if (!/tabIndex[=:{]/.test(win)) {
        findings['infographic-no-tabstop'].push({
          file,
          line: lineOf(content, m.index),
          detail: 'Capsule/ranking img has aria-label but no tabIndex={0}',
        });
      }
    }
    return;
  }

  if (hasTabIndexZero(content) && /role=["']img["']/.test(content)) return;

  if (
    imported.length > 0 &&
    imported.every((p) => componentHasInfographicTabStop(p)) &&
    !/infographic-figure[\s\S]{0,200}?aria-label=/.test(content)
  ) {
    return;
  }

  if (/AccessibleInfographic/.test(content)) return;

  if (usesInfographicKey && imported.length === 0 && !hasTabIndexZero(content)) {
    findings['infographic-no-tabstop'].push({
      file,
      line: 1,
      detail: 'Inline infographic missing tabIndex={0}',
    });
  }
}

function findPiePercentRecompute(content, file) {
  if (!/%\{percent/.test(content)) return;
  if (/%\{customdata/.test(content)) return;

  const hasPctField =
    /\.pct\b/.test(content) &&
    (/slices\s*:/.test(content) || /pct:\s*\d/.test(content) || /s\.pct/.test(content));

  const hasPercentShareValues =
    /sources:\s*\[[\s\S]*?value:\s*\d{1,2}\b/.test(content) &&
    (/map\(\([^)]*\)\s*=>\s*[^)]*\.value\)/.test(content) ||
      /values\s*=\s*[^\n]*\.value/.test(content) ||
      /values:\s*[^\n]*\.value/.test(content));

  if (!hasPctField && !hasPercentShareValues) return;

  findings['pie-percent-recompute'].push({
    file,
    line: lineOf(content, content.search(/%\{percent/)),
    detail:
      'Pie uses %{percent} with curated share values; prefer customdata + %{customdata:.0f}%',
  });
}

for (const file of fs.readdirSync(pagesDir).filter((f) => f.endsWith('.jsx')).sort()) {
  const content = fs.readFileSync(path.join(pagesDir, file), 'utf8');
  const needsSpoken = hasLazyPlot(content) || hasCapsuleGraphic(content);

  if (needsSpoken && !hasSpokenSummaryPattern(content)) {
    findings['missing-spoken-chart'].push({
      file,
      line: 1,
      detail:
        'Chart/capsule page has no focusable spoken data summary (runtime enumeration required)',
    });
  }

  findTitleOnlyRegions(content, file);
  findTranslationOnlyChartAria(content, file);
  findInfographicGaps(content, file);
  findPiePercentRecompute(content, file);
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
  console.error(`\nChart spoken-summary audit failed (${files.size} page(s)).`);
  process.exit(1);
}

console.log('Chart spoken-summary audit passed for all pages.');
