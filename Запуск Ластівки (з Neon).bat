@echo off
cd /d "%~dp0"
echo Starting Lastivka from project folder...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0run-Lastivka.ps1"
pause
