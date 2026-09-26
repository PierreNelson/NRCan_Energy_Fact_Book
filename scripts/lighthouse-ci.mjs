/**
 * Run Lighthouse against the production preview server and enforce score budgets.
 * Usage: node scripts/lighthouse-ci.mjs  (run after npm run build)
 */
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';

const HOST = '127.0.0.1';
const PORT = 4173;
const BASE = '/NRCan_Energy_Fact_Book/';
const URLS = [
  `http://${HOST}:${PORT}${BASE}`,
  `http://${HOST}:${PORT}${BASE}section-1`,
  `http://${HOST}:${PORT}${BASE}section-1?embed=1`,
];

const BUDGETS = {
  accessibility: 0.85,
  performance: 0.35,
  'best-practices': 0.85,
};

function startPreview() {
  return spawn('npx', ['vite', 'preview', '--host', HOST, '--port', String(PORT), '--strictPort'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
  });
}

async function waitForServer(maxMs = 90000) {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://${HOST}:${PORT}${BASE}`);
      if (res.ok) return;
    } catch {
      /* retry */
    }
    await delay(500);
  }
  throw new Error('Preview server did not become ready in time');
}

async function auditUrl(url, chrome) {
  const result = await lighthouse(url, {
    port: chrome.port,
    output: 'json',
    logLevel: 'error',
    onlyCategories: ['accessibility', 'performance', 'best-practices'],
    settings: {
      preset: 'desktop',
      chromeFlags: ['--headless', '--no-sandbox'],
    },
  });
  return result.lhr;
}

async function main() {
  const preview = startPreview();
  preview.stdout?.on('data', () => {});
  preview.stderr?.on('data', () => {});

  let chrome;
  let failed = false;

  try {
    await waitForServer();
    chrome = await chromeLauncher.launch({ chromeFlags: ['--headless', '--no-sandbox'] });

    for (const url of URLS) {
      const lhr = await auditUrl(url, chrome);
      console.log(`\nLighthouse: ${url}`);
      for (const [category, minScore] of Object.entries(BUDGETS)) {
        const score = lhr.categories[category]?.score ?? 0;
        const pct = (score * 100).toFixed(0);
        const minPct = (minScore * 100).toFixed(0);
        const level = category === 'performance' ? 'warn' : 'error';
        const ok = score >= minScore;
        console.log(`  ${category}: ${pct}% (min ${minPct}%) ${ok ? 'OK' : 'FAIL'}`);
        if (!ok && level === 'error') failed = true;
        if (!ok && level === 'warn') {
          console.warn(`  Warning: ${category} below target on ${url}`);
        }
      }
    }
  } finally {
    if (chrome) await chrome.kill();
    preview.kill('SIGTERM');
  }

  if (failed) {
    console.error('\nLighthouse CI failed one or more required budgets.');
    process.exit(1);
  }
  console.log('\nLighthouse CI passed required budgets.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
