# Antigravity Custom Startup Launcher PowerShell Script
$ErrorActionPreference = 'Stop'
Set-Location -Path $PSScriptRoot

Write-Host "========================================================" -ForegroundColor Magenta
Write-Host "       ANTIGRAVITY CUSTOM STARTUP LAUNCHER             " -ForegroundColor Cyan
Write-Host "========================================================`n" -ForegroundColor Magenta

# Check if Node is installed
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "[LỖI] Không tìm thấy Node.js!" -ForegroundColor Red
    Write-Host "Vui lòng cài đặt Node.js từ https://nodejs.org/"
    pause
    exit 1
}

# Run Node launcher
node bin/launcher.mjs
