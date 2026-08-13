import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";

const requiredFiles = [
  "index.html",
  "app.js",
  "styles.css",
  "manifest.webmanifest",
  "sw.js",
  "icons/icon.svg",
];

for (const file of requiredFiles) {
  if (!existsSync(file)) throw new Error(`Missing required file: ${file}`);
}

const manifest = JSON.parse(await readFile("manifest.webmanifest", "utf8"));
if (manifest.display !== "standalone") throw new Error("PWA display must be standalone");
if (manifest.id !== ".") throw new Error("PWA id must stay relative for subpath deployments");
if (manifest.start_url !== ".") throw new Error("PWA start_url must stay relative for subpath deployments");
if (manifest.scope !== ".") throw new Error("PWA scope must stay relative for subpath deployments");
if (!manifest.file_handlers?.length) throw new Error("Missing image file handlers");

const html = await readFile("index.html", "utf8");
for (const asset of ["app.js", "styles.css", "manifest.webmanifest"]) {
  if (!html.includes(asset)) throw new Error(`index.html does not reference ${asset}`);
}

const app = await readFile("app.js", "utf8");
for (const feature of ["showDirectoryPicker", "launchQueue", "ClipboardItem", "beforeinstallprompt"]) {
  if (!app.includes(feature)) throw new Error(`Missing expected feature: ${feature}`);
}

console.log("PWA checks passed");
