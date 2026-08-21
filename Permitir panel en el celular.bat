@echo off
chcp 65001 >nul
echo.
echo   ─────────────────────────────────────────────────────────────
echo    Abrir el panel del radar para tu celular
echo   ─────────────────────────────────────────────────────────────
echo.
echo    Esto le pide a Windows que deje entrar al panel desde otros
echo    aparatos de TU MISMA RED (tu celular por WiFi).
echo.
echo    La regla queda limitada a la red local: nadie de internet
echo    puede llegar al panel, solo lo que esta conectado a tu WiFi.
echo.
echo    Hay que correrlo UNA sola vez, con boton derecho ^>
echo    "Ejecutar como administrador".
echo.

net session >nul 2>&1
if errorlevel 1 (
  echo    ✖ No estas como administrador.
  echo.
  echo      Cierra esta ventana, haz clic derecho sobre este mismo
  echo      archivo y elige "Ejecutar como administrador".
  echo.
  pause
  exit /b 1
)

netsh advfirewall firewall delete rule name="Radar Crecimiento Panel" >nul 2>&1

REM profile=any porque Windows suele marcar la red de la casa como "publica".
REM remoteip=LocalSubnet mantiene la puerta cerrada para todo lo que no sea
REM tu propia red.
netsh advfirewall firewall add rule name="Radar Crecimiento Panel" ^
  dir=in action=allow protocol=TCP localport=4787 ^
  profile=any remoteip=LocalSubnet >nul

if errorlevel 1 (
  echo    ✖ No se pudo crear la regla.
) else (
  echo    ✔ Listo.
  echo.
  echo      Ahora abre "Abrir panel.bat" y usa en el celular la
  echo      direccion que aparezca en pantalla, la que dice Wi-Fi.
)
echo.
pause
