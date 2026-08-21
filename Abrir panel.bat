@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo   Trayendo lo ultimo que encontro el radar en la nube...
echo.
node src/cli.js sincronizar
echo.
echo   Abriendo el panel...
node src/servidor.js
pause
