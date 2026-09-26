/**
 * Fail CI if the Plotly chunk exceeds a soft budget (bytes).
 * Run after `vite build`.
 */
import fs from 'fs';
import path from 'path';

const DIST = 'dist/assets';
const PLOTLY_MAX = 6 * 1024 * 1024; // 6 MB gzipped not measured; raw chunk budget
const TOTAL_JS_MAX = 45 * 1024 * 1024;

if (!fs.existsSync(DIST)) {
  console.error('dist/assets missing — run npm run build first');
  process.exit(1);
}

const files = fs.readdirSync(DIST).filter((f) => f.endsWith('.js'));
let total = 0;
let plotlySize = 0;

for (const f of files) {
  const size = fs.statSync(path.join(DIST, f)).size;
  total += size;
  if (f.includes('plotly')) plotlySize = Math.max(plotlySize, size);
}

console.log(`JS assets total: ${(total / 1024 / 1024).toFixed(2)} MB`);
console.log(`Largest plotly chunk: ${(plotlySize / 1024 / 1024).toFixed(2)} MB`);

let failed = false;
if (plotlySize > PLOTLY_MAX) {
  console.error(`Plotly chunk exceeds ${PLOTLY_MAX} bytes`);
  failed = true;
}
if (total > TOTAL_JS_MAX) {
  console.error(`Total JS exceeds ${TOTAL_JS_MAX} bytes`);
  failed = true;
}

process.exit(failed ? 1 : 0);
