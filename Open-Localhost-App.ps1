param(
  [int]$Port = 8788
)

$ErrorActionPreference = "SilentlyContinue"

$appDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$url = "http://127.0.0.1:$Port/"
$profileDir = Join-Path $env:LOCALAPPDATA "EasyImageLocalhostProfile"

function Find-Browser {
  $candidates = @(
    "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
    "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
    "$env:LOCALAPPDATA\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
  )

  foreach ($candidate in $candidates) {
    if ($candidate -and (Test-Path $candidate)) {
      return $candidate
    }
  }

  return $null
}

$alive = $false
try {
  $alive = ((Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 1).StatusCode -eq 200)
} catch {
  $alive = $false
}

if (-not $alive) {
  $python = (Get-Command python -ErrorAction SilentlyContinue).Source
  if (-not $python) {
    $python = (Get-Command py -ErrorAction SilentlyContinue).Source
  }

  if (-not $python) {
    Start-Process $url
    exit
  }

  Start-Process -FilePath $python -ArgumentList @("-m", "http.server", "$Port", "--bind", "127.0.0.1") -WorkingDirectory $appDir -WindowStyle Hidden | Out-Null
  Start-Sleep -Milliseconds 800
}

$browser = Find-Browser
if ($browser) {
  Start-Process -FilePath $browser -ArgumentList @("--app=$url", "--user-data-dir=$profileDir")
} else {
  Start-Process $url
}
