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
if (manifest.id !== "/easyimage/") throw new Error("PWA id must identify the GitHub Pages app path");
if (manifest.start_url !== "/easyimage/") throw new Error("PWA start_url must target the GitHub Pages app path");
if (manifest.scope !== "/easyimage/") throw new Error("PWA scope must stay inside the GitHub Pages app path");
if (!manifest.file_handlers?.length) throw new Error("Missing image file handlers");

const html = await readFile("index.html", "utf8");
for (const asset of ["app.js", "styles.css", "manifest.webmanifest"]) {
  if (!html.includes(asset)) throw new Error(`index.html does not reference ${asset}`);
}

const app = await readFile("app.js", "utf8");
for (const feature of ["showDirectoryPicker", "launchQueue", "ClipboardItem", "beforeinstallprompt"]) {
  if (!app.includes(feature)) throw new Error(`Missing expected feature: ${feature}`);
}
if (app.includes("panStart") || app.includes("panOrigin")) {
  throw new Error("Image drag-to-pan should stay disabled");
}

const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const sw = await readFile("sw.js", "utf8");
if (!html.includes('id="appVersion"')) throw new Error("Missing subtle app version in the UI");
if (!app.includes(`const appVersion = "${packageJson.version}"`)) {
  throw new Error("App version constant must match package.json");
}
if (!sw.includes(`flow-gallery-v${packageJson.version}`)) {
  throw new Error("Service worker cache must include the app version for installed-app updates");
}

console.log("PWA checks passed");
