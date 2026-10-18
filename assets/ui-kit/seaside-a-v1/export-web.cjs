// Format export only: keep original geometry and alpha; no redraw, crop or resize.
const fs = require('node:fs');
const path = require('node:path');
const sharp = require(process.argv[2] || 'sharp');
const root = __dirname;
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'generation-manifest.json'), 'utf8'));

async function main() {
  const runtime = path.join(root, 'runtime');
  fs.mkdirSync(runtime, { recursive: true });
  const assets = [];
  await Promise.all(manifest.assets.map(async asset => {
    const input = path.join(root, 'masters', asset.id + '.png');
    const output = path.join(runtime, asset.id + '.webp');
    let existing;
    try { existing = await sharp(output).metadata(); } catch {}
    if (!existing?.hasAlpha) await sharp(input).webp({ quality: 86, alphaQuality: 100, effort: 3 }).toFile(output);
    const [source, web] = await Promise.all([sharp(input).metadata(), sharp(output).metadata()]);
    if (source.width !== web.width || source.height !== web.height || !web.hasAlpha) throw new Error('Invalid export: ' + asset.id);
    assets.push({
      id: asset.id, source: 'masters/' + asset.id + '.png', web: 'runtime/' + asset.id + '.webp',
      width: web.width, height: web.height, sourceBytes: fs.statSync(input).size, webBytes: fs.statSync(output).size,
      // Percentages of the original full canvas. Conservative initial guides;
      // per-page layout must be checked with real text before adoption.
      contentSafeArea: asset.id.startsWith('button-') ? { left: .15, top: .31, right: .85, bottom: .69 }
        : asset.id.startsWith('panel-') ? { left: .12, top: .15, right: .88, bottom: .85 }
        : asset.id === 'tag-serial' ? { left: .28, top: .28, right: .72, bottom: .83 }
        : asset.id.startsWith('control-') || asset.id.startsWith('checkbox-') ? null
        : { left: .16, top: .34, right: .84, bottom: .66 },
    });
  }));
  assets.sort((a,b)=>a.id.localeCompare(b.id));
  const report = { version: 'seaside-a-v1', generator: 'built-in imagegen', assets,
    sourceBytes: assets.reduce((n,a)=>n+a.sourceBytes,0), webBytes: assets.reduce((n,a)=>n+a.webBytes,0),
    status: 'assets-generated; first-batch-integrated', notes: 'WebP format export preserves dimensions and alpha. Text safe areas are initial guides, not final page verification.' };
  fs.writeFileSync(path.join(root, 'asset-manifest.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ count: assets.length, sourceBytes: report.sourceBytes, webBytes: report.webBytes }));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
