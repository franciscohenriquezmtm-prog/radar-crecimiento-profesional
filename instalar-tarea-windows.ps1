# Programa el radar para que se ejecute solo, todos los dias, en este computador.
#
#   Instalar:    .\instalar-tarea-windows.ps1
#   Desinstalar: .\instalar-tarea-windows.ps1 -Quitar
#
# Es la opcion simple: no necesita GitHub, ni cuentas, ni secretos. Lo unico es
# que solo corre con el computador encendido. Si un dia estaba apagado a la hora
# prevista, Windows lo intenta apenas lo prendas.

param(
    [switch]$Quitar,
    [string[]]$Horas = @('08:30')
)

$ErrorActionPreference = 'Stop'
$Nombre  = 'Radar Crecimiento Profesional'
$Carpeta = $PSScriptRoot

function Buscar-Node {
    $cmd = Get-Command node -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    foreach ($p in @("$env:ProgramFiles\nodejs\node.exe", "${env:ProgramFiles(x86)}\nodejs\node.exe", "$env:LOCALAPPDATA\Programs\nodejs\node.exe")) {
        if (Test-Path $p) { return $p }
    }
    throw "No encuentro node.exe. Instala Node.js desde https://nodejs.org y vuelve a intentarlo."
}

if ($Quitar) {
    if (Get-ScheduledTask -TaskName $Nombre -ErrorAction SilentlyContinue) {
        Unregister-ScheduledTask -TaskName $Nombre -Confirm:$false
        Write-Host "`n  Tarea eliminada. El radar ya no se ejecutara solo.`n" -ForegroundColor Yellow
    } else {
        Write-Host "`n  No habia ninguna tarea instalada.`n" -ForegroundColor Yellow
    }
    return
}

$Node = Buscar-Node
Write-Host "`n  Node encontrado en: $Node"

if (-not (Test-Path (Join-Path $Carpeta '.env'))) {
    Write-Host "`n  ATENCION: todavia no existe el archivo .env, asi que no podra mandarte correo." -ForegroundColor Yellow
    Write-Host "  Copia .env.example como .env y pon la clave de aplicacion de Gmail.`n" -ForegroundColor Yellow
}

# escanear --avisar: busca y, al terminar, manda el correo del dia.
$accion = New-ScheduledTaskAction -Execute $Node `
    -Argument ('"{0}" escanear --avisar' -f (Join-Path $Carpeta 'src\cli.js')) `
    -WorkingDirectory $Carpeta

$disparadores = foreach ($h in $Horas) { New-ScheduledTaskTrigger -Daily -At $h }

$opciones = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -DontStopOnIdleEnd `
    -ExecutionTimeLimit (New-TimeSpan -Hours 1) `
    -RestartCount 2 -RestartInterval (New-TimeSpan -Minutes 10) `
    -MultipleInstances IgnoreNew

Register-ScheduledTask -TaskName $Nombre -Action $accion -Trigger $disparadores `
    -Settings $opciones -Description 'Busca becas, cursos, congresos y convocatorias de crecimiento profesional para tecnologia medica, y manda el correo del dia.' `
    -Force | Out-Null

Write-Host "`n  Listo. El radar va a buscar y a mandarte el correo todos los dias a las: $($Horas -join ', ')" -ForegroundColor Green
Write-Host "  Solo funciona con el computador encendido. Si estaba apagado, lo intenta al prenderlo."
Write-Host "`n  Probar ahora mismo:  Start-ScheduledTask -TaskName '$Nombre'"
Write-Host "  Ver como le fue:     Get-ScheduledTaskInfo -TaskName '$Nombre'"
Write-Host "  Quitar la tarea:     .\instalar-tarea-windows.ps1 -Quitar`n"
