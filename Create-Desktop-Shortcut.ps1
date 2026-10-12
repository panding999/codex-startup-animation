# Script to create a Desktop shortcut for Antigravity Startup Animation
$ErrorActionPreference = 'Stop'

$scriptDir = $PSScriptRoot
$targetBat = Join-Path $scriptDir "Start-Antigravity.bat"
$desktopPath = [System.Environment]::GetFolderPath('Desktop')
$shortcutPath = Join-Path $desktopPath "Antigravity (Custom Startup).lnk"

$antigravityExe = "C:\Users\Admin\AppData\Local\Programs\Antigravity\Antigravity.exe"
if (-not (Test-Path $antigravityExe)) {
    $antigravityExe = Join-Path $env:LOCALAPPDATA "Programs\Antigravity\Antigravity.exe"
}

$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut($shortcutPath)
$Shortcut.TargetPath = $targetBat
$Shortcut.WorkingDirectory = $scriptDir
$Shortcut.Description = "Khởi chạy Google Antigravity với hoạt cảnh mở đầu và hình nền tùy chỉnh"

if (Test-Path $antigravityExe) {
    $Shortcut.IconLocation = "$antigravityExe,0"
}

$Shortcut.Save()

Write-Host "==========================================================" -ForegroundColor Green
Write-Host " [THANH CONG] Da tao Shortcut tren man hinh Desktop!" -ForegroundColor Cyan
Write-Host " Duong dan: $shortcutPath" -ForegroundColor Yellow
Write-Host " Ban co the nhap dup chuot vao bieu tuong tren Desktop"
Write-Host " de khoi dong Antigravity kem hoat canh Anime bat cu luc nao!"
Write-Host "==========================================================" -ForegroundColor Green
