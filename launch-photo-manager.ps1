param(
  [string]$FileToOpen
)

$ErrorActionPreference = "SilentlyContinue"

$appDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$port = 8794
$url = "http://127.0.0.1:$port/"

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

$server = Get-NetTCPConnection -LocalAddress 127.0.0.1 -LocalPort $port -State Listen -ErrorAction SilentlyContinue
if (-not $server) {
  $python = (Get-Command python -ErrorAction SilentlyContinue).Source
  if (-not $python) {
    $python = (Get-Command py -ErrorAction SilentlyContinue).Source
  }

  if ($python) {
    Start-Process -FilePath $python -ArgumentList @("-m", "http.server", "$port", "--bind", "127.0.0.1") -WorkingDirectory $appDir -WindowStyle Hidden | Out-Null
    Start-Sleep -Milliseconds 900
  }
}

$browser = Find-Browser
if ($browser) {
  Start-Process -FilePath $browser -ArgumentList @("--app=$url", "--user-data-dir=$env:LOCALAPPDATA\PhotoManager\BrowserProfile")
} else {
  Start-Process $url
}
