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
if (!app.includes("panOrigin") || !app.includes("document.body.classList.add(\"panning\")")) {
  throw new Error("Image drag-to-pan should be enabled");
}
if (!app.includes("event.deltaY > 0 ? 0.9 : 1.1")) {
  throw new Error("Mouse wheel should zoom the image");
}
if (!app.includes('addEventListener("dragstart"')) {
  throw new Error("Native browser image dragging must be prevented");
}
if (!html.includes('id="confirmCropBtn"') || !html.includes('id="cancelCropBtn"')) {
  throw new Error("Crop confirmation actions must be available on the image");
}
if (!app.includes("saveNewFileBlob(blob, croppedFileName(image.name), image.dirHandle)")) {
  throw new Error("Crop save must create a new file instead of replacing the active image");
}
if (!app.includes("@page { size: A4 ${options.orientation}; margin: 7mm; }")) {
  throw new Error("Print output must use a safe page margin to avoid clipped photos");
}
if (!app.includes("image.decode")) {
  throw new Error("Print output must wait for images before printing");
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
