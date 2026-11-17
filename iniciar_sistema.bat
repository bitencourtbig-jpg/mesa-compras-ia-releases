@echo off
setlocal
title Mesa de Compras IA (Console Tecnico FSConsultoria)
color 0A
cd /d "%~dp0"

echo ======================================================================
echo    MESA DE COMPRAS IA - FSCONSULTORIA FARMACEUTICA
echo    Tecnologia e Inteligencia em Abastecimento para Farmacias
echo ======================================================================
echo.

set "NODE_EXEC=%~dp0bin\node.exe"
if not exist "%NODE_EXEC%" (
    set "NODE_EXEC=node"
)

echo [*] Verificando runtime Node.js em: %NODE_EXEC%
"%NODE_EXEC%" -v > nul 2>&1
if errorlevel 1 (
    color 0C
    echo.
    echo [ERRO] Runtime Node.js nao pode ser executado.
    echo Verifique se o arquivo bin\node.exe existe no pacote.
    echo Caminho testado: %NODE_EXEC%
    echo.
    pause
    exit /b 1
)

echo [*] Runtime Node.js validado com sucesso.

rem Se a porta 3456 ja estiver ativa, abre direto sem subir duplicado
powershell -NoProfile -Command "$t = New-Object Net.Sockets.TcpClient; try { $t.Connect('127.0.0.1', 3456); $t.Close(); exit 0 } catch { exit 1 }"
if %errorlevel% equ 0 (
    echo [*] Servidor ja esta rodando na porta 3456! Abrindo navegador...
    start "" "http://127.0.0.1:3456"
    exit /b 0
)

echo [*] Iniciando servidor analitico local em segundo plano...
start "Mesa de Compras IA - Servidor" /min "%NODE_EXEC%" --no-warnings "%~dp0src\server.mjs"

echo [*] Aguardando o servidor ficar pronto na porta 3456...
powershell -NoProfile -Command "$ready = $false; for ($i=0; $i -lt 60; $i++) { Start-Sleep -Milliseconds 500; try { $t = New-Object Net.Sockets.TcpClient; $t.Connect('127.0.0.1', 3456); $t.Close(); $ready = $true; break } catch {} }; if ($ready) { exit 0 } else { exit 1 }"

if %errorlevel% neq 0 (
    echo.
    echo [AVISO] O servidor esta levando mais tempo que o normal para responder.
    echo Tente abrir manualmente no navegador: http://127.0.0.1:3456
    pause
    exit /b 1
)

echo [*] Servidor pronto e conectado! Abrindo Cockpit no navegador...
start "" "http://127.0.0.1:3456"
