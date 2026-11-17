@echo off
chcp 65001 > nul
title Servidor Linx Farma BIG - Cockpit Compras
cd /d "%~dp0"

echo ======================================================================
echo    BIG COMPRAS AI - MOTOR DE COMPRAS INTELIGENTE (LINX FARMA BIG)
echo ======================================================================
echo.

set "NODE_EXEC=bin\node.exe"
if not exist "%NODE_EXEC%" (
  set "NODE_EXEC=node"
)

echo [*] Verificando se o servidor ja esta ativo na porta 3456...
powershell -NoProfile -Command "$t = New-Object Net.Sockets.TcpClient; try { $t.Connect('127.0.0.1', 3456); $t.Close(); exit 0 } catch { exit 1 }"
if %errorlevel% equ 0 (
  echo [*] Servidor ja esta em execucao! Abrindo Cockpit no navegador...
  start "" "http://127.0.0.1:3456"
  exit /b 0
)

echo [*] Iniciando servidor analitico local em segundo plano...
start "Mesa de Compras IA - Servidor" /min "%NODE_EXEC%" src\server.mjs

echo [*] Aguardando inicializacao do banco analitico (pode levar 10-15s na primeira vez)...
powershell -NoProfile -Command "$ready = $false; for ($i=0; $i -lt 60; $i++) { Start-Sleep -Milliseconds 500; try { $t = New-Object Net.Sockets.TcpClient; $t.Connect('127.0.0.1', 3456); $t.Close(); $ready = $true; break } catch {} }; if ($ready) { exit 0 } else { exit 1 }"

if %errorlevel% neq 0 (
  echo.
  echo [AVISO] O servidor esta levando mais tempo que o normal para inicializar.
  echo Tente abrir no navegador apos alguns instantes: http://127.0.0.1:3456
  pause
  exit /b 1
)

echo [*] Servidor pronto e conectado! Abrindo o Cockpit no navegador...
start "" "http://127.0.0.1:3456"
echo.
echo ======================================================================
echo    SUCESSO! Cockpit de Compras aberto no navegador.
echo ======================================================================
ping 127.0.0.1 -n 4 > nul
