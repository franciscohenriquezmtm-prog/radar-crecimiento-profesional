@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo   Programando el radar para que busque y te mande el correo
echo   todos los dias a las 08:30, con este computador encendido.
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0instalar-tarea-windows.ps1"
echo.
pause
