$ErrorActionPreference = "Stop"

$appName = "Photo Manager"
$displayName = "Photo Manager"
$sourceDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$installDir = Join-Path $env:LOCALAPPDATA "PhotoManager"
$startMenuDir = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs"
$desktopDir = [Environment]::GetFolderPath("Desktop")
$launcher = Join-Path $installDir "launch-photo-manager.ps1"

function Copy-AppFiles {
  New-Item -ItemType Directory -Force -Path $installDir | Out-Null
  Copy-Item -Path (Join-Path $sourceDir "index.html") -Destination $installDir -Force
  Copy-Item -Path (Join-Path $sourceDir "styles.css") -Destination $installDir -Force
  Copy-Item -Path (Join-Path $sourceDir "app.js") -Destination $installDir -Force
  Copy-Item -Path (Join-Path $sourceDir "manifest.webmanifest") -Destination $installDir -Force
  Copy-Item -Path (Join-Path $sourceDir "service-worker.js") -Destination $installDir -Force
  Copy-Item -Path (Join-Path $sourceDir "icons") -Destination $installDir -Recurse -Force
  Copy-Item -Path (Join-Path $sourceDir "launch-photo-manager.ps1") -Destination $installDir -Force
  Copy-Item -Path (Join-Path $sourceDir "uninstall-windows.ps1") -Destination $installDir -Force
}

function New-AppShortcut($path) {
  $shell = New-Object -ComObject WScript.Shell
  $shortcut = $shell.CreateShortcut($path)
  $shortcut.TargetPath = "powershell.exe"
  $shortcut.Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$launcher`""
  $shortcut.WorkingDirectory = $installDir
  $shortcut.Description = $displayName
  $shortcut.IconLocation = "shell32.dll,131"
  $shortcut.Save()
}

function Register-UninstallEntry {
  $key = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\PhotoManager"
  New-Item -Path $key -Force | Out-Null
  New-ItemProperty -Path $key -Name "DisplayName" -Value $displayName -PropertyType String -Force | Out-Null
  New-ItemProperty -Path $key -Name "Publisher" -Value "Local app" -PropertyType String -Force | Out-Null
  New-ItemProperty -Path $key -Name "InstallLocation" -Value $installDir -PropertyType String -Force | Out-Null
  New-ItemProperty -Path $key -Name "DisplayIcon" -Value "shell32.dll,131" -PropertyType String -Force | Out-Null
  New-ItemProperty -Path $key -Name "UninstallString" -Value "powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$installDir\uninstall-windows.ps1`"" -PropertyType String -Force | Out-Null
}

function Register-OpenWith {
  $progId = "PhotoManager.Local"
  $command = "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$launcher`" `"%1`""
  New-Item -Path "HKCU:\Software\Classes\$progId\shell\open\command" -Force | Out-Null
  Set-Item -Path "HKCU:\Software\Classes\$progId" -Value $displayName
  Set-Item -Path "HKCU:\Software\Classes\$progId\shell\open\command" -Value $command

  foreach ($ext in ".jpg", ".jpeg", ".png", ".webp", ".bmp", ".gif", ".avif") {
    New-Item -Path "HKCU:\Software\Classes\$ext\OpenWithProgids" -Force | Out-Null
    New-ItemProperty -Path "HKCU:\Software\Classes\$ext\OpenWithProgids" -Name $progId -Value ([byte[]]@()) -PropertyType Binary -Force | Out-Null
  }
}

Copy-AppFiles
New-AppShortcut (Join-Path $desktopDir "$displayName.lnk")
New-AppShortcut (Join-Path $startMenuDir "$displayName.lnk")
Register-UninstallEntry
Register-OpenWith

Write-Host ""
Write-Host "Installed: $displayName"
Write-Host "Desktop shortcut and Start Menu shortcut were created."
Write-Host "To set as default image app: Windows Settings > Apps > Default apps > choose '$displayName' or use 'Open with'."
Write-Host ""
if ($Host.Name -eq "ConsoleHost") {
  Read-Host "Press Enter to close"
}
