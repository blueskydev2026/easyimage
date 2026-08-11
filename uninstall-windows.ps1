$ErrorActionPreference = "SilentlyContinue"

$displayName = "Photo Manager"
$installDir = Join-Path $env:LOCALAPPDATA "PhotoManager"
$desktopShortcut = Join-Path ([Environment]::GetFolderPath("Desktop")) "$displayName.lnk"
$startShortcut = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\$displayName.lnk"

Remove-Item -LiteralPath $desktopShortcut -Force
Remove-Item -LiteralPath $startShortcut -Force
Remove-Item -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\PhotoManager" -Recurse -Force
Remove-Item -Path "HKCU:\Software\Classes\PhotoManager.Local" -Recurse -Force

foreach ($ext in ".jpg", ".jpeg", ".png", ".webp", ".bmp", ".gif", ".avif") {
  Remove-ItemProperty -Path "HKCU:\Software\Classes\$ext\OpenWithProgids" -Name "PhotoManager.Local" -Force
}

Remove-Item -LiteralPath $installDir -Recurse -Force

Write-Host "Uninstalled: $displayName"
if ($Host.Name -eq "ConsoleHost") {
  Read-Host "Press Enter to close"
}
