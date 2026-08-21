@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo   Buscando becas, cursos, congresos y convocatorias...
echo   (la primera vez puede demorar entre 20 y 35 minutos)
echo.
node src/cli.js escanear
echo.
pause
