@echo off
chcp 65001 >nul
pushd "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\install-windows.ps1"
if errorlevel 1 (
  echo.
  echo Installation failed.
  pause
)
popd
