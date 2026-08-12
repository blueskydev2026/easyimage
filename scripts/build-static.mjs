import { cp, mkdir, rm } from "node:fs/promises";

const files = [
  "index.html",
  "app.js",
  "styles.css",
  "manifest.webmanifest",
  "sw.js",
  "README.md",
];

await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });

for (const file of files) {
  await cp(file, `dist/${file}`);
}

await cp("icons", "dist/icons", { recursive: true });

console.log("Static build written to dist");
