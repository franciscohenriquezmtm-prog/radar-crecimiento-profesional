@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo   Plazos de los proximos 12 meses
echo.
node src/cli.js horizonte 12
echo.
pause
