# Quick check: is Neon database being used?
$root = $PSScriptRoot
if (-not $root) { $root = (Get-Location).Path }

Write-Host "=== Lastivka DB Check ===" -ForegroundColor Cyan
Write-Host ""

$dbFile = Join-Path $root "neon-db.txt"
if (-not (Test-Path $dbFile)) {
  Write-Host "[X] neon-db.txt NOT found" -ForegroundColor Red
  exit 1
}
Write-Host "[OK] neon-db.txt exists" -ForegroundColor Green

$env:DATA_DIR = "$env:APPDATA\Lastivka\data"
$lines = Get-Content $dbFile -ErrorAction SilentlyContinue
foreach ($line in $lines) {
  $line = $line.Trim()
  if ($line -and $line.StartsWith('postgresql://')) {
    $env:DATABASE_URL = $line
    break
  }
}

if ($env:DATABASE_URL) {
  Write-Host "[OK] DATABASE_URL loaded" -ForegroundColor Green
  Write-Host "Starting server - look for (PostgreSQL) in the message below:" -ForegroundColor Yellow
  Write-Host ""
  node (Join-Path $root "server\index.js")
} else {
  Write-Host "[X] No postgresql:// line found in neon-db.txt" -ForegroundColor Red
  Write-Host "Add your Neon connection string on a line starting with postgresql://"
}
