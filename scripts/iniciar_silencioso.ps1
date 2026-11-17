# ==============================================================================
# Mesa de Compras IA - Launcher Silencioso PowerShell
# Inicia o servidor em segundo plano e abre o navegador apenas quando pronto
# ==============================================================================
$ErrorActionPreference = 'SilentlyContinue'

$RootDir = Resolve-Path "$PSScriptRoot\.."
Set-Location $RootDir

function Test-Port3456 {
    param([int]$TimeoutMs = 300)
    try {
        $tcp = New-Object System.Net.Sockets.TcpClient
        $iar = $tcp.BeginConnect("127.0.0.1", 3456, $null, $null)
        $wait = $iar.AsyncWaitHandle.WaitOne($TimeoutMs, $false)
        if ($wait) {
            $tcp.EndConnect($iar)
            $tcp.Close()
            return $true
        }
        $tcp.Close()
        return $false
    } catch {
        return $false
    }
}

# 1. Se a porta 3456 ja estiver respondendo ativamente, abre direto o navegador
if (Test-Port3456 -TimeoutMs 400) {
    Start-Process "http://127.0.0.1:3456"
    exit 0
}

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

# 4. Inicia o processo Node em segundo plano (desacoplado e silencioso)
Start-Process -FilePath $nodeExe `
    -ArgumentList "src\server.mjs" `
    -WorkingDirectory $RootDir `
    -WindowStyle Hidden `
    -RedirectStandardOutput $logOut `
    -RedirectStandardError $logErr

# 5. Aguarda ativamente o servidor subir na porta 3456 (ate 60 tentativas de 500ms = 30s)
$pronto = $false
for ($i = 0; $i -lt 60; $i++) {
    Start-Sleep -Milliseconds 500
    if (Test-Port3456 -TimeoutMs 300) {
        $pronto = $true
        break
    }
}

# 6. Abre o navegador no Cockpit se estiver pronto, ou exibe aviso
if ($pronto) {
    Start-Sleep -Milliseconds 300
    Start-Process "http://127.0.0.1:3456"
} else {
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.MessageBox]::Show(
        "O servidor demorou mais que o esperado para responder na porta 3456.`n`nVerifique os logs em data\servidor_err.txt",
        "Mesa de Compras IA",
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Warning
    ) | Out-Null
}
