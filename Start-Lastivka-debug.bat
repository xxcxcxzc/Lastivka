@echo off
cd /d "%~dp0"
echo Starting Lastivka...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0run-Lastivka.ps1"
if errorlevel 1 pause
