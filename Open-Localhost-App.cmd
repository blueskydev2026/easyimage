@echo off
chcp 65001 >nul
pushd "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\Open-Localhost-App.ps1"
if errorlevel 1 (
  echo.
  echo Failed to open local app.
  pause
)
popd
