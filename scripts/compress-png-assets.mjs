/**
 * Losslessly recompress PNG assets over a size threshold (sharp png compression).
 * Usage: node scripts/compress-png-assets.mjs [--dry-run]
 */
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const assetsDir = 'src/assets';
const minBytes = 80 * 1024;
const dryRun = process.argv.includes('--dry-run');
let saved = 0;
let touched = 0;

async function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(full);
      continue;
    }
    if (!entry.name.toLowerCase().endsWith('.png')) continue;
    const stat = fs.statSync(full);
    if (stat.size < minBytes) continue;

    const before = stat.size;
    const buffer = await sharp(full)
      .png({ compressionLevel: 9, adaptiveFiltering: true, palette: true })
      .toBuffer();

    if (buffer.length >= before) continue;
    touched += 1;
    saved += before - buffer.length;
    if (!dryRun) fs.writeFileSync(full, buffer);
    console.log(`${dryRun ? '[dry-run] ' : ''}${full}: ${Math.round(before / 1024)}KB → ${Math.round(buffer.length / 1024)}KB`);
  }
}

await walk(assetsDir);
console.log(`${dryRun ? 'Would compress' : 'Compressed'} ${touched} PNG(s); saved ~${Math.round(saved / 1024)}KB`);
