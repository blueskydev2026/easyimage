$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Out = Join-Path $Root "dist/web-app"

if (Test-Path $Out) {
  Remove-Item -LiteralPath $Out -Recurse -Force
}

New-Item -ItemType Directory -Force -Path $Out | Out-Null

$files = @(
  "index.html",
  "styles.css",
  "app.js",
  "version.js",
  "manifest.webmanifest",
  "service-worker.js"
)

foreach ($file in $files) {
  Copy-Item -LiteralPath (Join-Path $Root $file) -Destination (Join-Path $Out $file) -Force
}

Copy-Item -LiteralPath (Join-Path $Root "icons") -Destination (Join-Path $Out "icons") -Recurse -Force

Write-Host "Built hosted PWA at $Out"
