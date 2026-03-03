#Requires -Version 5.1
$ErrorActionPreference = 'Stop'
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

Write-Host ''
Write-Host '  Lastivka - build Lastivka.exe' -ForegroundColor Cyan
Write-Host ''

if (-not (Get-Module -ListAvailable -Name ps2exe)) {
  Write-Host '  [*] Installing PS2EXE module (first time only)...' -ForegroundColor Yellow
  Write-Host '      If prompted, type Y and press Enter.' -ForegroundColor DarkGray
  Install-Module -Name ps2exe -Scope CurrentUser -Force -AllowClobber
  Write-Host '  [OK] PS2EXE installed.' -ForegroundColor Green
  Write-Host ''
}

Import-Module ps2exe -ErrorAction Stop

$inputPs1 = Join-Path $scriptDir 'install-Lastivka.ps1'
$outputExe = Join-Path $scriptDir 'Lastivka.exe'

if (-not (Test-Path $inputPs1)) {
  Write-Host '  [!] install-Lastivka.ps1 not found.' -ForegroundColor Red
  exit 1
}

Write-Host '  [*] Creating Lastivka.exe...' -ForegroundColor White
Invoke-ps2exe -inputFile $inputPs1 -outputFile $outputExe -title 'Lastivka Installer'
Write-Host ''
Write-Host '  [OK] Done: Lastivka.exe' -ForegroundColor Green
Write-Host $outputExe -ForegroundColor DarkGray
Write-Host ''
