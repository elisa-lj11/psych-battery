# Mental Meter -- full-stack manual launcher.
#
# Starts everything needed for live battery updates:
#   1. Stops any stale python processes
#   2. Starts the Flask backend (ODE model, ticks every 5 min)
#   3. Starts server.py (proxy + index.html + /state for the CrowPanel)
#   4. Starts the CrowPanel bridge (auto-detects COM port)
#   5. Opens the web app in your default browser
#
# Run from cmd: powershell -ExecutionPolicy Bypass -File C:\Users\dougl\psych-battery\run-all.ps1
# Or from this dir in PowerShell: .\run-all.ps1
#
# Each service runs in its own visible window so you can see logs and Ctrl+C
# any of them individually. Close all the windows to fully shut down.

Set-Location $PSScriptRoot

$psychBattery = $PSScriptRoot
$dpmHub = "C:\Users\dougl\dpm-research-hub"

if (-not (Test-Path $dpmHub)) {
  Write-Host "WARNING: Flask backend repo not found at $dpmHub" -ForegroundColor Yellow
  Write-Host "  Live data won't tick the ODE model. The app will fall back to ActivityWatch only." -ForegroundColor Yellow
  Write-Host ""
}

Write-Host "Mental Meter launcher" -ForegroundColor Cyan
Write-Host "==============================="
Write-Host ""

# --- 1. Kill any stale python (safe-ish: only python.exe owned by this user) ---
Write-Host "[1/5] Stopping stale python processes..." -ForegroundColor White
Get-Process python -ErrorAction SilentlyContinue |
  Where-Object { $_.SI -eq (Get-Process -Id $PID).SI } |
  Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

# --- 2. Flask backend (ODE model) ---
if (Test-Path $dpmHub) {
  Write-Host "[2/5] Starting Flask backend (ODE model, ticks every 5 min)..." -ForegroundColor White
  Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "Set-Location '$dpmHub'; Write-Host 'Flask backend - ODE model' -ForegroundColor Cyan; python -m integrations.models.main"
  ) -WindowStyle Normal
  Start-Sleep -Seconds 3
} else {
  Write-Host "[2/5] Skipping Flask backend (dpm-research-hub not found)" -ForegroundColor DarkYellow
}

# --- 3. Static server + AW proxy (server.py) ---
Write-Host "[3/5] Starting proxy server (server.py on :3131)..." -ForegroundColor White
Start-Process powershell -ArgumentList @(
  "-NoExit",
  "-Command",
  "Set-Location '$psychBattery'; Write-Host 'Proxy server (port 3131)' -ForegroundColor Cyan; python server.py"
) -WindowStyle Normal
Start-Sleep -Seconds 2

# --- 4. CrowPanel bridge (auto-detect port) ---
$crowPort = $null
try {
  $portList = python crowpanel/charge_sender.py --list 2>&1
  foreach ($line in ($portList -split "`n")) {
    if ($line -match "(COM\d+)") {
      $crowPort = $Matches[1].Trim()
      break
    }
  }
} catch {}

if ($crowPort) {
  Write-Host "[4/5] Starting CrowPanel bridge on $crowPort (10s polling)..." -ForegroundColor White
  Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "Set-Location '$psychBattery'; Write-Host 'CrowPanel bridge on $crowPort' -ForegroundColor Cyan; python crowpanel/charge_sender.py --port $crowPort"
  ) -WindowStyle Normal
} else {
  Write-Host "[4/5] CrowPanel not found - no COM port detected." -ForegroundColor DarkYellow
  Write-Host "       Install the CH340 driver, then re-run run-all." -ForegroundColor DarkYellow
}
Start-Sleep -Seconds 1

# --- 5. Open the web app ---
Write-Host "[5/5] Opening browser at http://localhost:3131..." -ForegroundColor White
Start-Process "http://localhost:3131"

Write-Host ""
Write-Host "All services launched in separate windows." -ForegroundColor Green
Write-Host "  Web app   : http://localhost:3131"
Write-Host "  Flask     : ticking the ODE model every 5 min"
if ($crowPort) {
  Write-Host "  CrowPanel : $crowPort, updating every 10s"
} else {
  Write-Host "  CrowPanel : NOT STARTED - install CH340 driver then re-run run-all" -ForegroundColor DarkYellow
}
Write-Host ""
Write-Host "To stop everything, close the four PowerShell windows." -ForegroundColor Gray
Write-Host ""
