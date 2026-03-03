#Requires -Version 5.1
$ErrorActionPreference = 'Stop'

$root = $PSScriptRoot
if (-not $root) { $root = (Get-Location).Path }
Set-Location $root

Write-Host ''
Write-Host '=== Ластівка — режим сервера ===' -ForegroundColor Cyan
Write-Host ''

# Find Node.js
$nodeExe = (Get-Command node -ErrorAction SilentlyContinue).Path
if (-not $nodeExe) {
  Write-Host '[!] Node.js не знайдено. Встановіть з https://nodejs.org' -ForegroundColor Red
  Read-Host 'Натисніть Enter для виходу'
  exit 1
}

# Data directory
$env:DATA_DIR = "$env:APPDATA\Lastivka\data"

# Stop old server on port 3001
$port = 3001
try {
  $conn = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
  if ($conn) {
    $conn | ForEach-Object {
      $proc = Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue
      if ($proc -and $proc.ProcessName -eq 'node') {
        Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
      }
    }
    Start-Sleep -Seconds 1
  }
} catch {
  $netstat = netstat -ano 2>$null | Select-String ":\s*$port\s+"
  if ($netstat) {
    $netstat | ForEach-Object {
      if ($_ -match '\s+(\d+)\s*$') {
        $pid = $Matches[1]
        $proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
        if ($proc -and $proc.ProcessName -eq 'node') {
          Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
        }
      }
    }
    Start-Sleep -Seconds 1
  }
}

# Get local IP addresses
$ips = @()
try {
  $ips = Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notmatch 'Loopback' -and $_.IPAddress -notmatch '^169\.' } | ForEach-Object { $_.IPAddress }
} catch {
  $ips = @('192.168.1.1')  # fallback
}
if ($ips.Count -eq 0) { $ips = @('127.0.0.1') }

Write-Host 'Сервер запускається на порту 3001...' -ForegroundColor White
Write-Host ''
Write-Host 'Інші ПК підключаються за адресами:' -ForegroundColor Green
foreach ($ip in $ips) {
  Write-Host "  http://${ip}:3001" -ForegroundColor Yellow
}
Write-Host ''
Write-Host 'Якщо не підключаються:' -ForegroundColor White
Write-Host '  1. Дозвольте порт 3001 у брандмауері Windows' -ForegroundColor Gray
Write-Host '  2. ПК мають бути в одній мережі (Wi‑Fi/LAN)' -ForegroundColor Gray
Write-Host ''
Write-Host 'Для виходу натисніть Ctrl+C' -ForegroundColor Gray
Write-Host ''

# Run server (foreground)
node server/index.js
