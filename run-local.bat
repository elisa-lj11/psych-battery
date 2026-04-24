@echo off
REM run-local.bat -- start psych-battery-app locally (Windows)
REM Usage: run-local.bat [dpm-hub-path]
REM   dpm-hub-path defaults to ..\dpm-research-hub (sibling directory)

setlocal enabledelayedexpansion

set "SCRIPT_DIR=%~dp0"
REM Remove trailing backslash
if "%SCRIPT_DIR:~-1%"=="\" set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"

REM Default dpm-hub path (sibling directory)
set "DPM_HUB=%SCRIPT_DIR%\..\dpm-research-hub"

REM Accept optional first argument as dpm-hub path
if not "%~1"=="" (
  set "DPM_HUB=%~1"
)

echo.
echo ================================================
echo  Psych Battery - Local Launcher (Windows)
echo ================================================
echo.

REM Check ActivityWatch
echo Checking ActivityWatch at localhost:5600...
powershell -NoProfile -Command ^
  "try { $r = Invoke-WebRequest -Uri 'http://localhost:5600/api/0/info' -UseBasicParsing -TimeoutSec 2; Write-Host '  OK ActivityWatch is running.' } catch { Write-Host '  Warning: ActivityWatch not detected at localhost:5600.'; Write-Host '  Full mode requires AW running. Download from: https://activitywatch.net/'; Write-Host '  Continuing -- app will work in demo mode without AW.' }"
echo.

REM Start Flask backend if dpm-hub exists
if exist "%DPM_HUB%" (
  echo Starting Flask backend from %DPM_HUB% ...
  start "Flask Backend" cmd /k "cd /d "%DPM_HUB%" && python -m integrations.models.main"
  echo   Flask backend window opened.
) else (
  echo   Warning: dpm-research-hub not found at '%DPM_HUB%'.
  echo   Pass the path as the first argument: run-local.bat C:\path\to\dpm-research-hub
  echo   Continuing -- app will work in demo mode without the Flask backend.
)
echo.

REM Start proxy server
echo Starting proxy server from %SCRIPT_DIR% ...
start "Proxy Server" cmd /k "cd /d "%SCRIPT_DIR%" && python server.py"
echo   Proxy server window opened.
echo.

REM Wait ~2 seconds then open browser
echo Waiting for servers to initialize...
ping localhost -n 3 > /dev/null

echo Opening browser at http://localhost:3131
start "" http://localhost:3131

echo.
echo ================================================
echo  Psych Battery is running at http://localhost:3131
echo.
echo  To stop: close the "Flask Backend" and
echo            "Proxy Server" command windows.
echo ================================================
echo.

endlocal
