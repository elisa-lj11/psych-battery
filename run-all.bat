@echo off
REM Mental Meter — manual launcher (cmd-friendly).
REM
REM Just type:  run-all
REM
REM This calls the PowerShell launcher with execution policy bypassed,
REM so you don't need to set Set-ExecutionPolicy.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0run-all.ps1"
