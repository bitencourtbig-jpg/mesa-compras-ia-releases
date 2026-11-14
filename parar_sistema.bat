@echo off
title Parar Mesa de Compras IA
color 0E
echo ======================================================================
echo    ENCERRANDO SERVIDOR MESA DE COMPRAS IA
echo ======================================================================
echo.

powershell -NoProfile -Command "Get-Process -Name node -ErrorAction SilentlyContinue | Where-Object { $_.Path -like '*Mesa_Compras_IA*' } | Stop-Process -Force" 2>nul
taskkill /F /IM node.exe /FI "WINDOWTITLE eq Mesa de Compras IA*" > nul 2>&1

echo [*] Servidor finalizado com sucesso.
timeout /t 2 > nul
