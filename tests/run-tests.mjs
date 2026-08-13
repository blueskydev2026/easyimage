import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";

const requiredFiles = [
  "index.html",
  "app.js",
  "styles.css",
  "manifest.json",
  "sw.js",
  "icons/icon.svg",
];

for (const file of requiredFiles) {
  if (!existsSync(file)) throw new Error(`Missing required file: ${file}`);
}

const manifest = JSON.parse(await readFile("manifest.json", "utf8"));
if (manifest.display !== "standalone") throw new Error("PWA display must be standalone");
if (manifest.id !== ".") throw new Error("PWA id must stay relative for subpath deployments");
if (manifest.start_url !== ".") throw new Error("PWA start_url must stay relative for subpath deployments");
if (manifest.scope !== ".") throw new Error("PWA scope must stay relative for subpath deployments");
if (!manifest.file_handlers?.length) throw new Error("Missing image file handlers");

const html = await readFile("index.html", "utf8");
for (const asset of ["app.js", "styles.css", "manifest.json"]) {
  if (!html.includes(asset)) throw new Error(`index.html does not reference ${asset}`);
}

const app = await readFile("app.js", "utf8");
for (const feature of ["showDirectoryPicker", "launchQueue", "ClipboardItem", "beforeinstallprompt"]) {
  if (!app.includes(feature)) throw new Error(`Missing expected feature: ${feature}`);
}

const serviceWorker = await readFile("sw.js", "utf8");
const cachedAssets = serviceWorker.match(/const ASSETS = \[([\s\S]*?)\];/)?.[1] ?? "";
if (cachedAssets.includes("manifest.json")) {
  throw new Error("Blocked network manifest must not be part of the install cache");
}
for (const feature of ["MANIFEST_PATH", "application/manifest+json", "new Response(JSON.stringify(MANIFEST)"]) {
  if (!serviceWorker.includes(feature)) throw new Error(`Missing synthetic manifest feature: ${feature}`);
}

console.log("PWA checks passed");
