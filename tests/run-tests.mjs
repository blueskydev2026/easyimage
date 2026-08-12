import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';

const html = await readFile('index.html', 'utf8');
const builtHtml = await readFile('dist/index.html', 'utf8').catch(() => '');
const manifest = JSON.parse(await readFile('manifest.webmanifest', 'utf8'));
const publicManifest = JSON.parse(await readFile('public/manifest.webmanifest', 'utf8'));
const serviceWorker = await readFile('public/sw.js', 'utf8');
const main = await readFile('src/main.js', 'utf8');
const files = await readFile('src/files.js', 'utf8');
const state = await readFile('src/state.js', 'utf8');

assert.match(html, /lang="he"/);
assert.match(html, /dir="rtl"/);
assert.equal(manifest.display, 'standalone');
assert.deepEqual(publicManifest.file_handlers, manifest.file_handlers);
assert.ok(manifest.file_handlers?.length);
assert.ok(manifest.icons.some((icon) => icon.sizes === '192x192' && icon.type === 'image/png'));
assert.ok(manifest.icons.some((icon) => icon.sizes === '512x512' && icon.type === 'image/png'));
assert.ok((await stat('public/icons/icon-192.png')).size > 500);
assert.ok((await stat('public/icons/icon-512.png')).size > 1000);
if (builtHtml) assert.match(builtHtml, /href="\/easyimage\/manifest\.webmanifest"/);
assert.match(main, /showDirectoryPicker/);
assert.match(files, /launchQueue/);
assert.match(main, /navigator\.serviceWorker/);
assert.match(serviceWorker, /CACHE_NAME/);
assert.match(state, /localeCompare/);

console.log('All EasyImage smoke tests passed.');
