#Requires -Version 5.1
# Run as Administrator to add firewall rule for Lastivka server

$ruleName = 'Lastivka Server'
$port = 3001

try {
  $existing = netsh advfirewall firewall show rule name=$ruleName 2>$null
  if ($LASTEXITCODE -eq 0) {
    Write-Host "Rule already exists." -ForegroundColor Yellow
  } else {
    netsh advfirewall firewall add rule name=$ruleName dir=in action=allow protocol=TCP localport=$port
    Write-Host "Firewall rule added for port $port" -ForegroundColor Green
  }
} catch {
  Write-Host "Error. Run script as Administrator." -ForegroundColor Red
  Write-Host "Right-click file -> Run as administrator" -ForegroundColor Gray
}
