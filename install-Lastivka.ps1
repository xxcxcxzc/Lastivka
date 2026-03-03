#Requires -Version 5.1
$ErrorActionPreference = 'Stop'
$Host.UI.RawUI.WindowTitle = 'Lastivka Installer'

function Write-Step($text) { Write-Host "  [*] $text" -ForegroundColor White }
function Write-Ok($text)   { Write-Host "  [OK] $text" -ForegroundColor Green }
function Write-Fail($text) { Write-Host "  [!] $text" -ForegroundColor Red }

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $scriptDir) { $scriptDir = (Get-Location).Path }
Set-Location $scriptDir

Write-Host ''
Write-Host '=== Lastivka installer ===' -ForegroundColor Cyan
Write-Host ''

# 1. Check Node.js
Write-Step 'Checking Node.js...'
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
  Write-Fail 'Node.js not found. Install from https://nodejs.org and run this script again.'
  Read-Host 'Press Enter to exit'
  exit 1
}

# 2. npm install in root
Write-Step 'Installing root dependencies (npm install)...'
try {
  npm install
  Write-Ok 'Root dependencies installed.'
} catch {
  Write-Fail "npm install failed: $_"
  Read-Host 'Press Enter to exit'
  exit 1
}

# 3. npm install in server
Write-Step 'Installing server dependencies (cd server && npm install)...'
$serverPath = Join-Path $scriptDir 'server'
if (-not (Test-Path $serverPath)) {
  Write-Fail 'Folder \"server\" not found.'
  Read-Host 'Press Enter to exit'
  exit 1
}
Push-Location $serverPath
try {
  npm install
  Write-Ok 'Server dependencies installed.'
} catch {
  Write-Fail "server npm install failed: $_"
  Pop-Location
  Read-Host 'Press Enter to exit'
  exit 1
}
Pop-Location

# 4. Build frontend (dist)
Write-Step 'Building frontend (npm run build)...'
Set-Location $scriptDir
try {
  npm run build
  Write-Ok 'Frontend built (dist folder created).'
} catch {
  Write-Fail "build failed: $_"
  Read-Host 'Press Enter to exit'
  exit 1
}

Write-Host ''
Write-Host '==========================================' -ForegroundColor Green
Write-Ok 'Installation finished successfully.'
Write-Host '==========================================' -ForegroundColor Green
Write-Host ''
Write-Host 'You can now start Lastivka from the desktop/Start menu shortcut.' -ForegroundColor White
Write-Host ''

$run = Read-Host 'Run Lastivka now? (Y/N)'
if ($run -eq 'Y' -or $run -eq 'y') {
  & "$scriptDir\start-Lastivka.vbs"
} else {
  Read-Host 'Press Enter to exit'
}