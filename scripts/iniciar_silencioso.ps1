# ==============================================================================
# Mesa de Compras IA - Launcher Silencioso PowerShell
# Inicia o servidor em segundo plano e abre o navegador apenas quando pronto
# ==============================================================================
$ErrorActionPreference = 'SilentlyContinue'

$RootDir = Resolve-Path "$PSScriptRoot\.."
Set-Location $RootDir

# 1. Verifica se o servidor ja esta respondendo na porta 3456
try {
    $res = Invoke-WebRequest -Uri 'http://127.0.0.1:3456/api/license/status' -UseBasicParsing -TimeoutSec 1
    if ($res.StatusCode -eq 200 -or $res.StatusCode -eq 403) {
        Start-Process "http://127.0.0.1:3456"
        exit 0
    }
} catch {}

# 2. Localiza o executavel do Node.js
$nodeExe = "node"
if (Test-Path "$RootDir\bin\node.exe") {
    $nodeExe = "$RootDir\bin\node.exe"
}

# 3. Garante pasta de dados e prepara logs
if (-not (Test-Path "$RootDir\data")) {
    New-Item -ItemType Directory -Path "$RootDir\data" -Force | Out-Null
}
$logOut = "$RootDir\data\servidor_log.txt"
$logErr = "$RootDir\data\servidor_err.txt"

# 4. Inicia o processo Node de forma 100% desacoplada e oculta
Start-Process -FilePath $nodeExe `
    -ArgumentList "src\server.mjs" `
    -WorkingDirectory $RootDir `
    -WindowStyle Hidden `
    -RedirectStandardOutput $logOut `
    -RedirectStandardError $logErr

# 5. Aguarda ativamente o servidor subir na porta 3456 (ate 90 tentativas de 500ms = 45s)
$pronto = $false
for ($i = 0; $i -lt 90; $i++) {
    Start-Sleep -Milliseconds 500
    try {
        $res = Invoke-WebRequest -Uri 'http://127.0.0.1:3456/api/license/status' -UseBasicParsing -TimeoutSec 1
        if ($res.StatusCode -eq 200 -or $res.StatusCode -eq 403) {
            $pronto = $true
            break
        }
    } catch {}
}

# 6. Abre o navegador no Cockpit se estiver pronto, ou exibe aviso
if ($pronto) {
    Start-Process "http://127.0.0.1:3456"
} else {
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.MessageBox]::Show(
        "O servidor demorou mais que o esperado para responder na porta 3456.`n`nVerifique os logs em data\servidor_log.txt",
        "Mesa de Compras IA",
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Warning
    ) | Out-Null
}
