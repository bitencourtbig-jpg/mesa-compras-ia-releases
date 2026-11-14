@echo off
chcp 65001 > nul
title Publicador Automático de Releases • Mesa de Compras IA
color 0A
cls
echo ======================================================================
echo    PUBLICADOR AUTOMÁTICO DE RELEASES • MESA DE COMPRAS IA
echo    FSConsultoria Farmacêutica • Suporte: (17) 98120-5660
echo    Repositório Oficial: bitencourtbig-jpg/mesa-compras-ia-releases
echo ======================================================================
echo.

set /p "NOVA_VERSAO=Digite a nova versao para publicar (ex: 1.2.0): "

if "%NOVA_VERSAO%"=="" (
    echo [!] Nenhuma versao informada. Operacao cancelada.
    pause
    exit /b 0
)

rem Remover prefixo 'v' se o usuario digitou v1.2.0
if "%NOVA_VERSAO:~0,1%"=="v" set "NOVA_VERSAO=%NOVA_VERSAO:~1%"
set "TAG_NAME=v%NOVA_VERSAO%"

echo.
echo ======================================================================
echo    INICIANDO PROCESSO AUTOMATIZADO PARA A VERSÃO: %TAG_NAME%
echo ======================================================================
echo.

cd /d "%~dp0"

echo [*] [1/5] Gerando pacote oficial limpo com runtime portátil embutido...
node scripts\empacotar_cliente.mjs
if errorlevel 1 (
    echo [ERRO] Falha ao empacotar cliente. Verifique os logs acima.
    pause
    exit /b 1
)

echo.
echo [*] [2/5] Compilando executáveis oficiais leves (.exe) nativos...
set "CSC_COMPILER=C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
set "SRC_INSTALADOR=..\Entrega_Mesa_Compras_IA\dev_tools\Installer.cs"
set "OUT_INSTALADOR=..\Entrega_Mesa_Compras_IA\Instalador_Mesa_Compras_IA.exe"
set "SRC_UPDATER=..\Entrega_Mesa_Compras_IA\dev_tools\Updater.cs"
set "OUT_UPDATER=..\Entrega_Mesa_Compras_IA\Atualizar_Mesa_Compras_IA.exe"
set "ICO_FILE=assets\icone_mesa_compras.ico"

if exist "%CSC_COMPILER%" (
    %CSC_COMPILER% /nologo /optimize+ /target:exe /out:"%OUT_INSTALADOR%" /r:System.IO.Compression.FileSystem.dll /win32icon:"%ICO_FILE%" "%SRC_INSTALADOR%" > nul 2>&1
    %CSC_COMPILER% /nologo /optimize+ /target:exe /out:"%OUT_UPDATER%" /r:System.IO.Compression.FileSystem.dll /win32icon:"%ICO_FILE%" "%SRC_UPDATER%" > nul 2>&1
    echo   ✓ Instalador_Mesa_Compras_IA.exe e Atualizar_Mesa_Compras_IA.exe compilados com sucesso.
)

echo.
echo [*] [3/5] Atualizando versão no package.json...
powershell -NoProfile -Command ^
  "$pkg = Get-Content package.json -Raw | ConvertFrom-Json;" ^
  "$pkg.version = '%NOVA_VERSAO%';" ^
  "$pkg | ConvertTo-Json -Depth 5 | Set-Content package.json -Encoding UTF8;"

echo.
echo [*] [4/5] Adicionando alterações e criando commit Git...
git add -A
git commit -m "Release %TAG_NAME%: melhorias validadas de produção"

echo.
echo [*] [5/5] Enviando código e tag %TAG_NAME% diretamente para o GitHub...
git tag -a "%TAG_NAME%" -m "Release Oficial %TAG_NAME% • FSConsultoria"
git push origin main --tags

if errorlevel 1 (
    echo.
    echo [ERRO] Falha ao enviar para o GitHub. Verifique a conexão com a internet.
    pause
    exit /b 1
)

echo.
echo ======================================================================
echo   ✓ VERSÃO %TAG_NAME% PUBLICADA COM SUCESSO NO GITHUB!
echo.
echo   1. O código e a tag foram enviados ao repositório oficial.
echo   2. O GitHub Actions gerou a nova Release automaticamente.
echo   3. O instalador dos clientes (Instalador_Mesa_Compras_IA.exe) e o
echo      atualizador (Atualizar_Mesa_Compras_IA.exe) já estão entregando
echo      a nova versão na nuvem!
echo ======================================================================
echo.
pause
