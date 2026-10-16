// Export approved artwork at UI sizes; keep the ImageGen originals unchanged.
const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require(process.argv[2] || 'sharp');
const root = path.resolve(__dirname, '..');

async function exportAsset(relativePath, width, square) {
  const source = path.join(root, 'assets', relativePath);
  const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let left = info.width, top = info.height, right = 0, bottom = 0;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * 4 + 3] > 48) {
        left = Math.min(left, x); top = Math.min(top, y);
        right = Math.max(right, x); bottom = Math.max(bottom, y);
      }
    }
  }
  left = Math.max(0, left - 4); top = Math.max(0, top - 4);
  right = Math.min(info.width - 1, right + 4); bottom = Math.min(info.height - 1, bottom + 4);
  const output = path.join(path.dirname(source), 'runtime', path.basename(source, '.png') + '.webp');
  await fs.mkdir(path.dirname(output), { recursive: true });
  await sharp(source)
    .extract({ left, top, width: right - left + 1, height: bottom - top + 1 })
    .resize({ width, ...(square ? { height: width, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } } : {}) })
    .webp({ quality: 88, alphaQuality: 100 })
    .toFile(output);
  return { source: relativePath, output: path.relative(root, output).replaceAll('\\', '/'), bytes: (await fs.stat(output)).size };
}

(async () => {
  const jobs = [
    ...['orders', 'invite', 'buy-request', 'wallet', 'settings'].map(name => [`treasury/classic-island-v1/${name}.png`, 192, true]),
    ...['empty-inventory', 'empty-mailbox', 'empty-search', 'network-unavailable'].map(name => [`empty-states/storybook-pencil-v1/${name}.png`, 360, false]),
    ...['primary-blue', 'transaction-gold', 'secondary-ivory', 'danger-terracotta'].map(name => [`buttons/colored-pencil-v1/${name}.png`, 640, false]),
  ];
  const results = await Promise.all(jobs.map(args => exportAsset(...args)));
  await fs.writeFile(path.join(root, 'assets/treasury/classic-island-v1/runtime/export-manifest.json'), JSON.stringify(results, null, 2) + '\n');
  console.log(JSON.stringify(results, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
