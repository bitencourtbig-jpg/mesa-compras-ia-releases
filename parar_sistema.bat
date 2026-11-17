@echo off
title Parar Mesa de Compras IA
color 0E
echo ======================================================================
echo    ENCERRANDO SERVIDOR MESA DE COMPRAS IA
echo ======================================================================
echo.

powershell -NoProfile -Command "$pids = Get-NetTCPConnection -LocalPort 3456 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique; foreach ($p in $pids) { if ($p -gt 0) { Stop-Process -Id $p -Force -ErrorAction SilentlyContinue } }; Get-CimInstance Win32_Process -Filter \"Name = 'node.exe'\" | Where-Object { $_.CommandLine -like '*server.mjs*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }" 2>nul
taskkill /F /IM node.exe /FI "WINDOWTITLE eq Mesa de Compras IA*" > nul 2>&1

echo [*] Servidor finalizado com sucesso.
timeout /t 2 > nul
