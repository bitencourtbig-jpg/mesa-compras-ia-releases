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
echo [*] Iniciando Mesa de Compras IA na porta 3456...
start "" "http://127.0.0.1:3456"
"%NODE_EXEC%" --no-warnings "%~dp0src\server.mjs"
