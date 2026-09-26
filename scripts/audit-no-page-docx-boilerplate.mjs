/**
 * Fail CI if pages reintroduce DOCX Packer boilerplate or hand-rolled details tables.
 * Allowlist is empty by default; add paths only for temporary exceptions.
 */
import fs from 'fs';
import path from 'path';

const PAGES = 'src/pages';
const ALLOWLIST = new Set([
  // Infographic / map pages with intentional custom dual-scroll (not ChartDataTable chrome)
  'EnergyTrade.jsx',
  'EnergyImports.jsx',
  'MajorProjectsMap.jsx',
  // Multi-table / capsule pages still finishing scroll-helper cleanup
  'CanadaGlobalEnergyTrade.jsx',
  'CanadianEnergyExportsUsStates.jsx',
  'CoalInternational.jsx',
  'ElectricityInternationalContext.jsx',
  'EnergyReliantCommunities.jsx',
  'PrimaryEnergyProduction.jsx',
  'PublicEvChargingStations.jsx',
]);

const checks = [
  {
    id: 'packer',
    re: /Packer\.toBlob|from\s+['"]docx['"]/,
    message: 'Pages must not import docx/Packer directly — use src/utils/exportTableToDocx.js',
  },
  {
    id: 'details-table',
    re: /<details[\s>][\s\S]{0,200}<(?:summary|table)/,
    message: 'Pages must not hand-roll <details> chart data tables — use ChartDataTable',
  },
  {
    id: 'dual-scroll-ro',
    re: /ResizeObserver[\s\S]{0,200}(?:topScroll|tableScroll|updateTopScrollWidth|syncTableScroll|bindTableScrollSync)/,
    message: 'Pages must not copy dual-scrollbar ResizeObserver boilerplate — ChartDataTable owns scroll sync',
    // Only enforce when ChartDataTable is already adopted on the page
    requiresChartDataTable: true,
  },
];

const failures = [];

for (const file of fs.readdirSync(PAGES).filter((f) => f.endsWith('.jsx'))) {
  const rel = path.join(PAGES, file).replace(/\\/g, '/');
  if (ALLOWLIST.has(rel) || ALLOWLIST.has(file)) continue;
  const source = fs.readFileSync(path.join(PAGES, file), 'utf8');
  for (const check of checks) {
    if (check.requiresChartDataTable && !/ChartDataTable/.test(source)) continue;
    if (check.re.test(source)) {
      failures.push(`${rel}: ${check.message} [${check.id}]`);
    }
  }
}

if (failures.length) {
  console.error('Page chrome boilerplate audit failed:\n');
  for (const line of failures) console.error(` - ${line}`);
  console.error(`\n${failures.length} issue(s). Prefer shared page chrome — see docs/PAGE_CREATION_GUIDE.md`);
  process.exit(1);
}

console.log('Page chrome boilerplate audit passed.');
