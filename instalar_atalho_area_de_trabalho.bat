@echo off
title Criar Atalho na Area de Trabalho • BIG Compras AI
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\criar_atalho.ps1"
echo.
pause
