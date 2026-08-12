import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile('index.html', 'utf8');
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
assert.match(main, /showDirectoryPicker/);
assert.match(files, /launchQueue/);
assert.match(main, /navigator\.serviceWorker/);
assert.match(serviceWorker, /CACHE_NAME/);
assert.match(state, /localeCompare/);

console.log('All EasyImage smoke tests passed.');
