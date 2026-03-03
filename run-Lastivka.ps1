#Requires -Version 5.1
$ErrorActionPreference = 'Stop'

function Show-Error($msg) {
  try {
    Add-Type -AssemblyName System.Windows.Forms -ErrorAction SilentlyContinue
    [System.Windows.Forms.MessageBox]::Show($msg, 'Lastivka', 'OK', 'Error')
  } catch {
    Write-Host "Lastivka error: $msg"
    cmd /c pause
  }
}

$root = $PSScriptRoot
if (-not $root) { $root = (Get-Location).Path }
Set-Location $root

$nodeExe = $null
$candidates = @(
  (Get-Command node -ErrorAction SilentlyContinue).Path,
  "$env:ProgramFiles\nodejs\node.exe",
  "${env:ProgramFiles(x86)}\nodejs\node.exe",
  "$env:LOCALAPPDATA\Programs\node\node.exe",
  "$env:APPDATA\nvm\current\node.exe"
)
foreach ($p in $candidates) {
  if ($p -and (Test-Path -LiteralPath $p)) { $nodeExe = $p; break }
}
if (-not $nodeExe) {
  Show-Error "Node.js not found. Install LTS from https://nodejs.org (restart PC after install), then run Lastivka again."
  exit 1
}

$env:DATA_DIR = "$env:APPDATA\Lastivka\data"

# Load DATABASE_URL from neon-db.txt (for shared Neon database)
$dbFile = Join-Path $root "neon-db.txt"
if (Test-Path $dbFile) {
  $lines = Get-Content $dbFile -ErrorAction SilentlyContinue
  foreach ($line in $lines) {
    $line = $line.Trim()
    if (-not $line -or $line.StartsWith('#')) { continue }
    if ($line -match 'DATABASE_URL=(.+)') {
      $env:DATABASE_URL = $Matches[1].Trim()
    } elseif ($line.StartsWith('postgresql://')) {
      $env:DATABASE_URL = $line
    }
    if ($env:DATABASE_URL) { break }
  }
}

# Kill any existing Lastivka server on port 3001 (old process = old API, no profile update)
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

$distPath = Join-Path $root "dist"
if (-not (Test-Path $distPath)) {
  Show-Error "Folder 'dist' not found. Run install-Lastivka.ps1 once in the app folder."
  exit 1
}

try {
  Start-Process -FilePath $nodeExe -ArgumentList "server\index.js" -WorkingDirectory $root -WindowStyle Hidden
} catch {
  Show-Error "Failed to start server: $_"
  exit 1
}

Start-Sleep -Seconds 3

$electronExe = Join-Path $root "node_modules\electron\dist\electron.exe"
if (-not (Test-Path $electronExe)) {
  Show-Error "Electron not found. Run install-Lastivka.ps1 in the app folder."
  exit 1
}
try {
  Start-Process -FilePath $electronExe -ArgumentList "." -WorkingDirectory $root
} catch {
  Show-Error "Failed to open window: $_"
  exit 1
}
