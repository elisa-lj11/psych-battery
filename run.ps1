Set-Location $PSScriptRoot

# Kill any stale instances
Get-Process python -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 1

Write-Host "Starting server..."
Start-Process python -ArgumentList "server.py" -WorkingDirectory $PSScriptRoot -WindowStyle Normal

Start-Sleep -Seconds 2

Write-Host "Starting CrowPanel bridge..."
Start-Process python -ArgumentList "crowpanel/charge_sender.py --port COM6" -WorkingDirectory $PSScriptRoot -WindowStyle Normal

Write-Host ""
Write-Host "Psych Battery is running."
Write-Host "  Web app : http://localhost:3131"
Write-Host "  Display : CrowPanel on COM6 (updates every 10s)"

Start-Process "http://localhost:3131"
