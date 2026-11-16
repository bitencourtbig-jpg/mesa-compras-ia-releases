# ==============================================================================
# Configura Inicializacao Automatica com o Windows • BIG Compras AI
# ==============================================================================
param(
    [switch]$Desabilitar
)

$rootDir = (Resolve-Path "$PSScriptRoot\..").Path
$startupDir = [Environment]::GetFolderPath('Startup')
$targetLnk = Join-Path $startupDir 'BIG Compras AI.lnk'

if ($Desabilitar) {
    if (Test-Path $targetLnk) {
        Remove-Item $targetLnk -Force
        Write-Host "[OK] Inicializacao automatica removida com sucesso de:" -ForegroundColor Yellow
        Write-Host "     $targetLnk"
    } else {
        Write-Host "[INFO] A inicializacao automatica nao estava ativa." -ForegroundColor Cyan
    }
    exit 0
}

$vbsPath = Join-Path $rootDir 'iniciar_sistema.vbs'
$iconPath = Join-Path $rootDir 'assets\icone_big_compras.ico'

$ws = New-Object -ComObject WScript.Shell
$sc = $ws.CreateShortcut($targetLnk)
$sc.TargetPath = 'wscript.exe'
$sc.Arguments = "`"$vbsPath`""
$sc.WorkingDirectory = $rootDir
if (Test-Path $iconPath) {
    $sc.IconLocation = $iconPath
}
$sc.Description = 'BIG Compras AI - Inicializacao Automatica Silenciosa'
$sc.Save()

Write-Host "======================================================================" -ForegroundColor Green
Write-Host "  SUCESSO! Inicializacao automatica configurada com sucesso." -ForegroundColor Green
Write-Host "  Atalho criado em: $targetLnk" -ForegroundColor White
Write-Host "======================================================================" -ForegroundColor Green
Write-Host "Sempre que o computador reiniciar, o servidor subira em segundo plano"
Write-Host "e abrira o Cockpit no navegador sem qualquer janela preta de console."
