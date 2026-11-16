@echo off
title Desabilitar Inicializacao Automatica • BIG Compras AI
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\configurar_inicializacao_windows.ps1" -Desabilitar
echo.
pause
