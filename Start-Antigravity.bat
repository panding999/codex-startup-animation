@echo off
title Antigravity Anime Startup Launcher
cd /d "%~dp0"

echo ========================================================
echo        ANTIGRAVITY CUSTOM STARTUP LAUNCHER
echo ========================================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [LOI] Khong tim thay Node.js tren may tinh!
    echo Vui long cai dat Node.js tai https://nodejs.org/ de tiep tuc.
    echo.
    pause
    exit /b 1
)

node bin/launcher.mjs
if %errorlevel% neq 0 (
    echo.
    echo [Luu y] Neu Antigravity dang chay, hay dong hoan toan Antigravity
    echo truoc khi chay launcher nay de xem hoat canh mo dau.
    echo.
    pause
)
