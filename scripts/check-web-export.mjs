// Validate route chunks and initial-transfer budgets before publishing a web export.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

const root = path.resolve(process.argv[2] || 'dist');
async function files(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map(entry => entry.isDirectory()
    ? files(path.join(directory, entry.name)) : path.join(directory, entry.name)))).flat();
}
const pages = (await files(root)).filter(file => file.endsWith('.html'));
const results = [];
for (const file of pages) {
  const html = await fs.readFile(file, 'utf8');
  const scripts = [...html.matchAll(/<script\b[^>]*\bsrc="([^"?#]+\.js)"/g)].map(match => match[1]);
  assert(scripts.length > 0, `No scripts in ${file}`);
  let bytes = 0;
  let gzipBytes = 0;
  for (const src of new Set(scripts)) {
    assert(src.startsWith('/_expo/static/js/web/'), `Unexpected script origin: ${src}`);
    const resolved = path.resolve(root, '.' + src);
    assert(resolved.startsWith(root + path.sep), `Script escapes export: ${src}`);
    const body = await fs.readFile(resolved);
    bytes += body.length;
    gzipBytes += gzipSync(body).length;
  }
  assert(!/<link\b[^>]*\bas="font"/.test(html), `Font preload leaked into ${file}`);
  results.push({ page: path.relative(root, file), scripts: scripts.length, bytes, gzipBytes });
}
const home = results.find(row => row.page === 'index.html');
assert(home, 'Homepage missing');
assert(home.gzipBytes < 550_000, `Homepage gzip JS exceeds 550KB budget: ${home.gzipBytes}`);
console.log(JSON.stringify({ checkedPages: pages.length, homepage: home, pages: results }, null, 2));
