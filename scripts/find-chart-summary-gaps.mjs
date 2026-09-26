/**
 * Stricter gap finder: every LazyPlot/Plot page must have a focusable spoken summary
 * that is not title-only.
 */
import fs from 'fs';
import path from 'path';

const pagesDir = 'src/pages';
const files = fs.readdirSync(pagesDir).filter((f) => f.endsWith('.jsx'));

const SUMMARY_HELPER =
  /getChartSummary\s*\(|getChartDataSummary\s*\(|getPieSRSummary\s*\(|getBarChartSummary\s*\(|getPieChartSummary\s*\(|getMapSRSummary\s*\(|getSRSummary\s*\(|mapSpokenSummary\b|summarizeByCategory\s*\(|getAccessibleSummary\s*\(|getLegendText\s*\(|rankingAria\b/;

const RICH_ARIA_VAR =
  /chartRegionLabel|pieRegionLabel|capsuleAria|productionAria|exportsAria|reservesAria|infographicAria|globalInfographicAria|chart1RegionLabel|chart2RegionLabel|mapRegionLabel|mapSpokenSummary|rankingAria/;

const TITLE_ONLY_ARIA = [
  /aria-label=\{(?:pieChartTitle|barChartTitle|chartTitle|chartTitlePlain|chartTitleFull)\}/,
  /aria-label=\{getText\(['"][^'"]*_chart(?:\d+)?_title['"]/,
  /role=["'](?:region|img)["'][\s\S]{0,200}?aria-label=\{getText\(['"][^'"]*_chart_title['"]/,
];

const TRANSLATION_ONLY_CHART_ARIA =
  /aria-label=\{getText\(['"][^'"]*_chart_aria['"][^)]*\)\}/;

function hasPlot(content) {
  return (
    content.includes('LazyPlot') ||
    content.includes("from '../components/LazyPlot'") ||
    /<\s*Plot\b/.test(content)
  );
}

function hasFocusableSpokenRegion(content) {
  // region/img with tabIndex 0 and aria-label nearby
  if (
    /role=["'](?:region|img)["'][\s\S]{0,500}?aria-label=\{[\s\S]{0,300}?tabIndex[=:{]/.test(
      content,
    ) ||
    /role=["'](?:region|img)["'][\s\S]{0,500}?tabIndex[=:{][\s\S]{0,300}?aria-label=\{/.test(
      content,
    ) ||
    /tabIndex[=:{][\s\S]{0,200}?role=["'](?:region|img)["'][\s\S]{0,300}?aria-label=\{/.test(
      content,
    ) ||
    /aria-label=\{[\s\S]{0,200}?tabIndex[=:{][\s\S]{0,200}?role=["'](?:region|img)["']/.test(
      content,
    )
  ) {
    return true;
  }
  // Common: role + aria-label on same opening tag; tabIndex may be before or after
  const tags = content.match(/<(?:div|figure)[^>]*(?:role=["'](?:region|img)["'])[^>]*>/g) || [];
  for (const tag of tags) {
    if (/aria-label=\{/.test(tag) && /tabIndex/.test(tag)) return true;
  }
  // Multi-line opening tags
  if (
    /role=["'](?:region|img)["']\s*\n[^<]*aria-label=\{[^}]+\}\s*\n[^<]*tabIndex/.test(content) ||
    /role=["'](?:region|img)["']\s*\n[^<]*tabIndex[=:{][^>\n]*\n[^<]*aria-label=\{/.test(content)
  ) {
    return true;
  }
  return false;
}

const gaps = [];

for (const file of files) {
  const content = fs.readFileSync(path.join(pagesDir, file), 'utf8');
  if (!hasPlot(content)) continue;

  const reasons = [];
  const hasSummary = SUMMARY_HELPER.test(content) || RICH_ARIA_VAR.test(content);

  if (!hasSummary) reasons.push('no-summary-helper');

  for (const re of TITLE_ONLY_ARIA) {
    if (re.test(content)) {
      // Allow if same file also builds rich labels for those charts
      const titleHits = content.match(
        /aria-label=\{(?:pieChartTitle|barChartTitle|chartTitle|chartTitlePlain|chartTitleFull)\}/g,
      );
      if (titleHits?.length) {
        // Check each hit context for getChartSummary nearby
        let bad = false;
        const re2 =
          /aria-label=\{(?:pieChartTitle|barChartTitle|chartTitle|chartTitlePlain|chartTitleFull)\}/g;
        let m;
        while ((m = re2.exec(content))) {
          const win = content.slice(Math.max(0, m.index - 80), m.index + 120);
          if (!/\$\{.*Summary|getChartSummary|getChartDataSummary|chartRegionLabel/.test(win)) {
            // PageShell aria-label={chartTitle} is OK
            const before = content.slice(Math.max(0, m.index - 200), m.index);
            if (/PageShell/.test(before)) continue;
            if (/role=["'](?:region|img)["']/.test(before) || /role=["'](?:region|img)["']/.test(win)) {
              bad = true;
            }
            // Also catch multiline: aria-label on next lines after role
            const around = content.slice(Math.max(0, m.index - 400), m.index + 50);
            if (/role=["'](?:region|img)["']/.test(around)) bad = true;
          }
        }
        if (bad) reasons.push('title-only-chart-aria');
      }
      break;
    }
  }

  // Static translation chart_aria without numeric data in the call site is flagged for review
  if (TRANSLATION_ONLY_CHART_ARIA.test(content) && !SUMMARY_HELPER.test(content)) {
    reasons.push('translation-only-chart-aria');
  }

  if (!hasFocusableSpokenRegion(content) && hasSummary) {
    reasons.push('summary-not-wired-to-focusable-region');
  }
  if (!hasFocusableSpokenRegion(content) && !hasSummary) {
    reasons.push('no-focusable-spoken-region');
  }

  if (reasons.length) {
    gaps.push({ file, reasons: [...new Set(reasons)] });
  }
}

console.log(JSON.stringify(gaps, null, 2));
console.log(`\n${gaps.length} page(s) with gaps`);
